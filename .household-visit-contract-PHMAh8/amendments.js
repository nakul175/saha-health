const reference = (v) => typeof v === 'string' && /^[A-Za-z0-9_:.-]{1,120}$/.test(v);
export function amendmentAttempt(value, visitId, reason, key) {
    const visit = value.visits.find(v => v.id === visitId), text = reason.trim();
    if (!reference(value.organisationId) || !reference(value.person.id) || !value.actorId?.trim() || value.actorId.length > 200 ||
        !visit || !reference(visit.id) || visit.personId !== value.person.id || visit.state !== 'confirmed' || visit.voidedAt || visit.supersededBy || visit.imported ||
        !Number.isSafeInteger(visit.recordVersion) || visit.recordVersion < 1)
        throw Error('Review a current confirmed local record before creating a correction draft.');
    if (text.length < 5 || text.length > 1000 || typeof key !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(key))
        throw Error('Enter a correction reason of 5 to 1000 characters.');
    return { key, organisationId: value.organisationId, actorId: value.actorId, personId: value.person.id,
        command: { type: 'amendVisit', visitId: visit.id, version: visit.recordVersion, reason: text } };
}
export function amendmentMatches(attempt, value, correctionVisitId) {
    if (value.organisationId !== attempt.organisationId || value.actorId !== attempt.actorId || value.person.id !== attempt.personId || !reference(correctionVisitId))
        return false;
    const source = value.visits.find(v => v.id === attempt.command.visitId), draft = value.visits.find(v => v.id === correctionVisitId);
    return !!source && !!draft && source.personId === attempt.personId && source.supersededBy === draft.id && draft.personId === attempt.personId &&
        draft.amendsVisitId === source.id && draft.state === 'draft' && !draft.voidedAt && !draft.supersededBy;
}
