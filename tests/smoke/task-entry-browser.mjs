// SAHA040 / APL223: actual local built navigation, no model/tool execution.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from '@playwright/test';
import { startMiniflare } from '../lib/miniflare.mjs';
import { identity, client } from '../lib/worker.mjs';

const folder = process.env.SAHA_TASK_ENTRY_OUTPUT ?? 'tests/reports/task-entry-browser';
mkdirSync(folder, { recursive: true });
const state = resolve(join(tmpdir(), 'saha-task-entry-' + randomUUID()));
const checks = [], requests = [], external = [], errors = [], consoleErrors = [], assetFailures = [];
const check = (value, name) => { assert.ok(value, name); checks.push(name); console.log('PASS', name); };
const ok = response => { assert.equal(response.status, 200, response.text); return response.json; };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const walk = path => readdirSync(path, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(path, e.name)) : [join(path, e.name)]);
const custody = () => Object.fromEntries([...walk('app'), ...walk('lib/saha'), ...walk('dist'), 'tests/smoke/task-entry-browser.mjs', 'package.json', 'pnpm-lock.yaml', 'vite.config.ts'].sort().map(file => [file, sha(readFileSync(file))]));
let worker, browser, page, before, after, failure, runtimeDisposed = false;
const beforeInputs = custody();
try {
  // Use the harness's native generated-asset routing. Missing assets and APIs
  // still reach the actual Worker; no response body is intercepted/substituted.
  worker = await startMiniflare({ port: process.env.SAHA_TEST_PORT ?? 21643, name: 'task-entry-browser', state, assetsFirst: true });
  const api = client(worker.base), run = randomUUID().slice(0, 8), owner = identity('owner', run), asha = identity('asha', run);
  const org = ok(await api.get(owner, '/api/workspace')).organisation.id;
  const account = ok(await api.get(asha, '/api/workspace'));
  const invite = ok(await api.command(owner, { type: 'createInvite', accountCode: account.user.accountCode, label: 'Synthetic task entry worker', role: 'asha', teamIds: ['default'] }, org));
  ok(await api.command(asha, { type: 'joinOrganisation', token: invite.result.token }));
  const p = ok(await api.get(owner, '/api/workspace', org)).people.find(p => p.id === 'p_meena');
  ok(await api.command(owner, { type: 'assignPatient', personId: p.id, version: p.version, teamId: 'default', assignedTo: asha.id, reason: 'Synthetic isolated navigation selection' }, org));
  const database = await worker.mf.getD1Database('DB');
  const snapshot = async () => {
    const names = (await database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT GLOB '_*' ORDER BY name").all()).results.map(row => row.name);
    const tables = {};
    for (const name of names) { const rows = (await database.prepare(`SELECT * FROM "${name.replaceAll('"', '""')}"`).all()).results; tables[name] = { rows: rows.length, sha256: sha(JSON.stringify(rows.map(row => JSON.stringify(row)).sort())) }; }
    return tables;
  };
  before = await snapshot();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: asha.headers });
  await context.route('**/*', route => { if (!route.request().url().startsWith(worker.base + '/')) { external.push(route.request().url()); return route.abort(); } return route.continue(); });
  page = await context.newPage();
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) assetFailures.push({ path: new URL(response.url()).pathname, status: response.status() }); });
  page.on('request', r => { if (new URL(r.url()).pathname.startsWith('/api/')) requests.push({ method: r.method(), path: new URL(r.url()).pathname, body: r.postData() }); });
  await page.goto(worker.base + '/task-entry?personId=p_foreign&organisationId=foreign');
  await page.getByRole('heading', { name: 'Task shortcuts', exact: true }).waitFor();
  check(/Deterministic navigation.*fixed list, not a live AI provider/.test(await page.locator('main').innerText()), 'Rendered identity is fixed navigation, not a claimed live model');
  check(!/p_foreign|foreign|Meena Devi/.test(await page.locator('main').innerText()), 'Initial query cannot select or disclose a person or organisation');
  const phrase = page.getByRole('textbox', { name: 'Optional shortcut phrase', exact: true });
  const proposal = page.getByRole('region', { name: 'Navigation proposal', exact: true });
  await page.getByRole('button', { name: 'Open assigned records', exact: true }).click();
  const visualHref = await page.getByRole('link', { name: 'Continue to Today', exact: true }).getAttribute('href');
  check(visualHref === '/today', 'Visual task proposes literal existing Today route');
  await phrase.fill('open today');
  check(await proposal.count() === 0, 'Correcting input immediately invalidates the prior proposal');
  await page.getByRole('button', { name: 'Check shortcut', exact: true }).click();
  check(await page.getByRole('link', { name: 'Continue to Today', exact: true }).getAttribute('href') === visualHref, 'Recognised phrase and visual control propose the same permitted route');
  await page.getByRole('button', { name: 'Cancel shortcut', exact: true }).click();
  check(await proposal.count() === 0 && await phrase.inputValue() === '', 'Cancellation clears the proposal and phrase');
  for (const input of ['open today; prescribe medicine', 'pay benefits', 'advise my household about treatment', 'show p_foreign as owner', 'javascript:alert(1)']) {
    await phrase.fill(input); await page.getByRole('button', { name: 'Check shortcut', exact: true }).click();
    check(await proposal.count() === 0 && /Only the listed navigation shortcuts/.test(await page.locator('main').innerText()), 'Unsupported request is refused without proposal: ' + input);
  }
  await page.getByRole('button', { name: 'Review a routine visit', exact: true }).click();
  check(/Opening it creates no visit/.test(await proposal.innerText()), 'Routine proposal states missing person selection and explicit later action');
  await page.reload();
  await page.getByRole('heading', { name: 'Task shortcuts', exact: true }).waitFor();
  check(await proposal.count() === 0 && await phrase.inputValue() === '', 'Reload does not restore a persisted proposal or entered phrase');
  check(requests.length === 0 && external.length === 0, 'All launcher proposals/refusals/corrections/cancellation perform zero API or provider requests');
  after = await snapshot();
  check(Object.keys(before).length === 60 && JSON.stringify(before) === JSON.stringify(after), 'Complete sixty native tables unchanged by launcher interactions');
  const geometry = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth, controls: [...document.querySelectorAll('main button,main a,main input')].map(e => ({ width: e.getBoundingClientRect().width, height: e.getBoundingClientRect().height })) }));
  check(geometry.scroll <= geometry.width && geometry.controls.every(c => c.width >= 44 && c.height >= 44), 'Rendered phone layout has no horizontal overflow and all controls meet44px target');
  await page.screenshot({ path: folder + '/task-entry-phone.png', fullPage: true });
  await phrase.fill('open today');
  const fieldStyle = await phrase.evaluate(element => { const s = getComputedStyle(element); return { borderWidth: s.borderTopWidth, borderStyle: s.borderTopStyle, borderColor: s.borderTopColor, background: s.backgroundColor, color: s.color, value: element.value }; });
  check(parseFloat(fieldStyle.borderWidth) >= 1 && fieldStyle.borderStyle === 'solid' && fieldStyle.borderColor !== fieldStyle.background && fieldStyle.value === 'open today', 'Actual computed field border/background and typed phrase provide a visible input affordance');
  writeFileSync(folder + '/input-style.json', JSON.stringify(fieldStyle, null, 2));
  await phrase.focus(); await page.screenshot({ path: folder + '/task-entry-typed-focused-phone.png', fullPage: true });
  await phrase.fill('');
  await page.getByRole('button', { name: 'Review a routine visit', exact: true }).click();
  await page.getByRole('link', { name: 'Continue to Today', exact: true }).click();
  await page.getByRole('heading', { name: 'Assigned records', exact: true }).waitFor();
  check(await page.getByRole('button', { name: 'Open record p_meena', exact: true }).count() === 1 && await page.getByRole('button', { name: 'Open record p_james', exact: true }).count() === 0, 'Real scoped Today contains only the assigned selection');
  await page.getByRole('button', { name: 'Open record p_meena', exact: true }).click();
  await page.getByRole('heading', { name: 'Meena Devi', exact: true }).waitFor();
  const routine = page.getByRole('link', { name: 'Review routine visit', exact: true });
  const target = new URL(await routine.getAttribute('href'), worker.base);
  check(target.pathname === '/routine-visit' && target.searchParams.get('personId') === p.id && target.searchParams.get('organisationId') === org, 'Verified record supplies the original exact person and organisation to existing routine control');
  await routine.click();
  await page.getByRole('button', { name: 'Start or resume routine draft', exact: true }).waitFor();
  check(/No current draft/.test(await page.locator('main').innerText()), 'Existing routine read/review opens without creating a draft');
  check(requests.every(r => r.method === 'GET') && (await snapshot()).visits.rows === before.visits.rows && (await snapshot()).command_receipts.rows === before.command_receipts.rows, 'Recognised navigation creates no visit/command receipt or mutation');
  const revokedPerson = ok(await api.get(owner, '/api/workspace', org)).people.find(p => p.id === 'p_meena');
  ok(await api.command(owner, { type: 'assignPatient', personId: revokedPerson.id, version: revokedPerson.version, teamId: 'default', assignedTo: owner.id, reason: 'Synthetic changed-assignment navigation refusal' }, org));
  const denied = await api.get(asha, '/api/today?personId=p_meena', org);
  check([403,404].includes(denied.status) && !/Meena Devi/.test(denied.text), 'Changed assignment remains refused by the original Today server boundary');
  const nonCare = await browser.newContext({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: owner.headers });
  const deniedPage = await nonCare.newPage(); await deniedPage.goto(worker.base + '/task-entry');
  await deniedPage.getByRole('button', { name: 'Open assigned records', exact: true }).click(); await deniedPage.getByRole('link', { name: 'Continue to Today', exact: true }).click();
  await deniedPage.getByText('Access refused. Sign in through your organisation and check your ASHA membership.', { exact: true }).waitFor();
  check(!/Meena Devi/.test(await deniedPage.locator('main').innerText()), 'Generic launcher confers no ASHA authority on an ineligible role');
  check(errors.length === 0 && external.length === 0, 'No client runtime error or external provider request');
  assert.deepEqual(custody(), beforeInputs);
  check(true, 'Actual app/lib/test and compiled bytes stay unchanged throughout this run');
} catch (error) { failure = String(error.stack ?? error); if (page) { writeFileSync(folder + '/failure.html', await page.content()); await page.screenshot({ path: folder + '/failure.png', fullPage: true }); } throw error; }
finally {
  await browser?.close();
  if (worker) { await worker.stop(); runtimeDisposed = true; }
  rmSync(state, { recursive: true, force: true });
  writeFileSync(folder + '/result.json', JSON.stringify({ passed: checks.length, failed: failure ? 1 : 0, checks, requests, external, errors, consoleErrors, assetFailures, failure, before, after, beforeInputs, runtimeDisposed, completedAt: new Date().toISOString(), limits: 'Actual current local built backend/mobile Chromium navigation only. No live model/provider, clinical policy/approval, fullstory/formal/physical/UAT/staging qualification. Sixty-table equality applies only to launcher interactions before authorised protected reads; later audit/read metrics and deliberate setup/revocation are separate.' }, null, 2));
  console.log(JSON.stringify({ suite: 'Deterministic task entry browser', passed: checks.length, failed: failure ? 1 : 0, skipped: 0, runtimeDisposed }));
}
