// SAHA-155 / CWO-021: actual built local Worker/D1 contextual learning checks.
// All content and identities are synthetic; no Academy provider is contacted.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { globSync } from 'node:fs';
import { startWorker, identity, client } from '../lib/worker.mjs';
import { suite } from '../lib/report.mjs';

const state = process.env.SAHA_ACADEMY_TEST_STATE ?? '.wrangler/contextual-academy-http-state';
const port = process.env.SAHA_TEST_PORT ?? '9491';
const output = process.env.SAHA_ACADEMY_REPORT_FILE ?? 'tests/reports/contextual-academy-http-result.json';
const report = suite('Contextual Aplyd Academy learning', output, { layer: 'integration', limits: [
  'Actual built local Worker/D1 with synthetic users, source-hashed synthetic content, and native audit interposition.',
  'No external Academy provider, real patient, content approval, formal acceptance, CI, hosted, or field-device claim.',
] });
const checks = [];
const check = async (label, fn) => { await report.check(label, fn); checks.push(label); };
const ok = response => { assert.equal(response.status, 200, response.text); return response.json; };
const literal = value => "'" + String(value).replaceAll("'", "''") + "'";
const content = {
  id: 'routine-review-basics', title: 'Review a routine draft', summary: 'Optional synthetic workflow learning.',
  content: 'Review the selected task and return to the unchanged routine draft.', task: 'routine-visit', actorRoles: ['asha'],
  source: { kind: 'aplyd-academy', reference: 'academy:health-workflow-review', edition: '2026.10-approved' },
};
const hash = createHash('sha256').update(JSON.stringify(content)).digest('hex');
const validCatalogue = JSON.stringify({ version: 'saha-contextual-academy/1', items: [{ ...content, source: { ...content.source, contentHash: hash } }] });
let worker, sql, trigger;
try {
  worker = await startWorker({ port, name: 'saha-contextual-academy', state, vars: { SAHA_ACADEMY_CONTEXT_CATALOGUE: validCatalogue } });
  const api = client(worker.base), run = crypto.randomUUID().slice(0, 8), owner = identity('owner', run), asha = identity('asha', run), outsider = identity('outsider', run);
  const ownerWorkspace = ok(await api.get(owner, '/api/workspace')), ashaHome = ok(await api.get(asha, '/api/workspace')), org = ownerWorkspace.organisation.id;
  const invite = ok(await api.command(owner, { type: 'createInvite', accountCode: ashaHome.user.accountCode, label: 'Synthetic Academy ASHA', role: 'asha', teamIds: ['default'] }, org));
  ok(await api.command(asha, { type: 'joinOrganisation', token: invite.result.token }));
  const selected = ok(await api.get(owner, '/api/workspace', org)).people.find(person => person.id === 'p_meena');
  ok(await api.command(owner, { type: 'assignPatient', personId: selected.id, version: selected.version, teamId: 'default', assignedTo: asha.id, reason: 'Synthetic contextual learning assignment' }, org));
  const file = globSync(state + '/**/*.sqlite').find(path => !path.includes('cache')); assert.ok(file); sql = new DatabaseSync(file);
  const path = '/api/contextual-academy?personId=p_meena';
  const positive = await api.get(asha, path, org), view = ok(positive);
  await check('Current assigned ASHA receives source-bound learning', () => { assert.equal(view.status, 'available'); assert.equal(view.items.length, 1); assert.equal(view.items[0].source.contentHash, hash); });
  await check('Response adds no login or care gate', () => { assert.equal(view.requiresAdditionalLogin, false); assert.equal(view.careGate, false); assert.equal(view.optional, true); });
  await check('Response records no inferred completion', () => assert.equal(view.completionTracking, 'none'));
  await check('Response contains no patient or visit payload', () => { const wire = JSON.stringify(view); assert.doesNotMatch(wire, /p_meena|personId|patientId|visitId|organisationId|assignedTo/); });
  await check('Response is bound to the authenticated actor', () => assert.equal(positive.headers.get('x-saha-operation-actor'), asha.id));
  await check('Response is private and non-sniffable', () => { assert.equal(positive.headers.get('cache-control'), 'no-store'); assert.equal(positive.headers.get('x-content-type-options'), 'nosniff'); });
  await check('Learning read is durably audited without content or person name', () => { const row = sql.prepare("SELECT detail FROM audit_events WHERE org_id=? AND actor_id=? AND action='viewPatientRecord' AND person_id='p_meena' ORDER BY id DESC").get(org, asha.id); assert.match(row.detail, /Contextual learning eligibility only/); assert.doesNotMatch(row.detail, /Meena|Review a routine draft/); });

  await check('Anonymous request is refused', async () => assert.equal((await api.get(null, path, org)).status, 401));
  await check('Owner role cannot use ASHA contextual learning', async () => assert.equal((await api.get(owner, path, org)).status, 403));
  await check('Non-member cannot select the organisation', async () => assert.ok([403, 404].includes((await api.get(outsider, path, org)).status)));
  await check('Unassigned person is refused', async () => assert.equal((await api.get(asha, '/api/contextual-academy?personId=p_rahul', org)).status, 404));
  await check('Extra selector is refused', async () => assert.equal((await api.get(asha, path + '&visitId=v_other', org)).status, 400));
  await check('Duplicate selector is refused', async () => assert.equal((await api.get(asha, path + '&personId=p_meena', org)).status, 400));

  const membership = sql.prepare('SELECT version FROM memberships WHERE org_id=? AND user_id=?').get(org, asha.id);
  trigger = 'qa_contextual_academy_revoke_' + run.replaceAll('-', '_');
  sql.exec('CREATE TRIGGER ' + trigger + " AFTER INSERT ON audit_events WHEN NEW.org_id=" + literal(org) + " AND NEW.actor_id=" + literal(asha.id) + " AND NEW.action='viewPatientRecord' AND NEW.detail LIKE 'Contextual learning eligibility only%' BEGIN UPDATE memberships SET status='suspended',version=version+1 WHERE org_id=" + literal(org) + ' AND user_id=' + literal(asha.id) + " AND status='active' AND version=" + membership.version + '; END');
  const raced = await api.get(asha, path, org);
  sql.exec('DROP TRIGGER ' + trigger); trigger = null;
  await check('Changed authority during the read refuses before disclosure', () => { assert.equal(raced.status, 403); assert.deepEqual(Object.keys(raced.json), ['error']); });
  const suspended = sql.prepare('SELECT version FROM memberships WHERE org_id=? AND user_id=?').get(org, asha.id);
  ok(await api.command(owner, { type: 'updateMember', userId: asha.id, version: suspended.version, role: 'asha', teamIds: ['default'], isOwner: false, status: 'active', reason: 'Synthetic restore after contextual learning race' }, org));
  await check('Restored current authority permits a fresh learning read', async () => assert.equal((await api.get(asha, path, org)).status, 200));

  await worker.stop(); worker = null;
  worker = await startWorker({ port, name: 'saha-contextual-academy-invalid', state, fresh: false, vars: { SAHA_ACADEMY_CONTEXT_CATALOGUE: '{invalid' } });
  const invalidApi = client(worker.base), invalid = ok(await invalidApi.get(asha, path, org));
  await check('Invalid catalogue fails closed to a non-blocking unavailable state', () => { assert.equal(invalid.status, 'unavailable'); assert.equal(invalid.reason, 'invalid-configuration'); assert.equal(invalid.careGate, false); });
  await check('Invalid catalogue does not block the ordinary routine task', async () => { const routine = await invalidApi.get(asha, '/api/routine-visit?personId=p_meena', org); assert.equal(routine.status, 200); assert.equal(routine.json.person.id, 'p_meena'); });
  await check('No external provider was contacted or completion record written', () => { assert.equal(sql.prepare("SELECT count(*) AS n FROM command_receipts WHERE command_type LIKE '%academy%' OR result LIKE '%routine-review-basics%'").get().n, 0); });
  await report.finish({ checks, realProvidersCalled: false, syntheticContentOnly: true });
} catch (cause) {
  await report.finish({ checks, error: String(cause), fixtureIncomplete: true });
  throw cause;
} finally {
  if (trigger && sql) sql.exec('DROP TRIGGER IF EXISTS ' + trigger);
  sql?.close(); await worker?.stop();
}
