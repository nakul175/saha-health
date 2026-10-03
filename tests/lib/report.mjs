// Slice 11a: one result format for the smoke, UI, non-functional and regression suites.
// Results are written to tests/reports/<file>.json (not tracked); evidence for a slice is copied to tests/evidence/<slice>/.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * const r = suite('Smoke (local)', 'tests/reports/smoke-local-result.json', { layer: 'smoke', limits: ['...'] });
 * await r.check('workspace loads', async () => { ... });  // throws → failed
 * r.skip('hosted sign-in', 'no service token configured');
 * r.measure('p95 ms /api/workspace', 412, { budget: 1500 });  // recorded, and failed when over budget
 * await r.finish();  // writes the report and sets process.exitCode on failure
 */
export function suite(name, file, { layer, limits = [], environment = 'local built Worker, local D1, synthetic data' } = {}) {
  const checks = [], measures = [], started = new Date().toISOString();
  const api = {
    async check(label, fn) {
      const t = performance.now();
      try { await fn(); checks.push({ label, ok: true, ms: Math.round(performance.now() - t) }); }
      catch (e) { checks.push({ label, ok: false, ms: Math.round(performance.now() - t), error: String(e?.message ?? e).slice(0, 2000) }); console.error(`FAIL ${label}: ${String(e?.message ?? e).split('\n')[0]}`); }
    },
    skip(label, reason) { checks.push({ label, ok: null, skipped: reason }); },
    measure(label, value, { unit = 'ms', budget } = {}) {
      const ok = budget === undefined || value <= budget;
      measures.push({ label, value, unit, budget: budget ?? null, ok });
      checks.push({ label: `${label} within budget`, ok: budget === undefined ? true : ok, ...(ok ? {} : { error: `${value} ${unit} over budget ${budget} ${unit}` }) });
    },
    get failed() { return checks.filter(c => c.ok === false).length; },
    async finish(extra = {}) {
      const passed = checks.filter(c => c.ok === true).length, failed = checks.filter(c => c.ok === false).length, skipped = checks.filter(c => c.ok === null).length;
      const out = { suite: name, layer, passed, failed, skipped, startedAt: started, completedAt: new Date().toISOString(), environment, limits, measures, checks, ...extra };
      mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, JSON.stringify(out, null, 2) + '\n');
      console.log(JSON.stringify({ suite: name, passed, failed, skipped, completedAt: out.completedAt }));
      if (failed) process.exitCode = 1;
      return out;
    },
  };
  return api;
}
