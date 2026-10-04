import { boundedJsonBody } from './request-body';
import { db, identity, json, loadFor } from './server';
import { digest, fail, uuid } from './core';
import { persist, scope, type Row } from './store';
import { ACCESS_AUDIT } from './audit-chain';
import { recordAggregateView } from './read-audit';
import { requireReporting } from './operations';
import { FIELD_DEVICE_RULES, REPORT_DAILY_ROWS, REPORT_MAX_AGE_DAYS, applyRemovalReceipt, fieldDevicePostSchema, fieldDeviceView, removalOrders, syncReportRows, type SyncReportRow } from './field-device';
import type { OrgState } from './types';

// Slice 14e (R73): the field notebook's device route (lib/saha/field-device.ts).
//   GET  /api/field-device                    the signed-in worker's removal orders (their own grants only; no names)
//   GET  /api/field-device?view=operations    supervisors and operations members: device copies and sync failure reports
//   POST /api/field-device {kind:'sync-failures'}   counts of failed sync steps (no patient details), one audit event
//   POST /api/field-device {kind:'removal-receipt'} one patient's copies removed from the device, stored on the grants
const COLUMNS = ['id', 'actor_id', 'person_id', 'lease_id', 'step', 'error_class', 'count', 'first_at', 'last_at', 'app_version', 'report_key', 'received_at', 'audit_id'] as const;
function sameOrigin(request: Request) { const origin = request.headers.get('origin');if (origin && origin !== new URL(request.url).origin) fail(403, 'Cross-origin changes are not allowed.');if (request.headers.get('sec-fetch-site') === 'cross-site') fail(403, 'Cross-site changes are not allowed.'); }
function idempotency(request: Request) { const key = request.headers.get('idempotency-key');if (!key || !/^[a-zA-Z0-9_-]{8,100}$/.test(key)) fail(400, 'A valid idempotency key is required.');return key!; }
// The last REPORT_MAX_AGE_DAYS days of reports, newest first, for the Operations view and the exception queue.
export async function recentSyncReports(orgId: string, now = new Date().toISOString()): Promise<SyncReportRow[]> {
  const since = new Date(Date.parse(now) - REPORT_MAX_AGE_DAYS * 86400000).toISOString();
  return (await db().prepare(`SELECT ${COLUMNS.join(',')} FROM field_sync_reports WHERE org_id=? AND received_at>=? ORDER BY received_at DESC,id LIMIT 1000`).bind(orgId, since).all<SyncReportRow>()).results;
}
export async function fieldDeviceRead(request: Request) {
  const u = await identity(), view = new URL(request.url).searchParams.get('view') ?? 'device';
  if (!['device', 'operations'].includes(view)) fail(422, 'Unknown view.');
  const s = await loadFor(u, request.headers.get('x-saha-organisation')), m = scope(s, u.userId), now = new Date().toISOString();
  if (view === 'device') return json({ rules: FIELD_DEVICE_RULES, generatedAt: now, removals: removalOrders(s, u.userId, now) });
  requireReporting(m);
  const result = fieldDeviceView(s, m, await recentSyncReports(s.organisation.id, now), now);
  // The view names in-scope patients beside device copies: recorded before it is returned (slice 10h), counts only.
  await recordAggregateView(db(), s, u, m, 'field device operations', `Field device view read: ${result.removals.pending} device cop${result.removals.pending === 1 ? 'y' : 'ies'} awaiting removal, ${result.removals.confirmed} confirmed, ${result.syncFailures.total} sync failure report${result.syncFailures.total === 1 ? '' : 's'} in the last ${REPORT_MAX_AGE_DAYS} days. Counts only.`, now);
  return json(result);
}
export async function fieldDeviceWrite(request: Request) {
  sameOrigin(request);const u = await identity(), key = idempotency(request);
  if (!request.headers.get('content-type')?.startsWith('application/json')) fail(415, 'Use JSON for this operation.');
  const parsed = fieldDevicePostSchema.safeParse(await boundedJsonBody(request, 16000));
  if (!parsed.success) fail(422, parsed.error.issues[0]?.message ?? 'Invalid field device report.');
  const c = parsed.data, hash = await digest(c), org = request.headers.get('x-saha-organisation');
  if (c.kind === 'sync-failures') {
    const s = await loadFor(u, org), m = scope(s, u.userId), orgId = s.organisation.id, now = new Date().toISOString();
    if (!['asha', 'clinician'].includes(m.role)) fail(403, 'Sync failure reports come from the field notebooks of care workers (ASHA or clinician).');
    // A report already stored under this key is answered again without a second audit event.
    const prior = await db().prepare('SELECT count(*) AS n FROM field_sync_reports WHERE org_id=? AND actor_id=? AND report_key=?').bind(orgId, u.userId, key).first<{ n: number }>();
    if (prior?.n) return json({ recorded: prior.n, replayed: true });
    const today = await db().prepare('SELECT count(*) AS n FROM field_sync_reports WHERE org_id=? AND actor_id=? AND received_at>=?').bind(orgId, u.userId, new Date(Date.parse(now) - 86400000).toISOString()).first<{ n: number }>();
    if ((today?.n ?? 0) + c.reports.length > REPORT_DAILY_ROWS) fail(429, `A notebook may report at most ${REPORT_DAILY_ROWS} sync failure entries a day. The notebook keeps the counts and reports them later.`);
    const auditId = uuid(), { rows, detail } = syncReportRows(s, u.userId, c, key, auditId, now);
    const before = shell(s), after = shell(s);
    after.workspace.audit = [{ id: auditId, at: now, actor: u.displayName, actorId: u.userId, role: m.role, action: 'fieldSyncReport', subject: orgId, detail, personId: null }];
    const extra: Row[] = rows.map(r => ({ table: 'field_sync_reports', keys: ['org_id', 'id'], append: true, values: { org_id: orgId, ...r } }));
    await persist(db(), before, after, u, { type: ACCESS_AUDIT }, 'field_sync_' + auditId, '', null, extra);
    return json({ recorded: rows.length });
  }
  // A removal receipt: replayed by its key, then applied to the one patient's grants under the patient guard.
  const old = await db().prepare('SELECT hash,result FROM command_receipts WHERE actor_id=? AND key=?').bind(u.userId, key).first<{ hash: string; result: string }>();
  if (old) { if (old.hash !== hash) fail(409, 'This operation key was already used for different input.');return json({ ...JSON.parse(old.result), replayed: true }); }
  const s = await loadFor(u, org, async () => [c.personId]), before = structuredClone(s), m = scope(s, u.userId), now = new Date().toISOString();
  const result = applyRemovalReceipt(s, u, m, c, now);
  await persist(db(), before, s, u, { type: 'confirmFieldRemoval' }, key, hash, result);
  return json(result);
}
// An access-audit commit carries only its audit event and side rows: no record of the organisation is compared or written.
const shell = (s: OrgState): OrgState => ({ organisation: s.organisation, teams: [], members: [], invitations: [], workspace: { ...s.workspace, people: [], visits: [], integrations: [], submissions: [], referrals: [], audit: [], receipts: {} } });
