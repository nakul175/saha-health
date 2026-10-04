// Slice 13c: a shadow comparison whose visit was later corrected is re-derived on read, not counted as stored.
// 1. currentFields: an uncorrected result keeps its stored fields; an amended visit with a confirmed correction is recompared
//    against the correction; a correction not yet confirmed, or a voided visit, leaves the result out; a visit not in the state
//    (a scoped read) keeps the stored fields; nothing stored is rewritten.
// 2. The shadow report counts the recomputed comparison with its new outcome, leaves the voided one out, and says how many
//    were recomputed and left out.
// 3. The drift report, given currentFields, does the same per period; without it, it behaves as before.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(process.cwd(), '.shadow-recompute-contract-')), seen = new Set();
let passed = 0;
const check = fn => { fn(); passed++; };
function compile(name) {
  if (seen.has(name)) return; seen.add(name);
  let code = ts.transpileModule(readFileSync(`lib/saha/${name}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  code = code.replace(/from ['"](\.\/[^'"]+)['"]/g, (_, path) => {
    const rel = join(dirname(name), path);
    if (path.endsWith('.json') || path.endsWith('.mjs')) { const file = join(dir, rel); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, readFileSync('lib/saha/' + rel)); return path.endsWith('.json') ? `from '${path}' with {type:'json'}` : `from '${path}'`; }
    compile(rel); return `from '${path}.js'`;
  });
  const file = join(dir, name + '.js'); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, code);
}
try {
  for (const m of ['shadow', 'drift']) compile(m);
  const S = await import(pathToFileURL(join(dir, 'shadow.js'))), D = await import(pathToFileURL(join(dir, 'drift.js')));
  const now = '2026-10-04T06:00:00.000Z', day = '2026-10-02T06:00:00.000Z';
  const facts = weight => ({ date: '2026-10-02', weight, systolic: '', diastolic: '', temperature: '', weeks: '', coughDays: '', notes: 'Weight ' + weight, source: 'measured' });
  const visit = (id, weight, extra = {}) => ({ id, personId: 'p', version: 1, recordVersion: 1, state: 'confirmed', confirmedAt: day, createdAt: day, facts: facts(weight), ...extra });
  const output = { proposals: [{ field: 'weight', value: '60', quote: 'Weight 60', start: 0, end: 9 }], highlights: [] };
  const result = (visitId, weight) => ({ visitId, personId: 'p', visitVersion: 1, at: day, status: 'compared', output, fields: [{ field: 'weight', shadow: '60', confirmed: weight, outcome: weight === '60' ? 'agreement' : 'disagreement' }] });
  // a: untouched (agreement); b: amended to 61 with a confirmed correction b2 (was agreement, now disagreement);
  // c: amended, correction c2 still a draft (left out); d: voided (left out); e: not loaded in this state (kept).
  const fresh = () => ({
    organisation: { id: 'org' }, members: [], teams: [],
    governance: { entries: [], shadows: [] },
    workspace: { visits: [visit('a', '60'), visit('b', '60', { supersededBy: 'b2' }), visit('b2', '61', { amendsVisitId: 'b', confirmedAt: now }), visit('c', '60', { supersededBy: 'c2' }), visit('c2', '62', { amendsVisitId: 'c', state: 'draft', confirmedAt: undefined }), visit('d', '60', { voidedAt: now })] },
  });
  const shadow = s => ({ id: 'sh', entryId: 'cap', revision: 1, manifestHash: 'h', key: 'extract', scope: 'organisation', teamIds: [], startedAt: day, until: '2026-11-01T00:00:00.000Z', startedBy: 'own', reason: 'x', state: 'stopped', version: 2, results: ['a', 'b', 'c', 'd', 'e'].map(id => result(id, '60')) });

  check(() => {
    const s = fresh(), sh = shadow(s), before = JSON.stringify(sh);
    const f = id => S.currentFields(s, sh.results.find(r => r.visitId === id));
    assert.deepEqual(f('a'), sh.results[0].fields, 'uncorrected: stored fields');
    assert.equal(f('b').find(x => x.field === 'weight').outcome, 'disagreement', 'amended: recompared against the confirmed correction (61)');
    assert.equal(f('b').find(x => x.field === 'weight').confirmed, '61');
    assert.equal(f('c'), null, 'the correction is still a draft: left out until it is confirmed');
    assert.equal(f('d'), null, 'voided (wrong patient): left out');
    assert.deepEqual(f('e'), sh.results[4].fields, 'not in this state: stored fields kept');
    assert.equal(JSON.stringify(sh), before, 'nothing stored is rewritten');
    assert.deepEqual(S.currentFields(s, { ...sh.results[1], status: 'unable', fields: undefined }), null, 'an unable result has no fields');
  });
  check(() => {
    const s = fresh(), sh = shadow(s), report = S.shadowReport(s, sh, now);
    assert.deepEqual(report.visits, { total: 5, compared: 5, unable: 0, notRun: {}, recomputed: 1, excluded: 2 });
    const weight = report.fields.find(r => r.field === 'weight');
    assert.equal(weight.agreement, 2, 'a and e agree; b no longer counts as agreement');
    assert.equal(weight.disagreement, 1, 'b counts with its recomputed outcome');
    assert.equal(weight.agreement + weight.disagreement + weight.missing + weight['not-recorded'] + weight.unable, 3, 'c and d are left out');
  });
  check(() => {
    const s = fresh(), sh = shadow(s);
    const stored = D.driftReport(s, [sh], now), current = D.driftReport(s, [sh], now, r => S.currentFields(s, r));
    const sum = (rows, k) => rows[0].periods.reduce((n, p) => n + p[k], 0);
    assert.deepEqual([sum(stored, 'visits'), sum(stored, 'agreement'), sum(stored, 'disagreement')], [5, 5, 0], 'without currentFields: as before this slice');
    assert.deepEqual([sum(current, 'visits'), sum(current, 'agreement'), sum(current, 'disagreement')], [3, 2, 1], 'with it: c and d left out, b recomputed');
  });

  writeFileSync('tests/shadow-recompute-contract-result.json', JSON.stringify({ passed, suite: 'shadow-recompute-contract', completedAt: new Date().toISOString() }, null, 2) + '\n');
  console.log(JSON.stringify({ passed, suite: 'shadow-recompute-contract' }));
} finally { rmSync(dir, { recursive: true, force: true }); }
