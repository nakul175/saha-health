// Slice 11b: apply every migration in drizzle/ to a fresh local D1 directory in ONE wrangler call.
// tests/lib/worker.mjs freshDatabase() runs one wrangler process per migration file (16 processes, about 20 s). On this 2-core machine, 3 October 2026,
// 4 of 6 trials of that path failed: two stopped with "no such table: organisations" at 0006 (a migration was not visible to the next process), and two
// finished without an error but left the Worker answering 503 (the one inspected had 27 tables, against the 34 of a complete schema).
// One concatenated file is a single call: about 2 s, 5 of 5 trials clean (34 tables). Use it with startWorker({ fresh: false, state }).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/** Recreate `state` (a directory) and migrate it. Run from the repository root with a built dist/. Returns the number of migrations applied. */
export function migrateOnce(state, config = 'dist/server/wrangler.json') {
  state = resolve(state);
  rmSync(state, { recursive: true, force: true });
  const dir = mkdtempSync(join(tmpdir(), 'saha-migrate-')), file = join(dir, 'all.sql');
  try {
    const files = readdirSync('drizzle').filter(f => /^\d{4}_.*\.sql$/.test(f)).sort();
    if (files.length < 16) throw new Error(`expected at least 16 migrations in drizzle/, found ${files.length}`);
    writeFileSync(file, files.map(f => readFileSync(join('drizzle', f), 'utf8')).join('\n;\n'));
    execFileSync(process.execPath, ['--import', './scripts/sites-env.mjs', './node_modules/wrangler/bin/wrangler.js', 'd1', 'execute', 'DB', '--local', '--config', config, '--persist-to', state, '--file', file], { stdio: ['ignore', 'pipe', 'pipe'] });
    return files.length;
  } catch (e) {
    throw new Error(`Migrating the fresh local database failed: ${String(e.stderr ?? e.message).slice(-1200)}`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
