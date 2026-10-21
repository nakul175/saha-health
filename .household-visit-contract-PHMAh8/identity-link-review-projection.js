import { z } from 'zod';
import { identifierRef, currentIdentifiers } from './types.js';
import { KNOWN_ISSUERS } from './record-import.js';
import { correctionDestination, correctionsOf, CORRECTION_OPEN_STATES, IDENTIFIER_APPROVAL_HOURS, } from './crosswalk-correction.js';
import { ORIGINS, VERIFICATIONS, MAX_ENTRIES } from './crosswalk.js';
import { identityLinkResponse } from './identity-link-review.js';
const str = z.string().min(1).max(200), at = z.string().datetime(), entry = z
    .object({
    id: str.optional(),
    kind: z.enum(['link', 'correct', 'withdraw']).optional(),
    corrects: str.optional(),
    issuer: str,
    value: z.string().min(1).max(64),
    verified: z.boolean(),
    recordedAt: at,
    recordedBy: z.string().min(1),
    source: z.enum(['import', 'crosswalk']),
    imported: z
        .object({
        batchId: str,
        row: z.number().int().positive(),
        planHash: z.string().regex(/^[a-f0-9]{64}$/),
    })
        .optional(),
    origin: z.enum(ORIGINS).optional(),
    verification: z.enum(VERIFICATIONS).optional(),
})
    .passthrough();
const repair = z
    .object({
    id: str,
    personId: str,
    destinationId: str,
    destinationName: str,
    issuer: str,
    corrects: str,
    entryId: str,
    state: z.enum(['prepared', 'approved', 'sending', 'accepted', 'rejected', 'uncertain', 'cancelled']),
    preparedAt: at,
    preparedBy: z.string().min(1),
    payloadSha256: z.string().regex(/^[a-f0-9]{64}$/),
    attempts: z.number().int().nonnegative(),
    receipt: z.string().min(1).max(200).optional(),
    expiresAt: at.optional(),
})
    .passthrough();
export function projectIdentityLinks(state, person, actorId, now) {
    at.parse(now);
    const ledger = z
        .array(entry)
        .max(MAX_ENTRIES)
        .parse(person.identifiers ?? []), seen = new Set();
    for (const e of ledger) {
        const id = identifierRef(e);
        if (!id ||
            seen.has(id) ||
            (e.corrects &&
                !ledger.some((p) => identifierRef(p) === e.corrects && p.issuer === e.issuer && seen.has(e.corrects))) ||
            (e.kind === 'correct' && !e.corrects) ||
            (e.kind === 'withdraw' && !e.corrects) ||
            !Object.hasOwn(KNOWN_ISSUERS, e.issuer))
            throw Error('Current identifier ledger is unavailable.');
        seen.add(id);
    }
    const current = new Set(currentIdentifiers({ identifiers: ledger }).map(identifierRef)), raw = correctionsOf(state);
    if (!Array.isArray(raw) || raw.some((x) => !x || typeof x.personId !== 'string'))
        throw Error('Current repair metadata is unavailable.');
    const repairs = raw.filter((x) => x?.personId === person.id).map((x) => repair.parse(x));
    if (repairs.length > 500 || new Set(repairs.map((x) => x.id)).size !== repairs.length)
        throw Error('Current repair metadata is unavailable.');
    for (const c of repairs) {
        if (!seen.has(c.entryId) ||
            !seen.has(c.corrects) ||
            ledger.find((e) => identifierRef(e) === c.entryId)?.corrects !== c.corrects)
            throw Error('Current repair lineage is unavailable.');
    }
    const destinations = state.workspace.integrations
        .filter((i) => {
        try {
            correctionDestination(state, i.id);
            return true;
        }
        catch {
            return false;
        }
    })
        .map((i) => ({ id: i.id, name: i.name }));
    return identityLinkResponse.parse({
        actorId,
        organisationId: state.organisation.id,
        person: { id: person.id, name: person.name, version: person.version },
        refreshAt: repairs
            .flatMap((c) => {
            const value = c.state === 'prepared'
                ? new Date(Date.parse(c.preparedAt) + IDENTIFIER_APPROVAL_HOURS * 3600000 + 1).toISOString()
                : c.state === 'approved'
                    ? c.expiresAt
                    : null;
            return value && value > now ? [value] : [];
        })
            .sort()[0] ?? null,
        entries: ledger.map((e) => ({
            id: identifierRef(e),
            issuer: e.issuer,
            label: KNOWN_ISSUERS[e.issuer].label,
            masked: e.value.length > 4 ? 'X'.repeat(e.value.length - 4) + e.value.slice(-4) : 'X'.repeat(e.value.length),
            kind: e.kind ?? 'link',
            current: current.has(identifierRef(e)),
            corrects: e.corrects ?? null,
            recordedAt: e.recordedAt,
            recordedBy: e.recordedBy,
            source: e.source,
            origin: e.origin ?? null,
            verification: e.verification ?? 'unverified',
        })),
        destinations,
        repairs: repairs.map((c) => ({
            id: c.id,
            destinationId: c.destinationId,
            destinationName: c.destinationName,
            issuer: c.issuer,
            corrects: c.corrects,
            entryId: c.entryId,
            state: c.state,
            unresolved: CORRECTION_OPEN_STATES.includes(c.state),
            expiryPassed: c.state === 'prepared'
                ? Date.parse(c.preparedAt) + IDENTIFIER_APPROVAL_HOURS * 3600000 < Date.parse(now)
                : c.state === 'approved'
                    ? !c.expiresAt || c.expiresAt < now
                    : false,
            preparedAt: c.preparedAt,
            preparedBy: c.preparedBy,
            payloadSha256: c.payloadSha256,
            attempts: c.attempts,
            receipt: c.receipt ?? null,
        })),
    });
}
