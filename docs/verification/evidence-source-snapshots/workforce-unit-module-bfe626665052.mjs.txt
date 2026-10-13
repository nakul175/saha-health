import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = mkdtempSync('.workforce-status-'), checks = [];
const check = (name, fn) => { fn(); checks.push(name); };
try {
  writeFileSync(join(dir, 'workforce-status.mjs'), ts.transpileModule(readFileSync('lib/saha/workforce-status.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText);
  const module = await import(pathToFileURL(join(dir, 'workforce-status.mjs')));
  const context = () => ({ actorId: 'owner', organisation: { id: 'org', name: 'Synthetic organisation' }, members: [
    { userId: 'owner', name: 'Owner', role: 'clinician', status: 'active', isOwner: true, version: 3, teamIds: ['default'] },
    { userId: 'worker', name: 'Worker', role: 'asha', status: 'active', isOwner: false, version: 7, teamIds: ['default', 'second'] },
  ] });
  const prepare = (value = context(), id = 'worker', reason = 'Synthetic suspension reason', key = 'original-reference') => module.prepareSuspension(value, id, reason, key);
  check('Explicit original actor org target version and all access fields are retained', () => assert.deepEqual(prepare(), {
    key: 'original-reference', actorId: 'owner', organisationId: 'org', command: { type: 'updateMember', userId: 'worker', version: 7,
      role: 'asha', teamIds: ['default', 'second'], isOwner: false, status: 'suspended', reason: 'Synthetic suspension reason' },
  }));
  check('Reason uses the original command bounds and trim', () => assert.equal(prepare(context(), 'worker', '  Five words for this reason  ').command.reason, 'Five words for this reason'));
  check('Preparation never mutates current membership', () => { const value = context(), before = JSON.stringify(value); prepare(value); assert.equal(JSON.stringify(value), before); });
  check('Prepared team list does not alias displayed metadata', () => { const value = context(), attempt = prepare(value); attempt.command.teamIds.pop(); assert.equal(value.members[1].teamIds.length, 2); });
  for (const actor of ['worker@example.invalid', 'auth0|synthetic-owner', 'opaque/owner', 'opaque-owner-' + 'x'.repeat(220)])
    check('Original opaque owner subject remains exact ' + actor.slice(0,30), () => { const value = context(); value.actorId = actor; value.members[0].userId = actor; assert.equal(prepare(value).actorId, actor); });
  check('Original command trimming cannot silently select a different identity', () => { const value = context(); value.members[1].userId = ' worker '; assert.throws(() => prepare(value, ' worker ')); });
  for (const [name, change] of [
    ['no-current-owner', value => value.members[0].isOwner = false], ['owner-suspended', value => value.members[0].status = 'suspended'],
    ['owner-removed', value => value.members[0].status = 'removed'], ['duplicate-member', value => value.members.push({ ...value.members[1] })],
    ['unknown-role', value => value.members[1].role = 'invented'], ['invalid-version', value => value.members[1].version = 0],
    ['unsafe-version', value => value.members[1].version = Number.MAX_SAFE_INTEGER + 1], ['numeric-name', value => value.members[1].name = 4],
    ['unknown-patient-field', value => value.members[1].patientName = 'PRIVATE'], ['duplicate-teams', value => value.members[1].teamIds = ['default', 'default']],
  ]) check('Malformed or unavailable metadata refuses ' + name, () => { const value = context(); change(value); assert.throws(() => prepare(value)); });
  for (const status of ['suspended', 'removed']) check('Already unavailable target cannot start suspension ' + status, () => {
    const value = context(); value.members[1].status = status; assert.throws(() => prepare(value));
  });
  for (const id of ['owner', 'missing', 'fixture:worker']) check('Self missing or demonstration source refuses ' + id, () => {
    const value = context(); if (id.startsWith('fixture:')) value.members[1].userId = id; assert.throws(() => prepare(value, id));
  });
  for (const reason of ['', 'tiny', 'x'.repeat(1001)]) check('Invalid original reason refuses length ' + reason.length, () => assert.throws(() => prepare(context(), 'worker', reason)));
  for (const key of ['short', 'bad/key', 'x'.repeat(101)]) check('Invalid original operation reference refuses ' + key.length, () => assert.throws(() => prepare(context(), 'worker', 'Valid reason', key)));
  check('Unchanged current target authorises only its exact preserved metadata', () => assert.equal(module.unchangedSuspensionTarget(context().members[1], prepare().command), true));
  check('Team order alone does not invent a changed access scope', () => {
    const target = context().members[1]; target.teamIds.reverse(); assert.equal(module.unchangedSuspensionTarget(target, prepare().command), true);
  });
  for (const [name, change] of [['version', target => target.version++], ['role', target => target.role = 'clinician'],
    ['owner', target => target.isOwner = true], ['teams', target => target.teamIds = ['default']], ['status', target => target.status = 'suspended']])
    check('Changed target does not authorise a new write ' + name, () => { const target = context().members[1]; change(target); assert.equal(module.unchangedSuspensionTarget(target, prepare().command), false); });
  check('Committed suspension readback matches same actor org target advanced version', () => {
    const value = context(); value.members[1].status = 'suspended'; value.members[1].version++; assert.equal(module.recordedSuspensionMatches(prepare(), value), true);
  });
  check('A later reinstatement is current status, never overwritten or falsely called suspended', () => {
    const value = context(); value.members[1].version += 2; assert.equal(module.recordedSuspensionMatches(prepare(), value), true); assert.equal(value.members[1].status, 'active');
  });
  for (const [name, change] of [['actor', value => value.actorId = 'other'], ['org', value => value.organisation.id = 'other'],
    ['missing-target', value => value.members.pop()], ['unchanged-version', () => {}]])
    check('Wrong or incomplete readback never confirms ' + name, () => { const value = context(); if (name !== 'unchanged-version') value.members[1].version++; change(value); assert.equal(module.recordedSuspensionMatches(prepare(), value), false); });
  for (const status of ['active', 'removed']) check('New endpoint cannot activate or remove ' + status, () => assert.equal(module.suspensionCommand.safeParse({ ...prepare().command, status }).success, false));
  check('Original suspension command rejects extra operation fields', () => assert.equal(module.suspensionCommand.safeParse({ ...prepare().command, clinicalPolicy: 'invented' }).success, false));
  check('Owner setup may be empty without creating or inventing an organisation', () => assert.deepEqual(module.ownerOrganisations.parse({ actorId: 'new', organisations: [] }), { actorId: 'new', organisations: [] }));
  check('Owner setup rejects duplicate organisation references', () => assert.equal(module.ownerOrganisations.safeParse({ actorId: 'owner', organisations: [{ id: 'org', name: 'First' }, { id: 'org', name: 'Second' }] }).success, false));
  const result = { passed: checks.length, failed: 0, skipped: 0, checks, completedAt: new Date().toISOString(),
    limits: 'Pure metadata and intent refusal checks; actual server authority, write/recovery, online revocation and custody require separate synthetic native tests. No institutional, clinical, formal or hosting acceptance.' };
  writeFileSync('tests/reports/workforce-status-contract-result.json', JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify(result));
} finally { rmSync(dir, { recursive: true, force: true }); }
