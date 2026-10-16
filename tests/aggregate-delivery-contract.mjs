import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
// Slice 7g: aggregate report delivery to aggregate-only destinations (BR-INT-09, BR-REP-05).
const dir=mkdtempSync(join(process.cwd(),'.aggregate-delivery-'));let passed=0;const failures=[];
const check=async(name,f)=>{try{await f();passed++;}catch(e){failures.push(name+': '+(e?.stack??e));}};
const rejects=async(f,status,re)=>{let err;try{await f();}catch(e){err=e;}assert.ok(err,'expected a refusal');assert.equal(err.status,status,err.message);if(re)assert.match(err.message,re);return err;};
try{
 const tx=(src,out)=>writeFileSync(join(dir,out+'.js'),ts.transpileModule(readFileSync(`lib/saha/${src}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'"));
 for(const f of ['operations','access','types','programmes','abdm','abdm-transfer','access','action-plan','adapter-operations','agent','agent-minimisation','aggregate-alert-disclosure','ai-budget','alerts','anaemia','audit-chain','availability-types','capability-lifecycle','caseload','consent','continuity','core','delegation','ehr','environment','evaluation','exceptional','expansion','facility-scope','fact-provenance','fhir-document','fhir-validate','field','field-registration','frontline','governance','household','household-constants','household-visit','household-visit-constants','identity','imported-visits','indicator-differencing','indicator-ledger','indicators','installed-pack-work','installed-transition-authority','media','merge','mis','mis-callback','operational-disclosure','operations','outreach','pack-installation','partition','pilot','programme-commands','programme-completion','programmes','provider-sandbox','purpose-scope','referral-needs','referral-request','referral-rules','reminder-optout','retention','rights','seed','send-gate','service-identity','shadow','speech','store','task-limits','team-pack-adoption','types','verification-disputes','adapter-operations','service-dispatch','audit-chain','core','fact-provenance','delegation','indicators','indicator-differencing','continuity','referral-rules','mis','aggregate-delivery','aggregate-execution','trace','task-limits','facility-scope','purpose-scope','service-identity','identity'])tx(f,f);
 tx('indicator-ledger','indicator-ledger-real');
 // Injectable persistence (a hook runs after each commit), access audit and differencing ledger. The HTTP suite runs the real D1 versions.
 writeFileSync(join(dir,'store.js'),`import {AppError} from './core.js'; export let saved;let hook=null;export const log=[];export function setup(s,h=null){saved=structuredClone(s);hook=h;log.length=0}export function setHook(h){hook=h}export async function readState(){return structuredClone(saved)}export function scope(s,id){const m=s.members.find(m=>m.userId===id);if(!m||m.status==='suspended')throw new AppError(403,'Member revoked');return m}export async function persist(db,before,after,u,c){if(before.organisation.revision!==saved.organisation.revision)throw new AppError(409,'CAS conflict');saved=structuredClone(after);saved.organisation.revision++;log.push('persist:'+c.type);if(hook)hook(saved,c);}`);
 writeFileSync(join(dir,'access-audit.js'),`import {log} from './store.js';import {AppError} from './core.js';export let failNext=false;export function failAudit(v){failNext=v}export const events=[];export async function recordAccess(db,s,u,m,a){if(failNext)throw new AppError(503,'Saha could not record this access in the audit log, so it was stopped: nothing was shown or sent.');events.push(a);log.push('access:'+a.action);}`);
 writeFileSync(join(dir,'indicator-ledger.js'),`export {candidateReleases,ledgerHash} from './indicator-ledger-real.js';export let ledger=[];export function resetLedger(){ledger=[]}export async function readLedger(){return {ledger:structuredClone(ledger),text:JSON.stringify(ledger)}}export async function writeLedger(db,org,prev,next){if(prev!==JSON.stringify(ledger))return false;ledger=structuredClone(next);return true}`);
 const imp=f=>import(pathToFileURL(join(dir,f+'.js')));
 const D=await imp('aggregate-delivery'),store=await imp('store'),audit=await imp('access-audit'),L=await imp('indicator-ledger'),{executeAggregate}=await imp('aggregate-execution'),{AppError}=await imp('core');
 const old='2026-01-01T08:00:00.000Z',recent=new Date(Date.now()-2*86400000).toISOString(),today=new Date().toISOString().slice(0,10),start=new Date(Date.now()-20*86400000).toISOString().slice(0,10);
 const member=(userId,role,teamIds,over={})=>({userId,displayName:'Synthetic '+userId,accountCode:'X',role,isOwner:false,status:'active',version:1,teamIds,createdAt:old,...over});
 const base={age:30,sex:'Female',task:'Visit',due:'Today',status:'due',aiConsent:false,exchangeConsent:false,consentVersion:1,createdAt:old,version:1,assignedTo:'asha',assigned:true,programmes:['General care']};
 const def=(id,title,filters={})=>({id,version:1,status:'active',spec:{title,unit:'count',numerator:'patients',denominator:null,filters,exclude:[],exclusionsNote:'None',owner:'Programme manager',cadence:'Monthly',minimumCohort:5},reason:'Synthetic definition for tests',by:'own',byName:'Owner',at:old});
 const fresh=(over={})=>{const people=[];const add=(n,village,team,o={})=>{for(let i=0;i<n;i++)people.push({...base,id:`${team}-${village}-${i}`,name:`Synthetic ${village} ${i}`,village,teamId:team,...o});};
  add(7,'Alpur','t1');add(3,'Bedi','t1');add(3,'Bedi','t1',{sex:'Male'});add(9,'Chak','t2');
  return {organisation:{id:'org',revision:1},teams:[{id:'t1',name:'Team one'},{id:'t2',name:'Team two'},{id:'t3',name:'Team three'}],invitations:[],
   members:[member('sup','supervisor',['t1','t2']),member('sup2','supervisor',['t1','t2']),member('own','clinician',['t1','t2'],{isOwner:true}),member('sup3','supervisor',['t2']),member('asha','asha',['t1']),member('adm','admin',['t1','t2'],{isOwner:true})],
   operations:{version:0,maintenance:false,reason:'',updatedAt:'',incidents:[],rates:null,indicatorDefinitions:[def('all-people','People in the cohort'),def('female-people','Women in the cohort',{sex:'Female'})]},
   workspace:{people,visits:people.map(p=>({id:'v-'+p.id,personId:p.id,state:'confirmed',createdAt:recent,confirmedAt:recent,facts:{}})),submissions:[],referrals:[],audit:[],
    integrations:[{id:'agg',kind:'mis',mode:'demo',name:'District aggregate MIS',status:'active',version:1,operations:{version:1,allowed:['aggregate','lookup'],aggregateOnly:true,setBy:'own',setAt:old,reason:'Aggregate only',history:[]}},
     {id:'agg-lost',kind:'mis',mode:'demo',behavior:'uncertain',name:'Lossy aggregate MIS',status:'active',version:1,operations:{version:1,allowed:['aggregate','lookup'],aggregateOnly:true,setBy:'own',setAt:old,reason:'Aggregate only',history:[]}},
     {id:'reg',kind:'mis',mode:'demo',name:'Register',status:'active',version:1},
     {id:'agg-http',kind:'mis',mode:'http',name:'HTTP aggregate',status:'active',version:1,operations:{version:1,allowed:['aggregate'],aggregateOnly:true,setBy:'own',setAt:old,reason:'Aggregate only',history:[]}}]},...over};};
 const U=id=>({userId:id,displayName:'Synthetic '+id,email:id+'@example.invalid'});
 let n=0;const key=()=>'key_'+(++n);
 const as=async(id,c,transport)=>{const s=await store.readState();const m=store.scope(s,id);D.authorizeAggregate(s,m,c);return executeAggregate(null,s,c,U(id),m,key(),'hash',transport);};
 const prep=(over={})=>({type:'prepareAggregateReport',destinationId:'agg',definitions:['all-people','patients-seen'],period:{start,end:today},teamIds:['t1','t2'],group:'none',...over});
 const report=id=>store.saved.operations.aggregateReports.find(r=>r.id===id);
 const sha=x=>createHash('sha256').update(x).digest('hex');
 const calls=[];const spy=(inner=D.demoAggregateTransport)=>async(i,body,k)=>{calls.push({i:i.id,body,k});return inner(i,body,k);};

 // 1. Schema and scope: owners or supervisors for their own teams; administrators and ASHAs refused; replay rechecks.
 await check('schema and reporting scope',async()=>{
  const S=D.aggregateSchema;
  assert.equal(S.safeParse(prep()).success,true);
  assert.equal(S.safeParse(prep({definitions:['a-b','a-b']})).success,false);
  assert.equal(S.safeParse(prep({definitions:Array.from({length:9},(_,i)=>'x'+i)})).success,false);
  assert.equal(S.safeParse(prep({period:{start:'1 Sep',end:today}})).success,false);
  assert.equal(S.safeParse({...prep(),personId:'x'}).success,false,'no extra field');
  store.setup(fresh());
  for(const id of ['asha','adm'])await rejects(()=>as(id,prep()),403,/supervisors and owners/);
  await rejects(()=>as('sup3',prep()),403,/your own reporting scope/);
  await rejects(()=>as('own',prep({teamIds:['t3']})),403,/your own reporting scope/,'owner authority does not widen the teams');
  await rejects(()=>as('sup',prep({destinationId:'reg'})),422,/not an aggregate-only destination/);
  await rejects(()=>as('sup',prep({destinationId:'agg-http'})),409,/demonstration destinations only/);
  await rejects(()=>as('sup',prep({period:{start,end:'2999-01-01'}})),422,/cannot end after today/);
  await rejects(()=>as('sup',prep({period:{start:'2024-01-01',end:today}})),422,/at most 366 days/);
  await rejects(()=>as('sup',prep({period:{start:today,end:start}})),422,/end on or after/);
  const narrowed=fresh();narrowed.workspace.integrations[0].operations={...narrowed.workspace.integrations[0].operations,version:2,allowed:['lookup','aggregate'].filter(x=>x!=='aggregate')};store.setup(narrowed);
  await rejects(()=>as('sup',prep()),409,/not permitted to receive aggregate reports.*Nothing was prepared/);
  assert.equal(store.saved.operations.aggregateReports,undefined,'nothing prepared');
 });
 // 2. Minimisation: patient-level fields and identifier values, extra fields, and released cells from 1 to 4 are refused.
 await check('payload minimisation check',async()=>{
  const s=fresh();const ok={contract:'saha-aggregate-v1',environment:'synthetic',operation:'aggregate',report:{id:'r',period:{start,end:today},group:'none',minimumCell:5,computedAt:recent},manifest:{definitions:[{id:'a',version:1,canonicalSha256:'0'.repeat(64)}],rows:1,sha256:'0'.repeat(64)},blocks:[{team:'Team one',indicator:'a',version:1,unit:'count',withheld:null,cells:[{group:'All',value:12,numerator:12,denominator:null,suppressed:false},{group:'Bedi',value:null,numerator:null,denominator:null,suppressed:true},{group:'Zero',value:0,numerator:0,denominator:null,suppressed:false}]}]};
  const c=D.minimisationCheck(ok,s,'prepare',recent);assert.equal(c.passed,true,c.problems.join());assert.equal(c.cells,3);assert.ok(c.fields>20);
  const bad=(f)=>{const p=structuredClone(ok);f(p);return D.minimisationCheck(p,s,'before-send',recent);};
  assert.match(bad(p=>p.blocks[0].cells[0].personId='t1-Alpur-0').problems.join(),/Patient-level field "personId"/);
  assert.match(bad(p=>p.report.notes='x').problems.join(),/Patient-level field "notes"/);
  assert.match(bad(p=>p.extra=1).problems.join(),/An unexpected field is not part of the aggregate contract/);
  assert.match(bad(p=>p.blocks[0].cells[0].group='Synthetic Alpur 3').problems.join(),/matches a patient identifier, name or ABHA/);
  assert.match(bad(p=>p.blocks[0].cells[0].group='v-t1-Alpur-0').problems.join(),/matches a patient identifier/);
  assert.match(bad(p=>Object.assign(p.blocks[0].cells[0],{value:3,numerator:3})).problems.join(),/below the suppression threshold of 5/);
  assert.match(bad(p=>Object.assign(p.blocks[0].cells[1],{value:2})).problems.join(),/suppressed cell carries a value/);
  assert.match(bad(p=>Object.assign(p.blocks[0],{unit:'proportion'})&&Object.assign(p.blocks[0].cells[0],{value:85.7,numerator:12,denominator:14})).problems.join(),/below the suppression threshold/,'denominator minus numerator of 2');
  assert.equal(bad(()=>{}).passed,true);
 });
 // 3. Prepare: pinned versions, suppressed cells only, manifest with row count and SHA-256, audited, steps linked.
 let first;
 await check('prepare',async()=>{
  store.setup(fresh());L.resetLedger();
  const r=await as('sup',prep({group:'village'}));assert.equal(r.state,'prepared');first=report(r.reportId);
  assert.deepEqual(first.definitions,['all-people@1','patients-seen@1']);assert.equal(first.preparedBy,'sup');
  const p=first.payload;assert.equal(p.contract,'saha-aggregate-v1');assert.equal(p.operation,'aggregate');
  assert.equal(p.manifest.sha256,sha(D.canonical({report:p.report,definitions:p.manifest.definitions,blocks:p.blocks})),'the SHA-256 is recomputable by a receiver');
  assert.equal(p.manifest.rows,p.blocks.reduce((n,b)=>n+b.cells.length,0));assert.equal(first.rowCount,p.manifest.rows);
  assert.deepEqual(p.manifest.definitions.map(d=>`${d.id}@${d.version}`),['all-people@1','patients-seen@1']);
  const t1=p.blocks.find(b=>b.team==='Team one'&&b.indicator==='all-people');assert.deepEqual(t1.cells.map(c=>[c.group,c.value,c.suppressed]),[['Alpur',7,false],['Bedi',6,false]]);
  const t2=p.blocks.find(b=>b.team==='Team two'&&b.indicator==='all-people');assert.deepEqual(t2.cells.map(c=>[c.group,c.value]),[['Chak',9]]);
  const json=JSON.stringify(p);for(const x of ['personId','Synthetic Alpur','t1-Alpur','v-t1'])assert.ok(!json.includes(x),'no patient-level content: '+x);
  assert.equal(first.minimisation[0].passed,true);assert.equal(first.minimisation[0].stage,'prepare');
  assert.equal(store.saved.workspace.audit.at(-1).action,'prepareAggregateReport');assert.equal(first.events[0].ref.command,'prepareAggregateReport');
  assert.equal(L.ledger.length,0,'preparing records no release');
 });
 // 4. Approval by a different authorised person, on the payload reviewed.
 await check('approval',async()=>{
  await rejects(()=>as('sup',{type:'approveAggregateReport',reportId:first.id,payloadSha256:first.payloadSha256}),403,/different authorised person/);
  await rejects(()=>as('sup3',{type:'approveAggregateReport',reportId:first.id,payloadSha256:first.payloadSha256}),403,/reporting scope/);
  await rejects(()=>as('sup2',{type:'approveAggregateReport',reportId:first.id,payloadSha256:'a'.repeat(64)}),409,/not the one you reviewed/);
  await rejects(()=>as('sup',{type:'sendAggregateReport',reportId:first.id}),409,/must approve this report before it is sent/);
  const r=await as('sup2',{type:'approveAggregateReport',reportId:first.id,payloadSha256:first.payloadSha256});assert.equal(r.state,'approved');
  assert.equal(report(first.id).approvedBy,'sup2');assert.ok(Date.parse(report(first.id).expiresAt)>Date.now()+23*3600000);
  await rejects(()=>as('own',{type:'sendAggregateReport',reportId:first.id}),403,/prepared or approved/);
 });
 // 5. Send: access audit first, checkpoint, ledger release to the destination, one request with the report id as key, receipt.
 await check('send with receipt',async()=>{
  calls.length=0;audit.events.length=0;store.log.length=0;
  const r=await as('sup',{type:'sendAggregateReport',reportId:first.id},spy());assert.equal(r.state,'accepted');assert.match(r.receipt,/^AGG-[0-9A-F]{8}$/);
  assert.deepEqual(store.log,['access:externalRequest','persist:sendAggregateReport','persist:aggregateReceipt'],'audit, checkpoint, finish in that order');
  assert.equal(calls.length,1);assert.equal(calls[0].k,first.id,'idempotency key is the report id');assert.equal(calls[0].body.manifest.sha256,first.payloadSha256);
  assert.match(audit.events[0].detail,/aggregate report .* about to be sent .*no patient-level data/);assert.equal(audit.events[0].personId,null);
  const x=report(first.id);assert.equal(x.attempts,1);assert.deepEqual(x.minimisation.map(m=>[m.stage,m.passed]),[['prepare',true],['before-send',true],['checkpoint',true]]);
  assert.deepEqual(x.events.map(e=>e.ref?.command),['prepareAggregateReport','approveAggregateReport','sendAggregateReport','aggregateReceipt']);
  assert.ok(L.ledger.length>0,'the release is recorded');const hashed=createHash('sha256').update(JSON.stringify('saha-indicator-release:org:destination:agg')).digest('hex').slice(0,20);
  assert.ok(L.ledger.every(r=>r.v===hashed),'released to the destination');assert.ok(!JSON.stringify(L.ledger).match(/Alpur|Team one|t1/),'ledger holds hashed labels only');
  const again=await as('sup',{type:'sendAggregateReport',reportId:first.id},spy());assert.equal(again.state,'accepted');assert.equal(calls.length,1,'never sent twice');
 });
 // 6. A lost response: unknown outcome, no resend, a lookup finds the receipt.
 await check('uncertain outcome and lookup',async()=>{
  const r=await as('own',prep({destinationId:'agg-lost',teamIds:['t1']}));await as('sup',{type:'approveAggregateReport',reportId:r.reportId,payloadSha256:report(r.reportId).payloadSha256});
  calls.length=0;const sent=await as('own',{type:'sendAggregateReport',reportId:r.reportId},spy());assert.equal(sent.state,'uncertain');assert.match(report(r.reportId).message,/Look up this report before anything else; it is never sent again/);
  await rejects(()=>as('own',{type:'sendAggregateReport',reportId:r.reportId},spy()),409,/Look up its receipt/);assert.equal(calls.length,1);
  const found=await as('sup',{type:'lookupAggregateReport',reportId:r.reportId},spy());assert.equal(found.state,'accepted');assert.equal(calls.length,2);assert.equal(calls[1].body.operation,'lookup');assert.equal(calls[1].body.key,r.reportId);
  assert.equal(report(r.reportId).attempts,1,'a lookup is not a send');assert.match(report(r.reportId).message,/by lookup; the report was not sent again/);
 });
 // SAHA-075: an uncertain result must survive a process restart with the original logical identity and payload
 // fingerprint. A malformed or changed-payload receipt cannot close it, and recovery never invokes the send path.
 await check('durable duplicate-safe recovery after restart',async()=>{
  const r=await as('own',prep({destinationId:'agg-lost',teamIds:['t1']}));await as('sup',{type:'approveAggregateReport',reportId:r.reportId,payloadSha256:report(r.reportId).payloadSha256});
  calls.length=0;await as('own',{type:'sendAggregateReport',reportId:r.reportId},spy());
  const beforeRestart=structuredClone(store.saved),original=report(r.reportId),identity=original.id,fingerprint=original.payloadSha256;
  assert.equal(original.state,'uncertain');assert.equal(original.attempts,1);assert.ok(original.payload,'the original payload remains available while unresolved');
  store.setup(beforeRestart);assert.equal(report(identity).payloadSha256,fingerprint);assert.equal(report(identity).attempts,1);
  const changed=async()=>({contract:D.AGGREGATE_CONTRACT,key:identity,payloadHash:'f'.repeat(64),status:'accepted',receipt:'WRONG-PAYLOAD'});
  const unresolved=await as('sup',{type:'lookupAggregateReport',reportId:identity},spy(changed));assert.equal(unresolved.state,'uncertain');assert.equal(report(identity).receipt,undefined);assert.equal(report(identity).attempts,1);
  const malformed=async()=>({contract:D.AGGREGATE_CONTRACT,key:identity,payloadHash:fingerprint,status:'accepted'});
  const stillUnresolved=await as('sup',{type:'lookupAggregateReport',reportId:identity},spy(malformed));assert.equal(stillUnresolved.state,'uncertain');assert.equal(report(identity).attempts,1);
  const found=await as('sup',{type:'lookupAggregateReport',reportId:identity},spy());assert.equal(found.state,'accepted');assert.equal(report(identity).attempts,1);
  assert.equal(calls.filter(x=>x.body.operation!=='lookup').length,1,'the logical action is sent exactly once');
  assert.ok(calls.filter(x=>x.body.operation==='lookup').every(x=>x.body.key===identity&&x.body.payloadHash===fingerprint),'every recovery lookup keeps the original identity and fingerprint');
 });
 // 7. Withdrawn inside the checkpoint: nothing sent, attempt released, closed with the refusal.
 await check('operation withdrawn inside the checkpoint',async()=>{
  store.setup(fresh());L.resetLedger();
  const r=await as('sup',prep());await as('own',{type:'approveAggregateReport',reportId:r.reportId,payloadSha256:report(r.reportId).payloadSha256});
  store.setHook((s,c)=>{if(c.type==='sendAggregateReport'){const i=s.workspace.integrations.find(x=>x.id==='agg');i.operations={...i.operations,version:2,allowed:['lookup']};}});
  calls.length=0;const sent=await as('sup',{type:'sendAggregateReport',reportId:r.reportId},spy());store.setHook(null);
  assert.equal(sent.state,'cancelled');assert.equal(sent.refused,true);assert.equal(calls.length,0);
  const x=report(r.reportId);assert.equal(x.attempts,0);assert.equal(x.refusal.stage,'checkpoint');assert.equal(x.refusal.operation,'aggregate');assert.equal(x.refusal.settingVersion,2);
  assert.match(x.message,/Not sent: .*not permitted to receive aggregate reports.*nothing was sent and the reserved attempt is released/);assert.equal(L.ledger.length,0,'no release recorded');
  assert.equal(x.events.at(-1).ref.command,'aggregateReportRefused');
 });
 // 8. A stored payload altered after approval fails the minimisation check before the request; the result is recorded.
 await check('tampered payload refused',async()=>{
  store.setup(fresh());L.resetLedger();
  const r=await as('sup',prep());await as('own',{type:'approveAggregateReport',reportId:r.reportId,payloadSha256:report(r.reportId).payloadSha256});
  report(r.reportId).payload.blocks[0].cells[0].personId='t1-Alpur-0';
  calls.length=0;const sent=await as('sup',{type:'sendAggregateReport',reportId:r.reportId},spy());assert.equal(sent.state,'cancelled');assert.equal(calls.length,0);
  const x=report(r.reportId);assert.equal(x.refusal.reason,'minimisation');assert.equal(x.minimisation.at(-1).passed,false);assert.match(x.minimisation.at(-1).problems[0],/Patient-level field "personId"/);
  assert.match(x.message,/Not sent: the payload failed the minimisation check/);assert.equal(store.saved.workspace.audit.at(-1).action,'aggregateReportRefused');
 });
 // 9. Records changed since approval: the recomputed report differs, so nothing is sent.
 await check('changed records refused',async()=>{
  store.setup(fresh());L.resetLedger();
  const r=await as('sup',prep());await as('own',{type:'approveAggregateReport',reportId:r.reportId,payloadSha256:report(r.reportId).payloadSha256});
  store.saved.workspace.people.push({...base,id:'t1-new',name:'Synthetic newcomer',village:'Alpur',teamId:'t1'});
  calls.length=0;const sent=await as('sup',{type:'sendAggregateReport',reportId:r.reportId},spy());assert.equal(sent.state,'cancelled');assert.equal(calls.length,0);assert.equal(report(r.reportId).refusal.reason,'changed');
 });
 // 10. Differencing across reports to the same destination: a release that would reveal 3 men is withheld or refused.
 await check('differencing per destination',async()=>{
  store.setup(fresh());L.resetLedger();
  // Slice 6ab: with the population check (slice 6aa), "women in Team one" (10 of 13) reveals the 3 men through the
  // team's own cohort, so it is withheld whatever was sent before. Report b now carries it with "all people" and becomes
  // different from what was approved because a record changes after approval (it used to change because report a was
  // sent first, which the key-only screen needed to notice the 3 men).
  const a=await as('sup',prep({definitions:['all-people'],teamIds:['t1']})),b=await as('sup',prep({definitions:['all-people','female-people'],teamIds:['t1']}));
  for(const id of [a.reportId,b.reportId])await as('own',{type:'approveAggregateReport',reportId:id,payloadSha256:report(id).payloadSha256});
  assert.equal((await as('sup',{type:'sendAggregateReport',reportId:a.reportId})).state,'accepted');
  store.saved.workspace.people.push({...store.saved.workspace.people[0],id:'t1-Alpur-late',name:'Synthetic Alpur late'});store.saved.workspace.visits.push({...store.saved.workspace.visits[0],id:'v-t1-Alpur-late',personId:'t1-Alpur-late'});
  calls.length=0;const sent=await as('sup',{type:'sendAggregateReport',reportId:b.reportId},spy());assert.equal(sent.state,'cancelled');assert.equal(calls.length,0);
  assert.match(report(b.reportId).message,/would now differ from what was approved/);
  await rejects(()=>as('sup',prep({definitions:['female-people'],teamIds:['t1']})),422,/every block is withheld to protect small groups/);
  const both=await as('sup',prep({definitions:['all-people','female-people'],teamIds:['t1']}));assert.equal(report(both.reportId).payload.blocks.find(x=>x.indicator==='female-people').withheld,'differencing');
  // Slice 6ab: this assertion used to expect the same release to another destination (empty ledger) to be released; that
  // was the round-5 integration limit. The population check refuses it for every destination.
  await rejects(()=>as('sup',prep({destinationId:'agg-lost',definitions:['female-people'],teamIds:['t1']})),422,/every block is withheld to protect small groups/);
 });
 // 11. If the access audit cannot be written, nothing is sent and the report stays approved.
 await check('audit fails closed',async()=>{
  store.setup(fresh());L.resetLedger();
  const r=await as('sup',prep());await as('own',{type:'approveAggregateReport',reportId:r.reportId,payloadSha256:report(r.reportId).payloadSha256});
  audit.failAudit(true);calls.length=0;await rejects(()=>as('sup',{type:'sendAggregateReport',reportId:r.reportId},spy()),503,/nothing was shown or sent/);audit.failAudit(false);
  assert.equal(calls.length,0);assert.equal(report(r.reportId).state,'approved');assert.equal(report(r.reportId).attempts,0);
 });
 // 12. The approval window is enforced.
 await check('approval expiry',async()=>{
  const r=store.saved.operations.aggregateReports.at(-1);r.expiresAt=new Date(Date.now()-1000).toISOString();
  await rejects(()=>as('sup',{type:'sendAggregateReport',reportId:r.id}),409,/approval has expired/);
 });
}finally{rmSync(dir,{recursive:true,force:true});}
const result={suite:'aggregate-delivery-contract',passed,failed:failures.length,failures};
writeFileSync('tests/aggregate-delivery-contract-result.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));if(failures.length)process.exit(1);
