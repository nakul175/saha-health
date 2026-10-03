// Slice R33 contract (BR-DATA-12): cross-visit reuse of a recorded measurement with its provenance.
// The reuse command copies the value and the source/observation time forward; reuse is refused for a disputed
// measurement (open dispute on its fact target) and for a measurement on an imported read-only visit.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = mkdtempSync(join(process.cwd(), '.fact-reuse-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const refuses = (fn, status, pattern) => { assert.throws(fn, e => e.status === status && pattern.test(e.message), String(pattern)); passed++; };
try {
  for (const f of ['abdm', 'abdm-transfer', 'access', 'action-plan', 'adapter-operations', 'agent', 'agent-minimisation', 'ai-budget', 'alerts', 'anaemia', 'audit-chain', 'capability-lifecycle', 'caseload', 'consent', 'continuity', 'core', 'delegation', 'ehr', 'environment', 'evaluation', 'exceptional', 'expansion', 'facility-scope', 'fact-provenance', 'fact-reuse', 'fhir-document', 'fhir-validate', 'field', 'field-registration', 'governance', 'household', 'household-constants', 'household-visit', 'household-visit-constants', 'identity', 'imported-visits', 'media', 'merge', 'mis', 'operations', 'outreach', 'pack-installation', 'partition', 'pilot', 'programme-commands', 'programmes', 'provider-sandbox', 'purpose-scope', 'referral-needs', 'referral-request', 'referral-rules', 'retention', 'rights', 'seed', 'send-gate', 'service-identity', 'shadow', 'store', 'task-limits', 'types'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const R = await import(pathToFileURL(join(dir, 'fact-reuse.js')));
  const P = await import(pathToFileURL(join(dir, 'fact-provenance.js')));
  const C = await import(pathToFileURL(join(dir, 'core.js')));
  const now = '2026-10-03T06:00:00.000Z';
  const targetFacts = { date: '2026-10-03T05:00', systolic: '', diastolic: '', weight: '', temperature: '', weeks: '', coughDays: '', notes: 'New visit.', source: 'measured' };
  // 1. reusedMeasurement carries the value and its effective provenance (per-measurement entry).
  const src = { date: '2026-09-28T08:00', systolic: '120', diastolic: '80', weight: '60', temperature: '', weeks: '', coughDays: '', notes: '', source: 'measured', provenance: { weight: { source: 'measured', at: '2026-09-28T08:00' } } };
  const out1 = R.reusedMeasurement(src, targetFacts, 'weight');
  check(() => { assert.equal(out1.weight, '60'); assert.deepEqual(out1.provenance.weight, { source: 'measured', at: '2026-09-28T08:00' }); assert.equal(out1.notes, 'New visit.', 'notes kept'); assert.equal(out1.date, '2026-10-03T05:00', 'target date kept'); assert.equal(out1.systolic, '', 'other measures untouched'); });
  // 2. blood pressure copies both fields.
  const out2 = R.reusedMeasurement(src, targetFacts, 'bloodPressure');
  check(() => { assert.equal(out2.systolic, '120'); assert.equal(out2.diastolic, '80'); assert.equal(out2.provenance.bloodPressure.source, 'measured'); assert.equal(out2.provenance.bloodPressure.at, '2026-09-28T08:00'); });
  // 3. Visit-level provenance falls back to the source visit's source and time, carried as an explicit entry.
  const legacy = { date: '2026-09-28T08:00', systolic: '', diastolic: '', weight: '55', temperature: '', weeks: '', coughDays: '', notes: '', source: 'reported' };
  const out3 = R.reusedMeasurement(legacy, targetFacts, 'weight');
  check(() => assert.deepEqual(out3.provenance.weight, { source: 'reported', at: '2026-09-28T08:00' }, 'visit-level source and time carried forward'));
  // 4. Entered-unit and unusual-value reasons on the reused field are dropped so the value is re-validated cleanly.
  const dirty = { ...targetFacts, weight: '90', entered: { weight: { value: '198', unit: 'lb' } }, unusual: { weight: 'Previous reason' } };
  const out4 = R.reusedMeasurement(src, dirty, 'weight');
  check(() => { assert.equal(out4.weight, '60'); assert.equal(out4.entered, undefined); assert.equal(out4.unusual, undefined); });
  // 5. The command: role, state, version, self, cross-person, imported, non-confirmed and unrecorded refusals.
  const member = (userId, role, teamIds = ['default']) => ({ userId, displayName: userId, accountCode: userId.toUpperCase().padEnd(24, '0').slice(0, 24), role, isOwner: false, status: 'active', version: 1, teamIds, createdAt: now });
  const person = { id: 'p1', name: 'Synthetic Person', age: 30, sex: 'Female', village: 'Synthetic', programmes: ['General care'], task: '', due: '', status: 'in_progress', aiConsent: false, exchangeConsent: false, consentVersion: 1, assigned: true, createdAt: now, version: 1, teamId: 'default', assignedTo: 'asha-1' };
  const visit = (id, facts, extra = {}) => ({ id, personId: 'p1', version: 1, state: 'confirmed', facts, createdAt: now, aiResults: [], recordVersion: 1, ...extra });
  const draft = (id, facts, extra = {}) => visit(id, facts, { state: 'draft', version: 2, ...extra });
  const state = (visits, role = 'clinician') => ({ organisation: { id: 'org', name: 'Org', revision: 1, createdAt: now }, teams: [{ id: 'default', name: 'Care', createdAt: now }], members: [], invitations: [], workspace: { schemaVersion: 1, revision: 1, role, people: [structuredClone(person)], visits, integrations: [], submissions: [], referrals: [], audit: [], receipts: {} } });
  const actor = id => ({ userId: id, displayName: `Name ${id}`, email: `${id}@example.invalid` });
  const cmd = over => ({ type: 'reuseFact', visitId: 'v-new', version: 2, sourceVisitId: 'v-src', measure: 'weight', ...over });
  const fresh = () => state([draft('v-new', structuredClone(targetFacts)), visit('v-src', structuredClone(src))]);
  check(() => assert.equal(R.applyFactReuse(fresh(), { type: 'saveVisit' }, actor('asha-1'), member('asha-1', 'asha'), now), null, 'unrelated command is not handled'));
  refuses(() => R.applyFactReuse(fresh(), cmd(), actor('sup-1'), member('sup-1', 'supervisor'), now), 403, /care role/);
  refuses(() => R.applyFactReuse(fresh(), cmd(), actor('admin-1'), member('admin-1', 'admin'), now), 403, /care role/);
  refuses(() => R.applyFactReuse(fresh(), cmd({ version: 1 }), actor('asha-1'), member('asha-1', 'asha'), now), 409, /changed/);
  refuses(() => R.applyFactReuse(fresh(), cmd({ sourceVisitId: 'v-new' }), actor('asha-1'), member('asha-1', 'asha'), now), 409, /different visit/);
  const otherPerson = fresh(); otherPerson.workspace.people.push({ ...structuredClone(person), id: 'p2' }); otherPerson.workspace.visits[1].personId = 'p2';
  refuses(() => R.applyFactReuse(otherPerson, cmd(), actor('asha-1'), member('asha-1', 'asha'), now), 409, /same person/);
  const imported = fresh(); imported.workspace.visits[1].imported = { batchId: 'b', row: 1, at: now, by: 'importer', byName: 'Importer', role: 'clinician', planHash: 'h', fileDigest: 'd', sourceSystem: 'Legacy' };
  refuses(() => R.applyFactReuse(imported, cmd(), actor('asha-1'), member('asha-1', 'asha'), now), 409, /imported from another system/);
  const unconfirmed = fresh(); unconfirmed.workspace.visits[1].state = 'draft';
  refuses(() => R.applyFactReuse(unconfirmed, cmd(), actor('asha-1'), member('asha-1', 'asha'), now), 409, /confirmed visit/);
  const unrecorded = fresh(); unrecorded.workspace.visits[1].facts = { ...src, weight: '', provenance: { weight: { source: 'declined' } } };
  refuses(() => R.applyFactReuse(unrecorded, cmd(), actor('asha-1'), member('asha-1', 'asha'), now), 422, /was not recorded/);
  // 6. A dispute on the reused measurement blocks reuse; a resolved dispute or one on another measurement does not.
  const disputed = fresh(); disputed.workspace.visits[1].disputes = [{ id: 'd1', target: 'fact:weight', reason: 'Scale not zeroed', reference: 'home record', by: 'c1', byName: 'Clinician One', accountCode: 'C'.repeat(24), role: 'clinician', at: now, visitVersion: 1, contentHash: 'h', valueText: '60' }];
  refuses(() => R.applyFactReuse(disputed, cmd(), actor('asha-1'), member('asha-1', 'asha'), now), 409, /disputed/);
  const resolved = fresh(); resolved.workspace.visits[1].disputes = [{ id: 'd1', target: 'fact:weight' }]; resolved.workspace.visits[1].disputeResolutions = [{ id: 'r1', disputeId: 'd1', outcome: 'stands', by: 'c2', byName: 'Clinician Two', accountCode: 'D'.repeat(24), at: now, evidence: 'Scale checked and zeroed' }];
  check(() => assert.equal(R.applyFactReuse(resolved, cmd(), actor('asha-1'), member('asha-1', 'asha'), now).measure, 'weight', 'a resolved dispute no longer blocks reuse'));
  const otherMeasureDispute = fresh(); otherMeasureDispute.workspace.visits[1].disputes = [{ id: 'd1', target: 'fact:temperature' }];
  check(() => assert.equal(R.applyFactReuse(otherMeasureDispute, cmd(), actor('asha-1'), member('asha-1', 'asha'), now).measure, 'weight', 'a dispute on another measurement does not block'));
  // 7. A successful reuse copies the value and provenance, bumps the visit version and writes an audit event.
  const s = fresh(), done = R.applyFactReuse(s, cmd(), actor('asha-1'), member('asha-1', 'asha'), now);
  check(() => { const v = s.workspace.visits[0]; assert.equal(done.measure, 'weight'); assert.equal(done.sourceVisitId, 'v-src'); assert.equal(v.facts.weight, '60'); assert.deepEqual(v.facts.provenance.weight, { source: 'measured', at: '2026-09-28T08:00' }); assert.equal(v.version, 3, 'visit version bumped'); assert.equal(v.state, 'draft', 'still a draft'); });
  check(() => { const a = s.workspace.audit.at(-1); assert.equal(a.action, 'reuseFact'); assert.equal(a.personId, 'p1'); assert.equal(a.subject, 'v-new'); assert.match(a.detail, /Weight reused from an earlier confirmed visit \(v-src\)/); });
  // 8. The schema: strict, known measures only.
  check(() => assert.equal(R.factReuseSchema.safeParse(cmd()).success, true));
  check(() => assert.equal(R.factReuseSchema.safeParse(cmd({ measure: 'pulse' })).success, false));
  check(() => assert.equal(R.factReuseSchema.safeParse(cmd({ extra: 1 })).success, false));
} finally { rmSync(dir, { recursive: true, force: true }); }
writeFileSync('tests/fact-reuse-contract-result.json', JSON.stringify({ passed, completedAt: new Date().toISOString(), coverage: 'Cross-visit reuse of a recorded measurement with provenance (slice R33, BR-DATA-12): reusedMeasurement copying the value field(s) and the effective source and observation time (per-measurement and visit-level fallback), dropping stale entered-unit and unusual-value reasons, and the reuseFact command (care role, stale version, self and cross-person source, imported read-only source, non-confirmed source and unrecorded measurement refusals; an open dispute on the measurement blocking reuse while a resolved dispute or a dispute on another measurement does not; a successful reuse carrying value and provenance forward, bumping the visit version and writing the audit event; the strict schema).' }, null, 2) + '\n');
console.log(`${passed} fact reuse contract checks passed`);
