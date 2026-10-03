// Slice 11e: validate the UAT results register (docs/testing/uat/uat-results.csv, or the CSV named as the first argument).
//   node tests/uat/check-uat-register.mjs [path-to-register.csv]
// Static check of a CSV against the 364-case catalogue and the UAT scripts; no Worker, no network. A blank register passes.
// It cannot prove that a recorded result is true. It proves the record is complete enough to be a formal execution record
// (docs/current/07_Test-Strategy_v1.1.md): named executor, a different named reviewer, build, evidence, defect for a Fail.
import { suite } from '../lib/report.mjs';
import { abs, exists, readCsv, loadCatalogue, validateRegister, isFormal, REGISTER_COLUMNS, REGISTER_PATH, RESULTS } from '../lib/uat-data.mjs';
import { buildUatModel } from '../lib/uat-selection.mjs';

const path = process.argv[2] ?? REGISTER_PATH;
const r = suite('UAT register', abs('tests/reports/uat-register-result.json'), {
  layer: 'uat', environment: 'static check of a CSV file against docs/current/TEST-CATALOGUE.csv; no Worker',
  limits: [
    'Checks that each recorded row is complete and internally consistent; it cannot show that the recorded result is true or that the evidence exists.',
    'A person cannot be verified from a name: the check rejects placeholders, roles and tool or AI names, and a reviewer equal to the executor, nothing more.',
    'The blank register passes by design; a pass of this check says nothing about how much of the catalogue has been executed (see the counts in the report).',
  ],
});

const catalogue = loadCatalogue(), catalogueIds = new Set(catalogue.map(c => c.id));
const { selected } = await buildUatModel(), requiredIds = selected.map(s => s.tc.id);
let rows = [], header = [];
await r.check(`register file exists and parses: ${path}`, () => {
  if (!exists(path)) throw new Error(`${path} not found. Generate it with: node tests/uat/generate-uat-pack.mjs`);
  ({ header, rows } = readCsv(path));
});
await r.check('header is exactly the register columns, in order', () => {
  if (header.join(',') !== REGISTER_COLUMNS.join(',')) throw new Error(`expected ${REGISTER_COLUMNS.join(',')} but found ${header.join(',')}`);
});
const errors = validateRegister(rows, { catalogueIds, requiredIds });
const rule = (label, ...names) => r.check(label, () => {
  const bad = errors.filter(e => names.includes(e.rule));
  if (bad.length) throw new Error(`${bad.length} problem(s); first: ${bad.slice(0, 6).map(e => `line ${e.line} ${e.caseId} ${e.field}: ${e.message}`).join(' | ')}`);
});
await rule('every caseId exists in the catalogue and none is empty', 'caseId-unknown', 'caseId-empty');
await rule('no case appears twice', 'caseId-duplicate');
await rule('every case in the UAT scripts has a row', 'row-missing');
await rule(`result holds only ${RESULTS.join(' / ')} or is empty`, 'result-value');
await rule('a row with data in any field has a result', 'empty-with-data');
await rule('a Pass has executor, executedAt, build, environment, actualResult, evidence, reviewer and reviewedAt', 'pass-fields');
await rule('a reviewer is never the executor, and is a named person', 'reviewer-same', 'reviewer-invalid');
await rule('a Fail has a defect id (and executor, executedAt, build, environment, actualResult)', 'fail-fields');
await rule('a Blocked row has executor, executedAt and the reason', 'blocked-fields');
await rule('a Not run row carries no executor, evidence, defect or reviewer', 'not-run-fields');
await rule('dates are ISO dates and a review is not earlier than its execution', 'dates');

// The rules above must be able to fail. Each case below is a crafted register that breaks exactly one rule.
const good = { caseId: 'TC-BR-UX-01-A', build: 'daa1e40b', environment: 'hosted synthetic staging, Chrome 130', executor: 'Asha Verma', executedAt: '2026-10-12', result: 'Pass', actualResult: 'Opened My work and saw the grouped tasks', evidence: 'https://example.invalid/evidence/1.png sha256:ab', defect: '', reviewer: 'Ravi Menon', reviewedAt: '2026-10-13' };
const blank = Object.fromEntries(REGISTER_COLUMNS.map(c => [c, '']));
const probe = (rows) => validateRegister(rows, { catalogueIds, requiredIds: [] }).map(e => e.rule);
const expect = (label, rowsOrRow, wanted) => r.check(`self-test: ${label}`, () => {
  const got = probe(Array.isArray(rowsOrRow) ? rowsOrRow : [rowsOrRow]);
  if (wanted === null) { if (got.length) throw new Error(`expected no problem, got ${got}`); } else if (!got.includes(wanted)) throw new Error(`expected rule ${wanted}, got [${got}]`);
});
await expect('a complete Pass is accepted', good, null);
await expect('a complete Fail is accepted', { ...good, result: 'Fail', defect: '#123', evidence: '', reviewer: '', reviewedAt: '' }, null);
await expect('a Blocked row with a reason is accepted', { ...blank, caseId: 'TC-BR-ID-03-A', result: 'Blocked', executor: 'Asha Verma', executedAt: '2026-10-12', actualResult: 'No MFA or recovery screen exists' }, null);
await expect('a blank row is accepted', { ...blank, caseId: 'TC-BR-UX-01-A' }, null);
await expect('an unknown caseId is rejected', { ...good, caseId: 'TC-NOPE-1' }, 'caseId-unknown');
await expect('a duplicate caseId is rejected', [good, good], 'caseId-duplicate');
await expect('result "Passed" is rejected', { ...good, result: 'Passed' }, 'result-value');
await expect('result "pass" (wrong case) is rejected', { ...good, result: 'pass' }, 'result-value');
await expect('result "N/A" is rejected', { ...good, result: 'N/A' }, 'result-value');
for (const f of ['executor', 'executedAt', 'build', 'environment', 'actualResult', 'evidence', 'reviewer', 'reviewedAt']) await expect(`a Pass without ${f} is rejected`, { ...good, [f]: '' }, 'pass-fields');
await expect('a Pass whose reviewer is the executor is rejected', { ...good, reviewer: 'Asha Verma' }, 'reviewer-same');
await expect('the same name in different case and spacing is still the executor', { ...good, reviewer: '  asha   verma ' }, 'reviewer-same');
await expect('a Pass with a placeholder reviewer is rejected', { ...good, reviewer: 'TBD' }, 'pass-fields');
await expect('an AI tool as executor is rejected', { ...good, executor: 'Claude' }, 'pass-fields');
await expect('a role instead of a person as executor is rejected', { ...good, executor: 'tester' }, 'pass-fields');
await expect('a build that is not a commit hash is rejected', { ...good, build: 'latest' }, 'pass-fields');
await expect('a review earlier than the execution is rejected', { ...good, reviewedAt: '2026-10-11' }, 'dates');
await expect('a Fail without a defect id is rejected', { ...good, result: 'Fail', defect: '', evidence: '', reviewer: '', reviewedAt: '' }, 'fail-fields');
await expect('a Fail with a placeholder defect is rejected', { ...good, result: 'Fail', defect: 'n/a', evidence: '', reviewer: '', reviewedAt: '' }, 'fail-fields');
await expect('a Blocked row without a reason is rejected', { ...blank, caseId: 'TC-BR-ID-03-A', result: 'Blocked', executor: 'Asha Verma', executedAt: '2026-10-12' }, 'blocked-fields');
await expect('a Not run row with an executor is rejected', { ...blank, caseId: 'TC-BR-UX-01-A', result: 'Not run', executor: 'Asha Verma' }, 'not-run-fields');
await expect('a row with an executor but no result is rejected', { ...blank, caseId: 'TC-BR-UX-01-A', executor: 'Asha Verma' }, 'empty-with-data');
await r.check('self-test: a register missing a scripted case is rejected', () => { const e = validateRegister([], { catalogueIds, requiredIds: ['TC-BR-UX-01-A'] }); if (!e.some(x => x.rule === 'row-missing')) throw new Error('missing row not detected'); });
await r.check('self-test: isFormal counts a reviewed Pass and not an unreviewed one', () => {
  if (!isFormal(good)) throw new Error('reviewed Pass not formal');
  if (isFormal({ ...good, reviewer: '' }) || isFormal({ ...good, reviewer: good.executor }) || isFormal({ ...good, result: 'Blocked' })) throw new Error('unreviewed or blocked row counted as formal');
});

const count = k => rows.filter(x => x.result === k).length;
const summary = { register: path, rows: rows.length, scriptedCases: requiredIds.length, catalogueCases: catalogue.length, empty: rows.filter(x => !x.result).length, Pass: count('Pass'), Fail: count('Fail'), Blocked: count('Blocked'), NotRun: count('Not run'), formallyExecuted: rows.filter(isFormal).length };
console.log(`register: ${summary.rows} rows, ${summary.empty} empty, ${summary.Pass} Pass, ${summary.Fail} Fail, ${summary.Blocked} Blocked, ${summary.formallyExecuted} formally executed of ${summary.catalogueCases} catalogue cases`);
await r.finish({ register: summary });
