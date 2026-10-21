import { identity, loadFor, json, db, runtime } from './server.js';
import { scope } from './store.js';
import { providers } from './agent.js';
import { providerSelfServiceContract } from './provider-sandbox-contract.js';
import { governanceManager, governanceState, entryScope } from './governance.js';
// Slice 5b: provider sandbox status for sandbox members, and importable proposals for production owners.
const latest = (evaluations, e) => { const ev = evaluations.filter(x => x.entryId === e.id && x.manifestHash === e.manifestHash && x.state !== 'cancelled').sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]; return ev ? { id: ev.id, state: ev.state, passed: !!ev.metrics?.passed, cases: ev.caseIds.length, done: ev.results.length, precision: ev.metrics?.precision ?? null, recall: ev.metrics?.recall ?? null } : null; };
const proposal = (g, e) => ({ entryId: e.id, entryVersion: e.version, key: e.spec.key, title: e.spec.title, revision: e.revision, state: e.state, manifestHash: e.manifestHash, createdAt: e.createdAt, superseded: g.entries.some(x => x.replacesId === e.id), evaluation: latest(g.evaluations, e) });
export async function providerSandboxRead(request) {
    const u = await identity(), s = await loadFor(u, request.headers.get('x-saha-organisation')), m = scope(s, u.userId), g = governanceState(s), sb = g.sandbox;
    const notice = 'Synthetic sandbox only. Provider accounts cannot see patient records, review or activate anything, or reach a production organisation. Credential references name a server-side binding; no credential value is stored.';
    if (sb) {
        const member = m.isOwner || m.role === 'provider';
        return json({ notice, contract: providerSelfServiceContract(sb), sandbox: { organisationId: s.organisation.id, providerId: sb.providerId, providerName: sb.providerName, declaredAt: sb.declaredAt, reason: sb.reason, documentation: member ? sb.documentation ?? null : null }, proposals: member ? g.entries.filter(e => e.spec.kind === 'capability').map(e => proposal(g, e)) : [], canEditDocs: member, canInvite: m.isOwner, role: m.role });
    }
    const imported = governanceManager(m) ? g.entries.filter(e => e.origin && entryScope(m, e)).map(e => ({ entryId: e.id, title: e.spec.title, revision: e.revision, state: e.state, origin: e.origin })) : [];
    let sandboxes = [];
    if (m.isOwner) {
        const rows = await db().prepare(`SELECT g.org_id,g.data,o.name FROM governance g JOIN organisations o ON o.id=g.org_id JOIN memberships m ON m.org_id=g.org_id AND m.user_id=? AND m.status='active' AND m.is_owner=1 WHERE g.org_id<>? AND instr(g.data,'"sandbox"')>0 ORDER BY o.created_at LIMIT 10`).bind(u.userId, s.organisation.id).all();
        sandboxes = rows.results.flatMap(r => { const x = JSON.parse(r.data); const box = x.sandbox; if (!box)
            return []; return [{ organisationId: r.org_id, name: r.name, providerId: box.providerId, providerName: box.providerName, documentation: box.documentation ? { version: box.documentation.version, summary: box.documentation.summary, updatedAt: box.documentation.updatedAt } : null, proposals: x.entries.filter(e => e.spec.kind === 'capability' && e.spec.providerId === box.providerId && e.state === 'draft' && !x.entries.some(y => y.replacesId === e.id)).map(e => ({ ...proposal(x, e), imported: g.entries.some(y => y.origin?.sandboxEntryId === e.id && y.origin.sandboxManifestHash === e.manifestHash) })) }]; });
    }
    const canDeclare = m.isOwner && !s.workspace.people.length && !s.workspace.visits.length && !s.members.some(x => x.status === 'active' && x.userId !== u.userId && !x.isOwner) && !g.entries.some(e => ['active', 'reviewed'].includes(e.state));
    return json({ notice, sandbox: null, canDeclare, providers: m.isOwner ? providers(s.workspace.integrations, runtime()).map(p => ({ id: p.id, name: p.name })) : [], sandboxes, imported, role: m.role });
}
