// Slice 11c: shared fixtures for the browser UI specs.
//  - lab.who(label, name)      a fresh synthetic identity (random run id per test, so tests never share accounts)
//  - lab.open(who, options)    a browser context for that identity (local dispatcher header model) with page errors,
//                              console errors and HTTP 5xx collected; the test fails at the end if any are left after the allow-list
//  - lab.api                   the HTTP helpers from tests/lib/worker.mjs, used for set-up and to cross-check what the page shows
//  - lab.scan(page, screen)    axe-core (WCAG 2.0 to 2.2 A and AA); serious and critical violations fail the test, all are recorded
//  - lab.shot(page, name, ...) screenshot comparison with dynamic regions masked
// Synthetic data only. The identity headers model the trusted dispatcher of an isolated local Worker; never send them to a hosted Site.
import { test as base, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { fileURLToPath } from 'node:url';
import { identity, client } from '../../lib/worker.mjs';

// Messages that are known and harmless in every journey. Each needs a reason. Nothing is listed yet: no journey produced one.
// A journey that deliberately provokes a refusal allows its own message with lab.allow() and says why.
export const ALLOWED = [];

export const RECEIPT_ROW_STYLE = fileURLToPath(new URL('./receipt-row.css', import.meta.url));
export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const BLOCKING = new Set(['serious', 'critical']);

// Dynamic text that must not decide a screenshot: dates and times, receipt numbers, account and invitation codes.
export const DYNAMIC_TEXT = [
  /\b20\d\d-\d\d-\d\d/,                                  // 2026-10-03 (effective and review dates, evidence times)
  /\b\d{1,2} [A-Z][a-z]{2} 20\d\d/,                      // 3 Oct 2026, 8:00 am
  /\b\d{1,2}\/\d{1,2}\/20\d\d/,                          // 10/3/2026, 8:03:28 AM
  /\b(SIM|AGG|MIS|EHR)-[0-9A-F]{6,}/,                    // receipt numbers
  /\b[0-9A-F]{24}\b/,                                    // account codes
];

class Lab {
  constructor(browser, baseURL, contextOptions, testInfo) {
    this.browser = browser; this.baseURL = baseURL; this.contextOptions = contextOptions; this.testInfo = testInfo;
    this.run = crypto.randomUUID().slice(0, 8);
    this.api = client(baseURL);
    this.contexts = []; this.problems = []; this.allowed = [...ALLOWED]; this.a11y = []; this.scanned = 0;
  }
  /** A fresh synthetic identity. Pass a name for a sign-in that carries a full name; leave it out for an email-only sign-in. */
  who(label, name) { return identity(label, this.run, name); }
  /** Allow one expected console, page or HTTP message for this test only. `reason` is mandatory and appears in the report. */
  allow(match, reason) {
    if (!(match instanceof RegExp) || !reason) throw new Error('lab.allow needs a RegExp and a reason');
    this.allowed.push({ match, reason });
  }
  /** Open a page as `who` (a sign-in) with optional extra request headers, such as x-saha-organisation, and a viewport override. */
  async open(who, { headers = {}, viewport } = {}) {
    const context = await this.browser.newContext({ ...this.contextOptions, ...(viewport ? { viewport } : {}), extraHTTPHeaders: { ...(who?.headers ?? {}), ...headers } });
    this.contexts.push(context);
    const page = await context.newPage();
    const tag = who?.label ?? 'anonymous';
    page.on('pageerror', e => this.problems.push({ kind: 'pageerror', who: tag, text: String(e?.message ?? e).slice(0, 400) }));
    page.on('console', m => { if (m.type() === 'error') this.problems.push({ kind: 'console', who: tag, text: m.text().slice(0, 400), url: m.location().url }); });
    page.on('response', r => { if (r.status() >= 500) this.problems.push({ kind: 'http5xx', who: tag, text: `${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`, url: r.url() }); });
    return page;
  }
  /** GET /api/workspace as `who` in organisation `org`; the page's own data comes from the same route. */
  async workspace(who, org) { const r = await this.api.get(who, '/api/workspace', org); if (r.status !== 200) throw new Error(`workspace ${who.label}: ${r.status} ${r.text.slice(0, 200)}`); return r.json; }
  /** One command; throws unless it succeeds, so set-up never silently half works. */
  async command(who, body, org) { const r = await this.api.command(who, body, org); if (r.status !== 200) throw new Error(`${body.type} as ${who.label}: ${r.status} ${r.text.slice(0, 300)}`); return r.json; }

  /** Axe over the whole page as it is now. Serious and critical violations fail the test (soft, so every screen is still scanned). */
  async scan(page, screen) {
    await settle(page);
    const result = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    this.scanned++;
    const found = result.violations.map(v => ({ screen, id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, targets: v.nodes.slice(0, 3).map(n => n.target.join(' ')) }));
    this.a11y.push({ screen, passes: result.passes.length, violations: found });
    const blocking = found.filter(v => BLOCKING.has(v.impact));
    expect.soft(blocking.map(v => `${v.impact} ${v.id} x${v.nodes}: ${v.targets[0]}`), `Accessibility on "${screen}": serious or critical axe violations`).toEqual([]);
    return found;
  }
  /** Locators for text that changes from run to run, to hide in screenshots. */
  dynamic(page, root = page) { return DYNAMIC_TEXT.map(re => root.getByText(re)); }
  /** Screenshot comparison with the dynamic regions masked. `target` is a page or a locator. */
  async shot(page, name, { target = page, mask = [], fullPage = false, stylePath } = {}) {
    await settle(page);
    await expect(target).toHaveScreenshot(name, { mask: [...this.dynamic(target), ...mask], maskColor: '#9aa5ab', ...(stylePath ? { stylePath } : {}), ...(target === page ? { fullPage } : {}) });
  }

  async dispose() {
    for (const c of this.contexts) await c.close().catch(() => {});
    const unexpected = [], listed = [];
    for (const p of this.problems) {
      const hit = this.allowed.find(a => a.match.test(`${p.text} ${p.url ?? ''}`));
      (hit ? listed : unexpected).push(hit ? { ...p, allowedBecause: hit.reason } : p);
    }
    await this.testInfo.attach('browser-problems.json', { body: JSON.stringify({ unexpected, allowed: listed }, null, 2), contentType: 'application/json' });
    await this.testInfo.attach('a11y.json', { body: JSON.stringify(this.a11y, null, 2), contentType: 'application/json' });
    return unexpected;
  }
}

/** Wait until the page is quiet: network idle, fonts loaded, transitions finished, toasts gone. */
export async function settle(page) {
  // Slice 11f: bounded; under load the workspace's background requests can keep the network busy for longer than a test should wait.
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
  await page.waitForFunction(() => !document.querySelector('[data-sonner-toast]'), null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(250);
}

export const test = base.extend({
  lab: async ({ browser, baseURL, viewport, locale, timezoneId, colorScheme }, use, testInfo) => {
    const lab = new Lab(browser, baseURL, { viewport, locale, timezoneId, colorScheme }, testInfo);
    await use(lab);
    const unexpected = await lab.dispose();
    // A browser problem fails an otherwise passing test; if the test already failed its own error is the one to read.
    if (testInfo.errors.length === 0) expect(unexpected, 'uncaught page errors, console errors or HTTP 5xx during the journey').toEqual([]);
  },
});
export { expect };
