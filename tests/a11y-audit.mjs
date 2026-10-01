// Slice 6e automated accessibility audit: axe-core WCAG 2.0/2.1/2.2 A and AA rules over the main
// screens and dialogs of a running local Worker, as an owner and as an ASHA. Synthetic accounts only.
// Slice 6f adds the field notebook (English and Hindi) and a 390 × 844 phone viewport.
// Slice 6x adds populated panels, empty states and simulated 409/503 error states at both widths, dialog focus-trap,
// Escape and focus-return checks, document-order Tab walks and live-region checks for error messages.
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
  results.push({ screen, violations: r.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, targets: v.nodes.slice(0, 3).map(n => n.target.join(' ')), firstFailure: (v.nodes[0]?.failureSummary ?? '').replace(/\s+/g, ' ').slice(0, 240) })) });
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

// ---------------------------------------------------------------------------------------------------------------
// Slice 6x: populated panels, empty states and error states at desktop and phone widths, plus keyboard checks:
// every dialog traps focus, Escape closes it and focus returns to its opener; disclosures close on Escape and return
// focus; Tab order follows document order with no positive tabindex. A second synthetic owner and ASHA work in their
// own organisation so the first owner's screens above stay in their empty states.
const dialogs = [], tabOrder = [], liveRegions = [], setup = [];
const pOwner = H(`a11y-pop-owner-${run}`, 'Populated Owner'), pAsha = H(`a11y-pop-asha-${run}`, 'Populated Asha');
let pw = await (await fetch(base + '/api/workspace', { headers: pOwner })).json();
const pa = await (await fetch(base + '/api/workspace', { headers: pAsha })).json(), porg = pw.organisation.id;
const post = async (h, body, o = porg) => { const r = await fetch(base + '/api/commands', { method: 'POST', headers: { ...h, 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID(), ...(o ? { 'x-saha-organisation': o } : {}) }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); if (j.snapshot && h === pOwner) pw = j.snapshot; setup.push(`${body.type}:${r.status}`); return j; };
const pinv = await post(pOwner, { type: 'createInvite', accountCode: pa.user.accountCode, label: 'Populated Asha', role: 'asha', teamIds: ['default'] });
await post(pAsha, { type: 'joinOrganisation', token: pinv.result?.token }, null);
await post(pOwner, { type: 'setSignOffPolicy', required: true, version: 0, reason: 'Synthetic accessibility audit of the sign-off panel.' });
const pm = () => pw.people.find(p => p.name.startsWith('Meena')), pv = id => pw.visits.find(v => v.id === id);
await post(pOwner, { type: 'assignPatient', personId: pm().id, version: pm().version, teamId: 'default', assignedTo: pa.user.userId, reason: 'Accessibility audit assignment' });
const facts = { date: new Date(Date.now() - 60000).toISOString().slice(0, 16), systolic: '150', diastolic: '96', weight: '60', temperature: '', weeks: '24', coughDays: '', notes: 'Synthetic accessibility audit visit.', source: 'measured' };
const visitIds = [];
for (let n = 0; n < 2; n++) { await post(pOwner, { type: 'startVisit', personId: pm().id }); const id = pw.visits.find(v => v.personId === pm().id && v.state === 'draft').id; await post(pOwner, { type: 'saveVisit', visitId: id, version: pv(id).version, facts }); await post(pOwner, { type: 'confirmVisit', visitId: id, version: pv(id).version, patientCheck: { personId: pm().id, personVersion: pm().version, confirmed: true } }); visitIds.push(id); }
await post(pOwner, { type: 'voidVisit', visitId: visitIds[0], version: pv(visitIds[0]).recordVersion, reason: 'Recorded against the wrong person' });
const rid = (await post(pOwner, { type: 'createReferral', visitId: visitIds[1], facility: 'Synthetic CHC', reason: 'Synthetic raised blood pressure' })).result?.referralId;
await post(pOwner, { type: 'assignReferral', referralId: rid, version: 1, ownerId: pw.user.userId, due: new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10), urgency: 'urgent', reason: 'Synthetic owner for the accessibility audit' });
await post(pOwner, { type: 'enrolProgramme', personId: pm().id, version: pm().version, packId: 'tb', episodeLabel: 'Synthetic audit episode', startDate: null });
await post(pOwner, { type: 'outreachCreate', title: 'Synthetic accessibility outreach', date: new Date(Date.now() + 86400000).toISOString().slice(0, 10), teamId: 'default', ownerId: pw.user.userId, personIds: [pm().id], criteria: 'Synthetic cohort for the accessibility audit.' });
await post(pOwner, { type: 'retentionHoldPlace', scope: 'person', personId: pm().id, reason: 'Synthetic legal hold for the accessibility audit.', reference: 'A11Y-1' });
await post(pOwner, { type: 'opsIncident', version: 0, title: 'Synthetic accessibility audit incident', severity: 'critical', ownerId: pw.user.userId });
// Dialog and disclosure check. The opener is focused and activated from the keyboard; focus must move inside, stay
// inside for Tab and Shift+Tab, Escape must close it, and focus must come back to the opener.
async function dialogCheck(page, name, opener, { modal = true, container = '[role="dialog"],[role="alertdialog"]' } = {}) {
  const r = { name, modal };
  try {
    await opener.scrollIntoViewIfNeeded(); await opener.evaluate(e => e.setAttribute('data-a11y-opener', '1')); await opener.focus(); await page.keyboard.press('Enter');
    await page.waitForSelector(container, { state: 'visible', timeout: 4000 }); await page.waitForTimeout(400);
    const inside = () => page.evaluate(c => { const d = [...document.querySelectorAll(c)].filter(x => x.offsetParent !== null || getComputedStyle(x).position === 'fixed'); const a = document.activeElement; return d.some(x => x.contains(a)); }, container);
    r.focusMovedInside = await inside(); r.dialogName = await page.evaluate(c => { const d = document.querySelector(c); if (!d) return null; const l = d.getAttribute('aria-labelledby'); return d.getAttribute('aria-label') || (l && document.getElementById(l)?.textContent) || null; }, container);
    if (modal) { let escaped = 0; for (let i = 0; i < 25; i++) { await page.keyboard.press('Tab'); if (!(await inside())) escaped++; } for (let i = 0; i < 6; i++) { await page.keyboard.press('Shift+Tab'); if (!(await inside())) escaped++; } r.focusEscapes = escaped; r.trapsFocus = escaped === 0; }
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    r.closedOnEscape = await page.evaluate(c => ![...document.querySelectorAll(c)].some(x => x.offsetParent !== null || getComputedStyle(x).position === 'fixed'), container);
    r.focusReturned = await page.evaluate(() => document.activeElement?.getAttribute('data-a11y-opener') === '1');
    r.passed = modal ? r.focusMovedInside && r.trapsFocus && r.closedOnEscape && r.focusReturned && !!r.dialogName : r.closedOnEscape && r.focusReturned && !!r.dialogName; // a disclosure may keep focus on its button
  } catch (e) { r.error = String(e.message).split('\n')[0]; r.passed = false; }
  await page.evaluate(() => document.querySelectorAll('[data-a11y-opener]').forEach(e => e.removeAttribute('data-a11y-opener'))).catch(() => {});
  dialogs.push(r);
}
// Tab order: walks focus stops and checks they follow document order (no positive tabindex, no script-driven jumps).
// Backward vertical jumps within the same column are listed for human review; they are not failures by themselves.
async function orderWalk(page, screen) {
  await page.evaluate(() => { document.activeElement?.blur?.(); window.scrollTo(0, 0); });
  const positive = await page.evaluate(() => [...document.querySelectorAll('[tabindex]')].filter(e => e.tabIndex > 0).map(e => e.tagName.toLowerCase() + ':' + (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 30)));
  const stops = [];
  for (let i = 0; i < 80; i++) {
    await page.keyboard.press('Tab');
    const s = await page.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null; const all = document.getElementsByTagName('*'); let idx = -1; for (let i = 0; i < all.length; i++) if (all[i] === e) { idx = i; break; } const b = e.getBoundingClientRect(); let scroll = window.scrollY; for (let p = e.parentElement; p; p = p.parentElement) scroll += p.scrollTop; return { idx, tag: e.tagName.toLowerCase(), name: (e.getAttribute('aria-label') || e.innerText || e.getAttribute('placeholder') || e.id || '').trim().replace(/\s+/g, ' ').slice(0, 40), top: b.top + scroll, left: b.left, right: b.right }; });
    if (!s) continue; if (stops.length && stops[0].idx === s.idx) break; stops.push(s);
  }
  const outOfDom = [], backward = [];
  const first = Math.min(...stops.map(x => x.idx)); // the walk starts after the last clicked control and wraps once to the first stop
  for (let i = 1; i < stops.length; i++) { const a = stops[i - 1], b = stops[i]; if (b.idx === first) continue; if (b.idx < a.idx) outOfDom.push(`${a.tag}:${a.name} -> ${b.tag}:${b.name}`); if (b.idx !== first && b.top < a.top - 40 && b.left < a.right && b.right > a.left) backward.push(`${a.tag}:${a.name} -> ${b.tag}:${b.name}`); }
  tabOrder.push({ screen, stops: stops.length, positiveTabindex: positive, outOfDocumentOrder: outOfDom, backwardInSameColumnForReview: backward, passed: !positive.length && !outOfDom.length });
}
// Live regions: the text of a status or error message must sit inside an aria-live, role=status or role=alert region.
async function liveCheck(page, screen, pattern, required = true) {
  const r = await page.evaluate(src => { const re = new RegExp(src, 'i'); const hits = [...document.querySelectorAll('body *')].filter(e => e.children.length === 0 && !e.closest('script,style,noscript,template,select,option,label,[role=option],[data-slot^=select],[role=combobox]') && re.test(e.textContent || '')); return hits.slice(0, 5).map(e => { const live = e.closest('[aria-live]:not([aria-live="off"]),[role="status"],[role="alert"],[role="log"]'); const where = e.closest('section,[role=dialog],main,header'); return { text: (e.textContent || '').trim().slice(0, 80), where: where ? where.tagName.toLowerCase() + (where.className ? '.' + String(where.className).split(' ')[0] : '') + (where.querySelector('h2,h3')?.textContent ? ' · ' + where.querySelector('h2,h3').textContent.trim().slice(0, 40) : '') : null, region: live ? (live.getAttribute('role') || 'aria-live=' + live.getAttribute('aria-live')) : null }; }); }, pattern.source);
  liveRegions.push({ screen, found: r.length, announced: r.filter(x => x.region).length, messages: r, ...(r.length ? {} : { note: 'No error message was rendered on this screen.' }), passed: (!required || r.length > 0) && r.every(x => x.region) });
}
// Populated-state probe: records whether the seeded content the screen is meant to show was on the page when audited.
const probes = [];
const shows = (fn, re) => async page => { await fn(page); await page.waitForTimeout(500); const text = await page.evaluate(() => document.body.innerText); probes.push({ pattern: re.source, shown: re.test(text) }); };
const openVisitReview = async page => { await openPatient(page); await page.getByRole('tab', { name: /Review/ }).first().click().catch(() => {}); };
const present = (page, sel) => page.waitForSelector(sel, { timeout: 5000 }).then(() => true, () => false); // panels load after the view opens
const toOrg = async page => { if (!(await present(page, '#pack-installation-heading'))) await nav('Organisation & team')(page); await page.waitForSelector('#pack-installation-heading'); };
const showPacks = async page => { await toOrg(page); const s = page.locator('section:has(#pack-installation-heading)'); const b = s.getByRole('button', { name: 'Show installations' }); if (await b.count()) await b.click(); await page.waitForTimeout(400); };
const expandActivity = async page => { if (!(await present(page, '#worker-activity-title'))) await nav('Care handover')(page); await page.waitForSelector('#worker-activity-title'); const d = page.locator('section:has(#worker-activity-title) details'); if (await d.count()) await d.first().evaluate(x => { x.open = true; }); await page.waitForTimeout(300); };
const openBell = async page => { await page.keyboard.press('Escape').catch(() => {}); const b = page.locator('.alert-bell-button'); if ((await b.getAttribute('aria-expanded')) !== 'true') await b.click(); await page.waitForSelector('#alert-inbox'); };
// Empty states: the first owner's organisation has no referrals, outreach, programme follow-ups or incidents.
await session(owner, [
  ['Empty · owner · outreach', nav('Outreach')],
  ['Empty · owner · programmes', nav('Programmes')],
  ['Empty · owner · clinical governance', nav('Clinical governance')],
  ['Empty · owner · pilot readiness', nav('Pilot readiness')],
  ['Empty · owner · expansion', nav('Expansion')],
  ['Empty · owner · submissions', nav('Submissions')],
  ['Empty · owner · AI tools', nav('AI tools')],
  ['Empty · owner · my work', nav('My work')],
  ['Empty · owner · pack installations', showPacks],
]);
// Populated states, desktop then phone. On the phone the sidebar is a sheet opened from "Toggle Sidebar".
const phoneNav = name => async page => { for (let attempt = 0; attempt < 2; attempt++) { try { await page.keyboard.press('Escape').catch(() => {}); await page.evaluate(() => window.scrollTo(0, 0)); await page.getByRole('button', { name: 'Toggle Sidebar' }).first().click({ timeout: 8000 }); await page.getByRole('button', { name, exact: true }).first().click({ timeout: 8000 }); await page.waitForTimeout(300); return; } catch (e) { if (attempt) throw e; await page.waitForTimeout(1000); } } };
for (const [label, viewport] of [['desktop', undefined], ['phone', phone]]) {
  const go = viewport ? phoneNav : nav;
  const patient = async page => { await page.keyboard.press('Escape').catch(() => {}); await go('People')(page); await page.getByRole('button', { name: /Meena Devi/ }).first().click(); };
  await session(pOwner, [
    [`Populated · owner · home · ${label}`, async page => { if (!viewport) { await orderWalk(page, 'Populated · owner · home'); } }],
    [`Populated · owner · patient record · ${label}`, shows(async page => { await patient(page); if (!viewport) await orderWalk(page, 'Populated · owner · patient record'); }, /Synthetic CHC/)],
    [`Populated · owner · visit review and sign-off · ${label}`, shows(async page => { await patient(page); await page.getByRole('tab', { name: /Review/ }).first().click().catch(() => {}); }, /sign-off|sign off/i)],
    [`Populated · owner · operations · ${label}`, shows(async page => { await go('Operations')(page); if (!viewport) await orderWalk(page, 'Populated · owner · operations'); }, /Critical incidents not resolved/)],
    [`Populated · owner · care handover and worker activity · ${label}`, shows(async page => { if (viewport) await go('Care handover')(page); await expandActivity(page); }, /Recorded against the wrong person/)],
    [`Populated · owner · outreach · ${label}`, shows(async page => { await go('Outreach')(page); await page.waitForTimeout(600); }, /Synthetic accessibility outreach/)],
    [`Populated · owner · programmes · ${label}`, shows(go('Programmes'), /TB/)],
    [`Populated · owner · organisation and pack installation · ${label}`, async page => { if (viewport) await go('Organisation & team')(page); await showPacks(page); if (!viewport) { const s = page.locator('section:has(#pack-installation-heading)'); await s.getByRole('button', { name: 'Insert synthetic example' }).click(); await s.getByLabel('Reason for staging').fill('Stage the synthetic example for the accessibility audit'); await s.getByRole('button', { name: 'Validate and stage' }).click(); await page.waitForTimeout(1200); await orderWalk(page, 'Populated · owner · organisation'); } }],
    [`Populated · owner · roster preview · ${label}`, async page => { probes.push({ pattern: 'A11Y-1 (retention hold)', shown: /A11Y-1/.test(await page.evaluate(() => document.body.innerText)) }); probes.push({ pattern: 'Staged · awaiting independent review', shown: /Staged · awaiting independent review/.test(await page.evaluate(() => document.body.innerText)) }); const t = page.getByLabel(/^Roster/).first(); await t.scrollIntoViewIfNeeded(); await t.fill(`${pa.user.accountCode},Populated Asha,asha,Care team,active`); await page.getByRole('button', { name: 'Preview changes' }).click(); await page.waitForTimeout(800); }],
    [`Populated · owner · alert notifications · ${label}`, shows(openBell, /Critical incidents not resolved/)],
  ], viewport);
  await session(pAsha, [
    [`Populated · ASHA · home · ${label}`, async () => {}],
    [`Populated · ASHA · my work · ${label}`, shows(async page => { await go('My work')(page); await page.waitForTimeout(600); }, /Meena Devi/)],
    [`Populated · ASHA · patient record · ${label}`, async page => { await page.keyboard.press('Escape').catch(() => {}); await go('People')(page); await page.getByRole('button', { name: /Meena Devi/ }).first().click(); }],
  ], viewport);
}
// Error states. A refused command (409) and unavailable reads (503) are injected in the browser with page.route; the
// Worker itself is not changed. The workspace-level failure replaces the whole first load.
const refusal = 'Synthetic refusal for the accessibility audit: this record changed, reload and try again.';
await session(pOwner, [
  ['Error · refused command (409) · desktop', async page => { await page.route('**/api/commands', r => r.request().method() === 'POST' ? r.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: refusal }) }) : r.continue()); await showPacks(page); const s = page.locator('section:has(#pack-installation-heading)'); await s.getByRole('button', { name: 'Insert synthetic example' }).click(); await s.getByLabel('Reason for staging').fill('Stage the synthetic example for the refusal check'); await s.getByRole('button', { name: 'Validate and stage' }).click(); await page.waitForTimeout(900); await liveCheck(page, 'Error · refused command (409)', /Synthetic refusal for the accessibility audit/); }],
  ['Error · reads unavailable (503) · patient record', async page => { await page.route(u => /\/api\//.test(u.pathname) && !/\/api\/(workspace|commands|patients)/.test(u.pathname), r => r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Synthetic service unavailable for the accessibility audit.' }) })); await openPatient(page); await page.waitForTimeout(1200); await liveCheck(page, 'Error · reads unavailable (503) · patient record', /Synthetic service unavailable|could not be loaded|could not load|unavailable/, false); }],
  ['Error · reads unavailable (503) · operations', async page => { await nav('Operations')(page); await page.waitForTimeout(1200); await liveCheck(page, 'Error · reads unavailable (503) · operations', /Synthetic service unavailable|could not be loaded|could not load|unavailable/, false); }],
  ['Error · reads unavailable (503) · organisation', async page => { await toOrg(page); await page.waitForTimeout(1200); }],
]);
{
  const ctx = await browser.newContext({ extraHTTPHeaders: pOwner, viewport: { width: 1280, height: 900 } }); const page = await ctx.newPage();
  await page.route('**/api/workspace*', r => r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Synthetic service unavailable for the accessibility audit.' }) }));
  try { await page.goto(base + '/', { waitUntil: 'networkidle' }); await page.waitForTimeout(800); await audit(page, 'Error · workspace unavailable (503) · desktop'); await liveCheck(page, 'Error · workspace unavailable (503)', /Synthetic service unavailable|Workspace unavailable/); } catch (e) { results.push({ screen: 'Error · workspace unavailable (503) · desktop', error: String(e.message).split('\n')[0] }); }
  await page.setViewportSize(phone); await page.waitForTimeout(300); await audit(page, 'Error · workspace unavailable (503) · phone');
  await ctx.close();
}
// Dialogs and disclosures, opened from the keyboard.
{
  const ctx = await browser.newContext({ extraHTTPHeaders: pOwner, viewport: { width: 1280, height: 900 } }); const page = await ctx.newPage(); await page.goto(base + '/', { waitUntil: 'networkidle' });
  for (const name of ['Household & proxies', 'Identity & merges', 'Rights requests', 'ABHA & consent']) { await openPatient(page); await dialogCheck(page, `Patient · ${name}`, page.getByRole('button', { name }).first()); }
  await nav('Outreach')(page); await page.waitForTimeout(600); await dialogCheck(page, 'Outreach · Plan outreach', page.getByRole('button', { name: 'Plan outreach' }).first());
  await nav('People')(page); await dialogCheck(page, 'People · Add person', page.getByRole('button', { name: /Add person/ }).first());
  await dialogCheck(page, 'Top bar · alert notifications (disclosure)', page.locator('.alert-bell-button'), { modal: false, container: '#alert-inbox' });
  await ctx.close();
  const pctx = await browser.newContext({ extraHTTPHeaders: pOwner, viewport: phone }); const ppage = await pctx.newPage(); await ppage.goto(base + '/', { waitUntil: 'networkidle' });
  await dialogCheck(ppage, 'Phone · navigation sheet', ppage.getByRole('button', { name: 'Toggle Sidebar' }).first());
  await pctx.close();
  const actx = await browser.newContext({ extraHTTPHeaders: pAsha, viewport: { width: 1280, height: 900 } }); const apage = await actx.newPage(); await apage.goto(base + '/', { waitUntil: 'networkidle' });
  await nav('My work')(apage); await apage.waitForTimeout(500); await orderWalk(apage, 'Populated · ASHA · my work');
  await actx.close();
}
await browser.close();
const byRule = {};
for (const r of results) for (const v of r.violations ?? []) { byRule[v.id] ??= { impact: v.impact, help: v.help, screens: 0, nodes: 0 }; byRule[v.id].screens++; byRule[v.id].nodes += v.nodes; }
const report = { tool: `axe-core ${axeVersion}`, tags: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'], screens: results.length, screensWithErrors: results.filter(r => r.error).length, violationsByRule: byRule, totalViolationNodes: Object.values(byRule).reduce((n, r) => n + r.nodes, 0), results, keyboard, setup, populatedProbes: probes, dialogs, tabOrder, liveRegions, keyboardChecksFailed: dialogs.filter(d => !d.passed).length + tabOrder.filter(t => !t.passed).length + liveRegions.filter(l => !l.passed).length, limits: 'Automated rules find a subset of WCAG failures. The keyboard walk checks reachability and a visible focus style; the 6x checks test dialog focus traps, Escape, focus return, document-order tab sequence and live regions for status and error text, not whether the order or announcements make sense to a person. No screen-reader, zoom or representative-user review was done.', completedAt: new Date().toISOString() };
writeFileSync(process.env.SAHA_A11Y_OUT ?? 'tests/a11y-audit-result.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ setup: setup.filter(x => !x.endsWith(':200')), probesNotShown: probes.filter(p => !p.shown).map(p => p.pattern), dialogs: dialogs.map(d => `${d.passed ? 'PASS' : 'FAIL'} ${d.name} ${d.error ?? ''} inside=${d.focusMovedInside} trap=${d.trapsFocus} esc=${d.closedOnEscape} return=${d.focusReturned} name=${d.dialogName}`), tabOrder: tabOrder.map(t => `${t.passed ? 'PASS' : 'FAIL'} ${t.screen}: ${t.stops} stops, positive ${t.positiveTabindex.length}, out of order ${t.outOfDocumentOrder.length}, backward ${t.backwardInSameColumnForReview.length}`), live: liveRegions.map(l => `${l.passed ? 'PASS' : 'FAIL'} ${l.screen}: ${l.announced}/${l.found}`), keyboard: keyboard.map(k => `${k.screen}: ${k.stops} stops, ${k.withoutVisibleFocus.length} without visible focus ${k.withoutVisibleFocus.slice(0, 6).join(', ')}`), screens: report.screens, errors: report.screensWithErrors, totalViolationNodes: report.totalViolationNodes, rules: Object.fromEntries(Object.entries(byRule).map(([k, v]) => [k, `${v.impact}:${v.nodes}@${v.screens}`])) }, null, 1));
