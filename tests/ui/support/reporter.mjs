// Slice 11c: a small Playwright reporter that writes tests/reports/ui-result.json in the shape of tests/lib/report.mjs
// (suite, layer, passed, failed, skipped, startedAt, completedAt, environment, limits, measures, checks) and adds what the UI layer knows:
// flaky tests, the accessibility scans with every violation found, and the browser messages that an allow-list let through.
// A test counts as passed when its final outcome is expected or flaky; a flaky test is listed so nobody mistakes it for a clean pass.
import { mkdirSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';

const strip = s => String(s ?? '').replace(/\u001b\[[0-9;]*m/g, '');
const json = (result, name) => { const a = result.attachments.find(x => x.name === name && x.body); try { return a ? JSON.parse(a.body.toString()) : null; } catch { return null; } };
const countPng = dir => { let n = 0; if (!existsSync(dir)) return 0; for (const e of readdirSync(dir, { withFileTypes: true })) n += e.isDirectory() ? countPng(join(dir, e.name)) : /\.png$/.test(e.name) ? 1 : 0; return n; };

export default class SahaReporter {
  constructor(options = {}) { this.file = resolve(options.file ?? 'tests/reports/ui-result.json'); }
  onBegin(config, suite) { this.config = config; this.root = suite; this.startedAt = new Date().toISOString(); this.t0 = Date.now(); }
  onEnd(runResult) {
    const checks = [], a11y = [], allowed = [], flaky = [];
    for (const test of this.root.allTests()) {
      const project = test.parent.project()?.name ?? '';
      const label = `${project} · ${test.titlePath().slice(2).join(' › ')}`;
      const last = test.results.at(-1);
      const outcome = test.outcome();            // expected | unexpected | flaky | skipped
      const ms = Math.round(last?.duration ?? 0);
      if (outcome === 'skipped') { checks.push({ label, ok: null, skipped: test.annotations.find(a => a.type === 'skip')?.description ?? 'skipped' }); continue; }
      if (outcome === 'unexpected') checks.push({ label, ok: false, ms, retries: test.results.length - 1, error: strip(last?.errors?.map(e => e.message).join('\n---\n')).slice(0, 2000) });
      else { checks.push({ label, ok: true, ms, ...(outcome === 'flaky' ? { flaky: true, attempts: test.results.length } : {}) }); if (outcome === 'flaky') flaky.push(label); }
      // Harness self-checks (test.fail) scan deliberately bad pages; their findings are not findings about the application.
      const own = test.expectedStatus !== 'failed';
      const scans = last && own ? json(last, 'a11y.json') : null, problems = last && own ? json(last, 'browser-problems.json') : null;
      for (const s of scans ?? []) a11y.push({ test: label, ...s });
      for (const p of problems?.allowed ?? []) allowed.push({ test: label, ...p });
    }
    const passed = checks.filter(c => c.ok === true).length, failed = checks.filter(c => c.ok === false).length, skipped = checks.filter(c => c.ok === null).length;
    const violations = a11y.flatMap(s => s.violations.map(v => ({ test: s.test, ...v })));
    const out = {
      suite: 'UI journeys, screenshot regression and accessibility (Playwright, Chromium)', layer: 'ui', passed, failed, skipped,
      startedAt: this.startedAt, completedAt: new Date().toISOString(), durationMs: Date.now() - this.t0,
      environment: 'local built Worker, local D1, synthetic data, headless Chromium (Playwright 1.56.1), axe-core 4.13.0',
      limits: [
        'Desktop 1280x720 and phone 390x844 viewports in Chromium only; no Firefox or WebKit, no real phone, no screen reader.',
        'Screenshot baselines were rendered on one machine; fonts on another host (for example GitHub ubuntu runners) can differ. Regenerate with --update-snapshots.',
        'Axe finds a subset of accessibility failures; the Hindi text is a draft translation and no Devanagari font is installed on the machine that made the baselines, so no Hindi screenshot is compared.',
      ],
      measures: [], checks,
      flaky, projects: this.config.projects.map(p => p.name), workers: this.config.workers, retries: this.config.projects[0]?.retries ?? 0,
      screenshotBaselines: countPng(resolve('tests/ui/baselines')),
      accessibility: { screensScanned: a11y.length, violationsFound: violations.length, blocking: violations.filter(v => ['serious', 'critical'].includes(v.impact)).length, violations },
      browserMessagesAllowed: allowed,
      playwrightStatus: runResult.status,
    };
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(this.file, JSON.stringify(out, null, 2) + '\n');
    console.log(`\nUI report: ${this.file} (${passed} passed, ${failed} failed, ${skipped} skipped, ${flaky.length} flaky; ${a11y.length} screens scanned, ${violations.length} axe violations)`);
  }
  printsToStdio() { return false; }
}
