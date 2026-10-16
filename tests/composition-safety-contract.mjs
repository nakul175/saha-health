import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const dir = mkdtempSync(join(process.cwd(), '.composition-safety-contract-'));
for (const name of ['abdm', 'abdm-transfer', 'access', 'action-plan', 'adapter-operations', 'agent', 'agent-minimisation', 'ai-budget', 'alerts', 'anaemia', 'audit-chain', 'capability-lifecycle', 'caseload', 'consent', 'continuity', 'core', 'delegation', 'ehr', 'environment', 'evaluation', 'exceptional', 'expansion', 'facility-scope', 'fact-provenance', 'fhir-document', 'fhir-validate', 'field', 'field-registration', 'governance', 'household', 'household-constants', 'household-visit', 'household-visit-constants', 'identity', 'imported-visits', 'media', 'merge', 'mis', 'operations', 'outreach', 'pack-installation', 'partition', 'pilot', 'programme-commands', 'programmes', 'provider-sandbox', 'purpose-scope', 'referral-needs', 'referral-request', 'referral-rules', 'retention', 'rights', 'seed', 'send-gate', 'service-identity', 'shadow', 'store', 'task-limits', 'types', 'composition-safety']) {
  writeFileSync(join(dir, `${name}.js`), ts.transpileModule(readFileSync(`lib/saha/${name}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
}
const C = await import(pathToFileURL(join(dir, 'composition-safety.js')));
const clinician = (id, version = 1) => ({ userId: id, role: 'clinician', status: 'active', version, teamIds: ['team-a'] });
const hash = c => c.repeat(64);
const base = {
  key: 'joint-document-review', title: 'Joint documentary review', teamIds: ['team-a'],
  intendedUse: 'Use two documentary tools to prepare one review candidate for a clinician.',
  permittedData: ['visit-notes', 'current-weight'],
  tools: [
    { capabilityId: 'extractor', capabilityVersion: 2, manifestHash: hash('a') },
    { capabilityId: 'summariser', capabilityVersion: 4, manifestHash: hash('b') },
  ],
  interactionReview: 'Outputs remain separate until the reviewed workflow checks provenance and compatibility.',
  missingInputRules: [{ input: 'current-weight', response: 'Return unable to assess and request a current measured weight.' }],
  disagreementRule: 'Show both source outputs and require a clinician decision without averaging or inventing consensus.',
  conflictScenarios: [{ id: 'conflict-1', description: 'Tools return incompatible values for the same field.', expected: 'No joint recommendation becomes available until a clinician resolves the disagreement.', passed: true }],
};
const capabilities = [
  { id: 'extractor', version: 2, manifestHash: hash('a'), state: 'active' },
  { id: 'summariser', version: 4, manifestHash: hash('b'), state: 'active' },
];
let passed = 0;
const ok = async fn => { await fn(); passed++; };
const rejects = async (fn, status) => { await assert.rejects(fn, error => error?.status === status); passed++; };

const author = clinician('author');
const reviewer = clinician('reviewer');
const draft = await C.createCompositionReview(base, author, '2026-10-16T00:00:00.000Z');
await ok(async () => assert.equal(draft.state, 'draft'));
await rejects(() => C.compositionDecision(draft, capabilities, { 'visit-notes': 'Synthetic note' }, reviewer), 409);
await rejects(async () => C.reviewComposition(structuredClone(draft), 1, author, 'REF-1', 'Author attempted self review.'), 403);
const failed = await C.createCompositionReview({ ...base, conflictScenarios: [{ ...base.conflictScenarios[0], passed: false }] }, author);
await rejects(async () => C.reviewComposition(failed, 1, reviewer, 'REF-2', 'Conflict remains unresolved.'), 409);
C.reviewComposition(draft, 1, reviewer, 'REF-3', 'All synthetic interaction and disagreement scenarios passed.');
await ok(async () => assert.equal(draft.state, 'reviewed'));
await ok(async () => assert.equal((await C.compositionDecision(draft, capabilities, { 'visit-notes': 'Synthetic note' }, reviewer)).available, true));
await rejects(() => C.compositionDecision(draft, [{ ...capabilities[0], version: 3 }, capabilities[1]], { 'visit-notes': 'Synthetic note' }, reviewer), 409);
await rejects(() => C.compositionDecision(draft, capabilities, { 'visit-notes': 'Synthetic note' }, clinician('outsider')), 409);
const raced = structuredClone(draft);
await rejects(async () => C.suspendComposition(raced, 1), 409);
C.suspendComposition(raced, 2);
await rejects(() => C.compositionDecision(raced, capabilities, { 'visit-notes': 'Synthetic note' }, reviewer), 409);
const noRule = await C.createCompositionReview({ ...base, permittedData: ['visit-notes', 'temperature'] }, author);
C.reviewComposition(noRule, 1, reviewer, 'REF-4', 'The declared conflict scenario passed for the exact manifest.');
await rejects(() => C.compositionDecision(noRule, capabilities, { 'visit-notes': 'Synthetic note' }, reviewer), 409);

console.log(JSON.stringify({ story: 'SAHA-070', passed, failed: 0 }, null, 2));
