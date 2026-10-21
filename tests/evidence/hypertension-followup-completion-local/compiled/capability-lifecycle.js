import { fail } from './core.js';
import { DATA_RELEASE, PROMPT_RELEASE, TOOL_RELEASE } from './ai-version-pin.js';
export const EXPERIMENTAL_OUTPUT_USES = ['trial', 'shadow', 'training', 'synthetic-evaluation'];
// Every result carries its exact deployment and immutable package version. Experimental evidence shares the
// envelope for reproducibility, but can never pass the operational boundary below.
export function capabilityOutputContext(s, e, use) { return { use, organisationId: s.organisation.id, entryId: e.id, entryVersion: e.version, revision: e.revision, manifestHash: e.manifestHash }; }
// The only boundary that permits a capability output to influence a clinical draft.
export function assertOperationalCapabilityOutput(s, c, now = new Date().toISOString()) {
    if (c.use !== 'operational')
        fail(409, `${c.use} capability output is evaluation evidence only and cannot influence care.`);
    if (c.organisationId !== s.organisation.id)
        fail(403, 'Capability output belongs to another deployment.');
    const e = entries(s).find(x => x.id === c.entryId);
    if (!e)
        fail(404, 'Capability output package not found.');
    if (e.spec.kind !== 'capability' || e.version !== c.entryVersion || e.revision !== c.revision || e.manifestHash !== c.manifestHash)
        fail(409, 'Capability output version is stale. Prepare a fresh request.');
    if (e.state !== 'active')
        fail(409, e.state === 'suspended' ? 'Capability is suspended; new use and clinical application are blocked.' : 'Capability is not active for this deployment.');
    if (e.spec.effectiveFrom > now.slice(0, 10) || e.spec.reviewBy < now.slice(0, 10))
        fail(409, 'Capability deployment dates are no longer current.');
    return e;
}
export const STAGE_LABEL = { registered: 'Registered', 'technically-verified': 'Technically verified', 'approved-for-scope': 'Approved for its scope', active: 'Active', suspended: 'Suspended', retired: 'Retired', replaced: 'Replaced' };
export const ACTION_LABEL = { cancel: 'Cancel the unsent request', 'await-outcome': 'Sent: its result will be withheld', 'review': 'Review or dismiss the result; it cannot be applied', 'check-applied': 'Check the applied values before confirming the visit' };
const entries = (s) => s.governance?.entries ?? [];
// A retired package whose replacement was activated. Older records without replacedBy are matched by the
// replacement's history: a later revision of the same key that was made active.
export function replacementOf(s, e) {
    if (e.state !== 'retired')
        return undefined;
    const id = e.replacedBy;
    if (id)
        return entries(s).find(x => x.id === id);
    return entries(s).filter(x => x.spec.key === e.spec.key && x.revision > e.revision && x.history.some(h => h.state === 'active')).sort((a, b) => a.revision - b.revision)[0];
}
export function lifecycleStage(s, e) {
    const out = (stage, detail) => ({ stage, label: STAGE_LABEL[stage], detail });
    if (e.state === 'retired') {
        const r = replacementOf(s, e);
        return r ? out('replaced', `Replaced by revision ${r.revision}.`) : out('retired', 'Withdrawn without a replacement.');
    }
    if (e.state === 'suspended')
        return out('suspended', 'New invocations are refused; in-progress work is listed for cancellation or review.');
    if (e.state === 'active')
        return out('active', 'Usable only while its review, owner, dates and evaluation stay current.');
    if (e.state === 'reviewed')
        return out('approved-for-scope', 'Independently reviewed for its teams, roles, ages, languages, settings and tasks; awaiting owner activation.');
    const ev = e.spec.kind === 'capability' ? (s.governance?.evaluations ?? []).find(x => x.entryId === e.id && x.manifestHash === e.manifestHash && x.state === 'completed' && x.metrics?.passed) : undefined;
    return ev ? out('technically-verified', 'A passing synthetic evaluation is bound to this exact manifest; independent review is next.') : out('registered', e.spec.kind === 'capability' ? 'Needs a passing version-bound synthetic evaluation, then independent review.' : 'Needs independent review.');
}
const runsOf = (visits, entryId) => visits.flatMap(v => (v.agentRuns ?? []).filter(r => r.governance?.id === entryId).map(r => ({ v, r })));
// How many runs used exactly this package version, by status. Counts only; no patient detail.
export function capabilityUsage(visits, e) {
    const rows = runsOf(visits, e.id), byStatus = {};
    for (const { r } of rows)
        byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    return { total: rows.length, byStatus, lastUsedAt: rows.map(x => x.r.createdAt).sort().at(-1) ?? null };
}
// Work begun under a capability that can no longer be used: unsent requests to cancel, calls in flight whose
// results will be withheld, results awaiting review that cannot be applied, and values applied to a visit
// that is still a draft. Confirmed visits keep their history and are corrected through the usual path.
export function requiredAction(v, r) {
    if (r.status === 'pending')
        return 'cancel';
    if (r.status === 'running')
        return 'await-outcome';
    if (r.status === 'review' && !r.reviewDecision)
        return 'review';
    if (r.status === 'applied' && v.state === 'draft' && !v.voidedAt && !v.supersededBy)
        return 'check-applied';
    return null;
}
export function capabilityImpact(visits, e) {
    const items = runsOf(visits, e.id).flatMap(({ v, r }) => { const action = requiredAction(v, r); return action ? [{ runId: r.id, visitId: v.id, personId: v.personId, status: r.status, action, requestedBy: r.actorId }] : []; });
    const counts = { cancel: 0, 'await-outcome': 0, review: 0, 'check-applied': 0 };
    for (const i of items)
        counts[i.action]++;
    return { items, counts };
}
export function affectedCapabilityEncounters(s, e, now = new Date().toISOString(), days = 30) {
    const since = Date.parse(now) - days * 86400000;
    return runsOf(s.workspace.visits, e.id).filter(({ r }) => ['pending', 'running', 'review', 'applied'].includes(r.status) && Date.parse(r.createdAt) >= since).map(({ v, r }) => ({ visit: v, run: r }));
}
export const impactSummary = (c) => { const parts = [c.cancel && `${c.cancel} unsent request${c.cancel === 1 ? '' : 's'} to cancel`, c['await-outcome'] && `${c['await-outcome']} in flight (results will be withheld)`, c.review && `${c.review} result${c.review === 1 ? '' : 's'} to review`, c['check-applied'] && `${c['check-applied']} applied to draft visits to check`].filter(Boolean); return parts.length ? parts.join(', ') : 'no in-progress work'; };
export function providerHistory(s, key) {
    const revs = entries(s).filter(e => e.spec.kind === 'capability' && e.spec.key === key).sort((a, b) => a.revision - b.revision);
    return revs.map((e, i) => {
        const spec = e.spec, prev = i ? revs[i - 1].spec : null;
        const activatedAt = e.history.find(h => h.state === 'active')?.at ?? null, endedAt = e.state === 'active' || !activatedAt ? null : e.history.filter(h => h.at >= activatedAt && ['suspended', 'retired'].includes(h.state)).at(-1)?.at ?? null;
        const changes = prev ? [prev.providerId !== spec.providerId && 'provider', prev.model !== spec.model && 'model', prev.agentVersion !== spec.agentVersion && 'agent-version'].filter(Boolean) : [];
        const usage = capabilityUsage(s.workspace.visits, e), evaluation = e.review?.evaluationId ? (s.governance?.evaluations ?? []).find(x => x.id === e.review.evaluationId) : undefined;
        return { entryId: e.id, revision: e.revision, capabilityManifestHash: e.manifestHash, providerId: spec.providerId, providerRelease: s.workspace.integrations.find(x => x.id === spec.providerId)?.version ?? (spec.providerId === 'local' ? 2 : null), model: spec.model, agentVersion: spec.agentVersion, prompt: PROMPT_RELEASE, tool: TOOL_RELEASE, data: DATA_RELEASE, evaluation: evaluation ? { id: evaluation.id, corpusVersion: evaluation.corpusVersion, corpusHash: evaluation.corpusHash, manifestHash: evaluation.manifestHash } : null, state: e.state, stage: lifecycleStage(s, e).stage, reviewedAt: e.review?.at ?? null, activatedAt, endedAt, changes, requests: usage.total, lastUsedAt: usage.lastUsedAt };
    });
}
export function capabilityHistories(s, keys) {
    const byKey = new Map();
    for (const e of entries(s).filter(e => e.spec.kind === 'capability').sort((a, b) => a.revision - b.revision))
        if (!keys || keys.has(e.spec.key))
            byKey.set(e.spec.key, e.spec.title);
    return [...byKey].map(([key, title]) => { const revisions = providerHistory(s, key); return { key, title, providers: new Set(revisions.map(r => r.providerId)).size, revisions }; });
}
