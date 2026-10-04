// Slice 7b transfer contract: care-context linking, encrypted consent-bound transfer, tamper detection and review.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(process.cwd(), '.abdm-transfer-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const rejects = async (fn, code) => { try { await fn(); } catch (e) { assert.equal(e.status, code, e.message); passed++; return e; } assert.fail(`expected ${code}`); };
try {
  for (const f of ['abdm', 'abdm-transfer', 'access', 'action-plan', 'adapter-operations', 'agent', 'agent-minimisation', 'ai-budget', 'alerts', 'anaemia', 'audit-chain', 'capability-lifecycle', 'caseload', 'consent', 'continuity', 'core', 'delegation', 'ehr', 'environment', 'evaluation', 'exceptional', 'expansion', 'facility-scope', 'fact-provenance', 'fhir', 'fhir-document', 'fhir-validate', 'field', 'field-device', 'field-registration', 'governance', 'household', 'household-constants', 'household-visit', 'household-visit-constants', 'identity', 'imported-visits', 'media', 'merge', 'mis', 'operations', 'outreach', 'pack-installation', 'partition', 'pilot', 'programme-commands', 'programmes', 'provider-sandbox', 'purpose-scope', 'referral-needs', 'referral-request', 'referral-rules', 'retention', 'rights', 'seed', 'send-gate', 'service-identity', 'shadow', 'store', 'task-limits', 'types', 'withdrawal-notices'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const t = await import(pathToFileURL(join(dir, 'abdm-transfer.js')));
  const A = await import(pathToFileURL(join(dir, 'abdm.js')));
  const F = await import(pathToFileURL(join(dir, 'fhir.js')));
  const now = '2026-09-30T06:00:00.000Z';
  const member = (userId, role, over = {}) => ({ userId, displayName: userId, accountCode: 'X', role, isOwner: false, status: 'active', version: 1, teamIds: ['t1'], createdAt: now, ...over });
  const facts = date => ({ date, systolic: '120', diastolic: '80', weight: '60', temperature: '', weeks: '', coughDays: '', notes: 'Synthetic', source: 'measured' });
  const visit = (id, date, state = 'confirmed') => ({ id, personId: 'p1', version: 2, state, facts: facts(date), createdAt: date + ':00.000Z', confirmedAt: date + ':30.000Z', aiResults: [], recordVersion: 1 });
  const s = { organisation: { id: 'org' }, teams: [], invitations: [], members: [member('own', 'clinician', { isOwner: true }), member('doc', 'clinician'), member('asha', 'asha')],
    workspace: { role: 'clinician', audit: [], submissions: [], referrals: [], people: [{ id: 'p1', name: 'Transfer Synthetic', age: 34, sex: 'Female', village: 'Synthetic', programmes: ['General care'], task: 'Visit', due: 'Today', status: 'due', aiConsent: false, exchangeConsent: true, consentVersion: 1, assigned: true, createdAt: now, version: 1, teamId: 't1', assignedTo: 'asha' }],
      visits: [visit('v-in', '2026-05-01T09:00'), visit('v-old', '2025-03-01T09:00'), visit('v-draft', '2026-06-01T09:00', 'draft')],
      integrations: [{ id: 'abdm', name: 'ABDM', kind: 'abdm', mode: 'unconfigured', status: 'unconfigured', version: 1, description: '', programmes: [] }] } };
  const P = () => s.workspace.people[0], M = id => s.members.find(m => m.userId === id);
  const run = (userId, cmd) => { s.workspace.role = M(userId).role; return t.applyTransfer(s, cmd, { userId, displayName: userId, email: 'x' }, M(userId), now); };
  const abdm = (userId, cmd) => { s.workspace.role = M(userId).role; return A.applyAbdm(s, cmd, { userId, displayName: userId, email: 'x' }, M(userId), now); };
  const cfg = hip => abdm('own', { type: 'abdmConfigure', environment: 'mock', modules: { abha: true, hip, hiu: true }, facilityId: 'SYN-FAC', approvals: [{ module: 'abha', reference: 'A-1' }, { module: 'hiu', reference: 'H-1' }, ...(hip ? [{ module: 'hip', reference: 'P-1' }] : [])], reason: 'Synthetic mock configuration' });
  cfg(false);
  await rejects(() => run('asha', { type: 'abdmCareContextLink', personId: 'p1', version: P().version, visitIds: ['v-in'] }), 403);
  await rejects(() => run('doc', { type: 'abdmCareContextLink', personId: 'p1', version: P().version, visitIds: ['v-in'] }), 409);
  cfg(true);
  await rejects(() => run('doc', { type: 'abdmCareContextLink', personId: 'p1', version: P().version, visitIds: ['v-in'] }), 409);
  abdm('asha', { type: 'abhaLink', personId: 'p1', version: P().version, abhaNumber: '91-0000-1111-2222', otp: A.MOCK_OTP });
  await rejects(() => run('doc', { type: 'abdmCareContextLink', personId: 'p1', version: P().version, visitIds: ['v-draft'] }), 422);
  const linked = await run('doc', { type: 'abdmCareContextLink', personId: 'p1', version: P().version, visitIds: ['v-in', 'v-old'] });
  check(() => { assert.equal(linked.linked, 2); assert.deepEqual(P().careContexts.map(c => c.recordDate), ['2026-05-01', '2025-03-01']); });
  await rejects(() => run('doc', { type: 'abdmCareContextLink', personId: 'p1', version: P().version, visitIds: ['v-in'] }), 409);
  const cid = abdm('doc', { type: 'abdmConsentRequest', personId: 'p1', version: P().version, purpose: 'CAREMGT', hiTypes: ['OPConsultation'], from: '2026-01-01', to: '2026-09-30', expiresAt: '2026-10-30T00:00:00.000Z' }).consentId;
  await rejects(() => run('doc', { type: 'abdmFetch', personId: 'p1', version: P().version, consentId: cid }), 409);
  abdm('own', { type: 'abdmConsentDecide', personId: 'p1', consentId: cid, decision: 'GRANTED' });
  const got = await run('doc', { type: 'abdmFetch', personId: 'p1', version: P().version, consentId: cid });
  check(() => { assert.equal(got.entries, 1, 'only the care context inside the consent date range'); const r = P().abdmReceived[0]; assert.equal(r.state, 'review'); assert.equal(r.recordDate, '2026-05-01'); const v0 = s.workspace.visits[0], entries = r.bundle.entry.map(e => e.resource); assert.equal(r.bundle.type, 'document'); assert.equal(entries[0].resourceType, 'Composition', 'slice 7c: the HIP sends a FHIR document, Composition first'); assert.equal(entries.find(x => x.resourceType === 'Patient').id, 'p1'); assert.equal(String(entries.find(x => x.resourceType === 'Observation' && x.code.coding[0].code === '29463-7').valueQuantity.value), String(v0.facts.weight), 'decrypted document carries the visit weight'); assert.equal(r.validation.ruleset, 'saha-fhir-r4-document-structure', 'received entries carry the validation stamp'); assert.equal(P().abdmTransfers[0].state, 'delivered'); });
  // Crypto: a different HIU key cannot read the payload; tampering is detected.
  const pair = () => crypto.subtle.generateKey({ name: 'X25519' }, true, ['deriveBits']);
  const b64 = b => Buffer.from(b).toString('base64');
  const hiu = await pair(), nonce = crypto.getRandomValues(new Uint8Array(32));
  const payload = await t.mockHip(P(), s, cid, { publicKey: b64(await crypto.subtle.exportKey('raw', hiu.publicKey)), nonce: b64(nonce) }, now);
  check(() => { assert.equal(payload.entries.length, 1); assert.doesNotMatch(Buffer.from(payload.entries[0].content, 'base64').toString('latin1'), /Transfer Synthetic/, 'content is encrypted'); });
  const ok = await t.receive(hiu.privateKey, nonce, payload);
  check(() => assert.equal(ok[0].bundle.resourceType, 'Bundle'));
  const other = await pair();
  await rejects(() => t.receive(other.privateKey, nonce, payload), 502);
  const flipped = Buffer.from(payload.entries[0].content, 'base64'); flipped[5] ^= 1;
  await rejects(() => t.receive(hiu.privateKey, nonce, { ...payload, entries: [{ ...payload.entries[0], content: flipped.toString('base64') }] }), 502);
  await rejects(() => t.receive(hiu.privateKey, nonce, { ...payload, entries: [{ ...payload.entries[0], checksum: 'AAAA' }] }), 502);
  // Slice 7c: a deliberate violation in the HIP document (negative weight) is refused with the rule set and reason before encryption; nothing is stored.
  const vIn = s.workspace.visits[0], keepWeight = vIn.facts.weight, beforeT = P().abdmTransfers.length, beforeR = P().abdmReceived.length; vIn.facts.weight = '-5';
  const bad = await rejects(() => run('doc', { type: 'abdmFetch', personId: 'p1', version: P().version, consentId: cid }), 422);
  check(() => { assert.match(bad.message, /saha-fhir-r4-document-structure 1\.1\.0: Observation units or values/); assert.equal(P().abdmTransfers.length, beforeT); assert.equal(P().abdmReceived.length, beforeR); });
  vIn.facts.weight = keepWeight;
  // Review, then revocation and relinking stop further transfers.
  const rid = P().abdmReceived[0].id;
  check(() => assert.equal(t.transferSchema.safeParse({ type: 'abdmReceivedReview', personId: 'p1', version: 1, recordId: rid, decision: 'accepted', note: 'ok' }).success, false, 'a review note is required'));
  await run('doc', { type: 'abdmReceivedReview', personId: 'p1', version: P().version, recordId: rid, decision: 'accepted', note: 'Matches the patient and date' });
  check(() => { assert.equal(P().abdmReceived[0].state, 'accepted'); assert.equal(P().abdmReceived[0].reviewedBy, 'doc'); });
  await rejects(() => run('doc', { type: 'abdmReceivedReview', personId: 'p1', version: P().version, recordId: rid, decision: 'rejected', note: 'Second review attempt' }), 409);
  abdm('asha', { type: 'abhaUnlink', personId: 'p1', version: P().version, reason: 'Wrong ABHA recorded earlier' });
  await rejects(() => run('doc', { type: 'abdmFetch', personId: 'p1', version: P().version, consentId: cid }), 409);
  abdm('asha', { type: 'abhaLink', personId: 'p1', version: P().version, abhaNumber: '91-3333-4444-5555', otp: A.MOCK_OTP });
  const cid2 = abdm('doc', { type: 'abdmConsentRequest', personId: 'p1', version: P().version, purpose: 'CAREMGT', hiTypes: ['OPConsultation'], from: '2025-01-01', to: '2026-09-30', expiresAt: '2026-10-30T00:00:00.000Z' }).consentId;
  abdm('own', { type: 'abdmConsentDecide', personId: 'p1', consentId: cid2, decision: 'GRANTED' });
  const none = await run('doc', { type: 'abdmFetch', personId: 'p1', version: P().version, consentId: cid2 });
  check(() => { assert.equal(none.entries, 0, 'care contexts linked to the earlier ABHA are not shared'); assert.match(P().abdmTransfers.at(-1).message, /No care context/); });
  check(() => { const r = A.redactAbha(P()); assert.ok(r.abdmReceived.every(x => !('bundle' in x))); assert.ok(r.careContexts.every(c => c.abhaNumber.includes('XXXX'))); });
  const result = { suite: 'ABDM transfer contract (slice 7b)', passed, completedAt: new Date().toISOString() };
  writeFileSync('tests/abdm-transfer-contract-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { rmSync(dir, { recursive: true, force: true }); }
