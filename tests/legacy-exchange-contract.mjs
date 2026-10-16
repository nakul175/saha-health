import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(process.cwd(), '.legacy-exchange-'));
let passed = 0; const failures = [];
const check = async (name, fn) => { try { await fn(); passed++; } catch (e) { failures.push(`${name}: ${e?.stack ?? e}`); } };
const rejects = async (fn, status, re) => { let error; try { await fn(); } catch (e) { error = e; } assert.ok(error, 'expected refusal'); assert.equal(error.status, status); assert.match(error.message, re); };

try {
  for (const source of ['core', 'types', 'programmes', 'adapter-operations', 'mis', 'fact-provenance', 'legacy-exchange']) {
    const js = ts.transpileModule(readFileSync(`lib/saha/${source}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'");
    writeFileSync(join(dir, `${source}.js`), js);
  }
  const L = await import(pathToFileURL(join(dir, 'legacy-exchange.js')));
  const at = '2026-10-16T09:00:00.000Z';
  const auth = (over = {}) => ({ id: 'auth-1', version: 3, active: true, ownerId: 'owner', integrationUserId: 'worker', purpose: 'Send the reviewed monthly programme file', destination: 'District programme', formats: ['csv', 'pdf'], expiresAt: '2026-10-17T09:00:00.000Z', ...over });
  const exportInput = (over = {}) => ({ format: 'csv', destination: 'District programme', purpose: 'Send the reviewed monthly programme file', batchDelayMinutes: 1440, source: { fileName: 'monthly.csv', mediaType: 'text/csv', content: 'id,value\nSYN-1,yes\n' }, ...over });

  await check('prepared export has reconciliation identity, original artefact and delay but no acceptance', async () => {
    const x = await L.prepareLegacyExport(auth(), 'worker', exportInput(), at);
    assert.match(x.reconciliationId, /^LX-/); assert.equal(x.state, 'prepared'); assert.equal(x.receipt, null);
    assert.equal(x.source.content, exportInput().source.content); assert.match(x.source.sha256, /^[a-f0-9]{64}$/);
    assert.equal(x.batchDelayMinutes, 1440); assert.match(x.message, /acceptance is not recorded/i);
  });

  await check('matching dispatch and receipt move through distinct states', async () => {
    const x = await L.prepareLegacyExport(auth(), 'worker', exportInput(), at);
    L.markLegacyDispatched(x, auth(), 'worker', '2026-10-16T09:01:00.000Z');
    assert.equal(x.state, 'dispatched'); assert.equal(x.receipt, null); assert.match(x.message, /acceptance remains uncertain/i);
    L.recordLegacyReceipt(x, { reconciliationId: x.reconciliationId, artefactSha256: x.source.sha256, status: 'accepted', receipt: 'DEST-44' });
    assert.equal(x.state, 'accepted'); assert.equal(x.receipt, 'DEST-44');
  });

  await check('accepted without receipt and mismatched receipt are refused', async () => {
    const x = await L.prepareLegacyExport(auth(), 'worker', exportInput(), at); L.markLegacyDispatched(x, auth(), 'worker');
    await rejects(() => L.recordLegacyReceipt(x, { reconciliationId: x.reconciliationId, artefactSha256: x.source.sha256, status: 'accepted' }), 422, /requires its receipt/);
    await rejects(() => L.recordLegacyReceipt(x, { reconciliationId: 'another', artefactSha256: x.source.sha256, status: 'accepted', receipt: 'R' }), 409, /does not match/);
    assert.equal(x.state, 'dispatched');
  });

  await check('pending outcome remains uncertain and cannot be dispatched twice', async () => {
    const x = await L.prepareLegacyExport(auth(), 'worker', exportInput(), at); L.markLegacyDispatched(x, auth(), 'worker');
    L.recordLegacyReceipt(x, { reconciliationId: x.reconciliationId, artefactSha256: x.source.sha256, status: 'pending' });
    assert.equal(x.state, 'uncertain'); assert.match(x.message, /do not dispatch again/i);
    await rejects(() => L.markLegacyDispatched(x, auth(), 'worker'), 409, /Only a prepared/);
  });

  await check('changed authority at checkpoint blocks disclosure with no dispatched timestamp', async () => {
    const x = await L.prepareLegacyExport(auth(), 'worker', exportInput(), at);
    L.markLegacyDispatched(x, auth({ version: 4 }), 'worker', '2026-10-16T09:02:00.000Z');
    assert.equal(x.state, 'blocked'); assert.equal(x.dispatchedAt, null); assert.match(x.message, /changed after preparation.*Nothing was sent/i);
  });

  await check('wrong user, purpose, destination, format and expired authority are refused before preparation', async () => {
    await rejects(() => L.prepareLegacyExport(auth(), 'reader', exportInput(), at), 403, /not covered/);
    await rejects(() => L.prepareLegacyExport(auth(), 'worker', exportInput({ purpose: 'Different approved programme purpose' }), at), 403, /purpose/);
    await rejects(() => L.prepareLegacyExport(auth(), 'worker', exportInput({ destination: 'Other programme' }), at), 403, /destination/);
    await rejects(() => L.prepareLegacyExport(auth(), 'worker', exportInput({ format: 'hl7-v2' }), at), 403, /format/);
    await rejects(() => L.prepareLegacyExport(auth({ expiresAt: at }), 'worker', exportInput(), at), 403, /inactive or expired/);
  });

  await check('document extraction preserves source, fields and reviewer without becoming authoritative', async () => {
    const x = await L.stageLegacyImport(auth(), 'worker', { format: 'pdf', sourceSystem: 'District archive', purpose: auth().purpose, batchDelayMinutes: 720, source: { fileName: 'report.pdf', mediaType: 'application/pdf', content: 'synthetic-pdf-bytes' }, extractedFields: [{ path: 'patient.syntheticId', value: 'SYN-1', confidence: 0.82 }], reviewerId: 'reviewer' }, at);
    assert.match(x.reconciliationId, /^LI-/); assert.equal(x.source.content, 'synthetic-pdf-bytes'); assert.equal(x.extractedFields.length, 1);
    assert.equal(x.review, null); assert.equal(x.authoritative, false); assert.equal(x.writeback, 'unsupported'); assert.equal(x.destinationReceipt, null);
    await rejects(() => L.reviewLegacyImport(x, 'other', 'reviewed', 'Reviewed against the original source.'), 403, /named reviewer/);
    L.reviewLegacyImport(x, 'reviewer', 'reviewed', 'Reviewed against the original source.');
    assert.equal(x.review.decision, 'reviewed'); assert.equal(x.authoritative, false);
  });

  await check('review races preserve first decision and unsupported writeback stays unavailable', async () => {
    const x = await L.stageLegacyImport(auth(), 'worker', { format: 'pdf', sourceSystem: 'Archive', purpose: auth().purpose, batchDelayMinutes: 60, source: { fileName: 'a.pdf', mediaType: 'application/pdf', content: 'synthetic' }, extractedFields: [], reviewerId: 'reviewer' }, at);
    L.reviewLegacyImport(x, 'reviewer', 'rejected', 'The extraction is incomplete and must be repeated.');
    await rejects(() => L.reviewLegacyImport(x, 'reviewer', 'reviewed', 'Trying to replace the first decision.'), 409, /already has a review/);
    await rejects(() => L.legacyWritebackUnavailable(x), 409, /Writeback is unsupported/);
  });

  if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
  else console.log(`legacy exchange contract: ${passed}/${passed} checks passed`);
} finally { rmSync(dir, { recursive: true, force: true }); }
