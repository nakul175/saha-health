import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(process.cwd(), '.agent-explanation-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
try {
  for (const file of ['agent-explanation', 'agent']) {
    let code = ts.transpileModule(readFileSync(`lib/saha/${file}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
    if (file === 'agent') code = `export const FIELD_LABEL={systolic:'Systolic BP · mmHg',diastolic:'Diastolic BP · mmHg',weight:'Weight · kg',temperature:'Temperature · °C',weeks:'Gestational age · weeks',coughDays:'Cough duration · days'};`;
    else code = code.replace("from './agent'", "from './agent.js'");
    writeFileSync(join(dir, `${file}.js`), code);
  }
  const { explainAgentRun } = await import(pathToFileURL(join(dir, 'agent-explanation.js')));
  const input = 'Weight 58 kg; patient reports feeling well.';
  const base = {
    id: 'run-1', task: 'extract', status: 'review', actorId: 'worker', createdAt: '2026-10-16T00:00:00Z', expiresAt: '2026-10-17T00:00:00Z',
    version: 'saha-agent-1.2.0', provider: { id: 'local', name: 'Local record assistant', mode: 'local', model: 'structured-parser-v2', version: 2, available: true, reason: 'Local' },
    visitVersion: 7, personVersion: 4, consentVersion: 3, inputHash: 'sha256:fixture', input, warnings: [], message: 'Review', callCount: 1, steps: [],
    output: { proposals: [{ field: 'weight', value: '58', quote: 'Weight 58 kg', start: 0, end: 12 }], highlights: [{ quote: 'patient reports feeling well', start: 14, end: 42 }] },
  };
  const supported = explainAgentRun(base);
  check(() => assert.equal(supported.status, 'supported'));
  check(() => assert.deepEqual(supported.evidence.map(e => [e.kind, e.quote]), [['recorded-fact', 'Weight 58 kg'], ['source-excerpt', 'patient reports feeling well']]));
  check(() => assert.deepEqual(supported.source, { inputHash: 'sha256:fixture', visitVersion: 7, personVersion: 4, consentVersion: 3 }));
  check(() => assert.deepEqual(supported.method, { provider: 'Local record assistant', providerId: 'local', mode: 'local', model: 'structured-parser-v2', providerVersion: 2, agentVersion: 'saha-agent-1.2.0' }));
  check(() => assert.match(supported.uncertainty.at(-1), /not a diagnosis, treatment recommendation or claim of certainty/));
  const conflicting = explainAgentRun({ ...base, warnings: ['Conflicting value withheld.'], conflicts: [{ field: 'weight', kind: 'recorded', proposed: '58', other: '60' }] });
  check(() => assert.ok(conflicting.uncertainty.some(x => /reviewer choice is required/.test(x))));
  const badQuote = explainAgentRun({ ...base, output: { proposals: [{ ...base.output.proposals[0], start: 1 }], highlights: [] } });
  check(() => assert.equal(badQuote.status, 'withheld'));
  check(() => assert.match(badQuote.uncertainty[0], /no longer matches/));
  const unable = explainAgentRun({ ...base, assessment: { status: 'unable_to_assess', reason: 'unsupported_case', detail: 'Unsupported clinical question.', retry: 'Use the approved human review path.' }, output: { proposals: [], highlights: [] } });
  check(() => assert.equal(unable.status, 'withheld'));
  check(() => assert.match(unable.uncertainty[0], /No result or clinical conclusion is claimed/));
  for (const patch of [
    { inputHash: '' }, { version: '' }, { provider: { ...base.provider, id: '' } }, { provider: { ...base.provider, model: '' } }, { provider: { ...base.provider, version: 0.5 } }, { provider: { ...base.provider, version: 0 } },
  ]) check(() => assert.equal(explainAgentRun({ ...base, ...patch }).status, 'withheld'));
  check(() => assert.equal(explainAgentRun({ ...base, visitVersion: 1.5 }).status, 'withheld'));
  check(() => assert.equal(explainAgentRun({ ...base, personVersion: 1.5 }).status, 'withheld'));
  check(() => assert.equal(explainAgentRun({ ...base, consentVersion: 1.5 }).status, 'withheld'));
  check(() => assert.equal(explainAgentRun({ ...base, output: undefined }).status, 'withheld'));
  check(() => assert.equal(explainAgentRun({ ...base, output: { proposals: [], highlights: [] } }).status, 'withheld'));
  const sourceOnly = explainAgentRun({ ...base, task: 'summary', output: { proposals: [], highlights: [{ quote: 'Weight 58 kg', start: 0, end: 12 }] } });
  check(() => assert.equal(sourceOnly.status, 'supported'));
  check(() => assert.match(sourceOnly.statement, /displayed excerpt/));
  check(() => assert.doesNotMatch(JSON.stringify(sourceOnly), /diagnose|prescribe/i));
  const panel = readFileSync('app/agent-panel.tsx', 'utf8');
  for (const label of ['Evidence behind this output', 'Explanation withheld', 'Source digest', 'Record lineage', 'Provider / model', 'Agent contract']) check(() => assert.ok(panel.includes(label), label));
  writeFileSync('tests/agent-explanation-contract-result.json', JSON.stringify({ passed, suite: 'SAHA-048 evidence behind explanations', liveProviderTested: false, completedAt: new Date().toISOString() }, null, 2) + '\n');
  console.log(JSON.stringify({ passed }));
} finally { rmSync(dir, { recursive: true, force: true }); }
