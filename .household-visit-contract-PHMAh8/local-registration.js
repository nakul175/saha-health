import { z } from 'zod';
import { matchInput } from './continuity.js';
import { commandSchema } from './core.js';
const ref = z.string().min(1).max(200), actor = z.string().min(1), version = z.number().int().positive();
export const localRegistrationInput = matchInput.extend({ programme: z.literal('General care') }).strict();
export const localRegistrationOperation = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('search'), memberVersion: version, input: localRegistrationInput }).strict(),
    z.object({ kind: z.literal('create'), memberVersion: version, input: localRegistrationInput, reviewHash: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
]);
const candidate = z.object({ id: ref, name: z.string().min(1), age: z.number().int().min(0).max(120), sex: z.enum(['Female', 'Male', 'Other', 'Unknown']), village: z.string().min(1), version, match: z.string().min(1) }).strict();
export const localRegistrationContext = z.object({ actorId: actor, organisationId: ref, memberVersion: version, teams: z.array(z.object({ id: ref, name: z.string().min(1) }).strict()).min(1), refreshAt: z.string().datetime().nullable() }).strict();
export const localRegistrationSearch = z.object({ context: localRegistrationContext, hash: z.string().regex(/^[a-f0-9]{64}$/), candidates: z.array(candidate).max(20), overflow: z.boolean(), scope: z.string().min(1) }).strict();
export const localRegistrationSaved = z.object({ context: localRegistrationContext, person: z.object({ id: z.string().uuid(), name: z.string().min(1), age: z.number().int().min(0).max(120), sex: z.enum(['Female', 'Male', 'Other', 'Unknown']), village: z.string().min(1), version, identityState: z.literal('local') }).strict(), key: z.string().uuid(), replayed: z.boolean() }).strict();
export function localRegistrationFields(value) {
    if (!/^\d+$/.test(value.age))
        throw Error('Enter the known age in whole years. Unknown age is not supported by this original command.');
    return localRegistrationInput.parse({ ...value, age: Number(value.age), programme: 'General care' });
}
export function localRegistrationCommand(input, hash) {
    return commandSchema.parse({ type: 'createPerson', ...localRegistrationInput.parse(input), registrationReview: { hash: z.string().regex(/^[a-f0-9]{64}$/).parse(hash), decision: 'distinct', reason: 'No candidate found in the current permitted local search; no national identity verification claimed.' } });
}
