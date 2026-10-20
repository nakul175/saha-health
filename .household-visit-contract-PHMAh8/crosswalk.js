import { z } from 'zod';
import { AppError, fail, person, uuid } from './core.js';
import { normallyAllowed } from './access.js';
import { applyMerge, stewardRole } from './merge.js';
import { ABHA_LIKE_ISSUER, ABHA_LIKE_VALUE, ISSUER, KNOWN_ISSUERS, REFUSED_ISSUERS, VALUE } from './record-import.js';
import { currentIdentifiers, identifierRef } from './types.js';
// Slice 10e: programme identity crosswalks (BR-ID-08, BR-INT-14). A person's identifiers from different programmes are
// linked on the person's record as an append-only ledger (types.ts ExternalIdentifier; slice 2h imports are its first
// entries). Every entry records who linked it, when, where it came from (origin) and its verification state, which a
// person attests: nothing contacts an issuer. Corrections and withdrawals append a new entry that names the one it
// replaces; nothing is edited or deleted, and the record's revision history keeps every state. One current identifier per
// issuer and value is held by at most one live record in the organisation; a link that would break that never merges
// anything: a steward who can see both records opens the slice 1c identity case (a merge proposal that two stewards must
// decide), anyone else is refused and, when the holder is outside their scope, the holder's record is flagged for steward
// review without telling the requester which record holds it (the ABHA rule of slices 6u, 6z and 6ab).
// ABHA numbers are never linked here: they go through the ABHA verification flow (slice 7a).
export const ORIGINS = ['programme-card', 'programme-system', 'person-reported', 'referral-document'];
export const VERIFICATIONS = ['unverified', 'document-seen', 'issuer-checked'];
export const ORIGIN_LABEL = { 'programme-card': 'Programme card or booklet shown', 'programme-system': 'Looked up in the programme\'s own system', 'person-reported': 'Told by the person', 'referral-document': 'Referral or discharge document' };
export const VERIFICATION_LABEL = { unverified: 'Not checked', 'document-seen': 'Document seen', 'issuer-checked': 'Checked with the issuer by a clinician or supervisor' };
export const MAX_ENTRIES = 50;
const id = z.string().trim().min(1).max(200), version = z.number().int().positive(), reason = z.string().trim().min(10, 'Explain the reason in at least 10 characters.').max(500);
export const crosswalkSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('identifierLink'), personId: id, version, issuer: z.string().trim().toLowerCase().min(1).max(32), identifier: z.string().trim().min(1).max(64), origin: z.enum(ORIGINS), verification: z.enum(VERIFICATIONS), evidence: z.string().trim().min(3, 'Describe the evidence in at least 3 characters.').max(200).optional(), corrects: z.string().trim().min(1).max(200).optional(), reason }).strict(),
    z.object({ type: z.literal('identifierWithdraw'), personId: id, version, entryId: id, reason }).strict(),
]);
const TYPES = new Set(['identifierLink', 'identifierWithdraw']);
export const IDENTIFIER_REFUSED = 'This identifier could not be recorded. Check the number; if it is correct, ask an identity steward to review this record.';
// The holder is outside the requester's care scope: refused with IDENTIFIER_REFUSED and the holding record is flagged for review.
export class IdentifierHeldElsewhere extends AppError {
    personId;
    heldBy;
    constructor(personId, heldBy) {
        super(422, IDENTIFIER_REFUSED);
        this.personId = personId;
        this.heldBy = heldBy;
    }
}
const maskValue = (v) => v.length > 4 ? 'X'.repeat(v.length - 4) + v.slice(-4) : 'X'.repeat(v.length);
const care = (m) => m.status === 'active' && ['asha', 'clinician', 'supervisor'].includes(m.role);
export function authorizeCrosswalk(_s, m, c) {
    if (!TYPES.has(c?.type))
        return;
    if (!care(m))
        fail(403, 'A care role with access to the patient is required to record identifiers.');
    if (c.type === 'identifierWithdraw' && !stewardRole(m))
        fail(403, 'A clinician or supervisor withdraws an identifier.');
    if (c.type === 'identifierLink' && c.verification === 'issuer-checked' && !stewardRole(m))
        fail(403, 'A clinician or supervisor records an identifier as checked with its issuer.');
}
// Issuer and value rules for a linked identifier. The issuer list and formats are those of slice 2h (illustrative: not checked
// against the issuing registries); an ABHA-shaped value or an issuer naming ABHA is refused under any issuer.
export function checkIdentifier(issuer, value) {
    if (REFUSED_ISSUERS.includes(issuer) || ABHA_LIKE_ISSUER.test(issuer) || ABHA_LIKE_VALUE.test(value))
        fail(422, 'ABHA numbers and addresses are linked through ABHA verification, not as programme identifiers.');
    if (!ISSUER.test(issuer) || !Object.hasOwn(KNOWN_ISSUERS, issuer))
        fail(422, `Issuer must be one of: ${Object.keys(KNOWN_ISSUERS).join(', ')}.`);
    if (!VALUE.test(value))
        fail(422, 'Identifier must be 1 to 64 letters, digits or the characters / . _ - and start with a letter or digit.');
    if (!KNOWN_ISSUERS[issuer].pattern.test(value))
        fail(422, KNOWN_ISSUERS[issuer].format);
}
const live = (p) => !p.mergedInto;
export function applyCrosswalk(s, input, u, m, now = new Date().toISOString()) {
    const parsed = crosswalkSchema.safeParse(input);
    if (!parsed.success)
        return null;
    const c = parsed.data;
    authorizeCrosswalk(s, m, c);
    const w = s.workspace, p = person(w, c.personId);
    if (p.version !== c.version)
        fail(409, 'This record changed. Refresh before continuing.');
    const ledger = p.identifiers ?? [], current = currentIdentifiers(p);
    const audit = (detail) => w.audit.push({ id: uuid(), at: now, actorId: u.userId, actor: u.displayName, role: m.role, action: c.type, subject: p.id, personId: p.id, detail });
    if (c.type === 'identifierWithdraw') {
        const target = current.find(e => identifierRef(e) === c.entryId);
        if (!target)
            fail(404, 'No current identifier on this record has that reference.');
        if (ledger.length >= MAX_ENTRIES)
            fail(422, `This record already has ${MAX_ENTRIES} identifier entries; ask an owner to review the record.`);
        const entry = { id: uuid(), kind: 'withdraw', corrects: c.entryId, issuer: target.issuer, value: target.value, verified: false, recordedAt: now, recordedBy: u.userId, source: 'crosswalk', reason: c.reason };
        p.identifiers = [...ledger, entry];
        audit(`${KNOWN_ISSUERS[target.issuer]?.label ?? target.issuer} ${maskValue(target.value)} withdrawn from this record; the earlier entry is kept in its history. Reason: ${c.reason}`);
        return { withdrawn: true, entryId: entry.id, current: currentIdentifiers(p).length };
    }
    if (p.mergedInto)
        fail(409, 'This record was merged into another record. Record identifiers on the surviving record.');
    const issuer = c.issuer, value = c.identifier;
    checkIdentifier(issuer, value);
    if (c.verification !== 'unverified' && !c.evidence)
        fail(422, 'Describe the evidence (for example "RCH card sighted at the home visit") when an identifier is recorded as seen or checked.');
    const label = KNOWN_ISSUERS[issuer].label, own = current.filter(e => e.issuer === issuer);
    let target;
    if (c.corrects) {
        target = own.find(e => identifierRef(e) === c.corrects);
        if (!target)
            fail(404, `No current ${label} on this record has that reference.`);
    }
    else if (own.some(e => e.value === value))
        fail(409, `This ${label} is already recorded on this record. To change how it was verified, record a correction that names it.`);
    else if (own.length)
        fail(409, `This record already has a ${label}. Record a correction that names it, or withdraw it first.`);
    if (ledger.length >= MAX_ENTRIES)
        fail(422, `This record already has ${MAX_ENTRIES} identifier entries; ask an owner to review the record.`);
    // One live holder per issuer and value, organisation-wide. Nothing is merged and the identifier is not recorded on either
    // record until two stewards decide an identity case (slice 1c).
    const holder = w.people.find(o => o.id !== p.id && live(o) && currentIdentifiers(o).some(e => e.issuer === issuer && e.value === value));
    if (holder) {
        // A record the requester reaches only through an emergency grant (slice 6a, 6r) counts as outside their scope here: emergency
        // access permits urgent care only, so it cannot be used to open an identity case naming that record.
        if (!normallyAllowed(m, holder))
            throw new IdentifierHeldElsewhere(p.id, holder.id);
        if (!stewardRole(m))
            fail(409, `This ${label} is already recorded on another record you can see. A clinician or supervisor can open an identity review of the two records.`);
        let caseId;
        try {
            caseId = applyMerge(s, { type: 'identityMergePropose', survivorId: holder.id, duplicateId: p.id, evidence: `Same ${issuer} identifier`.slice(0, 200), reason: `The same ${label} (${maskValue(value)}) was entered on this record and is already recorded on the other. Review whether they are the same person; nothing is merged until two stewards decide.` }, u, m, now).caseId;
        }
        catch (e) {
            if (e instanceof AppError)
                fail(e.status, `This ${label} is already recorded on another record you can see, and an identity review could not be opened: ${e.message}`);
            throw e;
        }
        audit(`${label} ${maskValue(value)} was not recorded: the same identifier is recorded on another record. An identity case was opened for two stewards to decide; nothing was merged.`);
        return { linked: false, conflict: { personId: holder.id, caseId } };
    }
    const entry = { id: uuid(), kind: target ? 'correct' : 'link', ...(target ? { corrects: c.corrects } : {}), issuer, value, verified: c.verification === 'issuer-checked', recordedAt: now, recordedBy: u.userId, source: 'crosswalk', origin: c.origin, verification: c.verification, ...(c.evidence ? { evidence: c.evidence } : {}), reason: c.reason };
    p.identifiers = [...ledger, entry];
    audit(`${label} ${maskValue(value)} ${target ? `recorded as a correction of an earlier ${label} entry` : 'linked'} (${ORIGIN_LABEL[c.origin].toLowerCase()}; ${VERIFICATION_LABEL[c.verification].toLowerCase()}). Not verified by Saha. Reason: ${c.reason}`);
    return { linked: true, entryId: entry.id, current: currentIdentifiers(p).length };
}
