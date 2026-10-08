// Slice 14a MCH schedule contract: due lists from dates, missing anchors, and the verified-composite payable event.
// Every policy value below is a synthetic fixture (SYN), not a claim about any state's schedule or rate.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(process.cwd(), '.mch-schedule-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const throwsCode = (fn, code) => { try { fn(); } catch (e) { assert.equal(e.code, code, e.message); return; } assert.fail(`expected ${code}`); };
try {
  writeFileSync(join(dir, 'mch-schedule.js'), ts.transpileModule(readFileSync('lib/saha/mch-schedule.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
  const x = await import(pathToFileURL(join(dir, 'mch-schedule.js')));
  const policy = {
    id: 'SYN-policy', version: 1, stateLabel: 'SYN state', source: 'synthetic fixture',
    windows: [
      { id: 'anc1', programme: 'Maternal', label: 'ANC 1', anchor: 'lmp', fromDay: 0, toDay: 84 },
      { id: 'anc2', programme: 'Maternal', label: 'ANC 2', anchor: 'lmp', fromDay: 98, toDay: 182 },
      { id: 'hbnc3', programme: 'Newborn', label: 'HBNC day 3', anchor: 'birth', fromDay: 3, toDay: 3 },
      { id: 'hbnc7', programme: 'Newborn', label: 'HBNC day 7', anchor: 'birth', fromDay: 7, toDay: 8 },
    ],
    composites: [{ id: 'hbnc-package', label: 'HBNC package', anchor: 'birth', closesOnDay: 45, requiredEvidence: ['visits', 'registration'], amountMinor: 25000, currency: 'INR' }],
  };
  check(() => assert.equal(x.addDays('2026-02-27', 2), '2026-03-01'));
  check(() => assert.equal(x.addDays('2028-02-28', 1), '2028-02-29'));
  check(() => throwsCode(() => x.dayNumber('2026-02-30'), 'bad_date'));
  check(() => throwsCode(() => x.dayNumber('07/10/2026'), 'bad_date'));
  check(() => assert.equal(x.lmpFrom({ edd: '2027-01-07' }), '2026-04-02'));
  check(() => assert.equal(x.lmpFrom({ lmp: '2026-04-01', edd: '2027-01-07' }), '2026-04-01'));
  check(() => assert.equal(x.lmpFrom({}), undefined));

  // Due list: statuses relative to the day, ordering overdue -> due -> upcoming, completed windows omitted.
  const r = x.dueList(policy, { lmp: '2026-06-01' }, '2026-09-20');
  check(() => assert.deepEqual(r.items.map(i => [i.windowId, i.status]), [['anc1', 'overdue'], ['anc2', 'due']]));
  check(() => assert.deepEqual(r.missingAnchors, ['birth']));
  check(() => assert.deepEqual(x.dueList(policy, { lmp: '2026-06-01' }, '2026-09-20', ['anc1']).items.map(i => i.windowId), ['anc2']));
  check(() => assert.equal(x.dueList(policy, { lmp: '2026-06-01' }, '2026-06-02').items.find(i => i.windowId === 'anc2').status, 'upcoming'));
  // EDD only: the LMP is derived, not invented from nothing.
  check(() => assert.equal(x.dueList(policy, { edd: '2027-03-08' }, '2026-06-01').items.length, 2));
  // No dates at all: nothing is guessed.
  const none = x.dueList(policy, {}, '2026-06-01');
  check(() => assert.equal(none.items.length, 0));
  check(() => assert.deepEqual(none.missingAnchors, ['birth', 'lmp']));
  // Newborn windows from the birth date, window edges inclusive.
  const nb = x.dueList(policy, { birthDate: '2026-09-01' }, '2026-09-09');
  check(() => assert.deepEqual(nb.items.map(i => [i.windowId, i.status, i.opens, i.closes]), [['hbnc3', 'overdue', '2026-09-04', '2026-09-04'], ['hbnc7', 'due', '2026-09-08', '2026-09-09']]));
  check(() => assert.equal(x.dueList(policy, { birthDate: '2026-09-01' }, '2026-09-10').items.find(i => i.windowId === 'hbnc7').status, 'overdue'));

  // Policy validation.
  check(() => throwsCode(() => x.dueList({ ...policy, windows: [policy.windows[0], policy.windows[0]] }, {}, '2026-06-01'), 'bad_policy'));
  check(() => throwsCode(() => x.dueList({ ...policy, windows: [{ ...policy.windows[0], fromDay: 10, toDay: 5 }] }, {}, '2026-06-01'), 'bad_policy'));
  check(() => throwsCode(() => x.dueList({ ...policy, composites: [{ ...policy.composites[0], amountMinor: 250.5 }] }, {}, '2026-06-01'), 'bad_policy'));
  check(() => throwsCode(() => x.dueList({ ...policy, composites: [{ ...policy.composites[0], requiredEvidence: [] }] }, {}, '2026-06-01'), 'bad_policy'));

  // Composite: the payable event is the verified package, not the visit.
  const ev = (over = []) => [{ id: 'visits', completed: true, on: '2026-10-05' }, { id: 'registration', completed: true, on: '2026-09-20' }, ...over];
  const birth = '2026-09-01', dayOf = '2026-10-16';
  check(() => assert.equal(x.evaluateComposite(policy, 'hbnc-package', birth, '2026-10-10', ev()).status, 'awaiting_day'));
  check(() => assert.equal(x.evaluateComposite(policy, 'hbnc-package', birth, dayOf, ev()).status, 'awaiting_verification'));
  const verified = { verifier: 'ANM-SYN-1', role: 'anm', on: '2026-10-18' };
  const ok = x.evaluateComposite(policy, 'hbnc-package', birth, dayOf, ev(), verified);
  check(() => assert.deepEqual([ok.status, ok.amountMinor, ok.currency, ok.dueOn], ['payable', 25000, 'INR', '2026-10-16']));
  check(() => assert.equal(x.evaluateComposite(policy, 'hbnc-package', birth, dayOf, [ev()[0]], verified).status, 'incomplete'));
  check(() => assert.deepEqual(x.evaluateComposite(policy, 'hbnc-package', birth, dayOf, [ev()[0]], verified).missing, ['registration']));
  // Evidence recorded after the closing day does not count, and is named.
  const late = x.evaluateComposite(policy, 'hbnc-package', birth, '2026-10-30', [{ id: 'visits', completed: true, on: '2026-10-20' }, ev()[1]], verified);
  check(() => assert.deepEqual([late.status, late.missing, late.lateEvidence], ['incomplete', ['visits'], ['visits']]));
  // Evidence without a date, or not completed, does not count.
  check(() => assert.equal(x.evaluateComposite(policy, 'hbnc-package', birth, dayOf, [{ id: 'visits', completed: true }, ev()[1]], verified).status, 'incomplete'));
  check(() => assert.equal(x.evaluateComposite(policy, 'hbnc-package', birth, dayOf, [{ id: 'visits', completed: false, on: '2026-10-05' }, ev()[1]], verified).status, 'incomplete'));
  // A verifier without a role, or none, is not verification.
  check(() => assert.equal(x.evaluateComposite(policy, 'hbnc-package', birth, dayOf, ev(), { verifier: '', role: 'anm', on: dayOf }).status, 'awaiting_verification'));
  check(() => throwsCode(() => x.evaluateComposite(policy, 'hbnc-package', birth, dayOf, ev(), { ...verified, on: '2026-10-01' }), 'early_verification'));
  check(() => throwsCode(() => x.evaluateComposite(policy, 'nope', birth, dayOf, ev()), 'unknown_rule'));
  console.log(JSON.stringify({ passed, failed: 0, skipped: 0 }));
} finally { rmSync(dir, { recursive: true, force: true }); }
