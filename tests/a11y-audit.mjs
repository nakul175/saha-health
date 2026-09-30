// Slice 6e automated accessibility audit: axe-core WCAG 2.0/2.1/2.2 A and AA rules over the main
// screens and dialogs of a running local Worker, as an owner and as an ASHA. Synthetic accounts only.
// Slice 6f adds the field notebook (English and Hindi) and a 390 × 844 phone viewport.
// Needs playwright and axe-core resolvable from SAHA_A11Y_MODULES (a directory with node_modules)
// and a Worker at SAHA_A11Y_ORIGIN (default http://127.0.0.1:8790). Writes tests/a11y-audit-result.json.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const require = createRequire(join(process.env.SAHA_A11Y_MODULES ?? process.cwd(), 'package.json'));
const { chromium } = require('playwright');
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const axeVersion = require('axe-core/package.json').version;
const base = process.env.SAHA_A11Y_ORIGIN ?? 'http://127.0.0.1:8790', run = Date.now();
const H = (id, name) => ({ 'oai-authenticated-user-id': id, 'oai-authenticated-user-email': `${id}@example.invalid`, 'oai-authenticated-user-full-name': encodeURIComponent(name), 'oai-authenticated-user-full-name-encoding': 'percent-encoded-utf-8' });
const owner = H(`a11y-owner-${run}`, 'Audit Owner'), asha = H(`a11y-asha-${run}`, 'Audit Asha');
const api = async (h, body, org) => { const r = await fetch(base + '/api/commands', { method: 'POST', headers: { ...h, 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID(), ...(org ? { 'x-saha-organisation': org } : {}) }, body: JSON.stringify(body) }); return r.json(); };
const o = await (await fetch(base + '/api/workspace', { headers: owner })).json(), a = await (await fetch(base + '/api/workspace', { headers: asha })).json(), org = o.organisation.id;
const inv = await api(owner, { type: 'createInvite', accountCode: a.user.accountCode, label: 'Audit Asha', role: 'asha', teamIds: ['default'] }, org);
await api(asha, { type: 'joinOrganisation', token: inv.result.token });
const meena = o.people.find(p => p.name.startsWith('Meena'));
await api(owner, { type: 'assignPatient', personId: meena.id, version: meena.version, teamId: 'default', assignedTo: a.user.userId, reason: 'Accessibility audit assignment' }, org);
const browser = await chromium.launch({ executablePath: process.env.SAHA_A11Y_CHROMIUM });
const results = [], keyboard = [];
// Slice 6f: keyboard walk. Presses Tab up to 60 times and records every focus stop and whether it shows
// a visible focus indicator (outline or box-shadow), which axe-core does not check (WCAG 2.4.7).
async function walk(page, screen) {
  await page.evaluate(() => { document.activeElement?.blur?.(); window.scrollTo(0, 0); });
  const stops = [];
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press('Tab'); await page.waitForTimeout(250); // let focus-style transitions finish
    const s = await page.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null; const c = getComputedStyle(e); const name = (e.getAttribute('aria-label') || e.innerText || e.getAttribute('placeholder') || e.id || e.closest('label')?.firstChild?.textContent || e.type || e.tagName).trim().slice(0, 40); return { tag: e.tagName.toLowerCase(), name, visible: (c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) > 0) || (c.boxShadow && c.boxShadow !== 'none') }; });
    if (!s) continue; if (stops.length && stops[0].tag === s.tag && stops[0].name === s.name) break; stops.push(s);
  }
  keyboard.push({ screen, stops: stops.length, withoutVisibleFocus: stops.filter(x => !x.visible).map(x => `${x.tag}:${x.name}`) });
}
async function audit(page, screen) {
  await page.waitForTimeout(700);
  await page.addScriptTag({ content: axeSource });
  const r = await page.evaluate(async () => await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }, resultTypes: ['violations'] }));
  results.push({ screen, violations: r.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, targets: v.nodes.slice(0, 3).map(n => n.target.join(' ')) })) });
}
async function session(headers, steps, viewport = { width: 1280, height: 900 }, start = '/') {
  const ctx = await browser.newContext({ extraHTTPHeaders: headers, viewport });
  const page = await ctx.newPage(); await page.goto(base + start, { waitUntil: 'networkidle' });
  for (const [screen, go] of steps) { try { await go(page); await audit(page, screen); } catch (e) { results.push({ screen, error: String(e.message).split('\n')[0] }); } }
  await ctx.close();
}
const nav = name => async page => { await page.keyboard.press('Escape').catch(() => {}); await page.getByRole('button', { name, exact: true }).first().click(); };
const openPatient = async page => { await page.keyboard.press('Escape').catch(() => {}); await nav('People')(page); await page.getByRole('button', { name: /Meena Devi/ }).first().click(); };
const dialog = name => async page => { await openPatient(page); await page.getByRole('button', { name }).click(); };
await session(owner, [
  ['Owner · home', async page => { await walk(page, 'Owner · home · keyboard'); }],
  ['Owner · people', nav('People')],
  ['Owner · patient', openPatient],
  ['Owner · household dialog', dialog('Household & proxies')],
  ['Owner · identity dialog', dialog('Identity & merges')],
  ['Owner · rights dialog', dialog('Rights requests')],
  ['Owner · ABHA dialog', dialog('ABHA & consent')],
  ['Owner · care handover', nav('Care handover')],
  ['Owner · operations', nav('Operations')],
  ['Owner · organisation', nav('Organisation & team')],
  ['Owner · activity log', nav('Activity log')],
  ['Owner · connections', nav('Connections')],
]);
await session(asha, [
  ['ASHA · home', async () => {}],
  ['ASHA · my work', nav('My work')],
  ['ASHA · patient', openPatient],
  ['ASHA · visit', async page => { await openPatient(page); await page.getByRole('button', { name: /Start visit|New visit/ }).first().click(); }],
  ['ASHA · care handover', nav('Care handover')],
]);
const phone = { width: 390, height: 844 };
const unlock = async page => { await page.fill('#passphrase', 'synthetic-a11y-field-phrase'); await page.press('#passphrase', 'Enter'); await page.waitForSelector('#notebook:not([hidden])'); };
const prepared = async page => { await page.click('#load'); await page.waitForFunction(() => document.querySelectorAll('#patient option').length > 0); const v = await page.$eval('#patient', s => [...s.options].find(o => o.text.startsWith('Meena'))?.value); await page.selectOption('#patient', v); await page.click('#prepare'); await page.waitForSelector('#editor h2'); };
for (const [label, viewport] of [['desktop', undefined], ['phone', phone]]) await session(asha, [
  [`ASHA · field notebook locked · ${label}`, async () => {}],
  [`ASHA · field notebook draft · ${label}`, async page => { await unlock(page); await prepared(page); if (!viewport) await walk(page, 'ASHA · field notebook draft · keyboard'); }],
  [`ASHA · field notebook draft Hindi · ${label}`, async page => { await page.selectOption('#language', 'hi'); }],
], viewport, '/field/');
await session(owner, [['Owner · home · phone', async () => {}], ['Owner · patient · phone', async page => { await page.goto(base + '/', { waitUntil: 'networkidle' }); await page.getByRole('button', { name: /Meena Devi/ }).first().click().catch(async () => { await page.getByRole('button', { name: 'Toggle Sidebar' }).first().click(); await page.getByRole('button', { name: 'People', exact: true }).first().click(); await page.getByRole('button', { name: /Meena Devi/ }).first().click(); }); }]], phone);
await browser.close();
const byRule = {};
for (const r of results) for (const v of r.violations ?? []) { byRule[v.id] ??= { impact: v.impact, help: v.help, screens: 0, nodes: 0 }; byRule[v.id].screens++; byRule[v.id].nodes += v.nodes; }
const report = { tool: `axe-core ${axeVersion}`, tags: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'], screens: results.length, screensWithErrors: results.filter(r => r.error).length, violationsByRule: byRule, totalViolationNodes: Object.values(byRule).reduce((n, r) => n + r.nodes, 0), results, keyboard, limits: 'Automated rules find a subset of WCAG failures. The keyboard walk checks focus order reachability and a visible focus style only. No screen-reader, zoom or representative-user review was done.', completedAt: new Date().toISOString() };
writeFileSync(process.env.SAHA_A11Y_OUT ?? 'tests/a11y-audit-result.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ keyboard: keyboard.map(k => `${k.screen}: ${k.stops} stops, ${k.withoutVisibleFocus.length} without visible focus ${k.withoutVisibleFocus.slice(0, 6).join(', ')}`), screens: report.screens, errors: report.screensWithErrors, totalViolationNodes: report.totalViolationNodes, rules: Object.fromEntries(Object.entries(byRule).map(([k, v]) => [k, `${v.impact}:${v.nodes}@${v.screens}`])) }, null, 1));
