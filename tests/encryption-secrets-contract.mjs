// SAHA-126 / BR-SEC-05 local encryption and secret-custody controls.
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { DatabaseSync } from 'node:sqlite';
import { runSecurityMaterialAudit } from '../scripts/security-material-audit.mjs';
import { createBackup, restoreBackup } from '../scripts/recovery.mjs';
import { derive, seal, sealBytes, unseal, unsealBytes } from '../public/field/vault.js';

if (!globalThis.crypto) globalThis.crypto = webcrypto;
const temp = mkdtempSync(join(process.cwd(), '.encryption-secrets-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const checkAsync = async fn => { await fn(); passed++; };
const digest = value => createHash('sha256').update(value).digest('hex');

try {
  const compiled = ts.transpileModule(readFileSync('lib/saha/secrets.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  writeFileSync(join(temp, 'secrets.mjs'), compiled);
  const S = await import(pathToFileURL(join(temp, 'secrets.mjs')));
  const NOW = '2026-10-20T00:00:00.000Z';
  const records = [{ binding: 'SAHA_MIS_TOKEN', owner: 'security-operations', rotatedAt: '2026-10-01T00:00:00.000Z', rotateBy: '2027-01-01T00:00:00.000Z' }, { binding: 'SAHA_MIS_CALLBACK', owner: 'integration-operations', rotatedAt: '2026-10-01T00:00:00.000Z', rotateBy: '2027-01-01T00:00:00.000Z' }];
  const env = { SAHA_MIS_CONNECTIONS: JSON.stringify([{ credentialBinding: 'SAHA_MIS_TOKEN', callbackBinding: 'SAHA_MIS_CALLBACK' }]), SAHA_SECRET_ROTATION_RECORDS: JSON.stringify(records) };

  check(() => assert.deepEqual(S.requiredServerSecretBindings(env), ['SAHA_MIS_CALLBACK', 'SAHA_MIS_TOKEN']));
  check(() => assert.deepEqual(S.secretRotationRecords(env), { ok: true, records }));
  check(() => { const result = S.secretRotationChecks(env, NOW); assert.equal(result.length, 2); assert.ok(result.every(x => x.status === 'ok')); assert.deepEqual(Object.keys(result[0]).sort(), ['binding', 'message', 'owner', 'rotateBy', 'rotatedAt', 'status']); });
  check(() => assert.match(S.secretRotationChecks({ SAHA_MIS_CONNECTIONS: env.SAHA_MIS_CONNECTIONS }, NOW)[0].message, /no owner and rotation record/));
  check(() => assert.match(S.secretRotationChecks({ ...env, SAHA_SECRET_ROTATION_RECORDS: JSON.stringify([{ ...records[0], rotateBy: NOW }, records[1]]) }, NOW).find(x => x.binding === 'SAHA_MIS_TOKEN').message, /past its rotateBy date/));
  check(() => assert.match(S.secretRotationChecks({ ...env, SAHA_SECRET_ROTATION_RECORDS: JSON.stringify([{ ...records[0], rotatedAt: '2026-11-01T00:00:00.000Z' }, records[1]]) }, NOW).find(x => x.binding === 'SAHA_MIS_TOKEN').message, /future rotatedAt/));
  check(() => assert.equal(S.secretRotationChecks(env, '2027-01-02T00:00:00.000Z').every(x => x.status === 'error'), true, 'a stale review cannot be reused after rotateBy'));
  check(() => assert.match(S.secretRotationRecords({ SAHA_SECRET_ROTATION_RECORDS: JSON.stringify([{ ...records[0], value: 'must-not-be-accepted' }]) }).error, /may contain/));
  check(() => assert.match(S.secretRotationRecords({ SAHA_SECRET_ROTATION_RECORDS: JSON.stringify([records[0], records[0]]) }).error, /repeats binding/));
  check(() => assert.match(S.secretRotationRecords({ SAHA_SECRET_ROTATION_RECORDS: '{' }).error, /not valid JSON/));

  await checkAsync(async () => {
    const key = await derive('synthetic-passphrase-123', new Uint8Array(16).fill(7)), sealed = await seal(key, { personId: 'synthetic-person', note: 'private' });
    assert.equal(JSON.stringify(sealed).includes('private'), false); assert.deepEqual(await unseal(key, sealed), { personId: 'synthetic-person', note: 'private' });
    await assert.rejects(unseal(await derive('different-passphrase-456', new Uint8Array(16).fill(7)), sealed));
  });
  await checkAsync(async () => {
    const source = join(temp, 'source.sqlite'), backup = join(temp, 'snapshot.sahabackup'), restored = join(temp, 'restored.sqlite'), passphrase = 'synthetic-backup-passphrase-123';
    const db = new DatabaseSync(source); db.exec("CREATE TABLE records(id TEXT PRIMARY KEY, note TEXT); INSERT INTO records VALUES('one','private synthetic record')"); db.close();
    await createBackup(source, backup, passphrase);
    assert.equal(readFileSync(backup, 'utf8').includes('private synthetic record'), false);
    await assert.rejects(restoreBackup(backup, join(temp, 'wrong.sqlite'), 'wrong-synthetic-passphrase'));
    const receipt = await restoreBackup(backup, restored, passphrase); assert.equal(receipt.verified, true);
    const restoredDb = new DatabaseSync(restored, { readOnly: true }); assert.equal(restoredDb.prepare('SELECT note FROM records').get().note, 'private synthetic record'); restoredDb.close();
    await assert.rejects(restoreBackup(backup, restored, passphrase), /already exists/);
  });
  await checkAsync(async () => {
    const key = await derive('synthetic-media-key-123', new Uint8Array(16).fill(9)), bytes = new TextEncoder().encode('synthetic media bytes'), sealed = await sealBytes(key, bytes);
    assert.equal(new TextDecoder().decode(sealed.cipher).includes('synthetic media bytes'), false); assert.deepEqual(await unsealBytes(key, sealed), bytes);
    sealed.cipher[0] ^= 1; await assert.rejects(unsealBytes(key, sealed));
  });

  const review = join(temp, 'review'); mkdirSync(review);
  for (const name of ['bundle.js', 'configuration.json', 'worker.log', 'model-context.json']) writeFileSync(join(review, name), 'safe synthetic material\n');
  const secret = 'synthetic-provider-secret-4f1c', plan = { version: 1, records: [{ ...records[0], sha256: digest(secret) }], targets: [{ kind: 'client-bundle', path: 'bundle.js' }, { kind: 'configuration-export', path: 'configuration.json' }, { kind: 'log', path: 'worker.log' }, { kind: 'model-context', path: 'model-context.json' }] };
  writeFileSync(join(review, 'plan.json'), JSON.stringify(plan));
  check(() => { const result = runSecurityMaterialAudit('plan.json', review, NOW); assert.equal(result.ok, true); assert.equal(JSON.stringify(result).includes(secret), false); assert.equal(result.targets.length, 4); });
  for (const target of plan.targets) {
    check(() => {
      const path = join(review, target.path), prior = readFileSync(path, 'utf8'); writeFileSync(path, `${prior}${secret}\n`);
      const result = runSecurityMaterialAudit('plan.json', review, NOW); writeFileSync(path, prior);
      assert.equal(result.ok, false); assert.deepEqual(result.findings.map(x => [x.binding, x.kind, x.path]), [['SAHA_MIS_TOKEN', target.kind, target.path]]); assert.equal(JSON.stringify(result).includes(secret), false);
    });
  }
  check(() => { const bad = { ...plan, secret }; writeFileSync(join(review, 'bad.json'), JSON.stringify(bad)); assert.throws(() => runSecurityMaterialAudit('bad.json', review, NOW), /unsupported top-level field/); });
  check(() => { const bad = { ...plan, targets: plan.targets.slice(0, 3) }; writeFileSync(join(review, 'missing.json'), JSON.stringify(bad)); assert.throws(() => runSecurityMaterialAudit('missing.json', review, NOW), /model-context target is required/); });
  check(() => { const bad = structuredClone(plan); bad.records[0].rotateBy = NOW; writeFileSync(join(review, 'expired.json'), JSON.stringify(bad)); assert.throws(() => runSecurityMaterialAudit('expired.json', review, NOW), /future-dated or expired/); });
  check(() => { const source = readFileSync('lib/saha/environment-server.ts', 'utf8'); assert.match(source, /if\(!m\.isOwner\)fail\(403/); assert.match(source, /configurationReport\(rawRuntime\(\),s\)/); });
  check(() => { const source = readFileSync('lib/saha/environment.ts', 'utf8'); assert.match(source, /no secret value is read into this report/); assert.match(source, /secretRotationChecks/); });
  check(() => { const source = readFileSync('scripts/recovery.mjs', 'utf8'); assert.match(source, /aes-256-gcm/i); assert.match(source, /0o600/); assert.match(source, /overwrite is prohibited/i); });
  check(() => { const source = readFileSync('public/field/vault.js', 'utf8'); assert.match(source, /AES-GCM/); assert.match(source, /revision/); assert.match(source, /media:/); });

  const result = { suite: 'SAHA-126 encryption and secrets contract', passed, completedAt: new Date().toISOString() };
  writeFileSync('tests/encryption-secrets-contract-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { rmSync(temp, { recursive: true, force: true }); }
