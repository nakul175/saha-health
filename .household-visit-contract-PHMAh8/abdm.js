import { z } from 'zod';
import { AppError, fail, person, uuid } from './core.js';
import { operationRefusal } from './adapter-operations.js';
// Slice 7a: ABDM-shaped workflows against a local mock gateway (BR-INT-13, BR-INT-14, BR-INT-15).
// Nothing here talks to ABDM. Purpose and health-information type codes follow the list in the
// CoronaSafe ABDM implementer's guide; they have not been validated against the ABDM sandbox.
export const PURPOSES = ['CAREMGT', 'BTG', 'PUBHLTH', 'HPAYMT', 'DSRCH', 'PATRQT'];
export const HI_TYPES = ['OPConsultation', 'Prescription', 'DiagnosticReport', 'DischargeSummary', 'ImmunizationRecord', 'HealthDocumentRecord', 'WellnessRecord'];
export const MOCK_OTP = '123456';
// Slice 6z (sixth review): one refusal for every failed link the requester may not learn more about — a one-time code the
// gateway did not accept, and an ABHA number already linked to a record outside the requester's care scope — so the
// refusal does not reveal that a patient the worker may not see holds the number.
export const LINK_REFUSED = 'This ABHA could not be linked: the gateway did not accept this number and one-time code. Check both; if they are correct, ask an identity steward to review this record.';
// The out-of-scope duplicate is refused with LINK_REFUSED and carries the two record ids so the server can record it for
// identity steward review (an audit event on both records) without telling the requester.
export class AbhaHeldElsewhere extends AppError {
    personId;
    heldBy;
    constructor(personId, heldBy) {
        super(422, LINK_REFUSED);
        this.personId = personId;
        this.heldBy = heldBy;
    }
}
const id = z.string().trim().min(1).max(200), version = z.number().int().positive(), reason = z.string().trim().min(10).max(1000), day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
// Slice 10e: format only (14 digits, or hyphenated 2-4-4-4; mixed grouping is refused). No checksum is applied because no official
// ABDM or NHA specification of one was found; see lib/saha/identifier-search.ts, whose parseAbha is the same rule.
const abhaNumber = z.string().trim().regex(/^(\d{14}|\d{2}-\d{4}-\d{4}-\d{4})$/, 'Enter the 14-digit ABHA number, as 14 digits or grouped 2-4-4-4 with hyphens (for example 91-1234-5678-9012).').transform(x => x.replace(/-/g, '').replace(/^(\d{2})(\d{4})(\d{4})(\d{4})$/, '$1-$2-$3-$4'));
export const abdmSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('abdmConfigure'), environment: z.enum(['mock', 'sandbox', 'production']), modules: z.object({ abha: z.boolean(), hip: z.boolean(), hiu: z.boolean() }).strict(), facilityId: z.string().trim().min(3).max(100), approvals: z.array(z.object({ module: z.enum(['abha', 'hip', 'hiu']), reference: z.string().trim().min(3).max(200) }).strict()).max(3), reason }).strict(),
    z.object({ type: z.literal('abhaLink'), personId: id, version, abhaNumber, abhaAddress: z.string().trim().regex(/^[a-z0-9._]{3,40}@(abdm|sbx)$/i, 'Use an ABHA address such as name@abdm.').optional(), otp: z.string().trim().regex(/^\d{6}$/) }).strict(),
    z.object({ type: z.literal('abhaDecline'), personId: id, version, reason }).strict(),
    z.object({ type: z.literal('abhaUnlink'), personId: id, version, reason }).strict(),
    z.object({ type: z.literal('abdmConsentRequest'), personId: id, version, purpose: z.enum(PURPOSES), hiTypes: z.array(z.enum(HI_TYPES)).min(1).max(HI_TYPES.length).refine(x => new Set(x).size === x.length, 'List each type once.'), from: day, to: day, expiresAt: z.string().datetime() }).strict(),
    z.object({ type: z.literal('abdmConsentDecide'), personId: id, consentId: id, decision: z.enum(['GRANTED', 'DENIED']) }).strict(),
    z.object({ type: z.literal('abdmConsentRevoke'), personId: id, consentId: id, reason }).strict(),
]);
const TYPES = new Set(['abdmConfigure', 'abhaLink', 'abhaDecline', 'abhaUnlink', 'abdmConsentRequest', 'abdmConsentDecide', 'abdmConsentRevoke']);
export const abdmIntegration = (s) => s.workspace.integrations.find(i => i.kind === 'abdm');
export function abdmConfig(s) { return abdmIntegration(s)?.abdm; }
function module(s, name) { const c = abdmConfig(s); if (!c || !c.modules[name] || !c.approvals.some(a => a.module === name))
    fail(409, `The ABDM ${name.toUpperCase()} module is not enabled with a recorded approval for this organisation.`); return c; }
const care = (m) => ['asha', 'clinician'].includes(m.role);
// Slice 7e: the mock gateway's permitted operations (create links, delete/unlink, look up records) are checked
// before each ABDM-shaped step. These steps are single local commits against the mock, so a refusal changes nothing.
// Slice 6ab (eighth review): a consent request is the first step of a fetch, so it is governed by lookup. A consent
// revocation is never refused (withdrawing permission must always work locally); see abdmConsentRevoke below.
const ABDM_OPERATION = { abhaLink: 'create', abhaUnlink: 'delete', abdmCareContextLink: 'create', abdmFetch: 'lookup', abdmConsentRequest: 'lookup' };
export const ABHA_REVIEW_LIMIT = 3;
export function abdmOperation(s, type) { const op = ABDM_OPERATION[type], i = abdmIntegration(s); if (!op || !i)
    return; const refused = operationRefusal(i, op, op === 'lookup' ? 'none' : 'patient'); if (refused)
    fail(409, refused + ' Nothing was changed on the mock gateway.'); }
export function authorizeAbdm(_s, m, c) {
    if (!TYPES.has(c?.type))
        return;
    if (['abdmConfigure', 'abdmConsentDecide'].includes(c.type) && !m.isOwner)
        fail(403, 'Only an organisation owner can configure ABDM or act as the mock consent manager.');
    if (['abhaLink', 'abhaDecline', 'abhaUnlink', 'abdmConsentRevoke'].includes(c.type) && !care(m))
        fail(403, 'A care role with access to the patient is required.');
    if (c.type === 'abdmConsentRequest' && m.role !== 'clinician')
        fail(403, 'A clinician with access to the patient requests health information.');
}
// Effective status: a granted artefact past its expiry is EXPIRED.
export const effective = (c, now) => c.status === 'GRANTED' && c.expiresAt <= now ? 'EXPIRED' : c.status;
// Whether a fetch for one health-information type dated on one day is allowed by an artefact.
export function consentAllows(p, consentId, q, now = new Date().toISOString()) {
    const c = (p.abdmConsents ?? []).find(x => x.id === consentId);
    if (!c)
        return { allowed: false, reason: 'No such consent artefact for this patient.' };
    const st = effective(c, now);
    if (st !== 'GRANTED')
        return { allowed: false, reason: `Consent is ${st}.` };
    if (p.abha?.state !== 'linked' || p.abha.number !== c.abhaNumber)
        return { allowed: false, reason: 'The ABHA link changed after consent; request consent again.' };
    if (q.purpose && q.purpose !== c.purpose)
        return { allowed: false, reason: `Consent covers purpose ${c.purpose} only.` };
    if (!c.hiTypes.includes(q.hiType))
        return { allowed: false, reason: `Consent does not cover ${q.hiType}.` };
    if (q.date < c.from || q.date > c.to)
        return { allowed: false, reason: `Consent covers records dated ${c.from} to ${c.to} only.` };
    return { allowed: true, reason: `Allowed under ${c.purpose} until ${c.expiresAt}.` };
}
// All checks preceding a number lookup, shared with the atomic reservation path.
export function validateAbhaLink(s, c, m) {
    authorizeAbdm(s, m, c);
    abdmOperation(s, c.type);
    const p = person(s.workspace, c.personId);
    if (p.version !== c.version)
        fail(409, 'Patient changed. Refresh before continuing.');
    if (p.mergedInto)
        fail(409, 'This record was merged into another record.');
    module(s, 'abha');
    if (p.abha?.state === 'linked')
        fail(409, 'An ABHA is already linked. Unlink it with a reason before linking another.');
}
export function applyAbdm(s, input, u, m, now = new Date().toISOString()) {
    const parsed = abdmSchema.safeParse(input);
    if (!parsed.success)
        return null;
    const c = parsed.data;
    authorizeAbdm(s, m, c);
    abdmOperation(s, c.type);
    const w = s.workspace;
    let subject = s.organisation.id, personId, detail = '', result = { ok: true };
    if (c.type === 'abdmConfigure') {
        if (c.environment !== 'mock')
            fail(409, 'Sandbox and production need ABDM onboarding, approvals and credentials outside Saha. This release supports the local mock gateway only.');
        for (const k of ['abha', 'hip', 'hiu'])
            if (c.modules[k] && !c.approvals.some(a => a.module === k))
                fail(422, `Record an approval reference for the ${k.toUpperCase()} module before enabling it.`);
        let i = abdmIntegration(s);
        if (!i) {
            i = { id: 'abdm', name: 'ABDM exchange', kind: 'abdm', mode: 'unconfigured', status: 'unconfigured', version: 1, description: 'ABDM-shaped workflows against a local mock gateway.', programmes: [] };
            w.integrations.push(i);
        }
        i.abdm = { environment: 'mock', modules: c.modules, facilityId: c.facilityId, approvals: c.approvals, version: (i.abdm?.version ?? 0) + 1, setBy: u.userId, setAt: now };
        i.version++;
        subject = i.id;
        detail = `ABDM mock configuration version ${i.abdm.version}: ABHA ${c.modules.abha ? 'on' : 'off'}, HIP ${c.modules.hip ? 'on' : 'off'}, HIU ${c.modules.hiu ? 'on' : 'off'}; facility ${c.facilityId}. No ABDM service is contacted. ${c.reason}`;
        result = { version: i.abdm.version };
    }
    else if (c.type === 'abdmConsentDecide' || c.type === 'abdmConsentRevoke') {
        const p = person(w, c.personId);
        personId = subject = p.id;
        const x = (p.abdmConsents ?? []).find(y => y.id === c.consentId);
        if (!x)
            fail(404, 'Consent artefact not found.');
        if (c.type === 'abdmConsentDecide') {
            module(s, 'hiu');
            if (x.status !== 'REQUESTED')
                fail(409, 'This consent request is already decided.');
            x.status = c.decision;
            x.decidedAt = now;
            detail = `Mock consent manager recorded ${c.decision} for ${x.purpose} (${x.hiTypes.join(', ')}). In a real deployment the patient decides in their ABDM app.`;
        }
        else {
            const st = effective(x, now);
            if (!['GRANTED', 'REQUESTED'].includes(st))
                fail(409, `A ${st} consent cannot be revoked.`);
            x.status = 'REVOKED';
            x.revokedAt = now;
            x.revokeReason = c.reason;
            // Slice 6ab: the revocation always applies in Saha; the gateway's delete operation governs only whether the mock
            // gateway is told (nothing is sent in this release either way), and the audit says which.
            const gw = abdmIntegration(s), told = !gw || !operationRefusal(gw, 'delete', 'patient');
            result = { ok: true, gatewayNotified: told };
            detail = `Consent revoked; further fetches are refused.${told ? '' : ' The mock gateway was not told: its delete operation is withdrawn.'} ${c.reason}`;
        }
        p.version++;
    }
    else {
        const p = person(w, c.personId);
        personId = subject = p.id;
        if (p.version !== c.version)
            fail(409, 'Patient changed. Refresh before continuing.');
        if (p.mergedInto)
            fail(409, 'This record was merged into another record.');
        const hist = (action, extra = {}) => { p.abha ??= { state: 'none', at: now, by: u.userId, history: [] }; p.abha.history.push({ at: now, by: u.userId, action, ...extra }); if (p.abha.history.length > 100)
            fail(422, 'ABHA history limit reached.'); };
        if (c.type === 'abhaLink') {
            module(s, 'abha');
            // Slice 6ab (eighth review): an already linked record is refused first, whatever number or code is entered.
            if (p.abha?.state === 'linked')
                fail(409, 'An ABHA is already linked. Unlink it with a reason before linking another.');
            const other = w.people.find(q => q.id !== p.id && q.abha?.state === 'linked' && q.abha.number === c.abhaNumber && !q.mergedInto);
            // Slice 6u (fourth review): the check is organisation-wide. Slice 6z: when the other record is outside the worker's
            // scope the refusal is the same as a gateway refusal (status and text) and the server records it for a steward.
            // Slice 6ab: it is decided before the one-time code is looked at, so it does not depend on the code. Because the
            // mock gateway's code is public, a requester who enters it can still tell this refusal from a successful link: the
            // server therefore records at most one review event per requester and holding record a day, and after
            // ABHA_REVIEW_LIMIT such refusals in a day refuses every further link by that requester the same way (server.ts).
            if (other && !other.assigned)
                throw new AbhaHeldElsewhere(p.id, other.id);
            if (c.otp !== MOCK_OTP)
                fail(422, LINK_REFUSED);
            if (other)
                fail(409, 'This ABHA number is linked to another record. Review whether the records are the same person before linking.');
            hist('linked', { number: c.abhaNumber });
            Object.assign(p.abha, { state: 'linked', number: c.abhaNumber, address: c.abhaAddress, verification: 'mock-otp', at: now, by: u.userId });
            detail = `ABHA ${c.abhaNumber.slice(0, 2)}-XXXX-XXXX-${c.abhaNumber.slice(-4)} linked after mock OTP verification. Not verified with ABDM.`;
            result = { abha: `${c.abhaNumber.slice(0, 2)}-XXXX-XXXX-${c.abhaNumber.slice(-4)}` };
        }
        else if (c.type === 'abhaDecline') {
            if (p.abha?.state === 'linked')
                fail(409, 'Unlink the current ABHA first.');
            hist('declined', { reason: c.reason });
            Object.assign(p.abha, { state: 'declined', number: undefined, address: undefined, at: now, by: u.userId });
            detail = `Person declined ABHA. Local care continues without it. ${c.reason}`;
        }
        else if (c.type === 'abhaUnlink') {
            if (p.abha?.state !== 'linked')
                fail(409, 'No ABHA is linked.');
            const old = p.abha.number;
            hist('unlinked', { number: old, reason: c.reason });
            Object.assign(p.abha, { state: 'none', number: undefined, address: undefined, verification: undefined, at: now, by: u.userId });
            let paused = 0;
            for (const x of p.abdmConsents ?? [])
                if (['REQUESTED', 'GRANTED'].includes(effective(x, now))) {
                    x.status = 'REVOKED';
                    x.revokedAt = now;
                    x.revokeReason = 'ABHA unlinked: ' + c.reason;
                    paused++;
                }
            detail = `ABHA unlinked with history kept; ${paused} open consent artefact${paused === 1 ? '' : 's'} revoked. ${c.reason}`;
        }
        else {
            module(s, 'hiu');
            if (p.abha?.state !== 'linked')
                fail(409, 'Link a verified ABHA before requesting health information.');
            if (c.from > c.to)
                fail(422, 'The date range ends before it starts.');
            if (c.expiresAt <= now || Date.parse(c.expiresAt) > Date.parse(now) + 365 * 86400000)
                fail(422, 'Choose an expiry within the next year.');
            if ((p.abdmConsents ?? []).length >= 50)
                fail(422, 'Consent request limit reached for this patient.');
            const x = { id: uuid(), purpose: c.purpose, hiTypes: c.hiTypes, from: c.from, to: c.to, expiresAt: c.expiresAt, status: 'REQUESTED', requestedBy: u.userId, requestedAt: now, abhaNumber: p.abha.number };
            (p.abdmConsents ??= []).push(x);
            detail = `Consent requested from the mock consent manager: ${c.purpose}; ${c.hiTypes.join(', ')}; records ${c.from} to ${c.to}; expires ${c.expiresAt}.`;
            result = { consentId: x.id };
        }
        p.version++;
    }
    w.audit.push({ id: uuid(), at: now, actorId: u.userId, actor: u.displayName, role: m.role, action: c.type, subject, personId, detail });
    return result;
}
export function abdmView(s, p, q, now = new Date().toISOString()) {
    const cfg = abdmConfig(s);
    const mask = (n) => n ? `${n.slice(0, 2)}-XXXX-XXXX-${n.slice(-4)}` : null;
    return { config: cfg ? { environment: cfg.environment, modules: cfg.modules, facilityId: cfg.facilityId, version: cfg.version, approvals: cfg.approvals } : null,
        abha: p.abha ? { state: p.abha.state, number: mask(p.abha.number), address: p.abha.address ?? null, verification: p.abha.verification ?? null, history: p.abha.history.map(h => ({ ...h, number: mask(h.number) })) } : { state: 'none', number: null, history: [] },
        consents: (p.abdmConsents ?? []).map(c => ({ ...c, abhaNumber: mask(c.abhaNumber), status: effective(c, now) })).reverse(),
        careContexts: (p.careContexts ?? []).map(c => ({ ...c, abhaNumber: mask(c.abhaNumber), current: c.abhaNumber === p.abha?.number })), transfers: [...(p.abdmTransfers ?? [])].reverse(), received: (p.abdmReceived ?? []).map(r => ({ id: r.id, consentId: r.consentId, transferId: r.transferId, hiType: r.hiType, recordDate: r.recordDate, state: r.state, receivedAt: r.receivedAt, note: r.note ?? null, summary: (r.bundle?.entry ?? []).map((e) => e.resource?.resourceType).filter(Boolean).join(', '), validation: r.validation ? `${r.validation.ruleset} ${r.validation.version}` : null })).reverse(),
        check: q.consentId && q.hiType && q.date ? consentAllows(p, q.consentId, { hiType: q.hiType, date: q.date, purpose: q.purpose ?? undefined }, now) : null,
        purposes: PURPOSES, hiTypes: HI_TYPES, mock: 'Local mock gateway only. One-time code 123456 is accepted; nothing is sent to ABDM.' };
}
// Snapshots carry masked ABHA numbers; the full number stays in the stored record and its revisions.
// Slice 2h: imported external identifiers are masked the same way in snapshots and history (all but the last four characters).
export const maskIdentifier = (v) => v.length > 4 ? 'X'.repeat(v.length - 4) + v.slice(-4) : 'X'.repeat(v.length);
export function redactAbha(p) {
    if (!p.abha && !p.abdmConsents && !p.careContexts && !p.abdmReceived && !p.identifiers)
        return p;
    const mask = (n) => n ? `${n.slice(0, 2)}-XXXX-XXXX-${n.slice(-4)}` : n;
    return { ...p, ...(p.abha ? { abha: { ...p.abha, number: mask(p.abha.number), history: p.abha.history.map(h => ({ ...h, number: mask(h.number) })) } } : {}), ...(p.abdmConsents ? { abdmConsents: p.abdmConsents.map(c => ({ ...c, abhaNumber: mask(c.abhaNumber) })) } : {}), ...(p.careContexts ? { careContexts: p.careContexts.map(c => ({ ...c, abhaNumber: mask(c.abhaNumber) })) } : {}), ...(p.abdmReceived ? { abdmReceived: p.abdmReceived.map(({ bundle, ...r }) => r) } : {}), ...(p.identifiers ? { identifiers: p.identifiers.map(i => ({ ...i, value: maskIdentifier(i.value) })) } : {}) };
}
// Slice 6r: stored revisions keep the full record; history is redacted on read like snapshots (masked ABHA numbers, no received FHIR bundles).
const maskAbha = (n) => /^[0-9-]{8,}$/.test(n) ? `${n.slice(0, 2)}-XXXX-XXXX-${n.slice(-4)}` : n;
export function redactRevision(r) {
    const abhaField = (f) => /(^|\.)abha\.number$|abhaNumber$/i.test(f), received = (f) => /^abdmReceived(\.|$)/.test(f);
    return { ...r, data: r.entityType === 'person' && r.data && typeof r.data === 'object' ? redactAbha(r.data) : r.data, changes: (r.changes ?? []).map(x => received(x.field) ? { ...x, before: x.before === '—' ? '—' : '[received record withheld]', after: x.after === '—' ? '—' : '[received record withheld]' } : abhaField(x.field) ? { ...x, before: maskAbha(x.before), after: maskAbha(x.after) } : x) };
}
