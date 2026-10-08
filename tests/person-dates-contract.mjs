// Slice 14b person dates contract: append-only date entries, bounds, supersession with reason, withdrawal, scope, audit privacy.
// All people and dates are synthetic.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname, posix } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(process.cwd(), '.person-dates-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const fails = (fn, status) => { try { fn(); } catch (e) { assert.equal(e.status, status, e.message); return; } assert.fail(`expected ${status}`); };
// Transpile the module and its relative imports (dependency closure), so the test does not carry a hand-kept module list.
const done = new Set();
const load = f => {
  if (done.has(f)) return; done.add(f);
  const src = readFileSync(`lib/saha/${f}.ts`, 'utf8');
  for (const m of src.matchAll(/(?:from|import)\s+'(\.{1,2}\/[^']+)'/g)) { const t = posix.normalize(posix.join(posix.dirname(f), m[1])); if (existsSync(`lib/saha/${t}.ts`)) load(t); }
  mkdirSync(dirname(join(dir, f)), { recursive: true });
  writeFileSync(join(dir, f + '.js'), ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.{1,2}\/[^']+)'/g, "from '$1.js'"));
};
try {
  load('person-dates');
  const x = await import(pathToFileURL(join(dir, 'person-dates.js')));
  const now = '2026-10-07T06:00:00.000Z';
  const mk = () => ({ id: 'p1', name: 'Synthetic Person', age: 24, sex: 'Female', village: 'Synthetic', programmes: ['Maternal care'], task: 'Visit', due: 'Today', status: 'due', aiConsent: false, exchangeConsent: false, consentVersion: 1, assigned: true, createdAt: now, version: 3, teamId: 't', assignedTo: 'w' });
  const state = () => ({ workspace: { role: 'asha', people: [mk(), { ...mk(), id: 'p2', assigned: false }], visits: [], referrals: [], submissions: [], audit: [] } });
  const u = { userId: 'w', displayName: 'Worker SYN' }, asha = { userId: 'w', role: 'asha', teamIds: ['t'] }, admin = { userId: 'a', role: 'admin', teamIds: ['t'] };
  const rec = (s, over, m = asha, at = now) => x.applyPersonDates(s, { type: 'personDateRecord', personId: 'p1', version: s.workspace.people[0].version, kind: 'lmp', value: '2026-07-01', source: 'reported', ...over }, u, m, at);

  check(() => assert.equal(x.applyPersonDates(state(), { type: 'householdCreate' }, u, asha, now), null, 'other commands pass through'));
  check(() => assert.equal(x.applyPersonDates(state(), { type: 'personDateRecord', personId: 'p1' }, u, asha, now), null, 'invalid shape passes through'));
  // Record
  const s = state(); const r = rec(s, {});
  check(() => { assert.equal(r.ok, true); assert.deepEqual(r.warnings, []); assert.equal(s.workspace.people[0].version, 4); assert.deepEqual(x.currentDates(s.workspace.people[0].dateEntries), { lmp: '2026-07-01' }); });
  check(() => { const e = s.workspace.people[0].dateEntries[0]; assert.deepEqual([e.kind, e.source, e.recordedBy, e.recordedAt], ['lmp', 'reported', 'w', now]); });
  // Audit never names the kind or value
  check(() => { const a = s.workspace.audit.at(-1); assert.equal(a.action, 'personDateRecord'); assert.equal(a.personId, 'p1'); assert.ok(!/lmp|2026-07|pregnan|edd|delivery/i.test(a.detail), a.detail); });
  // Same value is refused; a different value needs a reason, then supersedes and keeps the old entry.
  check(() => fails(() => rec(s, {}), 409));
  check(() => fails(() => rec(s, { value: '2026-07-05' }), 422));
  rec(s, { value: '2026-07-05', reason: 'Mother recalled the date from her card' });
  check(() => { const p = s.workspace.people[0]; assert.equal(p.dateEntries.length, 2); assert.equal(p.dateEntries[1].supersedes, p.dateEntries[0].id); assert.equal(x.currentDate(p.dateEntries, 'lmp').value, '2026-07-05'); assert.equal(p.dateEntries[0].value, '2026-07-01', 'history kept'); });
  // Stale version
  check(() => fails(() => x.applyPersonDates(s, { type: 'personDateRecord', personId: 'p1', version: 1, kind: 'dob', value: '2002-01-01', source: 'document' }, u, asha, now), 409));
  // Bounds
  const b = state();
  check(() => fails(() => rec(b, { value: '2026-02-30' }), 422));
  check(() => fails(() => rec(b, { value: '2026-10-08' }), 422), 'future LMP');
  check(() => fails(() => rec(b, { value: '2025-11-01' }), 422), 'LMP over 320 days ago');
  check(() => fails(() => rec(b, { kind: 'edd', value: '2027-09-01' }), 422), 'EDD over 300 days ahead');
  check(() => fails(() => rec(b, { kind: 'edd', value: '2026-07-01' }), 422), 'EDD over 60 days past');
  check(() => fails(() => rec(b, { kind: 'birthDate', value: '2026-10-09' }), 422));
  check(() => fails(() => rec(b, { kind: 'dob', value: '1890-01-01' }), 422));
  check(() => assert.equal(rec(b, { kind: 'edd', value: '2027-03-20' }).ok, true));
  // LMP and EDD disagreement is surfaced, not resolved
  check(() => assert.equal(rec(b, { value: '2026-07-01' }).warnings.length, 1));
  const ok = state(); rec(ok, { value: '2026-07-01' });
  check(() => assert.deepEqual(rec(ok, { kind: 'edd', value: '2027-04-07' }).warnings, []));
  // Withdraw keeps the entry, removes the current value, needs a reason, cannot repeat
  const w = state(); const id1 = rec(w, {}).entryId;
  const wd = (s2, over) => x.applyPersonDates(s2, { type: 'personDateWithdraw', personId: 'p1', version: s2.workspace.people[0].version, entryId: id1, reason: 'Entered on the wrong person', ...over }, u, asha, now);
  check(() => assert.equal(wd(w, { reason: 'no' }), null, 'a reason of under five characters is not a valid command'));
  check(() => fails(() => wd(w, { entryId: 'nope' }), 404));
  check(() => assert.equal(wd(w, {}).ok, true));
  check(() => { const p = w.workspace.people[0]; assert.equal(p.dateEntries.length, 1, 'entry kept'); assert.equal(p.dateEntries[0].withdrawn.reason, 'Entered on the wrong person'); assert.deepEqual(x.currentDates(p.dateEntries), {}); });
  check(() => fails(() => wd(w, {}), 409));
  check(() => { const a = w.workspace.audit.at(-1); assert.equal(a.action, 'personDateWithdraw'); assert.ok(!/lmp|2026-07/i.test(a.detail)); });
  // A withdrawn value can be recorded again without a reason (no current value to replace)
  check(() => assert.equal(rec(w, {}).ok, true));
  // Authority: care roles only; admin and a person outside scope are refused
  check(() => fails(() => rec(state(), {}, admin), 403));
  check(() => fails(() => x.applyPersonDates(state(), { type: 'personDateRecord', personId: 'p2', version: 3, kind: 'lmp', value: '2026-07-01', source: 'reported' }, u, asha, now), 403));
  check(() => fails(() => x.applyPersonDates(state(), { type: 'personDateRecord', personId: 'missing', version: 3, kind: 'lmp', value: '2026-07-01', source: 'reported' }, u, asha, now), 404));
  const adm = state(); adm.workspace.role = 'admin';
  check(() => fails(() => rec(adm, {}, { ...asha, role: 'admin' }), 403));
  // Entry cap
  const cap = state(); const p0 = cap.workspace.people[0]; p0.dateEntries = Array.from({ length: 60 }, (_, i) => ({ id: 'e' + i, kind: 'dob', value: '2002-01-01', source: 'reported', recordedAt: now, recordedBy: 'w', withdrawn: { at: now, by: 'w', reason: 'cap fixture' } }));
  check(() => fails(() => rec(cap, { kind: 'dob', value: '2002-02-02' }), 422));
  // Extra fields are refused (strict schema): the command passes through as unrecognised
  check(() => assert.equal(rec(state(), { location: '12.9,77.5' }), null));
  console.log(JSON.stringify({ passed, failed: 0, skipped: 0 }));
} finally { rmSync(dir, { recursive: true, force: true }); }
