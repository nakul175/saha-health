import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function normalizeK6(summary, metadata, registry) {
  if (!metadata.runId || !/^[0-9a-f]{40}$/.test(metadata.codeSha ?? '') || !metadata.environment) throw new Error('Exact run identity required');
  const checks = summary.metrics?.checks?.values;
  if (!checks || !Number.isInteger(checks.passes) || !Number.isInteger(checks.fails) || checks.passes < 0 || checks.fails < 0) throw new Error('Missing actual k6 check counts; cannot infer a pass');
  if (checks.passes + checks.fails === 0) throw new Error('No executed checks; cannot infer a pass');
  const thresholds = Object.entries(summary.metrics).flatMap(([metric, value]) => Object.entries(value.thresholds ?? {}).map(([expression, result]) => ({ metric, expression, passed: result.ok })));
  if (!thresholds.length || thresholds.some(x => typeof x.passed !== 'boolean')) throw new Error('Actual threshold outcomes required');
  if (!Array.isArray(metadata.scenarioIds) || !metadata.scenarioIds.length) throw new Error('Explicit scenario linkage required');
  for (const id of metadata.scenarioIds) if (!registry.scenarios[id]) throw new Error('Unknown scenario: ' + id);
  return { schemaVersion: '1.0', tool: 'k6', metadata, importedAt: new Date().toISOString(),
    result: checks.fails || thresholds.some(x => !x.passed) ? 'failed' : 'passed',
    counts: { checksPassed: checks.passes, checksFailed: checks.fails, formalTestCasesExecuted: null },
    thresholds, metrics: summary.metrics,
    owners: [...new Set(metadata.scenarioIds.flatMap(id => registry.scenarios[id].ownerIds))],
    formalAcceptanceGranted: false, storyDoneGranted: false, humanApprovalGranted: false };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [input, meta, output] = process.argv.slice(2);
  if (!input || !meta || !output) throw new Error('Usage: import-k6.mjs native-summary.json metadata.json NEW-output.json');
  const report = normalizeK6(JSON.parse(readFileSync(input)), JSON.parse(readFileSync(meta)), JSON.parse(readFileSync(new URL('./scenario-links.json', import.meta.url))));
  writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ result: report.result, counts: report.counts }));
  process.exitCode = report.result === 'failed' ? 1 : 0;
}
