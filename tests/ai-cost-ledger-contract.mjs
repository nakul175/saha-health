import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const dir=mkdtempSync(join(process.cwd(),'.saha-ai-cost-ledger-'));let passed=0;
const check=fn=>{fn();passed++};
try{
 for(const file of ['ai-cost-ledger'])writeFileSync(join(dir,file+'.js'),ts.transpileModule(readFileSync(`lib/saha/${file}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'"));
 const L=await import(pathToFileURL(join(dir,'ai-cost-ledger.js')));
 const now='2026-10-16T09:00:00.000Z',rates={input:100,output:200,at:now};
 const spec={kind:'capability',key:'extract-notes',title:'Extract notes',providerId:'openai'};
 const entry={id:'cap-1',revision:2,version:4,manifestHash:'manifest-2',spec};
 const provider={id:'openai',name:'OpenAI',mode:'openai',model:'gpt-test',version:'v1',available:true};
 const run=(x={})=>({id:crypto.randomUUID(),task:'extract',status:'review',actorId:'u',createdAt:now,expiresAt:now,provider,callCount:1,governance:{id:entry.id,version:entry.version,manifestHash:entry.manifestHash},...x});
 const state={organisation:{id:'tenant-a'},workspace:{visits:[{agentRuns:[run({usage:{inputTokens:10,outputTokens:5}}),run({task:'summary'}),run({governance:undefined}),run({createdAt:'2026-09-01T00:00:00.000Z',startedAt:'2026-09-01T00:00:00.000Z'})]}]},governance:{entries:[entry],evaluations:[{id:'eval-1',entryId:entry.id,manifestHash:entry.manifestHash,provider,createdAt:now,results:[{caseId:'a',state:'completed',startedAt:now,usage:{inputTokens:20,outputTokens:10}},{caseId:'b',state:'running',startedAt:now}]}]},operations:{rates,budgets:[{capabilityKey:spec.key,monthlyUsd:10}]}};
 const ledger=L.costLedger(state,now);
 check(()=>assert.deepEqual([ledger.billableEvents,ledger.attributedEvents,ledger.unattributedEvents,ledger.coverage,ledger.targetMet],[5,4,1,.8,false]));
 check(()=>assert.equal(ledger.rows.length,4,'agent extract, agent summary, unattributed extract and evaluation are distinct dimensions'));
 check(()=>{const r=ledger.rows.find(x=>x.task==='system:evaluation');assert.deepEqual([r.events,r.attributed,r.missingUsage,r.inputTokens,r.outputTokens],[2,2,1,20,10]);assert.equal(r.deployment,'cap-1:r2:manifest-2')});
 check(()=>{const r=ledger.rows.find(x=>x.capabilityKey===null);assert.equal(r.attributed,0);assert.equal(r.providerId,'openai')});
 check(()=>assert.match(ledger.notice,/Patient, visit, prompt, response and actor data are excluded/));
 check(()=>assert.equal(L.costLedger({...state,workspace:{visits:[]},governance:{entries:[entry],evaluations:[]}},now).coverage,1,'no billable event meets the attribution target'));
 const result={suite:'SAHA-063 provider/capability/deployment/task metering',passed,completedAt:new Date().toISOString()};
 writeFileSync('tests/ai-cost-ledger-contract-result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{rmSync(dir,{recursive:true,force:true});}
