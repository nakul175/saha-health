// Slice 13d (round-10 review, L6): the organisation's operations document has an overall size bound, beside the caps on
// each collection in it. Checked against the real `rowsForState` of lib/saha/store.ts (transpiled):
// 1. a change that takes the document past the bound, and grows it, is refused with 413 and the settings-full message;
// 2. a change that shrinks a document already past the bound is never refused, so an organisation can always recover;
// 3. the indicator differencing ledger kept in the same row is not counted (it has its own writer and bound);
// 4. a change within the bound writes the row as before.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(process.cwd(), '.operations-bound-contract-')), seen = new Set();
let passed = 0;
const check = fn => { fn(); passed++; };
function compile(name) {
  if (seen.has(name)) return; seen.add(name);
  let code = ts.transpileModule(readFileSync(`lib/saha/${name}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  code = code.replace(/from ['"](\.\/[^'"]+)['"]/g, (_, path) => {
    const rel = join(dirname(name), path);
    if (path.endsWith('.json') || path.endsWith('.mjs')) { const file = join(dir, rel); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, readFileSync('lib/saha/' + rel)); return path.endsWith('.json') ? `from '${path}' with {type:'json'}` : `from '${path}'`; }
    compile(rel); return `from '${path}.js'`;
  });
  const file = join(dir, name + '.js'); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, code);
}
try {
  compile('store');
  const S = await import(pathToFileURL(join(dir, 'store.js')));
  const actor = { userId: 'own', displayName: 'Synthetic owner', email: '' }, now = '2026-10-04T06:00:00.000Z';
  const ops = extra => ({ version: 1, maintenance: false, reason: '', updatedAt: now, incidents: [], rates: null, ...extra });
  const state = operations => ({ organisation: { id: 'org', name: 'Synthetic organisation', revision: 1, createdAt: now }, teams: [], members: [], invitations: [], operations,
    workspace: { schemaVersion: 1, revision: 1, role: 'admin', people: [], visits: [], integrations: [], submissions: [], referrals: [], receipts: {}, audit: [] } });
  const filler = n => ({ incidents: [{ id: 'i', title: 'x'.repeat(n), severity: 'low', state: 'resolved', ownerId: 'own', createdAt: now, updatedAt: now }] });
  const rows = (after, before) => S.rowsForState(state(after), before ? state(before) : null, actor, 'synthetic', '', now);
  const refused = fn => { try { fn(); return null; } catch (e) { return e; } };

  check(() => {
    assert.equal(S.OPERATIONS_BYTES, 1_000_000);
    assert.equal(S.operationsBytes(ops(filler(10))), new TextEncoder().encode(JSON.stringify(ops(filler(10)))).length);
    assert.equal(S.operationsBytes(undefined), 0);
  });
  check(() => {
    const e = refused(() => rows(ops(filler(S.OPERATIONS_BYTES)), ops()));
    assert.ok(e, 'growing past the bound is refused'); assert.equal(e.status, 413); assert.equal(e.message, S.OPERATIONS_FULL);
  });
  check(() => {
    const big = ops(filler(S.OPERATIONS_BYTES + 10)), smaller = ops(filler(S.OPERATIONS_BYTES + 5));
    assert.equal(refused(() => rows(smaller, big)), null, 'shrinking a document already past the bound is allowed');
    assert.ok(refused(() => rows(ops({ ...filler(S.OPERATIONS_BYTES + 10), reason: 'grows' }), big)), 'growing it further is not');
  });
  check(() => {
    const ledger = { indicatorReleases: [{ v: 'x', k: 'k', c: { g: 6 }, pad: 'y'.repeat(S.OPERATIONS_BYTES) }] };
    assert.ok(S.operationsBytes(ops(ledger)) < 1000, 'the differencing ledger is not counted');
    assert.equal(refused(() => rows(ops({ ...ledger, reason: 'note' }), ops(ledger))), null);
  });
  check(() => {
    const out = rows(ops({ reason: 'Synthetic note' }), ops());
    const row = out.find(r => r.table === 'operations'); assert.ok(row); assert.equal(JSON.parse(row.values.data).reason, 'Synthetic note');
  });

  writeFileSync('tests/operations-bound-contract-result.json', JSON.stringify({ passed, suite: 'operations-bound-contract', completedAt: new Date().toISOString() }, null, 2) + '\n');
  console.log(JSON.stringify({ passed, suite: 'operations-bound-contract' }));
} finally { rmSync(dir, { recursive: true, force: true }); }
