import { identity, loadFor, json, db } from './server.js';
import { ensurePurpose } from './purpose-scope.js';
import { fail, person } from './core.js';
import { scope } from './store.js';
import { householdOf, householdView, PURPOSES } from './household.js';
import { householdVisitPlan } from './household-visit.js';
import { accessRoute, recordAccesses } from './access-audit.js';
// Slice 1: worker-facing household view and sharing preview. Loads only the household's members.
export async function householdRead(request) {
    const u = await identity(), url = new URL(request.url), personId = url.searchParams.get('personId') ?? '', recipient = url.searchParams.get('recipient'), purpose = (url.searchParams.get('purpose') ?? 'care-coordination');
    if (!personId || personId.length > 100 || (recipient && recipient.length > 100))
        fail(422, 'Choose a person.');
    if (!PURPOSES.includes(purpose))
        fail(422, 'Choose a sharing purpose.');
    const s = await loadFor(u, request.headers.get('x-saha-organisation'), async (orgId) => {
        const row = await db().prepare("SELECT json_extract(data,'$.householdId') AS h FROM patients WHERE org_id=? AND id=?").bind(orgId, personId).first();
        if (!row?.h)
            return [personId];
        const h = await db().prepare('SELECT data FROM households WHERE org_id=? AND id=?').bind(orgId, row.h).first();
        const members = h ? JSON.parse(h.data).members.filter(x => !x.to).map(x => x.personId) : [];
        return [...new Set([personId, ...members])].slice(0, 40);
    });
    const m = scope(s, u.userId);
    if (m.role === 'admin')
        fail(403, 'Patient access is required.');
    // Slice 13a: previewing what one member's details would disclose to another is a household-sharing flow.
    if (recipient)
        ensurePurpose(m, 'household-sharing');
    const p = person(s.workspace, personId), view = householdView(s, m, p, recipient, purpose), h = householdOf(s, p);
    // Slice 10f: the household visit plan (each in-scope member's open items and the planned slots) rides on the same scoped read.
    const plan = h ? householdVisitPlan(s, m, h) : null;
    // Slice 13d (round-10 review M3): one read-audit event per in-scope member shown, before anything is returned; if they cannot be
    // written the read is refused (503), as for every other audited read.
    if (h && 'members' in view && view.members?.length) {
        const shown = view.members, items = plan ? plan.members.reduce((n, x) => n + x.items.length, 0) : 0;
        await recordAccesses(db(), s, u, m, shown.map(x => { const q = s.workspace.people.find(y => y.id === x.personId); return { action: 'viewHousehold', subject: h.id, personId: q.id, detail: `Household view: ${shown.length} member${shown.length === 1 ? '' : 's'} in scope shown${recipient ? `, sharing preview for ${purpose}` : ''}${plan ? `; visit plan with ${items} open item${items === 1 ? '' : 's'}` : ''}.${accessRoute(m, q)}` }; }));
    }
    return json(h ? { ...view, visitPlan: plan } : view);
}
