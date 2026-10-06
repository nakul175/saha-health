#!/usr/bin/env node
// Builds the two legacy-runtime fixtures the combined-reviewed alert adapters need, from the ORIGINAL older source commits.
// See docs/current/LEGACY-ALERT-FIXTURES.md. Local git objects and the local pnpm store only; no network, no commit, no push.
//
//   node scripts/build-legacy-alert-fixtures.mjs            (set SAHA_CHROMIUM to a working Chromium: the "before" driver opens a phone page)
//
// 1. alert-disclosure-before: tests/alert-disclosure-before.mjs run unchanged on 75c0f3e5 (the commit recorded in
//    tests/evidence/alert-disclosure-before/manifest.json). 29 assertions.
// 2. alert-export-cold: tests/alert-export-cold-http.mjs, phase "legacy" on 8eedc606 (17 assertions), then phase "current" on this
//    checkout's build against that history (the driver's own documented sequence) so the independent adapter gets the state it expects.
//
// Both old builds write only inside their own worktrees. The results are copied to git-ignored ".wrangler/...-combined-review" names and a
// digest manifest is written. Original states and evidence (tests/evidence/alert-disclosure-before, tests/evidence/alert-export-cold,
// .wrangler/alert-disclosure-before-state, .wrangler/alert-export-cold-state) are never read for writing, replaced or modified.
// The legacy database is upgraded with the migrations that exist here but not in the old source (forward upgrade only; no data rewritten).
import {execFileSync, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
process.removeAllListeners('warning'); process.on('warning', w => { if (w.name !== 'ExperimentalWarning') console.error(w); });
const BEFORE_SHA = '75c0f3e5372b9eb08eab0717966b4638163294bc', EXPORT_SHA = '8eedc606ef015bd2cf5a8bddb3ed9e50249b5a30';
const work = resolve(process.env.SAHA_LEGACY_WORK ?? join(root, '..', 'work'));
export const OWNED = {
  beforeState: '.wrangler/alert-disclosure-before-state-combined-review',
  beforeEvidence: '.wrangler/alert-disclosure-before-evidence-combined-review',
  exportState: '.wrangler/alert-export-cold-state-combined-review',
  exportEvidence: '.wrangler/alert-export-cold-evidence-combined-review',
};
const manifestPath = 'tests/evidence/alert-transition-guidance-root-integration/legacy-fixtures/manifest.json';
const sha = b => createHash('sha256').update(b).digest('hex');
const die = m => { console.error('build-legacy-alert-fixtures: ' + m); process.exit(1); };
const git = (...a) => execFileSync('git', a, {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim();
const node = process.execPath;
const WRANGLER = ['--import', './scripts/sites-env.mjs', './node_modules/wrangler/bin/wrangler.js'];

function sqliteFiles(state) {
  const dir = join(state, 'v3/d1/miniflare-D1DatabaseObject');
  if (!existsSync(dir)) die(`no D1 state under ${state}`);
  return readdirSync(dir).filter(f => f.endsWith('.sqlite') && f !== 'metadata.sqlite').sort().map(f => join(dir, f));
}
/** Fold the write-ahead log into the main file so that digests and copies see every committed page. */
function checkpoint(state) { for (const f of sqliteFiles(state)) { const d = new DatabaseSync(f); try { d.exec('PRAGMA wal_checkpoint(TRUNCATE)'); } finally { d.close(); } } }
const stateDigest = state => { checkpoint(state); return Object.fromEntries(sqliteFiles(state).map(f => [f.slice(state.length + 1), sha(readFileSync(f))])); };

function tree(sha1, dir) {
  try { git('cat-file', '-e', sha1 + '^{commit}'); } catch { die(`commit ${sha1} is not in the local object store; this script never fetches`); }
  if (!existsSync(dir)) { mkdirSync(dirname(dir), {recursive: true}); git('worktree', 'add', '--detach', dir, sha1); }
  else if (execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], {encoding: 'utf8'}).trim() !== sha1) die(`${dir} exists but is not at ${sha1}`);
  return dir;
}
function run(cmd, args, cwd, env = {}, log) {
  const r = spawnSync(cmd, args, {cwd, env: {...process.env, ...env}, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024});
  if (log) { mkdirSync(dirname(log), {recursive: true}); writeFileSync(log, (r.stdout ?? '') + (r.stderr ?? '')); }
  if (r.status !== 0) die(`${cmd} ${args.join(' ')} failed in ${cwd} (exit ${r.status}). ${log ? 'Log: ' + log : (r.stderr ?? '').slice(-1500)}`);
  return r.stdout;
}
function lastJson(out) {
  for (const l of out.trim().split('\n').reverse()) { if (l.startsWith('{') && /"passed"/.test(l)) return JSON.parse(l); }
  die('driver printed no final {"passed":N} line');
}
function install(dir) {
  run('pnpm', ['install', '--frozen-lockfile'], dir, {}, join(dir, '.fixture-logs/install.log'));
  run(node, ['scripts/run-framework.mjs', 'build'], dir, {}, join(dir, '.fixture-logs/build.log'));
}
function resetOutputs(dir, paths) { for (const p of paths) rmSync(join(dir, p), {recursive: true, force: true}); }
/** Forward upgrade: apply the migrations that exist in this checkout's drizzle/ but not in the old source, in order, to a state directory. */
function upgrade(state, legacyDir) {
  const have = new Set(readdirSync(join(legacyDir, 'drizzle')).filter(f => /^\d{4}_.*\.sql$/.test(f)));
  const missing = readdirSync('drizzle').filter(f => /^\d{4}_.*\.sql$/.test(f) && !have.has(f)).sort();
  if (missing.length) {
    const file = join(work, `forward-${sha(state).slice(0, 8)}.sql`);
    writeFileSync(file, missing.map(f => readFileSync(join('drizzle', f), 'utf8')).join('\n;\n'));
    try { run(node, [...WRANGLER, 'd1', 'execute', 'DB', '--local', '--config', 'dist/server/wrangler.json', '--persist-to', resolve(state), '--file', file], root); } finally { rmSync(file, {force: true}); }
  }
  checkpoint(state);
  return missing;
}
function copyOwned(src, dest) {
  if (!/-combined-review$/.test(dest)) die('refusing to write a name that is not owned: ' + dest);
  rmSync(dest, {recursive: true, force: true}); mkdirSync(dirname(dest), {recursive: true}); cpSync(src, dest, {recursive: true});
}

if (!existsSync('dist/server/wrangler.json')) die('this checkout is not built: run `node scripts/run-framework.mjs build` first (the current-phase export run needs it)');
if (!process.env.SAHA_CHROMIUM) die('SAHA_CHROMIUM must name a working Chromium executable (the original before driver opens a phone page)');
mkdirSync(work, {recursive: true});
const manifest = {
  purpose: 'Legacy-runtime history for the combined-reviewed alert adapters. State/evidence are instance-specific (random organisation ids); only this manifest is tracked. Rebuild with node scripts/build-legacy-alert-fixtures.mjs.',
  owned: OWNED, fixtures: {},
};

// 1. alert-disclosure-before on the original older source.
{
  const dir = tree(BEFORE_SHA, join(work, 'legacy-75c0'));
  install(dir);
  resetOutputs(dir, ['.wrangler/alert-disclosure-before-state', 'tests/evidence/alert-disclosure-before']);
  const driver = readFileSync('tests/alert-disclosure-before.mjs'), headDriver = execFileSync('git', ['show', 'HEAD:tests/alert-disclosure-before.mjs'], {maxBuffer: 64 << 20});
  if (sha(driver) !== sha(headDriver)) die('tests/alert-disclosure-before.mjs differs from HEAD; the original driver must be used byte for byte');
  copyFileSync('tests/alert-disclosure-before.mjs', join(dir, 'tests/alert-disclosure-before.mjs'));
  const out = run(node, ['tests/alert-disclosure-before.mjs'], dir, {}, join(dir, '.fixture-logs/alert-disclosure-before.log'));
  const res = lastJson(out);
  if (res.passed !== 29 || res.failed !== 0) die(`alert-disclosure-before reported ${JSON.stringify(res)}, expected 29 passed`);
  const legacyState = join(dir, '.wrangler/alert-disclosure-before-state'), pure = stateDigest(legacyState);
  const forward = upgrade(legacyState, dir);
  copyOwned(legacyState, OWNED.beforeState); copyOwned(join(dir, 'tests/evidence/alert-disclosure-before'), OWNED.beforeEvidence);
  manifest.fixtures.alertDisclosureBefore = {
    sourceCommit: BEFORE_SHA, driver: 'tests/alert-disclosure-before.mjs', driverSha256: sha(driver), assertions: res.passed, ports: [20720, 20721, 20722],
    originalActualBeforeNotReplaced: 'tests/evidence/alert-disclosure-before is untouched; this is a regeneration by the same driver on the same source',
    stateSha256BeforeForwardMigration: pure, forwardMigrations: forward, stateSha256: stateDigest(OWNED.beforeState),
    evidenceSha256: {'observed.json': sha(readFileSync(join(OWNED.beforeEvidence, 'observed.json')))},
  };
}

// 2. alert-export-cold: legacy phase on the original source, current phase on this build.
{
  const dir = tree(EXPORT_SHA, join(work, 'legacy-8eed'));
  install(dir);
  resetOutputs(dir, ['.wrangler/alert-export-cold-state', 'tests/evidence/alert-export-cold']);
  const driver = readFileSync('tests/alert-export-cold-http.mjs'), headDriver = execFileSync('git', ['show', 'HEAD:tests/alert-export-cold-http.mjs'], {maxBuffer: 64 << 20});
  if (sha(driver) !== sha(headDriver)) die('tests/alert-export-cold-http.mjs differs from HEAD; the original driver must be used byte for byte');
  copyFileSync('tests/alert-export-cold-http.mjs', join(dir, 'tests/alert-export-cold-http.mjs'));
  const legacy = lastJson(run(node, ['tests/alert-export-cold-http.mjs'], dir, {SAHA_ALERT_EXPORT_PHASE: 'legacy', SAHA_ALERT_EXPORT_ROOT: dir}, join(dir, '.fixture-logs/alert-export-legacy.log')));
  if (legacy.passed !== 17) die(`export legacy phase reported ${JSON.stringify(legacy)}, expected 17`);
  const stage = join(work, 'export-current-stage');
  rmSync(stage, {recursive: true, force: true}); mkdirSync(join(stage, '.wrangler'), {recursive: true}); mkdirSync(join(stage, 'tests/evidence/alert-export-cold'), {recursive: true});
  const legacyState = join(dir, '.wrangler/alert-export-cold-state'), pure = stateDigest(legacyState);
  cpSync(legacyState, join(stage, '.wrangler/alert-export-cold-state'), {recursive: true});
  copyFileSync(join(dir, 'tests/evidence/alert-export-cold/legacy.json'), join(stage, 'tests/evidence/alert-export-cold/legacy.json'));
  const forward = upgrade(join(stage, '.wrangler/alert-export-cold-state'), dir);
  const current = lastJson(run(node, ['tests/alert-export-cold-http.mjs'], root, {SAHA_ALERT_EXPORT_PHASE: 'current', SAHA_ALERT_EXPORT_ROOT: stage}, join(stage, 'current-phase.log')));
  if (!(current.passed > 0)) die('export current phase reported ' + JSON.stringify(current));
  copyOwned(join(stage, '.wrangler/alert-export-cold-state'), OWNED.exportState);
  rmSync(OWNED.exportEvidence, {recursive: true, force: true}); mkdirSync(OWNED.exportEvidence, {recursive: true});
  copyFileSync(join(dir, 'tests/evidence/alert-export-cold/legacy.json'), join(OWNED.exportEvidence, 'legacy.json'));
  manifest.fixtures.alertExportCold = {
    sourceCommit: EXPORT_SHA, driver: 'tests/alert-export-cold-http.mjs', driverSha256: sha(driver), legacyAssertions: legacy.passed, currentPhaseAssertions: current.passed, ports: [21221],
    stateSha256BeforeForwardMigration: pure, forwardMigrations: forward, stateSha256: stateDigest(OWNED.exportState),
    evidenceSha256: {'legacy.json': sha(readFileSync(join(OWNED.exportEvidence, 'legacy.json')))},
  };
}
mkdirSync(dirname(manifestPath), {recursive: true});
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({built: Object.keys(manifest.fixtures), manifest: manifestPath, ...OWNED}));
