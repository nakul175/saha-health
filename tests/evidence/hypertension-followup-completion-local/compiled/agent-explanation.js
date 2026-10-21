import { FIELD_LABEL } from './agent.js';
const invalid = (r, reason) => ({
    status: 'withheld',
    statement: 'No supported explanation is available. Continue with structured capture or the approved human review path.',
    evidence: [],
    uncertainty: [reason],
    source: {
        inputHash: r.inputHash,
        visitVersion: r.visitVersion,
        personVersion: r.personVersion,
        consentVersion: r.consentVersion,
    },
    method: {
        provider: r.provider.name,
        providerId: r.provider.id,
        mode: r.provider.mode,
        model: r.provider.model,
        providerVersion: r.provider.version,
        agentVersion: r.version,
    },
});
// Builds a reviewer-facing trace only from the validated, persisted run. It never asks a model
// to explain itself and never turns model confidence into clinical certainty or advice.
export function explainAgentRun(r) {
    if (!r.inputHash || !r.version || !r.provider.id || !r.provider.name || !r.provider.model || !Number.isInteger(r.provider.version) || r.provider.version < 1)
        return invalid(r, 'Source or capability version metadata is incomplete.');
    if (!Number.isInteger(r.visitVersion) || !Number.isInteger(r.personVersion) || !Number.isInteger(r.consentVersion))
        return invalid(r, 'The record lineage is incomplete.');
    if (r.assessment)
        return invalid(r, `${r.assessment.detail} ${r.assessment.retry} No result or clinical conclusion is claimed.`);
    if (!r.output)
        return invalid(r, 'The request has no confirmed output.');
    const rows = [
        ...r.output.proposals.map(p => ({
            kind: 'recorded-fact',
            label: FIELD_LABEL[p.field],
            claim: `${FIELD_LABEL[p.field]}: ${p.value}`,
            quote: p.quote,
            start: p.start,
            end: p.end,
        })),
        ...r.output.highlights.map((h, index) => ({
            kind: 'source-excerpt',
            label: `Source excerpt ${index + 1}`,
            claim: 'Exact source excerpt retained for reviewer interpretation',
            quote: h.quote,
            start: h.start,
            end: h.end,
        })),
    ];
    for (const row of rows) {
        if (row.start < 0 || row.end <= row.start || r.input.slice(row.start, row.end) !== row.quote)
            return invalid(r, 'Stored evidence no longer matches the bound source. The explanation is withheld.');
    }
    if (!rows.length)
        return invalid(r, 'No exact supporting fact, protocol result or approved model excerpt was recorded.');
    const uncertainty = [
        ...r.warnings,
        ...(r.conflicts?.map(c => `${FIELD_LABEL[c.field]} conflicts with ${c.kind === 'recorded' ? 'the recorded value' : 'another assistant result'}; reviewer choice is required.`) ?? []),
        'This trace identifies documentary evidence only. It is not a diagnosis, treatment recommendation or claim of certainty.',
    ];
    return {
        status: 'supported',
        statement: r.task === 'extract'
            ? 'Each proposed record value is linked to its exact submitted source and the capability version that produced it.'
            : 'Each displayed excerpt is linked to its exact submitted source and the capability version that produced it.',
        evidence: rows,
        uncertainty,
        source: {
            inputHash: r.inputHash,
            visitVersion: r.visitVersion,
            personVersion: r.personVersion,
            consentVersion: r.consentVersion,
        },
        method: {
            provider: r.provider.name,
            providerId: r.provider.id,
            mode: r.provider.mode,
            model: r.provider.model,
            providerVersion: r.provider.version,
            agentVersion: r.version,
        },
    };
}
