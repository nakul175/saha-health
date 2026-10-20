// SAHA-156: real local Worker/D1 + Chromium proof that optional help preserves the routine task.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { startWorker, identity, client } from './lib/worker.mjs';
const { chromium } = await import(process.env.SAHA_BROWSER_PACKAGE ?? '@playwright/test');
let worker, browser, passed = 0;
const check = (value, message) => { assert.ok(value, message); passed++; };
const output = 'tests/evidence/saha-156-point-of-need-help/browser-result.json';
try {
  worker = await startWorker({ port: process.env.SAHA_HELP_PORT ?? '21457', name: 'saha-point-help' });
  const api = client(worker.base), run = crypto.randomUUID().slice(0, 8);
  const owner = identity('help-owner', run, 'Synthetic Help Owner'), asha = identity('help-asha', run, 'Synthetic Help ASHA');
  const ownerHome = await api.get(owner, '/api/workspace'), ashaHome = await api.get(asha, '/api/workspace');
  assert.equal(ownerHome.status, 200); assert.equal(ashaHome.status, 200);
  const org = ownerHome.json.organisation.id, person = ownerHome.json.people.find(value => value.name === 'Meena Devi');
  const invite = await api.command(owner, { type: 'createInvite', accountCode: ashaHome.json.user.accountCode, label: 'Synthetic Help ASHA', role: 'asha', teamIds: ['default'] }, org);
  assert.equal(invite.status, 200); assert.equal((await api.command(asha, { type: 'joinOrganisation', token: invite.json.result.token })).status, 200);
  assert.equal((await api.command(owner, { type: 'assignPatient', personId: person.id, version: person.version, teamId: 'default', assignedTo: ashaHome.json.user.userId, reason: 'Synthetic point-of-need help check' }, org)).status, 200);
  browser = await chromium.launch({ headless: true, ...(process.env.SAHA_CHROMIUM ? { executablePath: process.env.SAHA_CHROMIUM } : {}) });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: asha.headers });
  const page = await context.newPage(), errors = [], commandWrites = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('request', request => { if (new URL(request.url()).pathname === '/api/commands') commandWrites.push(request.postData()); });
  await page.goto(worker.base + '/app?patient=' + person.id); await page.getByRole('heading', { name: person.name, exact: true }).waitFor();
  await page.getByRole('button', { name: 'Start visit', exact: true }).click();
  const picker = page.getByRole('combobox', { name: 'Go to observation or save', exact: true }); await picker.waitFor(); commandWrites.length = 0;
  await picker.selectOption('fact:weight'); await page.getByRole('textbox', { name: 'Weight · kg', exact: true }).fill('57.5');
  await page.getByRole('button', { name: 'Need help with this step?', exact: true }).click();
  const help = page.locator('.point-help-content');
  check(await page.getByRole('heading', { name: 'Record this observation', exact: true }).isVisible(), 'Weight step exposes relevant optional procedural help');
  check((await help.innerText()).includes('Source: Saha routine-task guidance v1.0'), 'Actual journey exposes fixed help provenance');
  check(!(await help.innerText()).includes(person.name) && !(await help.innerText()).includes(person.id), 'Help preview carries no selected-person identity');
  check((await page.getByRole('textbox', { name: 'Weight · kg', exact: true }).inputValue()) === '57.5', 'Opening help preserves unsaved observation');
  await picker.selectOption('notes'); await help.waitFor({ state: 'detached' }); check(!await page.locator('.point-help-content').count(), 'Moving to another step closes stale help');
  await picker.selectOption('fact:weight'); check((await page.getByRole('textbox', { name: 'Weight · kg', exact: true }).inputValue()) === '57.5', 'Returning to the task preserves unsaved observation');
  await page.getByRole('button', { name: 'Need help with this step?', exact: true }).click(); await page.getByRole('button', { name: 'Close optional help', exact: true }).click();
  check((await page.getByRole('textbox', { name: 'Weight · kg', exact: true }).inputValue()) === '57.5', 'Dismissal preserves the manual task path');
  check(commandWrites.length === 0, 'Help open, step change and dismissal send no command');
  const saved = await api.get(asha, '/api/workspace', org), visit = saved.json.visits.find(value => value.personId === person.id);
  check(visit.state === 'draft' && visit.facts.weight === '', 'Optional help does not save or confirm durable work');
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '390px journey has no horizontal overflow');
  check(errors.length === 0, 'Actual journey has no browser runtime errors');
  writeFileSync(output, JSON.stringify({ suite: 'SAHA-156 point-of-need help browser', passed, failed: 0, completedAt: new Date().toISOString(), limits: 'Local synthetic Worker/D1 and Chromium only; no clinical, physical-device, CI, merge, deployment or formal acceptance.' }, null, 2) + '\n');
  console.log(JSON.stringify({ passed }));
} catch (error) {
  writeFileSync(output, JSON.stringify({ suite: 'SAHA-156 point-of-need help browser', passed, failed: 1, error: String(error), completedAt: new Date().toISOString() }, null, 2) + '\n');
  throw error;
} finally { await browser?.close(); await worker?.stop(); }
