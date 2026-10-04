import { identity, loadFor, db, rawRuntime } from './server';
import { environmentOf } from './environment';
import { scope } from './store';
import { recordExportAudit } from './export-audit';
import { digest, fail, uuid } from './core';
import { REGISTER_FORMAT, sha256Text, verifyRegister } from './disposal-effects';
import { registerEntries } from './disposal-execution';
import type { OrgState } from './types';

// GET /api/retention/disposal-register: owners download the organisation's complete register to keep beside its backups
// (scripts/recovery.mjs re-applies it after a restore). It is complete, not limited to the owner's care scope, because a
// partial register would let a restore bring disposed records back; it holds identifiers, times, rules, member ids and
// content hashes, never content. Each download is recorded in the audit chain with the register head.
export async function disposalRegisterRead(request: Request) {
  const u = await identity(), s = await loadFor(u, request.headers.get('x-saha-organisation')), m = scope(s, u.userId);
  if (!m.isOwner) fail(403, 'Only an organisation owner can download the disposal register.');
  const orgId = s.organisation.id, entries = await registerEntries(db(), orgId), check = await verifyRegister(entries), generatedAt = new Date().toISOString();
  const body = { format: REGISTER_FORMAT, organisationId: orgId, generatedAt, environment: environmentOf(rawRuntime()).name, entries, head: check.head, verification: { ok: check.ok, problem: check.problem },
    note: 'Keep this file with the organisation\'s backups. After restoring a backup, re-apply it (node scripts/recovery.mjs restore ... --disposal-register <this file>) so disposed records do not come back. It holds identifiers, times, rules, member ids and content hashes, never record content.' };
  const text = JSON.stringify(body, null, 1), sha = await sha256Text(text);
  const owner = (x: OrgState) => { const o = scope(x, u.userId); if (!o.isOwner) fail(403, 'Only an organisation owner can download the disposal register.'); return o; };
  await recordExportAudit(db(), { state: s, reload: () => loadFor(u, orgId), authorize: owner, event: o => ({ id: uuid(), at: generatedAt, actorId: u.userId, actor: u.displayName, role: o.role, action: 'disposalRegisterExport', subject: orgId, detail: `Disposal register downloaded: ${entries.length} entries${check.head ? `, head ${check.head.seq} ${check.head.hash}` : ''}; chain ${check.ok ? 'intact' : `broken (${check.problem})`}; file SHA-256 ${sha}.` }), actor: u, type: 'disposalRegisterExport', key: 'register_' + uuid(), hash: await digest({ orgId, sha }) });
  return new Response(text, { headers: { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="saha-disposal-register-${generatedAt.slice(0, 10)}-${orgId.slice(4, 12)}.json"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Saha-Content-SHA256': sha } });
}
