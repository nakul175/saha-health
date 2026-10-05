// Slice 11a: checks of the test runner itself (scripts/test.mjs, scripts/test-catalogue.mjs, scripts/test-guard.mjs).
// A runner that silently drops a suite, mis-reads a result or leaves stray files would make every later result suspect, so
// this suite builds throw-away repositories with known suites and checks what the real runner reports about them.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { suite } from './lib/report.mjs';
import { buildCatalogue, classify, listTestFiles } from '../scripts/test-catalogue.mjs';
import { countsFromOutput, countsFromReport, decideStatus, evaluateGuard, nextBaseline } from '../scripts/test-guard.mjs';

const r = suite('Test runner, catalogue and regression guard (slice 11a)', 'tests/evidence/programme-own-cold-review/runner/runner-current.json', {
  layer: 'unit', environment: 'throw-away git repositories under the system temporary directory; no Worker, no network',
  limits: ['Exercises the runner on small fixture suites; it does not run the real product suites (the integration layer does).', 'GitHub Actions behaviour of the new workflows is not covered.'],
});
const made = [];
const tmp = () => { const d = mkdtempSync(join(tmpdir(), 'saha-runner-')); made.push(d); return d; };
const put = (root, file, text = '') => { mkdirSync(dirname(join(root, file)), { recursive: true }); writeFileSync(join(root, file), text); };
/** The named files the catalogue insists on, so a fixture only has to add what a case is about. */
const baseline = root => {
  for (const {file} of buildCatalogue(process.cwd()).suites.filter(s => s.layer === 'manual' && !s.file.startsWith('tests/smoke/'))) put(root, file, '// registered manual-suite fixture\n');
  for (const f of ['tests/nfr/memory-profile.mjs', 'tests/nfr/memory-profile-ledger.mjs', 'tests/app-first-browser.mjs', 'tests/run-api-smoke.mjs', 'tests/recovery-drill.mjs', 'tests/a11y-audit.mjs', 'tests/load-envelope.mjs', 'tests/adapter-overhead-bench.mjs', 'tests/run-anaemia-http.mjs', 'tests/anaemia-ui.cjs', 'tests/anaemia-connected-worker.mjs', 'tests/anaemia-hosted-connection.mjs']) put(root, f, '// stub\n');
  put(root, 'tests/api-smoke.mjs', "await import('./one-smoke.mjs');\n"); put(root, 'tests/one-smoke.mjs', '// component\n');
};
const errorsOf = root => buildCatalogue(root).errors;

try {
  // ----- classification rules -----
  await r.check('every rule from the brief classifies to exactly one layer', () => {
    const want = {
      'tests/alerts-contract.mjs': ['unit', 'suite'], 'tests/field-units-client.mjs': ['unit', 'suite'], 'tests/field-shell.mjs': ['unit', 'suite'],
      'tests/ehr-execution.mjs': ['unit', 'suite'], 'tests/mis-delivery.mjs': ['unit', 'suite'],
      'tests/run-api-smoke.mjs': ['integration', 'suite'], 'tests/scheduled-local-check.mjs': ['integration', 'suite'], 'tests/api-smoke.mjs': ['integration', 'support'],
      'tests/governance-smoke.mjs': ['integration', 'component'], 'tests/recovery-drill.mjs': ['resilience', 'suite'],
      'tests/smoke/local.mjs': ['smoke', 'suite'], 'tests/nfr/budget.mjs': ['nfr', 'suite'], 'tests/uat/scripts.mjs': ['uat', 'suite'], 'tests/ui/walk.mjs': ['ui', 'suite'],
      'tests/ui/playwright.config.mjs': ['ui', 'suite'], 'tests/ui/screens/login.spec.ts': ['ui', 'component'],
      'tests/a11y-audit.mjs': ['manual', 'suite'], 'tests/load-envelope.mjs': ['manual', 'suite'], 'tests/adapter-overhead-bench.mjs': ['manual', 'suite'],
    };
    for (const [file, [layer, role]] of Object.entries(want)) { const c = classify(file); assert.ok(c, file); assert.equal(c.layer, layer, file); assert.equal(c.role, role, file); }
  });
  await r.check('files that match no rule are unclassified, support files are not suites', () => {
    for (const f of ['tests/stray.mjs', 'tests/other/x.mjs', 'tests/smoke/nested/x.mjs', 'tests/nfr/helper.ts']) assert.equal(classify(f), null, f);
    for (const f of ['tests/lib/worker.mjs', 'tests/smoke/lib/h.mjs', 'tests/ui/pages/login.ts', 'tests/uat/_shared.mjs', 'tests/database-fixtures.mjs']) assert.equal(classify(f).role, 'support', f);
  });
  await r.check('the repository catalogue is complete: no errors, every file classified, at least the 105 suites the CI contract loop ran', () => {
    const cat = buildCatalogue(process.cwd());
    assert.deepEqual(cat.errors, []);
    const files = listTestFiles(process.cwd());
    assert.equal(cat.entries.length, files.length, 'every file is classified');
    const unit = cat.suites.filter(s => s.layer === 'unit');
    assert.ok(unit.length >= 105, `unit suites ${unit.length}`);
    // Playwright specs (tests/ui/*.spec.*) are components of the UI configuration; the rest are the HTTP suite's modules.
    assert.equal(cat.components.filter(c => !c.file.startsWith('tests/ui/')).length, files.filter(f => /^tests\/[^/]+-smoke\.mjs$/.test(f) && !['tests/api-smoke.mjs', 'tests/run-api-smoke.mjs', 'tests/workspace-metadata-smoke.mjs'].includes(f)).length);
    assert.ok(cat.suites.some(s => s.id === 'integration/run-api-smoke' && s.results.includes('tests/latest-result.json')), 'the HTTP suite result file is found in its entry module');
    assert.ok(cat.suites.find(s => s.id === 'resilience/recovery-drill').results.includes('tests/recovery-result.json'));
    assert.equal(new Set(cat.suites.map(s => s.id)).size, cat.suites.length, 'suite ids are unique');
  });
  await r.check('the repository catalogue ties tests to requirements through the evidence map', () => {
    const cat = buildCatalogue(process.cwd()), api = cat.suites.find(s => s.id === 'integration/run-api-smoke');
    assert.ok(api.requirements.length > 50, `${api.requirements.length} requirements cite the HTTP suite or its components`);
    assert.ok(api.requirements.every(id => /^(BR-[A-Z]+-\d+|NFR-\d+)$/.test(id)));
  });

  // ----- catalogue errors -----
  await r.check('an unclassified test file fails the catalogue', () => {
    const d = tmp(); baseline(d); put(d, 'tests/stray.mjs');
    assert.deepEqual(errorsOf(d).map(e => e.split(':')[0]), ['Unclassified test file']);
    assert.match(errorsOf(d)[0], /tests\/stray\.mjs/);
  });
  await r.check('a *-smoke.mjs module that tests/api-smoke.mjs does not import fails the catalogue', () => {
    const d = tmp(); baseline(d); put(d, 'tests/orphan-smoke.mjs');
    const e = errorsOf(d); assert.equal(e.length, 1); assert.match(e[0], /orphan-smoke\.mjs is not imported by tests\/api-smoke\.mjs/);
  });
  await r.check('an import of a module that does not exist, and a missing entry file, fail the catalogue', () => {
    const d = tmp(); baseline(d); put(d, 'tests/api-smoke.mjs', "await import('./one-smoke.mjs');await import('./ghost-smoke.mjs');\n");
    assert.match(errorsOf(d).join('\n'), /imports tests\/ghost-smoke\.mjs, which does not exist/);
    const e = tmp(); baseline(e); rmSync(join(e, 'tests/recovery-drill.mjs'));
    assert.match(errorsOf(e).join('\n'), /recovery-drill\.mjs is a named suite but does not exist/);
  });
  await r.check('new layer directories are discovered when they appear and their support folders are not suites', () => {
    const d = tmp(); baseline(d);
    assert.equal(buildCatalogue(d).suites.filter(s => s.layer === 'smoke').length, 0);
    put(d, 'tests/smoke/local.mjs'); put(d, 'tests/smoke/lib/helper.mjs'); put(d, 'tests/nfr/budget.mjs'); put(d, 'tests/uat/generate.mjs'); put(d, 'tests/ui/walk.mjs');
    const cat = buildCatalogue(d); assert.deepEqual(cat.errors, []);
    assert.deepEqual(cat.suites.filter(s => ['smoke', 'nfr', 'uat', 'ui'].includes(s.layer)).map(s => s.id).sort(), ['nfr/budget', 'smoke/local', 'uat/generate', 'ui/walk']);
    assert.ok(cat.suites.find(s => s.id === 'smoke/local').needs.includes('build') && cat.suites.find(s => s.id === 'uat/generate').needs.length === 0);
  });
  await r.check('Playwright specs need a configuration', () => {
    const d = tmp(); baseline(d); put(d, 'tests/ui/login.spec.ts');
    assert.match(errorsOf(d).join('\n'), /no tests\/ui\/playwright\.config/);
    put(d, 'tests/ui/playwright.config.mjs'); assert.deepEqual(errorsOf(d), []);
    assert.equal(buildCatalogue(d).suites.find(s => s.id === 'ui/playwright.config').runner, 'playwright');
  });
  await r.check('requirement ids come from the evidence map the way the audit resolves them (exact id, else group key)', () => {
    const d = tmp(); baseline(d); put(d, 'tests/x-contract.mjs'); put(d, 'tests/y-contract.mjs');
    put(d, 'requirements/brd-v1.1.json', JSON.stringify({ requirements: [{ id: 'BR-UX-01' }, { id: 'BR-UX-02' }, { id: 'NFR-01' }] }));
    put(d, 'requirements/evidence-map.json', JSON.stringify({ 'BR-UX': ['tests/x-contract.mjs'], 'BR-UX-02': ['tests/y-contract.mjs'], 'NFR-01': ['tests/x-contract.mjs'] }));
    const cat = buildCatalogue(d), by = id => cat.suites.find(s => s.id === id).requirements;
    assert.deepEqual(by('unit/x-contract'), ['BR-UX-01', 'NFR-01']);
    assert.deepEqual(by('unit/y-contract'), ['BR-UX-02']);
  });

  // ----- results, status, guard -----
  await r.check('counts are read from the existing result files, the report library, Playwright and the last JSON line of output', () => {
    assert.deepEqual(countsFromReport({ passed: 23, completedAt: 'x' }), { passed: 23, failed: null, skipped: null });
    assert.deepEqual(countsFromReport({ suite: 's', passed: 4, failed: 1, skipped: 2, checks: [] }), { passed: 4, failed: 1, skipped: 2 });
    assert.deepEqual(countsFromReport({ stats: { expected: 7, unexpected: 1, flaky: 1, skipped: 2 } }), { passed: 7, failed: 2, skipped: 2, flaky: 1 }, 'slice 11g: a test that passed only on retry is counted as failed and named flaky');
    assert.equal(countsFromReport({ requests: 5 }), null); assert.equal(countsFromReport(null), null); assert.equal(countsFromReport({ passed: '12' }), null);
    assert.deepEqual(countsFromOutput('noise\n{"suite":"s","passed":9,"failed":0}\n'), { passed: 9, failed: 0, skipped: null });
    assert.equal(countsFromOutput('no json here\n{broken'), null);
  });
  await r.check('status: a non-zero exit, a reported failure, a timeout and a suite that checks nothing all fail; an all-skipped suite is skipped, not passed', () => {
    assert.equal(decideStatus(0, { passed: 5, failed: 0, skipped: 0 }).status, 'passed');
    assert.equal(decideStatus(0, null).status, 'passed');
    assert.equal(decideStatus(1, { passed: 5, failed: 0, skipped: 0 }).status, 'failed');
    assert.equal(decideStatus(0, { passed: 5, failed: 1, skipped: 0 }).status, 'failed');
    assert.equal(decideStatus(0, { passed: 0, failed: null, skipped: null }).status, 'failed');
    assert.equal(decideStatus(0, { passed: 0, failed: 0, skipped: 3 }).status, 'skipped');
    assert.equal(decideStatus(0, { passed: 5, failed: 0, skipped: 0 }, { timedOut: true }).status, 'failed');
  });
  const guardInput = (over = {}) => ({
    baseline: { suites: { 'unit/a': { layer: 'unit', file: 'tests/a-contract.mjs', minPassed: 10 }, 'unit/b': { layer: 'unit', file: 'tests/b-contract.mjs', minPassed: 5 }, 'smoke/s': { layer: 'smoke', file: 'tests/smoke/s.mjs', minPassed: null } } },
    quarantine: { suites: {} }, results: new Map([['unit/a', { status: 'passed', passed: 10 }], ['unit/b', { status: 'passed', passed: 6 }], ['smoke/s', { status: 'passed', passed: 1 }]]),
    catalogueIds: new Set(['unit/a', 'unit/b', 'smoke/s']), planned: new Set(['unit/a', 'unit/b', 'smoke/s']), today: '2026-10-03', ...over,
  });
  await r.check('guard: equal or higher counts pass; a drop of one assertion fails and names the suite', () => {
    assert.equal(evaluateGuard(guardInput()).ok, true);
    const g = evaluateGuard(guardInput({ results: new Map([['unit/a', { status: 'passed', passed: 9 }], ['unit/b', { status: 'passed', passed: 6 }], ['smoke/s', { status: 'passed', passed: 1 }]]) }));
    assert.equal(g.ok, false); assert.deepEqual(g.findings.map(f => [f.id, f.kind]), [['unit/a', 'dropped']]); assert.match(g.findings[0].message, /passed 9.*baseline is 10/);
  });
  await r.check('guard: a suite that disappeared from the catalogue, did not report, or reported no count fails', () => {
    const gone = evaluateGuard(guardInput({ catalogueIds: new Set(['unit/b', 'smoke/s']), planned: new Set(['unit/b', 'smoke/s']), results: new Map([['unit/b', { status: 'passed', passed: 6 }], ['smoke/s', { status: 'passed', passed: 1 }]]) }));
    assert.deepEqual(gone.findings.map(f => [f.id, f.kind]), [['unit/a', 'disappeared']]);
    const silent = evaluateGuard(guardInput({ results: new Map([['unit/b', { status: 'passed', passed: 6 }], ['smoke/s', { status: 'passed', passed: 1 }]]) }));
    assert.deepEqual(silent.findings.map(f => [f.id, f.kind]), [['unit/a', 'missing']]);
    const blocked = evaluateGuard(guardInput({ results: new Map([['unit/a', { status: 'blocked', passed: null }], ['unit/b', { status: 'passed', passed: 6 }], ['smoke/s', { status: 'passed', passed: 1 }]]) }));
    assert.deepEqual(blocked.findings.map(f => f.kind), ['missing']);
    const uncounted = evaluateGuard(guardInput({ results: new Map([['unit/a', { status: 'passed', passed: null }], ['unit/b', { status: 'passed', passed: 6 }], ['smoke/s', { status: 'passed', passed: 1 }]]) }));
    assert.deepEqual(uncounted.findings.map(f => f.kind), ['uncounted']);
  });
  await r.check('guard: suites outside this run are not evaluated; an existence-only baseline fails only when the suite fails or goes', () => {
    const g = evaluateGuard(guardInput({ planned: new Set(['unit/b']), results: new Map([['unit/b', { status: 'passed', passed: 6 }]]) }));
    assert.equal(g.ok, true); assert.equal(g.evaluated, 1);
    const f = evaluateGuard(guardInput({ results: new Map([['unit/a', { status: 'passed', passed: 10 }], ['unit/b', { status: 'passed', passed: 6 }], ['smoke/s', { status: 'failed', passed: 0 }]]) }));
    assert.deepEqual(f.findings.map(x => [x.id, x.kind]), [['smoke/s', 'failed']]);
  });
  await r.check('guard: quarantine excuses a drop only with a reason and a date; stale entries warn; new suites are reported', () => {
    const drop = new Map([['unit/a', { status: 'passed', passed: 3 }], ['unit/b', { status: 'passed', passed: 6 }], ['smoke/s', { status: 'passed', passed: 1 }], ['unit/new', { status: 'passed', passed: 2 }]]);
    const ok = evaluateGuard(guardInput({ results: drop, quarantine: { suites: { 'unit/a': { reason: 'flaky fixture, issue 12', date: '2026-10-01' } } } }));
    assert.equal(ok.ok, true); assert.equal(ok.findings[0].excused, true); assert.deepEqual(ok.newSuites, ['unit/new']);
    const noDate = evaluateGuard(guardInput({ results: drop, quarantine: { suites: { 'unit/a': { reason: 'flaky' } } } }));
    assert.equal(noDate.ok, false); assert.ok(noDate.findings.some(f => f.kind === 'bad-quarantine'));
    const noReason = evaluateGuard(guardInput({ results: drop, quarantine: { suites: { 'unit/a': { date: '2026-10-01' } } } }));
    assert.equal(noReason.ok, false);
    const stale = evaluateGuard(guardInput({ quarantine: { suites: { 'unit/a': { reason: 'old', date: '2026-08-01' } } } }));
    assert.equal(stale.ok, true); assert.match(stale.warnings[0], /days old/);
  });
  await r.check('baseline update: raising is free; lowering or removing needs a reason that is logged; a failed suite refuses the update', () => {
    const old = { suites: { 'unit/a': { layer: 'unit', file: 'tests/a-contract.mjs', minPassed: 10 }, 'unit/gone': { layer: 'unit', file: 'tests/gone-contract.mjs', minPassed: 4 } }, log: [] };
    const cat = new Set(['unit/a', 'unit/new', 'unit/gone']);
    const raised = nextBaseline({ baseline: old, catalogueIds: cat, results: [{ id: 'unit/a', layer: 'unit', file: 'f', status: 'passed', passed: 12 }, { id: 'unit/new', layer: 'unit', file: 'g', status: 'passed', passed: 3 }, { id: 'manual/x', layer: 'manual', status: 'passed', passed: 1 }, { id: 'smoke/skipped', layer: 'smoke', status: 'skipped', passed: 0 }] });
    assert.equal(raised.refused, null); assert.deepEqual(raised.changes.raised, [['unit/a', 10, 12]]); assert.deepEqual(raised.changes.added, ['unit/new']);
    assert.equal(raised.baseline.suites['unit/a'].minPassed, 12); assert.ok(!('manual/x' in raised.baseline.suites)); assert.ok(!('smoke/skipped' in raised.baseline.suites));
    const lowered = nextBaseline({ baseline: old, catalogueIds: cat, results: [{ id: 'unit/a', layer: 'unit', file: 'f', status: 'passed', passed: 8 }] });
    assert.match(lowered.refused, /--reason/); assert.deepEqual(lowered.changes.lowered, [['unit/a', 10, 8]]);
    const withReason = nextBaseline({ baseline: old, catalogueIds: cat, reason: 'removed obsolete assertions', results: [{ id: 'unit/a', layer: 'unit', file: 'f', status: 'passed', passed: 8 }] });
    assert.equal(withReason.refused, null); assert.equal(withReason.baseline.log.length, 1); assert.deepEqual(withReason.baseline.log[0].lowered, { 'unit/a': [10, 8] });
    const removed = nextBaseline({ baseline: old, catalogueIds: new Set(['unit/a']), results: [{ id: 'unit/a', layer: 'unit', file: 'f', status: 'passed', passed: 10 }] });
    assert.match(removed.refused, /gone/);
    const failedRun = nextBaseline({ baseline: old, catalogueIds: cat, results: [{ id: 'unit/a', layer: 'unit', file: 'f', status: 'failed', passed: 99 }] });
    assert.match(failedRun.refused, /did not pass/);
  });

  // ----- the runner end to end on a throw-away repository -----
  const here = process.cwd();
  const fixture = () => {
    const d = tmp(); baseline(d);
    for (const f of ['scripts/test.mjs', 'scripts/test-catalogue.mjs', 'scripts/test-guard.mjs', 'tests/lib/report.mjs']) { mkdirSync(dirname(join(d, f)), { recursive: true }); copyFileSync(join(here, f), join(d, f)); }
    put(d, '.gitignore', '/tests/reports/\n');
    // old style: writes a root result file
    put(d, 'tests/alpha-contract.mjs', "import {writeFileSync} from 'node:fs';writeFileSync('tests/alpha-contract-result.json',JSON.stringify({passed:3}));\n");
    // new style: the report library, one skipped check
    put(d, 'tests/beta-client.mjs', "import {suite} from './lib/report.mjs';const r=suite('beta','tests/reports/beta-result.json',{layer:'unit'});await r.check('one',()=>{});await r.check('two',()=>{});r.skip('three','not here');await r.finish();\n");
    put(d, 'tests/tracked-result.json', '{"passed":1}\n'); // stands in for a tracked result file the runner must restore
    put(d, 'tests/gamma-contract.mjs', "import {writeFileSync} from 'node:fs';writeFileSync('tests/tracked-result.json','{\"passed\":999}');writeFileSync('tests/gamma-contract-result.json',JSON.stringify({passed:1}));\n");
    for (const c of [['init', '-q'], ['add', '-A'], ['-c', 'user.email=t@example.invalid', '-c', 'user.name=t', 'commit', '-q', '-m', 'fixture']]) spawnSync('git', c, { cwd: d });
    return d;
  };
  const run = (d, ...a) => { const p = spawnSync(process.execPath, ['scripts/test.mjs', ...a], { cwd: d, encoding: 'utf8', env: { ...process.env, SAHA_TEST_PORT: '' } }); return { code: p.status, out: p.stdout + p.stderr, summary: existsSync(join(d, 'tests/reports/summary.json')) ? JSON.parse(readFileSync(join(d, 'tests/reports/summary.json'), 'utf8')) : null }; };
  const find = (s, id) => s.suites.find(x => x.id === id);
  await r.check('runner: results from old-style files and the report library are counted, layers without a directory are "not present", the tree is restored', () => {
    const d = fixture(), x = run(d, 'unit', 'smoke');
    assert.equal(x.code, 0, x.out);
    assert.equal(find(x.summary, 'unit/alpha-contract').passed, 3); assert.equal(find(x.summary, 'unit/alpha-contract').countSource, 'result-file');
    const beta = find(x.summary, 'unit/beta-client'); assert.deepEqual([beta.passed, beta.failed, beta.skipped, beta.status], [2, 0, 1, 'passed']);
    assert.equal(x.summary.layers.find(l => l.layer === 'smoke').status, 'not present');
    assert.equal(x.summary.totals.passed, 3 + 2 + 1);
    assert.match(x.out, /not present: tests\/smoke\/ does not exist/);
    assert.equal(existsSync(join(d, 'tests/alpha-contract-result.json')), false, 'untracked result file deleted');
    assert.equal(readFileSync(join(d, 'tests/tracked-result.json'), 'utf8'), '{"passed":1}\n', 'tracked result file restored');
    assert.equal(spawnSync('git', ['status', '--porcelain'], { cwd: d, encoding: 'utf8' }).stdout.trim(), '', 'git status is clean');
    assert.ok(existsSync(join(d, 'tests/reports/results/unit__alpha-contract.json')), 'the result was copied before the original was deleted');
  });
  await r.check('runner: a failing suite makes the run fail and is reported with its exit code', () => {
    const d = fixture(); put(d, 'tests/delta-contract.mjs', "console.error('boom');process.exit(3);\n");
    const x = run(d, 'unit');
    assert.equal(x.code, 1); const s = find(x.summary, 'unit/delta-contract');
    assert.deepEqual([s.status, s.exitCode, s.passed], ['failed', 3, null]); assert.match(x.out, /boom/);
    assert.equal(x.summary.totals.failedSuites, 1);
  });
  await r.check('runner: a manual suite that reads credentials on stdin is blocked with a reason, never started (pull request #126)', () => {
    const d = fixture(); put(d, 'tests/anaemia-hosted-connection.mjs', "import {writeFileSync} from 'node:fs';writeFileSync('started.txt','yes');\n");
    const x = run(d, 'manual', '--only', 'manual/anaemia-hosted-connection'); const s = find(x.summary, 'manual/anaemia-hosted-connection');
    assert.equal(s.status, 'blocked'); assert.match(s.reason, /run it directly/); assert.equal(existsSync(join(d, 'started.txt')), false);
  });
  await r.check('runner: a report written by an earlier suite is never counted for a later one, however close in time (slice 11h, the GitHub flake)', () => {
    // On GitHub's runners a suite sometimes started within 5 ms of the previous suite's report write, and the old time-window
    // rule counted that report twice. Here the earlier report's time is set into the future, which made the old rule count it
    // every time; the snapshot rule must still give the later suite no count.
    const d = fixture();
    put(d, 'tests/early-contract.mjs', "import {mkdirSync,utimesSync,writeFileSync} from 'node:fs';mkdirSync('tests/reports',{recursive:true});const f='tests/reports/early-out.json';writeFileSync(f,JSON.stringify({passed:2}));const t=new Date(Date.now()+600000);utimesSync(f,t,t);\n");
    put(d, 'tests/later-contract.mjs', "console.error('later wrote nothing');process.exit(3);\n");
    const x = run(d, 'unit'); assert.equal(x.code, 1);
    const early = find(x.summary, 'unit/early-contract'), later = find(x.summary, 'unit/later-contract');
    assert.deepEqual([early.status, early.passed], ['passed', 2]);
    assert.deepEqual([later.status, later.exitCode, later.passed, later.countSource, later.resultFiles], ['failed', 3, null, 'none', []]);
    assert.equal(find(x.summary, 'unit/beta-client').passed, 2, 'the report library suite still counts only its own report');
  });
  await r.check('runner: a suite that exits 0 but checks nothing is a failure, not a pass', () => {
    const d = fixture(); put(d, 'tests/empty-contract.mjs', "import {suite} from './lib/report.mjs';const r=suite('empty','tests/reports/empty-result.json',{layer:'unit'});await r.finish();\n");
    const x = run(d, 'unit'); assert.equal(x.code, 1); assert.match(find(x.summary, 'unit/empty-contract').reason, /no assertion passed/);
  });
  await r.check('runner: --check-catalogue fails on a stray test file and on an unimported *-smoke.mjs module, and passes otherwise', () => {
    const d = fixture(); assert.equal(run(d, '--check-catalogue').code, 0);
    put(d, 'tests/stray.mjs'); const a = run(d, '--check-catalogue'); assert.equal(a.code, 1); assert.match(a.out, /Unclassified test file: tests\/stray\.mjs/);
    rmSync(join(d, 'tests/stray.mjs')); put(d, 'tests/orphan-smoke.mjs'); const b = run(d, '--check-catalogue'); assert.equal(b.code, 1); assert.match(b.out, /orphan-smoke\.mjs is not imported/);
    const c = run(d, 'unit'); assert.equal(c.code, 2, 'a run refuses to start on an inconsistent catalogue'); assert.match(c.out, /nothing was run/);
  });
  await r.check('runner: the regression guard fails when a suite drops below its baseline or disappears, and --update-baseline is deliberate', () => {
    const d = fixture();
    let x = run(d, 'unit', '--update-baseline'); assert.equal(x.code, 0, x.out);
    const base = JSON.parse(readFileSync(join(d, 'tests/regression-baseline.json'), 'utf8'));
    assert.deepEqual([base.suites['unit/alpha-contract'].minPassed, base.suites['unit/beta-client'].minPassed], [3, 2]);
    assert.equal(run(d, 'unit', '--guard').code, 0);
    // fewer assertions: alpha now reports 2
    put(d, 'tests/alpha-contract.mjs', "import {writeFileSync} from 'node:fs';writeFileSync('tests/alpha-contract-result.json',JSON.stringify({passed:2}));\n");
    x = run(d, 'unit', '--guard'); assert.equal(x.code, 1); assert.match(x.out, /unit\/alpha-contract passed 2 assertion\(s\); baseline is 3/);
    // the baseline does not move by itself, and lowering it needs a reason
    x = run(d, 'unit', '--update-baseline'); assert.equal(x.code, 1); assert.match(x.out, /--reason/);
    assert.equal(JSON.parse(readFileSync(join(d, 'tests/regression-baseline.json'), 'utf8')).suites['unit/alpha-contract'].minPassed, 3);
    // quarantine excuses the guard (not the suite)
    put(d, 'tests/quarantine.json', JSON.stringify({ suites: { 'unit/alpha-contract': { reason: 'fixture under repair', date: '2026-10-03' } } }));
    x = run(d, 'unit', '--guard'); assert.equal(x.code, 0, x.out); assert.match(x.out, /excused/);
    rmSync(join(d, 'tests/quarantine.json'));
    // a suite that disappears
    rmSync(join(d, 'tests/beta-client.mjs')); x = run(d, 'unit', '--guard'); assert.equal(x.code, 1); assert.match(x.out, /unit\/beta-client.*no longer exists/);
    x = run(d, 'unit', '--update-baseline', '--reason', 'beta retired and alpha trimmed'); assert.equal(x.code, 0, x.out);
    const after = JSON.parse(readFileSync(join(d, 'tests/regression-baseline.json'), 'utf8'));
    assert.equal(after.suites['unit/alpha-contract'].minPassed, 2); assert.ok(!('unit/beta-client' in after.suites)); assert.equal(after.log.at(-1).reason, 'beta retired and alpha trimmed');
    assert.equal(run(d, 'unit', '--guard').code, 0);
  });
  await r.check('runner: the UI layer runs a Playwright configuration through the installed binary and reads its stats; without Playwright it is blocked, not skipped', () => {
    const d = fixture(); put(d, 'tests/ui/playwright.config.mjs', 'export default {};\n'); put(d, 'tests/ui/login.spec.ts'); put(d, 'dist/server/wrangler.json', '{}\n');
    const blocked = run(d, 'ui', '--fast'); assert.equal(blocked.code, 1); assert.equal(find(blocked.summary, 'ui/playwright.config').status, 'blocked'); assert.match(blocked.out, /Playwright is not installed/);
    const bin = join(d, 'tests/ui/node_modules/.bin/playwright');
    put(d, 'tests/ui/node_modules/.bin/playwright', "#!/usr/bin/env node\nrequire('fs').writeFileSync(process.env.PLAYWRIGHT_JSON_OUTPUT_NAME, JSON.stringify({stats:{expected:4,unexpected:0,flaky:0,skipped:1}}));console.log('fake playwright '+process.argv.slice(2).join(' '));\n");
    chmodSync(bin, 0o755);
    const ok = run(d, 'ui', '--fast'); assert.equal(ok.code, 0, ok.out);
    const s = find(ok.summary, 'ui/playwright.config'); assert.deepEqual([s.status, s.passed, s.failed, s.skipped], ['passed', 4, 0, 1]);
    assert.match(readFileSync(join(d, 'tests/reports/logs/ui__playwright.config.log'), 'utf8'), /fake playwright test --config tests\/ui\/playwright\.config\.mjs/);
    // Slice 11g (test review M3): a test that passed only on retry fails the suite instead of counting as passed.
    put(d, 'tests/ui/node_modules/.bin/playwright', "#!/usr/bin/env node\nrequire('fs').writeFileSync(process.env.PLAYWRIGHT_JSON_OUTPUT_NAME, JSON.stringify({stats:{expected:4,unexpected:0,flaky:1,skipped:1}}));\n");
    chmodSync(bin, 0o755);
    const flaky = run(d, 'ui', '--fast'); assert.notEqual(flaky.code, 0, flaky.out);
    const f = find(flaky.summary, 'ui/playwright.config'); assert.deepEqual([f.status, f.passed, f.failed], ['failed', 4, 1]);
    put(d, 'tests/ui/node_modules/.bin/playwright', "#!/usr/bin/env node\nrequire('fs').writeFileSync(process.env.PLAYWRIGHT_JSON_OUTPUT_NAME, JSON.stringify({stats:{expected:4,unexpected:2,flaky:0,skipped:0}}));process.exit(1);\n");
    const bad = run(d, 'ui', '--fast'); assert.equal(bad.code, 1); assert.deepEqual([find(bad.summary, 'ui/playwright.config').status, find(bad.summary, 'ui/playwright.config').failed], ['failed', 2]);
  });
  await r.check('runner: a suite that exceeds its time limit fails as timed out and the processes it started are stopped with it', async () => {
    const d = fixture(), pidFile = join(d, 'grandchild.pid');
    put(d, 'tests/slow-contract.mjs', `import {spawn} from 'node:child_process';import {writeFileSync} from 'node:fs';
const g=spawn(process.execPath,['-e','setTimeout(()=>{},120000)'],{stdio:'ignore'});writeFileSync(${JSON.stringify(pidFile)},String(g.pid));setTimeout(()=>{},120000);\n`);
    const x = run(d, '--only', 'unit/slow-contract', '--timeout', '0.05');
    assert.equal(x.code, 1); const s = find(x.summary, 'unit/slow-contract'); assert.equal(s.status, 'failed'); assert.equal(s.reason, 'timed out');
    const pid = Number(readFileSync(pidFile, 'utf8'));
    await new Promise(res => setTimeout(res, 300));
    // A killed process can linger as a zombie until its parent's parent reaps it (a container's PID 1 may not), so "dead" means gone or state Z.
    const state = (() => { try { return readFileSync(`/proc/${pid}/status`, 'utf8').match(/State:\s*(\S)/)[1]; } catch { return null; } })();
    if (state !== null) assert.equal(state, 'Z', `the grandchild process ${pid} is dead (state ${state})`);
    else assert.throws(() => process.kill(pid, 0), /ESRCH/, 'the grandchild process is gone');
    assert.equal(run(d, 'unit', '--timeout', 'soon').code, 2);
  });
  await r.check('runner: --only runs one suite, and an unknown id is a usage error', () => {
    const d = fixture(); const x = run(d, '--only', 'unit/alpha-contract'); assert.equal(x.code, 0, x.out); assert.equal(x.summary.suites.length, 1);
    assert.equal(run(d, '--only', 'unit/nope').code, 2);
    assert.equal(run(d, 'nonsense').code, 2);
  });
} finally {
  for (const d of made) rmSync(d, { recursive: true, force: true });
}
await r.finish();
