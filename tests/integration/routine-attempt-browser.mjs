// D03 A4/A5/A6, BR-ID-02 and BR-SEC-08: original-account exact-intent recovery in the actual connected browser.
// Bounded local synthetic Worker/D1/Chromium; no provider calls, hosted acceptance or persistent device recovery claim.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { globSync, mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { startWorker, identity, client } from '../lib/worker.mjs';
import { suite } from '../lib/report.mjs';

const folder = process.env.SAHA_ATTEMPT_EVIDENCE_DIR ?? 'tests/reports/routine-attempt-browser';
const state = process.env.SAHA_ATTEMPT_TEST_STATE ?? '.wrangler/routine-attempt-browser-state';
const port = process.env.SAHA_TEST_PORT ?? '9481';
const report = suite('Routine original-account write attempt browser recovery', process.env.SAHA_ATTEMPT_REPORT_FILE ?? 'tests/reports/routine-attempt-browser-result.json', {
  layer: 'integration', limits: ['Actual local built Worker/native D1 and Chromium with synthetic principals.', 'Native audit faults and declared browser-wire header/network faults only; no global ACL, full NFR, physical-device, clinical/UAT or hosted acceptance.', 'Recovery retained only in the mounted page; no durable device recovery claim.'],
});
mkdirSync(folder, { recursive: true });
let worker, browser, sql, activeTrigger, lastPage, finished = false;
const observations = [], external = [];
const requestFailures = [];
const check = async (value, label) => { await report.check(label, () => assert.ok(value, label)); if (value) console.log('PASS', label); };
const ok = response => { assert.equal(response.status, 200, response.text); return response.json; };
const literal = value => "'" + String(value).replaceAll("'", "''") + "'";
const hash = value => createHash('sha256').update(value).digest('hex');
const observe = value => { observations.push(value); writeFileSync(folder + '/observations.json', JSON.stringify(observations, null, 2) + '\n'); };

try {
  worker = await startWorker({ port, name: 'saha-attempt-browser-independent', state }); browser = await chromium.launch({ headless: true });
  const api = client(worker.base), run = crypto.randomUUID().slice(0, 8), owner = identity('owner', run), asha = identity('asha-a', run), other = identity('asha-b', run);
  const org = ok(await api.get(owner, '/api/workspace')).organisation.id;
  for (const actor of [asha, other]) {
    const account = ok(await api.get(actor, '/api/workspace'));
    const invite = ok(await api.command(owner, { type: 'createInvite', accountCode: account.user.accountCode, label: 'Synthetic exact-intent ' + actor.label, role: 'asha', teamIds: ['default'] }, org));
    ok(await api.command(actor, { type: 'joinOrganisation', token: invite.result.token }));
  }
  const file = globSync(state + '/**/*.sqlite').find(path => !path.includes('cache')); assert.ok(file); sql = new DatabaseSync(file);
  // The Worker and this fault-injection connection intentionally share the native D1
  // database. Wait for a bounded in-flight Worker transaction instead of turning normal
  // SQLite writer contention into a fixture setup failure.
  sql.exec('PRAGMA busy_timeout=10000');
  const member = actor => sql.prepare('SELECT role,status,version,is_owner FROM memberships WHERE org_id=? AND user_id=?').get(org, actor.id);
  const active = async actor => {
    const current = member(actor);
    if (current.status !== 'active') ok(await api.command(owner, { type: 'updateMember', userId: actor.id, version: current.version, role: 'asha', teamIds: ['default'], isOwner: false, status: 'active', reason: 'Synthetic restore exact-intent browser actor through actual owner command' }, org));
  };
  const suspend = async actor => {
    const current = member(actor);
    ok(await api.command(owner, { type: 'updateMember', userId: actor.id, version: current.version, role: 'asha', teamIds: ['default'], isOwner: false, status: 'suspended', reason: 'Synthetic explicit browser compare refusal control' }, org));
  };
  const assign = async (personId, actor) => {
    const person = ok(await api.get(owner, '/api/workspace', org)).people.find(person => person.id === personId);
    ok(await api.command(owner, { type: 'assignPatient', personId, version: person.version, teamId: 'default', assignedTo: actor.id, reason: 'Synthetic original-account browser recovery fixture reassignment' }, org));
  };
  for (const personId of ['p_meena', 'p_farida']) await assign(personId, asha);
  await assign('p_sunita', other);
  for (const packId of ['maternal', 'tb']) {
    const enrolled = ok(await api.get(asha, '/api/workspace', org)).people.find(person => person.id === 'p_meena');
    if (!enrolled.enrolments?.some(episode => episode.packId === packId && episode.state === 'active')) ok(await api.command(asha, { type: 'enrolProgramme', personId: enrolled.id, version: enrolled.version, packId, episodeLabel: 'Synthetic browser RAM recovery evidence', startDate: null }, org));
  }
  const clinical = () => JSON.stringify({ people: sql.prepare('SELECT org_id,id,version,data FROM patients ORDER BY org_id,id').all(), visits: sql.prepare('SELECT org_id,id,version,data FROM visits ORDER BY org_id,id').all() });
  const audit = () => sql.prepare('SELECT * FROM audit_events WHERE org_id=? ORDER BY id').all(org);
  const receipt = (actor, key) => sql.prepare('SELECT * FROM command_receipts WHERE actor_id=? AND key=?').get(actor.id, key);
  const visit = id => sql.prepare('SELECT org_id,id,version,data FROM visits WHERE org_id=? AND id=?').get(org, id);
  const boundedCount = () => sql.prepare("SELECT count(*) AS n FROM audit_events WHERE org_id=? AND actor_id=? AND action='viewPatientRecord' AND detail LIKE 'Bounded routine visit context.%'").get(org, asha.id).n;
  const saveCount = personId => sql.prepare("SELECT count(*) AS n FROM audit_events WHERE org_id=? AND action='saveVisit' AND person_id=?").get(org, personId).n;
  const prefix = async (before, label) => { const current = new Map(audit().map(row => [row.id, JSON.stringify(row)])); await check(before.every(row => current.get(row.id) === JSON.stringify(row)), label + ' previous immutable audit bytes retained'); };
  const context = personId => api.get(asha, '/api/routine-visit?personId=' + personId, org);
  const directPost = (actor, body, key, expectedActor) => api.call(actor, '/api/routine-visit', { method: 'POST', org, headers: { 'Idempotency-Key': key, ...(expectedActor === undefined ? {} : { 'x-saha-operation-actor': expectedActor }) }, body });
  const start = ok(await directPost(asha, { personId: 'p_meena', command: { type: 'startVisit', personId: 'p_meena' } }, crypto.randomUUID()));
  const at = new Date().toISOString().slice(0, 16), initial = start.context;
  const baselineFacts = { ...initial.visit.facts, date: at, weight: '50.1', systolic: '120', diastolic: '80', temperature: '36.5', weeks: '20', coughDays: '3', notes: 'Synthetic mounted-page exact-intent recovery', source: 'measured', provenance: { weight: { source: 'measured', at }, weeks: { source: 'reported', at }, coughDays: { source: 'reported', at } } };
  ok(await directPost(asha, { personId: 'p_meena', command: { type: 'saveVisit', visitId: initial.visit.id, version: initial.visit.version, facts: baselineFacts } }, crypto.randomUUID()));

  const open = async personId => {
    const bc = await browser.newContext({ viewport: { width: 360, height: 640 }, extraHTTPHeaders: asha.headers });
    await bc.route('**/*', async route => { if (!route.request().url().startsWith(worker.base + '/')) { external.push(route.request().url()); await route.abort(); } else await route.continue(); });
    const page = await bc.newPage(), requests = [], responses = []; lastPage = page;
    page.on('dialog', dialog => dialog.dismiss());
    page.on('request', request => { if (request.url().startsWith(worker.base + '/api/routine-visit')) requests.push({ method: request.method(), url: request.url(), key: request.headers()['idempotency-key'], organisationId: request.headers()['x-saha-organisation'], expectedActor: request.headers()['x-saha-operation-actor'], body: request.postData() }); });
    page.on('response', response => { if (response.url().startsWith(worker.base + '/api/routine-visit')) responses.push(response); });
    page.on('requestfailed', request => { if (request.url().startsWith(worker.base + '/api/routine-visit')) requestFailures.push({ url: request.url(), method: request.method(), key: request.headers()['idempotency-key'], error: request.failure()?.errorText }); });
    await page.goto(worker.base + '/routine-visit?personId=' + personId + '&organisationId=' + encodeURIComponent(org));
    await page.getByRole('heading', { name: personId === 'p_meena' ? 'Meena Devi' : 'Farida Begum', exact: true }).waitFor();
    return { bc, page, requests, responses, posts: () => requests.filter(request => request.method === 'POST') };
  };
  const idle = page => page.waitForFunction(() => document.querySelector('main.routine-visit')?.getAttribute('aria-busy') === 'false', undefined, { timeout: 10000 });
  const privateHidden = async page => await page.getByRole('region', { name: 'Selected person', exact: true }).count() === 0 && await page.getByRole('textbox', { name: 'Weight (kg)', exact: true }).count() === 0 && !/Meena Devi|Farida Begum|p_meena|p_farida|Synthetic mounted-page exact-intent recovery/.test(await page.locator('main').innerText());
  const retry = async (fixture, label, expectPost = false) => {
    const button = fixture.page.getByRole('button', { name: 'Check exact write attempt', exact: true });
    const reachable = await button.count() === 1 && await button.isEnabled();
    await check(reachable, label + ' exact original attempt recovery remains reachable outside protected context');
    let getResponse = null, postResponse = null;
    if (reachable) {
      const response = fixture.page.waitForResponse(response => response.url().startsWith(worker.base + '/api/routine-visit?') && response.request().method() === 'GET', { timeout: 4000 }).catch(() => null);
      const originalKey = fixture.posts()[0]?.key;
      const exactPost = expectPost ? fixture.page.waitForResponse(response => response.url().endsWith('/api/routine-visit') && response.request().method() === 'POST' && response.request().headers()['idempotency-key'] === originalKey, { timeout: 10000 }).catch(() => null) : null;
      await button.click(); getResponse = await response; if (exactPost) postResponse = await exactPost; await idle(fixture.page);
    }
    return { reachable, getResponse, postResponse };
  };
  const changeWeight = async (fixture, value) => {
    await fixture.page.getByRole('combobox', { name: 'Go to observation or save', exact: true }).selectOption('fact:weight');
    await fixture.page.getByRole('textbox', { name: 'Weight (kg)', exact: true }).fill(value);
    await fixture.page.getByRole('combobox', { name: 'Go to observation or save', exact: true }).selectOption('review');
  };
  const installRefusal = async stage => {
    const before = member(asha), threshold = boundedCount() + (stage === 'post-save-context' ? 2 : 1), name = 'qa_attempt_' + stage.replaceAll('-', '_') + '_' + run;
    activeTrigger = name;
    const statement = 'CREATE TRIGGER ' + name + ' AFTER INSERT ON audit_events WHEN NEW.org_id=' + literal(org) + ' AND NEW.actor_id=' + literal(asha.id) + " AND NEW.action='viewPatientRecord' AND NEW.detail LIKE 'Bounded routine visit context.%' AND (SELECT count(*) FROM audit_events WHERE org_id=" + literal(org) + ' AND actor_id=' + literal(asha.id) + " AND action='viewPatientRecord' AND detail LIKE 'Bounded routine visit context.%') >= " + threshold + " BEGIN UPDATE memberships SET status='suspended',version=version+1 WHERE org_id=" + literal(org) + ' AND user_id=' + literal(asha.id) + ' AND version=' + before.version + '; END';
    // The Worker can briefly retain SQLite's write lock after the preceding HTTP
    // response. Wait for that real transaction to finish instead of treating a
    // fixture-control race as an application failure.
    for (let attempt = 0; ; attempt++) {
      try { sql.exec(statement); break; }
      catch (cause) {
        if (cause?.code !== 'ERR_SQLITE_ERROR' || !String(cause.message).includes('database is locked') || attempt === 49) throw cause;
        await new Promise(resolve => setTimeout(resolve, 20));
      }
    }
    return name;
  };
  const removeRefusal = name => { sql.exec('DROP TRIGGER IF EXISTS ' + name); activeTrigger = null; };

  for (const stage of ['pre-command-start', 'post-save-context', 'committed-lost-ack-compare']) {
    await active(asha); const personId = stage === 'pre-command-start' ? 'p_farida' : 'p_meena';
    const current = ok(await context(personId)), beforeClinical = clinical(), beforeAudit = audit(), beforeSaves = saveCount(personId);
    const f = await open(personId); if (stage !== 'pre-command-start') await changeWeight(f, stage === 'post-save-context' ? '51.2' : '51.7');
    let responseStatus, nativeTrigger;
    if (stage === 'committed-lost-ack-compare') {
      await f.page.route('**/api/routine-visit', async route => { if (route.request().method() !== 'POST') return route.continue(); const response = await route.fetch(); responseStatus = response.status(); await route.abort(); });
      await f.page.getByRole('button', { name: 'Save observations as server draft', exact: true }).click();
      await f.page.getByRole('button', { name: 'Check exact write attempt', exact: true }).waitFor(); await idle(f.page); await f.page.unroute('**/api/routine-visit');
      await suspend(asha);
      const refused = f.page.waitForResponse(response => response.url().startsWith(worker.base + '/api/routine-visit?') && response.request().method() === 'GET');
      await f.page.getByRole('button', { name: 'Compare latest saved record', exact: true }).click(); responseStatus = (await refused).status(); await idle(f.page);
    } else {
      nativeTrigger = await installRefusal(stage === 'pre-command-start' ? 'pre-command' : stage);
      const response = f.page.waitForResponse(response => response.url().endsWith('/api/routine-visit') && response.request().method() === 'POST');
      try { await f.page.getByRole('button', { name: stage === 'pre-command-start' ? 'Start or resume routine draft' : 'Save observations as server draft', exact: true }).click(); responseStatus = (await response).status(); await idle(f.page); }
      finally { removeRefusal(nativeTrigger); }
    }
    const original = f.posts()[0]; assert.ok(original, 'Actual original browser POST recorded'); const originalReceipt = receipt(asha, original.key), saved = current.visit ? visit(current.visit.id) : null;
    await check(responseStatus === 403 && member(asha).status === 'suspended', stage + ' actual access refusal after authority changed');
    await check(original.organisationId === org && original.expectedActor === asha.id, stage + ' browser freezes original organisation and trusted actor with its write key');
    await check(await privateHidden(f.page), stage + ' protected person, facts and comparison cleared from rendered page');
    if (stage === 'pre-command-start') await check(!originalReceipt && clinical() === beforeClinical, stage + ' initial refusal has no write receipt or clinical mutation');
    else await check(!!originalReceipt && saved.version === current.visit.version + 1 && saveCount(personId) === beforeSaves + 1, stage + ' save really committed original receipt once before readback refusal');
    const beforeRetryPosts = f.posts().length, denied = await retry(f, stage + ' while still unauthorized');
    await check(denied.getResponse?.status() === 403 && f.posts().length === beforeRetryPosts && JSON.stringify(receipt(asha, original.key)) === JSON.stringify(originalReceipt), stage + ' unauthorized recovery only reads current scope and cannot submit or rewrite original receipt');
    await check(await privateHidden(f.page), stage + ' unauthorized recovery keeps protected content hidden');
    await active(asha);
    if (stage === 'post-save-context') {
      for (const headerFault of ['missing', 'mismatched']) {
        const beforePosts = f.posts().length, beforeFault = clinical();
        await f.page.route('**/api/routine-visit?*', async route => {
          const response = await route.fetch(), headers = { ...response.headers() };
          if (headerFault === 'missing') delete headers['x-saha-operation-actor']; else headers['x-saha-operation-actor'] = other.id;
          await route.fulfill({ response, headers });
        });
        const deniedHeader = await retry(f, headerFault + ' actor response header'); await f.page.unroute('**/api/routine-visit?*');
        await check(deniedHeader.getResponse?.status() === 200 && f.posts().length === beforePosts && clinical() === beforeFault, headerFault + ' actor response header fails closed before POST with original attempt intact');
        await check(await privateHidden(f.page), headerFault + ' actor response header cannot restore protected DOM');
      }
    }
    const beforeRecoveryPosts = f.posts().length, recovered = await retry(f, stage + ' original actor restored', true);
    const replayRequest = f.posts().at(-1), after = ok(await context(personId));
    await check(recovered.getResponse?.status() === 200 && f.posts().length === beforeRecoveryPosts + 1 && replayRequest.key === original.key && replayRequest.body === original.body && replayRequest.organisationId === org && replayRequest.expectedActor === asha.id, stage + ' restored actor submits exact original key body organisation and actor');
    await check(await f.page.getByText('Exact operation reconciled and read back.', { exact: true }).count() === 1 && await f.page.getByRole('button', { name: 'Check exact write attempt', exact: true }).count() === 0, stage + ' UI reconciles only after matched authoritative readback');
    await check(after.visit?.personId === personId && after.person.id === personId && after.organisationId === org && (stage === 'pre-command-start' ? !!after.visit : after.visit?.id === current.visit.id && after.visit.version === current.visit.version + 1), stage + ' original operation produces one exact selected visit');
    await check(stage === 'pre-command-start' ? !!receipt(asha, original.key) : JSON.stringify(receipt(asha, original.key)) === JSON.stringify(originalReceipt), stage + ' original committed receipt retained or originally absent intent committed once');
    await check(stage === 'pre-command-start' || saveCount(personId) === beforeSaves + 1, stage + ' recovery creates no duplicate save event');
    await prefix(beforeAudit, stage); if (nativeTrigger) await check(!sql.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name=?").get(nativeTrigger), stage + ' native timing trigger removed');
    observe({ caseId: 'CASE-ATTEMPT-' + stage.toUpperCase(), stage, actualStatus: responseStatus, initialReceiptPresent: !!originalReceipt, originalKey: original.key, requestBodySha256: hash(original.body), originalActorId: asha.id, originalOrganisationId: org, browserPostRequests: f.posts(), recoveryReadExecuted: !!recovered.getResponse, originalReceiptUnchanged: !originalReceipt || JSON.stringify(receipt(asha, original.key)) === JSON.stringify(originalReceipt) });
    await f.bc.close();
  }

  // An uncommitted A attempt must never execute as newly authorised B after a real assignment and account change.
  await active(asha); await assign('p_meena', asha);
  const current = ok(await context('p_meena')), beforeSaves = saveCount('p_meena'), f = await open('p_meena'); await changeWeight(f, '52.3');
  await f.page.route('**/api/routine-visit', async route => { if (route.request().method() === 'POST') await route.abort(); else await route.continue(); });
  await f.page.getByRole('button', { name: 'Save observations as server draft', exact: true }).click(); await f.page.getByRole('button', { name: 'Check exact write attempt', exact: true }).waitFor(); await f.page.unroute('**/api/routine-visit');
  const original = f.posts()[0]; await check(!receipt(asha, original.key) && visit(current.visit.id).version === current.visit.version, 'Actor-change original POST aborted before commit leaves original A receipt absent');
  await assign('p_meena', other); await f.bc.setExtraHTTPHeaders(other.headers);
  const beforeActorClinical = clinical(), beforeActorPosts = f.posts().length, wrongActor = await retry(f, 'Different actual actor B restored/assigned');
  await check(wrongActor.getResponse?.status() === 200 && wrongActor.getResponse.headers()['x-saha-operation-actor'] === other.id, 'Different actor receives actual authorised B projection and trusted actor response header');
  await check(f.posts().length === beforeActorPosts && clinical() === beforeActorClinical && !receipt(other, original.key) && !receipt(asha, original.key), 'Different current actor cannot POST original A intent or create B-scoped same-key receipt');
  await check(await privateHidden(f.page), 'Different current actor recovery clears protected DOM while retaining original A intent');
  await assign('p_meena', asha); await f.bc.setExtraHTTPHeaders(asha.headers);
  // Change trusted identity only after a real successful original-A preflight GET,
  // while B receives legitimate care assignment; the server must still refuse A intent.
  let raceClinical, raceAuditCount, raceForwardedResponse, raceApplied = false;
  await f.page.route('**/api/routine-visit', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    await assign('p_meena', other); raceClinical = clinical(); raceAuditCount = audit().length; raceApplied = true;
    // Forward the actual frozen request to the same Worker under the changed trusted
    // dispatcher identity. Native HTTP is used because Chromium continuation with
    // overridden trusted-identity headers did not complete in the retained adapter run.
    const requestHeaders = route.request().headers(), expectedActor = requestHeaders['x-saha-operation-actor'];
    const response = await api.call(other, '/api/routine-visit', { method: 'POST', org: requestHeaders['x-saha-organisation'], headers: { 'Idempotency-Key': requestHeaders['idempotency-key'], ...(expectedActor === undefined ? {} : { 'x-saha-operation-actor': expectedActor }) }, body: JSON.parse(route.request().postData()) });
    raceForwardedResponse = { status: response.status, body: response.json, originalKey: requestHeaders['idempotency-key'], expectedActor, actualTrustedActor: other.id, requestBodySha256: hash(route.request().postData()) };
    writeFileSync(folder + '/actor-race-forwarded-response.json', JSON.stringify(raceForwardedResponse, null, 2) + '\n');
    // Fulfil a new body, so transport/encoding/length headers from native fetch
    // cannot describe this DevTools response. Keep the actual privacy metadata.
    const headers = { 'content-type': 'application/json', 'cache-control': response.headers.get('cache-control') ?? '', 'x-content-type-options': response.headers.get('x-content-type-options') ?? '' };
    if (response.headers.has('x-saha-operation-actor')) headers['x-saha-operation-actor'] = response.headers.get('x-saha-operation-actor');
    await route.fulfill({ status: response.status, headers, body: response.text });
  });
  const beforeRacePosts = f.posts().length, raced = await retry(f, 'Trusted identity changes after successful original A GET', true);
  await f.page.unroute('**/api/routine-visit');
  // The literal fulfilled body is the separately retained actual native response.
  // Chromium status is observed independently; no synthetic refusal is invented.
  const raceResponse = raced.postResponse, raceBody = raceForwardedResponse?.body;
  await check(raced.getResponse?.status() === 200 && raced.getResponse.headers()['x-saha-operation-actor'] === asha.id && raceApplied && f.posts().length === beforeRacePosts + 1, 'Actor race really occurs after authorized original A GET and before actual POST');
  await check(raceForwardedResponse?.status === 403 && raceResponse?.status() === 403 && Object.keys(raceBody ?? {}).join(',') === 'error', 'Server refuses changed trusted identity after successful GET with error-only403');
  await check(raceApplied && clinical() === raceClinical && audit().length === raceAuditCount && !receipt(other, original.key) && !receipt(asha, original.key), 'Actor race refusal has no wrong-actor receipt clinical mutation or protected audit read');
  await check(await privateHidden(f.page), 'Actor race refusal clears protected DOM and retains original unresolved intent');
  await assign('p_meena', asha); await f.bc.setExtraHTTPHeaders(asha.headers);
  const beforeOriginalPosts = f.posts().length, restoredActor = await retry(f, 'Original actor A restored after B refusal', true), finalRequest = f.posts().at(-1), final = ok(await context('p_meena'));
  await check(restoredActor.getResponse?.status() === 200 && f.posts().length === beforeOriginalPosts + 1 && finalRequest.key === original.key && finalRequest.body === original.body && finalRequest.expectedActor === asha.id && finalRequest.organisationId === org, 'Only original restored actor submits the unchanged A key/body/org');
  await check(!!receipt(asha, original.key) && !receipt(other, original.key) && final.visit.version === current.visit.version + 1 && saveCount('p_meena') === beforeSaves + 1 && final.visit.facts.weight === '52.3', 'Original author commits once; no wrong-person B author receipt or duplicate logical mutation');
  observe({ caseId: 'CASE-ATTEMPT-DIFFERENT-ACTOR', originalKey: original.key, originalActorId: asha.id, differentActorId: other.id, originalRequestSha256: hash(original.body), browserPostRequests: f.posts(), wrongActorRecoveryGetStatus: wrongActor.getResponse?.status() ?? null, trustedIdentityRaceApplied: raceApplied, raceAdapter: 'Actual frozen request forwarded through native client to same Worker under changed trusted identity after legitimate reassignment; actual response fulfilled into browser.', actualForwardedResponse: raceForwardedResponse ?? null, raceGetStatus: raced.getResponse?.status() ?? null, racePostStatus: raceResponse?.status() ?? null, wrongActorReceiptPresent: !!receipt(other, original.key), originalActorReceiptPresent: !!receipt(asha, original.key) }); await f.bc.close();

  // A plain scope refusal clears visible projections, not the mounted correction/answer draft.
  // After a competing save, only the exact old-version refusal proof releases the original intent;
  // the correction remains unsaved until the user explicitly chooses the saved comparison.
  const chooseProgramme = async (fixture, value) => {
    await fixture.page.getByRole('combobox', { name: 'Go to observation or save', exact: true }).selectOption('programme:maternal_contact');
    await fixture.page.getByRole('combobox', { name: 'Was a care appointment discussed?', exact: true }).click();
    await fixture.page.getByRole('option', { name: value, exact: true }).click();
  };
  for (const type of ['saveVisit', 'saveProgrammeAnswers']) {
    const current = ok(await context('p_meena')), fixture = await open('p_meena'), originalValue = '53.4', competitorValue = '60.8';
    if (type === 'saveVisit') await changeWeight(fixture, originalValue);
    await chooseProgramme(fixture, 'Yes');
    await fixture.page.getByRole('combobox', { name: 'Go to observation or save', exact: true }).selectOption(type === 'saveVisit' ? 'review' : 'programme-save');
    await fixture.page.route('**/api/routine-visit', async route => { if (route.request().method() === 'POST') await route.abort(); else await route.continue(); });
    await fixture.page.getByRole('button', { name: type === 'saveVisit' ? 'Save observations as server draft' : 'Save programme evidence', exact: true }).click();
    await fixture.page.getByRole('button', { name: 'Check exact write attempt', exact: true }).waitFor(); await fixture.page.unroute('**/api/routine-visit');
    const original = fixture.posts()[0]; await check(!receipt(asha, original.key) && visit(current.visit.id).version === current.visit.version, type + ' original correction/answer POST aborted before commit');
    await suspend(asha);
    const refused = fixture.page.waitForResponse(response => response.url().startsWith(worker.base + '/api/routine-visit?') && response.request().method() === 'GET');
    await fixture.page.getByRole('button', { name: 'Compare latest saved record', exact: true }).click();
    await check((await refused).status() === 403, type + ' actual comparison read refuses current authority'); await idle(fixture.page);
    await check(await privateHidden(fixture.page), type + ' comparison refusal hides person facts and staged answers');
    await active(asha);
    const competitorKey = crypto.randomUUID(), competitorCommand = type === 'saveVisit'
      ? { type, visitId: current.visit.id, version: current.visit.version, facts: { ...current.visit.facts, weight: competitorValue, notes: 'Synthetic competing save retains original correction until explicit choice' } }
      : { type, visitId: current.visit.id, version: current.visit.version, answers: { maternal_contact: 'No', testing: 'Yes' }, absence: {} };
    const competitor = ok(await directPost(asha, { personId: 'p_meena', command: competitorCommand }, competitorKey)), competitorReceiptBytes = JSON.stringify(receipt(asha, competitorKey)), competitorClinical = clinical(), beforeRetryPosts = fixture.posts().length, beforeRetryAudit = audit();
    const recovered = await retry(fixture, type + ' original actor restored after competing save', true);
    const retryRequest = fixture.posts().at(-1), retryResponse = recovered.postResponse, proof = await retryResponse?.json().catch(() => null);
    await check(recovered.getResponse?.status() === 200 && fixture.posts().length === beforeRetryPosts + 1 && retryRequest.key === original.key && retryRequest.body === original.body && retryRequest.expectedActor === asha.id && retryRequest.organisationId === org, type + ' reconciliation uses original actor key body old version and organisation');
    await check(retryResponse?.status() === 409 && retryResponse.headers()['x-saha-operation-actor'] === asha.id && proof?.operation?.outcome === 'not-applied-stale-version' && proof.operation.key === original.key && proof.operation.organisationId === org && proof.operation.personId === 'p_meena' && proof.operation.visitId === current.visit.id && proof.operation.expectedVersion === current.visit.version && proof.operation.currentVersion === competitor.context.visit.version, type + ' exact actor-bound stale nonapply proof alone releases the original attempt');
    await check(retryResponse?.status() === 409 && proof?.operation?.outcome === 'not-applied-stale-version' && proof.operation.key === original.key && await fixture.page.getByRole('button', { name: 'Check exact write attempt', exact: true }).count() === 0 && !receipt(asha, original.key), type + ' proven nonapplied intent ends uncertainty without a false committed receipt');
    await check(clinical() === competitorClinical && JSON.stringify(receipt(asha, competitorKey)) === competitorReceiptBytes, type + ' stale reconciliation leaves competing clinical bytes and receipt immutable');
    const navigation = fixture.page.getByRole('combobox', { name: 'Go to observation or save', exact: true });
    if (await navigation.count()) {
      await navigation.selectOption('fact:weight');
      const weight = fixture.page.getByRole('textbox', { name: 'Weight (kg)', exact: true });
      await check(await weight.inputValue() === (type === 'saveVisit' ? originalValue : current.visit.facts.weight) && await weight.isEnabled(), type + ' original unsaved observation correction survives scope refusal and fresh higher read');
      await navigation.selectOption('programme:maternal_contact');
      await check((await fixture.page.getByRole('combobox', { name: 'Was a care appointment discussed?', exact: true }).innerText()).includes('Yes'), type + ' original unsaved programme choice survives protected component remount');
      if (type === 'saveProgrammeAnswers') {
        await navigation.selectOption('programme:testing');
        await check((await fixture.page.getByRole('combobox', { name: 'Is a testing follow-up already arranged?', exact: true }).innerText()).includes('Yes'), 'Programme recovery merges untouched competing saved choice with original locally changed choice');
      }
    } else {
      await check(false, type + ' original unsaved observation correction survives scope refusal and fresh higher read');
      await check(false, type + ' original unsaved programme choice survives protected component remount');
      if (type === 'saveProgrammeAnswers') await check(false, 'Programme recovery merges untouched competing saved choice with original locally changed choice');
    }
    const comparison = fixture.page.getByRole('button', { name: 'Compare latest saved record', exact: true });
    if (await comparison.count()) { await comparison.click(); await fixture.page.getByRole('heading', { name: 'Saved version ' + competitor.context.visit.version, exact: true }).waitFor(); }
    await check(await fixture.page.getByRole('button', { name: 'Replace unsaved entries with saved record', exact: true }).count() === 1, type + ' comparison requires an explicit replacement choice');
    const replace = fixture.page.getByRole('button', { name: 'Replace unsaved entries with saved record', exact: true });
    if (await replace.count() && await replace.isEnabled()) {
      await replace.click(); await navigation.selectOption('fact:weight');
      const weight = fixture.page.getByRole('textbox', { name: 'Weight (kg)', exact: true });
      await check(await weight.inputValue() === competitor.context.visit.facts.weight, type + ' explicit replacement alone restores competing saved observations');
      await navigation.selectOption('programme:maternal_contact');
      const expectedAnswer = competitor.context.visit.programmeCapture.answers.maternal_contact ?? 'Not answered';
      await check((await fixture.page.getByRole('combobox', { name: 'Was a care appointment discussed?', exact: true }).innerText()).includes(expectedAnswer), type + ' explicit replacement alone discards staged programme choice for saved answer');
    } else {
      await check(false, type + ' explicit replacement alone restores competing saved observations');
      await check(false, type + ' explicit replacement alone discards staged programme choice for saved answer');
    }
    await prefix(beforeRetryAudit, type + ' stale correction recovery');
    observe({ caseId: 'CASE-ATTEMPT-COMPETING-' + type.toUpperCase(), type, originalKey: original.key, originalBodySha256: hash(original.body), originalVersion: current.visit.version, competingVersion: competitor.context.visit.version, originalCorrectionValue: type === 'saveVisit' ? originalValue : null, originalProgrammeChoice: 'Yes', actualRetryStatus: retryResponse?.status() ?? null, actualRetryProof: proof?.operation ?? null, competitorReceiptUnchanged: JSON.stringify(receipt(asha, competitorKey)) === competitorReceiptBytes, originalReceiptAbsent: !receipt(asha, original.key), browserPostRequests: fixture.posts() }); await fixture.bc.close();
  }

  // Server precondition is independent of a client GET: changed identity must refuse before body/context/audit/command.
  const serverBody = { personId: 'p_sunita', command: { type: 'startVisit', personId: 'p_sunita' } }, serverKey = crypto.randomUUID(), beforeServer = clinical(), beforeServerAudit = audit();
  const serverRefusal = await directPost(other, serverBody, serverKey, asha.id);
  await check(serverRefusal.status === 403 && Object.keys(serverRefusal.json ?? {}).join(',') === 'error', 'Server expected original actor mismatch refuses error-only403 despite B current care authority');
  await check(clinical() === beforeServer && !receipt(other, serverKey) && !receipt(asha, serverKey) && audit().length === beforeServerAudit.length, 'Server actor mismatch performs no clinical mutation receipt or protected audit read');
  await check(serverRefusal.headers.get('cache-control') === 'no-store' && serverRefusal.headers.get('x-content-type-options') === 'nosniff', 'Server actor precondition refusal uses privacy headers');
  const malformed = await api.call(other, '/api/routine-visit', { method: 'POST', org, headers: { 'Idempotency-Key': crypto.randomUUID(), 'x-saha-operation-actor': asha.id }, body: { unsupported: true } });
  await check(malformed.status === 403 && Object.keys(malformed.json ?? {}).join(',') === 'error' && audit().length === beforeServerAudit.length, 'Expected actor check precedes body parsing and any protected context audit');
  observe({ caseId: 'CASE-ATTEMPT-SERVER-ACTOR-PRECONDITION', actualStatus: serverRefusal.status, actualBody: serverRefusal.json, malformedBodyStatus: malformed.status, wrongActorReceiptPresent: !!receipt(other, serverKey), originalActorReceiptPresent: !!receipt(asha, serverKey) });
  await check(external.length === 0, 'All synthetic browser requests stay on loopback; no external/provider requests');
  const result = await report.finish({ mode: 'strict-original-account-attempt', recordedAtUtc: new Date().toISOString(), actualBrowserCases: 6, observations, externalRequests: external, requestFailures, caseScope: 'Mounted connected browser recovery and independent native server expected-actor controls; deliberate trusted-principal interposition is not browser-cookie/provider reauthentication. No page reload/device persistence claim.' }); finished = true; writeFileSync(folder + '/result.json', JSON.stringify(result, null, 2) + '\n');
} catch (cause) {
  const currentDom = lastPage && !lastPage.isClosed() ? { status: await lastPage.getByRole('status').innerText().catch(() => null), busy: await lastPage.locator('main').getAttribute('aria-busy').catch(() => null) } : null;
  await report.check('Browser/native fixture completed without setup exception', () => { throw cause; }); writeFileSync(folder + '/failure.json', JSON.stringify({ recordedAtUtc: new Date().toISOString(), error: String(cause), observations, external, requestFailures, currentDom, workerOutput: worker?.output().slice(-6000) }, null, 2) + '\n'); throw cause;
} finally {
  if (activeTrigger && sql) sql.exec('DROP TRIGGER IF EXISTS ' + activeTrigger);
  await browser?.close(); sql?.close(); await worker?.stop();
  if (!finished) await report.finish({ mode: 'strict-original-account-attempt', observations, fixtureIncomplete: true });
}
