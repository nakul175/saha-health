import assert from 'node:assert/strict';
import { globSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { readTar, verifyFiles } from '../scripts/verify-export.mjs';
import { createBackup, restoreBackup } from '../scripts/recovery.mjs';
// Slice 14f: disposal execution through the built Worker and local D1, in its own synthetic organisation so the shared test
// organisation keeps every record: a schedule that allows disposal, a dry-run plan by one owner, refusals (other roles, the
// preparing owner, a wrong hash, a stale plan, a replayed key with other input), the apply by a second owner, what remains
// (tombstones, audit chain, receipts), media playback, the register download, the data exit, and a backup taken before the
// disposal restored with and without the downloaded register.
export async function disposalSmoke({ get, post, check, sql, base }) {
  const run = crypto.randomUUID().slice(0, 8);
  const account = label => ({ id: `disp-${run}-${label}`, headers: { 'oai-authenticated-user-id': `disp-${run}-${label}`, 'oai-authenticated-user-email': `${label}@example.invalid`, 'oai-authenticated-user-full-name': `Disposal%20${label}`, 'oai-authenticated-user-full-name-encoding': 'percent-encoded-utf-8' }, state: null });
  const o1 = account('owner'), o2 = account('second-owner'), asha = account('asha'), adm = account('admin'), stranger = account('stranger');
  for (const a of [o1, o2, asha, adm, stranger]) await get(a);
  const org = o1.state.organisation.id, cmd = (who, body, status = 200, key) => post(who, body, status, key ?? crypto.randomUUID(), org);
  for (const [who, role, teamIds] of [[o2, 'clinician', ['default']], [asha, 'asha', ['default']], [adm, 'admin', []]]) {
    const inv = (await cmd(o1, { type: 'createInvite', accountCode: who.state.user.accountCode, label: `Disposal ${role}`, role, teamIds })).result;
    await post(who, { type: 'joinOrganisation', token: inv.token });
  }
  await get(o1, '/api/workspace', 200, org);
  const m2 = o1.state.members.find(m => m.userId === o2.id);
  await cmd(o1, { type: 'updateMember', userId: o2.id, version: m2.version, role: 'clinician', teamIds: ['default'], isOwner: true, status: 'active', reason: 'Second owner for disposal approval' });
  const raw = async (who, path) => { const r = await fetch(base + path, { headers: { ...who.headers, 'x-saha-organisation': org } }); return { r, body: Buffer.from(await r.arrayBuffer()) }; };
  const view = async who => { const { r, body } = await raw(who, '/api/retention'); check(() => assert.equal(r.status, 200, body.toString().slice(0, 200))); return JSON.parse(body.toString()); };
  const count = (table, extra = '', ...b) => sql.prepare(`SELECT count(*) AS n FROM ${table} WHERE org_id=?${extra}`).get(org, ...b).n;

  // Synthetic records: Meena last active in 2010 (disposable), Sunita too but held, Rajesh recent with a photo from 2011.
  const visitId = (await cmd(o1, { type: 'startVisit', personId: 'p_rajesh' })).result.visitId;
  const png = new Uint8Array(2048); png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); for (let i = 8; i < png.length; i++) png[i] = (i * 3) % 251;
  const up = await fetch(`${base}/api/media?visitId=${encodeURIComponent(visitId)}&purpose=wound-or-skin`, { method: 'POST', headers: { ...o1.headers, 'Content-Type': 'image/png', 'Idempotency-Key': crypto.randomUUID(), 'x-saha-organisation': org }, body: png });
  const mediaId = (await up.json()).mediaId; check(() => assert.equal(up.status, 200));
  const OLD = '2010-01-01T00:00:00.000Z', OLDV = '2011-03-01T00:00:00.000Z';
  for (const id of ['p_meena', 'p_sunita']) sql.prepare("UPDATE patients SET data=json_set(data,'$.createdAt',?) WHERE org_id=? AND id=?").run(OLD, org, id);
  sql.prepare("UPDATE visits SET data=json_set(data,'$.media[0].at',?) WHERE org_id=? AND id=?").run(OLDV, org, visitId);
  sql.prepare('UPDATE media SET created_at=? WHERE org_id=? AND id=?').run(OLDV, org, mediaId);
  const rules = [['patient-record', 10, true], ['programme-receipt', 10], ['audit-event', 10], ['outreach-message', 10], ['rights-request', 10], ['field-package', 10], ['visit-media', 5, true]].map(([recordClass, years, dispose]) => dispose ? { recordClass, years, dispose } : { recordClass, years });
  await cmd(o1, { type: 'retentionPolicySet', rules: rules.map(r => r.recordClass === 'audit-event' ? { ...r, dispose: true } : r), basis: 'Synthetic placeholder schedule for the disposal test' }, 422);
  await cmd(o1, { type: 'retentionPolicySet', rules, basis: 'Synthetic placeholder schedule for the disposal test' });
  await cmd(o1, { type: 'retentionHoldPlace', scope: 'person', personId: 'p_sunita', reason: 'Synthetic legal matter for this patient', reference: 'CASE-14F' });
  let v = await view(o1);
  check(() => { assert.equal(v.review.length, 7); assert.equal(v.review.find(r => r.recordClass === 'visit-media').disposal, 'dispose'); assert.equal(v.review.find(r => r.recordClass === 'audit-event').disposal, 'review only'); assert.match(v.disposal, /second owner/); assert.match(v.disposal, /placeholders/); });

  // Prepare: owners only; a dry run with identifiers and counts, nothing disposed.
  for (const who of [asha, adm]) await cmd(who, { type: 'disposalPrepare' }, 403);
  await post(stranger, { type: 'disposalPrepare' }, 403, crypto.randomUUID(), org);
  const plan = (await cmd(o1, { type: 'disposalPrepare' })).result;
  check(() => {
    assert.deepEqual(plan.items.filter(i => i.table === 'patients').map(i => i.id), ['p_meena']); assert.deepEqual(plan.items.filter(i => i.recordClass === 'visit-media').map(i => i.id), [mediaId]);
    assert.equal(plan.counts.patients, 1); assert.equal(plan.counts.visitMedia, 1); assert.equal(plan.excluded.held, 1); assert.match(plan.planHash, /^[0-9a-f]{64}$/);
    assert.ok(!JSON.stringify(plan).includes('Meena'), 'identifiers and counts only'); assert.equal(count('patients', ' AND id=?', 'p_meena'), 1);
  });
  await cmd(o2, { type: 'disposalPrepare' }, 409);

  // A backup taken now, before the disposal.
  const dir = mkdtempSync(join(tmpdir(), 'saha-disposal-')), pass = randomBytes(24).toString('hex'), backup = join(dir, 'before.sahabackup');
  try {
    const source = globSync('.wrangler/test-state/v3/d1/**/*.sqlite').find(p => !p.endsWith('/metadata.sqlite'));
    await createBackup(source, backup, pass);

    // Apply: refused to the preparing owner, other roles, a wrong hash and a stale plan; a key reused for other input is refused.
    const ok = { type: 'disposalApply', batchId: plan.batchId, planHash: plan.planHash };
    await cmd(o1, ok, 403); await cmd(asha, ok, 403); await cmd(adm, ok, 403);
    await cmd(o2, { ...ok, planHash: 'a'.repeat(64) }, 409);
    const hold = (await cmd(o2, { type: 'retentionHoldPlace', scope: 'person', personId: 'p_meena', reason: 'Synthetic matter placed after the plan', reference: 'CASE-14F-2' })).result;
    const stale = await cmd(o2, ok, 409); check(() => { assert.match(stale.error, /changed since it was prepared/); assert.equal(count('patients', ' AND id=?', 'p_meena'), 1); assert.equal(count('disposals'), 0); });
    await cmd(o2, { type: 'retentionHoldRelease', holdId: hold.holdId, reason: 'Synthetic matter closed again' });
    const revisions = sql.prepare('SELECT id FROM record_revisions WHERE org_id=? AND person_id=? ORDER BY id').all(org, 'p_meena').map(r => r.id), receipts = count('command_receipts');
    const auditIds = () => sql.prepare('SELECT id FROM audit_events WHERE org_id=?').all(org).map(r => r.id), audit = auditIds();
    const key = crypto.randomUUID(), applied = (await cmd(o2, ok, 200, key)).result;
    const replay = await cmd(o2, ok, 200, key); check(() => { assert.equal(replay.replayed, true); assert.deepEqual(replay.result, applied); });
    await cmd(o2, { ...ok, planHash: 'b'.repeat(64) }, 409, key);
    await cmd(o2, ok, 409);

    // What remains: no patient record, tombstoned revisions, erased media, intact audit chain and receipts, the register.
    check(() => {
      assert.equal(count('patients', ' AND id=?', 'p_meena'), 0); assert.equal(count('patients'), 5);
      const rows = sql.prepare('SELECT id,data,changes FROM record_revisions WHERE org_id=? AND person_id=? ORDER BY id').all(org, 'p_meena');
      assert.deepEqual(rows.map(r => r.id), revisions); assert.ok(rows.every(r => JSON.parse(r.data).disposed === true && r.changes === '[]'));
      const now = new Set(auditIds()); assert.ok(audit.every(id => now.has(id)), 'no audit event removed'); assert.equal(count('audit_events', " AND action='disposalApply'"), 1); assert.ok(count('audit_events', ' AND person_id=?', 'p_meena') >= 1, 'events about the disposed patient remain'); assert.equal(count('command_receipts'), receipts + 1);
      assert.equal(sql.prepare('SELECT data FROM media WHERE org_id=? AND id=?').get(org, mediaId).data, '');
      assert.equal(count('disposals'), applied.register.entries); assert.equal(applied.counts.patients, 1);
    });
    const chain = await (await fetch(`${base}/api/audit/chain`, { headers: { ...o1.headers, 'x-saha-organisation': org } })).json();
    check(() => assert.equal(chain.status, 'intact', JSON.stringify(chain.firstBreak)));
    await get(o1, '/api/workspace', 200, org);
    check(() => { assert.ok(!o1.state.people.some(p => p.id === 'p_meena')); const ref = o1.state.visits.find(x => x.id === visitId).media[0]; assert.ok(ref.removedAt); assert.equal(ref.disposal.batch, plan.batchId); });
    const played = await raw(o1, `/api/media/${mediaId}?organisationId=${encodeURIComponent(org)}`);
    check(() => { assert.equal(played.r.status, 410); assert.match(JSON.parse(played.body.toString()).error, /disposed under the retention schedule/); });
    await get(o1, '/api/history?personId=p_meena', 404, org);
    v = await view(o2); check(() => { assert.equal(v.disposals[0].state, 'applied'); assert.equal(v.disposals[0].register.entries, applied.register.entries); assert.equal(v.holds.find(h => h.id === hold.holdId).personName, 'Disposed record'); });

    // The register download: owners only, recorded in the audit chain.
    for (const who of [asha, adm]) { const { r } = await raw(who, '/api/retention/disposal-register'); check(() => assert.equal(r.status, 403)); }
    const reg = await raw(o1, '/api/retention/disposal-register'), register = JSON.parse(reg.body.toString());
    check(() => { assert.equal(reg.r.status, 200); assert.equal(register.format, 'saha-disposal-register-v1'); assert.equal(register.entries.length, applied.register.entries); assert.equal(register.verification.ok, true); assert.equal(register.head.hash, applied.register.head); assert.ok(!reg.body.toString().includes('Meena')); assert.equal(count('audit_events', " AND action='disposalRegisterExport'"), 1); });

    // The data exit marks disposed records; the offline verifier passes, including the register check.
    const ex = await raw(o1, '/api/data-exit'), files = readTar(ex.body), report = verifyFiles(files), manifest = JSON.parse(files.get('manifest.json').toString());
    check(() => { assert.equal(ex.r.status, 200); assert.equal(report.ok, true, JSON.stringify(report.failures)); assert.ok(report.checks.find(c => c.name === 'disposal-register').ok); assert.equal(manifest.disposal.registerEntries, applied.register.entries); assert.equal(manifest.disposal.disposedPatientsInScope, 1); assert.ok(!files.get('tables/patients.jsonl').toString().includes('p_meena')); });

    // Restore the earlier backup: with the register nothing disposed comes back; without it, the patient would.
    const regFile = join(dir, 'register.json'); writeFileSync(regFile, reg.body);
    const withReg = await restoreBackup(backup, join(dir, 'with.sqlite'), pass, { registers: [regFile] }), without = await restoreBackup(backup, join(dir, 'without.sqlite'), pass);
    const restored = new DatabaseSync(join(dir, 'with.sqlite'), { readOnly: true }), revived = new DatabaseSync(join(dir, 'without.sqlite'), { readOnly: true });
    check(() => {
      assert.equal(withReg.disposalRegister.reapplied, applied.register.entries); assert.equal(without.disposalRegister, 'not applied');
      assert.equal(restored.prepare('SELECT count(*) AS n FROM patients WHERE org_id=? AND id=?').get(org, 'p_meena').n, 0); assert.equal(revived.prepare('SELECT count(*) AS n FROM patients WHERE org_id=? AND id=?').get(org, 'p_meena').n, 1);
      assert.equal(restored.prepare("SELECT data FROM media WHERE org_id=? AND id=?").get(org, mediaId).data, '');
      assert.ok(restored.prepare('SELECT data FROM record_revisions WHERE org_id=? AND person_id=?').all(org, 'p_meena').every(r => JSON.parse(r.data).disposed === true));
      assert.equal(restored.prepare('SELECT count(*) AS n FROM disposals WHERE org_id=?').get(org).n, applied.register.entries);
    });
    restored.close(); revived.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
