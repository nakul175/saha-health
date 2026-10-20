import { digest, fail } from './core.js';
import { z } from 'zod';
// Slice r37: destination enrolment request/rejection/acceptance is driven by a demonstration/mock adapter only.
//
// BR-PROG-06 requires that official enrolment needs the destination's acceptance, and that a rejection leaves the person
// locally visible with a clear reason and no false enrolled status. The destination here is a demonstration programme
// connection (a `mis` integration in `demo` mode, as seeded in lib/saha/seed.ts). No network code exists in this module:
// the "request" and "lookup" are pure, deterministic functions of the destination's `behavior`, and what the destination
// "returns" is stored and shown inside Saha with a simulated reference. Nothing is sent to a real partner.
//
// The environment gate mirrors slice 10b (notification-channel) and slice 6n (`demoConnectors`): the simulator runs only
// in the synthetic and training environments and is refused everywhere else, so a production or staging deployment can
// never exercise this mock path.
export const ENROLMENT_RULES_VERSION = '1.0.0';
export const ENROLMENT_CONTRACT = 'saha-destination-enrolment-v1';
export const ENROLMENT_PROVIDER = 'saha-destination-enrolment-simulator';
export const SIMULATOR_ENVIRONMENTS = ['synthetic', 'training'];
export const ENROLMENT_MAX_ATTEMPTS = 3;
export const ENROLMENT_EVENT_LIMIT = 50;
export const ENROLMENT_HISTORY_LIMIT = 20;
export const ENROLMENT_STATES = ['requested', 'uncertain', 'retryable', 'accepted', 'rejected', 'active'];
export function enrolmentSimulatorRefusal(environment) {
    return SIMULATOR_ENVIRONMENTS.includes(environment)
        ? null
        : `The destination-enrolment simulator runs only in the synthetic and training environments; this deployment is ${environment}. Nothing is sent to a real destination.`;
}
// The mock destination: an active demonstration programme connection covering this episode's programme.
// An HTTP destination is never contacted by this slice, and a non-demo or inactive connection is refused.
export function mockDestination(s, destinationId, programme) {
    const i = s.workspace.integrations.find(x => x.id === destinationId);
    if (!i || i.kind !== 'mis' || i.mode !== 'demo' || i.status !== 'active')
        fail(422, 'Choose an active demonstration programme destination. Destination enrolment is driven by the mock adapter only; no real partner is contacted.');
    if (!i.programmes.includes(programme))
        fail(422, `${i.name} does not cover ${programme}. Choose a destination whose programme list includes this episode.`);
    return i;
}
// Re-check on lookup and activation: the destination is still the active demonstration connection it was.
export function mockDestinationAny(s, destinationId) {
    const i = s.workspace.integrations.find(x => x.id === destinationId);
    if (!i || i.kind !== 'mis' || i.mode !== 'demo' || i.status !== 'active')
        fail(422, 'The demonstration programme destination is no longer active. Nothing was sent to a real partner.');
    return i;
}
// A small synchronous hash for the simulated destination reference only. It protects nothing.
export function label(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
}
// The destination's decision, deterministic and pure. `behavior` decides the outcome:
//   'accept'    -> accepted, with a simulated enrolment reference
//   'reject'    -> rejected, with a clear reason (the local episode stays visible, not enrolled)
//   'uncertain' -> the first request "loses" the response (throws); a lookup then finds the record
//                  (accepted), modelling safe reconciliation rather than a blind resend.
// There is no clock, no randomness and no network; only the supplied key and payloadHash are read.
export function mockEnrolment(destination, body) {
    if (destination.behavior === 'reject') {
        return { contract: ENROLMENT_CONTRACT, key: body.key, payloadHash: body.payloadHash, status: 'rejected', reason: 'The destination declined this enrolment: the episode does not meet the destination\'s acceptance rules (demonstration simulator).' };
    }
    if (destination.behavior === 'uncertain' && body.operation === 'request') {
        throw new Error('Mock destination lost the response (simulated). Look up the request; do not resend blindly.');
    }
    return { contract: ENROLMENT_CONTRACT, key: body.key, payloadHash: body.payloadHash, status: 'accepted', enrolmentRef: `SIM-ENROL-${label(body.key).toUpperCase()}` };
}
export async function assertEnrolmentEnvelope(body, key) {
    const id = z.string().min(1).max(200), common = { contract: z.literal(ENROLMENT_CONTRACT), key: id, payloadHash: z.string().regex(/^[a-f0-9]{64}$/) };
    const schema = z.discriminatedUnion('operation', [z.object({ ...common, operation: z.literal('lookup') }).strict(), z.object({ ...common, operation: z.literal('request'), personId: id, packId: id, packVersion: z.number().int().positive(), programme: id, episodeLabel: z.string().min(1).max(500), startDate: z.string().regex(/^\d{4}-\d\d-\d\d$/).nullable() }).strict()]);
    const parsed = schema.safeParse(body);
    if (!parsed.success)
        fail(409, 'Enrolment envelope differs from its approved contract; review before sending.');
    if (parsed.data.operation === 'lookup')
        return;
    const { key: bodyKey, payloadHash, ...payload } = body;
    if (bodyKey !== key || await digest(payload) !== payloadHash)
        fail(409, 'Enrolment envelope differs from its approved key or digest; nothing was sent.');
}
// The transport the execution module defaults to. It never performs network I/O: it applies the mock
// decision to the request body and returns a Promise, throwing on a simulated lost response.
export async function mockEnrolmentTransport(destination, body) {
    await assertEnrolmentEnvelope(body, body.key);
    return mockEnrolment(destination, body);
}
