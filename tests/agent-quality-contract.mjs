// Slice 5c contract: explicit unable-to-assess outcomes (BR-AI-06) and conflicting assistant values (BR-AG-08).
// Input quality is checked before local extraction; a provider that cannot assess proposes nothing. A value that
// conflicts with a recorded fact or another open result is flagged on both sides, listed in the action plan and
// applied only after an explicit choice with a reason. Mock transport only; no provider credentials are used.
import assert from 'node:assert/strict';import ts from 'typescript';import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';import {join} from 'node:path';import {pathToFileURL} from 'node:url';
const dir=mkdtempSync(join(process.cwd(),'.agent-quality-contract-'));let passed=0;const check=fn=>{fn();passed++};
const status=async(fn,code,pattern)=>{try{await fn();}catch(e){assert.equal(e.status,code,e.message);if(pattern)assert.match(e.message,pattern);passed++;return e;}assert.fail(`expected ${code}`);};
try{
 for(const file of ['abdm', 'abdm-transfer', 'access', 'action-plan', 'adapter-operations', 'agent', 'agent-minimisation', 'agent-provider', 'ai-budget', 'alerts', 'anaemia', 'audit-chain', 'capability-lifecycle', 'caseload', 'consent', 'continuity', 'core', 'delegation', 'ehr', 'environment', 'evaluation', 'exceptional', 'expansion', 'facility-scope', 'fact-provenance', 'fhir-document', 'fhir-validate', 'field', 'field-registration', 'governance', 'household', 'household-constants', 'household-visit', 'household-visit-constants', 'identity', 'imported-visits', 'media', 'merge', 'mis', 'operations', 'outreach', 'pack-installation', 'partition', 'pilot', 'programme-commands', 'programmes', 'provider-sandbox', 'purpose-scope', 'referral-needs', 'referral-request', 'referral-rules', 'retention', 'rights', 'seed', 'send-gate', 'service-identity', 'shadow', 'store', 'task-limits', 'types'])writeFileSync(join(dir,file+'.js'),ts.transpileModule(readFileSync(`lib/saha/${file}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'"));
 const {localAssess,localExtract,validateOutput,conflictsFor,markConflicts,describeConflicts,agentApply,providers,AGENT_VERSION}=await import(pathToFileURL(join(dir,'agent.js')));
 const {invokeAgent,OUTPUT_SCHEMA,INSTRUCTIONS}=await import(pathToFileURL(join(dir,'agent-provider.js'))),{EVALUATION_CASES,scoreEvaluation}=await import(pathToFileURL(join(dir,'evaluation.js'))),{actionPlan}=await import(pathToFileURL(join(dir,'action-plan.js')));
 const reason=x=>localAssess(x)?.reason??null;

 // Input quality: noisy, unsupported and insufficient input are explicit outcomes, never an empty result.
 check(()=>assert.equal(AGENT_VERSION,'saha-agent-1.2.0'));
 for(const x of ['weight 5? kg; BP 120/? mmHg','Weight [inaudible] kg','BP 1?0/80 mmHg','Temperature 3_7 C','Weight � kg'])check(()=>assert.equal(reason(x),'noisy_input',x));
 for(const x of ['Weight 130 pounds; temperature 100 F','Weight 130 lbs','Temperature 99.1 °F'])check(()=>assert.equal(reason(x),'unsupported_case',x));
 for(const x of ['Patient comfortable today, no complaints','Seen at home with her mother','No cough for 4 days','Weight not measured; BP unknown','Maybe weight 58 kg; temperature 37 C'])check(()=>assert.equal(reason(x),'insufficient_input',x));
 check(()=>assert.equal(reason('वजन 58 किलोग्राम'),'unsupported_case'));
 for(const x of ['Weight 58 kg','Feeling better? Weight 58 kg'])check(()=>assert.equal(reason(x),null,x));
 const run=(input,extra={})=>({id:'quality-run',task:'extract',input,provider:{id:'local',mode:'local',model:'structured-parser-v2'},...extra});
 const noisy=await invokeAgent(run('weight 58 kg; BP 120/? mmHg'),{},{},[]);
 check(()=>{assert.deepEqual(noisy.output.proposals,[],'the legible weight is withheld too');assert.equal(noisy.output.assessment.status,'unable_to_assess');assert.equal(noisy.output.assessment.reason,'noisy_input');assert.match(noisy.message,/^Unable to assess: .*Re-enter.*not a normal or negative result/)});
 const empty=await invokeAgent(run('Weight not measured; BP unknown'),{},{},[]);
 check(()=>{assert.equal(empty.output.assessment.reason,'insufficient_input','a stated absence is not converted into a negative result');assert.match(empty.message,/structured capture/)});
 const summary=await invokeAgent(run('Patient comfortable today',{task:'summary'}),{},{},[]);check(()=>assert.equal(summary.output.assessment,undefined,'only extraction checks measurement quality'));

 // The output contract: an unable-to-assess answer carries no values; null is accepted from strict JSON providers.
 const unable={status:'unable_to_assess',reason:'noisy_input',detail:'Unreadable value.',retry:'Re-enter it.'},input='Weight 58 kg',proposal={field:'weight',value:'58',quote:'Weight 58 kg',start:0,end:12};
 check(()=>assert.throws(()=>validateOutput({proposals:[proposal],highlights:[],assessment:unable},input,'extract'),/must not propose values/));
 check(()=>assert.deepEqual(validateOutput({proposals:[],highlights:[],assessment:unable},input,'extract').output,{proposals:[],highlights:[],assessment:unable}));
 check(()=>assert.equal('assessment' in validateOutput({proposals:[proposal],highlights:[],assessment:null},input,'extract').output,false));
 check(()=>assert.throws(()=>validateOutput({proposals:[],highlights:[],assessment:{...unable,reason:'low_risk'}},input,'extract'),/contract/));
 check(()=>assert.throws(()=>validateOutput({proposals:[],highlights:[],assessment:{...unable,status:'negative'}},input,'extract'),/contract/));
 check(()=>{assert.ok(OUTPUT_SCHEMA.required.includes('assessment'));assert.deepEqual(OUTPUT_SCHEMA.properties.assessment.anyOf[1].properties.reason.enum,['insufficient_input','noisy_input','unsupported_case']);assert.match(INSTRUCTIONS,/unable_to_assess/);assert.match(INSTRUCTIONS,/Never report an unreadable measurement as absent or normal/)});
 const integration={id:'custom',version:2,status:'active',endpoint:'https://provider.example/agent',credentialBinding:'SAHA_CUSTOM',agentContract:{version:1,model:'example-v1'}},runtime={SAHA_EXTERNAL_APIS_ENABLED:'true',SAHA_CUSTOM:'test',SAHA_ALLOWED_ORIGINS:'https://provider.example'};
 const custom=await invokeAgent(run('Cough recording, heavy background noise',{provider:{id:'custom',version:2,mode:'http',model:'example-v1'}}),{},runtime,[integration],async()=>Response.json({proposals:[],highlights:[],assessment:{...unable,detail:'Recording too noisy to assess.'}}));
 check(()=>{assert.equal(custom.output.assessment.reason,'noisy_input');assert.match(custom.message,/Recording too noisy to assess/)});
 await status(()=>invokeAgent(run('Weight 58 kg',{provider:{id:'custom',version:2,mode:'http',model:'example-v1'}}),{},runtime,[integration],async()=>Response.json({proposals:[proposal],highlights:[],assessment:unable})),502,/must not propose values/);

 // The synthetic corpus still passes in English; the noisy and unsupported cases are now explicit.
 const cases=EVALUATION_CASES.filter(c=>c.language==='en'),results=[];for(const c of cases){const r=await invokeAgent(run(c.input),{},{},[]);results.push({caseId:c.id,state:'completed',output:r.output});}
 check(()=>{const m=scoreEvaluation(cases,results);assert.equal(m.passed,true);assert.equal(m.criticalFailures,0)});
 check(()=>assert.deepEqual(results.filter(r=>r.output.assessment).map(r=>[r.caseId,r.output.assessment.reason]),[['unsupported-unit','unsupported_case'],['noise','noisy_input']]));

 // Conflicts with recorded facts and between open results on the same visit version.
 const now=new Date().toISOString();
 const worker={userId:'worker',displayName:'Synthetic worker',role:'clinician',status:'active',teamIds:['team'],version:1,isOwner:false},peer={...worker,userId:'peer'};
 const p={id:'patient',name:'Synthetic Subject',village:'Test village',version:1,consentVersion:1,aiConsent:true,teamId:'team',assignedTo:'worker',assigned:true,age:32,programmes:['General care']};
 const v={id:'visit',personId:p.id,version:3,recordVersion:1,state:'draft',facts:{date:now.slice(0,16),systolic:'',diastolic:'',weight:'60',temperature:'',weeks:'',coughDays:'',notes:'',source:'measured'},agentRuns:[]};
 const s={organisation:{id:'org'},teams:[{id:'team',name:'Care team'}],members:[worker,peer],workspace:{people:[p],visits:[v],referrals:[],audit:[],role:'clinician',integrations:[]},governance:{entries:[],evaluations:[],safety:[]}};
 const ps=providers([],{}),actor=id=>({userId:id,displayName:'Synthetic '+id});
 // Mirrors executeAgent's result step: the validated output is stored and conflicts are marked on every open result.
 const result=async(text)=>{const {runId}=await agentApply(s,{type:'prepareAgent',visitId:v.id,version:v.version,providerId:'local',task:'extract',input:text},actor('worker'),worker,ps);const r=v.agentRuns.find(x=>x.id===runId);const o=await invokeAgent(r,v,{},[]);Object.assign(r,{status:'review',callCount:1,output:o.output,warnings:o.warnings,message:o.message,...(o.output.assessment?{assessment:o.output.assessment}:{})});markConflicts(v);return r;};
 const apply=(r,extra={})=>agentApply(s,{type:'applyAgent',visitId:v.id,runId:r.id,version:v.version,fields:['weight'],includeNote:false,resolve:[],source:'measured',date:now.slice(0,16),...extra},actor('worker'),worker,ps);
 const a=await result('Weight 58 kg; BP 120/80 mmHg');
 check(()=>assert.deepEqual(a.conflicts,[{field:'weight',kind:'recorded',proposed:'58',other:'60'}],'systolic and diastolic were blank, so only weight conflicts'));
 const b=await result('Weight 64 kg');
 check(()=>{assert.deepEqual(a.conflicts.map(x=>[x.kind,x.other]),[['recorded','60'],['other-run','64']]);assert.deepEqual(b.conflicts.map(x=>[x.kind,x.proposed,x.other]),[['recorded','64','60'],['other-run','64','58']]);assert.equal(b.conflicts[1].otherRunId,a.id)});
 check(()=>assert.match(describeConflicts(a.conflicts),/proposed 58, recorded 60; proposed 58, another request \(Local record assistant\) proposed 64/));
 const unableRun=await result('Weight 6? kg');
 check(()=>{assert.equal(unableRun.assessment.reason,'noisy_input');assert.equal(unableRun.conflicts,undefined,'an unassessed result has no values to conflict');assert.equal(a.conflicts.length,2)});
 // The action plan holds one review task listing both original values and no combined value.
 let plan=actionPlan(s,worker,p,now).items;const task=()=>plan.find(i=>i.kind==='ai-disagreement');
 check(()=>{assert.ok(task());assert.equal(task().status,'Awaiting reviewer choice');assert.deepEqual(task().sources.map(x=>x.id).sort(),[a.id,b.id].sort());assert.match(task().reason,/weight: 58 \(Local record assistant\) vs 64 \(Local record assistant\)/);assert.equal(task().owner.userId,'worker');assert.equal(plan.filter(i=>i.kind==='ai-disagreement').length,1)});
 check(()=>assert.doesNotMatch(JSON.stringify([plan,a.conflicts,b.conflicts,a.warnings,b.warnings]),/\b61\b/,'no average of 58 and 64 appears anywhere'));
 // Applying a conflicting value needs an explicit choice and a reason; nothing changes before that.
 await status(()=>apply(a),409,/Weight · kg: proposed 58, recorded 60; .*proposed 64\. Choose explicitly/);
 await status(()=>apply(a,{resolve:['systolic']}),422,/Resolve only selected fields/);
 await status(()=>apply(a,{fields:['systolic','diastolic'],resolve:['systolic']}),422,/Resolve only selected fields/);
 await status(()=>apply(a,{resolve:['weight']}),422,/Give a reason/);
 await status(()=>apply(unableRun),409,/could not assess its input/);
 check(()=>{assert.equal(v.facts.weight,'60');assert.equal(a.status,'review');assert.equal(v.version,3)});
 const audit=s.workspace.audit.length;await apply(a,{resolve:['weight'],conflictReason:'Re-weighed on the calibrated scale: 58 kg.'});
 check(()=>{assert.equal(v.facts.weight,'58');assert.equal(a.status,'applied');assert.deepEqual(a.resolutions.map(x=>[x.field,x.proposed,x.replaced]),[['weight','58',['recorded 60','Local record assistant 64']]]);assert.equal(a.resolutions[0].by,'worker')});
 check(()=>assert.match(s.workspace.audit.at(-1).detail,/Conflicts resolved by explicit choice: weight 58 over recorded 60 and Local record assistant 64\. Reason: Re-weighed/));
 check(()=>assert.equal(s.workspace.audit.length,audit+1));
 // The other original output is kept, but it is stale and cannot be applied; the review task closes.
 await status(()=>apply(b,{resolve:['weight'],conflictReason:'Trying the stale competing value.'}),409,/changed/);
 check(()=>{assert.equal(b.status,'review');assert.equal(b.output.proposals[0].value,'64')});
 plan=actionPlan(s,worker,p,now).items;check(()=>assert.equal(task(),undefined));
 // A value equal to the recorded fact is not a conflict.
 const same=await result('Weight 58 kg');check(()=>assert.equal(same.conflicts,undefined));
 await apply(same);check(()=>assert.equal(same.status,'applied'));
 writeFileSync('tests/agent-quality-contract-result.json',JSON.stringify({passed,suite:'agent-quality-contract',liveProviderTested:false,completedAt:new Date().toISOString()},null,2)+'\n');console.log(JSON.stringify({passed}));
}finally{rmSync(dir,{recursive:true,force:true});}
