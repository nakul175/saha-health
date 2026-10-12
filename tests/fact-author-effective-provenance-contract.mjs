// SAHA-021 / BR-DATA-02: correcting an effective source/time changes recorder
// attribution without rewriting historical facts or inventing clinical authority.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(process.cwd(), '.effective-provenance-'));
const cases = [];
const check = (name, test) => { test(); cases.push(name); };
try {
  const source = readFileSync('lib/saha/fact-provenance.ts', 'utf8');
  writeFileSync(join(dir, 'fact-provenance.mjs'), ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  }).outputText);
  const { stampAuthors } = await import(pathToFileURL(join(dir, 'fact-provenance.mjs')).href);
  const oldActor = { userId: 'synthetic-asha', name: 'Synthetic ASHA', role: 'asha', at: '2026-10-01T04:00:00Z' };
  const actor = { userId: 'synthetic-corrector', name: 'Synthetic corrector', role: 'clinician', at: '2026-10-02T04:00:00Z' };
  const base = { date: '2026-10-01T02:00', source: 'measured', systolic: '120', diastolic: '80', weight: '60', temperature: '', weeks: '', coughDays: '', notes: 'Synthetic observation.' };
  const initial = stampAuthors(undefined, base, undefined, oldActor);
  const changedDate = { ...base, date: '2026-10-01T03:00' };
  check('Fallback date correction credits the correcting actor', () => {
    const a = stampAuthors(base, changedDate, initial, actor);
    assert.equal(a.weight.userId, actor.userId);
    assert.equal(a.bloodPressure.userId, actor.userId);
  });
  check('Fallback source correction credits the correcting actor', () => {
    const a = stampAuthors(base, { ...base, source: 'reported' }, initial, actor);
    assert.equal(a.weight.userId, actor.userId);
    assert.equal(a.bloodPressure.userId, actor.userId);
  });
  const explicit = { ...base, provenance: { weight: { source: 'reported', at: '2026-09-30T03:00' } } };
  const explicitAuthors = stampAuthors(undefined, explicit, undefined, oldActor);
  check('Fully explicit measurement retains its author when visit provenance changes', () => {
    const a = stampAuthors(explicit, { ...explicit, source: 'reported', date: changedDate.date }, explicitAuthors, actor);
    assert.deepEqual(a.weight, oldActor);
    assert.equal(a.bloodPressure.userId, actor.userId);
  });
  check('Own source with fallback time depends on the visit date', () => {
    const f = { ...base, provenance: { weight: { source: 'reported' } } };
    const a = stampAuthors(f, { ...f, date: changedDate.date }, stampAuthors(undefined, f, undefined, oldActor), actor);
    assert.equal(a.weight.userId, actor.userId);
  });
  check('Own source shields a measurement from an unrelated fallback source edit', () => {
    const f = { ...base, provenance: { weight: { source: 'reported' } } };
    const a = stampAuthors(f, { ...f, source: 'reported' }, stampAuthors(undefined, f, undefined, oldActor), actor);
    assert.deepEqual(a.weight, oldActor);
  });
  check('Explicit missing reason has no observation timestamp and keeps attribution', () => {
    const f = { ...base, provenance: { temperature: { source: 'declined' } } };
    const a = stampAuthors(f, { ...f, source: 'reported', date: changedDate.date }, stampAuthors(undefined, f, undefined, oldActor), actor);
    assert.deepEqual(a.temperature, oldActor);
  });
  check('Changed missing reason still credits the actor', () => {
    const f = { ...base, provenance: { temperature: { source: 'declined' } } };
    const n = { ...f, provenance: { temperature: { source: 'unknown' } } };
    assert.deepEqual(stampAuthors(f, n, stampAuthors(undefined, f, undefined, oldActor), actor).temperature, actor);
  });
  check('Unchanged historical values without authors are never assigned to the saver', () => {
    assert.equal(stampAuthors(base, { ...base, notes: 'Unrelated note edit' }, undefined, actor), undefined);
  });
  check('Removing a value removes only its current author', () => {
    const a = stampAuthors(base, { ...base, weight: '' }, initial, actor);
    assert.equal(a.weight, undefined);
    assert.deepEqual(a.bloodPressure, oldActor);
  });
  check('Copied correction drafts preserve existing attribution', () => {
    assert.deepEqual(stampAuthors(base, structuredClone(base), initial, actor), initial);
  });
  check('Repeated server recomputation returns the same correction attribution', () => {
    const a = stampAuthors(base, changedDate, initial, actor);
    assert.deepEqual(stampAuthors(changedDate, structuredClone(changedDate), a, oldActor), a);
  });
  check('Inputs and previous author records stay unchanged', () => {
    assert.equal(base.date, '2026-10-01T02:00');
    assert.deepEqual(initial.weight, oldActor);
    assert.notEqual(stampAuthors(base, changedDate, initial, actor).weight, actor);
  });
  // Compile the actual current server modules, rather than substituting a
  // mock attribution hook or modifying a preserved original fixture.
  for (const file of readdirSync('lib/saha').filter(file => file.endsWith('.ts'))) {
    writeFileSync(join(dir, file.replace(/\.ts$/, '.js')), ts.transpileModule(readFileSync(join('lib/saha', file), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
    }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  }
  const { recordFactAuthors } = await import(pathToFileURL(join(dir, 'fact-verification.js')).href);
  const { factsSchema, commandSchema } = await import(pathToFileURL(join(dir, 'core.js')).href);
  check('Client-provided authors are refused inside facts and stripped from save commands', () => {
    assert.equal(factsSchema.safeParse({ ...base, factAuthors: { weight: actor } }).success, false);
    const c = commandSchema.safeParse({ type: 'saveVisit', visitId: 'synthetic-visit', version: 1, facts: base, factAuthors: { weight: oldActor } });
    assert.equal(c.success, true);
    assert.equal(c.data.factAuthors, undefined);
  });
  const predecessor = { id: 'synthetic-confirmed', personId: 'synthetic-person', state: 'confirmed', version: 3, recordVersion: 2, facts: base, factAuthors: initial, factReviews: [{ id: 'review-history', measure: 'weight', state: 'verified', by: 'synthetic-reviewer', byName: 'Synthetic reviewer', at: oldActor.at }] };
  const before = { workspace: { visits: [predecessor], audit: [] } };
  const after = structuredClone(before);
  after.workspace.visits.push({ id: 'synthetic-draft', personId: 'synthetic-person', state: 'draft', amendsVisitId: predecessor.id, version: 1, recordVersion: 1, facts: structuredClone(changedDate) });
  const authenticatedActor = { userId: actor.userId, displayName: actor.name, email: 'synthetic@example.invalid' };
  const membership = { role: actor.role, accountCode: 'SYNTHETIC-CODE' };
  recordFactAuthors(before, after, authenticatedActor, membership, actor.at);
  check('Server attribution hook stamps the correction using authenticated identity', () => {
    assert.deepEqual(after.workspace.visits[1].factAuthors.weight, { ...actor, accountCode: membership.accountCode });
    assert.equal(after.workspace.visits[1].factAuthors.bloodPressure.userId, authenticatedActor.userId);
  });
  check('Confirmed predecessor and its review/audit history stay unchanged', () => {
    assert.deepEqual(after.workspace.visits[0], predecessor);
    assert.deepEqual(before.workspace.visits[0], predecessor);
    assert.deepEqual(after.workspace.audit, []);
  });
  check('Rehydrated correction repeats the same server attribution without changing prior history', () => {
    const repeated = structuredClone(after);
    recordFactAuthors(after, repeated, { ...authenticatedActor, userId: 'unrelated-saver' }, membership, '2026-10-03T04:00:00Z');
    assert.deepEqual(repeated, after);
  });
  const report = { passed: cases.length, failed: 0, skipped: 0, cases, completedAt: new Date().toISOString(), limits: ['Current pure helper and server-attribution/schema execution; no HTTP, clinical, independent acceptance or staging qualification.'] };
  writeFileSync('tests/fact-author-effective-provenance-contract-result.json', JSON.stringify(report, null, 2) + '\n');
  console.log(`${cases.length} effective provenance author contract checks passed`);
} finally { rmSync(dir, { recursive: true, force: true }); }
