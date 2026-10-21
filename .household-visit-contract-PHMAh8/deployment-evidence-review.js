import { z } from 'zod';
import { digest, fail } from './core.js';
import { governanceSpec, governanceState, entryScope, entryIssues } from './governance.js';
import { providers, AGENT_VERSION, agentOutputSchema } from './agent.js';
import { CORPUS_VERSION, corpusFor, scoreEvaluation } from './evaluation.js';
import { deploymentAuthorisationIssues, deploymentState } from './deployment-authorisation.js';
const ref = z.string().trim().min(1).max(200);
const opaque = z.string().min(1);
const hash = z.string().regex(/^[0-9a-f]{64}$/);
const version = z.number().int().positive().safe();
const state = z.enum(['draft', 'reviewed', 'active', 'suspended', 'retired']);
const providerRecord = z.object({ id: ref, name: ref, mode: z.enum(['local', 'openai', 'http']), model: ref, version, available: z.boolean(), reason: z.string().min(1) }).strict();
const reviewRecord = z.object({ by: opaque, memberVersion: version, ownerVersion: version, authorVersion: version, at: z.string().datetime(), reference: ref, findings: z.string().min(1), dependencyStamp: z.string(), evaluationId: ref.optional() }).strict();
const resultRecord = z.object({ caseId: ref, state: z.enum(['running', 'completed', 'failed']), startedAt: z.string().datetime(), finishedAt: z.string().datetime().optional(), output: agentOutputSchema.optional(), error: z.string().optional(), usage: z.object({ inputTokens: z.number().int().nonnegative(), outputTokens: z.number().int().nonnegative() }).strict().optional(), latencyMs: z.number().nonnegative().optional() }).strict();
const evaluationRecord = z.object({ id: ref, entryId: ref, manifestHash: hash, corpusVersion: ref, corpusHash: hash, caseIds: z.array(ref).max(100), provider: providerRecord, agentVersion: ref, createdBy: opaque, memberVersion: version, createdAt: z.string().datetime(), state: z.enum(['pending', 'running', 'completed', 'cancelled']), version, results: z.array(resultRecord).max(100), metrics: z.unknown().optional() }).strict();
const score = z.object({ passed: z.boolean(), precision: z.number().min(0).max(1).nullable(), recall: z.number().min(0).max(1).nullable(), failed: z.number().int().nonnegative(), criticalFailures: z.number().int().nonnegative() }).strict();
const snapshot = providerRecord.pick({ id: true, name: true, mode: true, model: true, version: true });
const evidence = z.object({ id: ref, manifestHash: hash, provider: snapshot, agentVersion: ref, corpusVersion: ref, corpusHash: hash, caseCount: z.number().int().nonnegative(), state: evaluationRecord.shape.state, createdAt: z.string().datetime(), currentCorpus: z.boolean(), matchesManifest: z.boolean(), matchesCurrentProvider: z.boolean(), recomputed: score.nullable(), studySetting: z.literal('Hand-authored synthetic engineering examples; no representative clinical study.'), population: z.literal('Representative population, age distribution and clinical setting are not recorded by this evaluation contract.') }).strict();
const entry = z.object({ id: ref, key: ref, title: ref, revision: version, version, manifestHash: hash, providerId: ref, model: ref, agentVersion: ref, currentProvider: providerRecord.nullable(), intended: z.object({ ageMin: z.number(), ageMax: z.number(), languages: z.array(z.string()), settings: z.array(z.string()), roles: z.array(z.string()), teams: z.array(z.object({ id: ref, name: z.string() }).strict()), tasks: z.array(z.string()), devices: z.array(z.string()), purpose: z.literal('documentary-evidence'), excludedUses: z.string(), reviewBy: z.string(), effectiveFrom: z.string() }).strict(), evaluations: z.array(evidence), independentReview: reviewRecord.nullable(), recordedLocalState: state, localIssues: z.array(z.string()), localHistory: z.array(z.object({ at: z.string().datetime(), by: opaque, state: z.string(), reason: z.string() }).strict()), deploymentEvidence: z.object({ id: ref, by: opaque, at: z.string().datetime(), reference: ref, evaluationContext: z.string(), limitations: z.string() }).strict().nullable(), regulatoryDecision: z.object({ id: ref, by: opaque, at: z.string().datetime(), status: z.enum(['cleared', 'restricted', 'rejected']), reference: ref, reason: z.string() }).strict().nullable(), deploymentAuthorisation: z.object({ id: ref, by: opaque, at: z.string().datetime(), signedReference: ref, deploymentScope: z.string(), scopeHash: hash, expiresAt: z.string().datetime() }).strict().nullable(), regulatoryStatus: z.union([z.literal('not-recorded'), z.enum(['cleared', 'restricted', 'rejected'])]), signedDeploymentAuthorisation: z.union([z.literal('not-recorded'), z.literal('recorded')]), authorisationIssues: z.array(z.string()), clinicalAuthorised: z.boolean() }).strict();
export const deploymentEvidenceView = z.object({ actorId: opaque, organisationId: ref, organisationName: z.string().min(1), contextHash: hash, refreshAt: z.string().datetime().nullable(), entries: z.array(entry).max(150), clinicalDeployment: z.literal(false), readOnly: z.literal(true) }).strict();
export function deploymentEvidenceOrganisation(q) {
    if (q.size !== 1 || q.getAll('organisationId').length !== 1)
        throw Error('Choose one organisation.');
    return ref.parse(q.get('organisationId'));
}
export async function projectDeploymentEvidence(s, actorId, source, runtime, refreshAt, now = new Date().toISOString()) {
    const m = s.members.find(x => x.userId === actorId && x.status === 'active');
    if (!m?.isOwner || m.role !== 'clinician')
        fail(403, 'A current clinician organisation owner is required.');
    const g = governanceState(s);
    if (!Array.isArray(g.entries) || !Array.isArray(g.evaluations) || !Array.isArray(g.safety) || g.entries.length > 150 || g.evaluations.length > 100)
        fail(503, 'Current governance evidence is unavailable.');
    if (new Set(g.entries.map(x => x.id)).size !== g.entries.length || new Set(g.evaluations.map(x => x.id)).size !== g.evaluations.length)
        fail(503, 'Governance evidence identifiers are ambiguous.');
    const live = providers(s.workspace.integrations, runtime);
    const deployment = deploymentState(s);
    const rows = [];
    for (const stored of g.entries) {
        if (stored.spec?.kind !== 'capability' || !entryScope(m, stored))
            continue;
        const spec = governanceSpec.parse(stored.spec);
        if (spec.kind !== 'capability' || JSON.stringify(spec) !== JSON.stringify(stored.spec) || stored.manifestHash !== await digest(spec))
            fail(503, 'The immutable capability manifest is unavailable.');
        const p = live.find(x => x.id === spec.providerId) ?? null;
        const evaluations = [];
        for (const raw of g.evaluations.filter(x => x.entryId === stored.id)) {
            const ev = evaluationRecord.parse(raw);
            if (new Set(ev.caseIds).size !== ev.caseIds.length || new Set(ev.results.map(x => x.caseId)).size !== ev.results.length || ev.results.some(x => !ev.caseIds.includes(x.caseId)))
                fail(503, 'Evaluation cases are ambiguous.');
            const matchesManifest = ev.manifestHash === stored.manifestHash && ev.provider.id === spec.providerId && ev.provider.model === spec.model && ev.agentVersion === spec.agentVersion;
            const cases = corpusFor(spec.languages);
            const currentCorpus = matchesManifest && ev.corpusVersion === CORPUS_VERSION;
            let recomputed = null;
            if (currentCorpus) {
                if (ev.corpusHash !== await digest(cases) || JSON.stringify(ev.caseIds) !== JSON.stringify(cases.map(x => x.id)))
                    fail(503, 'The recorded synthetic corpus does not match its exact current definition.');
                if (ev.state === 'completed') {
                    if (ev.results.length !== cases.length || ev.results.some(x => x.state !== 'completed'))
                        fail(503, 'Completed evaluation is incomplete.');
                    const computed = scoreEvaluation(cases, ev.results);
                    if (JSON.stringify(ev.metrics) !== JSON.stringify(computed))
                        fail(503, 'Recorded evaluation metrics cannot be reproduced.');
                    recomputed = score.parse({ passed: computed.passed, precision: computed.precision, recall: computed.recall, failed: computed.failed, criticalFailures: computed.criticalFailures });
                }
            }
            evaluations.push({ id: ev.id, manifestHash: ev.manifestHash, provider: snapshot.parse({ id: ev.provider.id, name: ev.provider.name, mode: ev.provider.mode, model: ev.provider.model, version: ev.provider.version }), agentVersion: ev.agentVersion, corpusVersion: ev.corpusVersion, corpusHash: ev.corpusHash, caseCount: ev.caseIds.length, state: ev.state, createdAt: ev.createdAt, currentCorpus, matchesManifest, matchesCurrentProvider: !!p && p.id === ev.provider.id && p.model === ev.provider.model && p.version === ev.provider.version && p.mode === ev.provider.mode, recomputed, studySetting: 'Hand-authored synthetic engineering examples; no representative clinical study.', population: 'Representative population, age distribution and clinical setting are not recorded by this evaluation contract.' });
        }
        const signed = [...deployment.authorisations].reverse().find(x => x.entryId === stored.id && !x.withdrawn) ?? null;
        const deploymentEvidence = signed ? deployment.evidence.find(x => x.id === signed.evidenceId) ?? null : [...deployment.evidence].reverse().find(x => x.entryId === stored.id) ?? null;
        const regulatoryDecision = signed ? deployment.regulatory.find(x => x.id === signed.regulatoryDecisionId) ?? null : deploymentEvidence ? [...deployment.regulatory].reverse().find(x => x.entryId === stored.id && x.evidenceId === deploymentEvidence.id) ?? null : null;
        const authorisationIssues = deploymentAuthorisationIssues(s, stored.id, now);
        rows.push({ id: stored.id, key: spec.key, title: spec.title, revision: stored.revision, version: stored.version, manifestHash: stored.manifestHash, providerId: spec.providerId, model: spec.model, agentVersion: spec.agentVersion, currentProvider: p, intended: { ageMin: spec.ageMin, ageMax: spec.ageMax, languages: spec.languages, settings: spec.settings, roles: spec.roles, teams: spec.teamIds.map(id => ({ id, name: s.teams.find(x => x.id === id)?.name ?? 'Team unavailable' })), tasks: spec.tasks, devices: spec.devices, purpose: spec.purpose, excludedUses: spec.excludedUses, reviewBy: spec.reviewBy, effectiveFrom: spec.effectiveFrom }, evaluations, independentReview: stored.review ? reviewRecord.parse(stored.review) : null, recordedLocalState: stored.state, localIssues: entryIssues(s, stored, now), localHistory: stored.history, deploymentEvidence: deploymentEvidence ? { id: deploymentEvidence.id, by: deploymentEvidence.by, at: deploymentEvidence.at, reference: deploymentEvidence.reference, evaluationContext: deploymentEvidence.evaluationContext, limitations: deploymentEvidence.limitations } : null, regulatoryDecision: regulatoryDecision ? { id: regulatoryDecision.id, by: regulatoryDecision.by, at: regulatoryDecision.at, status: regulatoryDecision.status, reference: regulatoryDecision.reference, reason: regulatoryDecision.reason } : null, deploymentAuthorisation: signed ? { id: signed.id, by: signed.by, at: signed.at, signedReference: signed.signedReference, deploymentScope: signed.deploymentScope, scopeHash: signed.scopeHash, expiresAt: signed.expiresAt } : null, regulatoryStatus: regulatoryDecision?.status ?? 'not-recorded', signedDeploymentAuthorisation: signed ? 'recorded' : 'not-recorded', authorisationIssues, clinicalAuthorised: !authorisationIssues.length });
    }
    return deploymentEvidenceView.parse({ actorId, organisationId: s.organisation.id, organisationName: s.organisation.name, contextHash: await digest({ actorId, source, providers: live, agentVersion: AGENT_VERSION }), refreshAt, entries: rows, clinicalDeployment: false, readOnly: true });
}
