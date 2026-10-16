// Slice 2b media contract: type allowlist, content signatures, size bounds, purposes and encoding.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(process.cwd(), '.media-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const status = (fn, code) => { try { fn(); } catch (e) { assert.equal(e.status, code, e.message); return e; } assert.fail(`expected ${code}`); };
try {
  for (const f of ['abdm', 'abdm-transfer', 'access', 'action-plan', 'adapter-operations', 'agent', 'agent-minimisation', 'ai-budget', 'alerts', 'anaemia', 'audit-chain', 'capability-lifecycle', 'caseload', 'consent', 'continuity', 'core', 'delegation', 'ehr', 'environment', 'evaluation', 'exceptional', 'expansion', 'facility-scope', 'fact-provenance', 'fhir-document', 'fhir-validate', 'field', 'field-registration', 'governance', 'household', 'household-constants', 'household-visit', 'household-visit-constants', 'identity', 'imported-visits', 'media', 'merge', 'mis', 'operations', 'outreach', 'pack-installation', 'partition', 'pilot', 'programme-commands', 'programmes', 'provider-sandbox', 'purpose-scope', 'referral-needs', 'referral-request', 'referral-rules', 'retention', 'rights', 'seed', 'send-gate', 'service-identity', 'shadow', 'store', 'task-limits', 'types'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const x = await import(pathToFileURL(join(dir, 'media.js')));
  const file = (head, size = 2048) => { const b = new Uint8Array(size); b.set(head); return b; };
  const heads = { 'image/jpeg': [0xff, 0xd8, 0xff, 0xe0], 'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'image/webp': [0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50], 'audio/webm': [0x1a, 0x45, 0xdf, 0xa3], 'audio/ogg': [0x4f, 0x67, 0x67, 0x53], 'audio/mpeg': [0x49, 0x44, 0x33], 'audio/mp4': [0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70] };
  check(() => { for (const [mime, head] of Object.entries(heads)) { assert.equal(x.sniff(file(head), mime), true, mime); x.checkMedia(file(head), mime, mime.startsWith('audio') ? 'voice-note' : 'wound-or-skin'); } assert.equal(x.sniff(file([0xff, 0xfb, 0x90]), 'audio/mpeg'), true, 'MP3 frame sync'); });
  check(() => { assert.equal(x.sniff(file(heads['image/png']), 'image/jpeg'), false); status(() => x.checkMedia(file(heads['image/png']), 'image/jpeg', 'wound-or-skin'), 422); status(() => x.checkMedia(file([0x3c, 0x73, 0x76, 0x67]), 'image/svg+xml', 'wound-or-skin'), 415); status(() => x.checkMedia(file(heads['image/png']), 'text/html', 'other-clinical'), 415); });
  check(() => { status(() => x.checkMedia(file(heads['image/png'], 100), 'image/png', 'wound-or-skin'), 422); status(() => x.checkMedia(file(heads['image/png'], 256 * 1024 + 1), 'image/png', 'wound-or-skin'), 413); x.checkMedia(file(heads['image/png'], 256 * 1024), 'image/png', 'wound-or-skin'); });
  check(() => { status(() => x.checkMedia(file(heads['image/png']), 'image/png', 'selfie'), 422); status(() => x.checkMedia(file(heads['image/png']), 'image/png', 'voice-note'), 422); x.checkMedia(file(heads['audio/ogg']), 'audio/ogg', 'other-clinical'); });
  check(() => { const b = new Uint8Array(200000).map((_, i) => (i * 31) % 256); assert.deepEqual(x.fromB64(x.toB64(b)), b); assert.equal(x.toB64(new Uint8Array([104, 105])), 'aGk='); });
  const result = { suite: 'media contract (slice 2b)', passed, completedAt: new Date().toISOString() };
  writeFileSync('tests/media-contract-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { rmSync(dir, { recursive: true, force: true }); }
