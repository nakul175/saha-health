// Slice 5f contract: shadow operation of a reviewed capability revision. Outputs are stored for governance
// comparison only, never in the visit; consent, restriction, budgets and lifecycle are respected; managers
// see counts per field only.
import assert from 'node:assert/strict';import ts from 'typescript';import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';import {join} from 'node:path';import {pathToFileURL} from 'node:url';
const dir=mkdtempSync(join(process.cwd(),'.shadow-contract-'));let passed=0;const check=fn=>{fn();passed++};
const status=(fn,code,pattern)=>{try{fn();}catch(e){assert.equal(e.status,code,e.message);if(pattern)assert.match(e.message,pattern);passed++;return e;}assert.fail(`expected ${code}`);};
try{
 for(const file of ['abdm', 'abdm-transfer', 'access', 'action-plan', 'adapter-operations', 'agent', 'agent-minimisation', 'ai-budget', 'alerts', 'anaemia', 'audit-chain', 'capability-lifecycle', 'caseload', 'consent', 'continuity', 'core', 'delegation', 'ehr', 'environment', 'evaluation', 'exceptional', 'expansion', 'facility-scope', 'fact-provenance', 'fhir-document', 'fhir-validate', 'field', 'field-registration', 'governance', 'household', 'household-constants', 'household-visit', 'household-visit-constants', 'identity', 'imported-visits', 'media', 'merge', 'mis', 'operations', 'outreach', 'pack-installation', 'partition', 'pilot', 'programme-commands', 'programmes','installed-transition-authority', 'provider-sandbox', 'purpose-scope', 'referral-needs', 'referral-request', 'referral-rules', 'retention', 'rights', 'seed', 'send-gate', 'service-identity', 'shadow', 'store', 'task-limits', 'types'])writeFileSync(join(dir,file+'.js'),ts.transpileModule(readFileSync(`lib/saha/${file}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'"));
 const S=await import(pathToFileURL(join(dir,'shadow.js'))),{providers,AGENT_VERSION}=await import(pathToFileURL(join(dir,'agent.js')));
 const t0=Date.now(),at=ms=>new Date(t0+ms).toISOString(),now=at(0),today=now.slice(0,10),day=n=>new Date(t0+n*86400000).toISOString().slice(0,10);
 const base={status:'active',version:1,isOwner:false};
 const owner={...base,userId:'owner',displayName:'Synthetic owner',role:'clinician',teamIds:['team','other'],isOwner:true},author={...base,userId:'author',displayName:'Synthetic manager',role:'clinician',teamIds:['team']},reviewer={...author,userId:'reviewer'},outside={...author,userId:'outside',teamIds:['other']};
 const asha={...base,userId:'asha',role:'asha',teamIds:['team']},supervisor={...base,userId:'supervisor',role:'supervisor',teamIds:['team']},admin={...base,userId:'admin',role:'admin',teamIds:[]},vendor={...base,userId:'vendor',role:'provider',teamIds:['team']};
 const person=(id,x={})=>({id,name:'Synthetic '+id,village:'Test village',version:1,consentVersion:1,aiConsent:true,teamId:'team',assigned:true,age:32,programmes:['General care'],...x});
 const people=[person('p1'),person('p2',{aiConsent:false}),person('p3',{restrictions:[{id:'r',at:now}]}),person('p4',{age:70}),person('p5',{teamId:'other'})];
 const facts=(x={})=>({date:today+'T10:00',systolic:'',diastolic:'',weight:'',temperature:'',weeks:'',coughDays:'',notes:'',source:'measured',...x});
 const visit=(id,personId,x={})=>({id,personId,version:2,recordVersion:1,state:'confirmed',createdAt:at(1000),confirmedAt:at(1000),facts:facts(),aiResults:[],agentRuns:[],...x});
 const local=providers([],{}).find(p=>p.id==='local');
 const spec={kind:'capability',key:'local-cap',title:'Synthetic local rules',ownerId:'owner',teamIds:['team'],effectiveFrom:today,reviewBy:day(60),changeSummary:'Synthetic shadow fixture only.',providerId:'local',model:local.model,agentVersion:AGENT_VERSION,purpose:'documentary-evidence',ageMin:18,ageMax:60,roles:['asha','clinician'],languages:['en'],settings:['community'],devices:['browser'],tasks:['extract'],excludedUses:'No clinical decisions authorised.',supportContact:'Synthetic owner',hostingRegion:'Local workspace',retentionTerms:'Synthetic test input only, no real data.',trainingUse:'not-authorised',agreementReference:'FIXTURE',dailyCallLimit:100,dailyTokenBudget:600000};
 const entry=(id,x={},sp={})=>({id,revision:1,version:2,spec:{...spec,...sp},manifestHash:'hash-'+id,createdBy:'author',createdAt:now,state:'reviewed',history:[],review:{by:'reviewer',memberVersion:1,ownerVersion:1,authorVersion:1,dependencyStamp:'[]',evaluationId:'ev-'+id},...x});
 const cap=entry('cap'),ext=entry('ext',{},{key:'ext-cap',title:'External fixture',providerId:'openai',model:'fixture-model'});
 const s={organisation:{id:'org'},teams:[{id:'team',name:'Team'},{id:'other',name:'Other'}],members:[owner,author,reviewer,outside,asha,supervisor,admin,vendor],workspace:{people,visits:[],referrals:[],audit:[],role:'clinician',integrations:[]},governance:{entries:[cap,ext,entry('draft',{state:'draft'},{key:'draft-cap'}),entry('live',{state:'active'},{key:'live-cap'})],evaluations:['cap','ext','draft','live'].map(x=>({id:'ev-'+x,entryId:x,manifestHash:'hash-'+x,state:'completed',metrics:{passed:true}})),safety:[]}};
 const actor=m=>({userId:m.userId,displayName:m.displayName??m.userId});
 const run=(c,m=author,when=now)=>S.applyShadow(s,c,actor(m),m,when);
 const start=(x={},m=author)=>run({type:'startShadow',entryId:'cap',version:2,scope:'teams',teamIds:['team'],until:day(14),reason:'Compare extraction with confirmed visits.',...x},m);

 // Who may start, and what may run in shadow.
 check(()=>{assert.equal(S.shadowManager(owner),true);assert.equal(S.shadowManager(author),true);assert.equal(S.shadowManager(admin),false);assert.equal(S.shadowManager(vendor),false);assert.equal(S.shadowManager(supervisor),false);});
 for(const m of [asha,supervisor,admin,vendor])status(()=>start({},m),403,/owner or clinician governance manager/);
 status(()=>start({},outside),403,/outside your team scope/);
 status(()=>start({scope:'organisation'}),403,/Only an owner/);
 status(()=>start({teamIds:['other']}),403,/within your management scope/);
 status(()=>start({entryId:'draft'}),409,/Only an independently reviewed revision/);
 status(()=>start({entryId:'live'}),409,/already active/);
 status(()=>start({version:1}),409,/changed/);
 status(()=>start({until:day(31)}),422,/at most 30 days/);
 status(()=>start({until:day(-1)}),422);
 check(()=>assert.equal(run({type:'startShadow',entryId:'cap',version:2,scope:'teams',until:day(3),reason:'short'}),null,'a short reason fails the schema'));
 const {shadowId}=start();
 check(()=>{const sh=s.governance.shadows[0];assert.equal(sh.id,shadowId);assert.deepEqual(sh.teamIds,['team']);assert.equal(sh.state,'active');assert.equal(sh.manifestHash,'hash-cap');assert.match(s.workspace.audit.at(-1).detail,/revision 1 \(Synthetic local rules\) put into shadow for 1 team\(s\).*never shown to field workers, applied or added to action plans/);});
 status(()=>start(),409,/already in shadow/);

 // Confirmed visits during the period, in scope.
 s.workspace.visits.push(
  visit('v1','p1',{facts:facts({notes:'Weight 60 kg; BP 120/80 mmHg; temperature 37.5 C',weight:'60.0',systolic:'120',diastolic:'85',coughDays:'4'})}),
  visit('v2','p1',{facts:facts({notes:'Weight [inaudible] kg',weight:'61'})}),
  visit('v3','p1',{facts:facts({weight:'59'})}),
  visit('v4','p2',{facts:facts({notes:'Weight 50 kg'})}),visit('v5','p3',{facts:facts({notes:'Weight 50 kg'})}),visit('v6','p4',{facts:facts({notes:'Weight 50 kg'})}),
  visit('v7','p5',{facts:facts({notes:'Weight 50 kg'})}),visit('v8','p1',{state:'draft',confirmedAt:undefined,facts:facts({notes:'Weight 50 kg'})}),
  visit('v9','p1',{confirmedAt:at(-60000),facts:facts({notes:'Weight 50 kg'})}),visit('v10','p1',{voidedAt:at(2000),facts:facts({notes:'Weight 50 kg'})}));
 const sh=()=>s.governance.shadows.find(x=>x.id===shadowId),version=()=>sh().version;
 check(()=>assert.deepEqual(S.eligibleVisits(s,sh()).map(v=>v.id),['v1','v2','v3','v4','v5','v6'],'confirmed, current, in period and in scope only'));
 const visitsBefore=JSON.stringify(s.workspace.visits),peopleBefore=JSON.stringify(s.workspace.people);
 status(()=>run({type:'runShadow',shadowId,version:version()},asha),403);
 const out=run({type:'runShadow',shadowId,version:version()},author,at(5000));
 check(()=>assert.deepEqual(out,{shadowId,processed:6,compared:1,unable:1,notRun:4,remaining:0}));
 check(()=>{assert.equal(JSON.stringify(s.workspace.visits),visitsBefore,'no visit, fact, version or assistant request changed');assert.equal(JSON.stringify(s.workspace.people),peopleBefore);});
 check(()=>{const r=sh().results.find(x=>x.visitId==='v1');assert.equal(r.status,'compared');assert.ok(r.output.proposals.length>=3,'the output itself is stored');assert.deepEqual(r.fields.map(f=>[f.field,f.outcome]),[['systolic','agreement'],['diastolic','disagreement'],['weight','agreement'],['temperature','not-recorded'],['coughDays','missing']]);});
 check(()=>{const r=sh().results.find(x=>x.visitId==='v2');assert.equal(r.status,'unable');assert.equal(r.output.assessment.reason,'noisy_input');assert.deepEqual(r.fields.map(f=>[f.field,f.outcome]),[['weight','unable']]);});
 check(()=>assert.deepEqual(Object.fromEntries(sh().results.filter(r=>r.status==='not-run').map(r=>[r.visitId,r.reason])),{v3:'no-source',v4:'consent',v5:'restricted',v6:'outside-scope'}));
 check(()=>assert.match(s.workspace.audit.at(-1).detail,/6 confirmed visit\(s\) processed \(1 compared, 1 unable to assess, 4 not run\); 0 remaining\. Nothing was shown to field workers or applied/));
 status(()=>run({type:'runShadow',shadowId,version:1}),409,/changed/);

 // The managers' report: counts only.
 const report=S.shadowReport(s,sh(),at(6000));
 check(()=>{assert.equal(report.state,'active');assert.deepEqual(report.visits,{total:6,compared:1,unable:1,notRun:{'no-source':1,consent:1,restricted:1,'outside-scope':1},recomputed:0,excluded:0});assert.equal(report.pending,0);assert.equal(report.startedBy,'Synthetic manager');});
 check(()=>assert.deepEqual(report.fields.map(f=>[f.field,f.agreement,f.disagreement,f.missing,f['not-recorded'],f.unable]),[['systolic',1,0,0,0,0],['diastolic',0,1,0,0,0],['weight',1,0,0,0,1],['temperature',0,0,0,1,0],['coughDays',0,0,1,0,0]]));
 check(()=>{const text=JSON.stringify(report);for(const leak of ['"v1"','"p1"','Weight 60','"120"','"37.5"','proposals','visitId','personId','"results"'])assert.ok(!text.includes(leak),leak);});
 check(()=>assert.equal(S.compare({facts:facts({temperature:'37.0'})},{proposals:[{field:'temperature',value:'37'}],highlights:[]})[0].outcome,'agreement','numeric comparison'));

 // Later visits: consent withdrawn after the start is respected.
 s.workspace.visits.push(visit('v11','p1',{confirmedAt:at(7000),facts:facts({notes:'Weight 62 kg',weight:'62'})}));
 people[0].aiConsent=false;
 check(()=>assert.equal(S.applyShadow(s,{type:'runShadow',shadowId,version:version()},actor(author),author,at(8000)).notRun,1));
 check(()=>assert.equal(sh().results.at(-1).reason,'consent'));
 people[0].aiConsent=true;s.workspace.visits.push(visit('v12','p1',{confirmedAt:at(9000),facts:facts({notes:'Weight 62 kg',weight:'62'})}));
 check(()=>assert.equal(S.applyShadow(s,{type:'runShadow',shadowId,version:version()},actor(owner),owner,at(10000)).compared,1));

 // Budgets: an external capability with its monthly budget reached is not run; otherwise it is not called in shadow.
 const extShadow=run({type:'startShadow',entryId:'ext',version:2,scope:'organisation',teamIds:[],until:day(7),reason:'External provider comparison fixture.'},owner).shadowId;
 check(()=>assert.deepEqual(s.governance.shadows.find(x=>x.id===extShadow).teamIds,['team'],'whole organisation = the overlap with the capability\'s reviewed teams (slice 6q; before 6q this was every organisation team)'));
 s.workspace.visits.push(visit('v13','p1',{confirmedAt:at(11000),facts:facts({notes:'Weight 62 kg'})}));
 s.operations={version:1,maintenance:false,reason:'',updatedAt:'',incidents:[],rates:null,budgets:[{capabilityKey:'ext-cap',monthlyUsd:1,setBy:'owner',setAt:now,reason:'Synthetic budget'}]};
 const extVersion=()=>s.governance.shadows.find(x=>x.id===extShadow).version;
 S.applyShadow(s,{type:'runShadow',shadowId:extShadow,version:extVersion()},actor(owner),owner,at(12000));
 check(()=>assert.deepEqual(s.governance.shadows.find(x=>x.id===extShadow).results.map(r=>[r.visitId,r.reason]).filter(([v])=>v==='v13'),[['v13','budget']],'no cost rates with a budget: refused as budget'));
 s.operations.budgets=[];s.workspace.visits.push(visit('v14','p1',{confirmedAt:at(13000),facts:facts({notes:'Weight 62 kg'})}));
 S.applyShadow(s,{type:'runShadow',shadowId:extShadow,version:extVersion()},actor(owner),owner,at(14000));
 check(()=>assert.equal(s.governance.shadows.find(x=>x.id===extShadow).results.find(r=>r.visitId==='v14').reason,'external-provider'));

 // Lifecycle: suspended or retired revisions do not run; the period is bounded; stopping.
 cap.state='suspended';
 check(()=>assert.equal(S.shadowState(s,sh(),at(15000)),'halted'));
 status(()=>S.applyShadow(s,{type:'runShadow',shadowId,version:version()},actor(author),author,at(15000)),409,/suspended.*do not run in shadow/);
 cap.state='retired';status(()=>S.applyShadow(s,{type:'runShadow',shadowId,version:version()},actor(author),author,at(15000)),409,/retired/);
 cap.state='reviewed';
 status(()=>S.applyShadow(s,{type:'runShadow',shadowId,version:version()},actor(author),author,new Date(t0+15*86400000).toISOString()),409,/period has ended/);
 check(()=>assert.equal(S.shadowState(s,sh(),new Date(t0+15*86400000).toISOString()),'ended'));
 status(()=>run({type:'stopShadow',shadowId,version:1,reason:'Enough evidence gathered.'}),409,/changed/);
 run({type:'stopShadow',shadowId,version:version(),reason:'Enough evidence gathered.'});
 check(()=>{assert.equal(sh().state,'stopped');assert.equal(sh().stopReason,'Enough evidence gathered.');assert.match(s.workspace.audit.at(-1).detail,/Shadow operation stopped after 8 visit\(s\)/);});
 status(()=>run({type:'stopShadow',shadowId,version:version(),reason:'Enough evidence gathered.'}),409,/already stopped/);
 status(()=>run({type:'runShadow',shadowId,version:version()}),409,/stopped/);
 check(()=>assert.ok(start().shadowId,'a new shadow can start once the previous one is stopped'));
 check(()=>assert.equal(S.authorizeShadow(s,asha,{type:'checkProtocol'}),undefined,'other commands are not shadow commands'));

 // Slice 6q (second independent review): shadow teams are limited to the capability's reviewed teams; running and
 // stopping need an owner or a member of every shadow team; visits outside the runner's care scope are skipped and counted.
 status(()=>run({type:'startShadow',entryId:'ext',version:2,scope:'teams',teamIds:['team','other'],until:day(3),reason:'Owner tries a team the capability was not reviewed for.'},owner),422,/reviewed for/);
 const latest=s.governance.shadows.at(-1),elsewhere={...owner,userId:'elsewhere',teamIds:['other']},pendingNow=S.eligibleVisits(s,latest).length;
 check(()=>assert.ok(pendingNow>0));
 const skipped=S.applyShadow(s,{type:'runShadow',shadowId:latest.id,version:latest.version},actor(elsewhere),elsewhere,at(16000));
 check(()=>{assert.equal(skipped.processed,0,'an owner outside the team processes no visit');assert.equal(skipped.outsideCareScope,pendingNow);assert.equal(latest.results.length,0);assert.match(s.workspace.audit.at(-1).detail,/outside the runner's care scope were skipped/);});
 check(()=>assert.equal(S.applyShadow(s,{type:'runShadow',shadowId:latest.id,version:latest.version},actor(author),author,at(17000)).processed,pendingNow,'a runner in scope processes the skipped visits'));
 const legacy={id:'legacy',entryId:'cap',revision:1,manifestHash:'hash-cap',key:'local-cap',scope:'organisation',teamIds:['team','other'],startedAt:now,until:day(7),startedBy:'owner',reason:'Stored before slice 6q.',state:'active',version:1,results:[]};s.governance.shadows.push(legacy);
 status(()=>S.authorizeShadow(s,author,{type:'runShadow',shadowId:'legacy'}),403,/every team/);
 status(()=>run({type:'runShadow',shadowId:'legacy',version:1},author),403,/every team/);
 status(()=>run({type:'stopShadow',shadowId:'legacy',version:1,reason:'Stopping a shadow of another team.'},author),403,/every team/);
 check(()=>assert.ok(!S.eligibleVisits(s,legacy).some(v=>v.personId==='p5'),'a stored shadow never reaches teams outside the reviewed teams'));
 S.applyShadow(s,{type:'runShadow',shadowId:'legacy',version:1},actor(owner),owner,at(18000));
 check(()=>assert.ok(legacy.results.length>0&&!legacy.results.some(r=>r.personId==='p5')));

 const result={suite:'Shadow operation contract (slice 5f)',passed,completedAt:new Date().toISOString()};
 writeFileSync('tests/shadow-contract-result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{rmSync(dir,{recursive:true,force:true});}
