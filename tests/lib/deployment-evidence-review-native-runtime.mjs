// Routine-retention test-only native fixture. The generated application bundle, original migrations
// and real D1 are used unchanged. No development watcher, fake endpoint or policy mirror.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, statSync, realpathSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { deadline, runOwnedCommand, sha256, inspectOwnedGroup } from './routine-retention/containment.mjs';

const walk = dir => readdirSync(dir).flatMap(name => { const file = join(dir, name); return statSync(file).isDirectory() ? walk(file) : [file]; });
const json = (file, data) => writeFileSync(file, JSON.stringify(data, null, 2) + '\n');

/** This synchronous factory returns the cleanup handle before migration or readiness.
 * Migration children and workerd inherit the outer CLI's registered detached group.
 * The CLI enforces an additional whole-attempt deadline and proves group disposal. */
export function ownedDeploymentEvidenceRuntime({ state, port, evidence, bindings = {}, outboundService, assetsFirst = false }) {
  state = resolve(state); evidence = resolve(evidence);
  assert.equal(existsSync(state), false, 'Native D1 state must be initially absent; never delete or reuse a database.');
  assert.ok(existsSync(evidence), 'The driver must retain an owned evidence directory before startup.');
  assert.ok(Number.isInteger(port) && port > 1024 && port < 65536);
  const lifecycle = { state, port, base: `http://127.0.0.1:${port}`, ownerPid: process.pid, ready: false, disposed: false, migration: null, migrationFiles: null, migrationSourcePins: null, migrationHandle: null, phases: [], errors: [] };
  let mf = null, started = false, stdout = '', stderr = '', structured = '';
  const save = () => json(join(evidence, 'native-lifecycle.json'), lifecycle);
  const phase = name => { lifecycle.phases.push({ name, at: new Date().toISOString() }); save(); };
  save(); // Handles/log destination exist even if construction or readiness fails.
  return {
    base: lifecycle.base, lifecycle,
    get mf() { assert.ok(lifecycle.ready && !lifecycle.disposed, 'Native D1 handle requires the live ready owned runtime.'); return mf; },
    output: () => `[stdout]\n${stdout}\n[stderr]\n${stderr}\n[structured]\n${structured}`,
    async start() {
      assert.equal(started, false, 'A fixture can be started only once.'); started = true;
      assert.equal(existsSync(state), false, 'State appeared after preparation; do not mutate it.');
      phase('checking allocated loopback port');
      await deadline('loopback port ownership probe', () => new Promise((resolve, reject) => {
        const probe = createServer(); probe.once('error', reject);
        probe.listen(port, '127.0.0.1', () => probe.close(error => error ? reject(error) : resolve()));
      }), 2000);
      const config = 'dist/server/wrangler.json';
      assert.ok(existsSync(config), 'Use the CLI fresh canonical build.');
      const files = readdirSync('drizzle').filter(file => /^\d{4}_.*\.sql$/.test(file)).sort();
      assert.ok(files.length >= 16, 'Do not omit any existing migration.');
      lifecycle.migrationFiles = files.length;
      lifecycle.migrationSourcePins = Object.fromEntries(files.map(file => [join('drizzle', file), sha256(readFileSync(join('drizzle', file)))]));
      const sql = files.map(file => readFileSync(join('drizzle', file), 'utf8')).join('\n;\n');
      const sqlFile = join(evidence, 'original-migrations.sql'); writeFileSync(sqlFile, sql, { flag: 'wx' });
      lifecycle.migrationConcatenationSha256 = sha256(sql);
      mkdirSync(state, { recursive: true }); // Only an initially absent, owned path.
      phase('applying original migrations in one bounded native D1 command');
      lifecycle.migration = await runOwnedCommand(process.execPath, ['--import', './scripts/sites-env.mjs', './node_modules/wrangler/bin/wrangler.js', 'd1', 'execute', 'DB', '--local', '--config', config, '--persist-to', state, '--file', sqlFile], {
        stdout: join(evidence, 'migration.stdout.log'), stderr: join(evidence, 'migration.stderr.log'), timeoutMs: 60000, graceMs: 3000, detached: false,
        env: { ...process.env, WRANGLER_SEND_METRICS: 'false', WRANGLER_LOG_PATH: join(evidence, 'wrangler-native.log'), WRANGLER_REGISTRY_PATH: join(evidence, 'wrangler-registry'), MINIFLARE_REGISTRY_PATH: join(evidence, 'miniflare-registry') },
        onSpawn: handle => { lifecycle.migrationHandle = handle; phase('native migration handle recorded before waiting'); },
      });
      save(); assert.equal(lifecycle.migration.ok, true, 'Actual migration exit/timeout/log errors fail setup.');
      // The outer CLI starts this driver as a registered detached group leader. A
      // successful Wrangler parent exit alone cannot prove its workerd child exited.
      lifecycle.migrationGroupObservation = inspectOwnedGroup(process.pid);
      const ownRows = lifecycle.migrationGroupObservation.rows.filter(row => !row.state.startsWith('Z'));
      lifecycle.migrationDriverGroupMatched = ownRows.some(row => row.pid === process.pid && row.pgid === process.pid);
      lifecycle.migrationDescendantsAfterExit = ownRows.filter(row => row.pid !== process.pid);
      save(); assert.equal(lifecycle.migrationDriverGroupMatched, true, 'Native driver must be the actual registered group leader.');
      assert.deepEqual(lifecycle.migrationDescendantsAfterExit, [], 'Do not overlap a surviving native migration child with the application runtime.');
      const wr = JSON.parse(readFileSync(config, 'utf8'));
      assert.ok(wr.compatibility_date && wr.d1_databases?.[0]?.database_id, 'Generated native runtime bindings are required.');
      const Miniflare = createRequire(realpathSync('node_modules/wrangler/package.json'))('miniflare').Miniflare;
      const index = 'dist/server/index.js';
      phase('constructing one owned Miniflare application runtime');
      mf = new Miniflare({
        modules: walk('dist/server').filter(file => /\.m?js$/.test(file)).sort((a, b) => a === index ? -1 : b === index ? 1 : a.localeCompare(b)).map(path => ({ type: 'ESModule', path })), modulesRoot: 'dist/server',
        compatibilityDate: wr.compatibility_date, compatibilityFlags: wr.compatibility_flags ?? [],
        d1Databases: { DB: wr.d1_databases[0].database_id }, d1Persist: join(state, 'v3/d1'), host: '127.0.0.1', port, bindings,
        ...(outboundService ? { outboundService } : {}),
        assets: { directory: 'dist/client', binding: 'ASSETS', routerConfig: { has_user_worker: true, invoke_user_worker_ahead_of_assets: !assetsFirst } },
        handleRuntimeStdio: (out, err) => { out.on('data', chunk => { stdout += chunk.toString(); }); err.on('data', chunk => { stderr += chunk.toString(); }); },
        handleStructuredLogs: event => { structured += `[console:${event.level}] ${event.message}\n`; },
      });
      phase('Miniflare cleanup handle exists before readiness');
      await deadline('native Worker readiness', () => mf.ready, 30000);
      lifecycle.ready = true; phase('native Worker ready');
    },
    async stop() {
      // A failed journal write must never prevent disposing the already owned runtime.
      lifecycle.phases.push({ name: 'attempting bounded native disposal', at: new Date().toISOString() });
      try {
        if (mf) await deadline('native Worker disposal', () => mf.dispose(), 10000);
        lifecycle.disposed = true; lifecycle.phases.push({ name: 'native disposal completed', at: new Date().toISOString() });
      } catch (error) { lifecycle.errors.push({ phase: 'native disposal', name: error.name, message: String(error.message) }); throw error; }
      finally {
        const errors = [];
        try { writeFileSync(join(evidence, 'worker.log'), `[stdout]\n${stdout}\n[stderr]\n${stderr}\n[structured]\n${structured}`); } catch (error) { errors.push(error); }
        try { save(); } catch (error) { errors.push(error); }
        if (errors.length) throw new AggregateError(errors, 'Native disposal evidence could not be retained; disposal itself was attempted first.');
      }
      // Retain owned fresh state and every attempt's logs for inspection. The outer CLI
      // separately checks/cleans only its registered process group before claiming success.
    },
  };
}
