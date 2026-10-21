import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const dir=mkdtempSync(join(process.cwd(),'.saha-117-signals-'));let passed=0;const check=fn=>{fn();passed++;};
try{
 const source=ts.transpileModule(readFileSync('lib/saha/operational-monitoring.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'");writeFileSync(join(dir,'operational-monitoring.js'),source);
 const O=await import(pathToFileURL(join(dir,'operational-monitoring.js'))),now='2026-10-20T12:00:00.000Z',at=n=>new Date(Date.parse(now)-n*60000).toISOString();
 const state=()=>({operations:{aggregateReports:[]},workspace:{submissions:[],people:[],visits:[],audit:[]}});
 check(()=>assert.equal(O.QUEUE_STALL_MINUTES,5));check(()=>assert.equal(O.telemetryConfigured({}),true));check(()=>assert.equal(O.telemetryConfigured({SAHA_TELEMETRY_ENABLED:'false'}),false));
 const quiet=O.operationalSignals(state(),now,true);check(()=>assert.deepEqual(quiet.queue,{stalled:0,oldestMinutes:null}));check(()=>assert.equal(quiet.telemetry.gap,false));
 const s=state();s.workspace.submissions.push({state:'sending',updatedAt:at(5),delivery:{startedAt:at(7)}});s.workspace.people.push({ehr:{operations:[{state:'running',publishStartedAt:at(11)},{state:'uncertain',at:at(1)}]}});s.workspace.visits.push({agentRuns:[{status:'running',startedAt:at(6)},{status:'failed',finishedAt:at(2)}]});s.operations.aggregateReports.push({state:'sending',startedAt:at(9)},{state:'rejected',updatedAt:at(2)});s.workspace.audit.push({at:at(3),action:'adapterOperationRefused'},{at:at(10),action:'sendBlocked'},{at:new Date(Date.parse(now)-25*3600000).toISOString(),action:'sendBlocked'});
 const observed=O.operationalSignals(s,now,false);check(()=>assert.deepEqual(observed.queue,{stalled:4,oldestMinutes:11}));check(()=>assert.equal(observed.connector.unresolved,2));check(()=>assert.equal(observed.model.unavailable,2));check(()=>assert.equal(observed.permission.refused,2));check(()=>assert.deepEqual(observed.telemetry,{configured:false,gap:true}));
 const early=state();early.workspace.submissions.push({state:'sending',updatedAt:at(4),delivery:{startedAt:at(4)}});check(()=>assert.equal(O.operationalSignals(early,now,true).queue.stalled,0,'a healthy process before target is not a stall'));
 const snapshot=structuredClone(s),first=O.operationalSignals(snapshot,now,true);s.workspace.submissions[0].delivery.startedAt=at(1);const again=O.operationalSignals(snapshot,now,true);check(()=>assert.deepEqual(again,first,'a captured committed-state projection is stable while another state object changes'));
 const sourceText=['lib/saha/mis.ts','lib/saha/agent-provider.ts','lib/saha/ehr-provider.ts','lib/saha/server.ts','lib/saha/frontline.ts','lib/saha/anaemia.ts'].map(f=>readFileSync(f,'utf8')).join('\n');check(()=>assert.equal((sourceText.match(/X-Saha-Trace-Id/g)??[]).length,6,'each HTTP provider family carries a redacted task trace id'));
 const trace=readFileSync('lib/saha/trace.ts','utf8');check(()=>{assert.match(trace,/traceId:x\.ref\.traceId\?\?x\.ref\.key/);assert.match(trace,/receiptId:x\.ref\.key/);});
 const result={suite:'SAHA-117 operational monitoring and actionable traces',passed,failed:0,scope:'Local synthetic contract only; no hosted five-minute timing, external recipient or formal acceptance.',completedAt:new Date().toISOString()};mkdirSync('tests/evidence/saha-117-operational-monitoring',{recursive:true});writeFileSync('tests/evidence/saha-117-operational-monitoring/contract-result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{rmSync(dir,{recursive:true,force:true});}
