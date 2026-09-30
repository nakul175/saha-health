// Slice 1d roster contract: preview classification, errors, safety rules and apply-exactly-the-preview.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(process.cwd(), '.roster-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const rejects = async (fn, code) => { try { await fn(); } catch (e) { assert.equal(e.status, code, e.message); passed++; return e; } assert.fail(`expected ${code}`); };
try {
  for (const f of ['roster', 'core', 'mis', 'programmes', 'types'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const x = await import(pathToFileURL(join(dir, 'roster.js')));
  const now = '2026-09-30T06:00:00.000Z', C = n => String(n).padStart(24, 'A');
  const member = (userId, code, role, teamIds, over = {}) => ({ userId, displayName: userId.toUpperCase(), accountCode: C(code), role, isOwner: false, status: 'active', version: 1, teamIds, createdAt: now, ...over });
  const s = { organisation: { id: 'org', name: 'Synthetic', revision: 1 }, teams: [{ id: 't1', name: 'Care team' }, { id: 't2', name: 'North' }],
    members: [member('own', 1, 'clinician', ['t1'], { isOwner: true }), member('own2', 2, 'clinician', ['t1'], { isOwner: true }), member('a1', 3, 'asha', ['t1']), member('a2', 4, 'asha', ['t1']), member('s1', 5, 'supervisor', ['t1'], { status: 'suspended' }), member('gone', 6, 'asha', [], { status: 'removed' }), member('a3', 9, 'asha', ['t1'])],
    invitations: [{ id: 'i1', accountCode: C(7), label: 'Pending', role: 'asha', teamIds: ['t1'], status: 'pending', expiresAt: '2026-10-02T00:00:00.000Z', createdBy: 'own', createdAt: now }], workspace: { audit: [] } };
  const row = (code, name, role, teams, status = 'active') => ({ accountCode: C(code), name, role, teams, status });
  const rows = [row(3, 'A1', 'asha', ['Care team']), row(4, 'A2', 'clinician', ['Care team', 'north']), row(5, 'S1', 'supervisor', ['Care team']), row(6, 'Gone', 'asha', ['Care team']), row(7, 'Pending', 'asha', ['Care team']), row(8, 'New', 'supervisor', ['t2']), row(2, 'Own2', 'clinician', ['Care team'], 'left'), row(10, 'Stranger', 'asha', ['Care team'], 'left'), row(1, 'Me', 'asha', ['Care team'])];
  const d = await x.rosterDiff(s, rows, true, 'own', now);
  const act = c => d.actions.find(a => a.accountCode === C(c));
  check(() => { assert.deepEqual(d.errors, []); assert.equal(act(3).action, 'none'); assert.equal(act(4).action, 'update'); assert.deepEqual(act(4).teamIds, ['t1', 't2']); assert.equal(act(5).action, 'conflict'); assert.equal(act(6).action, 'invite'); assert.equal(act(7).action, 'none'); assert.equal(act(8).action, 'invite'); assert.equal(act(2).action, 'conflict'); assert.equal(act(10).action, 'none'); assert.equal(act(1).action, 'none', 'own membership untouched'); });
  check(() => { assert.equal(act(9).action, 'suspend', 'missing from a complete roster'); assert.deepEqual(d.counts, { invite: 2, update: 1, suspend: 1, none: 4, conflict: 2 }); });
  const partial = await x.rosterDiff(s, rows, false, 'own', now);
  check(() => assert.equal(partial.actions.some(a => a.accountCode === C(9)), false, 'a partial roster never suspends unlisted members'));
  const bad = await x.rosterDiff(s, [row(3, 'A1', 'asha', ['Care team']), row(3, 'A1 again', 'asha', ['Care team']), row(11, 'X', 'asha', ['Nowhere']), row(12, 'Y', 'clinician', [])], false, 'own', now);
  check(() => { assert.equal(bad.errors.length, 3); assert.match(bad.errors.join(' '), /more than once/); assert.match(bad.errors.join(' '), /unknown team Nowhere/); assert.match(bad.errors.join(' '), /needs a team/); });
  const run = (userId, cmd) => x.applyRoster(s, cmd, { userId, displayName: userId.toUpperCase(), email: 'x' }, s.members.find(m => m.userId === userId), now);
  const cmd = over => ({ type: 'rosterApply', rows, complete: true, previewHash: d.hash, reason: 'Synthetic district roster of 30 September', ...over });
  await rejects(() => run('a1', cmd()), 403);
  await rejects(() => run('own', cmd({ previewHash: 'f'.repeat(64) })), 409);
  await rejects(() => run('own', cmd({ rows: [row(3, 'A1', 'asha', ['Nowhere'])], previewHash: d.hash })), 422);
  check(() => assert.equal(s.members.find(m => m.userId === 'a2').role, 'asha', 'nothing changed by refused applies'));
  const r = await run('own', cmd());
  check(() => { assert.equal(r.invitations.length, 2); assert.ok(r.invitations.every(i => /^[a-f0-9]{64}$/.test(i.token))); assert.equal(s.invitations.filter(i => i.status === 'pending').length, 3); assert.ok(s.invitations.every(i => !JSON.stringify(i).includes(r.invitations[0].token)), 'only the token hash is stored'); });
  check(() => { const a2 = s.members.find(m => m.userId === 'a2'); assert.deepEqual([a2.role, a2.teamIds, a2.version], ['clinician', ['t1', 't2'], 2]); assert.equal(s.members.find(m => m.userId === 'a3').status, 'suspended'); assert.equal(s.members.find(m => m.userId === 's1').status, 'suspended'); assert.equal(s.members.find(m => m.userId === 'own2').status, 'active'); assert.equal(r.conflicts.length, 2); });
  check(() => { assert.equal(s.workspace.audit.filter(a => a.action === 'rosterApply').length, 5); assert.match(s.workspace.audit.at(-1).detail, /2 invited, 1 updated, 1 suspended, 2 conflicts/); });
  const again = await x.rosterDiff(s, rows, true, 'own', now);
  check(() => assert.deepEqual(again.counts, { invite: 0, update: 0, suspend: 0, none: 7, conflict: 2 }, 'a second preview of the same roster changes nothing'));
  await rejects(() => run('own', cmd()), 409);
  const result = { suite: 'roster contract (slice 1d)', passed, completedAt: new Date().toISOString() };
  writeFileSync('tests/roster-contract-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { rmSync(dir, { recursive: true, force: true }); }
