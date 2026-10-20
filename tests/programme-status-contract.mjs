// SAHA037/APL220: documentary status, no inferred eligibility/official registration.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = mkdtempSync('.programme-status-contract-'), checks = [];
try {
  writeFileSync(join(dir, 'programme-status.mjs'), ts.transpileModule(readFileSync('lib/saha/programme-status.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
  const { programmeEpisode, programmeStatusText } = await import(pathToFileURL(join(dir, 'programme-status.mjs')).href);
  const check = (name, fn) => { fn(); checks.push(name); };
  const e = { id: 'synthetic-episode', packId: 'maternal', packVersion: 1, episodeLabel: 'Synthetic episode', startDate: null, state: 'active', registration: 'not_submitted' };
  const project = patch => programmeEpisode({ ...e, ...patch }, 'Maternal care');
  check('Local episode with missing destination evidence never proves no prior send', () => { const s = programmeStatusText(project({})); assert.match(s.status, /Destination evidence not recorded/); assert.match(s.next, /does not prove no request was sent/); });
  check('Legacy submitted marker without destination evidence remains unverified', () => assert.match(programmeStatusText(project({ registration: 'submitted' })).status, /unavailable or inconsistent/));
  const cases = [
    ['requested', undefined, undefined, /request pending/], ['uncertain', undefined, undefined, /outcome unresolved/], ['retryable', undefined, undefined, /no destination entry/],
    ['accepted', 'SIM-REFERENCE', undefined, /Simulation accepted.*activation still required/], ['rejected', undefined, 'Synthetic business rejection', /Simulation rejected.*Local episode retained/],
    ['active', 'SIM-REFERENCE', undefined, /Simulation activated locally/],
  ];
  for (const [state, receipt, rejectionReason, expected] of cases) check('Distinct stored destination state ' + state, () => {
    const ep = project({ registration: state === 'active' ? 'submitted' : 'not_submitted', destinationEnrolment: { state, destinationName: 'Synthetic destination', destinationReceipt: receipt, rejectionReason } });
    assert.match(programmeStatusText(ep).status, expected);
    if (state === 'uncertain') assert.match(programmeStatusText(ep).next, /neither rejected nor safe to retry/);
  });
  for (const state of ['accepted', 'active']) for (const receipt of [undefined, '', '   ']) check(state + ' with absent/blank receipt cannot confirm acceptance', () => {
    const ep = project({ registration: state === 'active' ? 'submitted' : 'not_submitted', destinationEnrolment: { state, destinationName: 'Synthetic', destinationReceipt: receipt } });
    assert.match(programmeStatusText(ep).status, /unavailable or inconsistent/);
  });
  check('Rejected without a reason never invents one', () => assert.match(programmeStatusText(project({ destinationEnrolment: { state: 'rejected', destinationName: 'Synthetic' } })).status, /unavailable or inconsistent/));
  check('Rejected plus submitted registration is inconsistent, never active', () => assert.match(programmeStatusText(project({ registration: 'submitted', destinationEnrolment: { state: 'rejected', destinationName: 'Synthetic', rejectionReason: 'Synthetic reason' } })).status, /unavailable or inconsistent/));
  check('Unknown destination state stays unverified', () => assert.match(programmeStatusText(project({ destinationEnrolment: { state: 'invented', destinationName: 'Synthetic' } })).status, /unavailable or inconsistent/));
  for (const state of ['requested', 'uncertain', 'retryable']) check(state + ' plus submitted registration is contradictory and never ordinary progress', () => {
    const status = programmeStatusText(project({ registration: 'submitted', destinationEnrolment: { state, destinationName: 'Synthetic' } }));
    assert.equal(status.status, 'Destination evidence unavailable or inconsistent.'); assert.match(status.next, /No acceptance or retry permission is inferred/);
  });
  check('Projection retains exact person-episode source fields and drops private delivery payload/history', () => {
    const source = { ...e, destinationEnrolment: { state: 'uncertain', destinationName: 'Synthetic', delivery: { key: 'private-key', actorId: 'private-actor', payload: 'private' }, payloadHash: 'private-hash', history: [{ reason: 'private-history' }] } }, before = structuredClone(source);
    const value = programmeEpisode(source, 'Pinned pack name');
    assert.equal(value.id, source.id); assert.equal(value.packVersion, source.packVersion); assert.equal(value.packName, 'Pinned pack name'); assert.equal(value.episodeLabel, source.episodeLabel);
    assert.doesNotMatch(JSON.stringify(value), /private/); assert.deepEqual(source, before);
  });
  check('Closure of local episode never implies destination acceptance', () => assert.match(programmeStatusText(project({ state: 'closed' })).status, /Destination evidence not recorded/));
  check('Eligibility assessment is projected independently without inventing destination registration', () => { const value=project({eligibilityAssessment:{state:'eligible',reason:'Synthetic criteria reviewed.',assessedAt:'2026-10-16T00:00:00.000Z',assessedBy:'worker',version:1}});assert.equal(value.eligibilityAssessment.state,'eligible');assert.equal(value.registration,'not_submitted');assert.equal(value.destination,undefined); });
  check('Malformed eligibility assessment is refused rather than treated as eligibility', () => assert.throws(()=>project({eligibilityAssessment:{state:'eligible',reason:'',assessedAt:'bad',assessedBy:'',version:0}}),/Eligibility assessment source is unavailable/));
  for (const value of [12, {}, [], null]) check('Malformed receipt stays unverified instead of crashing or confirming', () => assert.match(programmeStatusText(project({ destinationEnrolment: { state: 'accepted', destinationName: 'Synthetic', destinationReceipt: value } })).status, /unavailable or inconsistent/));
  for (const patch of [{ id: null }, { packVersion: 0 }, { state: 'guessed' }, { registration: 'accepted' }, { destinationEnrolment: { state: 'accepted', destinationName: {} } }]) check('Invalid core source refuses the projection without invented fields', () => assert.throws(() => project(patch), /source is unavailable/));
  const output = process.env.SAHA_PROGRAMME_STATUS_REPORT ?? 'tests/reports/programme-status-contract-result.json';
  mkdirSync(join(output, '..'), { recursive: true }); writeFileSync(output, JSON.stringify({ passed: checks.length, failed: 0, skipped: 0, checks, completedAt: new Date().toISOString(), limits: 'Current documentary projection/status helper only; no partner receipt verification, official registration, clinical/field/formal acceptance.' }, null, 2));
  console.log(`${checks.length} programme status contract checks passed`);
} finally { rmSync(dir, { recursive: true, force: true }); }
