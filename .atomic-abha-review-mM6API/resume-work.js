const reference = (value) => typeof value === 'string' && /^[A-Za-z0-9_:.-]{1,120}$/.test(value);
export function routineSelection(query) {
    const keys = ['personId', 'organisationId', 'visitId', 'actorId'];
    if ([...query.keys()].some(k => !keys.includes(k)) || query.getAll('personId').length !== 1 || query.getAll('organisationId').length !== 1 || query.getAll('visitId').length > 1 || query.getAll('actorId').length > 1)
        return null;
    const personId = query.get('personId'), organisationId = query.get('organisationId');
    if (!reference(personId) || !reference(organisationId))
        return null;
    const pinned = query.has('visitId') || query.has('actorId'), visitId = query.get('visitId'), actorId = query.get('actorId');
    if (pinned && (!reference(visitId) || !actorId?.trim() || actorId.length > 200))
        return null;
    return { personId, organisationId, ...(pinned ? { visitId: visitId, actorId: actorId } : {}) };
}
export function currentServerDraft(value, personId, organisationId, actorId, expectedVisitId) {
    if (!actorId?.trim() || actorId.length > 200 || value.organisationId !== organisationId || value.person?.id !== personId)
        throw Error('The selected account or record could not be matched.');
    if (value.visit === null) {
        if (expectedVisitId)
            throw Error('The selected server draft is no longer available.');
        return null;
    }
    if (!value.visit || typeof value.visit !== 'object')
        throw Error('Saved server draft source is unavailable.');
    const visit = value.visit;
    if (!reference(visit.id) || visit.personId !== personId || (expectedVisitId && visit.id !== expectedVisitId) || visit.state !== 'draft' || visit.voidedAt || visit.supersededBy || !Number.isSafeInteger(visit.version) || visit.version < 1)
        throw Error('The selected server draft changed or is unavailable. Return to Resume work and review again.');
    const query = new URLSearchParams({ personId, organisationId, visitId: visit.id, actorId });
    return { id: visit.id, version: visit.version, createdAt: visit.createdAt, href: '/routine-visit?' + query };
}
