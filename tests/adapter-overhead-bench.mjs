// Slice 7d: local benchmark of per-adapter overhead (NFR-28), separate from partner latency.
//
// Measures the Saha side of the programme (MIS) and EHR adapters: transformation (mapped payload or FHIR document),
// validation (payload hash, outbound FHIR checks, receipt and acknowledgement checks) and checkpointing (state reads,
// clones, audit/trace linking and the real row diff from lib/saha/store.ts rowsForState). The partner is an instant
// in-process mock; the time spent inside its handler is measured and subtracted, so external latency is excluded.
//
// This is a LOCAL measurement on the build machine with a stated synthetic workload. It is NOT the R1 reference
// workload or a reference environment: D1 network/disk latency, Worker isolate limits and real partner payloads are
// not included. Persistence is an in-memory compare-and-swap model that runs the real rowsForState diff and
// serialises the changed rows, but writes nothing to D1.
//
// Usage: node tests/adapter-overhead-bench.mjs [iterations]   (default 300 measured + 30 warm-up per stage)
//        SAHA_BENCH_OUT=tests/evidence/slice-7d/adapter-overhead.json node tests/adapter-overhead-bench.mjs
import assert from 'node:assert/strict';
import ts from 'typescript';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
import os from 'node:os';

const N=Number(process.argv[2]||300),WARM=30,OUT=process.env.SAHA_BENCH_OUT,loadAtStart=os.loadavg().map(x=>Math.round(x*100)/100);
const WORKLOAD={people:200,visitsPerPerson:3,priorSubmissions:300,eventsPerPriorSubmission:4,auditEvents:1500,misMappedFields:6};
const dir=mkdtempSync(join(process.cwd(),'.adapter-bench-'));
try{
 for(const f of ['types','programmes','service-dispatch','adapter-operations','facility-scope','identity','service-identity','core','fact-provenance','send-gate','access','delegation','visit-signoff','mis','mis-execution','trace','operations','referral-rules','task-limits','ehr','fhir-document','fhir-validate','ehr-provider','ehr-execution','ehr-probe','seed','partition','audit-chain']){writeFileSync(join(dir,f+'.js'),ts.transpileModule(readFileSync(`lib/saha/${f}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'"));}
 writeFileSync(join(dir,'store-real.js'),ts.transpileModule(readFileSync('lib/saha/store.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'"));
 writeFileSync(join(dir,'store.js'),`import {AppError} from './core.js';import {rowsForState} from './store-real.js';
export let saved;export let rowBytes=0;export function setup(s){saved=structuredClone(s)}
export async function readState(){return structuredClone(saved)}
export function scope(s,id){const m=s.members.find(m=>m.userId===id);if(!m||m.status==='suspended')throw new AppError(403,'Member revoked');return m}
export async function persist(db,before,after,u,c,key,hash,response){if(before.organisation.revision!==saved.organisation.revision)throw new AppError(409,'CAS conflict');
 const rows=rowsForState(after,before,u,c.type,'',new Date().toISOString());rowBytes+=JSON.stringify(rows).length+JSON.stringify(response??null).length;
 saved=structuredClone(after);saved.organisation.revision++;}`);
 writeFileSync(join(dir,'access-audit.js'),`export async function recordAccess(){}`);
 const store=await import(pathToFileURL(join(dir,'store.js')));
 const {executeMis}=await import(pathToFileURL(join(dir,'mis-execution.js'))),{misRequest,mappedPayload}=await import(pathToFileURL(join(dir,'mis.js')));
 const {executeEhr}=await import(pathToFileURL(join(dir,'ehr-execution.js'))),{applyEhr}=await import(pathToFileURL(join(dir,'ehr.js'))),{fhirRequest}=await import(pathToFileURL(join(dir,'ehr-provider.js')));
 const {digest}=await import(pathToFileURL(join(dir,'core.js')));
 const actor={userId:'worker',displayName:'Synthetic worker'},member={userId:'worker',role:'clinician',status:'active',isOwner:true};
 const date=new Date().toISOString().slice(0,16),orgId='bench-org',misEndpoint='https://programme.example/api',ehrBase='https://ehr.example/fhir';
 const env={SAHA_EXTERNAL_APIS_ENABLED:'true',SAHA_MIS_BENCH:'synthetic',SAHA_EHR_BENCH:'synthetic',SAHA_MIS_CONNECTIONS:JSON.stringify([{organisationId:orgId,integrationId:'mis1',origin:'https://programme.example',credentialBinding:'SAHA_MIS_BENCH'}]),SAHA_EHR_CONNECTIONS:JSON.stringify([{organisationId:orgId,integrationId:'ehr1',baseUrl:ehrBase,credentialBinding:'SAHA_EHR_BENCH'}])};
 const mapping=[['personId','patient_reference'],['visitId','visit_reference'],['weight','weight_kg'],['temperature','temperature_c'],['systolic','bp_systolic'],['diastolic','bp_diastolic']].map(([source,target])=>({source,target,required:false}));
 const misI={id:'mis1',kind:'mis',mode:'http',status:'active',version:1,name:'Synthetic programme',endpoint:misEndpoint,credentialBinding:'SAHA_MIS_BENCH',mis:{contract:'saha-mis-v1',mapping,corrections:false}};
 const ehrI={id:'ehr1',kind:'ehr',mode:'http',status:'active',version:1,name:'Synthetic EHR',endpoint:ehrBase,credentialBinding:'SAHA_EHR_BENCH',ehr:{read:true,write:true}};
 // Synthetic workload (stated in the result): 200 patients, 600 confirmed visits, 300 earlier submissions, 1,500 audit events.
 const people=[],visits=[],submissions=[],audit=[];
 for(let p=0;p<WORKLOAD.people;p++){people.push({id:'p'+p,name:'Bench Person '+p,sex:'Other',age:20+p%50,village:'Bench village',version:1,consentVersion:1,exchangeConsent:true,assigned:true});
  for(let v=0;v<WORKLOAD.visitsPerPerson;v++)visits.push({id:`v${p}-${v}`,personId:'p'+p,version:1,state:'confirmed',facts:{date,source:'measured',weight:String(45+p%30),temperature:'37.0',systolic:'118',diastolic:'76',notes:'Synthetic benchmark visit'},aiResults:[]});}
 for(let k=0;k<WORKLOAD.priorSubmissions;k++){const p=k%WORKLOAD.people;submissions.push({id:'old'+k,visitId:`v${p}-0`,personId:'p'+p,connectorId:'mis1',connectorName:misI.name,state:'accepted',attempts:1,receipt:'R'+k,payloadHash:'b'.repeat(64),delivery:{endpoint:misEndpoint,credentialBinding:'SAHA_MIS_BENCH',key:'old'+k,actorId:'worker',connectorVersion:1,personVersion:1,consentVersion:1,visitVersion:1,expiresAt:new Date(Date.now()+3600000).toISOString(),payload:{contract:'saha-mis-v1',environment:'synthetic',operation:'submit',fields:{}},events:Array.from({length:WORKLOAD.eventsPerPriorSubmission},(_,e)=>({at:new Date().toISOString(),state:'accepted',detail:'Earlier synthetic event '+e}))}});}
 for(let a=0;a<WORKLOAD.auditEvents;a++)audit.push({id:'a'+a,at:new Date().toISOString(),actor:'Synthetic worker',actorId:'worker',role:'clinician',action:'saveVisit',subject:'v'+(a%WORKLOAD.people)+'-0',detail:'Earlier synthetic audit event',personId:'p'+(a%WORKLOAD.people)});
 const base={organisation:{id:orgId,name:'Benchmark organisation',revision:1},members:[member],teams:[],invitations:[],workspace:{role:'clinician',people,visits,integrations:[misI,ehrI],submissions,referrals:[],audit}};
 // EHR link and permission for the target patient (p0), set up once with the real command handlers.
 await applyEhr(base,{type:'linkEhr',personId:'p0',version:1,integrationId:'ehr1',externalId:'external-1',externalName:'Bench Person 0',reason:'Synthetic benchmark identity',confirmed:true},actor,member,env);const linkId=people[0].ehr.links[0].id;
 await applyEhr(base,{type:'grantEhrPermission',personId:'p0',linkId,direction:'write',purpose:'care-coordination',from:'2026-01-01T00:00:00.000Z',to:new Date(Date.now()+86400000).toISOString(),expiresAt:new Date(Date.now()+864000000).toISOString()},actor,member,env);const permissionId=people[0].ehr.permissions[0].id;

 // Instant partners; time inside their handlers is accumulated and subtracted.
 let partnerMs=0;const timed=(fn)=>async(...a)=>{const t=performance.now();try{return await fn(...a);}finally{partnerMs+=performance.now()-t;}};
 const misPartner=timed(async(url,init)=>{const b=JSON.parse(init.body);return new Response(JSON.stringify({contract:'saha-mis-v1',key:b.key,payloadHash:b.payloadHash,status:'accepted',receipt:'PARTNER-'+b.key}),{status:200,headers:{'content-type':'application/json'}});});
 const ehrPartner=timed(async(url,init={})=>{const path=new URL(url).pathname.replace(/^\/fhir\//,''),h={'content-type':'application/fhir+json'};
  if(path.startsWith('Patient/'))return new Response(JSON.stringify({resourceType:'Patient',id:'external-1',name:[{text:'Bench Person 0'}]}),{status:200,headers:h});
  if(init.method==='POST'){const d=JSON.parse(init.body);return new Response(JSON.stringify({...d,id:'stored-1'}),{status:201,headers:h});}
  return new Response(JSON.stringify({resourceType:'Bundle',type:'searchset',entry:[{resource:{...lastBundle,id:'stored-1'}}]}),{status:200,headers:h});});
 let lastBundle;
 const misTransport=(i,org,e,body,key)=>misRequest(i,org,e,body,key,misPartner),ehrTransport=(i,org,e,path,init)=>fhirRequest(i,org,e,path,init,ehrPartner);

 const samples={};const add=(k,v)=>(samples[k]??=[]).push(v);
 async function misIteration(n,record){
  const s0=structuredClone(base),v=s0.workspace.visits[3*(n%WORKLOAD.people)];
  // Transformation and validation: mapped payload and its SHA-256 hash, as the plan step computes them.
  let t=performance.now();const payload=mappedPayload(misI,v,s0),payloadHash=await digest(payload);const transform=performance.now()-t;
  const sub={id:'new'+n,visitId:v.id,personId:v.personId,connectorId:'mis1',connectorName:misI.name,state:'queued',attempts:0,payloadHash,delivery:{endpoint:misEndpoint,credentialBinding:'SAHA_MIS_BENCH',key:'new'+n,actorId:'worker',connectorVersion:1,personVersion:1,consentVersion:1,visitVersion:1,expiresAt:new Date(Date.now()+3600000).toISOString(),payload,events:[]}};
  s0.workspace.submissions.push(sub);store.setup(s0);
  // Send: state read, checkpoint, adapter request/response handling, receipt validation, final write.
  partnerMs=0;t=performance.now();let r=await executeMis({},await store.readState(),{type:'sendSubmission',submissionId:sub.id},actor,member,'send'+n,'h',env,misTransport);const send=performance.now()-t-partnerMs;assert.equal(r.state,'accepted');
  // Lookup of an unresolved delivery (state forced to uncertain), the reconciliation path.
  const s1=await store.readState();const x=s1.workspace.submissions.find(y=>y.id===sub.id);x.state='uncertain';x.receipt=undefined;store.setup(s1);
  partnerMs=0;t=performance.now();r=await executeMis({},await store.readState(),{type:'lookupSubmission',submissionId:sub.id},actor,member,'lookup'+n,'h',env,misTransport);const lookup=performance.now()-t-partnerMs;assert.equal(r.state,'accepted');
  if(record){add('mis.transform',transform);add('mis.send',send);add('mis.lookup',lookup);add('mis.transform+send',transform+send);}
 }
 async function ehrIteration(n,record){
  const s0=structuredClone(base);const v=s0.workspace.visits[n%WORKLOAD.visitsPerPerson];
  // Transformation and validation: FHIR document build, outbound validation, permission check and hash (prepareEhrPublish).
  let t=performance.now();await applyEhr(s0,{type:'prepareEhrPublish',personId:'p0',linkId,permissionId,visitId:v.id},actor,member,env);const transform=performance.now()-t;
  const op=s0.workspace.people[0].ehr.operations.at(-1);lastBundle=op.bundle;store.setup(s0);
  partnerMs=0;t=performance.now();let r=await executeEhr({},await store.readState(),{type:'executeEhrPublish',personId:'p0',operationId:op.id,hash:op.hash},actor,member,'pub'+n,'h',env,ehrTransport);const send=performance.now()-t-partnerMs;assert.equal(r.state,'accepted');
  const s1=await store.readState();const o=s1.workspace.people[0].ehr.operations.find(y=>y.id===op.id);o.state='uncertain';o.receipt=undefined;store.setup(s1);
  partnerMs=0;t=performance.now();r=await executeEhr({},await store.readState(),{type:'lookupEhrPublish',personId:'p0',operationId:op.id},actor,member,'lk'+n,'h',env,ehrTransport);const lookup=performance.now()-t-partnerMs;assert.equal(r.state,'accepted');
  if(record){add('ehr.transform',transform);add('ehr.publish',send);add('ehr.lookup',lookup);add('ehr.transform+publish',transform+send);}
 }
 const started=performance.now();
 for(let n=0;n<WARM;n++){await misIteration(n,false);await ehrIteration(n,false);}
 for(let n=0;n<N;n++){await misIteration(WARM+n,true);await ehrIteration(WARM+n,true);}
 const pct=(a,p)=>{const s=[...a].sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.ceil(p/100*s.length)-1)];};const r3=x=>Math.round(x*1000)/1000;
 const stats=Object.fromEntries(Object.entries(samples).map(([k,a])=>[k,{n:a.length,p50:r3(pct(a,50)),p95:r3(pct(a,95)),p99:r3(pct(a,99)),max:r3(Math.max(...a)),unit:'ms'}]));
 const limit=500,within=Object.values(stats).every(s=>s.p95<=limit);
 const result={benchmark:'per-adapter local overhead (transformation + validation + checkpointing), partner handler time subtracted',classification:'local measurement only; not the R1 reference workload and not a reference environment; NFR-28 remains unverified',
  workload:{...WORKLOAD,targetVisitFacts:'weight, temperature, systolic, diastolic, notes',ehrTarget:'one linked patient with a write permission; one document per publication',iterations:N,warmup:WARM},
  machine:{node:process.version,platform:`${os.platform()} ${os.release()}`,cpu:os.cpus()[0]?.model,cpus:os.cpus().length,loadAverageAtStart:loadAtStart,loadAverageAtEnd:os.loadavg().map(x=>Math.round(x*100)/100),note:'Other builders ran test suites on the same machine at the same time; figures include that contention.'},
  excluded:['partner handler time (subtracted)','D1 network and disk latency (in-memory CAS model; real rowsForState diff is run)','Worker isolate CPU limits','network transfer'],
  stats,referenceLimitMs:limit,localP95WithinReferenceLimit:within,durationMs:Math.round(performance.now()-started),completedAt:new Date().toISOString()};
 if(OUT){mkdirSync(dirname(OUT),{recursive:true});writeFileSync(OUT,JSON.stringify(result,null,2)+'\n');}
 console.log(JSON.stringify({stats,localP95WithinReferenceLimit:within,durationMs:result.durationMs},null,1));
}finally{rmSync(dir,{recursive:true,force:true})}
