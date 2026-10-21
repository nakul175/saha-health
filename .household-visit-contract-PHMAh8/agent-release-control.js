import { digest, fail, uuid } from './core.js';
const HASH = /^[0-9a-f]{64}$/;
const activeMember = (members, id) => members.find(m => m.userId === id && m.status === 'active');
const manager = (m) => m.status === 'active' && (m.isOwner || m.role === 'admin');
const reviewer = (m) => m.status === 'active' && ['admin', 'clinician'].includes(m.role);
const validAsset = (a) => !!a.id.trim() && !!a.version.trim() && HASH.test(a.sha256);
const canonical = (manifest) => structuredClone({
    ...manifest,
    tools: [...manifest.tools].sort((a, b) => `${a.id}@${a.version}`.localeCompare(`${b.id}@${b.version}`)),
    knowledgeSources: [...manifest.knowledgeSources].sort((a, b) => `${a.id}@${a.version}`.localeCompare(`${b.id}@${b.version}`)),
    rollbackCompatibleWith: [...new Set(manifest.rollbackCompatibleWith)].sort()
});
const checkedManifest = (raw) => {
    const m = canonical(raw), assets = [m.prompt, m.routing, ...m.tools, ...m.knowledgeSources];
    if (!m.capabilityKey.trim() || !m.model.providerId.trim() || !m.model.releaseId.trim() || !m.releaseSuite.id.trim() || !m.releaseSuite.version.trim() || !HASH.test(m.releaseSuite.sha256) || !assets.every(validAsset))
        fail(422, 'Every material agent component must have an immutable version and SHA-256 digest.');
    if (!m.tools.length || !m.knowledgeSources.length || m.changeSummary.trim().length < 10)
        fail(422, 'Tools, knowledge sources and a meaningful change summary are required.');
    return m;
};
const release = (s, id) => { const r = s.releases.find(x => x.id === id); if (!r)
    fail(404, 'Agent release not found.'); return r; };
const currentAuthority = (members, r) => {
    const author = activeMember(members, r.createdBy), review = r.review, reviewerMember = review ? activeMember(members, review.by) : undefined;
    if (!author || author.version !== (review?.authorVersion ?? author.version))
        fail(409, 'Release author authority changed; repeat independent review.');
    if (review && (!reviewerMember || reviewerMember.version !== review.memberVersion || !reviewer(reviewerMember)))
        fail(409, 'Release reviewer authority changed; repeat independent review.');
};
export async function proposeAgentRelease(s, members, actor, raw, regression, at = new Date().toISOString()) {
    if (!manager(actor) || !activeMember(members, actor.userId))
        fail(403, 'A current owner or administrator must propose an agent release.');
    const manifest = checkedManifest(raw);
    if (regression.suiteId !== manifest.releaseSuite.id || regression.suiteVersion !== manifest.releaseSuite.version || regression.suiteSha256 !== manifest.releaseSuite.sha256 || !HASH.test(regression.resultSha256) || regression.total < 1 || regression.failed !== 0 || regression.regressions !== 0)
        fail(409, 'The exact pinned release suite must pass with no failures or regressions.');
    const manifestHash = await digest(manifest), prior = s.releases.filter(x => x.manifest.capabilityKey === manifest.capabilityKey).sort((a, b) => b.revision - a.revision)[0];
    if (prior && regression.baselineReleaseId !== prior.id)
        fail(409, 'Regression comparison must use the latest release revision as its baseline.');
    if (prior && (!regression.baselineResultSha256 || !HASH.test(regression.baselineResultSha256)))
        fail(409, 'A versioned baseline result is required for regression comparison.');
    const r = { id: uuid(), revision: (prior?.revision ?? 0) + 1, version: 1, manifest, manifestHash, createdBy: actor.userId, createdAt: at, regression: structuredClone(regression), state: 'proposed', history: [{ at, by: actor.userId, action: 'proposed', reason: manifest.changeSummary }] };
    s.releases.push(r);
    return structuredClone(r);
}
export function reviewAgentRelease(s, members, actor, id, expectedVersion, reference, at = new Date().toISOString()) {
    const r = release(s, id);
    if (!reviewer(actor) || !activeMember(members, actor.userId))
        fail(403, 'A current clinician or administrator must review the release.');
    if (actor.userId === r.createdBy)
        fail(403, 'The release author cannot perform its independent review.');
    if (r.version !== expectedVersion || r.state !== 'proposed')
        fail(409, 'Reload the current proposed release.');
    const author = activeMember(members, r.createdBy);
    if (!author)
        fail(409, 'Release author authority changed; repeat preparation.');
    if (reference.trim().length < 3)
        fail(422, 'A review reference is required.');
    r.review = { by: actor.userId, memberVersion: actor.version, authorVersion: author.version, at, reference: reference.trim(), manifestHash: r.manifestHash, resultSha256: r.regression.resultSha256 };
    r.state = 'reviewed';
    r.version++;
    r.history.push({ at, by: actor.userId, action: 'reviewed', reason: reference.trim() });
    return structuredClone(r);
}
export function activateAgentRelease(s, members, actor, id, expectedVersion, reason, at = new Date().toISOString()) {
    if (!manager(actor) || !activeMember(members, actor.userId))
        fail(403, 'A current owner or administrator must activate an agent release.');
    const r = release(s, id);
    if (r.version !== expectedVersion || r.state !== 'reviewed' || !r.review)
        fail(409, 'Only the current independently reviewed release can activate.');
    currentAuthority(members, r);
    if (r.review.manifestHash !== r.manifestHash || r.review.resultSha256 !== r.regression.resultSha256 || r.regression.failed || r.regression.regressions)
        fail(409, 'Review or regression evidence no longer matches this release.');
    const oldId = s.activeByCapability[r.manifest.capabilityKey], old = oldId ? release(s, oldId) : undefined;
    if (old && old.id !== r.id) {
        old.state = 'retired';
        old.version++;
        old.history.push({ at, by: actor.userId, action: 'retired', reason: `Replaced by ${r.id}` });
    }
    r.state = 'active';
    r.version++;
    r.history.push({ at, by: actor.userId, action: 'activated', reason });
    s.activeByCapability[r.manifest.capabilityKey] = r.id;
    return bindingFor(r);
}
export function rollbackAgentRelease(s, members, actor, capabilityKey, targetId, reason, at = new Date().toISOString()) {
    if (!manager(actor) || !activeMember(members, actor.userId))
        fail(403, 'A current owner or administrator must restore an approved release.');
    const activeId = s.activeByCapability[capabilityKey], active = activeId ? release(s, activeId) : undefined, target = release(s, targetId);
    if (!active || active.id === target.id || target.manifest.capabilityKey !== capabilityKey)
        fail(409, 'Choose a different historical release for this capability.');
    if (!target.review || !target.history.some(h => h.action === 'activated'))
        fail(409, 'Only a previously reviewed and activated release can be restored.');
    currentAuthority(members, target);
    if (!active.manifest.rollbackCompatibleWith.includes(target.id))
        fail(409, 'The active release does not declare compatibility with this rollback target.');
    active.state = 'retired';
    active.version++;
    active.history.push({ at, by: actor.userId, action: 'rolled-back', reason });
    target.state = 'active';
    target.version++;
    target.history.push({ at, by: actor.userId, action: 'restored', reason });
    s.activeByCapability[capabilityKey] = target.id;
    return bindingFor(target);
}
export function bindingFor(r) { return { releaseId: r.id, revision: r.revision, manifestHash: r.manifestHash, prompt: `${r.manifest.prompt.id}@${r.manifest.prompt.version}`, tools: r.manifest.tools.map(x => `${x.id}@${x.version}`), routing: `${r.manifest.routing.id}@${r.manifest.routing.version}`, model: `${r.manifest.model.providerId}@${r.manifest.model.releaseId}`, knowledgeSources: r.manifest.knowledgeSources.map(x => `${x.id}@${x.version}`), suite: `${r.manifest.releaseSuite.id}@${r.manifest.releaseSuite.version}` }; }
export function activeAgentRelease(s, members, capabilityKey) { const id = s.activeByCapability[capabilityKey]; if (!id)
    fail(409, 'No reviewed agent release is active.'); const r = release(s, id); if (r.state !== 'active')
    fail(409, 'The selected agent release is no longer active.'); currentAuthority(members, r); return { release: structuredClone(r), binding: bindingFor(r) }; }
export const emptyAgentReleaseControl = () => ({ releases: [], activeByCapability: {} });
