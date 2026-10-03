// Slice 11a: shared local Worker harness for the smoke, UI and non-functional suites.
// Starts the built Worker (dist/) under `wrangler dev` on a chosen port with its own local D1 state, applies every
// migration to a fresh state, and returns helpers for synthetic identities, reads and commands. Synthetic data only:
// the identity headers below model the trusted dispatcher in an isolated local process and must never be sent to a hosted Site.
import { spawn } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { connect } from 'node:net';
import { migrateOnce } from './migrate.mjs';

const WRANGLER = ['--import', './scripts/sites-env.mjs', './node_modules/wrangler/bin/wrangler.js'];
const portFree = port => new Promise(r => { const c = connect(+port, '127.0.0.1'); c.once('connect', () => { c.destroy(); r(false); }); c.once('error', () => r(true)); });

/** Recreate a local D1 directory and apply every migration in drizzle/ (slice 11f: one wrangler call through
 * tests/lib/migrate.mjs; one process per file failed 4 of 6 trials on a loaded machine, see that file). */
export function freshDatabase(state, config = 'dist/server/wrangler.json') {
  migrateOnce(state, config);
}

/**
 * Start the built Worker. Options: port (default SAHA_TEST_PORT or 8790), state (D1 directory; default .wrangler/<name>-state),
 * fresh (default true: recreate and migrate the state), vars (extra Worker variables), name (registry name).
 * Returns { base, stop, restart, output }.
 */
export async function startWorker({ port = process.env.SAHA_TEST_PORT ?? '8790', name = 'saha-suite', state, fresh = true, vars = {} } = {}) {
  if (!existsSync('dist/server/wrangler.json')) throw new Error('Build first: npm run build');
  state = resolve(state ?? `.wrangler/${name}-state`);
  if (fresh) freshDatabase(state);
  const isolated = mkdtempSync(join(tmpdir(), `${name}-`)); cpSync('dist', join(isolated, 'dist'), { recursive: true });
  let output = '', proc = null;
  const launch = () => new Promise(async (ready, failed) => {
    for (let i = 0; i < 40 && !(await portFree(port)); i++) await new Promise(r => setTimeout(r, 250));
    if (!(await portFree(port))) return failed(new Error(`Port ${port} is still in use; another Worker (or an orphaned one) is listening there.`));
    const varArgs = Object.entries(vars).flatMap(([k, v]) => ['--var', `${k}:${v}`]);
    const p = spawn(process.execPath, [...WRANGLER, 'dev', '--config', join(isolated, 'dist/server/wrangler.json'), '--local', '--persist-to', state, '--name', name, ...varArgs, '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', '0'],
      { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, WRANGLER_REGISTRY_PATH: join(isolated, 'registry'), MINIFLARE_REGISTRY_PATH: join(isolated, 'miniflare') } });
    const from = output.length; let done = false;
    const timer = setTimeout(() => { if (!done) { done = true; p.kill('SIGTERM'); failed(new Error('Worker did not start:\n' + output.slice(-2000))); } }, 60000);
    const take = c => { output += c.toString(); if (!done && output.indexOf('Ready on', from) >= 0) { done = true; clearTimeout(timer); ready(p); } };
    p.stdout.on('data', take); p.stderr.on('data', take);
    p.on('exit', () => { clearTimeout(timer); if (!done) { done = true; failed(new Error('Worker exited before it was ready:\n' + output.slice(-2000))); } });
  });
  // Slice 11g (test review L4): SIGTERM, then SIGKILL after 10 s, so a stuck Worker is not left running.
  const halt = p => new Promise(r => { if (!p || p.exitCode !== null || p.signalCode) return r(); const k = setTimeout(() => { try { p.kill('SIGKILL'); } catch {} }, 10000); p.once('exit', () => { clearTimeout(k); r(); }); p.kill('SIGTERM'); });
  proc = await launch();
  return {
    base: `http://127.0.0.1:${port}`,
    output: () => output,
    // The local development runtime keeps request data for its inspector, so long suites restart it on the same state (slice 10k).
    restart: async () => { await halt(proc); proc = await launch(); },
    stop: async () => { await halt(proc); rmSync(isolated, { recursive: true, force: true }); },
  };
}

/** A synthetic identity in the Sites dispatcher header model (local only). */
export function identity(label, run = crypto.randomUUID().slice(0, 8), name) {
  const id = `t-${run}-${label}`;
  return { id, label, headers: { 'oai-authenticated-user-id': id, 'oai-authenticated-user-email': `${label}-${run}@example.invalid`, ...(name ? { 'oai-authenticated-user-full-name': encodeURIComponent(name), 'oai-authenticated-user-full-name-encoding': 'percent-encoded-utf-8' } : {}) } };
}

/** Request helpers bound to one Worker. `who` is an identity (or null for anonymous); `org` sets x-saha-organisation. */
export function client(base) {
  const call = async (who, path, { method = 'GET', body, org, headers = {} } = {}) => {
    const h = { ...(who?.headers ?? {}), ...(org ? { 'x-saha-organisation': org } : {}), ...headers };
    if (body !== undefined) { h['Content-Type'] = 'application/json'; h['Idempotency-Key'] ??= crypto.randomUUID(); }
    const started = performance.now();
    const r = await fetch(base + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
    const ms = performance.now() - started, text = await r.text();
    let json = null; try { json = JSON.parse(text); } catch {}
    return { status: r.status, json, text, ms, headers: r.headers };
  };
  return {
    call,
    get: (who, path, org) => call(who, path, { org }),
    command: (who, body, org) => call(who, '/api/commands', { method: 'POST', body, org }),
  };
}
