// Slice 5d contract: capability lifecycle stages (BR-AI-04), replacement, which runs used which version, and the
// in-progress work a suspended or replaced capability leaves behind. Fixture provider only; nothing is sent.
import assert from 'node:assert/strict';import ts from 'typescript';import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';import {join} from 'node:path';import {pathToFileURL} from 'node:url';
const dir=mkdtempSync(join(process.cwd(),'.capability-lifecycle-contract-'));let passed=0;const check=fn=>{fn();passed++};
const status=async(fn,code,pattern)=>{try{await fn();}catch(e){assert.equal(e.status,code,e.message);if(pattern)assert.match(e.message,pattern);passed++;return e;}assert.fail(`expected ${code}`);};
try{
 for(const file of ['abdm', 'abdm-transfer', 'access', 'action-plan', 'adapter-operations', 'agent', 'agent-minimisation', 'ai-budget', 'alerts', 'anaemia', 'audit-chain', 'capability-lifecycle', 'caseload', 'consent', 'continuity', 'core', 'delegation', 'ehr', 'environment', 'evaluation', 'exceptional', 'expansion', 'facility-scope', 'fact-provenance', 'fhir-document', 'fhir-validate', 'field', 'field-registration', 'governance', 'household', 'household-constants', 'household-visit', 'household-visit-constants', 'identity', 'imported-visits', 'media', 'merge', 'mis', 'operations', 'outreach', 'pack-installation', 'partition', 'pilot', 'programme-commands', 'programmes', 'provider-sandbox', 'purpose-scope', 'referral-needs', 'referral-request', 'referral-rules', 'retention', 'rights', 'seed', 'send-gate', 'service-identity', 'shadow', 'store', 'task-limits', 'types'])writeFileSync(join(dir,file+'.js'),ts.transpileModule(readFileSync(`lib/saha/${file}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'"));
 const {applyGovernance,authorizeGovernance,activeEntry}=await import(pathToFileURL(join(dir,'governance.js'))),{applyEvaluation,EVALUATION_CASES,scoreEvaluation}=await import(pathToFileURL(join(dir,'evaluation.js')));
 const {providers,AGENT_VERSION,agentApply,localExtract,validateOutput}=await import(pathToFileURL(join(dir,'agent.js'))),{authorizeSandbox}=await import(pathToFileURL(join(dir,'provider-sandbox.js')));
 const lc=await import(pathToFileURL(join(dir,'capability-lifecycle.js')));
 const now=new Date().toISOString(),today=now.slice(0,10),later=new Date(Date.now()+60*86400000).toISOString().slice(0,10);
 const owner={userId:'owner',displayName:'Synthetic owner',role:'clinician',status:'active',teamIds:['team'],version:1,isOwner:true},reviewer={...owner,userId:'reviewer',isOwner:false},author={...owner,userId:'author',isOwner:false},worker={...owner,userId:'worker',role:'asha',isOwner:false},vendor={...owner,userId:'vendor',role:'provider',isOwner:false};
 const p={id:'patient',name:'Synthetic Subject',village:'Test village',version:1,consentVersion:1,aiConsent:true,teamId:'team',assignedTo:'worker',assigned:true,age:32,programmes:['General care']};
 const draft={id:'draft-visit',personId:p.id,version:1,recordVersion:1,state:'draft',facts:{date:now.slice(0,16),weight:'',notes:''},agentRuns:[]},confirmed={id:'confirmed-visit',personId:p.id,version:1,recordVersion:1,state:'confirmed',facts:{date:now.slice(0,16),weight:'58',notes:''},agentRuns:[]};
 const s={organisation:{id:'org'},teams:[{id:'team',name:'Care team'}],members:[owner,reviewer,author,worker,vendor],workspace:{people:[p],visits:[draft,confirmed],referrals:[],audit:[],role:'asha',integrations:[]},governance:{entries:[],evaluations:[],safety:[]}};
 const ps=[...providers([],{OPENAI_API_KEY:'fake-fixture-key',SAHA_EXTERNAL_APIS_ENABLED:'true'})],openai=ps.find(x=>x.id==='openai'),actor=id=>({userId:id,displayName:'Synthetic '+id});
 const spec=(extra={})=>({kind:'capability',key:'fixture-cap',title:'Synthetic capability',ownerId:'owner',teamIds:['team'],effectiveFrom:today,reviewBy:later,changeSummary:'Synthetic lifecycle fixture only.',providerId:'openai',model:openai.model,agentVersion:AGENT_VERSION,purpose:'documentary-evidence',ageMin:18,ageMax:60,roles:['asha','clinician'],populations:['General care'],languages:['en'],settings:['community'],devices:['browser'],tasks:['extract'],inputQuality:'validated-text',excludedUses:'No clinical decisions authorised.',supportContact:'Synthetic owner',hostingRegion:'Not activated',retentionTerms:'Synthetic test input only, no retention.',trainingUse:'not-authorised',agreementReference:'SYNTHETIC-AGREEMENT',dailyCallLimit:50,dailyTokenBudget:600000,...extra});
 const entry=id=>s.governance.entries.find(e=>e.id===id),stage=id=>lc.lifecycleStage(s,entry(id)).stage;
 const gov=(c,m=owner)=>applyGovernance(s,c,actor(m.userId),m,now);
 // Evaluation results come from a fixture: the validated local rules output stands in for the provider.
 const evaluate=async id=>{const {evaluationId}=await applyEvaluation(s,{type:'prepareEvaluation',entryId:id,version:entry(id).version},actor('owner'),owner,ps,now);const ev=s.governance.evaluations.find(e=>e.id===evaluationId),cases=ev.caseIds.map(c=>EVALUATION_CASES.find(x=>x.id===c));ev.results=cases.map(c=>({caseId:c.id,state:'completed',startedAt:now,output:validateOutput(localExtract(c.input),c.input,'extract').output}));ev.state='completed';ev.metrics=scoreEvaluation(cases,ev.results);return evaluationId;};
 const promote=async(id,evaluationId)=>{await gov({type:'reviewGovernance',entryId:id,version:entry(id).version,reference:'SYNTH-REVIEW',findings:'Independent synthetic review recorded.',evaluationId},reviewer);return gov({type:'transitionGovernance',entryId:id,version:entry(id).version,state:'active',reason:'Owner activation after independent review.'});};

 // Registered -> technically verified -> approved for its scope -> active.
 const first=(await gov({type:'createGovernance',spec:spec()},author)).entryId;
 check(()=>{const l=lc.lifecycleStage(s,entry(first));assert.equal(l.stage,'registered');assert.match(l.detail,/passing version-bound synthetic evaluation/)});
 const firstEval=await evaluate(first);check(()=>assert.equal(stage(first),'technically-verified'));
 await gov({type:'reviewGovernance',entryId:first,version:entry(first).version,reference:'SYNTH-REVIEW',findings:'Independent synthetic review recorded.',evaluationId:firstEval},reviewer);
 check(()=>assert.equal(stage(first),'approved-for-scope'));
 // Nobody but an owner activates; a provider account cannot self-activate anywhere.
 await status(()=>authorizeGovernance(s,author,{type:'transitionGovernance',entryId:first}),403,/owner must change deployment status/);
 await status(()=>authorizeGovernance(s,vendor,{type:'transitionGovernance',entryId:first}),403,/owner/);
 await status(()=>authorizeSandbox(s,vendor,{type:'transitionGovernance',entryId:first,state:'active'}),403,/only in a provider sandbox/);
 await gov({type:'transitionGovernance',entryId:first,version:entry(first).version,state:'active',reason:'Owner activation after independent review.'});
 check(()=>{assert.equal(stage(first),'active');assert.equal(activeEntry(s,entry(first),now),true)});

 // Runs record the exact version they used.
 const context={language:'en',setting:'community',device:'browser'},prepare=async(v=draft)=>(await agentApply(s,{type:'prepareAgent',visitId:v.id,version:v.version,providerId:'openai',task:'extract',input:'Weight 58 kg',context},actor('worker'),worker,ps)).runId;
 const run=id=>s.workspace.visits.flatMap(v=>v.agentRuns).find(r=>r.id===id);
 const [pending,running,review,applied]=[await prepare(),await prepare(),await prepare(),await prepare()],onConfirmed=await prepare();
 // A run whose visit was later confirmed: moved to the confirmed fixture visit.
 confirmed.agentRuns.push(...draft.agentRuns.splice(draft.agentRuns.findIndex(r=>r.id===onConfirmed),1));
 const out=validateOutput(localExtract('Weight 58 kg'),'Weight 58 kg','extract').output;
 Object.assign(run(running),{status:'running',callCount:1,startedAt:now});Object.assign(run(review),{status:'review',callCount:1,output:out});Object.assign(run(applied),{status:'applied',callCount:1,output:out,appliedFields:['weight']});Object.assign(run(onConfirmed),{status:'applied',callCount:1,output:out,appliedFields:['weight']});
 check(()=>assert.ok([pending,running,review,applied,onConfirmed].every(id=>run(id).governance.id===first&&run(id).governance.manifestHash===entry(first).manifestHash)));
 check(()=>{const u=lc.capabilityUsage(s.workspace.visits,entry(first));assert.equal(u.total,5);assert.deepEqual(u.byStatus,{pending:1,running:1,review:1,applied:2});assert.ok(u.lastUsedAt)});
 check(()=>assert.deepEqual(lc.capabilityImpact(s.workspace.visits,entry(first)).counts,{cancel:1,'await-outcome':1,review:1,'check-applied':1},'confirmed visits keep their history and need no action here'));

 // Replacement: activating a reviewed revision retires the active one and records what replaced it.
 const second=(await gov({type:'createGovernance',spec:spec({changeSummary:'Second revision of the synthetic capability.',dailyCallLimit:40}),replacesId:first},author)).entryId;
 check(()=>{assert.equal(stage(second),'registered');assert.equal(stage(first),'active','a draft revision changes nothing')});
 const replaced=await promote(second,await evaluate(second));
 check(()=>{assert.equal(entry(first).state,'retired');assert.equal(entry(first).replacedBy,second);const l=lc.lifecycleStage(s,entry(first));assert.equal(l.stage,'replaced');assert.equal(l.detail,'Replaced by revision 2.');assert.equal(stage(second),'active');assert.equal(replaced.impact,undefined,'activation reports no impact')});
 check(()=>{const legacy=structuredClone(entry(first));delete legacy.replacedBy;assert.equal(lc.lifecycleStage(s,legacy).stage,'replaced','older records are matched through the replacement history');assert.equal(lc.replacementOf(s,legacy).id,second)});
 // Work under the replaced revision cannot continue: it is identified, the pending request is refused and the result cannot be applied.
 await status(()=>agentApply(s,{type:'applyAgent',visitId:draft.id,runId:review,version:draft.version,fields:['weight'],source:'measured',date:now.slice(0,16)},actor('worker'),worker,ps),409,/Capability review changed/);
 check(()=>assert.deepEqual(lc.capabilityImpact(s.workspace.visits,entry(first)).items.map(i=>[i.runId,i.action]),[[pending,'cancel'],[running,'await-outcome'],[review,'review'],[applied,'check-applied']]));
 await agentApply(s,{type:'cancelAgent',visitId:draft.id,runId:pending},actor('worker'),worker,ps);
 check(()=>assert.equal(lc.capabilityImpact(s.workspace.visits,entry(first)).counts.cancel,0,'a cancelled request leaves the queue'));
 const reviewed=await applyGovernance(s,{type:'reviewAgentResult',visitId:draft.id,runId:review,version:draft.version,decision:'rejected',reason:'Produced under a replaced capability version.',reference:'SYNTH-REF'},actor('worker'),worker,now);
 check(()=>{assert.ok(reviewed.ok);assert.equal(lc.capabilityImpact(s.workspace.visits,entry(first)).counts.review,0,'a recorded decision leaves the queue')});

 // Suspension of the active revision blocks new invocations and names the in-progress work.
 const onSecond=await prepare(),pendingSecond=await prepare();Object.assign(run(onSecond),{status:'review',callCount:1,output:out});
 const suspended=await gov({type:'transitionGovernance',entryId:second,version:entry(second).version,state:'suspended',reason:'Synthetic suspension for the lifecycle contract.'});
 check(()=>{assert.deepEqual(suspended.impact,{cancel:1,'await-outcome':0,review:1,'check-applied':0});assert.equal(stage(second),'suspended');assert.match(s.workspace.audit.at(-1).detail,/In-progress work: 1 unsent request to cancel, 1 result to review\./)});
 await status(()=>prepare(),409,/current, independently reviewed capability/);
 await status(()=>agentApply(s,{type:'applyAgent',visitId:draft.id,runId:onSecond,version:draft.version,fields:['weight'],source:'measured',date:now.slice(0,16)},actor('worker'),worker,ps),409,/independently reviewed capability/);
 check(()=>assert.equal(lc.requiredAction(draft,run(pendingSecond)),'cancel'));
 // A safety hold on a capability names its in-progress work in the safety case record.
 await gov({type:'transitionGovernance',entryId:second,version:entry(second).version,state:'retired',reason:'Withdrawn after the synthetic suspension.'});
 check(()=>{const l=lc.lifecycleStage(s,entry(second));assert.equal(l.stage,'retired');assert.equal(l.detail,'Withdrawn without a replacement.');assert.match(s.workspace.audit.at(-1).detail,/retired; synthetic use only\. In-progress work: 1 unsent request to cancel, 1 result to review\./)});
 const third=(await gov({type:'createGovernance',spec:spec({changeSummary:'Third revision after withdrawal of the second.'}),replacesId:second},author)).entryId;await promote(third,await evaluate(third));
 check(()=>assert.equal(lc.lifecycleStage(s,entry(second)).stage,'replaced','a later activated revision replaces a withdrawn one too'));
 const hold=await gov({type:'reportSafety',visitId:draft.id,version:draft.version,ownerId:'reviewer',kind:'misleading-output',summary:'Synthetic safety report placing a hold.',entryId:third,hold:true},reviewer);
 check(()=>{assert.ok(hold.caseId);assert.equal(stage(third),'suspended');assert.match(s.workspace.audit.at(-1).detail,/Capability suspended; in-progress work: no in-progress work\./)});
 check(()=>{assert.equal(lc.STAGE_LABEL['approved-for-scope'],'Approved for its scope');assert.equal(Object.keys(lc.STAGE_LABEL).length,7)});
 writeFileSync('tests/capability-lifecycle-contract-result.json',JSON.stringify({passed,suite:'capability-lifecycle-contract',completedAt:new Date().toISOString()},null,2)+'\n');console.log(JSON.stringify({passed}));
}finally{rmSync(dir,{recursive:true,force:true});}
