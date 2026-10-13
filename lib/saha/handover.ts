import type { AssignmentEvent } from './continuity';
export type HandoverContext = { organisationId: string; actorId: string;
  person: { id: string; name: string; village: string; version: number; teamId: string };
  handover: AssignmentEvent | null; work: { kind: string; id: string; ownerId: string | null; due: string | null }[] };
export type HandoverAttempt = { key: string; organisationId: string; actorId: string; personId: string;
  command: { type: 'acknowledgeAssignment'; personId: string; version: number; assignmentId: string; reference: string } };
export function acknowledgementAttempt(value: HandoverContext, reference: string, key: string): HandoverAttempt {
  const event = value.handover, text = reference.trim();
  if (!event || event.ownerId !== value.actorId || event.teamId !== value.person.teamId || event.acknowledgement)
    throw Error('Refresh and review the current unacknowledged handover.');
  if (!Number.isSafeInteger(value.person.version) || value.person.version < 1 || !event.id || !value.organisationId || !value.actorId || !value.person.id)
    throw Error('Current handover source is unavailable.');
  if (!text || text.length > 200 || !key || key.length > 200) throw Error('Enter a reference of 1 to 200 characters.');
  return { key, organisationId: value.organisationId, actorId: value.actorId, personId: value.person.id,
    command: { type: 'acknowledgeAssignment', personId: value.person.id, version: value.person.version, assignmentId: event.id, reference: text } };
}
export function acknowledgementMatches(attempt: HandoverAttempt, value: HandoverContext) {
  return value.organisationId === attempt.organisationId && value.actorId === attempt.actorId && value.person.id === attempt.personId && value.handover?.id === attempt.command.assignmentId && value.handover.acknowledgement?.by === attempt.actorId && value.handover.acknowledgement.reference === attempt.command.reference;
}
