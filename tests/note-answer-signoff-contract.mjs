// Slice 2g contract: author of visit notes and programme answers from the server identity, clinician verification of
// them (verifyEntry), the owner's sign-off policy, supervisor sign-off bound to the visit content, and the server checks
// before executePlan and inside the delivery checkpoint (executeMis) so a missing or stale sign-off never sends.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = mkdtempSync(join(process.cwd(), '.note-answer-signoff-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const refuses = async (fn, status, pattern) => { await assert.rejects(async () => fn(), e => e.status === status && pattern.test(e.message), String(pattern)); passed++; };
try {
  for (const f of ['abdm', 'abdm-transfer', 'access', 'action-plan', 'adapter-operations', 'agent', 'agent-minimisation', 'ai-budget', 'alerts', 'anaemia', 'audit-chain', 'capability-lifecycle', 'caseload', 'consent', 'continuity', 'core', 'delegation', 'ehr', 'environment', 'evaluation', 'exceptional', 'expansion', 'facility-scope', 'fact-provenance', 'fact-verification', 'fhir-document', 'fhir-validate', 'field', 'field-device', 'field-registration', 'governance', 'household', 'household-constants', 'household-visit', 'household-visit-constants', 'identity', 'imported-visits', 'media', 'merge', 'mis', 'mis-execution', 'operations', 'outreach', 'pack-installation', 'partition', 'pilot', 'programme-commands', 'programmes', 'provider-sandbox', 'purpose-scope', 'referral-needs', 'referral-request', 'referral-rules', 'retention', 'rights', 'seed', 'send-gate', 'service-identity', 'shadow', 'store', 'task-limits', 'trace', 'types', 'visit-signoff', 'withdrawal-notices'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  writeFileSync(join(dir, 'store.js'), `export let saved;export function setup(s){saved=structuredClone(s)}export async function readState(){return structuredClone(saved)}export function scope(s,id){return s.members.find(m=>m.userId===id)}export async function persist(db,before,after){saved=structuredClone(after);}`);
  const S = await import(pathToFileURL(join(dir, 'visit-signoff.js')));
  const F = await import(pathToFileURL(join(dir, 'fact-verification.js')));
  const P = await import(pathToFileURL(join(dir, 'fact-provenance.js')));
  const G = await import(pathToFileURL(join(dir, 'programme-commands.js')));
  const store = await import(pathToFileURL(join(dir, 'store.js')));
  const { executeMis } = await import(pathToFileURL(join(dir, 'mis-execution.js')));
  const now = '2026-10-01T06:00:00.000Z';
  const asha = { userId: 'asha-1', name: 'Synthetic ASHA', accountCode: 'A'.repeat(24), role: 'asha', at: now };
  const clin = { userId: 'clin-1', name: 'Synthetic clinician', accountCode: 'B'.repeat(24), role: 'clinician', at: '2026-10-01T07:00:00.000Z' };
  // 1. Author stamping for notes and answers (an answer or an absence reason, keyed by question id).
  const c1 = { notes: 'Synthetic notes.', answers: { medication_access: 'Available' }, absence: { weight: 'Not measured' } };
  const e1 = P.stampEntryAuthors(undefined, c1, undefined, asha);
  check(() => { assert.equal(e1.noteAuthor.userId, 'asha-1'); assert.deepEqual(Object.keys(e1.answerAuthors).sort(), ['medication_access', 'weight']); assert.equal(e1.answerAuthors.weight.role, 'asha'); });
  const e2 = P.stampEntryAuthors(c1, { ...c1, answers: { medication_access: 'Access difficulty' } }, e1, clin);
  check(() => { assert.equal(e2.answerAuthors.medication_access.userId, 'clin-1'); assert.equal(e2.answerAuthors.weight.userId, 'asha-1'); assert.equal(e2.noteAuthor.userId, 'asha-1', 'unchanged notes keep their author'); });
  const e3 = P.stampEntryAuthors(c1, { ...c1, notes: '', absence: {} }, e1, clin);
  check(() => { assert.equal(e3.noteAuthor, undefined, 'cleared notes lose the author'); assert.deepEqual(Object.keys(e3.answerAuthors), ['medication_access']); });
  const e4 = P.stampEntryAuthors(c1, { ...c1 }, undefined, clin);
  check(() => { assert.equal(e4.noteAuthor, undefined, 'older notes are never attributed to a later saver'); assert.equal(e4.answerAuthors, undefined); });
  check(() => assert.deepEqual(P.entryKeys({ facts: { notes: 'x' }, programmeCapture: { packs: [], ...c1 } }), ['notes', 'answer:medication_access', 'answer:weight']));
  // A client cannot send authors: they are dropped from the programme answer command.
  check(() => { const r = G.programmeSchema.safeParse({ type: 'saveProgrammeAnswers', visitId: 'v', version: 1, answers: {}, absence: {}, answerAuthors: { x: asha } }); assert.equal(r.success, true); assert.equal(r.data.answerAuthors, undefined); });
  // 2. recordFactAuthors over whole states: a programme-answer save credits the actor; a correction draft keeps authors.
  const member = (userId, role, teamIds = ['default'], extra = {}) => ({ userId, displayName: userId, accountCode: userId.toUpperCase().padEnd(24, '0').slice(0, 24), role, isOwner: false, status: 'active', version: 1, teamIds, createdAt: now, ...extra });
  const actor = id => ({ userId: id, displayName: `Name ${id}`, email: `${id}@example.invalid` });
  const facts = { date: '2026-10-01T04:00', systolic: '130', diastolic: '85', weight: '60', temperature: '', weeks: '', coughDays: '', notes: 'Synthetic notes.', source: 'measured' };
  const pack = { id: 'hypertension', version: 1, name: 'Hypertension follow-up', programme: 'Chronic care', questions: [{ id: 'medication_access', label: 'Reported access to prescribed medicines', options: ['Available', 'Access difficulty'], required: true }] };
  const capture = () => ({ packs: [{ enrolmentId: 'e1', pack: structuredClone(pack) }], answers: { medication_access: 'Available' }, absence: {} });
  const person = { id: 'p1', name: 'Synthetic Person', programmes: ['Chronic care'], status: 'completed', exchangeConsent: true, consentVersion: 1, assigned: true, version: 1, teamId: 'default', assignedTo: 'asha-1' };
  const visit = (id, extra = {}) => ({ id, personId: 'p1', version: 4, state: 'confirmed', facts: structuredClone(facts), createdAt: now, aiResults: [], recordVersion: 3, programmeCapture: capture(), patientCheck: { personId: 'p1', personVersion: 1, by: 'asha-1', at: now }, noteAuthor: { ...asha }, answerAuthors: { medication_access: { ...asha } }, ...extra });
  const state = (visits, operations) => ({ organisation: { id: 'org', name: 'Org', revision: 1, createdAt: now }, teams: [{ id: 'default', name: 'Care', createdAt: now }, { id: 'north', name: 'North', createdAt: now }], members: [], invitations: [], workspace: { schemaVersion: 1, revision: 1, role: 'clinician', people: [structuredClone(person)], visits, integrations: [], submissions: [], referrals: [], audit: [], receipts: {} }, ...(operations ? { operations } : {}) });
  const draft = state([visit('v1', { state: 'draft', noteAuthor: undefined, answerAuthors: undefined, programmeCapture: { ...capture(), answers: {} } })]);
  const saved = structuredClone(draft); saved.workspace.visits[0].programmeCapture.answers = { medication_access: 'Available' }; saved.workspace.visits[0].facts.notes = 'Synthetic notes, edited.';
  F.recordFactAuthors(draft, saved, actor('asha-1'), member('asha-1', 'asha'), now);
  check(() => { const v = saved.workspace.visits[0]; assert.equal(v.answerAuthors.medication_access.userId, 'asha-1'); assert.equal(v.noteAuthor.userId, 'asha-1'); assert.equal(v.noteAuthor.role, 'asha'); });
  const before = state([visit('v1')]), after = structuredClone(before);
  after.workspace.visits.push(visit('v2', { state: 'draft', amendsVisitId: 'v1', version: 1, recordVersion: 1, noteAuthor: undefined, answerAuthors: undefined, patientCheck: undefined })); after.workspace.visits[0].supersededBy = 'v2';
  F.recordFactAuthors(before, after, actor('clin-1'), member('clin-1', 'clinician'), now);
  check(() => { const v2 = after.workspace.visits[1]; assert.equal(v2.noteAuthor.userId, 'asha-1', 'copied notes keep their author'); assert.equal(v2.answerAuthors.medication_access.userId, 'asha-1'); assert.equal(v2.signOffs, undefined); });
  // 3. verifyEntry: role, scope, state, version, entry, reason and self rules; appended, audited, content unchanged.
  const fresh = (ops) => state([visit('v1')], ops);
  const cmd = over => ({ type: 'verifyEntry', visitId: 'v1', recordVersion: 3, entry: 'notes', decision: 'verified', ...over });
  check(() => assert.equal(S.signOffSchema.safeParse(cmd({ extra: 1 })).success, false));
  check(() => assert.equal(S.signOffSchema.safeParse(cmd({ entry: 'answer:../x' })).success, false));
  await refuses(() => S.applySignOff(fresh(), cmd(), actor('asha-2'), member('asha-2', 'asha'), now), 403, /clinician with current care scope/);
  await refuses(() => S.applySignOff(fresh(), cmd(), actor('sup-1'), member('sup-1', 'supervisor'), now), 403, /clinician with current care scope/);
  await refuses(() => S.applySignOff(fresh(), cmd(), actor('clin-2'), member('clin-2', 'clinician', ['north']), now), 403, /outside your care scope/);
  const emergency = fresh(); emergency.workspace.people[0].exceptionalAccess = [{ userId: 'clin-2', until: '2099-01-01T00:00:00.000Z' }];
  await refuses(() => S.applySignOff(emergency, cmd(), actor('clin-2'), member('clin-2', 'clinician', ['north']), now), 403, /outside your care scope/);
  const d = fresh(); d.workspace.visits[0].state = 'draft';
  await refuses(() => S.applySignOff(d, cmd(), actor('clin-1'), member('clin-1', 'clinician'), now), 409, /confirmed visit/);
  await refuses(() => S.applySignOff(fresh(), cmd({ recordVersion: 2 }), actor('clin-1'), member('clin-1', 'clinician'), now), 409, /changed/);
  await refuses(() => S.applySignOff(fresh(), cmd({ entry: 'answer:testing' }), actor('clin-1'), member('clin-1', 'clinician'), now), 422, /not recorded/);
  await refuses(() => S.applySignOff(fresh(), cmd({ decision: 'disputed', reason: 'short' }), actor('clin-1'), member('clin-1', 'clinician'), now), 422, /at least 10 characters/);
  const own = fresh(); own.workspace.visits[0].noteAuthor = { ...clin };
  await refuses(() => S.applySignOff(own, cmd(), actor('clin-1'), member('clin-1', 'clinician'), now), 403, /different clinician/);
  const s3 = fresh(), done = await S.applySignOff(s3, cmd(), actor('clin-1'), member('clin-1', 'clinician'), now);
  check(() => { const v = s3.workspace.visits[0]; assert.equal(done.state, 'verified'); assert.equal(v.entryReviews.length, 1); assert.equal(v.entryReviews[0].by, 'clin-1'); assert.equal(v.version, 4); assert.deepEqual(v.facts, facts); });
  check(() => { const a = s3.workspace.audit.at(-1); assert.equal(a.action, 'verifyEntry'); assert.equal(a.personId, 'p1'); assert.match(a.detail, /Visit notes verified/); });
  await refuses(() => S.applySignOff(s3, cmd(), actor('clin-1'), member('clin-1', 'clinician'), now), 409, /already verified/);
  await S.applySignOff(s3, cmd({ entry: 'answer:medication_access', decision: 'disputed', reason: 'Medicine stock was not checked.' }), actor('clin-3'), member('clin-3', 'clinician'), now);
  await S.applySignOff(s3, cmd({ decision: 'disputed', reason: 'Notes contradict the measured weight.' }), actor('clin-3'), member('clin-3', 'clinician'), now);
  check(() => { const v = s3.workspace.visits[0]; assert.deepEqual(v.entryReviews.map(r => [r.entry, r.state]), [['notes', 'verified'], ['answer:medication_access', 'disputed'], ['notes', 'disputed']]); assert.equal(P.entryReview(v, 'notes').state, 'disputed'); assert.equal(v.factReviews, undefined, 'measurement reviews untouched'); });
  // 4. The owner's sign-off policy: owner only, versioned, a change each time, audited.
  const pol = over => ({ type: 'setSignOffPolicy', required: true, version: 0, reason: 'Pilot requires supervisor review.', ...over });
  check(() => assert.equal(S.signOffSchema.safeParse(pol({ reason: 'short' })).success, false));
  await refuses(() => S.applySignOff(fresh(), pol(), actor('sup-1'), member('sup-1', 'supervisor'), now), 403, /owner/);
  const ps = fresh(), set = await S.applySignOff(ps, pol(), actor('own-1'), member('own-1', 'admin', [], { isOwner: true }), now);
  check(() => { assert.deepEqual(set, { required: true, version: 1 }); assert.equal(S.signOffPolicy(ps).changes.length, 1); assert.equal(ps.workspace.audit.at(-1).action, 'setSignOffPolicy'); });
  await refuses(() => S.applySignOff(ps, pol({ version: 1 }), actor('own-1'), member('own-1', 'admin', [], { isOwner: true }), now), 409, /already required/);
  await refuses(() => S.applySignOff(ps, pol({ required: false }), actor('own-1'), member('own-1', 'admin', [], { isOwner: true }), now), 409, /policy changed/);
  // 5. signOffVisit: supervisor of the patient's team (or a supervision delegate), not a recorder, current confirmed visit.
  const so = over => ({ type: 'signOffVisit', visitId: 'v1', recordVersion: 3, ...over });
  await refuses(() => S.applySignOff(fresh(), so(), actor('clin-1'), member('clin-1', 'clinician'), now), 403, /supervisor of the patient/);
  await refuses(() => S.applySignOff(fresh(), so(), actor('sup-2'), member('sup-2', 'supervisor', ['north']), now), 403, /supervisor of the patient|not assigned|outside/);
  await refuses(() => S.applySignOff(fresh(), so(), actor('adm'), member('adm', 'admin', ['default'], { isOwner: true }), now), 403, /supervisor of the patient/);
  const rec = fresh(); rec.workspace.visits[0].patientCheck.by = 'sup-1';
  await refuses(() => S.applySignOff(rec, so(), actor('sup-1'), member('sup-1', 'supervisor'), now), 403, /different person/);
  const dr = fresh(); dr.workspace.visits[0].state = 'draft';
  await refuses(() => S.applySignOff(dr, so(), actor('sup-1'), member('sup-1', 'supervisor'), now), 409, /confirmed visit/);
  await refuses(() => S.applySignOff(fresh(), so({ recordVersion: 1 }), actor('sup-1'), member('sup-1', 'supervisor'), now), 409, /changed/);
  const ss = fresh(), signed = await S.applySignOff(ss, so({ note: 'Reviewed with the worker.' }), actor('sup-1'), member('sup-1', 'supervisor'), now);
  check(() => { const v = ss.workspace.visits[0], x = v.signOffs[0]; assert.equal(signed.signOffId, x.id); assert.equal(x.by, 'sup-1'); assert.equal(x.role, 'supervisor'); assert.equal(x.visitVersion, 4); assert.match(x.contentHash, /^[a-f0-9]{64}$/); assert.equal(x.delegationId, undefined); assert.equal(ss.workspace.audit.at(-1).personId, 'p1'); });
  await refuses(() => S.applySignOff(ss, so(), actor('sup-3'), member('sup-3', 'supervisor'), now), 409, /already has a current sign-off/);
  const until = '2026-10-10T00:00:00.000Z', deleg = { id: 'dg1', version: 1, kind: 'team-supervision', grantorId: 'sup-1', delegateId: 'clin-5', teamIds: ['default'], from: '2026-09-30T00:00:00.000Z', until, reason: 'Leave cover for supervision.', createdAt: now };
  const ds = fresh({ version: 1, maintenance: false, reason: '', updatedAt: '', incidents: [], rates: null, delegations: [deleg] }); ds.members = [member('sup-1', 'supervisor'), member('clin-5', 'clinician')];
  await S.applySignOff(ds, so(), actor('clin-5'), ds.members[1], now);
  check(() => { assert.equal(ds.workspace.visits[0].signOffs[0].delegationId, 'dg1'); assert.deepEqual(ds.delegationUsed.map(x => x.id), ['dg1']); });
  // 6. A sign-off is current only while the visit content and version match it.
  const v6 = ss.workspace.visits[0];
  assert.equal((await S.currentSignOff(v6))?.id, signed.signOffId); passed++;
  assert.equal(await S.currentSignOff({ ...v6, facts: { ...v6.facts, notes: 'Changed after sign-off.' } }), null); passed++;
  assert.equal(await S.currentSignOff({ ...v6, programmeCapture: { ...v6.programmeCapture, answers: { medication_access: 'Access difficulty' } } }), null); passed++;
  assert.equal(await S.currentSignOff({ ...v6, version: 5 }), null); passed++;
  assert.equal(await S.currentSignOff({ ...v6, supersededBy: 'v9' }), null); passed++;
  // 7. executePlan check: policy off passes, policy on needs a current sign-off; completed plans are idempotent.
  const exec = { type: 'executePlan', visitId: 'v1', planId: 'plan1' };
  const withPlan = (st, planState = 'approved') => { st.workspace.visits[0].plan = { id: 'plan1', state: planState, recipients: ['mis0'] }; st.workspace.integrations = [{ id: 'mis0', name: 'Synthetic programme', kind: 'mis', mode: 'demo', status: 'active', version: 1, programmes: ['Chronic care'] }]; return st; };
  assert.equal(await S.ensureSignOff(withPlan(fresh()), exec), null); passed++;
  await refuses(() => S.ensureSignOff(withPlan(structuredClone(ps)), exec), 409, /sign-off is required/);
  const ok = withPlan(structuredClone(ss)); ok.operations = ps.operations;
  assert.equal((await S.ensureSignOff(ok, exec)).id, signed.signOffId); passed++;
  assert.equal(await S.ensureSignOff(withPlan(structuredClone(ps), 'completed'), exec), null); passed++;
  const stamped = structuredClone(ok); stamped.workspace.submissions.push({ id: 'new' }); S.stampSubmissions(ok, stamped, ok.workspace.visits[0].signOffs[0]);
  check(() => assert.equal(stamped.workspace.submissions[0].signOff.by, 'sup-1'));
  // 8. The delivery checkpoint (executeMis) refuses a missing or stale sign-off before the request; a current one sends.
  const i = { id: 'mis1', kind: 'mis', mode: 'http', status: 'active', version: 1, endpoint: 'https://programme.example/api', credentialBinding: 'SAHA_MIS_TEST' };
  const env = { SAHA_EXTERNAL_APIS_ENABLED: 'true', SAHA_MIS_TEST: 'test', SAHA_MIS_CONNECTIONS: JSON.stringify([{ organisationId: 'org', integrationId: 'mis1', origin: 'https://programme.example', credentialBinding: 'SAHA_MIS_TEST' }]) };
  const deliveryState = withSign => { const st = structuredClone(withSign ? ss : fresh()); st.operations = structuredClone(ps.operations); st.members = [member('asha-1', 'asha')]; st.workspace.integrations = [i];
    st.workspace.submissions = [{ id: 'sub', visitId: 'v1', personId: 'p1', connectorId: 'mis1', state: 'queued', attempts: 0, payloadHash: 'a'.repeat(64), delivery: { endpoint: i.endpoint, credentialBinding: i.credentialBinding, key: 'sub', actorId: 'asha-1', connectorVersion: 1, personVersion: 1, consentVersion: 1, visitVersion: 4, expiresAt: new Date(Date.now() + 60000).toISOString(), payload: { operation: 'submit', fields: {} }, events: [] } }]; return st; };
  const receipt = { contract: 'saha-mis-v1', key: 'sub', payloadHash: 'a'.repeat(64), status: 'accepted', receipt: 'PARTNER-1' };
  let calls = 0; const transport = async () => { calls++; return receipt; };
  const send = { type: 'sendSubmission', submissionId: 'sub' }, worker = member('asha-1', 'asha');
  let st = deliveryState(false); store.setup(st);
  await refuses(() => executeMis({}, st, send, actor('asha-1'), worker, 'k1', 'h', env, transport), 409, /sign-off is missing or stale/);
  check(() => { assert.equal(calls, 0); assert.equal(store.saved.workspace.submissions[0].state, 'queued'); assert.equal(store.saved.workspace.submissions[0].attempts, 0); });
  st = deliveryState(true); st.workspace.visits[0].facts.notes = 'Edited after sign-off without a version change.'; store.setup(st);
  await refuses(() => executeMis({}, st, send, actor('asha-1'), worker, 'k2', 'h', env, transport), 409, /missing or stale/);
  check(() => assert.equal(calls, 0, 'a stale sign-off never authorizes a send'));
  st = deliveryState(true); store.setup(st);
  const r = await executeMis({}, st, send, actor('asha-1'), worker, 'k3', 'h', env, transport);
  check(() => { assert.equal(calls, 1); assert.equal(r.state, 'accepted'); assert.equal(store.saved.workspace.submissions[0].signOff.by, 'sup-1'); });
  const result = { passed, suite: 'slice 2g: note and answer authors, verifyEntry, sign-off policy, supervisor sign-off and send checks', completedAt: new Date().toISOString() };
  writeFileSync('tests/note-answer-signoff-contract-result.json', JSON.stringify(result, null, 2) + '\n'); console.log(result);
} finally { rmSync(dir, { recursive: true, force: true }); }
