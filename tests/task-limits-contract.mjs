// Slice 5e contract: per-capability task time and attempt limits (a timed-out sent request becomes
// uncertain and is never retried), and owner-owned AI budget alerts from the slice 5a estimates.
import assert from 'node:assert/strict';import ts from 'typescript';import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';import {join} from 'node:path';import {pathToFileURL} from 'node:url';
const dir=mkdtempSync(join(process.cwd(),'.task-limits-contract-'));let passed=0;const check=fn=>{fn();passed++};
const status=async(fn,code,pattern)=>{try{await fn();}catch(e){assert.equal(e.status,code,e.message);if(pattern)assert.match(e.message,pattern);passed++;return e;}assert.fail(`expected ${code}`);};
try{
 for(const file of ['abdm', 'abdm-transfer', 'access', 'action-plan', 'adapter-operations', 'agent', 'agent-minimisation', 'ai-budget', 'alerts', 'anaemia', 'audit-chain', 'capability-lifecycle', 'caseload', 'consent', 'continuity', 'core', 'delegation', 'ehr', 'environment', 'evaluation', 'exceptional', 'expansion', 'facility-scope', 'fact-provenance', 'fhir-document', 'fhir-validate', 'field', 'field-device', 'field-registration', 'governance', 'household', 'household-constants', 'household-visit', 'household-visit-constants', 'identity', 'imported-visits', 'media', 'merge', 'mis', 'operations', 'outreach', 'pack-installation', 'partition', 'pilot', 'programme-commands', 'programmes', 'provider-sandbox', 'purpose-scope', 'referral-needs', 'referral-request', 'referral-rules', 'retention', 'rights', 'seed', 'send-gate', 'service-identity', 'shadow', 'store', 'task-limits', 'types', 'withdrawal-notices'])writeFileSync(join(dir,file+'.js'),ts.transpileModule(readFileSync(`lib/saha/${file}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'"));
 const {governanceSpec}=await import(pathToFileURL(join(dir,'governance.js'))),{providers,AGENT_VERSION,agentApply}=await import(pathToFileURL(join(dir,'agent.js')));
 const limits=await import(pathToFileURL(join(dir,'task-limits.js'))),budget=await import(pathToFileURL(join(dir,'ai-budget.js'))),alerts=await import(pathToFileURL(join(dir,'alerts.js'))),{maintenanceAllows}=await import(pathToFileURL(join(dir,'operations.js')));
 const now=new Date().toISOString(),today=now.slice(0,10),future=new Date(Date.now()+86400000).toISOString(),ago=m=>new Date(Date.now()-m*60000).toISOString();
 const owner={userId:'owner',displayName:'Synthetic owner',role:'clinician',status:'active',teamIds:['team'],version:1,isOwner:true},reviewer={...owner,userId:'reviewer',isOwner:false},worker={...owner,userId:'worker',displayName:'Synthetic worker',role:'asha',isOwner:false},supervisor={...owner,userId:'supervisor',displayName:'Synthetic supervisor',role:'supervisor',isOwner:false},outsider={...supervisor,userId:'outsider',teamIds:['other']},peer={...worker,userId:'peer'},admin={...owner,userId:'admin',role:'admin',isOwner:false,teamIds:[]};
 const p={id:'patient',name:'Synthetic Subject',village:'Test village',version:1,consentVersion:1,aiConsent:true,teamId:'team',assignedTo:'worker',assigned:true,age:32,programmes:['General care']};const v={id:'visit',personId:p.id,version:1,recordVersion:1,state:'draft',facts:{date:now.slice(0,16),notes:'',weight:''},agentRuns:[]},other={...v,id:'other-visit',agentRuns:[]};
 const s={organisation:{id:'org'},members:[owner,reviewer,worker,supervisor,outsider,peer,admin],workspace:{people:[p],visits:[v,other],referrals:[],audit:[],role:'asha',integrations:[]},governance:{entries:[],evaluations:[],safety:[]}};
 const local=providers([],{}).find(p=>p.id==='local'),ps=[local];
 const base={kind:'capability',key:'local-cap',title:'Synthetic local rules',ownerId:'owner',teamIds:['team'],effectiveFrom:today,reviewBy:future.slice(0,10),changeSummary:'Synthetic task limit fixture only.',providerId:'local',model:local.model,agentVersion:AGENT_VERSION,purpose:'documentary-evidence',ageMin:18,ageMax:60,roles:['asha','clinician'],languages:['en'],settings:['community'],devices:['browser'],tasks:['extract','summary'],excludedUses:'No clinical decisions authorised.',supportContact:'Synthetic owner',hostingRegion:'Local workspace',retentionTerms:'Synthetic test input only, no real data.',trainingUse:'not-authorised',agreementReference:'FIXTURE',dailyCallLimit:100,dailyTokenBudget:600000};
 const spec={...base,taskTimeLimitMinutes:5,taskAttemptLimit:2};
 const entry={id:'cap',revision:1,version:3,spec,manifestHash:'fixture-hash',createdBy:'owner',createdAt:now,state:'active',history:[],review:{by:'reviewer',memberVersion:1,ownerVersion:1,authorVersion:1,dependencyStamp:'[]',evaluationId:'evaluation'}};
 s.governance.entries.push(entry);s.governance.evaluations.push({id:'evaluation',manifestHash:entry.manifestHash,state:'completed',metrics:{passed:true}});
 const actor=(id,name='Synthetic '+id)=>({userId:id,displayName:name});
 const prepare=(task='extract',visit=v)=>agentApply(s,{type:'prepareAgent',visitId:visit.id,version:visit.version,providerId:'local',task,input:'Weight 58 kg'},actor('worker'),worker,ps);
 const run=id=>[...v.agentRuns,...other.agentRuns].find(r=>r.id===id);

 // Manifest fields: optional, bounded, and absent fields add nothing to an existing manifest.
 check(()=>assert.deepEqual(governanceSpec.parse(base),base,'a manifest without limits parses unchanged'));
 check(()=>assert.equal(governanceSpec.parse(spec).taskAttemptLimit,2));
 check(()=>{assert.equal(governanceSpec.safeParse({...base,taskAttemptLimit:0}).success,false);assert.equal(governanceSpec.safeParse({...base,taskAttemptLimit:6}).success,false);assert.equal(governanceSpec.safeParse({...base,taskTimeLimitMinutes:241}).success,false);});
 check(()=>{assert.equal(limits.limitsOf({spec:base}),null);assert.deepEqual(limits.limitsOf(entry),{timeMinutes:5,attempts:2});assert.deepEqual(limits.limitsOf({spec:{...base,taskAttemptLimit:3}}),{timeMinutes:null,attempts:3});});
 check(()=>{assert.equal(limits.expiryMinutes(null),15);assert.equal(limits.expiryMinutes({timeMinutes:5,attempts:null}),5);assert.equal(limits.expiryMinutes({timeMinutes:60,attempts:null}),15,'never later than the existing 15 minutes');});
 check(()=>{assert.equal(limits.limitsSummary({timeMinutes:5,attempts:2}),'time limit 5 minutes, 2 attempts per task on a visit.');assert.match(limits.limitsSummary(null),/No task limits recorded; unsent requests expire after 15 minutes/);});
 check(()=>{const l={timeMinutes:5,attempts:2};assert.equal(limits.timedOut({status:'running',startedAt:ago(6),createdAt:ago(7),limits:l},now),true);assert.equal(limits.timedOut({status:'running',startedAt:ago(4),createdAt:ago(7),limits:l},now),false);assert.equal(limits.timedOut({status:'pending',createdAt:ago(60),limits:l},now),false,'an unsent request expires; it is not an uncertain outcome');assert.equal(limits.timedOut({status:'running',startedAt:ago(600),createdAt:ago(600)},now),false,'no limit, no timeout');});

 // Prepared requests record the revision's limits and expire at the time limit.
 const first=await prepare();
 check(()=>{const r=run(first.runId);assert.deepEqual(r.limits,{timeMinutes:5,attempts:2});const minutes=(Date.parse(r.expiresAt)-Date.parse(r.createdAt))/60000;assert.ok(minutes>4.9&&minutes<=5.01,String(minutes));});
 const second=await prepare();check(()=>assert.ok(second.runId));
 const count=v.agentRuns.length;
 await status(()=>prepare(),429,/attempt limit on this visit \(2 of 2 attempts.*No further request is sent, automatically or manually.*no provider substitution/);
 check(()=>assert.equal(v.agentRuns.length,count,'the refused request left no record'));
 const summary=await prepare('summary');check(()=>assert.ok(summary.runId,'another task has its own attempts'));
 check(()=>assert.doesNotThrow(()=>limits.checkTaskAttempts(s,entry,v,'extract',second.runId,now),'sending a prepared request does not count itself'));
 check(()=>assert.equal(limits.attemptsUsed(s,other,'local-cap','extract',now),0,'attempts are per visit'));
 // An unsent request stopped or expired frees its attempt; a sent one never does.
 await agentApply(s,{type:'cancelAgent',visitId:v.id,runId:first.runId},actor('worker'),worker,ps);
 check(()=>assert.equal(limits.attemptsUsed(s,v,'local-cap','extract',now),1));
 Object.assign(run(second.runId),{status:'running',callCount:1,startedAt:ago(6),approvedAt:ago(6)});
 const third=await prepare();check(()=>assert.ok(third.runId));
 run(third.runId).expiresAt=ago(1);
 check(()=>assert.equal(limits.attemptsUsed(s,v,'local-cap','extract',now),1,'an expired unsent request does not count'));
 await agentApply(s,{type:'cancelAgent',visitId:v.id,runId:third.runId},actor('worker'),worker,ps);

 // A sent request past its time limit: uncertain, closed by a human decision, never resent.
 const close=(m,id=second.runId,reason='Provider outcome unknown; values recorded manually.')=>agentApply(s,{type:'closeTimedOutAgent',visitId:v.id,runId:id,reason},actor(m.userId,m.displayName),m,ps);
 check(()=>assert.equal(limits.timedOut(run(second.runId),now),true));
 await status(()=>close(peer),403,/caring for this patient/);
 await status(()=>close(outsider),403,/caring for this patient/);
 await status(()=>close(admin),403);
 const short=await close(worker,second.runId,'short');check(()=>assert.equal(short,null,'a reason under 10 characters fails the schema'));
 const fresh=await prepare('summary');Object.assign(run(fresh.runId),{status:'running',callCount:1,startedAt:ago(1)});
 await status(()=>close(worker,fresh.runId),409,/has not reached its time limit/);
 const out=await close(supervisor);
 check(()=>{assert.deepEqual(out,{runId:second.runId,outcome:'uncertain'});const r=run(second.runId);assert.equal(r.status,'failed');assert.equal(r.outcome,'uncertain');assert.equal(r.callCount,1,'no further call');assert.equal(r.timeoutDecision.by,'supervisor');assert.match(r.message,/Timed out after 5 minutes.*outcome is uncertain.*not resent or retried.*withheld/);assert.equal(r.steps.filter(x=>x.state==='pending').length,0);});
 check(()=>assert.match(s.workspace.audit.at(-1).detail,/uncertain outcome; not retried\. Reason: Provider outcome unknown/));
 await status(()=>close(supervisor),409,/Only a sent request that passed its time limit/);
 check(()=>assert.equal(limits.attemptsUsed(s,v,'local-cap','extract',now),1,'the uncertain request still counts as an attempt'));
 Object.assign(run(fresh.runId),{startedAt:ago(10)});await close(worker,fresh.runId);
 check(()=>assert.equal(run(fresh.runId).outcome,'uncertain','the requester can close their own'));
 check(()=>{assert.equal(maintenanceAllows({type:'closeTimedOutAgent'}),true);});

 // Budget alerts (owners): reached at 100% or when the next reservation would exceed; near at 80%.
 const row=(key,used,monthly,state='within')=>({capabilityKey:key,title:'Capability '+key,monthlyUsd:monthly,spentUsd:used,reservedUsd:0,state});
 const list=alerts.alertsFor({budgets:[row('a',8,10,'near'),row('b',10,10,'reached'),row('c',9.5,10,'reached'),row('d',5,10),row('e',0,null,'no-budget'),{...row('f',0,null,'no-charge'),spentUsd:null}],report:null,telemetry:null,operations:null,now});
 check(()=>assert.deepEqual(list.map(a=>[a.id,a.count,a.owner,a.tab]),[['ai-budget-reached',2,'owners','service'],['ai-budget-near',1,'owners','service']]));
 check(()=>{const [reached,near]=list;assert.match(reached.title,/estimate, not an invoice/);assert.match(reached.action,/Capability b \(USD 10\.00 of 10\.00\); Capability c \(USD 9\.50 of 10\.00\).*structured capture.*invoice/);assert.match(near.action,/Capability a \(USD 8\.00 of 10\.00\)/);});
 check(()=>assert.deepEqual(alerts.alertsFor({budgets:[row('d',7.99,10)],report:null,telemetry:null,operations:null,now}),[],'below 80% raises nothing'));
 check(()=>assert.deepEqual(alerts.alertsFor({budgets:null,report:null,telemetry:null,operations:null,now}),[],'no budget data (non-operators) raises nothing'));
 check(()=>{assert.equal(alerts.canAcknowledge(owner,'owners'),true);assert.equal(alerts.canAcknowledge(admin,'owners'),false);assert.equal(alerts.canAcknowledge(supervisor,'owners'),false);assert.equal(alerts.canAcknowledge({...owner,status:'suspended'},'owners'),false);});
 check(()=>assert.equal(alerts.ALERT_RULES_VERSION,'1.2.0'));
 s.operations={version:4,maintenance:false,reason:'',updatedAt:'',incidents:[],rates:null};
 await status(()=>alerts.applyAlertAck(s,{type:'opsAcknowledgeAlert',alertId:'ai-budget-near',count:1,note:'Reviewing expected use'},actor('admin'),admin),403,/owner acknowledges budget and invoice alerts/);
 alerts.applyAlertAck(s,{type:'opsAcknowledgeAlert',alertId:'ai-budget-near',count:1,note:'Reviewing expected use'},actor('owner'),owner,now);
 check(()=>{const a=s.operations.acknowledgements.at(-1);assert.equal(a.scope,'organisation');assert.equal(s.operations.version,4);const seen=alerts.alertsFor({budgets:[row('a',8,10,'near')],report:null,telemetry:null,operations:null,acknowledgements:s.operations.acknowledgements,viewerId:'admin',now});assert.equal(seen[0].acknowledged.note,'Reviewing expected use','shared with other operators');});
 // From recorded estimates: an external capability at 80% of its budget.
 const ext={...entry,id:'ext',spec:{...base,key:'ext-cap',title:'External fixture',providerId:'openai',model:'fixture-model'}};s.governance.entries.push(ext);
 s.operations.rates={input:10,output:20,at:now};s.operations.budgets=[{capabilityKey:'ext-cap',monthlyUsd:2.9,setBy:'owner',setAt:now,reason:'Synthetic contract cap'}];
 other.agentRuns.push({id:'x1',task:'extract',status:'review',provider:{mode:'openai'},governance:{id:'ext'},callCount:1,createdAt:now,startedAt:now,expiresAt:now,usage:{inputTokens:100000,outputTokens:70000}});
 check(()=>{const rows=budget.budgetView(s,now),a=alerts.alertsFor({budgets:rows,report:null,telemetry:null,operations:null,now});assert.equal(rows.find(r=>r.capabilityKey==='ext-cap').spentUsd,2.4);assert.deepEqual(a.map(x=>[x.id,x.count]),[['ai-budget-near',1]]);});
 s.operations.budgets[0].monthlyUsd=2.45;
 check(()=>{const rows=budget.budgetView(s,now),a=alerts.alertsFor({budgets:rows,report:null,telemetry:null,operations:null,now});assert.equal(rows.find(r=>r.capabilityKey==='ext-cap').state,'reached');assert.deepEqual(a.map(x=>[x.id,x.count]),[['ai-budget-reached',1]],'the next reservation would exceed the budget');});

 const result={suite:'Task limits and budget alerts contract (slice 5e)',passed,completedAt:new Date().toISOString()};
 writeFileSync('tests/task-limits-contract-result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{rmSync(dir,{recursive:true,force:true});}
