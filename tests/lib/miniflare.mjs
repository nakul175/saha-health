// Slice 11d: run the built Worker directly in Miniflare, with no inspector attached and an optional outbound service.
// Why: `wrangler dev` keeps request data for its inspector (about 270 KB per workspace load, slice 10k), so memory is measured here;
// and an outbound service lets a suite stand in for the Cloudflare Access key endpoint, so a properly signed token can be tested end to end.
// Same built bundle (dist/server), same migrations and the same local D1 layout as tests/lib/worker.mjs. Synthetic data only.
import { createRequire } from 'node:module';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { freshDatabase } from './worker.mjs';

const walk = d => readdirSync(d).flatMap(n => { const f = join(d, n); return statSync(f).isDirectory() ? walk(f) : [f]; });

function loadMiniflare() {
  const store = resolve('node_modules/.pnpm');
  const dir = readdirSync(store).filter(d => d.startsWith('miniflare@')).sort().at(-1);
  if (!dir) throw new Error('Miniflare is not installed (expected node_modules/.pnpm/miniflare@*). Run npm run install:ci.');
  return createRequire(join(store, dir, 'node_modules/miniflare/package.json'))('miniflare').Miniflare;
}

/** Descendant process ids of this process (Miniflare starts workerd as a child). */
export function descendants(root = process.pid) {
  const parent = new Map();
  for (const p of readdirSync('/proc').filter(x => /^\d+$/.test(x))) {
    try { const stat = readFileSync(`/proc/${p}/stat`, 'utf8'); parent.set(+p, +stat.slice(stat.lastIndexOf(')') + 2).split(' ')[1]); } catch { /* process ended */ }
  }
  const out = []; const walkTree = pid => { for (const [child, ppid] of parent) if (ppid === pid) { out.push(child); walkTree(child); } };
  walkTree(root); return out;
}
const comm = pid => { try { return readFileSync(`/proc/${pid}/cmdline`, 'utf8').replace(/\0/g, ' '); } catch { return ''; } };
export const rssKb = pid => { try { return +/VmRSS:\s+(\d+)/.exec(readFileSync(`/proc/${pid}/status`, 'utf8'))[1]; } catch { return 0; } };
/** Resident memory split of one process in KB: anon (heap and native allocations), file (mapped files such as the binary and the SQLite database) and shmem. */
export const memKb = pid => {
  try { const t = readFileSync(`/proc/${pid}/status`, 'utf8'), g = k => +(new RegExp(`${k}:\\s+(\\d+)`).exec(t)?.[1] ?? 0); return { rss: g('VmRSS'), anon: g('RssAnon'), file: g('RssFile'), shmem: g('RssShmem') }; }
  catch { return { rss: 0, anon: 0, file: 0, shmem: 0 }; }
};

/**
 * Start the built Worker in Miniflare. Options: port, name, state (D1 directory), fresh (default true), bindings (Worker variables),
 * outboundService (function (Request) => Response for the Worker's own fetches). Returns { base, stop, workerdPids, workerdRssKb, mf }.
 */
export async function startMiniflare({ port = 8834, name = 'nfr-mf', state, fresh = true, bindings = {}, outboundService } = {}) {
  const config = 'dist/server/wrangler.json';
  if (!existsSync(config)) throw new Error('Build first: npm run build');
  state = resolve(state ?? `.wrangler/${name}-state`);
  if (fresh) freshDatabase(state);
  const wr = JSON.parse(readFileSync(config, 'utf8'));
  const Miniflare = loadMiniflare();
  const index = 'dist/server/index.js';
  const mf = new Miniflare({
    modules: walk('dist/server').filter(f => /\.m?js$/.test(f)).sort((a, b) => (a === index ? -1 : b === index ? 1 : a.localeCompare(b))).map(path => ({ type: 'ESModule', path })), modulesRoot: 'dist/server',
    compatibilityDate: wr.compatibility_date, compatibilityFlags: wr.compatibility_flags ?? [],
    d1Databases: { DB: wr.d1_databases[0].database_id }, d1Persist: join(state, 'v3/d1'),
    host: '127.0.0.1', port: +port, bindings,
    // The Worker must run ahead of the static assets (wrangler does this for `run_worker_first`), or every /api/* request is answered 404 by the assets router.
    assets: { directory: 'dist/client', binding: 'ASSETS', routerConfig: { has_user_worker: true, invoke_user_worker_ahead_of_assets: true } },
    ...(outboundService ? { outboundService } : {}),
  });
  await mf.ready;
  const workerdPids = () => descendants().filter(p => /workerd/.test(comm(p)));
  return {
    base: `http://127.0.0.1:${port}`, mf,
    workerdPids,
    /** Resident memory of this instance's workerd processes in KB (sum), found by parent process, never by name. */
    workerdRssKb: () => workerdPids().reduce((a, p) => a + rssKb(p), 0),
    /** The same, split into anon, file and shmem (sums over this instance's workerd processes). */
    workerdMemKb: () => workerdPids().reduce((a, p) => { const x = memKb(p); return { rss: a.rss + x.rss, anon: a.anon + x.anon, file: a.file + x.file, shmem: a.shmem + x.shmem }; }, { rss: 0, anon: 0, file: 0, shmem: 0 }),
    /** Bytes on disk under this instance's local D1 directory (the SQLite database and its journal). */
    stateBytes: () => { try { return walk(join(state, 'v3/d1')).reduce((a, f) => a + statSync(f).size, 0); } catch { return 0; } },
    stop: async () => { await mf.dispose(); },
  };
}

/** A one-file Worker run in Miniflare, for probing the runtime itself (no application code). Options: port, script (ES module source), outboundService. */
export async function startInline({ port = 8833, script, outboundService } = {}) {
  const config = 'dist/server/wrangler.json', wr = existsSync(config) ? JSON.parse(readFileSync(config, 'utf8')) : {};
  const Miniflare = loadMiniflare();
  const mf = new Miniflare({ modules: true, script, host: '127.0.0.1', port: +port, compatibilityDate: wr.compatibility_date ?? '2026-05-01', compatibilityFlags: wr.compatibility_flags ?? [], ...(outboundService ? { outboundService } : {}) });
  await mf.ready;
  return { base: `http://127.0.0.1:${port}`, stop: async () => { await mf.dispose(); } };
}
