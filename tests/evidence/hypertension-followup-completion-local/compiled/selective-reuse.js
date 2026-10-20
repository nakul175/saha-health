import { z } from 'zod';
import { digest, fail, factsSchema, activePlan, commandSchema, AppError } from './core.js';
import { normallyAllowed } from './access.js';
import { purposeRefusal } from './purpose-scope.js';
import { mappingSchema, mappedPayload, MIS_FIELDS, assertMappingEffective } from './mis.js';
import { operationRefusal, misOperation } from './adapter-operations.js';
const receiptSchema = z.object({ actor_id: z.string().min(1), org_id: z.string().min(1), person_id: z.string().min(1), command_type: z.string().min(1), hash: z.string().min(1), result: z.string(), key: z.string().min(1) }).passthrough();
const ref = z.string().regex(/^[A-Za-z0-9_:.-]{1,120}$/), ver = z.number().int().positive().safe(), hash = z.string().regex(/^[0-9a-f]{64}$/), purpose = z.enum(['programme-delivery', 'ai-assistance']);
export const selectiveReuseContext = z.object({ organisationId: ref, actorId: z.string().min(1), personId: ref, refreshAt: z.string().datetime().nullable(), visits: z.array(z.object({ id: ref, version: ver, date: z.string() }).strict()), destinations: z.array(z.object({ id: ref, name: z.string().min(1), kind: z.enum(['mis', 'ai']), version: ver }).strict()), selected: z.object({ visitId: ref, visitVersion: ver, destinationId: ref, purpose, state: z.enum(['permitted-preview', 'withheld']), reason: z.string().nullable(), mapping: z.union([mappingSchema, z.array(z.never()).length(0)]), excluded: z.array(z.enum(MIS_FIELDS)), payload: z.object({ contract: z.literal('saha-mis-v1'), environment: z.literal('synthetic'), operation: z.literal('submit'), fields: z.record(z.union([z.string().max(4000), z.null()])) }).strict().nullable(), payloadHash: hash.nullable(), originalPlan: z.object({ id: ref, state: z.enum(['proposed', 'approved', 'completed', 'blocked']), receiptKey: z.string().min(1), commandHash: hash, comparison: z.literal('matches-current-selected-payload') }).strict().nullable() }).strict().nullable(), readOnly: z.literal(true) }).strict().superRefine((c, x) => { const s = c.selected; if (!s)
    return; if (!c.visits.some(v => v.id === s.visitId && v.version === s.visitVersion) || !c.destinations.some(d => d.id === s.destinationId))
    x.addIssue({ code: 'custom', message: 'Unbound selection.' }); if (s.state === 'withheld' && (s.payload !== null || s.payloadHash !== null || s.originalPlan !== null || s.mapping.length || s.excluded.length))
    x.addIssue({ code: 'custom', message: 'Withheld values/allowlist must not escape.' }); if (s.state === 'permitted-preview' && (!s.payload || !s.payloadHash || s.reason !== null || !s.mapping.length))
    x.addIssue({ code: 'custom', message: 'Permitted preview incomplete.' }); if (s.payload && Object.keys(s.payload.fields).some(k => !s.mapping.some(m => m.target === k)))
    x.addIssue({ code: 'custom', message: 'Payload exceeds original field mapping.' }); });
export function reuseSelection(q) { if (q.getAll('personId').length !== 1 || [...q.keys()].some(k => !['personId', 'visitId', 'destinationId', 'purpose'].includes(k)) || [...q.keys()].some(k => q.getAll(k).length !== 1))
    throw Error('Choose exact references.'); const personId = ref.parse(q.get('personId')), selected = {}; for (const k of ['visitId', 'destinationId'])
    if (q.has(k))
        selected[k] = ref.parse(q.get(k)); if (q.has('purpose'))
    selected.purpose = purpose.parse(q.get('purpose')); if (selected.destinationId && !selected.visitId || selected.purpose && !selected.destinationId || selected.destinationId && !selected.purpose)
    throw Error('Choose complete explicit destination/purpose.'); return { personId, selected }; }
// Use the original predicate at the recorded future time; do not create a new mapping policy.
export function selectiveReuseMappingDeadline(i, now = Date.now()) {
    assertMappingEffective(i, now);
    const l = i.mis?.lifecycle, r = l?.pendingId ? l.revisions.find(x => x.id === l.pendingId) : undefined;
    if (!r)
        return null;
    const at = Date.parse(r.manifest.effectiveAt);
    if (!Number.isFinite(at) || at <= now)
        return null;
    try {
        assertMappingEffective(i, at);
    }
    catch (error) {
        if (error instanceof AppError && error.status === 409)
            return new Date(at).toISOString();
        throw error;
    }
    return null;
}
export async function selectiveReuseProjection(s, m, actorId, id, choice, receipts, refreshAt) {
    if (m.userId !== actorId || m.status !== 'active' || !['asha', 'clinician'].includes(m.role))
        fail(403, 'Current care authority is required.');
    const p = s.workspace.people.find(p => p.id === id && !p.mergedInto && normallyAllowed(m, p));
    if (!p)
        fail(404, 'This record is outside your ordinary care scope.');
    if (typeof p.exchangeConsent !== 'boolean' || typeof p.aiConsent !== 'boolean' || [p.version, p.consentVersion, m.version].some(x => !Number.isSafeInteger(x) || x < 1))
        fail(503, 'Current consent or membership source is unavailable.');
    const visits = s.workspace.visits.filter(v => v.personId === id && v.state === 'confirmed' && !v.voidedAt && !v.supersededBy && !v.imported), destinations = s.workspace.integrations.filter(i => ['mis', 'ai'].includes(i.kind)).map(i => ({ id: i.id, name: i.name, kind: i.kind, version: i.version }));
    let selected = null;
    if (choice.visitId) {
        const v = visits.find(v => v.id === choice.visitId);
        if (!v)
            fail(404, 'Choose an exact current original confirmed encounter.');
        if (choice.destinationId && choice.purpose) {
            const i = s.workspace.integrations.find(i => i.id === choice.destinationId && ['mis', 'ai'].includes(i.kind));
            if (!i)
                fail(404, 'Choose one exact existing destination.');
            const base = { visitId: v.id, visitVersion: v.version, destinationId: i.id, purpose: choice.purpose }, withheld = (reason) => ({ ...base, state: 'withheld', reason, mapping: [], excluded: [], payload: null, payloadHash: null, originalPlan: null });
            const refusal = purposeRefusal(m, choice.purpose, s.operations?.purposeGrants);
            if (refusal)
                selected = withheld('The current original purpose grant does not permit this use. No fact or payload was disclosed.');
            else if (choice.purpose === 'ai-assistance')
                selected = withheld(!p.aiConsent ? 'Current AI permission is absent. Permission for programme delivery does not authorise AI reuse.' : 'AI payloads require their original tool, input, capability and minimisation review; none is built by this programme-mapping screen.');
            else if (i.kind !== 'mis' || i.mode !== 'http')
                selected = withheld('This bounded preview supports only existing mapped HTTP programme destinations.');
            else if (i.status !== 'active' || !i.programmes.some(x => p.programmes.includes(x)) || !p.exchangeConsent || !i.mis?.test?.ok)
                selected = withheld('Current destination, programme, recorded mapping test or sharing permission is unavailable.');
            else if (v.amendsVisitId || i.mis.mapping.some(x => x.source === 'notes'))
                selected = withheld('Correction history and cross-patient free-text privacy require their original wider workflow; this bounded preview builds no payload.');
            else {
                const mapping = mappingSchema.parse(i.mis.mapping);
                factsSchema.parse(v.facts);
                let payload;
                try {
                    payload = mappedPayload(i, v, s);
                }
                catch {
                    selected = withheld('Current original mapping, terminology, source or required field refuses this payload.');
                }
                if (payload) {
                    const why = operationRefusal(i, misOperation(payload), 'patient');
                    if (why)
                        selected = withheld('Current original destination operations refuse patient-level reuse.');
                    else {
                        const payloadHash = await digest(payload), excluded = MIS_FIELDS.filter(f => !mapping.some(x => x.source === f));
                        let originalPlan = null;
                        if (v.plan) {
                            try {
                                const plan = activePlan(s.workspace, v, v.plan.id), currentPayload = plan.payloads?.[i.id];
                                if (plan.state === 'blocked' || !plan.recipients.includes(i.id) || !currentPayload || await digest(currentPayload) !== payloadHash)
                                    throw Error('Stale stored payload.');
                                if (plan.payloadHash !== await digest({ visitId: v.id, version: v.version, facts: v.facts, programmeCapture: v.programmeCapture, recipients: plan.recipients, payloads: plan.payloads }))
                                    throw Error('Unbound original complete plan digest.');
                                const original = commandSchema.parse({ type: 'preparePlan', visitId: v.id, recipients: plan.recipients }), commandHash = await digest(original), matches = receipts.map(raw => receiptSchema.safeParse(raw)).flatMap(r => r.success ? [r.data] : []).filter(raw => raw.actor_id === actorId && raw.org_id === s.organisation.id && raw.person_id === id && raw.command_type === 'preparePlan' && raw.hash === commandHash && JSON.parse(raw.result)?.planId === plan.id);
                                if (matches.length !== 1)
                                    throw Error('Unavailable original prepare receipt.');
                                originalPlan = { id: plan.id, state: plan.state, receiptKey: matches[0].key, commandHash, comparison: 'matches-current-selected-payload' };
                            }
                            catch {
                                originalPlan = null;
                            }
                        }
                        const mappingDeadline = selectiveReuseMappingDeadline(i);
                        if (mappingDeadline && (!refreshAt || Date.parse(mappingDeadline) < Date.parse(refreshAt)))
                            refreshAt = mappingDeadline;
                        selected = { ...base, state: 'permitted-preview', reason: null, mapping, excluded, payload: payload, payloadHash, originalPlan };
                    }
                }
            }
        }
    }
    return selectiveReuseContext.parse({ organisationId: s.organisation.id, actorId, personId: id, refreshAt, visits: visits.map(v => ({ id: v.id, version: v.version, date: v.facts.date })), destinations, selected, readOnly: true });
}
