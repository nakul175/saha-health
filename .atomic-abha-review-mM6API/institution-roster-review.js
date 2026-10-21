import { z } from 'zod';
const text = z.string().min(1), ref = text.max(200), version = z.number().int().positive(), code = z.string().regex(/^[A-F0-9]{24}$/), role = z.enum(['asha', 'clinician', 'supervisor', 'admin']);
export const institutionRosterRow = z
    .object({
    accountCode: code,
    name: text.max(200),
    role,
    teams: z
        .array(ref)
        .max(20)
        .refine((x) => new Set(x).size === x.length),
    status: z.enum(['active', 'left']),
})
    .strict();
export const institutionRosterOperation = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('preview'), rows: z.array(institutionRosterRow).min(1).max(100) }).strict(),
    z
        .object({
        kind: z.literal('apply'),
        rows: z.array(institutionRosterRow).min(1).max(100),
        previewHash: z.string().regex(/^[a-f0-9]{64}$/),
        reason: z.string().trim().min(10).max(1000),
    })
        .strict(),
]);
export const institutionRosterContext = z
    .object({
    actorId: text,
    organisationId: ref,
    organisationName: text,
    refreshAt: z.string().datetime().nullable(),
    teams: z.array(z.object({ id: ref, name: text }).strict()),
    members: z.array(z
        .object({
        userId: text,
        accountCode: code,
        name: text,
        role: z.enum(['asha', 'clinician', 'supervisor', 'admin', 'provider']),
        status: z.enum(['active', 'suspended', 'removed']),
        version,
        isOwner: z.boolean(),
        teams: z.array(ref),
        editable: z.boolean(),
    })
        .strict()),
})
    .strict();
const action = z
    .object({
    accountCode: code,
    name: text,
    action: z.enum(['update', 'suspend', 'none']),
    detail: text,
    role: role.optional(),
    teamIds: z.array(ref).optional(),
    userId: text.optional(),
})
    .strict();
export const institutionRosterPreview = z
    .object({
    context: institutionRosterContext,
    actions: z.array(action),
    hash: z.string().regex(/^[a-f0-9]{64}$/),
    counts: z
        .object({
        invite: z.literal(0),
        update: z.number().int().nonnegative(),
        suspend: z.number().int().nonnegative(),
        none: z.number().int().nonnegative(),
        conflict: z.literal(0),
    })
        .strict(),
})
    .strict();
export const institutionRosterSaved = z
    .object({
    key: z.string().uuid(),
    replayed: z.boolean(),
    context: institutionRosterContext,
    counts: institutionRosterPreview.shape.counts,
})
    .strict();
export function institutionRosterSelection(q) {
    if ([...q.keys()].some((k) => k !== 'organisationId') || q.getAll('organisationId').length !== 1)
        throw Error('Choose one organisation.');
    return z
        .string()
        .regex(/^[A-Za-z0-9_-]{1,120}$/)
        .parse(q.get('organisationId'));
}
