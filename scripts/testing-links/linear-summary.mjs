import { readFileSync, writeFileSync } from 'node:fs';
const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('Usage: linear-summary.mjs linked-result.json NEW-summary.txt');
const r = JSON.parse(readFileSync(input));
if (!['playwright','k6'].includes(r.tool) || !r.metadata?.runId || !r.metadata?.codeSha) throw new Error('Invalid linked report');
const owners = r.owners ?? [...new Set((r.attempts ?? []).flatMap(x => x.owners))];
const ids = r.metadata.scenarioIds ?? [...new Set((r.attempts ?? []).flatMap(x => x.scenarioIds))];
const text = ['## Test run ' + r.metadata.runId, '',
 '| Field | Observed value |', '| --- | --- |',
 '| Tool | ' + r.tool + ' |', '| Tested code SHA | ' + r.metadata.codeSha + ' |',
 '| Environment | ' + r.metadata.environment + ' |', '| Run scope | ' + (r.metadata.runKind ?? 'unspecified') + ' |',
 '| Result | ' + (r.result ?? r.runnerStatus) + ' |', '| Counts | ' + JSON.stringify(r.counts) + ' |',
 '| Scenario links | ' + ids.join(', ') + ' |', '| Owning product records | ' + owners.join(', ') + ' |',
 '| Evidence | ' + (r.metadata.evidenceUrl ?? 'Local raw evidence; remote artifact not yet published') + ' |', '',
 'Run results do not grant formal UAT, story completion, human approval, merge or deployment. Unmapped tests stay unmapped; assertions, test cases, requests and thresholds are separate counters.', '',
 'Publish through the existing authorized Linear connector: append to the testing execution log and relevant existing task; verify the saved full readback. Use runId as the deduplication key. No new Linear API credential is required for this agent-operated publication path.', ''].join('\n');
writeFileSync(output, text, { flag: 'wx' });
