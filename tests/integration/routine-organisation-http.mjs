// D03 A4/A5/A6, BR-ID-02 and BR-SEC-08: pin one routine HTTP operation to its initially resolved organisation.
// Actual built loopback Worker/D1 with synthetic identities. No provider calls or immutable-history rewrites.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { globSync, mkdirSync, writeFileSync } from 'node:fs';
import { startWorker, identity, client } from '../lib/worker.mjs';
import { suite } from '../lib/report.mjs';

const folder = process.env.SAHA_ORG_EVIDENCE_DIR ?? 'tests/reports/routine-organisation-http';
const state = process.env.SAHA_ORG_TEST_STATE ?? '.wrangler/routine-organisation-http-state';
const port = process.env.SAHA_TEST_PORT ?? '9479';
const report = suite('Routine operation resolved organisation pinning', process.env.SAHA_ORG_REPORT_FILE ?? 'tests/reports/routine-organisation-http-result.json', {
  layer: 'integration',
  limits: ['Built local Worker/native D1 with two synthetic organisations and native audit interposition only.', 'No global ACL, full NFR, physical device, clinical/UAT, hosted/provider acceptance.'],
});
mkdirSync(folder, { recursive: true });
let worker, sql, activeTrigger, finished = false;
const observations = [];
const check = async (value, label) => { await report.check(label, () => assert.ok(value, label)); if (value) console.log('PASS', label); };
const ok = response => { assert.equal(response.status, 200, response.text); return response.json; };
const literal = value => "'" + String(value).replaceAll("'", "''") + "'";
const hash = value => createHash('sha256').update(value).digest('hex');
const privatePerson = response => !!(response.json?.person || response.json?.context?.person);
const privacy = async (response, label) => {
  await check(response.headers.get('cache-control')?.toLowerCase() === 'no-store', label + ' private response is no-store');
  await check(response.headers.get('x-content-type-options')?.toLowerCase() === 'nosniff', label + ' private response is nosniff');
};
const writeObservation = value => { observations.push(value); writeFileSync(folder + '/observations.json', JSON.stringify(observations, null, 2) + '\n'); };

try {
  worker = await startWorker({ port, name: 'saha-routine-org-independent', state });
  const api = client(worker.base), run = crypto.randomUUID().slice(0, 8);
  const ownerA = identity('owner-a', run), ownerB = identity('owner-b', run), asha = identity('asha', run);
  const workspaceA = ok(await api.get(ownerA, '/api/workspace'));
  const workspaceB = ok(await api.get(ownerB, '/api/workspace'));
  const account = ok(await api.get(asha, '/api/workspace'));
  const orgA = workspaceA.organisation.id, orgB = workspaceB.organisation.id;
  for (const [owner, org] of [[ownerA, orgA], [ownerB, orgB]]) {
    const invite = ok(await api.command(owner, { type: 'createInvite', accountCode: account.user.accountCode, label: 'Synthetic routine organisation pin ASHA', role: 'asha', teamIds: ['default'] }, org));
    ok(await api.command(asha, { type: 'joinOrganisation', token: invite.result.token }));
    const person = ok(await api.get(owner, '/api/workspace', org)).people.find(person => person.id === 'p_meena');
    assert.ok(person, 'Actual owner workspace contains same stable synthetic person ID');
    ok(await api.command(owner, { type: 'assignPatient', personId: person.id, version: person.version, teamId: 'default', assignedTo: asha.id, reason: 'Synthetic same-person-ID two-organisation HTTP pin fixture' }, org));
  }
  const file = globSync(state + '/**/*.sqlite').find(path => !path.includes('cache'));
  assert.ok(file, 'Real isolated native SQLite fixture'); sql = new DatabaseSync(file);
  const activeOrg = () => sql.prepare('SELECT active_org_id FROM accounts WHERE user_id=?').get(asha.id).active_org_id;
  const clinical = org => JSON.stringify({ patients: sql.prepare('SELECT org_id,id,version,data FROM patients WHERE org_id=? ORDER BY id').all(org), visits: sql.prepare('SELECT org_id,id,version,data FROM visits WHERE org_id=? ORDER BY id').all(org) });
  const audit = () => sql.prepare('SELECT * FROM audit_events WHERE org_id IN (?,?) ORDER BY org_id,id').all(orgA, orgB);
  const receipt = key => sql.prepare('SELECT * FROM command_receipts WHERE actor_id=? AND key=?').get(asha.id, key);
  const visitCount = org => sql.prepare("SELECT count(*) AS n FROM visits WHERE org_id=? AND json_extract(data,'$.personId')='p_meena'").get(org).n;
  const writeCount = org => sql.prepare("SELECT count(*) AS n FROM audit_events WHERE org_id=? AND actor_id=? AND action='startVisit' AND person_id='p_meena'").get(org, asha.id).n;
  const preservePrefix = async (previous, label) => {
    const current = new Map(audit().map(row => [row.org_id + '/' + row.id, JSON.stringify(row)]));
    await check(previous.every(row => current.get(row.org_id + '/' + row.id) === JSON.stringify(row)), label + ' prior immutable audit prefix remains byte exact');
  };
  const selectA = async () => { ok(await api.command(asha, { type: 'switchOrganisation', organisationId: orgA })); };
  const installSwitch = timing => {
    const name = 'qa_org_pin_' + timing.toLowerCase() + '_' + run.replaceAll('-', '_'); activeTrigger = name;
    sql.exec('CREATE TRIGGER ' + name + ' ' + timing + ' INSERT ON audit_events WHEN NEW.org_id=' + literal(orgA) + ' AND NEW.actor_id=' + literal(asha.id) + " AND NEW.action='viewPatientRecord' AND NEW.person_id='p_meena' AND NEW.detail LIKE 'Bounded routine visit context.%' BEGIN UPDATE accounts SET active_org_id=" + literal(orgB) + ' WHERE user_id=' + literal(asha.id) + ' AND active_org_id=' + literal(orgA) + '; END');
    return name;
  };
  const dropSwitch = name => { sql.exec('DROP TRIGGER IF EXISTS ' + name); activeTrigger = null; };
  const startBody = { personId: 'p_meena', command: { type: 'startVisit', personId: 'p_meena' } };
  const post = (key, org) => api.call(asha, '/api/routine-visit', { method: 'POST', org, headers: { 'Idempotency-Key': key }, body: startBody });

  await check(orgA !== orgB, 'Fixture has two distinct actual owner-created organisations');
  await check(sql.prepare("SELECT count(*) AS n FROM memberships WHERE user_id=? AND org_id IN (?,?) AND role='asha' AND status='active'").get(asha.id, orgA, orgB).n === 2, 'Fixture same ASHA has two current active care memberships');
  await check(sql.prepare("SELECT count(*) AS n FROM patients WHERE org_id IN (?,?) AND id='p_meena' AND assigned_to=?").get(orgA, orgB, asha.id).n === 2, 'Fixture same stable person ID assigned to same ASHA in both organisations');
  await check(sql.prepare("SELECT count(*) AS n FROM visits WHERE org_id IN (?,?) AND json_extract(data,'$.personId')='p_meena' AND json_extract(data,'$.state')='draft'").get(orgA, orgB).n === 0, 'Fixture both organisations initially have no current person draft');

  // A GET returns the original audited A projection even if the mutable account selector changes during that audit.
  for (const timing of ['BEFORE', 'AFTER']) {
    await selectA();
    const beforeA = clinical(orgA), beforeB = clinical(orgB), previousAudit = audit();
    const trigger = installSwitch(timing);
    let response;
    try { response = await api.get(asha, '/api/routine-visit?personId=p_meena'); }
    finally { dropSwitch(trigger); }
    await check(activeOrg() === orgB, 'Omitted GET actual ' + timing + ' audit fault changes account active selector to B');
    await check(response.status === 200 && response.json?.organisationId === orgA && response.json?.person?.id === 'p_meena' && response.json?.visit === null, 'Omitted GET ' + timing + ' returns originally audited A person projection without fallback to B');
    await check(Object.keys(response.json ?? {}).sort().join(',') === 'organisationId,person,visit', 'Omitted GET ' + timing + ' keeps exact bounded one-person response shape');
    await check(clinical(orgA) === beforeA && clinical(orgB) === beforeB, 'Omitted GET ' + timing + ' has no clinical mutation in either organisation');
    await check(audit().some(row => !previousAudit.some(old => old.org_id === row.org_id && old.id === row.id) && row.org_id === orgA && row.actor_id === asha.id && row.action === 'viewPatientRecord'), 'Omitted GET ' + timing + ' durably audits actual A read');
    await privacy(response, 'Omitted GET ' + timing); await preservePrefix(previousAudit, 'Omitted GET ' + timing);
    await check(!sql.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name=?").get(trigger), 'Omitted GET ' + timing + ' targeted native trigger is removed');
    writeObservation({ caseId: 'CASE-ORG-GET-' + timing, triggerTiming: timing, actualStatus: response.status, actualBody: response.json, originallyResolvedOrganisationId: orgA, currentAccountOrganisationId: activeOrg(), otherOrganisationId: orgB, currentAccountSwitchPreserved: activeOrg() === orgB, bothClinicalSnapshotsUnchanged: clinical(orgA) === beforeA && clinical(orgB) === beforeB });
  }

  // The entire omitted-header POST, including the existing command writer and final readback, must stay in A.
  await selectA();
  const previousAudit = audit(), beforeA = clinical(orgA), beforeB = clinical(orgB), beforeCountA = visitCount(orgA), beforeCountB = visitCount(orgB), beforeWritesA = writeCount(orgA), beforeWritesB = writeCount(orgB);
  const key = crypto.randomUUID(), trigger = installSwitch('BEFORE');
  let response;
  try { response = await post(key); }
  finally { dropSwitch(trigger); }
  const savedReceipt = receipt(key), responseVisitId = response.json?.result?.visitId;
  const actualVisit = responseVisitId ? sql.prepare('SELECT org_id,id,version,data FROM visits WHERE id=? AND org_id IN (?,?) ORDER BY org_id').all(responseVisitId, orgA, orgB) : [];
  await check(activeOrg() === orgB, 'Omitted POST account switch to B is actually applied and not silently rewritten');
  await check(response.status === 200 && response.json?.context?.organisationId === orgA && response.json?.context?.person?.id === 'p_meena', 'Omitted POST response remains in original organisation A');
  await check(savedReceipt?.org_id === orgA && savedReceipt.person_id === 'p_meena' && savedReceipt.command_type === 'startVisit', 'Omitted POST original actor/key receipt belongs only to A/person/startVisit');
  await check(actualVisit.length === 1 && actualVisit[0].org_id === orgA && JSON.parse(actualVisit[0].data).personId === 'p_meena' && response.json?.context?.visit?.id === responseVisitId, 'Omitted POST mutation and exact readback visit belong only to A');
  await check(visitCount(orgA) === beforeCountA + 1 && clinical(orgA) !== beforeA, 'Omitted POST creates exactly one clinical draft in A');
  await check(visitCount(orgB) === beforeCountB && clinical(orgB) === beforeB, 'Omitted POST leaves all B patient and visit clinical bytes unchanged');
  await check(writeCount(orgA) === beforeWritesA + 1 && writeCount(orgB) === beforeWritesB, 'Omitted POST one durable startVisit event belongs only to A');
  await check(savedReceipt && JSON.parse(savedReceipt.result).visitId === responseVisitId && response.json?.replayed === false, 'Omitted POST exact original committed receipt matches first acknowledgement');
  await privacy(response, 'Omitted POST'); await preservePrefix(previousAudit, 'Omitted POST');
  await check(!sql.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name=?").get(trigger), 'Omitted POST targeted native trigger is removed');
  writeObservation({ caseId: 'CASE-ORG-POST-OMITTED', originalKey: key, requestBodySha256: hash(JSON.stringify(startBody)), originalOrganisationId: orgA, otherOrganisationId: orgB, currentAccountOrganisationId: activeOrg(), actualStatus: response.status, actualBody: response.json, receipt: savedReceipt, actualVisitOrganisations: actualVisit.map(visit => visit.org_id), wrongOrganisationMutation: clinical(orgB) !== beforeB, writeCountDeltaA: writeCount(orgA) - beforeWritesA, writeCountDeltaB: writeCount(orgB) - beforeWritesB });

  // Active B is an explicit different origin. Safe conflict is required; a receipt is not permission to disclose A through B.
  const beforeRetryA = clinical(orgA), beforeRetryB = clinical(orgB), receiptBytes = JSON.stringify(receipt(key)), beforeRetryAudit = audit();
  const omittedReplay = await post(key);
  await check(omittedReplay.status === 409 && Object.keys(omittedReplay.json ?? {}).join(',') === 'error' && !privatePerson(omittedReplay), 'Exact-key replay omitted header while active B refuses safely without cross-organisation private context');
  await check(clinical(orgA) === beforeRetryA && clinical(orgB) === beforeRetryB && JSON.stringify(receipt(key)) === receiptBytes, 'Wrong-origin omitted replay preserves both clinical snapshots and original receipt');
  await check(activeOrg() === orgB, 'Wrong-origin replay retains the actual active B account selector');
  await privacy(omittedReplay, 'Wrong-origin replay'); await preservePrefix(beforeRetryAudit, 'Wrong-origin replay');
  writeObservation({ caseId: 'CASE-ORG-REPLAY-OMITTED', originalKey: key, currentAccountOrganisationId: activeOrg(), actualStatus: omittedReplay.status, actualBody: omittedReplay.json, privatePersonDisclosed: privatePerson(omittedReplay), originalReceiptUnchanged: JSON.stringify(receipt(key)) === receiptBytes });

  const beforeExactAudit = audit(), exactReplay = await post(key, orgA);
  await check(exactReplay.status === 200 && exactReplay.json?.replayed === true && exactReplay.json?.context?.organisationId === orgA && exactReplay.json?.context?.person?.id === 'p_meena' && exactReplay.json?.context?.visit?.id === responseVisitId, 'Explicit original A exact-key replay recovers original receipt and exact visit');
  await check(clinical(orgA) === beforeRetryA && clinical(orgB) === beforeRetryB && JSON.stringify(receipt(key)) === receiptBytes && writeCount(orgA) === beforeWritesA + 1, 'Explicit original replay cannot duplicate clinical draft or rewrite original receipt');
  await check(activeOrg() === orgB, 'Explicit original replay does not rewrite account selector B');
  await privacy(exactReplay, 'Explicit original replay'); await preservePrefix(beforeExactAudit, 'Explicit original replay');
  writeObservation({ caseId: 'CASE-ORG-REPLAY-EXPLICIT-A', originalKey: key, actualStatus: exactReplay.status, actualBody: exactReplay.json, originalReceiptUnchanged: JSON.stringify(receipt(key)) === receiptBytes, currentAccountOrganisationId: activeOrg() });

  const controlKey = crypto.randomUUID(), beforeControlB = clinical(orgB), beforeControlAudit = audit(), explicitControl = await post(controlKey, orgA), controlReceipt = receipt(controlKey);
  await check(explicitControl.status === 200 && explicitControl.json?.context?.organisationId === orgA && explicitControl.json?.context?.person?.id === 'p_meena' && controlReceipt?.org_id === orgA, 'Normal explicit A POST control remains A while account active B');
  await check(clinical(orgB) === beforeControlB && activeOrg() === orgB, 'Normal explicit A control leaves B clinical bytes and selector unchanged');
  await check(visitCount(orgA) === beforeCountA + 1, 'Normal start control resolves the same sole A draft without a duplicate');
  await privacy(explicitControl, 'Normal explicit A control'); await preservePrefix(beforeControlAudit, 'Normal explicit A control');
  writeObservation({ caseId: 'CASE-ORG-CONTROL-EXPLICIT-A', actualStatus: explicitControl.status, actualBody: explicitControl.json, receiptOrganisationId: controlReceipt?.org_id, currentAccountOrganisationId: activeOrg(), otherOrganisationClinicalUnchanged: clinical(orgB) === beforeControlB });

  const result = await report.finish({ mode: 'strict-resolved-organisation', recordedAtUtc: new Date().toISOString(), actualHttpCases: observations.length, wrongOrganisationMutationsObserved: observations.filter(observation => observation.wrongOrganisationMutation).length, observations }); finished = true;
  writeFileSync(folder + '/result.json', JSON.stringify(result, null, 2) + '\n');
} catch (cause) {
  await report.check('Native fixture completed without setup exception', () => { throw cause; });
  writeFileSync(folder + '/failure.json', JSON.stringify({ recordedAtUtc: new Date().toISOString(), error: String(cause), observations }, null, 2) + '\n');
  throw cause;
} finally {
  if (activeTrigger && sql) sql.exec('DROP TRIGGER IF EXISTS ' + activeTrigger);
  sql?.close(); await worker?.stop();
  if (!finished) await report.finish({ mode: 'strict-resolved-organisation', observations, fixtureIncomplete: true });
}
