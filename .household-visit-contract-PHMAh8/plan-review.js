import { z } from 'zod';
const id = z.string().min(1).max(120);
const version = z.number().int().positive();
const facts = z.object({ date: z.string(), systolic: z.string(), diastolic: z.string(), weight: z.string(), temperature: z.string(), weeks: z.string(), coughDays: z.string(), notes: z.string(), source: z.enum(['measured', 'reported']) }).passthrough();
const destination = z.object({ id, name: z.string().min(1), description: z.string().min(1).max(500), version, mode: z.enum(['demo', 'http']) }).strict();
const plan = z.object({ id, payloadHash: z.string().regex(/^[a-f0-9]{64}$/), state: z.enum(['proposed', 'approved', 'completed', 'blocked']), purpose: z.string().min(1), visitVersion: version, personVersion: version, consentVersion: version, recipients: z.array(id).min(1).max(10), connectorVersions: z.record(version), createdAt: z.string().datetime(), expiresAt: z.string().datetime().optional(), approvedById: id.optional(), payloads: z.record(z.record(z.unknown())).optional() }).strict();
export const reviewSchema = z.object({ organisationId: id, person: z.object({ id, name: z.string().min(1), version, consentVersion: version }).strict(), visits: z.array(z.object({ id, date: z.string(), version }).strict()), selected: z.object({ id, version, recordVersion: version, facts, programmeCapture: z.record(z.unknown()).optional(), destinations: z.array(destination), plan: plan.nullable(), stale: z.string().nullable() }).strict().nullable() }).strict().superRefine((r, c) => {
    const s = r.selected;
    if (new Set(r.visits.map(v => v.id)).size !== r.visits.length)
        c.addIssue({ code: 'custom', message: 'Duplicate visits.' });
    if (!s)
        return;
    if (!r.visits.some(v => v.id === s.id && v.version === s.version))
        c.addIssue({ code: 'custom', message: 'Selected visit is not current.' });
    if (new Set(s.destinations.map(d => d.id)).size !== s.destinations.length)
        c.addIssue({ code: 'custom', message: 'Duplicate destinations.' });
    if (!s.plan)
        return;
    if (new Set(s.plan.recipients).size !== s.plan.recipients.length || s.plan.recipients.some(x => !s.destinations.some(d => d.id === x)))
        c.addIssue({ code: 'custom', message: 'Unresolved reviewed destination.' });
    if (!s.stale && (s.plan.visitVersion !== s.version || s.plan.personVersion !== r.person.version || s.plan.consentVersion !== r.person.consentVersion || s.plan.recipients.some(x => s.plan?.connectorVersions[x] !== s.destinations.find(d => d.id === x)?.version)))
        c.addIssue({ code: 'custom', message: 'Review versions changed.' });
    if (s.plan.state === 'approved' && (!s.plan.expiresAt || !s.plan.approvedById))
        c.addIssue({ code: 'custom', message: 'Approval binding unavailable.' });
});
export const reviewResponse = z.object({ result: z.record(z.unknown()).optional(), replayed: z.boolean(), context: reviewSchema }).strict();
export const reviewOperation = z.object({ personId: id, command: z.discriminatedUnion('type', [z.object({ type: z.literal('preparePlan'), visitId: id, recipients: z.array(id).min(1).max(10) }).strict(), z.object({ type: z.literal('approvePlan'), visitId: id, planId: id, payloadHash: z.string().regex(/^[a-f0-9]{64}$/) }).strict()]) }).strict();
// Projection has no endpoint, credential binding, other person's visit or whole workspace.
export function reviewProjection(organisationId, person, visits, integrations, selected, stale = null) {
    const eligible = visits.filter(v => v.personId === person.id && v.state === 'confirmed' && !v.imported && !v.voidedAt && !v.supersededBy);
    const v = selected ? eligible.find(x => x.id === selected) : undefined;
    if (selected && !v)
        throw new Error('Choose a current original confirmed visit.');
    const destinations = integrations.filter(i => i.kind === 'mis' && i.status === 'active' && i.programmes.some(p => person.programmes.includes(p))).map(i => ({ id: i.id, name: i.name, description: i.description, version: i.version, mode: i.mode }));
    const p = v?.plan;
    return reviewSchema.parse({ organisationId, person: { id: person.id, name: person.name, version: person.version, consentVersion: person.consentVersion }, visits: eligible.map(x => ({ id: x.id, date: x.facts.date, version: x.version })), selected: v ? { id: v.id, version: v.version, recordVersion: v.recordVersion, facts: structuredClone(v.facts), ...(v.programmeCapture ? { programmeCapture: structuredClone(v.programmeCapture) } : {}), destinations, plan: p ? { id: p.id, payloadHash: p.payloadHash, state: p.state, purpose: p.purpose, visitVersion: p.visitVersion, personVersion: p.personVersion, consentVersion: p.consentVersion, recipients: [...p.recipients], connectorVersions: { ...p.connectorVersions }, createdAt: p.createdAt, ...(p.expiresAt ? { expiresAt: p.expiresAt } : {}), ...(p.approvedById ? { approvedById: p.approvedById } : {}), ...(p.payloads ? { payloads: structuredClone(p.payloads) } : {}) } : null, stale } : null });
}
export function sameRecipients(a, b) { return a.length === b.length && [...a].sort().every((id, i) => id === [...b].sort()[i]); }
export function canApprove(r, selected, affirmed, actor, now = Date.now()) {
    const s = r.selected, p = s?.plan;
    return Boolean(actor && affirmed && s && p && !s.stale && p.state === 'proposed' && sameRecipients(selected, p.recipients) && Number.isFinite(now));
}
