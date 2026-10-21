export function acknowledgementAttempt(value, reference, key) {
    const event = value.handover, text = reference.trim();
    if (!event || event.ownerId !== value.actorId || event.teamId !== value.person.teamId || event.acknowledgement)
        throw Error('Refresh and review the current unacknowledged handover.');
    if (!Number.isSafeInteger(value.person.version) || value.person.version < 1 || !event.id || !value.organisationId || !value.actorId || !value.person.id)
        throw Error('Current handover source is unavailable.');
    if (!text || text.length > 200 || !key || key.length > 200)
        throw Error('Enter a reference of 1 to 200 characters.');
    return { key, organisationId: value.organisationId, actorId: value.actorId, personId: value.person.id,
        command: { type: 'acknowledgeAssignment', personId: value.person.id, version: value.person.version, assignmentId: event.id, reference: text } };
}
export function acknowledgementMatches(attempt, value) {
    return value.organisationId === attempt.organisationId && value.actorId === attempt.actorId && value.person.id === attempt.personId && value.handover?.id === attempt.command.assignmentId && value.handover.acknowledgement?.by === attempt.actorId && value.handover.acknowledgement.reference === attempt.command.reference;
}
