import { db, identity, loadFor, json } from './server.js';
import { defaultOutreach, messageReview, outreachEvidenceCurrent } from './outreach.js';
import { allowed } from './access.js';
import { operator } from './operations.js';
import { expansionFor, expansionStatus, EXPANSION_CHECKS } from './expansion.js';
import { digest, fail, uuid } from './core.js';
import { scope } from './store.js';
import { recordExportAudit } from './export-audit.js';
export async function outreachRead(request) {
    const u = await identity(), s = await loadFor(u, request.headers.get('x-saha-organisation')), m = scope(s, u.userId), o = s.outreach ?? defaultOutreach();
    const ids = new Set(s.workspace.people.filter(p => allowed(m, p)).map(p => p.id));
    const plans = o.plans.map(p => ({ ...p, items: p.items.filter(i => ids.has(i.personId)).map(i => ({ ...i, evidenceCurrent: outreachEvidenceCurrent(s, i) })) })).filter(p => p.items.length).map(p => ({ ...p, fullScope: o.plans.find(x => x.id === p.id).items.every(i => ids.has(i.personId)) }));
    const messages = await Promise.all(o.messages.filter(v => ids.has(v.personId)).map(async (v) => { let preview = null, blocker = ''; try {
        preview = await messageReview(s, v);
    }
    catch (e) {
        blocker = e instanceof Error ? e.message : 'Review unavailable.';
    } return { ...v, preview, blocker }; }));
    return json({ environment: 'synthetic', liveMessaging: false, generatedAt: new Date().toISOString(), canManageTemplates: operator(m), canReview: ['clinician', 'supervisor'].includes(m.role), plans, messages, templates: o.templates, people: s.workspace.people.filter(p => ids.has(p.id)).map(p => ({ id: p.id, name: p.name, village: p.village, version: p.version, teamId: p.teamId, assignedTo: p.assignedTo, preferences: p.contactPreferences ?? null, dueTasks: (p.followUps ?? []).filter(t => t.state === 'open').map(t => ({ id: t.id, title: t.title, due: t.due, packId: t.packId })), programmes: (p.enrolments ?? []).filter(e => e.state === 'active').map(e => e.packId) })), members: s.members.filter(x => x.status === 'active' && (operator(m) || x.teamIds.some(t => m.teamIds.includes(t)))).map(x => ({ id: x.userId, name: x.displayName, role: x.role, teamIds: x.teamIds })), teams: s.teams.filter(t => m.teamIds.includes(t.id)), visits: s.workspace.visits.filter(v => ids.has(v.personId) && v.state === 'confirmed' && !v.voidedAt && !v.supersededBy).map(v => ({ id: v.id, personId: v.personId, createdAt: v.createdAt })) });
}
export async function expansionRead(request) {
    const u = await identity(), s = await loadFor(u, request.headers.get('x-saha-organisation')), m = scope(s, u.userId);
    if (!operator(m))
        fail(403, 'Operations access required.');
    const url = new URL(request.url), format = url.searchParams.get('format') ?? 'json';
    if (!['json', 'pack'].includes(format))
        fail(422, 'Unsupported expansion format.');
    if (format === 'json')
        return json({ environment: 'synthetic', liveExpansion: false, checks: EXPANSION_CHECKS, proposals: await Promise.all((s.expansions ?? []).map(async (p) => ({ ...p, readiness: await expansionStatus(s, p) }))), members: s.members.filter(x => x.status === 'active' && operator(x)).map(x => ({ id: x.userId, name: x.displayName, isOwner: x.isOwner })), pilotExitAccepted: false });
    const p = expansionFor(s, url.searchParams.get('id') ?? ''), pack = { format: 'saha-expansion-proposal', schema: 1, spec: p.spec };
    // Slice 6u (fourth review): the export audit goes through recordExportAudit (slice 6p) with operations access checked again.
    const orgId = s.organisation.id, auditId = uuid(), at = new Date().toISOString(), again = (x) => { const o = scope(x, u.userId); if (!operator(o))
        fail(403, 'Operations access required.'); if (o.role !== m.role)
        fail(409, 'Your role changed while the export was prepared. Export again.'); return o; };
    await recordExportAudit(db(), { state: s, reload: () => loadFor(u, orgId), authorize: again, event: o => ({ id: auditId, at, actorId: u.userId, actor: u.displayName, role: o.role, action: 'expansionExport', subject: orgId, detail: `Configuration-only expansion proposal ${p.id} exported. Evidence, accounts, approvals, credentials and patient records excluded.` }), actor: u, type: 'expansionExport', key: 'export_' + uuid(), hash: await digest(pack) });
    return new Response(JSON.stringify(pack, null, 2), { headers: { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="saha-expansion-proposal.json"', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
