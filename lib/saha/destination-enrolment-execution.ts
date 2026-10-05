import {serviceDispatch} from './service-dispatch';
import { AppError, digest, fail, uuid } from './core';
import { enrolmentAudit, deliveryEvent, enrolmentRequestBody, requestTarget, applyEnrolmentReceipt, transition, type DestinationEnrolment } from './destination-enrolment';
import { ENROLMENT_EVENT_LIMIT, ENROLMENT_MAX_ATTEMPTS, enrolmentSimulatorRefusal, mockDestination, mockDestinationAny, mockEnrolmentTransport, type EnrolmentReceipt } from './destination-enrolment-adapter';
import { persist, readState, scope, type Actor } from './store';
import { person } from './core';
import type { D1Database } from '@cloudflare/workers-types';
import type { Enrolment } from './programmes';
import type { Integration, Member, OrgState, Person } from './types';

// Slice r37: the checkpoint/idempotency/receipt execution path for the destination-enrolment state machine, mirroring
// lib/saha/mis-execution.ts. The checkpoint is persisted before the mock adapter is called; the adapter's decision is
// then applied on a fresh read under the organisation's compare-and-swap guard, so a concurrent change never authorises
// a blind resend. `transport` is injectable (defaults to the mock adapter) so the contract test can model accepted,
// rejected and lost responses without any network.

type RequestBody = { contract: string; operation: 'request' | 'lookup'; key: string; payloadHash: string; [k: string]: unknown };
type Transport = (destination: Integration, body: RequestBody, key: string) => Promise<EnrolmentReceipt>;

function findEnrolment(s: OrgState, personId: string, enrolmentId: string): { p: Person; e: Enrolment } {
  const p = person(s.workspace, personId);
  const e = (p.enrolments ?? []).find(x => x.id === enrolmentId);
  if (!e) fail(404, 'Destination enrolment not found.');
  return { p, e };
}

function recheckDestination(s: OrgState, de: DestinationEnrolment, p: Person) {
  const destination = mockDestinationAny(s, de.destinationId);
  if (destination.version !== de.delivery?.connectorVersion) fail(409, 'The destination changed since the request. Partner reconciliation is required; do not resend.');
  if (p.version !== de.delivery?.personVersion) fail(409, 'The patient record changed since the request. Review before continuing.');
  return destination;
}

// The activate transition: accepted -> active. No transport; a clinician, supervisor or owner authorises the episode's
// official registration after the destination accepted it (the "programme-specific authorisation" BR-PROG-06 names).
async function activate(db: D1Database, s: OrgState, c: { personId: string; version: number; enrolmentId: string; enrolmentVersion: number; reason: string }, u: Actor, m: Member, key: string, hash: string) {
  const { p, e } = findEnrolment(s, c.personId, c.enrolmentId);
  if (!['clinician', 'supervisor'].includes(m.role) && !m.isOwner) fail(403, 'A clinician, supervisor or organisation owner must activate a destination-accepted enrolment.');
  const de = e.destinationEnrolment;
  if (!de || de.state !== 'accepted') fail(409, 'Activation requires an enrolment the destination has accepted.');
  if (de.version !== c.enrolmentVersion) fail(409, 'The destination enrolment changed. Refresh and review it again.');
  recheckDestination(s, de, p);
  const before = structuredClone(s);
  transition(de, 'active', u.userId, c.reason);
  de.activeAt = new Date().toISOString();
  de.activeBy = u.userId;
  e.registration = 'submitted';
  deliveryEvent(de, `Enrolment activated by ${u.displayName}. Official registration submitted at ${de.destinationName}.`);
  enrolmentAudit(s, u, m, 'activateDestinationEnrolment', e.id, `Destination enrolment for ${e.episodeLabel} (${e.packId}) activated at ${de.destinationName} with reference ${de.destinationReceipt ?? 'none'}. Official registration submitted. Reason: ${c.reason}`, c.personId);
  await persist(db, before, s, u, { type: 'activateDestinationEnrolment' }, key, hash, { enrolmentId: e.id, state: 'active', registration: 'submitted', destinationReceipt: de.destinationReceipt });
  return { enrolmentId: e.id, state: 'active', registration: 'submitted', destinationReceipt: de.destinationReceipt };
}

export async function executeDestinationEnrolment(db: D1Database, s: OrgState, c: any, u: Actor, m: Member, key: string, hash: string, environment: string, transport: Transport = mockEnrolmentTransport): Promise<any> {
  let serviceRefusal='';const deliver=transport;transport=async(i,...args)=>{try{await serviceDispatch(db,s,u,m,i.id,c.personId??null);}catch(e){serviceRefusal=e instanceof Error?e.message:'Service authority unavailable.';throw e;}return deliver(i,...args);};
  if (c.type === 'activateDestinationEnrolment') return activate(db, s, c, u, m, key, hash);

  const lookup = c.type === 'lookupDestinationEnrolment';
  if (!lookup && c.type !== 'requestDestinationEnrolment') fail(422, 'Unsupported destination enrolment operation.');
  const refusal = enrolmentSimulatorRefusal(environment);
  if (refusal) fail(409, refusal);

  const { p, e } = findEnrolment(s, c.personId, c.enrolmentId);
  let de = e.destinationEnrolment;
  let destination: Integration;

  if (!lookup) {
    // request path: validate, build the request body and record the checkpoint before calling the mock adapter.
    const target = requestTarget(s, c, u, m);
    destination = target.destination;
    if (de && de.attempts >= ENROLMENT_MAX_ATTEMPTS) fail(409, 'Attempt limit reached. Contact the destination; no further request is permitted.');
    const body = enrolmentRequestBody(c.personId, e, target.programme);
    const payloadHash = await digest(body);
    const now = new Date().toISOString();
    if (!de) {
      de = { version: 0, state: 'requested', destinationId: destination.id, destinationName: destination.name, payloadHash, attempts: 0, history: [] };
      e.destinationEnrolment = de;
    } else {
      de.payloadHash = payloadHash;
      de.destinationId = destination.id;
      de.destinationName = destination.name;
      de.destinationReceipt = undefined;
      de.rejectionReason = undefined;
      de.acceptedAt = undefined;
      de.rejectedAt = undefined;
      transition(de, 'requested', u.userId, 'Re-requested destination enrolment.');
    }
    de.requestedAt = now;
    de.requestedBy = u.userId;
    de.attempts++;
    const operationId = uuid();
    de.delivery = { key: e.id, actorId: u.userId, connectorVersion: destination.version, personVersion: p.version, expiresAt: new Date(Date.now() + 15 * 60000).toISOString(), operationId, startedAt: now, events: [] };
    deliveryEvent(de, 'Destination enrolment checkpoint saved before the request.');
    enrolmentAudit(s, u, m, 'requestDestinationEnrolment', e.id, `Destination enrolment requested at ${de.destinationName} for ${e.episodeLabel} (${e.packId}, programme ${target.programme}). Requested by ${u.displayName}; nothing is sent to a real partner (mock adapter).`, c.personId);
    const before = structuredClone(s);
    await persist(db, before, s, u, c, key, hash, { enrolmentId: e.id, state: 'requested' });
    const body2: RequestBody = { ...body, key: e.id, payloadHash };
    let raw: unknown;
    try { raw = await transport(destination, body2, e.id); } catch { raw = undefined; }
    return finish(db, s, c, u, m, key, hash, e.id, operationId, raw, c.personId, false);
  }

  // lookup path: resolve an unresolved (uncertain) request. The same worker looks it up; nothing is resent.
  de = e.destinationEnrolment;
  if (!de || de.state !== 'uncertain') fail(409, 'Only an unresolved destination enrolment request needs a receipt lookup.');
  if (de.delivery?.actorId !== u.userId) fail(409, 'The original requesting worker must look up this request.');
  if (de.delivery && de.delivery.events.length >= ENROLMENT_EVENT_LIMIT) fail(409, 'Destination enrolment event limit reached. Investigate with the destination.');
  destination = recheckDestination(s, de, p);
  const operationId = uuid();
  de.delivery = { ...de.delivery!, operationId, startedAt: new Date().toISOString() };
  const before = structuredClone(s);
  deliveryEvent(de, 'Destination enrolment lookup reserved; no request is resent.');
  enrolmentAudit(s, u, m, 'lookupDestinationEnrolment', e.id, `Destination enrolment receipt lookup for ${e.episodeLabel} at ${de.destinationName}.`, c.personId);
  await persist(db, before, s, u, c, key, hash, { enrolmentId: e.id, state: de.state });
  let raw: unknown;
  try { raw = await transport(destination, { contract: 'saha-destination-enrolment-v1', operation: 'lookup', key: de.delivery.key, payloadHash: de.payloadHash }, 'lookup_' + operationId); } catch { raw = undefined; }
  return finish(db, s, c, u, m, key, hash, e.id, operationId, raw, c.personId, true);
}

// Applies the adapter's decision on a fresh read, retrying the final write under the CAS guard. Mirrors mis-execution.
async function finish(db: D1Database, s: OrgState, c: any, u: Actor, m: Member, key: string, hash: string, enrolmentId: string, operationId: string, raw: unknown, personId: string, lookup: boolean) {
  for (let n = 0; n < 3; n++) {
    const after = await readState(db, s.organisation.id);
    const member = scope(after, u.userId);
    const p = person(after.workspace, personId);
    const e = (p.enrolments ?? []).find(x => x.id === enrolmentId);
    if (!e?.destinationEnrolment) fail(409, 'Destination enrolment checkpoint is unavailable.');
    const de = e.destinationEnrolment;
    // A later or terminal state already committed: report it without resending.
    if (de.delivery?.operationId !== operationId) return { enrolmentId, state: de.state, destinationReceipt: de.destinationReceipt, rejectionReason: de.rejectionReason };
    if (['accepted', 'rejected', 'active', 'retryable'].includes(de.state)) return { enrolmentId, state: de.state, destinationReceipt: de.destinationReceipt, rejectionReason: de.rejectionReason };
    const old = structuredClone(after);
    if (raw === undefined) {
      transition(de, 'uncertain', u.userId, 'No matching definitive receipt was received. Look up this key before any resend.');
      deliveryEvent(de, 'No matching definitive receipt was received. Look up this key before any resend.');
    } else {
      applyEnrolmentReceipt(de, raw, u.userId, lookup);
    }
    enrolmentAudit(after, u, member, lookup ? 'lookupDestinationEnrolmentResult' : 'requestDestinationEnrolmentResult', e.id,
      de.state === 'rejected' ? `Destination rejected this enrolment: ${de.rejectionReason}. The local episode stays visible and is not enrolled.` : `Destination enrolment ${de.state} (reference ${de.destinationReceipt ?? 'none'}).`,
      personId);
    const result = { enrolmentId, state: de.state, destinationReceipt: de.destinationReceipt, rejectionReason: de.rejectionReason };
    try {
      await persist(db, old, after, u, { type: lookup ? 'lookupDestinationEnrolment' : 'requestDestinationEnrolment' }, lookup ? 'lookup_' + operationId : key, hash, result);
      return result;
    } catch (e2) {
      if (!(e2 instanceof AppError && e2.status === 409) || n === 2) throw e2;
    }
  }
  fail(409, 'Receipt storage remains unresolved. Refresh and look up the destination enrolment; do not resend.');
}
