import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { connect } from 'node:net';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { startMiniflare } from '../lib/miniflare.mjs';
import { client, identity } from '../lib/worker.mjs';

const folder = process.env.SAHA_WORKFORCE_OUTPUT ?? 'tests/reports/workforce-status-browser';
mkdirSync(folder, { recursive: true });
const state = resolve(join(tmpdir(), 'saha-workforce-' + randomUUID()));
const hash = bytes => createHash('sha256').update(bytes).digest('hex'), checks = [], requests = [], errors = [], external = [];
const check = (value, name) => { assert.ok(value, name); checks.push(name); console.log('PASS', name); };
const ok = result => { assert.equal(result.status, 200, result.text); return result.json; };
const custody = () => {
  const files = [], walk = directory => { for (const name of readdirSync(directory)) { const path = join(directory, name); if (statSync(path).isDirectory()) walk(path); else files.push(path); } };
  for (const directory of ['app', 'lib', 'dist']) walk(directory);
  files.push('tests/workforce-status-contract.mjs', 'tests/smoke/workforce-status-browser.mjs');
  return Object.fromEntries(files.sort().map(path => [path, hash(readFileSync(path))]));
};
const beforeSource = custody(); let worker, db, browser, page, trigger, failure, disposed = false, free = false;
const literal = value => "'" + String(value).replaceAll("'", "''") + "'";
try {
  worker = await startMiniflare({ port: process.env.SAHA_TEST_PORT ?? 21903, name: 'workforce-status', state, assetsFirst: true });
  db = await worker.mf.getD1Database('DB'); const api = client(worker.base, { connectionClose: true }), tag = randomUUID().slice(0,8);
  const owner = identity('owner', tag, 'Synthetic Workforce Owner'), workerIdentity = identity('worker', tag, 'Synthetic Workforce Worker'), observer = identity('observer', tag), stranger = identity('stranger', tag);
  owner.id = 'owner|' + tag; owner.headers['oai-authenticated-user-id'] = owner.id;
  workerIdentity.id = 'worker/' + tag; workerIdentity.headers['oai-authenticated-user-id'] = workerIdentity.id;
  const org = ok(await api.get(owner, '/api/workspace')).organisation.id;
  const account = ok(await api.get(workerIdentity, '/api/workspace')).user.accountCode;
  const observerAccount = ok(await api.get(observer, '/api/workspace')).user.accountCode;
  const foreignOrg = ok(await api.get(stranger, '/api/workspace')).organisation.id;
  const joinMember = async (who, accountCode, role) => {
    const invited = ok(await api.command(owner, { type: 'createInvite', accountCode, label: 'Synthetic workforce member', role, teamIds: ['default'] }, org));
    ok(await api.command(who, { type: 'joinOrganisation', token: invited.result.token }, org));
  };
  await joinMember(workerIdentity, account, 'asha'); await joinMember(observer, observerAccount, 'supervisor');
  const protectedPeer = identity('protectedPeer', tag), protectedAccount = ok(await api.get(protectedPeer, '/api/workspace')).user.accountCode;
  await joinMember(protectedPeer, protectedAccount, 'clinician');
  const workspace = () => api.get(owner, '/api/workspace', org).then(ok);
  let person = (await workspace()).people.find(person => person.id === 'p_meena');
  ok(await api.command(owner, { type: 'assignPatient', personId: person.id, version: person.version, teamId: 'default', assignedTo: workerIdentity.id, reason: 'Synthetic workforce revocation fixture' }, org));
  const visitId = ok(await api.command(workerIdentity, { type: 'startVisit', personId: person.id }, org)).result.visitId;
  const draft = (await workspace()).visits.find(visit => visit.id === visitId);
  const prepared = ok(await api.command(workerIdentity, { type: 'prepareAgent', visitId, version: draft.version, providerId: 'local', task: 'extract', input: 'Weight 58 kg' }, org));
  const pending = prepared.result.runId, pendingInputHash = prepared.snapshot.visits.find(visit => visit.id === visitId).agentRuns.find(run => run.id === pending).inputHash;
  const read = (who = owner, selectedOrg = org) => api.get(who, '/api/workforce-status', selectedOrg);
  const member = (value, id = workerIdentity.id) => value.members.find(member => member.userId === id);
  const intent = (value, id = workerIdentity.id) => { const current = member(value, id); return { type: 'updateMember', userId: id, version: current.version, role: current.role, teamIds: current.teamIds, isOwner: current.isOwner, status: 'suspended', reason: 'Synthetic explicit membership suspension' }; };
  const post = (body, key = randomUUID(), who = owner, selectedOrg = org, extra = {}, path = '/api/workforce-status') => api.call(who, path, { method: 'POST', org: selectedOrg, body,
    headers: { 'x-saha-operation-actor': who.id, 'Idempotency-Key': key, ...extra } });
  const tableRows = async () => {
    const tables = (await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT GLOB '_*' ORDER BY name").all()).results.map(row => row.name), result = {};
    for (const table of tables) result[table] = (await db.prepare('SELECT * FROM "' + table + '"').all()).results;
    return result;
  };
  const sameRows = (before, after, exceptions = ['audit_events', 'request_metrics']) => Object.keys(before).every(table => exceptions.includes(table) || JSON.stringify(before[table]) === JSON.stringify(after[table]));
  const beforeRead = await tableRows(); const first = ok(await read());
  check(first.actorId === owner.id && first.organisation.id === org && member(first).userId === workerIdentity.id, 'Actual opaque owner and worker subjects retain exact metadata identity');
  check(!/Meena Devi|Farida|accountCode|email|invitation|patient|facts|token/i.test(JSON.stringify(first)), 'Actual owner roster excludes clinical records and account/invitation secrets');
  const newcomer = identity('newcomer', tag), setup = ok(await api.get(newcomer, '/api/workforce-status'));
  check(setup.actorId === newcomer.id && setup.organisations.length === 0, 'Unbootstrapped current account gets honest empty owner setup');
  check(!(await db.prepare('SELECT user_id FROM accounts WHERE user_id=?').bind(newcomer.id).first()), 'New setup read creates no account or organisation');
  const ownerSetup = ok(await api.get(owner, '/api/workforce-status'));
  check(ownerSetup.organisations.some(value => value.id === org) && ownerSetup.organisations.every(value => Object.keys(value).sort().join(',') === 'id,name'), 'Owner setup returns only existing organisation ids/names');
  check((await fetch(worker.base + '/api/workforce-status')).status === 401, 'Anonymous setup refuses before disclosure');
  for (const who of [workerIdentity, observer, stranger]) check((await read(who)).status === 403, 'Nonowner or foreign account refuses roster ' + who.label);
  check((await read(owner, foreignOrg)).status === 403, 'Owner authority cannot cross an unrelated organisation');
  check((await api.get(owner, '/api/workforce-status?all=1', org)).status === 400 && (await api.call(owner, '/api/workforce-status', { headers: { 'x-saha-organisation': '' } })).status === 400, 'Query widening and empty organisation refuse');
  const initialIntent = intent(first);
  for (const [body, headers, path] of [
    [{ ...initialIntent, status: 'active' }, {}, '/api/workforce-status'], [{ ...initialIntent, type: 'createInvite' }, {}, '/api/workforce-status'],
    [initialIntent, { Origin: 'https://other.invalid' }, '/api/workforce-status'], [initialIntent, { 'x-saha-operation-actor': 'other' }, '/api/workforce-status'],
    [initialIntent, {}, '/api/workforce-status?all=1'], [{ ...initialIntent, role: 'clinician' }, {}, '/api/workforce-status'],
    [{ ...initialIntent, teamIds: [] }, {}, '/api/workforce-status'], [{ ...initialIntent, isOwner: true }, {}, '/api/workforce-status'],
    [{ ...initialIntent, version: initialIntent.version + 1 }, {}, '/api/workforce-status'],
  ]) check([400,403,409,422].includes((await post(body, randomUUID(), owner, org, headers, path)).status), 'Unsupported altered stale or foreign suspension refuses ' + JSON.stringify({ type: body.type, status: body.status, role: body.role, header: Object.keys(headers), path }));
  const absentKey = randomUUID();
  check((await post(initialIntent, absentKey, owner, org, { 'x-saha-recovery': 'receipt-only' })).status === 409 &&
    !(await db.prepare('SELECT key FROM command_receipts WHERE actor_id=? AND key=?').bind(owner.id, absentKey).first()), 'Recovery with no committed receipt performs no replacement operation');
  check((await post(intent(first, owner.id))).status === 422, 'Original self-suspension protection remains explicit');
  const afterRead = await tableRows();
  check(Object.keys(beforeRead).length === 60 && sameRows(beforeRead, afterRead), 'All protected sixty-table read/refusal data remains unchanged except original audit/metrics');
  browser = await chromium.launch({ headless: true }); const context = await browser.newContext({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: owner.headers });
  await context.route('**/*', route => { if (!route.request().url().startsWith(worker.base + '/')) { external.push(route.request().url()); return route.abort(); } return route.continue(); });
  page = await context.newPage(); page.on('pageerror', error => errors.push(String(error)));
  page.on('request', request => { if (new URL(request.url()).pathname === '/api/workforce-status') requests.push({ method: request.method(), body: request.postData(), key: request.headers()['idempotency-key'], recovery: request.headers()['x-saha-recovery'] }); });
  await page.goto(worker.base + '/workforce-status'); await page.getByRole('button', { name: 'Review ' + first.organisation.name, exact: true }).click();
  await page.getByRole('button', { name: 'Review suspension ' + workerIdentity.id, exact: true }).click();
  const submit = page.getByRole('button', { name: 'Suspend reviewed membership', exact: true });
  check(await submit.isDisabled(), 'Actual mobile suspension requires reason and affirmation');
  await page.getByLabel('Reason for suspension').fill('Synthetic explicit mobile suspension');
  await page.getByRole('checkbox', { name: 'I reviewed this exact membership and the offline limits.', exact: true }).check();
  await page.getByRole('button', { name: 'Cancel suspension review', exact: true }).click();
  check(requests.every(request => request.method === 'GET'), 'Cancelling review sends no membership operation');
  await page.getByRole('button', { name: 'Review suspension ' + workerIdentity.id, exact: true }).click();
  await page.getByLabel('Reason for suspension').fill('Synthetic explicit mobile suspension');
  await page.getByRole('checkbox', { name: 'I reviewed this exact membership and the offline limits.', exact: true }).check();
  const beforeSuspend = await tableRows(), beforeTarget = member(ok(await read()));
  await submit.click(); await page.getByText('Original suspension operation recorded and read back. Current membership status is shown below; later changes are not overwritten.', { exact: true }).waitFor();
  const acknowledged = performance.now(), denied = await api.get(workerIdentity, '/api/today', org), denialMs = performance.now() - acknowledged;
  check(denied.status === 403 && denialMs < 300000, 'Actual subsequent online access refuses inside the unchanged five-minute limit');
  const executeDenied = await api.command(workerIdentity, { type: 'executeAgent', visitId, runId: pending, inputHash: pendingInputHash }, org);
  check(executeDenied.status === 403, 'Previously prepared local assistance operation refuses after actual suspension');
  const afterSuspend = await tableRows(), current = ok(await read()), suspended = member(current);
  check(suspended.status === 'suspended' && suspended.version === beforeTarget.version + 1 && suspended.role === beforeTarget.role && suspended.isOwner === beforeTarget.isOwner && JSON.stringify(suspended.teamIds) === JSON.stringify(beforeTarget.teamIds), 'Exactly one target suspension advances original membership version and preserves all other access fields');
  check(sameRows(beforeSuspend, afterSuspend, ['organisations','memberships','audit_events','command_receipts','request_metrics']), 'Actual suspension changes only original organisation/membership/audit/receipt/metrics rows');
  check(beforeSuspend.command_receipts.every(row => afterSuspend.command_receipts.some(after => after.actor_id === row.actor_id && after.key === row.key && JSON.stringify(after) === JSON.stringify(row))), 'All previous command receipts remain byte unchanged');
  const sent = requests.find(request => request.method === 'POST'), receiptsBeforeReplay = (await tableRows()).command_receipts;
  const replay = ok(await post(JSON.parse(sent.body), sent.key, owner, org, { 'x-saha-recovery': 'receipt-only' }));
  check(replay.context.members.find(member => member.userId === workerIdentity.id).status === 'suspended' && JSON.stringify(receiptsBeforeReplay) === JSON.stringify((await tableRows()).command_receipts), 'Exact committed receipt recovery does not duplicate suspension or receipts');
  check((await post({ ...JSON.parse(sent.body), reason: 'Different reason under same reference' }, sent.key)).status === 409, 'Original key with changed input refuses');
  const secondIntent = intent(current, observer.id); let lost;
  await page.getByRole('button', { name: 'Review suspension ' + observer.id, exact: true }).click();
  await page.getByLabel('Reason for suspension').fill('Synthetic genuinely lost suspension response');
  await page.getByRole('checkbox', { name: 'I reviewed this exact membership and the offline limits.', exact: true }).check();
  await context.route('**/api/workforce-status', async route => { if (route.request().method() !== 'POST') return route.continue(); const response = await route.fetch(); lost = { status: response.status(), body: await response.json(), request: route.request().postData(), key: route.request().headers()['idempotency-key'] }; await route.abort('failed'); });
  await page.getByRole('button', { name: 'Suspend reviewed membership', exact: true }).click();
  await page.getByRole('button', { name: 'Check original suspension receipt', exact: true }).waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent === 'Check original suspension receipt' && !button.disabled), null, { timeout: 30000 });
  check(lost.status === 200 && lost.body.context.members.find(member => member.userId === observer.id).status === 'suspended' && await page.getByRole('region', { name: 'Current membership roster', exact: true }).count() === 0, 'Actual committed response loss stays uncertain and clears membership roster');
  await context.unroute('**/api/workforce-status'); const beforeRecovery = await tableRows();
  await page.getByRole('button', { name: 'Check original suspension receipt', exact: true }).click();
  await page.getByText('Original suspension operation recorded and read back. Current membership status is shown below; later changes are not overwritten.', { exact: true }).waitFor();
  check(requests.filter(request => request.method === 'POST').at(-1).body === lost.request && requests.filter(request => request.method === 'POST').at(-1).key === lost.key && requests.filter(request => request.method === 'POST').at(-1).recovery === 'receipt-only' && sameRows(beforeRecovery, await tableRows()), 'Explicit uncertain response recovery preserves original body/key and performs no duplicate changes');
  writeFileSync(folder + '/actual-loss-recovery.json', JSON.stringify(lost, null, 2));
  const postContext = ok(await read()), guardedCommand = intent(postContext, protectedPeer.id), guardedKey = randomUUID();
  const ownerMembership = await db.prepare('SELECT is_owner,version FROM memberships WHERE org_id=? AND user_id=?').bind(org, owner.id).first();
  const protectedBefore = await db.prepare('SELECT * FROM memberships WHERE org_id=? AND user_id=?').bind(org, protectedPeer.id).first();
  trigger = 'qa_workforce_post_owner';
  await db.prepare(`CREATE TRIGGER ${trigger} AFTER INSERT ON audit_events WHEN NEW.org_id=${literal(org)} AND NEW.actor_id=${literal(owner.id)} AND NEW.action='viewWorkspace' BEGIN UPDATE memberships SET is_owner=0,version=version+1 WHERE org_id=${literal(org)} AND user_id=${literal(owner.id)}; END`).run();
  const blockedPost = await post(guardedCommand, guardedKey);
  await db.prepare('DROP TRIGGER ' + trigger).run(); trigger = null;
  check(blockedPost.status === 403 && Object.keys(blockedPost.json).join(',') === 'error' &&
    !(await db.prepare('SELECT key FROM command_receipts WHERE actor_id=? AND key=?').bind(owner.id, guardedKey).first()) &&
    JSON.stringify(protectedBefore) === JSON.stringify(await db.prepare('SELECT * FROM memberships WHERE org_id=? AND user_id=?').bind(org, protectedPeer.id).first()), 'Actual POST prerequisite owner revocation refuses without target or receipt mutation');
  await db.prepare('UPDATE memberships SET is_owner=?,version=? WHERE org_id=? AND user_id=?').bind(ownerMembership.is_owner, ownerMembership.version, org, owner.id).run();
  for (const mode of ['owner-revoked', 'target-changed', 'audit-unavailable']) {
    const ownerBefore = await db.prepare('SELECT status,version,is_owner FROM memberships WHERE org_id=? AND user_id=?').bind(org, owner.id).first();
    const targetBefore = await db.prepare('SELECT role,version FROM memberships WHERE org_id=? AND user_id=?').bind(org, workerIdentity.id).first();
    trigger = 'qa_workforce_' + mode.replaceAll('-', '_');
    const action = mode === 'owner-revoked' ? `UPDATE memberships SET is_owner=0,version=version+1 WHERE org_id=${literal(org)} AND user_id=${literal(owner.id)};` :
      mode === 'target-changed' ? `UPDATE memberships SET version=version+1 WHERE org_id=${literal(org)} AND user_id=${literal(workerIdentity.id)};` : "SELECT RAISE(ABORT,'Synthetic roster audit unavailable');";
    await db.prepare(`CREATE TRIGGER ${trigger} ${mode === 'audit-unavailable' ? 'BEFORE' : 'AFTER'} INSERT ON audit_events WHEN NEW.org_id=${literal(org)} AND NEW.actor_id=${literal(owner.id)} AND NEW.action='viewWorkspace' BEGIN ${action} END`).run();
    const refused = await read(); await db.prepare('DROP TRIGGER ' + trigger).run(); trigger = null;
    check(refused.status === (mode === 'owner-revoked' ? 403 : mode === 'target-changed' ? 409 : 503) && Object.keys(refused.json).join(',') === 'error', 'Actual audited roster refuses ' + mode + ' without disclosure');
    await db.prepare('UPDATE memberships SET status=?,version=?,is_owner=? WHERE org_id=? AND user_id=?').bind(ownerBefore.status, ownerBefore.version, ownerBefore.is_owner, org, owner.id).run();
    await db.prepare('UPDATE memberships SET role=?,version=? WHERE org_id=? AND user_id=?').bind(targetBefore.role, targetBefore.version, org, workerIdentity.id).run();
  }
  await page.getByRole('button', { name: 'Refresh current membership', exact: true }).click(); await page.getByRole('region', { name: 'Current membership roster', exact: true }).waitFor();
  const geometry = await page.locator('main').evaluate(element => ({ width: innerWidth, pageWidth: document.documentElement.scrollWidth,
    controls: [...element.querySelectorAll('button,a')].filter(control => control.getClientRects().length).map(control => control.getBoundingClientRect().height) }));
  check(geometry.pageWidth <= geometry.width && geometry.controls.every(height => height >= 44), 'Actual phone view has forty-four-pixel actions and no horizontal overflow');
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
  check(axe.violations.length === 0, 'Actual membership phone accessibility scan has zero violations');
  await page.screenshot({ path: folder + '/membership-phone.png', fullPage: true });
  await context.setOffline(true); await page.getByText('Protected membership review cleared. Reconnect and refresh current owner access.', { exact: true }).waitFor();
  check(await page.getByRole('region', { name: 'Current membership roster', exact: true }).count() === 0, 'Actual offline transition clears protected roster and suspension actions');
  await context.setOffline(false);
  check(errors.length === 0 && external.length === 0, 'Actual browser has no uncaught errors or external/provider requests');
  writeFileSync(folder + '/actual-state.json', JSON.stringify({ beforeRead, afterRead, beforeSuspend, afterSuspend, beforeRecovery, afterRecovery: await tableRows(), acknowledgedDenialMs: denialMs, deniedStatus: denied.status, pendingDeniedStatus: executeDenied.status, secondIntent, geometry, axe: { violations: axe.violations, passes: axe.passes.length } }, null, 2));
} catch (error) {
  failure = String(error.stack ?? error); if (page) { writeFileSync(folder + '/failure.html', await page.content()); await page.screenshot({ path: folder + '/failure.png', fullPage: true }); }
  throw error;
} finally {
  if (trigger && db) await db.prepare('DROP TRIGGER IF EXISTS ' + trigger).run(); await browser?.close();
  if (worker) { await worker.stop(); disposed = true; free = await new Promise(resolve => { const connection = connect(+new URL(worker.base).port, '127.0.0.1'); connection.once('connect', () => { connection.destroy(); resolve(false); }); connection.once('error', error => resolve(error.code === 'ECONNREFUSED')); }); }
  rmSync(state, { recursive: true, force: true }); const afterSource = custody();
  if (!failure) { check(JSON.stringify(beforeSource) === JSON.stringify(afterSource), 'All owned source/build bytes unchanged during native execution'); check(disposed && free, 'Owned synthetic runtime disposed and loopback port free'); }
  writeFileSync(folder + '/custody.json', JSON.stringify({ before: beforeSource, after: afterSource, unchanged: JSON.stringify(beforeSource) === JSON.stringify(afterSource) }, null, 2));
  writeFileSync(folder + '/result.json', JSON.stringify({ passed: checks.length, failed: failure ? 1 : 0, skipped: 0, checks, requests, errors, external, failure, disposed, free, completedAt: new Date().toISOString(),
    limits: 'Actual synthetic owner suspension and next online request/prepared local-command refusal only. No independent institutional verification, provider job, disconnected device residual-window qualification, real patient/recipient, formal/physical or hosting acceptance.' }, null, 2));
  console.log(JSON.stringify({ passed: checks.length, failed: failure ? 1 : 0, skipped: 0 }));
}
