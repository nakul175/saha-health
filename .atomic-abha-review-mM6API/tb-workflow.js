import { own } from './programmes.js';
// Read-only projection. Referral need comes only from the current, governed protocol evaluation saved with the visit.
// Assistant output is deliberately excluded from every referral and unresolved-work predicate.
export function tbWorkflow(s, p) {
    const episode = (p.enrolments ?? []).find(e => e.packId === 'tb') ?? null, tbProtocols = new Set((s.governance?.entries ?? []).filter(e => e.spec.kind === 'protocol' && e.spec.programme === 'TB screening').map(e => e.id));
    const rows = s.workspace.visits.filter(v => v.personId === p.id && v.state === 'confirmed' && !v.voidedAt && !v.supersededBy && !v.imported && v.programmeCapture?.packs.some(x => x.pack.id === 'tb')).sort((a, b) => (b.confirmedAt ?? b.createdAt).localeCompare(a.confirmedAt ?? a.createdAt)).map(v => row(s, v, tbProtocols));
    return { localEpisode: episode ? { id: episode.id, state: episode.state, registration: episode.registration } : null, officialRegistrationNotice: 'A local screening episode, screening result or destination request is not a confirmed diagnosis or official TB programme registration.', rows, unresolved: rows.filter(x => x.testing.unresolved || x.protocol.required && !x.referral.recorded || x.protocol.unknowns.length > 0).length };
}
function row(s, v, tbProtocols) {
    const c = v.programmeCapture, answer = (id) => String(own(c.answers, id) ?? own(c.absence, id) ?? ''), checks = (v.protocolChecks ?? []).filter(x => x.protocols.some(p => tbProtocols.has(p.id))), check = checks.at(-1), findingLabels = check?.findings.filter(f => tbProtocols.has(f.entryId)).map(f => f.label) ?? [], checkId = check?.id ?? null;
    const refs = s.workspace.referrals.filter(r => r.visitId === v.id || (r.sources ?? []).some(x => x.kind === 'protocol-evaluation' && x.refId === checkId)), recorded = refs.length > 0, open = refs.some(r => !['completed', 'declined', 'cancelled'].includes(r.state));
    const testing = answer('testing');
    return { visitId: v.id, confirmedAt: v.confirmedAt ?? v.createdAt, symptoms: { cough: answer('cough'), coughDays: v.facts.coughDays }, testing: { value: testing, unresolved: testing !== 'Yes' }, protocol: { checkId, required: findingLabels.length > 0, findingLabels, unknowns: check?.unknowns ?? [] }, referral: { recorded, open }, assistance: { recorded: v.aiResults.length + (v.agentRuns?.length ?? 0), notice: 'Assistant output is documentary support only. It cannot clear a protocol finding, referral need, diagnosis or registration milestone.' } };
}
