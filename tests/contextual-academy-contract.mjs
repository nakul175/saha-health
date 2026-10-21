import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const directory = mkdtempSync(join(process.cwd(), '.contextual-academy-'));
const checks = [];
const check = async (name, fn) => { await fn(); checks.push(name); };
try {
  writeFileSync(join(directory, 'contextual-academy.mjs'), ts.transpileModule(
    readFileSync('lib/saha/contextual-academy.ts', 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } },
  ).outputText);
  const Academy = await import(pathToFileURL(join(directory, 'contextual-academy.mjs')).href);
  const base = {
    id: 'routine-review-basics', title: 'Review a routine draft',
    summary: 'Optional synthetic workflow learning.',
    content: 'Review the selected task and return to the unchanged routine draft.',
    task: 'routine-visit', actorRoles: ['asha'],
    source: { kind: 'aplyd-academy', reference: 'academy:health-workflow-review', edition: '2026.10-approved' },
  };
  const item = async (overrides = {}) => {
    const candidate = structuredClone({ ...base, ...overrides });
    candidate.source = { ...base.source, ...(overrides.source ?? {}) };
    return { ...candidate, source: { ...candidate.source, contentHash: await Academy.academyContentHash(candidate) } };
  };
  const env = async (items) => ({ [Academy.ACADEMY_CATALOGUE_ENV]: JSON.stringify({ version: Academy.ACADEMY_CATALOGUE_VERSION, items: items ?? [await item()] }) });
  const resolve = (value, role = 'asha') => Academy.contextualAcademy(value, { task: 'routine-visit', role });

  await check('Missing configuration is a non-blocking unavailable state', async () => assert.equal((await resolve({})).reason, 'not-configured'));
  await check('Blank configuration is a non-blocking unavailable state', async () => assert.equal((await resolve({ SAHA_ACADEMY_CONTEXT_CATALOGUE: ' ' })).reason, 'not-configured'));
  await check('Malformed JSON fails closed without throwing', async () => assert.equal((await resolve({ SAHA_ACADEMY_CONTEXT_CATALOGUE: '{' })).reason, 'invalid-configuration'));
  await check('Oversized configuration fails closed', async () => assert.equal((await resolve({ SAHA_ACADEMY_CONTEXT_CATALOGUE: 'x'.repeat(32769) })).reason, 'invalid-configuration'));
  await check('Unknown catalogue fields are refused', async () => assert.equal((await resolve({ SAHA_ACADEMY_CONTEXT_CATALOGUE: JSON.stringify({ version: Academy.ACADEMY_CATALOGUE_VERSION, items: [], extra: true }) })).reason, 'invalid-configuration'));
  await check('Wrong catalogue version is refused', async () => assert.equal((await resolve({ SAHA_ACADEMY_CONTEXT_CATALOGUE: JSON.stringify({ version: 'later', items: [] }) })).reason, 'invalid-configuration'));
  await check('Non-list catalogue items are refused', async () => assert.equal((await resolve({ SAHA_ACADEMY_CONTEXT_CATALOGUE: JSON.stringify({ version: Academy.ACADEMY_CATALOGUE_VERSION, items: {} }) })).reason, 'invalid-configuration'));
  await check('Catalogue item count is bounded', async () => assert.equal((await resolve(await env(await Promise.all(Array.from({ length: 13 }, (_, n) => item({ id: `resource-${n}` })) )))).reason, 'invalid-configuration'));
  await check('Eligible approved content is available', async () => assert.equal((await resolve(await env())).status, 'available'));
  await check('Learning stays explicitly optional', async () => assert.equal((await resolve(await env())).optional, true));
  await check('Learning adds no login', async () => assert.equal((await resolve(await env())).requiresAdditionalLogin, false));
  await check('Learning adds no care gate', async () => assert.equal((await resolve(await env())).careGate, false));
  await check('Reading infers no completion', async () => assert.equal((await resolve(await env())).completionTracking, 'none'));
  await check('Approved title and body survive unchanged', async () => { const result = await resolve(await env()); assert.equal(result.items[0].title, base.title); assert.equal(result.items[0].content, base.content); });
  await check('Non-ASHA role cannot obtain the contextual item', async () => assert.equal((await resolve(await env(), 'supervisor')).reason, 'no-eligible-content'));
  await check('Irrelevant task cannot obtain the contextual item', async () => assert.equal((await Academy.contextualAcademy(await env(), { task: 'other-task', role: 'asha' })).reason, 'no-eligible-content'));
  await check('Empty approved catalogue leaves care usable', async () => assert.equal((await resolve(await env([]))).reason, 'no-eligible-content'));
  await check('Content hash mismatch fails the complete catalogue', async () => { const changed = await item(); changed.content += ' changed'; assert.equal((await resolve(await env([changed]))).reason, 'invalid-configuration'); });
  await check('Unknown item fields are refused', async () => { const changed = { ...(await item()), patientId: 'p_other' }; assert.equal((await resolve(await env([changed]))).reason, 'invalid-configuration'); });
  await check('Wrong source kind is refused', async () => assert.equal((await resolve(await env([await item({ source: { kind: 'other' } })]))).reason, 'invalid-configuration'));
  await check('Unsafe source reference is refused', async () => assert.equal((await resolve(await env([await item({ source: { reference: 'https://example.invalid/?patient=x' } })]))).reason, 'invalid-configuration'));
  await check('Unbounded edition is refused', async () => assert.equal((await resolve(await env([await item({ source: { edition: 'x'.repeat(81) } })]))).reason, 'invalid-configuration'));
  await check('Control characters in content are refused', async () => assert.equal((await resolve(await env([await item({ content: 'bad\u0000content' })]))).reason, 'invalid-configuration'));
  await check('Content length is bounded', async () => assert.equal((await resolve(await env([await item({ content: 'x'.repeat(4001) })]))).reason, 'invalid-configuration'));
  await check('Duplicate resource identities fail closed', async () => { const one = await item(); assert.equal((await resolve(await env([one, one]))).reason, 'invalid-configuration'); });
  await check('Resolved content is detached from later calls', async () => { const configured = await env(), first = await resolve(configured); first.items[0].title = 'mutated'; const second = await resolve(configured); assert.equal(second.items[0].title, base.title); });
  await check('Hash binds source edition', async () => { const first = await item(), second = await item({ source: { edition: '2026.11-approved' } }); assert.notEqual(first.source.contentHash, second.source.contentHash); });
  await check('Configuration shape helper has no prototype shortcut', async () => { assert.equal(Academy.academyConfigurationShape(Object.create({ version: Academy.ACADEMY_CATALOGUE_VERSION, items: [] })), false); assert.equal(Academy.academyConfigurationShape({ version: Academy.ACADEMY_CATALOGUE_VERSION, items: [] }), true); });

  const server = readFileSync('lib/saha/contextual-academy-server.ts', 'utf8');
  const route = readFileSync('app/api/contextual-academy/route.ts', 'utf8');
  const ui = readFileSync('app/routine-visit/contextual-academy.tsx', 'utf8');
  const routine = readFileSync('app/routine-visit/routine-visit.tsx', 'utf8');
  await check('Server checks current assignment before resolving learning', async () => assert.ok(server.indexOf('state.workspace.people.find') < server.indexOf('contextualAcademy(rawRuntime()')));
  await check('Server rechecks current assigned access after resolving learning', async () => assert.ok(server.indexOf('contextualAcademy(rawRuntime()') < server.indexOf('assertAssignedRead(db()')));
  await check('Client learning panel makes no network or storage call', async () => assert.doesNotMatch(ui, /\bfetch\s*\(|localStorage|sessionStorage|indexedDB|api\//));
  await check('Client states no completion and no patient disclosure', async () => { assert.match(ui, /no completion tracking/); assert.match(ui, /sends no patient or visit details/); });
  await check('Academy route is read-only', async () => { assert.match(route, /export async function GET/); assert.doesNotMatch(route, /export async function (POST|PUT|PATCH|DELETE)/); });
  await check('Routine task remounts learning on exact source identity without replacing task controls', async () => { assert.match(routine, /ContextualAcademyPanel key=\{learning\.status/); assert.match(routine, /learning=\{learning\}/); assert.match(routine, /GuidedCapture/); });
  await check('Routine request sends only the selected person ID to the internal endpoint', async () => { assert.match(routine, /contextual-academy\?personId=/); assert.doesNotMatch(routine, /contextual-academy\?[^'\"]*(visitId|name|village)/); });

  const output = process.env.SAHA_CONTEXTUAL_ACADEMY_REPORT ?? 'tests/evidence/saha-155-contextual-academy/contract.json';
  mkdirSync(join(output, '..'), { recursive: true });
  writeFileSync(output, JSON.stringify({ passed: checks.length, failed: 0, skipped: 0, checks,
    completedAt: new Date().toISOString(), realProvidersCalled: false,
    limits: 'Actual catalogue resolver and current-source integration inspection. Synthetic catalogue only; no Academy provider, patient data, formal acceptance, CI, merge, hosting, or observed deployment.' }, null, 2) + '\n');
  console.log(`${checks.length} contextual Academy contract checks passed`);
} finally { rmSync(directory, { recursive: true, force: true }); }
