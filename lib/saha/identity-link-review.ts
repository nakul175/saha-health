import { z } from 'zod';
const ref = z.string().min(1).max(200),
  text = z.string().min(1),
  version = z.number().int().positive();
export const identityLinkPrepare = z
  .object({
    type: z.literal('prepareIdentifierCorrection'),
    personId: ref,
    version,
    issuer: z.enum(['rch', 'nikshay']),
    corrects: ref,
    identifier: z.string().trim().min(1).max(64),
    origin: z.enum(['programme-card', 'programme-system', 'person-reported', 'referral-document']),
    verification: z.enum(['unverified', 'document-seen']),
    evidence: z.string().trim().min(3).max(200).optional(),
    destinationId: ref,
    reason: z.string().trim().min(10).max(500),
  })
  .strict()
  .refine(
    (c) => (c.issuer === 'rch' ? /^\d{12}$/.test(c.identifier) : /^\d{6,10}$/.test(c.identifier)),
    'Use the existing issuer format; no national identity verification is performed.',
  )
  .refine((c) => c.verification !== 'document-seen' || !!c.evidence, 'Describe the document actually seen.');
export const identityLinkOperation = z
  .object({ personId: ref, command: identityLinkPrepare })
  .strict()
  .refine((x) => x.personId === x.command.personId, 'Choose the exact reviewed person.');
export const identityLinkResponse = z
  .object({
    actorId: text,
    organisationId: ref,
    person: z.object({ id: ref, name: text, version }).strict(),
    refreshAt: z.string().datetime().nullable(),
    entries: z
      .array(
        z
          .object({
            id: ref,
            issuer: text,
            label: text,
            masked: text,
            kind: z.enum(['link', 'correct', 'withdraw']),
            current: z.boolean(),
            corrects: ref.nullable(),
            recordedAt: z.string().datetime(),
            recordedBy: text,
            source: z.enum(['import', 'crosswalk']),
            origin: z.string().nullable(),
            verification: z.enum(['unverified', 'document-seen', 'issuer-checked']),
          })
          .strict(),
      )
      .max(50),
    destinations: z.array(z.object({ id: ref, name: text }).strict()),
    repairs: z
      .array(
        z
          .object({
            id: ref,
            destinationId: ref,
            destinationName: text,
            issuer: text,
            corrects: ref,
            entryId: ref,
            state: z.enum([
              'prepared',
              'approved',
              'sending',
              'accepted',
              'rejected',
              'uncertain',
              'cancelled',
            ]),
            unresolved: z.boolean(),
            expiryPassed: z.boolean(),
            preparedAt: z.string().datetime(),
            preparedBy: text,
            payloadSha256: z.string().regex(/^[a-f0-9]{64}$/),
            attempts: z.number().int().nonnegative(),
            receipt: z.string().nullable(),
          })
          .strict(),
      )
      .max(500),
  })
  .strict();
export type IdentityLinkReview = z.infer<typeof identityLinkResponse>;
export const identityLinkSaved = z
  .object({ key: z.string().uuid(), replayed: z.boolean(), correctionId: ref, review: identityLinkResponse })
  .strict();
export function identityLinkSelection(query: URLSearchParams) {
  if (
    [...query.keys()].some((k) => !['personId', 'organisationId'].includes(k)) ||
    query.getAll('personId').length !== 1 ||
    query.getAll('organisationId').length !== 1
  )
    throw Error('Choose the link from Today.');
  const id = (x: string | null) =>
    z
      .string()
      .regex(/^[A-Za-z0-9_-]{1,120}$/)
      .parse(x);
  return { personId: id(query.get('personId')), organisationId: id(query.get('organisationId')) };
}
