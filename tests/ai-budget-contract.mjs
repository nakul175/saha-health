// Slice 5a contract: monthly cost budgets per AI capability, refusal before preparing or sending,
// cost estimation rules, owner-only settings, and stopping another worker's unsent request.
import assert from 'node:assert/strict';import ts from 'typescript';import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';import {join} from 'node:path';import {pathToFileURL} from 'node:url';
const dir=mkdtempSync(join(process.cwd(),'.ai-budget-contract-'));let passed=0;const check=fn=>{fn();passed++},rejects=async(fn,pattern)=>{await assert.rejects(fn,pattern);passed++};
const status=async(fn,code,pattern)=>{try{await fn();}catch(e){assert.equal(e.status,code,e.message);if(pattern)assert.match(e.message,pattern);passed++;return e;}assert.fail(`expected ${code}`);};
try{
 for(const file of ['abdm', 'abdm-transfer', 'access', 'action-plan', 'adapter-operations', 'agent', 'agent-minimisation', 'ai-budget', 'alerts', 'anaemia', 'audit-chain', 'capability-lifecycle', 'caseload', 'consent', 'continuity', 'core', 'delegation', 'ehr', 'environment', 'evaluation', 'exceptional', 'expansion', 'facility-scope', 'fact-provenance', 'fhir-document', 'fhir-validate', 'field', 'field-registration', 'governance', 'household', 'household-constants', 'household-visit', 'household-visit-constants', 'identity', 'imported-visits', 'media', 'merge', 'mis', 'operations', 'outreach', 'pack-installation', 'partition', 'pilot', 'programme-commands', 'programmes', 'provider-sandbox', 'purpose-scope', 'referral-needs', 'referral-request', 'referral-rules', 'retention', 'rights', 'seed', 'send-gate', 'service-identity', 'shadow', 'store', 'task-limits', 'types'])writeFileSync(join(dir,file+'.js'),ts.transpileModule(readFileSync(`lib/saha/${file}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'"));
 const {checkCapabilityBudget}=await import(pathToFileURL(join(dir,'governance.js'))),{providers,AGENT_VERSION,agentApply}=await import(pathToFileURL(join(dir,'agent.js')));
 const budget=await import(pathToFileURL(join(dir,'ai-budget.js'))),{applyOperations,maintenanceAllows}=await import(pathToFileURL(join(dir,'operations.js')));
 const now=new Date().toISOString(),today=now.slice(0,10),future=new Date(Date.now()+86400000).toISOString(),lastMonth=new Date(Date.UTC(new Date().getUTCFullYear(),new Date().getUTCMonth()-1,15)).toISOString();
 const owner={userId:'owner',displayName:'Synthetic owner',role:'clinician',status:'active',teamIds:['team'],version:1,isOwner:true},reviewer={...owner,userId:'reviewer',isOwner:false},worker={...owner,userId:'worker',role:'asha',isOwner:false},supervisor={...owner,userId:'supervisor',role:'supervisor',isOwner:false},outsider={...supervisor,userId:'outsider',teamIds:['other']},peer={...worker,userId:'peer'},admin={...owner,userId:'admin',role:'admin',isOwner:false,teamIds:[]};
 const p={id:'patient',name:'Synthetic Subject',village:'Test village',version:1,consentVersion:1,aiConsent:true,teamId:'team',assignedTo:'worker',assigned:true,age:32,programmes:['General care']};const v={id:'visit',personId:p.id,version:1,recordVersion:1,state:'draft',facts:{date:now.slice(0,16),notes:'Synthetic current note',weight:'58'},agentRuns:[]};
 const s={organisation:{id:'org'},members:[owner,reviewer,worker,supervisor,outsider,peer,admin],workspace:{people:[p],visits:[v],referrals:[],audit:[],role:'asha',integrations:[]},governance:{entries:[],evaluations:[],safety:[]}};
 const provider=providers([],{OPENAI_API_KEY:'fake-fixture-key',SAHA_EXTERNAL_APIS_ENABLED:'true'}).find(p=>p.id==='openai'),local=providers([],{}).find(p=>p.id==='local');const context={language:'en',setting:'community',device:'browser'};
 const spec={kind:'capability',key:'fixture-cap',title:'Synthetic capability',ownerId:'owner',teamIds:['team'],effectiveFrom:today,reviewBy:future.slice(0,10),changeSummary:'Synthetic review fixture only.',providerId:'openai',model:provider.model,agentVersion:AGENT_VERSION,purpose:'documentary-evidence',ageMin:18,ageMax:60,roles:['asha','clinician'],populations:['General care'],languages:['en'],settings:['community'],devices:['browser'],tasks:['extract','summary'],inputQuality:'validated-text',excludedUses:'No clinical decisions authorised.',supportContact:'Synthetic owner',hostingRegion:'Not activated',retentionTerms:'Synthetic test input only, no real data.',trainingUse:'not-authorised',agreementReference:'FIXTURE',dailyCallLimit:100,dailyTokenBudget:600000};
 const entry={id:'cap',revision:1,version:3,spec,manifestHash:'fixture-hash',createdBy:'owner',createdAt:now,state:'active',history:[],review:{by:'reviewer',memberVersion:1,ownerVersion:1,authorVersion:1,dependencyStamp:'[]',evaluationId:'evaluation'}};
 const localEntry={...entry,id:'local-cap',spec:{...spec,key:'local-cap',title:'Local rules',providerId:'local',model:local.model}};
 s.governance.entries.push(entry,localEntry);s.governance.evaluations.push({id:'evaluation',manifestHash:entry.manifestHash,state:'completed',metrics:{passed:true}});
 const actor=id=>({userId:id,displayName:'Synthetic '+id});
 const request={type:'prepareAgent',visitId:v.id,version:1,providerId:'openai',task:'extract',input:'Weight 58 kg',context};
 const prepare=()=>agentApply(s,request,actor('worker'),worker,[provider,local]);
 const ops=(c,m=owner)=>applyOperations(s,{version:s.operations?.version??0,...c},actor(m.userId),m);

 // Estimation rules.
 const rates={input:1,output:2,at:now},run=(x)=>({id:'r',provider:{mode:'openai'},callCount:0,status:'pending',createdAt:now,expiresAt:future,...x});
 check(()=>assert.equal(budget.reservedUsd(rates),0.012));
 check(()=>assert.deepEqual(budget.runCost(run({provider:{mode:'local'},callCount:1,usage:{inputTokens:1e6,outputTokens:1e6}}),rates,now),{usd:0,basis:'none'}));
 check(()=>assert.deepEqual(budget.runCost(run({callCount:1,startedAt:now,usage:{inputTokens:10000,outputTokens:5000}}),rates,now),{usd:0.02,basis:'usage'}));
 check(()=>assert.deepEqual(budget.runCost(run({}),rates,now),{usd:0.012,basis:'reserved'}));
 check(()=>assert.deepEqual(budget.runCost(run({expiresAt:'2020-01-01T00:00:00Z'}),rates,now),{usd:0,basis:'none'},'an expired unsent request reserves nothing'));
 check(()=>assert.deepEqual(budget.runCost(run({callCount:1,status:'failed',startedAt:now}),rates,now),{usd:0.012,basis:'reserved'},'a sent call without usage counts at the reserved allowance'));
 check(()=>assert.deepEqual(budget.runCost(run({callCount:1,startedAt:lastMonth,createdAt:lastMonth,usage:{inputTokens:10000,outputTokens:5000}}),rates,now),{usd:0,basis:'none'},'last month is not this month'));
 check(()=>assert.deepEqual(budget.runCost(run({status:'cancelled'}),rates,now),{usd:0,basis:'none'}));

 // No budget: nothing monetary is checked, even without rates.
 const first=await prepare();check(()=>assert.ok(first.runId));
 check(()=>assert.deepEqual(budget.budgetView(s,now).map(r=>[r.capabilityKey,r.state]),[['fixture-cap','no-budget'],['local-cap','no-charge']]));

 // Owner-only setting, with a reason, on a registered capability key.
 await status(()=>ops({type:'opsBudget',capabilityKey:'fixture-cap',monthlyUsd:3,reason:'Synthetic contract cap'},admin),403,/owner/);
 await status(()=>ops({type:'opsBudget',capabilityKey:'unknown-cap',monthlyUsd:3,reason:'Synthetic contract cap'}),404);
 await status(()=>ops({type:'opsBudget',capabilityKey:'fixture-cap',monthlyUsd:null,reason:'Nothing to clear here'}),409);
 check(()=>assert.equal(applyOperations(s,{type:'opsBudget',version:0,capabilityKey:'fixture-cap',monthlyUsd:0,reason:'Zero is not a budget'},actor('owner'),owner),null,'zero fails the schema'));
 ops({type:'opsBudget',capabilityKey:'fixture-cap',monthlyUsd:3,reason:'Synthetic contract cap'});
 check(()=>{assert.equal(s.operations.budgets.length,1);assert.equal(s.operations.budgets[0].monthlyUsd,3);assert.equal(s.operations.budgets[0].setBy,'owner');assert.equal(s.operations.version,1);assert.match(s.workspace.audit.at(-1).detail,/USD 3\.00 \(estimate basis, not an invoice\): Synthetic contract cap/);});
 await status(()=>applyOperations(s,{type:'opsBudget',version:0,capabilityKey:'fixture-cap',monthlyUsd:1,reason:'Stale version edit'},actor('owner'),owner),409,/Operations changed/);

 // A budget without recorded rates fails closed before anything is prepared.
 const before=v.agentRuns.length;
 await status(prepare,409,/no cost rates are recorded.*no provider substitution/);
 check(()=>assert.equal(v.agentRuns.length,before));
 check(()=>assert.equal(budget.budgetView(s,now)[0].state,'no-rates'));

 // With rates of 100/200 USD per million tokens each unsent request reserves 1.20; the third would exceed 3.00.
 ops({type:'opsRates',input:100,output:200});
 const second=await prepare();check(()=>assert.ok(second.runId));
 const refused=await status(prepare,429,/monthly cost budget \(estimated USD 2\.40 of 3\.00.*no provider substitution was made.*not an invoice/);
 check(()=>assert.equal(v.agentRuns.length,before+1,'the refused request left no record'));
 check(()=>assert.doesNotThrow(()=>checkCapabilityBudget(s,entry,first.runId),'sending a prepared request counts its own reservation once'));
 check(()=>{const r=budget.budgetView(s,now)[0];assert.equal(r.reservedUsd,2.4);assert.equal(r.spentUsd,0);assert.equal(r.remainingUsd,0.6);assert.equal(r.state,'reached');});
 // The local rules capability is never charged or refused on cost.
 check(()=>assert.doesNotThrow(()=>budget.checkMonthlyBudget(s,localEntry)));

 // Cancelling an unsent request releases its reservation.
 await agentApply(s,{type:'cancelAgent',visitId:v.id,runId:second.runId},actor('worker'),worker,[provider,local]);
 check(()=>{const r=budget.budgetView(s,now)[0];assert.equal(r.reservedUsd,1.2);assert.equal(r.state,'within');});
 // Recorded usage replaces the reservation; the view turns near the limit at 80%.
 const firstRun=v.agentRuns.find(r=>r.id===first.runId);Object.assign(firstRun,{status:'review',callCount:1,startedAt:now,usage:{inputTokens:6000,outputTokens:3000}});
 check(()=>{const r=budget.budgetView(s,now)[0];assert.equal(r.spentUsd,1.2);assert.equal(r.reservedUsd,0);assert.equal(r.state,'within');});
 const third=await prepare();check(()=>assert.ok(third.runId));
 check(()=>{const r=budget.budgetView(s,now)[0];assert.equal(r.state,'reached','2.40 used or reserved plus a 1.20 request exceeds 3.00');assert.equal(r.runs,2);});
 const x=v.agentRuns.find(r=>r.id===third.runId);x.expiresAt='2020-01-01T00:00:00Z';
 ops({type:'opsBudget',capabilityKey:'fixture-cap',monthlyUsd:1.5,reason:'Tighter synthetic cap'});
 check(()=>{const r=budget.budgetView(s,now)[0];assert.equal(r.monthlyUsd,1.5);assert.equal(r.state,'reached');assert.equal(s.operations.budgets.length,1,'a new amount replaces the old one');});
 await status(()=>checkCapabilityBudget(s,entry),429,/monthly cost budget/);
 Object.assign(firstRun,{usage:{inputTokens:30000,outputTokens:15000}});
 ops({type:'opsBudget',capabilityKey:'fixture-cap',monthlyUsd:7.5,reason:'Wider synthetic cap'});
 check(()=>{const r=budget.budgetView(s,now)[0];assert.equal(r.spentUsd,6);assert.equal(r.state,'near');assert.equal(r.remainingUsd,1.5);});
 ops({type:'opsBudget',capabilityKey:'fixture-cap',monthlyUsd:null,reason:'Budget withdrawn'});
 check(()=>{assert.equal(s.operations.budgets.length,0);assert.equal(budget.budgetView(s,now)[0].state,'no-budget');assert.match(s.workspace.audit.at(-1).detail,/cleared.*Budget withdrawn/);});

 // Stopping another worker's request: only an unsent one, only with normal care scope.
 const pending=await prepare(),stop=(m)=>agentApply(s,{type:'cancelAgent',visitId:v.id,runId:pending.runId},actor(m.userId),m,[provider,local]);
 await status(()=>stop(peer),403,/caring for this patient/);
 await status(()=>stop(outsider),403,/caring for this patient/);
 await status(()=>stop(admin),403);
 await stop(supervisor);
 check(()=>{const r=v.agentRuns.find(r=>r.id===pending.runId);assert.equal(r.status,'cancelled');assert.match(r.message,/Stopped by Synthetic supervisor before it was sent/);assert.equal(r.steps.filter(x=>x.state==='pending').length,0);assert.match(s.workspace.audit.at(-1).detail,/stopped by a care-team member before sending/);assert.equal(s.workspace.audit.at(-1).role,'supervisor');});
 await status(()=>stop(supervisor),409,/already closed/);
 const sent=await prepare();Object.assign(v.agentRuns.find(r=>r.id===sent.runId),{status:'running',callCount:1,startedAt:now});
 await status(()=>agentApply(s,{type:'cancelAgent',visitId:v.id,runId:sent.runId},actor('owner'),owner,[provider,local]),409,/already sent.*not recalled/);
 await agentApply(s,{type:'cancelAgent',visitId:v.id,runId:sent.runId},actor('worker'),worker,[provider,local]);
 check(()=>assert.equal(v.agentRuns.find(r=>r.id===sent.runId).status,'cancelled','the requester can still close a sent request'));
 check(()=>assert.equal(maintenanceAllows({type:'cancelAgent'}),true));

 const result={suite:'AI budget contract (slice 5a)',passed,completedAt:new Date().toISOString()};
 writeFileSync('tests/ai-budget-contract-result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{rmSync(dir,{recursive:true,force:true});}
