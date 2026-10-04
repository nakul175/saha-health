// Slice 10d contract: workforce roster import from a CSV file (BR-ID-01), on the slice 1d roster rules and the slice 2f
// and 2h dry-run, plan-hash and apply pattern. File header and size rules; owner-only authority; every row rejection
// reason; repeats inside the file; classification equal to the slice 1d roster for the same rows (invite, update,
// suspend, no change, conflicts, own membership, fixture clinicians); the import-specific conflicts (provider accounts,
// pending invitations, external staff ids); leavers never held back by stale roles or teams; a plan hash bound to the
// file, the importer, the environment, memberships, teams, invitations and staff ids; no names, account codes or staff
// ids in the dry run or the audit; apply of exactly the plan (account-bound invitations with token hashes only, updates,
// suspensions, staff ids with lineage, counted audit); a refused or stale apply changing nothing; the rejection report.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = mkdtempSync(join(process.cwd(), '.workforce-import-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const rejects = async (fn, status, pattern) => { await assert.rejects(fn, e => e.status === status && pattern.test(e.message), String(pattern)); passed++; };
try {
  for (const f of ['abdm', 'abdm-transfer', 'access', 'action-plan', 'adapter-operations', 'agent', 'agent-minimisation', 'ai-budget', 'alerts', 'anaemia', 'audit-chain', 'capability-lifecycle', 'caseload', 'consent', 'continuity', 'core', 'delegation', 'ehr', 'environment', 'evaluation', 'exceptional', 'expansion', 'facility-scope', 'fact-provenance', 'fhir-document', 'fhir-validate', 'field', 'field-device', 'field-registration', 'governance', 'household', 'household-constants', 'household-visit', 'household-visit-constants', 'identity', 'import-rejections', 'imported-visits', 'media', 'merge', 'mis', 'operations', 'outreach', 'pack-installation', 'partition', 'patient-import', 'pilot', 'programme-commands', 'programmes', 'provider-sandbox', 'purpose-scope', 'record-import', 'referral-needs', 'referral-request', 'referral-rules', 'report-export', 'retention', 'rights', 'roster', 'seed', 'send-gate', 'service-identity', 'shadow', 'store', 'task-limits', 'types', 'visit-import', 'withdrawal-notices', 'workforce-import'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const W = await import(pathToFileURL(join(dir, 'workforce-import.js')));
  const R = await import(pathToFileURL(join(dir, 'roster.js')));
  const X = await import(pathToFileURL(join(dir, 'import-rejections.js')));
  const E = await import(pathToFileURL(join(dir, 'report-export.js')));
  const now = '2026-10-02T09:00:00.000Z', later = '2026-10-02T09:05:00.000Z', C = n => String(n).padStart(24, 'A');
  const member = (userId, code, role, teamIds, over = {}) => ({ userId, displayName: userId.toUpperCase(), accountCode: C(code), role, isOwner: false, status: 'active', version: 1, teamIds, createdAt: now, ...over });
  const invitation = (id, code, role, teamIds, over = {}) => ({ id, accountCode: C(code), label: 'Pending', role, teamIds, status: 'pending', expiresAt: '2026-10-04T00:00:00.000Z', createdBy: 'own', createdAt: now, tokenHash: 'h'.repeat(64), ...over });
  const held = id => ({ id, batchId: 'b0' });
  const state = () => ({
    organisation: { id: 'org', name: 'Synthetic', revision: 1 }, teams: [{ id: 't1', name: 'Care team' }, { id: 't2', name: 'North' }],
    members: [member('own', 1, 'clinician', ['t1'], { isOwner: true }), member('own2', 2, 'clinician', ['t1'], { isOwner: true }), member('a1', 3, 'asha', ['t1']), member('a2', 4, 'asha', ['t1']),
      member('s1', 5, 'supervisor', ['t1'], { status: 'suspended' }), member('gone', 6, 'asha', [], { status: 'removed' }), member('a4', 11, 'asha', ['t1']), member('fx', 12, 'clinician', ['t1']),
      member('fixture:demo-clinician', 19, 'clinician', ['t1']), member('a5', 13, 'asha', ['t1']), member('prov', 14, 'provider', ['t1']), member('a6', 17, 'asha', ['t1']), member('a7', 18, 'asha', ['t1']), member('a3', 9, 'asha', ['t1'])],
    invitations: [invitation('i1', 7, 'asha', ['t1']), invitation('i2', 15, 'asha', ['t1']), invitation('i3', 16, 'asha', ['t1'])],
    operations: { version: 0, maintenance: false, reason: '', updatedAt: '', incidents: [], rates: null, staffIds: { [C(3)]: held('KGP-0003'), [C(17)]: held('KGP-0017'), [C(18)]: held('KGP-0018') } },
    workspace: { audit: [] } });
  const owner = s => s.members.find(m => m.userId === 'own');
  const HEAD = 'name,account_code,role,team,status,external_staff_id';
  const csv = (...lines) => [HEAD, ...lines].join('\n');
  const plan = async (file, s = state(), who = owner(s), env = 'synthetic', at = now) => W.planWorkforceImport(s, who, file, env, at);
  const rowOf = (p, n) => p.rows.find(r => r.row === n);

  // 1. Schema, header, size and authority.
  check(() => { assert.equal(W.workforceImportInput.safeParse({ csv: 'x'.repeat(16001) }).success, false); assert.equal(W.workforceImportInput.safeParse({ csv: 'x', extra: 1 }).success, false); assert.equal(W.workforceImportInput.safeParse({ csv: '' }).success, false);
    const ok = { type: 'workforceImportApply', csv: 'x', planHash: 'a'.repeat(64), reason: 'Synthetic district roster, 2 October' };
    assert.equal(W.workforceImportSchema.safeParse(ok).success, true); assert.equal(W.workforceImportSchema.safeParse({ ...ok, reason: 'short' }).success, false); assert.equal(W.workforceImportSchema.safeParse({ ...ok, planHash: 'zz' }).success, false); assert.equal(W.workforceImportSchema.safeParse({ ...ok, extra: 1 }).success, false); });
  await rejects(() => plan('name,account_code,role,team\nA,x,asha,Care team'), 422, /Missing: status/);
  await rejects(() => plan(HEAD + ',nickname\nA,x,asha,Care team,active,,n'), 422, /Not recognised: 1 column/);
  await rejects(() => plan('name,name,account_code,role,team,status\nA,A,x,asha,Care team,active'), 422, /once each/);
  await rejects(() => plan(HEAD), 422, /no rows/);
  await rejects(() => plan(''), 422, /empty/);
  await rejects(() => plan([HEAD, ...Array.from({ length: 101 }, (_, i) => `P${i},${C(100 + i)},asha,Care team,active,`)].join('\n')), 422, /At most 100 rows/);
  { const s = state(); const p = await plan('name,account_code,role,team,status\nNo Staff Column,' + C(40) + ',asha,Care team,active', s); check(() => { assert.equal(p.counts.invite, 1); assert.equal(p.counts.staffIds, 0); }); }
  for (const who of [s => s.members.find(m => m.userId === 'a1'), s => s.members.find(m => m.userId === 'a2'), s => ({ ...owner(s), isOwner: false, role: 'supervisor' }), s => ({ ...owner(s), status: 'suspended' })])
    await rejects(() => { const s = state(); return plan(csv(`A,${C(40)},asha,Care team,active,`), s, who(s)); }, 403, /Only an organisation owner/);
  check(() => { const s = state(); W.authorizeWorkforceImport(s, owner(s), { type: 'workforceImportApply' }); W.authorizeWorkforceImport(s, s.members.find(m => m.userId === 'a1'), { type: 'other' }); assert.throws(() => W.authorizeWorkforceImport(s, s.members.find(m => m.userId === 'a1'), { type: 'workforceImportApply' }), e => e.status === 403); assert.throws(() => W.authorizeWorkforceImport(s, { ...owner(s), isOwner: false }, { type: 'workforceImportApply' }), e => e.status === 403); });
  // An organisation owner holding any role may import (as with the pasted roster); non-owner supervisors may not.
  { const s = state(); const asha = { ...owner(s), role: 'asha' }; const p = await plan(csv(`A,${C(40)},asha,Care team,active,`), s, asha); check(() => assert.equal(p.counts.invite, 1)); }

  // 2. Row rejections, each with its reason; repeats inside the file are rejected for every row involved.
  const bad = csv(
    `,${C(20)},asha,Care team,active,`,                     // 1 name required
    `X,ZZZ,asha,Care team,active,`,                          // 2 account code
    `X,${C(21)},nurse,Care team,active,`,                    // 3 role
    `X,${C(22)},asha,Care team,paused,`,                     // 4 status
    `X,${C(23)},asha,Nowhere,active,`,                       // 5 unknown team
    `X,${C(24)},asha,,active,`,                              // 6 care role needs a team
    `X,${C(25)},admin,,active,`,                             // 7 admin needs no team: invitation
    `X,${C(26)},asha,Care team,active,=cmd|' /C calc'!A0`,  // 8 formula-like staff id
    `X,${C(27)},asha`,                                       // 9 field count
    `Twin,${C(28)},asha,Care team,active,`,                  // 10 repeated account code
    `Twin again,${C(28)},clinician,Care team,active,`,       // 11
    `Dup A,${C(29)},asha,Care team,active,DUP-1`,            // 12 same staff id, different accounts
    `Dup B,${C(30)},asha,Care team,active,dup-1`,            // 13
    `"Bad\nName",${C(31)},asha,Care team,active,`,           // 14 control character in the name
    `${'N'.repeat(201)},${C(32)},asha,Care team,active,`,    // 15 long name
    `X,${C(33)},asha,${Array.from({ length: 21 }, (_, i) => 'T' + i).join(';')},active,`, // 16 too many teams
    `X,${C(34)},asha,Care team,active,${'S'.repeat(65)}`,    // 17 long staff id
    `Same Twice,${C(35)},asha,Care team,active,SAME-1`,      // 18 same account and staff id repeated: only the code rule applies
    `Same Twice,${C(35)},asha,Care team,active,SAME-1`);     // 19
  const bp = await plan(bad);
  check(() => { const r = n => rowOf(bp, n); assert.equal(r(1).reasons[0], 'Name is required.'); assert.match(r(2).reasons[0], /24-character code/); assert.match(r(3).reasons[0], /Role must be one of asha, clinician, supervisor, admin/); assert.equal(r(4).reasons[0], 'Status must be active or left.');
    assert.match(r(5).reasons[0], /1 team name on this row does not match a team/); assert.equal(r(6).reasons[0], 'A care or supervisor role needs a team.'); assert.equal(r(7).action, 'invite'); assert.deepEqual(r(7).reasons, []); assert.match(r(8).reasons[0], /External staff id must be 1 to 64/);
    assert.match(r(9).reasons[0], /Row 9 has 3 fields; the header has 6/); assert.match(r(10).reasons.join(' '), /rows 10, 11; none of them is applied/); assert.match(r(11).reasons.join(' '), /rows 10, 11/);
    assert.match(r(12).reasons.join(' '), /staff id appears on rows 12, 13 for different account codes/); assert.match(r(13).reasons.join(' '), /rows 12, 13/); assert.match(r(14).reasons[0], /control characters/); assert.match(r(15).reasons[0], /longer than 200/);
    assert.match(r(16).reasons[0], /At most 20 teams/); assert.match(r(17).reasons[0], /External staff id must be 1 to 64/); assert.deepEqual(r(18).reasons.length, 1); assert.match(r(18).reasons[0], /rows 18, 19/); assert.equal(r(19).action, 'rejected');
    assert.equal(bp.counts.rejected, 18); assert.equal(bp.counts.invite, 1); assert.equal(bp.counts.rows, 19); });
  check(() => { const text = JSON.stringify(W.publicWorkforcePlan(bp)); for (const x of ['Twin', 'Dup A', 'DUP-1', C(28), C(29), 'Same Twice']) assert.equal(text.includes(x), false, x); assert.equal('steps' in W.publicWorkforcePlan(bp), false); });

  // 3. Classification equals the slice 1d roster for the same rows, plus the import-specific rules.
  const good = csv(
    `Asha One,${C(3)},asha,Care team,active,`,                       // 1 no change
    `Asha Two,${C(4).toLowerCase()},Clinician,Care team;north,active,KGP-0004`, // 2 update role and teams, record staff id (account code and role in any case)
    `Sup Suspended,${C(5)},supervisor,Care team,active,`,           // 3 conflict: suspended here, active in the file
    `Gone Back,${C(6)},asha,Care team,active,KGP-0006`,             // 4 invitation (removed earlier) and staff id
    `Pending Same,${C(7)},asha,Care team,active,`,                  // 5 current invitation already exists
    `New Sup,${C(8)},supervisor,t2,active,KGP-0008`,                // 6 invitation, team by id
    `Own Two,${C(2)},clinician,Care team,left,`,                    // 7 conflict: owner listed as left
    `Stranger,${C(10)},asha,Care team,left,`,                       // 8 not a member
    `Me,${C(1)},asha,Care team,active,KGP-0001`,                    // 9 the importer's own membership
    `Fixture,${C(19)},asha,Care team,active,`,                      // 10 demonstration fixture clinician
    `Leaver,${C(11)},tech,Nowhere team,left,KGP-0011`,              // 11 suspension: a stale role and team never hold a leaver back
    `Pending Diff,${C(15)},clinician,Care team,active,`,            // 12 conflict: pending invitation with another role
    `Left Pending,${C(16)},asha,Care team,left,`,                   // 13 conflict: pending invitation for a leaver
    `Provider,${C(14)},asha,Care team,active,`,                     // 14 conflict: provider account
    `Asha Five,${C(13)},asha,Care team,active,KGP-0013`,            // 15 only the staff id is recorded
    `Asha Three,${C(9)},asha,Care team,active,kgp-0003`,            // 16 conflict: staff id recorded for another account
    `Asha Six,${C(17)},asha,Care team,active,KGP-0099`,             // 17 conflict: a different staff id is already recorded
    `Asha Seven,${C(18)},asha,Care team,active,kgp-0018`);          // 18 same staff id, other case: no change
  const gp = await plan(good);
  const kind = n => rowOf(gp, n).action;
  check(() => assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].map(kind), ['none', 'update', 'conflict', 'invite', 'none', 'invite', 'conflict', 'none', 'none', 'none', 'suspend', 'conflict', 'conflict', 'conflict', 'update', 'conflict', 'conflict', 'none']));
  check(() => assert.deepEqual(gp.counts, { rows: 18, invite: 2, update: 2, suspend: 1, unchanged: 6, conflict: 7, rejected: 0, staffIds: 5 }));
  check(() => { assert.equal(rowOf(gp, 2).role, 'clinician'); assert.deepEqual(rowOf(gp, 2).teams, ['Care team', 'North']); assert.equal(rowOf(gp, 2).staffId, 'record'); assert.deepEqual(rowOf(gp, 6).teams, ['North']); assert.equal(rowOf(gp, 15).staffId, 'record'); assert.equal(rowOf(gp, 15).role, undefined);
    assert.match(rowOf(gp, 15).detail, /Membership unchanged; records the external staff id/); assert.equal(rowOf(gp, 9).staffId, undefined, 'the importer\'s own row records nothing'); assert.equal(rowOf(gp, 10).staffId, undefined); assert.equal(rowOf(gp, 18).staffId, undefined, 'the same staff id is not recorded twice'); });
  check(() => { assert.match(rowOf(gp, 3).reasons[0], /Suspended here but active/); assert.match(rowOf(gp, 7).reasons[0], /owner is listed as left/i); assert.match(rowOf(gp, 12).reasons[0], /different role or team/); assert.match(rowOf(gp, 13).reasons[0], /listed as left/); assert.match(rowOf(gp, 14).reasons[0], /Provider accounts/);
    assert.match(rowOf(gp, 16).reasons[0], /already recorded for another account/); assert.match(rowOf(gp, 17).reasons[0], /different external staff id recorded; an import does not replace it/); assert.match(rowOf(gp, 9).detail, /own membership is not changed/); assert.match(rowOf(gp, 10).detail, /fixture clinician/); assert.match(rowOf(gp, 3).detail, /^Not applied: /); });
  // Same rows, same rules: the slice 1d roster classifies the rows that carry no import-specific rule identically.
  { const s = state(); const rr = (n, role, teams, status = 'active') => ({ accountCode: C(n), name: 'N' + n, role, teams, status });
    const roster = await R.rosterDiff(s, [rr(3, 'asha', ['Care team']), rr(4, 'clinician', ['Care team', 'north']), rr(5, 'supervisor', ['Care team']), rr(6, 'asha', ['Care team']), rr(7, 'asha', ['Care team']), rr(8, 'supervisor', ['t2']), rr(2, 'clinician', ['Care team'], 'left'), rr(10, 'asha', ['Care team'], 'left'), rr(1, 'asha', ['Care team']), rr(19, 'asha', ['Care team']), rr(11, 'asha', ['Care team'], 'left')], false, 'own', now);
    check(() => assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(n => kind(n)), roster.actions.map(a => a.action), 'import and roster classify these rows identically')); }
  check(() => { const text = JSON.stringify(W.publicWorkforcePlan(gp)); for (const x of ['Asha Two', 'Gone Back', 'KGP-', 'kgp-', C(4), C(6), C(8), 'Leaver']) assert.equal(text.includes(x), false, x); });
  // A partial file never suspends the people it does not list.
  check(() => assert.equal(gp.rows.filter(r => r.action === 'suspend').length, 1));

  // 4. The plan hash.
  const h0 = gp.planHash, again = await plan(good);
  check(() => { assert.match(h0, /^[0-9a-f]{64}$/); assert.equal(again.planHash, h0); });
  const variants = {
    'a row value': () => plan(good.replace('Care team;north,active,KGP-0004', 'Care team,active,KGP-0004')),
    'a name on an unchanged row': () => plan(good.replace('Asha One', 'Asha Uno')),
    'a name on an invitation': () => plan(good.replace('Gone Back', 'Gone Forth')),
    'the environment': () => plan(good, state(), undefined, 'training'),
    'a membership version': () => { const s = state(); s.members.find(m => m.userId === 'a6').version = 2; return plan(good, s); },
    'a membership status': () => { const s = state(); s.members.find(m => m.userId === 'a1').status = 'suspended'; return plan(good, s); },
    'a team name': () => { const s = state(); s.teams[1].name = 'Northern'; return plan(good, s); },
    'a pending invitation': () => { const s = state(); s.invitations.find(i => i.id === 'i1').expiresAt = '2026-10-02T09:00:01.000Z'; return plan(good, s, undefined, 'synthetic', later); },
    'a recorded staff id': () => { const s = state(); s.operations.staffIds[C(21)] = held('OTHER-1'); return plan(good, s); },
    'the importer': () => { const s = state(); return plan(good, s, s.members.find(m => m.userId === 'own2')); },
  };
  for (const [what, make] of Object.entries(variants)) { const v = await make(); check(() => assert.notEqual(v.planHash, h0, `the plan hash binds ${what}`)); }

  // 5. Apply exactly the plan.
  const actor = s => ({ userId: 'own', displayName: 'OWN', email: 'x' });
  const cmd = (p, over = {}) => ({ type: 'workforceImportApply', csv: good, planHash: p.planHash, reason: 'Synthetic district roster, 2 October 2026', ...over });
  const apply = (s, c, who = owner(s), env = {}, at = now) => W.applyWorkforceImport(s, c, actor(s), who, env, at);
  { const s = state(), p = await plan(good, s), snapshot = JSON.stringify(s);
    await rejects(() => apply(s, cmd(p), s.members.find(m => m.userId === 'a1')), 403, /Only an organisation owner/);
    await rejects(() => apply(s, cmd(p, { planHash: 'f'.repeat(64) })), 409, /changed since the dry run/);
    await rejects(() => apply(s, cmd(p, { csv: good.replace('Gone Back', 'Gone Forth') })), 409, /changed since the dry run/);
    await rejects(() => apply(s, cmd(p, { csv: good.replace('Asha One', 'Asha Uno') })), 409, /changed since the dry run/);
    await rejects(() => apply(s, cmd(p), owner(s), { SAHA_ENVIRONMENT: 'bogus' }), 409, /environment is not configured/);
    await rejects(() => apply(s, cmd(p), owner(s), { SAHA_ENVIRONMENT: 'training' }), 409, /changed since the dry run/);
    check(() => assert.equal(JSON.stringify(s), snapshot, 'refused applies change nothing'));
    assert.equal(await apply(s, { type: 'rosterApply' }), null); passed++;
    // The state changes after the dry run (a membership edit): the plan is stale.
    const stale = state(), sp = await plan(good, stale); stale.members.find(m => m.userId === 'a2').version++;
    await rejects(() => apply(stale, cmd(sp)), 409, /changed since the dry run/);
    // A file with nothing to apply is refused.
    const quiet = csv(`Asha One,${C(3)},asha,Care team,active,`, `Stranger,${C(10)},asha,Care team,left,`), q = await plan(quiet, state());
    await rejects(() => apply(state(), cmd(q, { csv: quiet })), 409, /nothing to apply/);
    // A file whose every row is rejected plans nothing and applies nothing.
    const none = csv(`,${C(20)},asha,Care team,active,`), n0 = await plan(none, state());
    check(() => { assert.equal(n0.counts.rejected, 1); }); await rejects(() => apply(state(), cmd(n0, { csv: none })), 409, /nothing to apply/);
    const r = await apply(s, cmd(p));
    check(() => { assert.equal(r.counts.invite, 2); assert.equal(r.invitations.length, 2); assert.deepEqual(r.invitations.map(i => i.row), [4, 6]); assert.ok(r.invitations.every(i => /^[a-f0-9]{64}$/.test(i.token))); assert.deepEqual(r.invitations.map(i => i.accountCode), [C(6), C(8)]);
      assert.deepEqual(r.rows, [2, 4, 6, 11, 15]); assert.deepEqual(r.counts, p.counts); assert.match(r.batchId, /^[0-9a-f-]{36}$/); assert.equal(JSON.stringify(r).includes('Gone Back'), false, 'no names in the result'); });
    check(() => { const inv = s.invitations.filter(i => i.status === 'pending'), added = inv.filter(i => ![C(7), C(15), C(16)].includes(i.accountCode)); assert.equal(added.length, 2); for (const i of added) { assert.equal(i.expiresAt, new Date(Date.parse(now) + 72 * 3600000).toISOString()); assert.equal(i.createdBy, 'own'); assert.match(i.tokenHash, /^[0-9a-f]{64}$/); assert.equal(i.status, 'pending'); }
      assert.deepEqual(added.map(i => [i.accountCode, i.role, i.teamIds, i.label]), [[C(6), 'asha', ['t1'], 'Gone Back'], [C(8), 'supervisor', ['t2'], 'New Sup']]); assert.ok(r.invitations.every(i => !JSON.stringify(s.invitations).includes(i.token)), 'only token hashes are stored'); });
    check(() => { const m = id => s.members.find(x => x.userId === id); assert.deepEqual([m('a2').role, m('a2').teamIds, m('a2').version], ['clinician', ['t1', 't2'], 2]); assert.deepEqual([m('a4').status, m('a4').version], ['suspended', 2]); assert.deepEqual([m('a5').role, m('a5').version, m('a5').status], ['asha', 1, 'active'], 'a staff-id-only update leaves the membership alone');
      for (const id of ['own', 'own2', 'a1', 's1', 'gone', 'fixture:demo-clinician', 'prov', 'a6', 'a7', 'a3']) assert.equal(m(id).version, 1, `${id} untouched`); assert.equal(m('own').teamIds.join(), 't1'); assert.equal(m('own2').status, 'active', 'an owner is never suspended'); assert.equal(m('s1').status, 'suspended', 'a local suspension is never reactivated'); assert.equal(m('gone').status, 'removed'); assert.equal(m('own').isOwner && m('own2').isOwner, true); });
    check(() => { const ids = s.operations.staffIds; assert.deepEqual(Object.keys(ids).sort(), [C(3), C(4), C(6), C(8), C(11), C(13), C(17), C(18)].sort()); assert.deepEqual(ids[C(4)], { id: 'KGP-0004', batchId: r.batchId }); assert.equal(ids[C(4)].batchId, r.batchId); assert.equal(ids[C(3)].batchId, 'b0', 'earlier records are kept'); assert.equal(ids[C(1)], undefined); assert.equal(ids[C(9)], undefined); assert.equal(ids[C(17)].id, 'KGP-0017'); });
    check(() => { const ev = s.workspace.audit; assert.equal(ev.length, 6, 'five changed rows and one summary'); assert.ok(ev.every(e => e.action === 'workforceImportApply' && e.actorId === 'own')); const sum = ev.at(-1); assert.equal(sum.subject, 'org'); assert.match(sum.detail, new RegExp(`batch ${r.batchId} applied from dry run ${p.planHash}: 18 rows, 2 invited, 2 updated, 1 suspended, 6 unchanged, 7 conflicts and 0 rejected rows not applied, 5 external staff ids recorded\\. Reason: Synthetic district roster`));
      const text = JSON.stringify(ev); for (const x of ['Asha Two', 'Gone Back', 'New Sup', 'Leaver', 'KGP-', ...r.invitations.map(i => i.token)]) assert.equal(text.includes(x), false, x); assert.deepEqual(ev.slice(0, 5).map(e => e.subject), ['a2', C(6), C(8), 'a4', C(13)]); });
    // After applying, the same file plans only what is still outstanding: nothing, and the stale plan is refused.
    await rejects(() => apply(s, cmd(p)), 409, /changed since the dry run/);
    const after = await plan(good, s);
    check(() => { assert.deepEqual([after.counts.invite, after.counts.update, after.counts.suspend, after.counts.staffIds], [0, 0, 0, 0]); assert.equal(rowOf(after, 4).action, 'none'); assert.match(rowOf(after, 4).detail, /current invitation already exists/); assert.equal(rowOf(after, 2).action, 'none'); assert.equal(rowOf(after, 11).action, 'none'); assert.equal(rowOf(after, 15).action, 'none'); });
  }
  // An invitation made by the import is an ordinary invitation: createInvite would have made the same shape (account-bound,
  // 72 hours, token hash only), and the account cannot be invited twice while it is pending.
  { const s = state(), file = csv(`New One,${C(50)},asha,Care team,active,`), p = await plan(file, s), r = await apply(s, cmd(p, { csv: file })); const again = await plan(file, s);
    check(() => { const i = s.invitations.find(x => x.accountCode === C(50)); assert.deepEqual(Object.keys(i).sort(), ['accountCode', 'createdAt', 'createdBy', 'expiresAt', 'id', 'label', 'role', 'status', 'teamIds', 'tokenHash'].sort()); assert.equal(again.rows[0].action, 'none'); assert.equal(r.invitations.length, 1); }); }
  // A pending invitation expiring between the dry run and the apply makes the plan stale rather than applying a guess.
  { const s = state(), file = csv(`Pending Same,${C(7)},asha,Care team,active,`); s.invitations.find(i => i.id === 'i1').expiresAt = '2026-10-02T09:02:00.000Z';
    const p = await plan(file, s, undefined, 'synthetic', now); check(() => assert.equal(p.rows[0].action, 'none'));
    const late = await plan(file, s, undefined, 'synthetic', '2026-10-02T09:03:00.000Z'); check(() => { assert.equal(late.rows[0].action, 'invite'); assert.notEqual(late.planHash, p.planHash); });
    await rejects(() => apply(s, cmd(p, { csv: file }), owner(s), {}, '2026-10-02T09:03:00.000Z'), 409, /changed since the dry run/); check(() => assert.equal(s.invitations.length, 3, 'nothing was invited')); }
  // Staff ids on invitations carry to the account once it joins: the record is keyed by account code, not by user.
  { const s = state(), file = csv(`New Two,${C(51)},asha,Care team,active,KGP-0051`), p = await plan(file, s); await apply(s, cmd(p, { csv: file }));
    check(() => { assert.equal(s.operations.staffIds[C(51)].id, 'KGP-0051'); assert.equal(s.invitations.some(i => i.accountCode === C(51)), true); });
    const dup = await plan(csv(`New Three,${C(52)},asha,Care team,active,kgp-0051`), s); check(() => { assert.equal(dup.rows[0].action, 'conflict'); assert.match(dup.rows[0].reasons[0], /already recorded for another account/); }); }
  // A state with no operations record gains one only when a staff id is recorded.
  { const s = state(); delete s.operations; const file = csv(`New Four,${C(53)},asha,Care team,active,`), p = await plan(file, s); await apply(s, cmd(p, { csv: file })); check(() => assert.equal(s.operations, undefined, 'no staff id, no operations record'));
    const withId = csv(`New Five,${C(54)},asha,Care team,active,KGP-0054`), q = await plan(withId, s); await apply(s, cmd(q, { csv: withId })); check(() => assert.equal(s.operations.staffIds[C(54)].id, 'KGP-0054')); }

  // The staff id register is one JSON record, so it is bounded: past the limit a row that would add an id is a conflict.
  { const s = state(); for (let i = 0; i < W.MAX_STAFF_IDS - 3 - 1; i++) s.operations.staffIds[`FILL${i}`] = held(`FILL-${i}`);
    const file = csv(`Cap One,${C(60)},asha,Care team,active,CAP-1`, `Cap Two,${C(61)},asha,Care team,active,CAP-2`, `Cap Three,${C(62)},asha,Care team,active,`), p = await plan(file, s);
    check(() => { assert.equal(Object.keys(s.operations.staffIds).length, W.MAX_STAFF_IDS - 1); assert.deepEqual(p.rows.map(r => r.action), ['invite', 'conflict', 'invite']); assert.match(p.rows[1].reasons[0], /already holds the most external staff ids that this version records \(3,000\)/); assert.equal(p.counts.staffIds, 1); });
    await apply(s, cmd(p, { csv: file })); check(() => { assert.equal(Object.keys(s.operations.staffIds).length, W.MAX_STAFF_IDS); assert.equal(s.invitations.some(i => i.accountCode === C(61)), false, 'the conflict row is not applied at all'); }); }

  // 6. Rejection report: row numbers and reasons only, conflicts listed as Conflict, manifest verified.
  { const rep = await X.rejectionReport(W.workforceReportPlan(gp), { exportId: 'export-1', kind: 'workforce', role: 'clinician', generatedAt: now });
    const verified = await E.verifyExportCsv(rep.csv);
    check(() => { assert.equal(verified.ok, true, JSON.stringify(verified.problems)); assert.equal(verified.sha256, rep.sha256); assert.equal(rep.listed, 7); assert.equal(rep.reconciled, true); assert.ok(X.REJECTION_KINDS.includes('workforce')); });
    check(() => { const lines = rep.csv.split('\r\n'); assert.ok(lines.includes('"Import","workforce-import-v1","workforce"')); assert.ok(lines.includes('"Rows in file","18"')); assert.ok(lines.includes('"Rows accepted","11"')); assert.ok(lines.some(l => l.startsWith('"3","Conflict","Suspended here but active in the roster.'))); assert.equal(lines.some(l => l.startsWith('"1",')), false, 'accepted rows are not listed'); assert.equal(lines.some(l => l.startsWith('"2",')), false); });
    check(() => { for (const x of ['Asha', 'Sup Suspended', 'KGP-', 'kgp-', C(5), C(15), C(14)]) assert.equal(rep.csv.includes(x), false, x); });
    const rb = await X.rejectionReport(W.workforceReportPlan(bp), { exportId: 'export-2', kind: 'workforce', role: 'clinician', generatedAt: now }), vb = await E.verifyExportCsv(rb.csv);
    check(() => { assert.equal(vb.ok, true); assert.equal(rb.listed, 18); assert.equal(rb.reconciled, true); assert.ok(rb.csv.split('\r\n').some(l => l.startsWith('"1","Rejected","Name is required."'))); for (const x of ['Twin', 'DUP-1', C(28), C(29)]) assert.equal(rb.csv.includes(x), false, x); assert.equal(rb.csv.includes('=cmd'), false); }); }

  const result = { suite: 'workforce import contract (slice 10d)', passed, completedAt: new Date().toISOString() };
  writeFileSync('tests/workforce-import-contract-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { rmSync(dir, { recursive: true, force: true }); }
