import { z } from 'zod';
import { fail, person, uuid } from './core';
import { packAt, type Enrolment } from './programmes';
import { ENROLMENT_CONTRACT, ENROLMENT_EVENT_LIMIT, ENROLMENT_HISTORY_LIMIT, ENROLMENT_STATES, mockDestination, type EnrolmentState } from './destination-enrolment-adapter';
import type { Member, OrgState, Person } from './types';
import type { Actor } from './store';

// Slice r37: the versioned, audited state machine for a destination enrolment (BR-PROG-06).
//
// A local programme episode (Enrolment) starts with `registration: 'not_submitted'` and no `destinationEnrolment`
// (the "local" state). This module adds the lifecycle that takes it through:
//   local -> requested -> accepted | rejected | uncertain | retryable -> active
// where only a verified destination acceptance can reach `active` (official registration submitted), and a rejection
// leaves the episode locally visible with a clear reason and no false enrolled status.
//
// Each transition increments `version` and appends a history entry, and the execution module (destination-enrolment-execution.ts)
// writes an audit event and reuses the checkpoint/idempotency/receipt pattern. No transport lives here; the mock adapter
// supplies the destination's decision.

export type DestinationEnrolmentState = EnrolmentState;
export type EnrolmentDelivery = {
  key: string;           // stable idempotency key for this enrolment's destination request
  actorId: string;       // the worker who requested enrolment (rechecked on lookup)
  connectorVersion: number;
  personVersion: number;
  expiresAt: string;
  operationId?: string;
  startedAt?: string;
  events: { at: string; state: string; detail: string; attempt?: number }[];
};
export type DestinationEnrolment = {
  version: number;
  state: DestinationEnrolmentState;
  destinationId: string;
  destinationName: string;
  payloadHash: string;
  attempts: number;
  delivery?: EnrolmentDelivery;
  destinationReceipt?: string; // the destination's official enrolment/registration reference
  rejectionReason?: string;    // the destination's clear reason, shown locally
  requestedAt?: string;
  requestedBy?: string;
  acceptedAt?: string;
  rejectedAt?: string;
  activeAt?: string;
  activeBy?: string;
  history: { at: string; from: DestinationEnrolmentState; to: DestinationEnrolmentState; by: string; reason: string }[];
};

const id = z.string().min(1).max(200);
const ver = z.number().int().positive();
export const destinationEnrolmentSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('requestDestinationEnrolment'), personId: id, version: ver, enrolmentId: id, destinationId: id, enrolmentVersion: z.number().int().min(0) }).strict(),
  z.object({ type: z.literal('lookupDestinationEnrolment'), personId: id, version: ver, enrolmentId: id }).strict(),
  z.object({ type: z.literal('activateDestinationEnrolment'), personId: id, version: ver, enrolmentId: id, enrolmentVersion: ver, reason: z.string().trim().min(5, 'Explain the activation in at least 5 characters.').max(500) }).strict(),
]);
export type DestinationEnrolmentCommand = z.infer<typeof destinationEnrolmentSchema>;

export function enrolmentAudit(s: OrgState, u: Actor, m: Member, action: string, subject: string, detail: string, personId?: string) {
  s.workspace.audit.push({ id: uuid(), at: new Date().toISOString(), actor: u.displayName, actorId: u.userId, role: m.role, action, subject, detail, personId });
}

// Replay and first-run authorisation (the detailed state checks run in the execution module).
export function authorizeDestinationEnrolment(m: Member, c: { type: string }) {
  if (c.type === 'activateDestinationEnrolment') {
    if (!['clinician', 'supervisor'].includes(m.role) && !m.isOwner) fail(403, 'A clinician, supervisor or organisation owner must activate a destination-accepted enrolment.');
  } else if (c.type === 'requestDestinationEnrolment' || c.type === 'lookupDestinationEnrolment') {
    if (!['asha', 'clinician'].includes(m.role)) fail(403, 'A care role is required for destination enrolment changes.');
  }
}

export function deliveryEvent(d: DestinationEnrolment, detail: string) {
  const at = new Date().toISOString();
  d.delivery!.events.push({ at, state: d.state, detail });
}

export function transition(d: DestinationEnrolment, next: DestinationEnrolmentState, by: string, reason: string, now = new Date().toISOString()) {
  d.history.push({ at: now, from: d.state, to: next, by, reason });
  d.state = next;
  d.version++;
  d.history = d.history.slice(-ENROLMENT_HISTORY_LIMIT);
}

// The programme this episode belongs to, resolved from its pinned pack version.
export function enrolmentProgramme(s: OrgState, e: Enrolment): string {
  return packAt(e.packId, e.packVersion, s)?.programme ?? e.packId;
}

// Resolves the person and their active episode named by a command, under a care role.
export function enrolmentFor(s: OrgState, personId: string, version: number, enrolmentId: string, u: Actor, m: Member): { person: Person; enrolment: Enrolment } {
  if (!['asha', 'clinician'].includes(m.role)) fail(403, 'A care role is required for destination enrolment changes.');
  const p = person(s.workspace, personId);
  if (p.version !== version) fail(409, 'The patient changed. Refresh before editing destination enrolment.');
  const e = (p.enrolments ?? []).find(x => x.id === enrolmentId);
  if (!e || e.state !== 'active') fail(409, 'Choose an active episode to request destination enrolment.');
  return { person: p, enrolment: e };
}

// Validates a request and returns the destination plus the request body hash input. Does not mutate.
export function requestTarget(s: OrgState, c: Extract<DestinationEnrolmentCommand, { type: 'requestDestinationEnrolment' }>, u: Actor, m: Member) {
  const { person: p, enrolment: e } = enrolmentFor(s, c.personId, c.version, c.enrolmentId, u, m);
  const programme = enrolmentProgramme(s, e);
  const destination = mockDestination(s, c.destinationId, programme);
  const de = e.destinationEnrolment;
  if (de) {
    if (de.destinationId !== destination.id) fail(409, 'This episode already has a destination enrolment request to a different destination.');
    if (!['rejected', 'retryable'].includes(de.state)) fail(409, de.state === 'active' ? 'This episode is already actively enrolled at its destination.' : 'This episode already has an unresolved destination enrolment request. Look up its receipt first.');
    if (de.version !== c.enrolmentVersion) fail(409, 'The destination enrolment changed. Refresh and review it again.');
    if (de.delivery && de.delivery.events.length >= ENROLMENT_EVENT_LIMIT) fail(409, 'Destination enrolment event limit reached. Investigate with the destination.');
  } else if (c.enrolmentVersion !== 0) {
    fail(409, 'The destination enrolment changed. Refresh and review it again.');
  }
  return { p, e, destination, de, programme };
}

// The request body bound by the receipt's payload hash. No patient name is included.
export function enrolmentRequestBody(personId: string, e: Enrolment, programme: string): { contract: string; operation: 'request'; personId: string; packId: string; packVersion: number; programme: string; episodeLabel: string; startDate: string | null } {
  return { contract: ENROLMENT_CONTRACT, operation: 'request', personId, packId: e.packId, packVersion: e.packVersion, programme, episodeLabel: e.episodeLabel, startDate: e.startDate ?? null };
}

export const enrolmentReceiptSchema = z.object({
  contract: z.literal(ENROLMENT_CONTRACT),
  key: id,
  payloadHash: z.string().regex(/^[a-f0-9]{64}$/),
  status: z.enum(['accepted', 'rejected', 'not_found']),
  enrolmentRef: z.string().min(1).max(200).optional(),
  reason: z.string().min(1).max(500).optional(),
}).strict();

// Applies the destination's decision. Mirrors lib/saha/mis.ts `applyReceipt`: a receipt describes what already happened
// outside Saha, is bound to this request's key and payload hash, and never authorises a blind retry.
export function applyEnrolmentReceipt(d: DestinationEnrolment, raw: unknown, by: string, lookup = false, now = new Date().toISOString()) {
  const parsed = enrolmentReceiptSchema.safeParse(raw);
  if (!parsed.success) fail(502, 'Destination response did not match the enrolment receipt contract.');
  const r = parsed.data;
  if (r.key !== d.delivery?.key || r.payloadHash !== d.payloadHash) fail(502, 'Destination enrolment receipt did not match this request.');
  if (r.status === 'accepted' && !r.enrolmentRef) fail(502, 'Accepted responses require a destination enrolment reference.');
  if (r.status === 'rejected' && !r.reason) fail(502, 'Rejected responses require a clear reason.');
  if (r.status === 'not_found' && !lookup) fail(502, 'Only a receipt lookup can confirm that a request was not found.');
  if (d.state === 'active') fail(409, 'This episode is already actively enrolled at its destination.');
  if (['accepted', 'rejected'].includes(d.state)) {
    if (d.state !== r.status || (r.status === 'accepted' && d.destinationReceipt !== r.enrolmentRef)) fail(409, 'A conflicting terminal receipt requires partner investigation.');
    return;
  }
  const next: DestinationEnrolmentState = r.status === 'accepted' ? 'accepted' : r.status === 'rejected' ? 'rejected' : 'retryable';
  transition(d, next, by, r.status === 'accepted' ? 'Destination accepted the enrolment request.' : r.status === 'rejected' ? 'Destination rejected the enrolment request.' : 'Destination confirmed no record for this key; a retry reuses the same request and key.', now);
  if (r.status === 'accepted') { d.destinationReceipt = r.enrolmentRef; d.acceptedAt = now; }
  else if (r.status === 'rejected') { d.rejectionReason = r.reason; d.rejectedAt = now; }
  const detail = r.status === 'accepted'
    ? `Destination ${d.destinationName} accepted this enrolment request (reference ${d.destinationReceipt}). The episode is not active until a clinician or supervisor activates it.`
    : r.status === 'rejected'
      ? `Destination ${d.destinationName} rejected this enrolment request: ${d.rejectionReason}. The local episode stays visible and is not enrolled.`
      : `Destination ${d.destinationName} confirmed no record for this key. A retry reuses the same request and key.`;
  deliveryEvent(d, detail);
}

export { ENROLMENT_STATES };
