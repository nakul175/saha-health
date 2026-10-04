import { z } from 'zod';
import { db, identity, loadFor, json } from './server';
import { scope } from './store';
import { fail, uuid } from './core';
import { recordAccess } from './access-audit';
import { ensurePurpose } from './purpose-scope';
import { boundedJsonBody } from './request-body';
import { operationsRead } from './operations-server';
import { HELD_EXPORT_TTL_MS, KEEP_ROWS_DAYS, MAX_HELD_BYTES, MAX_HELD_PER_MEMBER, MAX_HELD_PER_ORG, heldDecision, reachFingerprint, type HeldRow } from './held-exports';

// Slice 14g (BR-REP-05): held, expiring, single-delivery aggregate exports. POST prepares the suppressed operational report through
// the ordinary operations export (same authority, purpose, suppression, filters and audit event) and holds it for the member;
// GET ?id= delivers it once before it expires; GET with no id lists the member's own holds (metadata only, never content).
const input = z.object({
  kind: z.literal('operations-csv'),
  days: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(30),
  team: z.string().max(100).optional(),
  programme: z.string().max(60).optional(),
}).strict();
const view = (r: HeldRow, now: string) => ({ id: r.id, kind: r.kind, createdAt: r.created_at, expiresAt: r.expires_at, state: r.downloaded_at ? 'downloaded' : r.expires_at <= now || !r.content ? 'expired' : 'ready', sha256: r.sha256, bytes: r.bytes });
async function housekeeping(orgId: string, now: string) {
  // Expired or delivered content is blanked wherever it is found; old metadata rows are removed after KEEP_ROWS_DAYS.
  await db().prepare("UPDATE held_exports SET content='' WHERE org_id=? AND content<>'' AND (expires_at<=? OR downloaded_at IS NOT NULL)").bind(orgId, now).run();
  await db().prepare('DELETE FROM held_exports WHERE org_id=? AND created_at<?').bind(orgId, new Date(Date.parse(now) - KEEP_ROWS_DAYS * 86400000).toISOString()).run();
}
export async function heldExportsPost(request: Request) {
  // Integration 14: identify the caller before reading or validating the body, so an anonymous request is a 401, not a 422 about the input.
  const u = await identity();
  const raw = await boundedJsonBody(request, 2000), parsed = input.safeParse(raw);
  if (!parsed.success) fail(422, parsed.error.issues[0]?.message ?? 'Invalid export request.');
  const q = parsed.data!, orgHeader = request.headers.get('x-saha-organisation');
  const s = await loadFor(u, orgHeader), m = scope(s, u.userId), now = new Date().toISOString(), orgId = s.organisation.id;
  ensurePurpose(m, 'reporting');
  await housekeeping(orgId, now);
  const live = await db().prepare("SELECT user_id AS u, count(*) AS n FROM held_exports WHERE org_id=? AND downloaded_at IS NULL AND expires_at>? AND content<>'' GROUP BY user_id").bind(orgId, now).all<{ u: string; n: number }>();
  if ((live.results.find(r => r.u === u.userId)?.n ?? 0) >= MAX_HELD_PER_MEMBER) fail(429, `You already hold ${MAX_HELD_PER_MEMBER} exports that have not been downloaded. Download one or wait for it to expire.`);
  if (live.results.reduce((n, r) => n + r.n, 0) >= MAX_HELD_PER_ORG) fail(429, 'Too many exports are held for download in this organisation. Try again shortly.');
  // The ordinary export does the authorisation (administrators and care roles without reporting reach are refused), the
  // suppression, the filters and the opsExport audit event; the file is held only if all of that succeeded.
  const url = new URL(request.url), p = new URLSearchParams({ format: 'csv', days: String(q.days) });
  if (q.team) p.set('team', q.team); if (q.programme) p.set('programme', q.programme);
  const res = await operationsRead(new Request(`${url.origin}/api/operations?${p}`, { headers: orgHeader ? { 'x-saha-organisation': orgHeader } : {} }));
  const content = await res.text(), sha = res.headers.get('x-saha-content-sha256') ?? '', exportId = res.headers.get('x-saha-export-id') ?? '';
  if (!res.ok || !sha) fail(502, 'The export could not be prepared.');
  const bytes = new TextEncoder().encode(content).length;
  if (bytes > MAX_HELD_BYTES) fail(413, 'This export is too large to hold. Narrow the filters.');
  const fresh = await loadFor(u, orgHeader), fingerprint = await reachFingerprint(fresh, scope(fresh, u.userId), now);
  const id = uuid(), expiresAt = new Date(Date.parse(now) + HELD_EXPORT_TTL_MS).toISOString();
  await db().prepare('INSERT INTO held_exports (org_id,id,user_id,kind,created_at,expires_at,downloaded_at,sha256,bytes,fingerprint,content) VALUES (?,?,?,?,?,?,NULL,?,?,?,?)').bind(orgId, id, u.userId, q.kind, now, expiresAt, sha, bytes, fingerprint, content).run();
  return json({ id, kind: q.kind, exportId, createdAt: now, expiresAt, sha256: sha, bytes, downloadPath: `/api/exports?id=${id}`, deliveredOnce: true, notice: 'Delivered once to you before it expires. Small counts are suppressed in the file.' }, 201);
}
export async function heldExportsRead(request: Request) {
  const u = await identity(), s = await loadFor(u, request.headers.get('x-saha-organisation')), m = scope(s, u.userId), now = new Date().toISOString(), orgId = s.organisation.id;
  const id = new URL(request.url).searchParams.get('id');
  if (id === null) {
    await housekeeping(orgId, now);
    const rows = await db().prepare('SELECT * FROM held_exports WHERE org_id=? AND user_id=? ORDER BY created_at DESC LIMIT 20').bind(orgId, u.userId).all<HeldRow>();
    return json({ ttlMinutes: HELD_EXPORT_TTL_MS / 60000, exports: rows.results.map(r => view(r, now)) });
  }
  if (!/^[0-9a-f-]{36}$/.test(id)) fail(404, 'No held export with that identifier.');
  const row = await db().prepare('SELECT * FROM held_exports WHERE org_id=? AND id=?').bind(orgId, id).first<HeldRow>();
  // Authority is checked again at delivery, not only when the file was prepared.
  if (row && row.user_id === u.userId) { if (m.role === 'admin') fail(403, 'Clinical reporting is unavailable to administrators.'); ensurePurpose(m, 'reporting'); }
  const decision = heldDecision(row, u.userId, row ? await reachFingerprint(s, m, now).catch(() => '') : '', now);
  if (!decision.ok) {
    if (row && decision.reason !== 'not-yours' && decision.reason !== 'missing') await db().prepare("UPDATE held_exports SET content='' WHERE org_id=? AND id=?").bind(orgId, id).run();
    fail(decision.status, decision.message);
  }
  // Atomic claim: of two simultaneous downloads only one changes the row.
  const claim = await db().prepare("UPDATE held_exports SET downloaded_at=? WHERE org_id=? AND id=? AND user_id=? AND downloaded_at IS NULL AND expires_at>? AND content<>''").bind(now, orgId, id, u.userId, now).run();
  if ((claim.meta?.changes ?? 0) !== 1) fail(410, 'This export has already been downloaded. Prepare it again.');
  try {
    await recordAccess(db(), s, u, m, { action: 'exportDownload', subject: id, detail: `Held aggregate export ${id} (${row!.kind}) downloaded once; ${row!.bytes} bytes; SHA-256 ${row!.sha256}; prepared ${row!.created_at}, expired ${row!.expires_at}.` }, now);
  } catch (e) {
    // Fail closed: nothing is delivered if the download cannot be recorded, and the claim is released.
    await db().prepare('UPDATE held_exports SET downloaded_at=NULL WHERE org_id=? AND id=? AND user_id=?').bind(orgId, id, u.userId).run();
    throw e;
  }
  await db().prepare("UPDATE held_exports SET content='' WHERE org_id=? AND id=?").bind(orgId, id).run();
  return new Response(row!.content, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="saha-report.csv"', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Saha-Content-SHA256': row!.sha256, 'X-Saha-Expires-At': row!.expires_at } });
}
