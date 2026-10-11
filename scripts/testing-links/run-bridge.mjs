import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const exec = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const [outputArg, k6] = process.argv.slice(2);
if (!outputArg || !k6) throw new Error('Usage: run-bridge.mjs NEW-output-directory /path/to/k6');
const output = resolve(outputArg);
if (existsSync(output)) throw new Error('Run output must be new; preserve earlier evidence');
mkdirSync(output, { recursive: true });
const commands = [], requests = [];
const sha = (await exec('git', ['rev-parse','HEAD'], { cwd: root })).stdout.trim();
const baseEnv = { ...process.env, K6_NO_USAGE_REPORT: 'true' };
const modulePath = process.env.SAHA_PLAYWRIGHT_MODULE ?? resolve(root, 'node_modules/@playwright/test');
async function run(name, command, args, extra = {}, expectedExit = 0) {
  const startedAt = new Date().toISOString();
  let result;
  try { result = { ...await exec(command, args, { cwd: root, env: { ...baseEnv, ...extra }, timeout: 30000, maxBuffer: 8 * 1024 * 1024 }), exitCode: 0 }; }
  catch (error) { result = { stdout: error.stdout ?? '', stderr: error.stderr ?? '', exitCode: Number.isInteger(error.code) ? error.code : null, interrupted: !!error.killed }; }
  const text = result.stdout + result.stderr;
  writeFileSync(resolve(output, name + '.log'), text, { flag: 'wx' });
  commands.push({ name, startedAt, finishedAt: new Date().toISOString(), exitCode: result.exitCode, expectedExit,
    interrupted: result.interrupted ?? false, logSha256: createHash('sha256').update(text).digest('hex') });
  if (result.exitCode !== expectedExit) throw new Error(name + ' actual exit ' + result.exitCode + ', expected ' + expectedExit);
}
for (const tool of ['playwright','k6']) writeFileSync(resolve(output, tool + '-metadata.json'), JSON.stringify({
  runId: 'bridge-' + new Date().toISOString().replace(/[:.]/g,'-') + '-' + tool, codeSha: sha,
  environment: 'isolated synthetic reporting bridge', runKind: 'bridge_smoke_not_product_acceptance',
  scenarioIds: [tool === 'playwright' ? 'SCN-TC-BR-UX-01-A' : 'SCN-TC-NFR-01-A'],
}), { flag: 'wx' });
const browserEnv = { SAHA_RUN_METADATA: resolve(output,'playwright-metadata.json'),
  SAHA_LINKED_OUTPUT: resolve(output,'playwright-linked.json'), SAHA_BRIDGE_ARTIFACTS: resolve(output,'browser-artifacts'),
  SAHA_PLAYWRIGHT_MODULE: modulePath };
let server, completed = false;
try {
  await run('adapter-contract', process.execPath, ['scripts/testing-links/fixtures/adapter-contract.mjs']);
  await run('reporter-contract', process.execPath, ['scripts/testing-links/fixtures/reporter-contract.mjs']);
  await run('playwright', process.execPath, [resolve(modulePath,'cli.js'),'test','--config','scripts/testing-links/fixtures/playwright.config.cjs'], browserEnv);
  await run('invalid-scenario-control', process.execPath, [resolve(modulePath,'cli.js'),'test','--config','scripts/testing-links/fixtures/playwright.config.cjs'], {
    ...browserEnv, SAHA_BRIDGE_SCENARIO: 'SCN-NOT-IN-CATALOGUE', SAHA_LINKED_OUTPUT: resolve(output,'playwright-invalid-mapping.json'),
    SAHA_BRIDGE_ARTIFACTS: resolve(output,'invalid-mapping-artifacts') }, 1);
  const invalid = JSON.parse(readFileSync(resolve(output,'playwright-invalid-mapping.json')));
  if (invalid.result !== 'invalid_mapping') throw new Error('Missing observed refusal of unknown scenario');
  server = createServer((req, res) => { requests.push({ path: req.url, at: new Date().toISOString() }); res.writeHead(req.url === '/bridge-fixture' ? 204 : 404, { 'Content-Length': 0 }); res.end(); });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  await run('k6', k6, ['run','scripts/testing-links/fixtures/k6-smoke.js'], { SAHA_BRIDGE_BASE: 'http://127.0.0.1:' + server.address().port, SAHA_K6_RAW_OUTPUT: resolve(output,'k6-native.json') });
  if (requests.length !== 20 || requests.some(x => x.path !== '/bridge-fixture')) throw new Error('Unexpected actual workload');
  await run('k6-import', process.execPath, ['scripts/testing-links/import-k6.mjs',resolve(output,'k6-native.json'),resolve(output,'k6-metadata.json'),resolve(output,'k6-linked.json')]);
  for (const tool of ['playwright','k6']) await run(tool + '-summary',process.execPath,['scripts/testing-links/linear-summary.mjs',resolve(output,tool+'-linked.json'),resolve(output,tool+'-linear.txt')]);
  completed = true;
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  writeFileSync(resolve(output,'EXECUTION-RECEIPT.json'),JSON.stringify({ sourceSha: sha, scope: 'tooling integration only', completed,
    commands, requests, formalAcceptanceGranted: false, storyDoneGranted: false, linearPublication: 'awaiting existing authorized connector; summaries generated, not yet saved' },null,2), {flag:'wx'});
}
console.log(JSON.stringify({ completed, output, sourceSha: sha, productAcceptance: false }));
