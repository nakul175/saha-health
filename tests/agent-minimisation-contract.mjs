// Slice R42 contract: comprehensive minimisation of AI provider payloads (BR-AG-02, BR-AI-08, BR-INT-09).
// The mapped payload allowlist is walked before sending: fields outside it are stripped, and a value that still
// leaks a patient identifier/name/village/ABHA/crosswalk value is refused rather than sent. The source check runs
// before a request is prepared (prepareAgent) and inside the external-execution checkpoint (executeAgent), across
// the whole organisation, not only the current patient. Mock transport only; no provider credentials are used.
import assert from 'node:assert/strict';import ts from 'typescript';import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';import {join} from 'node:path';import {pathToFileURL} from 'node:url';
const dir=mkdtempSync(join(process.cwd(),'.agent-minimisation-contract-'));let passed=0;
const check=fn=>{fn();passed++};
const status=async(fn,code,pattern)=>{try{await fn();}catch(e){assert.equal(e.status,code,e.message);if(pattern)assert.match(e.message,pattern);passed++;return e;}assert.fail(`expected ${code}`);};
const throws=fn=>{assert.throws(fn,e=>e&&typeof e==='object'&&'status' in e);passed++};
try{
 for(const file of (await import('node:fs')).readdirSync('lib/saha').filter(x=>x.endsWith('.ts')).map(x=>x.slice(0,-3)))writeFileSync(join(dir,file+'.js'),ts.transpileModule(readFileSync(`lib/saha/${file}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'"));
 const {collectSensitive,checkAgentSource,minimiseAgentPayload,PAYLOAD_KEYS}=await import(pathToFileURL(join(dir,'agent-minimisation.js')));
 const {invokeAgent}=await import(pathToFileURL(join(dir,'agent-provider.js')));
 const {agentApply,providers,AGENT_VERSION,current}=await import(pathToFileURL(join(dir,'agent.js')));

 // ---- collectSensitive: the comprehensive identifier set, across the whole organisation ----
 const org={workspace:{people:[
  {id:'p1',name:'Ravi Kumar',village:'Shivpuri',abha:{number:'12-3456-7890-1234',address:'ravi.kumar@abdm'},identifiers:[{issuer:'RCH',value:'1234567890123456'}]},
  {id:'patient-other-002',name:'Asha Devi',village:'Rampur',identifiers:[{issuer:'Ni-kshay',value:'NI-98765'}]}
 ],visits:[{id:'visit-1',personId:'p1'}]}};
 const sensitive=collectSensitive(org);
 check(()=>assert.ok(sensitive.has('ravi kumar'),'own name'));
 check(()=>assert.ok(sensitive.has('shivpuri'),'own village'));
 check(()=>assert.ok(sensitive.has('12-3456-7890-1234'),'grouped ABHA number'));
 check(()=>assert.ok(sensitive.has('12345678901234'),'plain ABHA number'));
 check(()=>assert.ok(sensitive.has('ravi.kumar@abdm'),'ABHA address'));
 check(()=>assert.ok(sensitive.has('1234567890123456'),'crosswalk identifier'));
 check(()=>assert.ok(sensitive.has('asha devi'),'another patient name'));
 check(()=>assert.ok(sensitive.has('patient-other-002'),'another patient record id'));
 check(()=>assert.ok(sensitive.has('rampur'),'another patient village'));
 check(()=>assert.ok(!sensitive.has('p1'),'internal record id is not collected'));
 check(()=>assert.ok(!sensitive.has('visit-1'),'internal visit id is not collected'));

 // ---- checkAgentSource: refuse when the source still carries data stripping cannot remove ----
 check(()=>{checkAgentSource('weight 58 kg',org)});
 throws(()=>checkAgentSource('Ravi Kumar weight 58 kg',org));
 throws(()=>checkAgentSource('BP 12-3456-7890-1234',org));
 throws(()=>checkAgentSource('12345678901234',org));
 throws(()=>checkAgentSource('contact ravi.kumar@abdm',org));
 throws(()=>checkAgentSource('RCH 1234567890123456',org));
 throws(()=>checkAgentSource('Asha Devi seen at home',org));
 throws(()=>checkAgentSource('retrieve patient-other-002',org));
 throws(()=>checkAgentSource('travelled from Rampur village',org));
 let caught;try{checkAgentSource('Ravi Kumar weight 58 kg',org)}catch(e){caught=e}
 check(()=>assert.equal(caught.status,422));
 check(()=>assert.match(caught.message,/cannot be removed/));

 // ---- minimiseAgentPayload: strip fields outside the allowlist, refuse values that cannot be reduced ----
 const at=new Date().toISOString();
 const cleanOpenai={model:'gpt-4.1-mini-2025-04-14',store:false,max_output_tokens:1400,instructions:'INSTRUCTIONS',input:'{"task":"extract","source":"weight 58 kg"}',text:{format:{type:'json_schema',name:'saha_evidence_v1',strict:true,schema:{type:'object'}}}};
 const r1=minimiseAgentPayload(cleanOpenai,'openai',sensitive,'before-send',at);
 check(()=>assert.equal(r1.check.passed,true,'clean openai payload passes'));
 check(()=>assert.deepEqual(r1.payload,cleanOpenai,'clean openai payload is unchanged'));
 check(()=>assert.equal(r1.check.stripped.length,0));
 const withExtra={...cleanOpenai,patientId:'p1',notes:'secret notes',phone:'9000000000',village:'Shivpuri'};
 const r2=minimiseAgentPayload(withExtra,'openai',sensitive,'before-send',at);
 check(()=>assert.equal(r2.check.passed,true,'stripped fields are removed, not refused'));
 check(()=>assert.ok(['patientId','notes','phone','village'].every(k=>r2.check.stripped.includes(k)),'extra fields stripped: '+JSON.stringify(r2.check.stripped)));
 check(()=>{for(const k of ['patientId','notes','phone','village'])assert.equal(k in r2.payload,false,k+' removed from payload')});
 check(()=>assert.deepEqual(r2.payload,cleanOpenai,'the reduced payload equals the allowlisted shape'));
 // A value that cannot be reduced is refused rather than sent.
 throws(()=>minimiseAgentPayload({...cleanOpenai,input:'{"task":"extract","source":"Ravi Kumar weight 58 kg"}'},'openai',sensitive,'before-send',at));
 const cleanHttp={contract:'saha-agent-v1',agentVersion:AGENT_VERSION,model:'example-v1',task:'extract',source:'weight 58 kg',outputSchema:{type:'object'},limits:{maxOutputTokens:1400,maxCalls:1},instructions:'INSTRUCTIONS'};
 const r3=minimiseAgentPayload(cleanHttp,'http',sensitive,'before-send',at);
 check(()=>{assert.equal(r3.check.passed,true);assert.deepEqual(r3.payload,cleanHttp)});
 // For HTTP the `name` and `abha` fields are not in the allowlist, so they are stripped (BR-AI-08-B).
 const r4=minimiseAgentPayload({...cleanHttp,name:'Ravi Kumar',abha:'12-3456-7890-1234'},'http',sensitive,'before-send',at);
 check(()=>{assert.equal(r4.check.passed,true);assert.ok(r4.check.stripped.includes('name'));assert.ok(r4.check.stripped.includes('abha'));assert.equal('name' in r4.payload,false);assert.equal('abha' in r4.payload,false)});
 throws(()=>minimiseAgentPayload({...cleanHttp,source:'Asha Devi weight 58 kg'},'http',sensitive,'before-send',at));

 // ---- invokeAgent: the built provider payload is minimised before it is sent ----
 const runtime={OPENAI_API_KEY:'test-not-a-real-key',SAHA_EXTERNAL_APIS_ENABLED:'true'};
 const versionPin={format:'saha-ai-version-pin-v1',capability:null,provider:{id:'openai',release:1},modelRelease:'gpt-4.1-mini-2025-04-14',agentRelease:'saha-agent-1.2.0',prompt:{id:'documentary-evidence',version:'1.2.0'},tool:{contract:'saha-agent-v1',version:1},data:{inputSchema:'saha-documentary-evidence-input-v1',outputSchema:'saha-evidence-v1',version:1},evaluation:null};
 const run={id:'contract-run',version:'saha-agent-1.2.0',versionPin,task:'extract',input:'weight 58 kg',provider:{id:'openai',version:1,mode:'openai',model:'gpt-4.1-mini-2025-04-14'}};
 let calls=0,seenBody=null;
 const send=async(url,init)=>{calls++;seenBody=JSON.parse(init.body);return Response.json({status:'completed',model:run.provider.model,output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({proposals:[],highlights:[]})}]}],usage:{input_tokens:10,output_tokens:10}})};
 const ok=await invokeAgent(run,{},runtime,[],send,sensitive);
 check(()=>{assert.equal(calls,1);assert.equal('patientId' in seenBody,false);assert.equal(seenBody.store,false);assert.equal(JSON.parse(seenBody.input).source,'weight 58 kg')});
 // A source that leaks an identifier is refused before the transport is called.
 let calls2=0;
 await status(()=>invokeAgent({...run,input:'Ravi Kumar weight 58 kg'},{},runtime,[],async()=>{calls2++;return new Response()},sensitive),409,/patient data|minimisation check/g);
 check(()=>assert.equal(calls2,0,'nothing was sent'));
 const integration={id:'custom',version:2,status:'active',endpoint:'https://provider.example/agent',credentialBinding:'SAHA_CUSTOM',agentContract:{version:1,model:'example-v1'}};
 const httpRuntime={SAHA_EXTERNAL_APIS_ENABLED:'true',SAHA_CUSTOM:'test',SAHA_ALLOWED_ORIGINS:'https://provider.example'};
 const customRun={...run,provider:{id:'custom',version:2,mode:'http',model:'example-v1'}};
 let httpCalls=0,seenHttp=null;
 const httpOk=await invokeAgent(customRun,{},httpRuntime,[integration],async(url,init)=>{httpCalls++;seenHttp=JSON.parse(init.body);return Response.json({proposals:[],highlights:[]})},sensitive);
 check(()=>{assert.equal(httpCalls,1);assert.equal(seenHttp.contract,'saha-agent-v1');assert.equal('name' in seenHttp,false);assert.equal('abha' in seenHttp,false);assert.equal(seenHttp.source,'weight 58 kg')});
 await status(()=>invokeAgent({...customRun,input:'Asha Devi weight 58 kg'},{},httpRuntime,[integration],async()=>new Response(),sensitive),409,/patient data|minimisation check/g);

 // ---- prepareAgent (before preparing): the source check runs on an external provider, organisation-wide ----
 const now=new Date().toISOString(),today=now.slice(0,10),later=new Date(Date.now()+60*86400000).toISOString().slice(0,10);
 const owner={userId:'owner',displayName:'Synthetic owner',role:'clinician',status:'active',teamIds:['team'],version:1,isOwner:true},reviewer={...owner,userId:'reviewer',isOwner:false},author={...owner,userId:'author',isOwner:false},worker={...owner,userId:'worker',isOwner:false};
 const p={id:'patient',name:'Synthetic Subject',village:'Test village',version:1,consentVersion:1,aiConsent:true,teamId:'team',assignedTo:'worker',assigned:true,age:32,programmes:['General care']};
 const other={id:'patient-other-002',name:'Crosspatient Name',village:'Othervillage'};
 const v={id:'visit',personId:p.id,version:3,recordVersion:1,state:'draft',facts:{date:now.slice(0,16),systolic:'120',diastolic:'80',weight:'58',temperature:'',weeks:'',coughDays:'',notes:'PRIVATE FREE TEXT MUST NOT BE SUMMARISED',source:'measured'},programmeCapture:{answers:{privateAnswer:'PRIVATE PROGRAMME ANSWER'}},agentRuns:[]};
 const ps=providers([],{OPENAI_API_KEY:'fake-fixture-key',SAHA_EXTERNAL_APIS_ENABLED:'true'}),openai=ps.find(x=>x.id==='openai');
 const spec={kind:'capability',key:'fixture-cap',title:'Synthetic capability',ownerId:'owner',teamIds:['team'],effectiveFrom:today,reviewBy:later,changeSummary:'Synthetic minimisation fixture only.',providerId:'openai',model:openai.model,agentVersion:AGENT_VERSION,purpose:'documentary-evidence',ageMin:18,ageMax:60,roles:['asha','clinician'],populations:['General care'],languages:['en'],settings:['community'],devices:['browser'],tasks:['extract','summary'],inputQuality:'validated-text',excludedUses:'No clinical decisions authorised.',supportContact:'Synthetic owner',hostingRegion:'Not activated',retentionTerms:'Synthetic test input only, no real data.',trainingUse:'not-authorised',agreementReference:'FIXTURE',dailyCallLimit:100,dailyTokenBudget:600000};
 const entry={id:'cap',revision:1,version:3,spec,manifestHash:'fixture-hash',createdBy:'author',createdAt:now,state:'active',history:[],review:{by:'reviewer',memberVersion:1,ownerVersion:1,authorVersion:1,dependencyStamp:'[]',evaluationId:'evaluation'}};
 const s={organisation:{id:'org'},teams:[{id:'team',name:'Care team'}],members:[owner,reviewer,author,worker],workspace:{people:[p,other],visits:[v],referrals:[],audit:[],role:'clinician',integrations:[]},governance:{entries:[entry],evaluations:[{id:'evaluation',entryId:entry.id,manifestHash:entry.manifestHash,corpusVersion:'fixture-v1',corpusHash:'fixture-corpus',provider:{id:'openai',version:1,mode:'openai',model:openai.model},results:[],state:'completed',metrics:{passed:true}}],safety:[]}};
 const actor=id=>({userId:id,displayName:'Synthetic '+id});
 const context={language:'en',setting:'community',device:'browser'};
 const prepare=(input,task='extract')=>agentApply(s,{type:'prepareAgent',visitId:v.id,version:v.version,providerId:'openai',task,input,context},actor('worker'),worker,ps);
 const cleanRunId=(await prepare('Weight 58 kg')).runId;
 check(()=>assert.ok(cleanRunId,'clean source prepares'));
 await status(()=>prepare('Crosspatient Name weight 58 kg'),422,/cannot be removed/);
 await status(()=>prepare('retrieve patient-other-002 measurements'),422,/cannot be removed/);
 const cleanRun=v.agentRuns.find(x=>x.id===cleanRunId);
 check(()=>assert.deepEqual(cleanRun.taskScope,{tenantId:'org',personId:'patient',encounterId:'visit',purpose:'documentary-evidence',policyVersion:'fixture-hash',fields:['source.numeric-observations'],key:'org|patient|visit|documentary-evidence|fixture-hash'}));
 check(()=>assert.match(cleanRun.steps[0].detail,/purpose, policy/));
 const summaryId=(await prepare('ignored for summary','summary')).runId,summary=v.agentRuns.find(x=>x.id===summaryId);
 check(()=>{assert.deepEqual(summary.taskScope.fields,['facts.date','facts.systolic','facts.diastolic','facts.weight','facts.temperature','facts.weeks','facts.coughDays']);assert.match(summary.input,/systolic: 120/);assert.doesNotMatch(summary.input,/PRIVATE|notes|source/)});
 const originalPurpose=cleanRun.taskScope.purpose;cleanRun.taskScope.purpose='changed-purpose';
 await status(async()=>current(s,v,cleanRun,worker,actor('worker'),ps),409,/authorised task scope changed/);
 cleanRun.taskScope.purpose=originalPurpose;
 check(()=>assert.equal(current(s,v,cleanRun,worker,actor('worker'),ps),p,'unchanged scope remains current'));

 writeFileSync('tests/agent-minimisation-contract-result.json',JSON.stringify({passed,suite:'agent-minimisation-contract',liveProviderTested:false,completedAt:new Date().toISOString(),coverage:'Comprehensive AI provider payload minimisation: the organisation-wide sensitive set (names, villages, ABHA, crosswalk identifiers); the source check refusing before preparation and inside the checkpoint; the payload allowlist strip and refusal for both OpenAI and HTTP provider shapes; the wired prepareAgent refusal on a cross-patient name.'},null,2)+'\n');
 console.log(JSON.stringify({passed,suite:'agent-minimisation-contract'}));
}finally{rmSync(dir,{recursive:true,force:true});}
