import { db, identity, loadFor, json } from './server.js';
import { recordAggregateView } from './read-audit.js';
import { scope } from './store.js';
import { currentDefinitions } from './indicators.js';
import { operationsOf } from './adapter-operations.js';
import { AGGREGATE_GROUPS, APPROVAL_HOURS, reportsOf, reportView } from './aggregate-delivery.js';
import { manager } from './indicators.js';
// Slice 7g: aggregate-only destinations, what an owner or supervisor may report on, and the report history with
// receipts for reports whose teams are all in the viewer's reporting scope. Reports hold suppressed aggregate cells
// only; the differencing ledger is never returned.
// Slice 6ad (ninth review, finding 1): the cells are not returned either (reportView): only the manifest and which
// blocks were withheld. Cells were screened for the destination, not for the person reading.
export async function aggregateReportsRead(request) {
    const u = await identity(), s = await loadFor(u, request.headers.get('x-saha-organisation')), m = scope(s, u.userId);
    manager(m);
    const destinations = s.workspace.integrations.filter(i => i.kind === 'mis' && operationsOf(i).aggregateOnly).map(i => { const o = operationsOf(i); return { id: i.id, name: i.name, mode: i.mode, status: i.status, settingVersion: o.version, aggregate: o.allowed.includes('aggregate'), lookup: o.allowed.includes('lookup') }; });
    const reports = reportsOf(s).filter(r => r.teamIds.every(t => m.teamIds.includes(t))).slice(-100).reverse().map(r => ({ ...reportView(r), teamNames: r.teamIds.map(t => s.teams.find(x => x.id === t)?.name ?? t) }));
    // Slice 10h: the report history and manifests are an aggregate view, recorded before they are returned (counts only).
    await recordAggregateView(db(), s, u, m, 'aggregate report history', `Aggregate report history viewed: ${reports.length} report${reports.length === 1 ? '' : 's'} in the viewer's reporting scope, ${destinations.length} aggregate destination${destinations.length === 1 ? '' : 's'}; manifests only (no cell values).`);
    return json({ destinations, reports, approvalHours: APPROVAL_HOURS, groups: AGGREGATE_GROUPS, viewer: u.userId,
        catalogue: currentDefinitions(s).filter(r => r.status === 'active').map(r => ({ id: r.id, version: r.version, title: r.spec.title, unit: r.spec.unit })),
        teams: s.teams.filter(t => m.teamIds.includes(t.id)).map(t => ({ id: t.id, name: t.name })) });
}
