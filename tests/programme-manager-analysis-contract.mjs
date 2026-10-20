import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

let passed=0;
const check=(condition,message)=>{assert.ok(condition,message);passed++;};
const indicators=readFileSync('lib/saha/indicators.ts','utf8');
const server=readFileSync('lib/saha/indicators-server.ts','utf8');
const panel=readFileSync('app/indicators-panel.tsx','utf8');

check(indicators.includes("contract:'saha-programme-analysis-v1'"),'analysis response is versioned');
check(indicators.includes('definitionLineage:defs.map'),'each result carries exact definition lineage');
check(indicators.includes('canonicalSpec:canonicalSpec(def)'),'lineage carries the canonical calculation specification');
check(indicators.includes('latest record time does not prove complete capture'),'missingness limits are explicit');
check(indicators.includes("refused:'person-list'"),'person-list reformulations are explicitly refused');
check(indicators.includes('protected aggregates only'),'refusal explains the safe aggregate boundary');
check(server.includes('normallyAllowed(m,x)'),'filter choices are derived only from the current authorised patient scope');
check(server.includes("ensurePurpose(m,'reporting')"),'execution requires the reporting purpose');
check(server.includes('await assertCompletenessCurrent'),'source completeness is rechecked before release');
check(server.includes('JSON.stringify(currentRun)!==JSON.stringify(run)'),'source or definition races refuse release');
check(panel.includes('Analysis basis'),'cohort, period, filters and method are visible in the UI');
check(panel.includes('Missingness:'),'missingness is visible beside the result');
check(panel.includes("role={interp.refused?'alert':undefined}"),'unsafe reformulations are announced as refusals');
check(!/eval\(|new Function|SELECT \$\{question\}/.test(indicators+server),'natural language never becomes executable code or SQL');

console.log(JSON.stringify({suite:'SAHA-050 programme manager analysis contract',passed,failed:0,completedAt:new Date().toISOString()}));
