import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { readTar } from '../scripts/verify-export.mjs';
// Slice 6m: organisation data export over HTTP and local D1, checked offline by scripts/verify-export.mjs.
const sha = b => createHash('sha256').update(b).digest('hex');
export async function dataExitSmoke({ get, post, check, accounts, org, sql, base }) {
  const { owner: o, worker: w, supervisor: sv, admin: a, clinician: c, stranger: x } = accounts;
  const dir = mkdtempSync(join(tmpdir(), 'saha-data-exit-'));
  const fetchExport = async (who, query = '', orgId = org, status = 200) => {
    const r = await fetch(`${base}/api/data-exit${query}`, { headers: { ...who.headers, 'x-saha-organisation': orgId } });
    const body = Buffer.from(await r.arrayBuffer());
    check(() => assert.equal(r.status, status, body.toString('utf8').slice(0, 300)));
    return { r, body };
  };
  try {
    // Owners only: care roles, supervisors, administrators and non-members are refused.
    for (const who of [w, sv, a, c]) { const { body } = await fetchExport(who, '', org, 403); check(() => assert.match(JSON.parse(body.toString('utf8')).error, /Only an organisation owner/)); }
    await fetchExport(x, '', org, 403);
    await fetchExport(o, '?fhir=yes', org, 422); await fetchExport(o, '?format=zip', org, 422);
    // The owner's export of the shared test organisation, with FHIR documents.
    await get(o, '/api/workspace', 200, org);
    const chainStatus = async orgId => (await fetch(`${base}/api/audit/chain`, { headers: { ...o.headers, 'x-saha-organisation': orgId } })).json();
    // The retention suite inserts an old event without chain fields into this organisation, so the server
    // reports its chain as broken at the genesis seal; the offline verifier must reach the same finding.
    const serverBefore = await chainStatus(org);
    const { r, body } = await fetchExport(o, '?fhir=1');
    const file = join(dir, 'export.tar'); writeFileSync(file, body);
    const files = readTar(body), manifest = JSON.parse(files.get('manifest.json').toString('utf8'));
    check(() => { assert.equal(r.headers.get('content-type'), 'application/x-tar'); assert.match(r.headers.get('content-disposition'), /attachment; filename="saha-organisation-export-\d{4}-\d\d-\d\d-[0-9a-f]{8}\.tar"/); assert.equal(r.headers.get('cache-control'), 'no-store'); assert.equal(r.headers.get('x-saha-content-sha256'), sha(body)); assert.equal(r.headers.get('x-saha-manifest-sha256'), sha(files.get('manifest.json'))); assert.equal(r.headers.get('x-saha-export-id'), manifest.exportId); });
    check(() => { assert.equal(manifest.organisation.id, org); assert.equal(manifest.exporter.userId, o.id); assert.equal(manifest.exporter.owner, true); assert.equal(manifest.environment, 'synthetic'); assert.equal(manifest.auditChain.verification.status, serverBefore.status); assert.deepEqual(manifest.auditChain.verification.firstBreak, serverBefore.firstBreak); });
    // The offline verifier, run as a receiver would, passes every check on the real archive.
    const verify = path => { try { return { code: 0, report: JSON.parse(execFileSync('node', ['scripts/verify-export.mjs', path], { encoding: 'utf8' })) }; } catch (e) { return { code: e.status, report: JSON.parse(e.stdout) }; } };
    const { code, report } = verify(file), failed = report.checks.filter(c => !c.ok).map(c => c.name);
    check(() => { assert.equal(report.exportId, manifest.exportId); for (const name of ['format', 'sha256sums', 'manifest-files', 'totals', 'organisation', 'relationships', 'media', 'fhir']) assert.ok(report.checks.find(c => c.name === name)?.ok, name); });
    check(() => { if (serverBefore.status === 'intact') { assert.equal(code, 0); assert.deepEqual(failed, []); } else { assert.equal(code, 1); assert.deepEqual(failed, ['genesis-seal']); assert.match(serverBefore.firstBreak.reason, /Events without chain fields changed/); assert.match(report.failures[0], /Genesis sealed 0 earlier events; the export has \d+/); } });
    // Contents match the database: exported and withheld patients add up; the owner's visible patients are all present.
    const stored = sql.prepare('SELECT count(*) AS n FROM patients WHERE org_id=?').get(org).n;
    const patients = files.get('tables/patients.jsonl').toString('utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
    check(() => { assert.equal(manifest.scope.patients, stored); assert.equal(manifest.scope.patientsExported + manifest.scope.patientsWithheld, stored); assert.equal(patients.length, manifest.scope.patientsExported); assert.ok(o.state.people.filter(p => !(p.exceptionalAccess ?? []).some(g => g.userId === o.id && !g.closedAt)).every(p => patients.some(q => q.id === p.id))); });
    check(() => { const confirmed = sql.prepare("SELECT count(*) AS n FROM visits WHERE org_id=? AND state='confirmed' AND json_extract(data,'$.voidedAt') IS NULL AND json_extract(data,'$.supersededBy') IS NULL AND json_extract(data,'$.imported') IS NULL AND person_id IN (" + patients.map(() => '?').join(',') + ')').get(org, ...patients.map(p => p.id)).n; assert.ok(confirmed > 0); assert.equal(manifest.fhir.documents, confirmed); assert.equal([...files.keys()].filter(p => p.startsWith('fhir/')).length, confirmed); });
    // Slice 6p (independent review): organisation documents carry only exported patients' entries, and the
    // withheld-entry count matches the stored documents (the same walk as the server, over the database rows).
    const exportedIds = new Set(patients.map(p => p.id)), linkedOut = v => !!v && typeof v === 'object' && !Array.isArray(v) && v.personId != null && !exportedIds.has(String(v.personId));
    const outside = x => Array.isArray(x) ? x.reduce((n, e) => n + (linkedOut(e) ? 1 : outside(e)), 0) : x && typeof x === 'object' ? Object.values(x).reduce((n, v) => n + (linkedOut(v) ? 1 : outside(v)), 0) : 0;
    const docTables = ['integrations', 'operations', 'pilot', 'outreach', 'expansions', 'governance', 'retention'];
    const storedOutside = docTables.reduce((n, t) => n + sql.prepare(`SELECT data FROM ${t} WHERE org_id=?`).all(org).reduce((k, r) => k + outside(JSON.parse(r.data)), 0), 0);
    const archived = docTables.flatMap(t => files.get(`tables/${t}.jsonl`).toString('utf8').split('\n').filter(Boolean).map(l => JSON.parse(JSON.parse(l).data)));
    check(() => { assert.equal(manifest.totals.withheldEntries, storedOutside); assert.equal(manifest.scope.entriesWithheld, storedOutside); assert.equal(archived.reduce((n, d) => n + outside(d), 0), 0, 'no out-of-scope entry in the archive'); assert.equal(manifest.scope.complete, manifest.totals.withheld === 0 && storedOutside === 0); });
    // Secrets and sign-in data are absent: invitation token hashes, account emails, receipt results.
    const text = body.toString('latin1');
    check(() => { const hashes = sql.prepare('SELECT token_hash FROM invitations WHERE org_id=?').all(org).map(r => r.token_hash); assert.ok(hashes.length > 0); assert.ok(hashes.every(h => !text.includes(h))); const accountsOut = files.get('tables/accounts.jsonl').toString('utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)); assert.ok(accountsOut.length > 0 && accountsOut.every(x => !('email' in x) && !('active_org_id' in x)));
      // Where the sign-in service gave no name, the application stored the email as the display name; other emails never appear.
      const emails = sql.prepare('SELECT a.email FROM accounts a JOIN memberships m ON m.user_id=a.user_id WHERE m.org_id=? AND a.display_name<>a.email').all(org).map(r => r.email); assert.ok(emails.length > 0); assert.ok(emails.every(e => !text.includes(e)), 'no account email appears unless it is also the stored display name'); assert.ok(files.get('tables/command_receipts.jsonl').toString('utf8').split('\n').filter(Boolean).every(l => !('result' in JSON.parse(l)))); });
    // The export is recorded in the audit chain with its checksums; the chain still verifies.
    const event = sql.prepare("SELECT detail,seq,hash FROM audit_events WHERE org_id=? AND action='organisationExport' ORDER BY seq DESC LIMIT 1").get(org);
    check(() => { assert.ok(event.detail.includes(manifest.exportId)); assert.ok(event.detail.includes(`archive SHA-256 ${sha(body)}`)); assert.ok(event.detail.includes(`manifest SHA-256 ${sha(files.get('manifest.json'))}`)); assert.equal(event.seq, Math.max(...files.get('tables/audit_events.jsonl').toString('utf8').split('\n').filter(Boolean).map(l => JSON.parse(l).seq ?? -1)) + 1, 'the export event follows the exported chain'); });
    const chain = await chainStatus(org);
    check(() => { assert.equal(chain.status, serverBefore.status); assert.equal(sql.prepare('SELECT count(*) AS n FROM audit_events WHERE org_id=? AND seq IS NOT NULL').get(org).n, files.get('tables/audit_events.jsonl').toString('utf8').split('\n').filter(l => l && JSON.parse(l).seq != null).length + 1, 'the export event is the only chained event after the export'); });
    // A changed byte in the downloaded archive is caught offline.
    const bad = Buffer.from(body); const at = body.indexOf('"org_id"', 4096); bad[at + 2] = bad[at + 2] === 0x6f ? 0x4f : 0x6f; writeFileSync(join(dir, 'bad.tar'), bad);
    check(() => { const r = verify(join(dir, 'bad.tar')); assert.equal(r.code, 1); assert.equal(r.report.checks.find(c => c.name === 'sha256sums').ok, false); });
    // Maintenance pauses commands, not reads: an owner can still export a paused organisation.
    const mine = (await post(o, { type: 'createOrganisation', name: 'Data exit smoke organisation' })).result.organisationId;
    await post(o, { type: 'createPerson', name: `Exit Synthetic ${crypto.randomUUID().slice(0, 6)}`, age: 41, sex: 'Female', village: 'Exit locality', programme: 'General care', teamId: 'default' }, 200, undefined, mine);
    await post(o, { type: 'opsMaintenance', version: 0, active: true, reason: 'Synthetic exit rehearsal pause' }, 200, undefined, mine);
    const paused = await fetchExport(o, '', mine);
    const pausedManifest = JSON.parse(readTar(paused.body).get('manifest.json').toString('utf8')); writeFileSync(join(dir, 'paused.tar'), paused.body);
    const fresh = verify(join(dir, 'paused.tar'));
    check(() => { assert.equal(fresh.code, 0, JSON.stringify(fresh.report.failures)); assert.equal(fresh.report.ok, true); assert.match(fresh.report.checks.find(c => c.name === 'audit-chain').detail, /^\d+ events, head/); assert.equal(pausedManifest.auditChain.verification.status, 'intact'); });
    check(() => { assert.equal(pausedManifest.scope.complete, true); assert.equal(pausedManifest.scope.patientsExported, 1); assert.equal(JSON.parse(readTar(paused.body).get('tables/operations.jsonl').toString('utf8')).data.includes('"maintenance":true'), true); });
    await post(o, { type: 'opsMaintenance', version: 1, active: false, reason: 'Synthetic exit rehearsal complete' }, 200, undefined, mine);
    // Later suites (the recovery drill) expect the owner's active organisation to be the shared one.
    await post(o, { type: 'switchOrganisation', organisationId: org });
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
