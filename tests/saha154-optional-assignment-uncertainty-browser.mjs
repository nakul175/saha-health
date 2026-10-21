import assert from 'node:assert/strict';
import { startWorker, identity, client } from './lib/worker.mjs';

const { chromium } = await import(process.env.SAHA_BROWSER_PACKAGE ?? '@playwright/test');
let worker, browser, passed = 0;
const check = (value, message) => { assert.ok(value, message); passed++; };

try {
  worker = await startWorker({ port: 19654, name: 'saha154-assignment-uncertainty' });
  const api = client(worker.base), run = crypto.randomUUID().slice(0, 8);
  const owner = identity('saha154-owner', run, 'Synthetic Assignment Owner');
  const invited = identity('saha154-worker', run, 'Synthetic Assignment Worker');
  const home = (await api.get(owner, '/api/workspace')).json, org = home.organisation.id;
  const invitedHome = (await api.get(invited, '/api/workspace')).json;
  const invite = await api.command(owner, { type: 'createInvite', accountCode: invitedHome.user.accountCode, label: 'Optional assignment worker', role: 'asha', teamIds: ['default'] }, org);
  assert.equal(invite.status, 200, invite.text);
  assert.equal((await api.command(invited, { type: 'joinOrganisation', token: invite.json.result.token })).status, 200);
  const offer = await api.command(owner, { type: 'offerOptionalAssignment', workerId: invited.id, teamId: 'default', title: 'Synthetic uncertain assignment', summary: 'Review the synthetic register without changing routine care.', evidencePrompt: 'Record the synthetic register reference only.', dueAt: new Date(Date.now() + 7 * 86400000).toISOString() }, org);
  assert.equal(offer.status, 200, offer.text);
  const assignmentId = offer.json.result.assignmentId;

  browser = await chromium.launch({ headless: true, executablePath: process.env.SAHA_CHROMIUM });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: owner.headers });
  const page = await context.newPage(), errors = [], attempts = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto(worker.base + '/app?phone=1');
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'Care handover', exact: true }).click();
  const panel = page.locator('section.panel').filter({ has: page.getByRole('heading', { name: 'Synthetic incentive claims', exact: true }) });
  const row = panel.locator('li.merge-case').filter({ hasText: 'Synthetic uncertain assignment' });
  await row.locator('summary').click();
  await row.getByLabel('Cancellation reason', { exact: true }).fill('Synthetic cancellation after programme review');

  let loseResponse = true, makeReadUnavailable = false;
  await page.route('**/api/incentive-claims*', async route => {
    if (makeReadUnavailable) { makeReadUnavailable = false; await route.abort('failed'); }
    else await route.continue();
  });
  await page.route('**/api/commands', async route => {
    const request = route.request(), body = request.postDataJSON();
    if (body?.type !== 'cancelOptionalAssignment' || body.assignmentId !== assignmentId) return route.continue();
    const key = request.headers()['idempotency-key'];
    attempts.push({ key, body: request.postData() });
    const sendExactly = () => api.call(owner, '/api/commands', { method: 'POST', body, org, headers: { 'Idempotency-Key': key, 'x-saha-response': 'delta' } });
    if (loseResponse) {
      loseResponse = false;
      const committed = await sendExactly();
      assert.equal(committed.status, 200, committed.text);
      await route.abort('failed');
      return;
    }
    makeReadUnavailable = true;
    const replay = await sendExactly();
    assert.equal(replay.status, 200, replay.text);
    await route.fulfill({ status: replay.status, contentType: 'application/json', body: replay.text });
  });

  await row.getByRole('button', { name: 'Cancel optional assignment', exact: true }).click();
  await panel.locator('[role="status"]').filter({ hasText: 'Optional-assignment outcome unconfirmed.' }).waitFor();
  check(await row.getByText('outcome unconfirmed', { exact: true }).isVisible(), 'Committed-but-response-lost transition is not presented as the stale offered state');
  check(await page.getByRole('button', { name: 'Refresh', exact: true }).first().isEnabled(), 'Routine care refresh remains usable while optional assignment is unresolved');
  check(await row.getByRole('button', { name: 'Cancel optional assignment', exact: true }).isDisabled(), 'A second optional assignment change is held while the original outcome is unresolved');

  await panel.getByRole('button', { name: 'Recover exact optional-assignment attempt', exact: true }).click();
  await panel.locator('[role="status"]').filter({ hasText: 'Assignment status unavailable.' }).waitFor();
  check(attempts.length === 2 && attempts[0].key === attempts[1].key && attempts[0].body === attempts[1].body, 'Recovery reuses the exact actor-bound operation key and body');
  check(await row.getByText('last confirmed offered', { exact: true }).isVisible(), 'Unavailable refresh labels the displayed row as last-confirmed rather than current');
  check(await row.getByRole('button', { name: 'Cancel optional assignment', exact: true }).isDisabled(), 'Unavailable assignment state refuses another transition');
  const current = await api.get(owner, '/api/incentive-claims', org), saved = current.json.optionalAssignments.rows.find(item => item.id === assignmentId);
  check(current.status === 200 && saved.state === 'cancelled' && saved.history.filter(event => event.action === 'cancelled').length === 1, 'Exact replay recovers one durable cancellation without duplicate mutation');

  await page.unroute('**/api/incentive-claims*');
  await page.reload();
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'Care handover', exact: true }).click();
  const refreshed = page.locator('section.panel').filter({ has: page.getByRole('heading', { name: 'Synthetic incentive claims', exact: true }) }).locator('li.merge-case').filter({ hasText: 'Synthetic uncertain assignment' });
  await refreshed.getByText('cancelled', { exact: true }).waitFor();
  check(!(await page.getByText('Optional-assignment outcome unconfirmed.', { exact: false }).count()), 'A fresh authorised read shows the recovered durable state without an uncertainty claim');
  check(errors.length === 0, 'No uncaught browser errors');
  console.log(JSON.stringify({ suite: 'SAHA-154 optional assignment uncertainty browser', passed, failed: 0, actualWorker: true, actualD1: true, committedResponseLost: true }));
} finally {
  await browser?.close();
  await worker?.stop();
}
