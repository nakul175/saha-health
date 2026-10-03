// Slice 7d: replay and timeout soak for programme (MIS) and EHR delivery (NFR-05).
//
// Drives the real executeMis/executeEhr code, the real misRequest/fhirRequest HTTP adapters and the real applyReceipt
// (the function the signed callback route uses) against a local mock partner that randomly accepts, rejects, leaves
// work pending, times out before or after accepting, drops or truncates responses, returns HTTP errors and duplicates
// callbacks. The driver adds command replays (same key and fresh key), concurrent attempts, receipt lookups and
// interrupted final writes. The mock partner is deliberately naive: it does NOT deduplicate by idempotency key or
// honour If-None-Exist, so any resend by Saha after the partner accepted would show up as a second accepted record.
//
// Usage:
//   node tests/replay-soak-contract.mjs                          bounded CI variant (default 1,500 replay/timeout events)
//   SAHA_SOAK_EVENTS=10000 SAHA_SOAK_SEED=7 SAHA_SOAK_OUT=tests/evidence/slice-7d/replay-soak-10000.json \
//     node tests/replay-soak-contract.mjs                        full soak (at least 10,000 replay/timeout events)
//
// Limits: persistence is an in-memory compare-and-swap model of the organisation revision, not D1; same-key command
// replay is answered from that model's stored command receipts, as lib/saha/server.ts does from D1; the callback path
// runs applyReceipt and the route's replay rules, not the HTTP route, its signature check or D1. Clock passage for
// stuck checkpoints is simulated by back-dating the checkpoint time. Partner lookups are consistent and no request
// arrives late; a partner whose lookup is eventually consistent must still deduplicate (MIS-API.md).
//
// Slice 6ab (eighth review): a programme resend counts as allowed only if Saha itself recorded the partner's not_found
// for that key after the previous send (not merely because the partner delivered one). Signed callbacks now go through
// the real callback route function (app/api/mis/callback/route.ts, transpiled with an in-memory D1 stand-in for its two
// queries and the same compare-and-swap store), including its signature check, endpoint/binding checks and 60-event
// limit. A bounded set of organisations (SAHA_SOAK_PLAN_ORGS, default 4) creates its submissions through the real
// preparePlan/approvePlan/executePlan code, has the create operation withdrawn and restored mid-run (slice 7e), cancels a
// delivery, and re-prepares closed visits with a new key; the partner checks at most one accepted record per visit.
//
// Slice 7f: every round of EHR organisations also runs against a partner whose contract makes identifier search
// authoritative (lookup policy: consistency delay 30 seconds, reconciliation owner named). The simulated clock advances
// 40 seconds per round for publication checkpoints. Checks 5 and 8 compare the unresolved share of the two partner kinds:
// an authoritative empty search after the delay closes a publication as not stored (never resent), and no publication is
// closed as not stored while the partner holds its document.
import assert from 'node:assert/strict';
import ts from 'typescript';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';

const TARGET=Number(process.env.SAHA_SOAK_EVENTS||1500),PLAN_ORGS=Number(process.env.SAHA_SOAK_PLAN_ORGS||4),SEED=Number(process.env.SAHA_SOAK_SEED||7),OUT=process.env.SAHA_SOAK_OUT;
const dir=mkdtempSync(join(process.cwd(),'.replay-soak-'));let passed=0;const started=Date.now();
// Seeded PRNG (mulberry32) so a run is repeatable for a given seed.
let seed=SEED>>>0;const rng=()=>{seed=(seed+0x6D2B79F5)>>>0;let t=seed;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};
const pick=(table)=>{let r=rng();for(const [name,p] of table){if((r-=p)<0)return name;}return table[table.length-1][0];};
const sha=(x)=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const yieldNow=()=>new Promise(r=>setImmediate(r));
const counts={};const bump=(k,n=1)=>{counts[k]=(counts[k]??0)+n;};
try{
 for(const f of ['types','programmes','core','adapter-operations','fact-provenance','send-gate','access','delegation','visit-signoff','mis','mis-execution','mis-callback','trace','operations','referral-rules','task-limits','ehr','fhir-document','fhir-validate','ehr-provider','ehr-execution']){writeFileSync(join(dir,f+'.js'),ts.transpileModule(readFileSync(`lib/saha/${f}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'"));}
 // Slice 6ab: the real MIS callback route, with '@/lib/saha/server' replaced by a stand-in for db/json/error/runtime.
 writeFileSync(join(dir,'route.js'),ts.transpileModule(readFileSync('app/api/mis/callback/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '@\/lib\/saha\/server'/g,"from './server-stub.js'").replace(/from '@\/lib\/saha\/([^']+)'/g,"from './$1.js'"));
 writeFileSync(join(dir,'server-stub.js'),`import {AppError} from './core.js';import {orgs} from './store.js';
export const grants=[];
export const runtime=()=>({SAHA_EXTERNAL_APIS_ENABLED:'true',SAHA_MIS_SOAK:'synthetic-secret',SAHA_MIS_SOAK_CB:'synthetic-callback-secret',SAHA_MIS_CONNECTIONS:JSON.stringify(grants)});
export function json(value,status=200){return Response.json(value,{status});}
export function error(e){if(e instanceof AppError)return json({error:e.message},e.status);throw e;}
// The route's two D1 queries: one integration row, and whether a command receipt exists for the callback key.
export function db(){return {prepare(sql){return {bind(...a){return {async first(){await new Promise(r=>setImmediate(r));
 if(sql.includes('FROM integrations')){const i=orgs.get(a[0])?.state.workspace.integrations.find(x=>x.id===a[1]);return i?{data:JSON.stringify(i)}:null;}
 if(sql.includes('FROM command_receipts')){for(const o of orgs.values())if(o.receipts.has(a[0]+'|'+a[1]))return {key:a[1]};return null;}
 throw new Error('Unexpected query '+sql);}};}};}};}`);
 // Multi-organisation compare-and-swap model. Each organisation has its own revision, command receipts and an
 // interruption switch that makes final receipt writes fail (a process stopping after the partner call).
 writeFileSync(join(dir,'store.js'),`import {AppError} from './core.js';
export const orgs=new Map();
export function setup(s){orgs.set(s.organisation.id,{state:structuredClone(s),receipts:new Map(),interrupt:false});}
export async function readState(db,id){await new Promise(r=>setImmediate(r));const o=orgs.get(id);if(!o)throw new AppError(404,'Unknown organisation');return structuredClone(o.state)}
export function scope(s,id){const m=s.members.find(m=>m.userId===id);if(!m||m.status==='suspended')throw new AppError(403,'Member revoked');return m}
export async function persist(db,before,after,u,c,key,hash,response){await new Promise(r=>setImmediate(r));const o=orgs.get(after.organisation.id);
 if(o.interrupt&&(c.type==='misReceipt'||c.type==='ehrReceipt'))throw new AppError(409,'Injected interruption of the final write');
 if(before.organisation.revision!==o.state.organisation.revision)throw new AppError(409,'CAS conflict');
 if(o.receipts.has(u.userId+'|'+key))throw new AppError(409,'Command receipt already stored');
 o.state=structuredClone(after);o.state.organisation.revision++;o.receipts.set(u.userId+'|'+key,{hash,response});}`);
 writeFileSync(join(dir,'access-audit.js'),`export async function recordAccess(){}`);
 const store=await import(pathToFileURL(join(dir,'store.js')));
 const {executeMis}=await import(pathToFileURL(join(dir,'mis-execution.js'))),{applyReceipt,misAudit,misRequest}=await import(pathToFileURL(join(dir,'mis.js')));
 const {executeEhr}=await import(pathToFileURL(join(dir,'ehr-execution.js'))),{applyEhr}=await import(pathToFileURL(join(dir,'ehr.js'))),{fhirRequest}=await import(pathToFileURL(join(dir,'ehr-provider.js')));
 const {linkTrace}=await import(pathToFileURL(join(dir,'trace.js'))),{AppError,apply:coreApply}=await import(pathToFileURL(join(dir,'core.js')));
 const {POST:callbackRoute}=await import(pathToFileURL(join(dir,'route.js'))),stub=await import(pathToFileURL(join(dir,'server-stub.js'))),{configureMis}=await import(pathToFileURL(join(dir,'mis.js')));
 const signed=async(raw)=>{const ts=String(Date.now()),key=await crypto.subtle.importKey('raw',new TextEncoder().encode('synthetic-callback-secret'),{name:'HMAC',hash:'SHA-256'},false,['sign']);return {ts,sig:Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(ts+'.'+raw))).toString('hex')};};
 const actor={userId:'worker',displayName:'Synthetic worker'},member={userId:'worker',role:'clinician',status:'active',isOwner:true};
 const timeout=()=>{const e=new Error('The operation was aborted due to timeout');e.name='TimeoutError';return e;};
 const jsonResponse=(x,status=200,type='application/json')=>new Response(JSON.stringify(x),{status,headers:{'content-type':type}});
 const truncated=(x,type='application/json')=>{const t=JSON.stringify(x);return new Response(t.slice(0,Math.max(1,Math.floor(t.length/2))),{status:200,headers:{'content-type':type}});};

 // ---------------------------------------------------------------- mock programme partner (saha-mis-v1)
 // ledger: key -> {status, receipt, accepted (count of accepted records), submits, resendAllowed}
 const misLedger=new Map(),acceptedPerVisit=new Map();let forceDeliver=false;const callbackQueue=[];
 const misRecord=(key)=>{if(!misLedger.has(key))misLedger.set(key,{status:null,receipt:undefined,accepted:0,submits:0,lookups:0,resendAllowed:false,payloadHash:null,notFoundRecordedAtSubmit:0,visit:null});return misLedger.get(key);};
 function misSettle(r,key,status,orgId,subId){
  r.status=status;if(status==='accepted'){r.accepted++;r.receipt=r.receipt??'PARTNER-'+key;if(r.accepted>1)bump('misDuplicateAcceptedRecords');if(r.visit){const n=(acceptedPerVisit.get(r.visit)??0)+1;acceptedPerVisit.set(r.visit,n);if(n>1)bump('misDuplicateAcceptedVisits');}}
  // Signed callbacks for terminal outcomes; sometimes duplicated, sometimes delivered before the HTTP response.
  if(['accepted','rejected'].includes(status)&&rng()<0.5){const copies=1+(rng()<0.5?1:0)+(rng()<0.25?1:0);for(let c=0;c<copies;c++)callbackQueue.push({orgId,subId,receipt:{contract:'saha-mis-v1',key,payloadHash:r.payloadHash,status,...(status==='accepted'?{receipt:r.receipt}:{})},inline:rng()<0.3});bump('misCallbacksScheduled',copies);bump('misDuplicateCallbacks',copies-1);}
 }
 async function misPartner(orgId,url,init){
  bump('misPartnerRequests');const body=JSON.parse(init.body),idem=init.headers['Idempotency-Key'];const key=body.key,subId=key;
  const r=misRecord(key);
  if(body.operation==='lookup'){
   r.lookups++;bump('misLookupRequests');assert.equal(body.fields,undefined,'A lookup must not carry visit fields');assert.notEqual(idem,key,'A lookup uses its own operation key');
   if(r.status==='pending'){const done=forceDeliver?'accepted':pick([['accepted',0.4],['rejected',0.1],['pending',0.5]]);if(done!=='pending')misSettle(r,key,done,orgId,subId);}
   const mode=forceDeliver?'deliver':pick([['deliver',0.7],['timeout',0.15],['drop',0.15]]);
   if(mode==='timeout'){bump('misLookupTimeouts');throw timeout();}
   const answer={contract:'saha-mis-v1',key,payloadHash:body.payloadHash,status:r.status??'not_found',...(r.status==='accepted'?{receipt:r.receipt}:{})};
   if(mode==='drop'){bump('misLookupDropped');return truncated(answer);}
   if(!r.status)r.resendAllowed=true;bump('misLookupDelivered');return jsonResponse(answer);
  }
  // Submission. Saha may only (re)send a key the partner has never seen, or one whose definitive not_found the partner
  // delivered AND Saha recorded (slice 6ab: read from Saha's stored delivery events at the moment of the resend).
  assert.equal(idem,key,'HTTP Idempotency-Key must equal the body key');
  const savedSub=store.orgs.get(orgId)?.state.workspace.submissions.find(x=>x.id===subId),recordedNotFound=(savedSub?.delivery?.events??[]).filter(e=>/^Programme confirmed no record for this key/.test(e.detail)).length;
  if(r.submits>0&&!(r.resendAllowed&&recordedNotFound>r.notFoundRecordedAtSubmit))bump('misBlindResends');
  if(r.status==='accepted'||r.status==='rejected')bump('misSubmitAfterTerminal');
  r.submits++;r.resendAllowed=false;r.notFoundRecordedAtSubmit=recordedNotFound;r.payloadHash=body.payloadHash;r.visit=r.visit??(body.fields?.visit_reference?orgId+'|'+body.fields.visit_reference:null);bump('misSubmitRequests');
  const mode=forceDeliver?'accept':pick([['accept',0.3],['reject',0.08],['pending',0.07],['timeoutAfterAccept',0.15],['timeoutBeforeAccept',0.15],['dropAfterAccept',0.08],['resetAfterAccept',0.05],['http503',0.06],['wrongHash',0.06]]);
  bump('misSubmit:'+mode);
  const respond=(status)=>({contract:'saha-mis-v1',key,payloadHash:body.payloadHash,status,...(status==='accepted'?{receipt:r.receipt}:{})});
  const runInline=async()=>{for(let n=callbackQueue.length-1;n>=0;n--){const cb=callbackQueue[n];if(cb.inline&&cb.receipt.key===key){callbackQueue.splice(n,1);await misCallback(cb);}}};
  if(mode==='timeoutBeforeAccept'){bump('misSubmitTimeouts');throw timeout();}
  if(mode==='http503'){bump('misHttpErrors');return jsonResponse({error:'unavailable'},503);}
  if(mode==='reject'){misSettle(r,key,'rejected',orgId,subId);await runInline();return jsonResponse(respond('rejected'));}
  if(mode==='pending'){r.status='pending';return jsonResponse(respond('pending'));}
  misSettle(r,key,'accepted',orgId,subId);await runInline();
  if(mode==='timeoutAfterAccept'){bump('misSubmitTimeouts');throw timeout();}
  if(mode==='dropAfterAccept'){bump('misSubmitDropped');return truncated(respond('accepted'));}
  if(mode==='resetAfterAccept'){bump('misSubmitDropped');throw new TypeError('fetch failed: other side closed');}
  if(mode==='wrongHash'){bump('misMismatchedReceipts');return jsonResponse({...respond('accepted'),payloadHash:'0'.repeat(64)});}
  return jsonResponse(respond('accepted'));
 }
 // Slice 6ab: a signed callback goes through the real route function (signature, grant, endpoint/binding checks,
 // terminal replay, stored command receipt, 60-event limit, three compare-and-swap attempts).
 async function misCallback(cb){
  bump('misCallbacksDelivered');const raw=JSON.stringify({organisationId:cb.orgId,integrationId:'mis1',submissionId:cb.subId,receipt:cb.receipt}),{ts,sig}=await signed(raw);
  const res=await callbackRoute(new Request('https://saha.example/api/mis/callback',{method:'POST',headers:{'content-type':'application/json','x-saha-timestamp':ts,'x-saha-signature':sig},body:raw}));const out=await res.json();
  if(res.status===200){bump(out.replayed?'misCallbackReplayed':'misCallbackApplied');return;}
  if(res.status===409&&/conflict/i.test(out.error??'')){bump('misCallbackConflictRetried');callbackQueue.push({...cb,inline:false});return;}
  if(res.status===409&&/event limit/.test(out.error??''))bump('misCallbackEventLimit');
  if(res.status===401)bump('misCallbackUnauthenticated');
  bump('misCallbackRefused');
 }

 // ---------------------------------------------------------------- mock EHR partner (FHIR R4 conditional create)
 const ehrLedger=new Map();let stored=0;
 const ehrRecord=(identifier)=>{if(!ehrLedger.has(identifier))ehrLedger.set(identifier,{posts:0,docs:[],lookups:0});return ehrLedger.get(identifier);};
 async function ehrPartner(url,init={}){
  bump('ehrPartnerRequests');const u=new URL(url),path=u.pathname.replace(/^\/fhir\//,'');const type='application/fhir+json';
  if(path.startsWith('Patient/')){const mode=forceDeliver?'ok':pick([['ok',0.9],['timeout',0.05],['http503',0.05]]);bump('ehrPatient:'+mode);if(mode==='timeout'){bump('ehrPatientTimeouts');throw timeout();}if(mode==='http503'){bump('ehrHttpErrors');return jsonResponse({resourceType:'OperationOutcome'},503,type);}return jsonResponse({resourceType:'Patient',id:'external-1',name:[{text:'Soak Person'}]},200,type);}
  if(path==='Bundle'&&init.method==='POST'){
   const doc=JSON.parse(init.body),identifier=doc.identifier.system+'|'+doc.identifier.value,r=ehrRecord(identifier);
   assert.equal(init.headers['If-None-Exist'],'identifier='+encodeURIComponent(identifier),'Every publication uses conditional create');
   r.posts++;bump('ehrPostRequests');if(r.posts>1)bump('ehrRepeatPosts');
   const mode=forceDeliver?'accept':pick([['accept',0.35],['reject422',0.1],['timeoutBeforeStore',0.15],['timeoutAfterStore',0.15],['dropAfterStore',0.15],['changedContent',0.1]]);bump('ehrPost:'+mode);
   if(mode==='timeoutBeforeStore'){bump('ehrPostTimeouts');throw timeout();}
   if(mode==='reject422'){bump('ehrHttpErrors');return jsonResponse({resourceType:'OperationOutcome'},422,type);}
   // Naive store: no If-None-Exist enforcement, so a second POST would create a second document.
   const saved={...doc,id:'stored-'+(++stored)};r.docs.push(saved);if(r.docs.length>1)bump('ehrDuplicateStoredDocuments');
   if(mode==='timeoutAfterStore'){bump('ehrPostTimeouts');throw timeout();}
   if(mode==='dropAfterStore'){bump('ehrPostDropped');return truncated(saved,type);}
   if(mode==='changedContent'){bump('ehrChangedAcknowledgements');return jsonResponse({...saved,entry:saved.entry.slice(0,-1)},200,type);}
   return jsonResponse(saved,201,type);
  }
  if(path==='Bundle'&&u.searchParams.get('identifier')){
   assert.equal(init.body,undefined,'A lookup never sends a document');assert.ok(!init.method||init.method==='GET','A lookup is a GET');
   const r=ehrRecord(u.searchParams.get('identifier'));r.lookups++;bump('ehrLookupRequests');const mode=forceDeliver?'deliver':pick([['deliver',0.7],['timeout',0.15],['drop',0.15]]);
   const answer={resourceType:'Bundle',type:'searchset',total:r.docs.length,entry:r.docs.map(d=>({resource:d}))};
   if(mode==='timeout'){bump('ehrLookupTimeouts');throw timeout();}if(mode==='drop'){bump('ehrLookupDropped');return truncated(answer,type);}bump('ehrLookupDelivered');return jsonResponse(answer,200,type);
  }
  throw new Error('Unexpected EHR request '+path);
 }

 // ---------------------------------------------------------------- command runner (models the server receipt replay)
 let keyCounter=0;const freshKey=(p)=>p+'-k'+(++keyCounter);
 async function run(orgId,key,exec){const o=store.orgs.get(orgId),saved=o.receipts.get(actor.userId+'|'+key);if(saved){bump('sameKeyReplays');return {...saved.response,replayed:true};}
  try{return await exec(await store.readState({},orgId));}catch(e){if(e instanceof AppError){bump('refused:'+e.status);if(/CAS conflict/.test(e.message))bump('casConflicts');if(/interruption/.test(e.message))bump('interruptedFinishes');if(/event limit/.test(e.message))bump('eventLimitRefusals');return {error:e.message,status:e.status};}throw e;}}

 // ---------------------------------------------------------------- MIS organisation lifecycle
 const misEndpoint='https://programme.example/api';
 async function misOrganisation(n,planned=false){
  const orgId=(planned?'mis-plan-org-':'mis-org-')+n;stub.grants.push({organisationId:orgId,integrationId:'mis1',origin:'https://programme.example',credentialBinding:'SAHA_MIS_SOAK',callbackBinding:'SAHA_MIS_SOAK_CB'});const env=stub.runtime();
  const i={id:'mis1',kind:'mis',mode:'http',status:'active',version:1,name:'Synthetic programme',endpoint:misEndpoint,credentialBinding:'SAHA_MIS_SOAK',programmes:['General care'],mis:{contract:'saha-mis-v1',mapping:planned?[{source:'personId',target:'patient_reference',required:true},{source:'visitId',target:'visit_reference',required:true},{source:'weight',target:'weight_kg',required:true}]:[],corrections:false,test:{ok:true}}};
  const people=[],visits=[],submissions=[];
  if(planned)for(let j=0;j<3;j++){const pid=`${orgId}-p${j}`;people.push({id:pid,name:'Soak Person',assigned:true,exchangeConsent:true,version:1,consentVersion:1,programmes:['General care']});visits.push({id:`${orgId}-v${j}`,personId:pid,state:'confirmed',version:1,facts:{weight:String(50+j)}});}
  else for(let j=0;j<3;j++){const pid=`${orgId}-p${j}`,vid=`${orgId}-v${j}`,key=`${orgId}-s${j}`,payload={contract:'saha-mis-v1',environment:'synthetic',operation:'submit',fields:{patient_reference:pid,weight_kg:String(50+j)}};
   people.push({id:pid,assigned:true,exchangeConsent:true,version:1,consentVersion:1});visits.push({id:vid,personId:pid,state:'confirmed',version:1,facts:{}});
   submissions.push({id:key,visitId:vid,personId:pid,connectorId:'mis1',connectorName:i.name,state:'queued',attempts:0,payloadHash:sha(payload),delivery:{endpoint:misEndpoint,credentialBinding:'SAHA_MIS_SOAK',key,actorId:'worker',connectorVersion:1,personVersion:1,consentVersion:1,visitVersion:1,expiresAt:new Date(Date.now()+3600000).toISOString(),payload,events:[]}});}
  store.setup({organisation:{id:orgId,name:'Soak organisation',revision:1},members:[member],workspace:{role:'clinician',people,visits,integrations:[i],submissions,audit:[]}});
  // Slice 6ab: a planned organisation creates (and later re-creates) its submissions through the real plan commands.
  const command=async(fn)=>{const s=await store.readState({},orgId),before=structuredClone(s);await fn(s);await store.persist({},before,s,actor,{type:'soakSetup'},freshKey(orgId+'-cmd'),'h',{});};
  const plan=async(visitId)=>{try{await command(async s=>{const w=s.workspace,ext={call:()=>{throw new Error('no external call');}};const {planId}=await coreApply(w,{type:'preparePlan',visitId,recipients:['mis1']},actor.userId,ext);const v=w.visits.find(x=>x.id===visitId);await coreApply(w,{type:'approvePlan',visitId,planId,payloadHash:v.plan.payloadHash},actor.userId,ext);await coreApply(w,{type:'executePlan',visitId,planId},actor.userId,ext);});bump('misPlansExecuted');}catch(e){if(!(e instanceof AppError))throw e;bump('misPlansRefused');}};
  const setCreate=async(on)=>{await command(async s=>{const x=s.workspace.integrations[0];x.operations={version:(x.operations?.version??0)+1,allowed:on?['create','update','lookup']:['update','lookup'],aggregateOnly:false,setBy:'worker',setAt:new Date().toISOString(),reason:'Synthetic soak withdrawal',history:[]};});bump(on?'misCreateRestored':'misCreateWithdrawn');};
  const replan=async()=>{for(const v of structuredClone(store.orgs.get(orgId).state.workspace.visits)){const subs=store.orgs.get(orgId).state.workspace.submissions.filter(x=>x.visitId===v.id);if(subs.length&&subs.every(x=>x.state==='cancelled')){await plan(v.id);bump('misReprepared');}
   // Re-preparing while an earlier delivery of the visit is open or resolved must be refused (no second record).
   else if(subs.some(x=>x.state!=='cancelled')&&rng()<0.5){const before=store.orgs.get(orgId).state.workspace.submissions.length;await plan(v.id);assert.equal(store.orgs.get(orgId).state.workspace.submissions.length,before,'A visit with an open or resolved delivery cannot be planned again');bump('misReprepareRefused');}}};
  if(planned)for(const v of visits)await plan(v.id);
  const transport=(ii,org,e,body,key)=>misRequest(ii,org,e,body,key,(url,init)=>misPartner(orgId,url,init));
  const send=(sub,key)=>run(orgId,key,s=>executeMis({},s,{type:'sendSubmission',submissionId:sub.id},actor,member,key,'h-'+key,env,transport));
  const lookup=(sub,key)=>run(orgId,key,s=>executeMis({},s,{type:'lookupSubmission',submissionId:sub.id},actor,member,key,'h-'+key,env,transport));
  const o=store.orgs.get(orgId);
  for(let round=0;round<10;round++){
   // Simulated clock: a checkpoint left 'sending' by an interrupted command is older than 30 seconds next round.
   for(const x of o.state.workspace.submissions)if(x.state==='sending'){x.delivery.startedAt=new Date(Date.now()-31000).toISOString();bump('misStuckCheckpoints');}
   // Slice 6ab: planned organisations withdraw create in round 2, cancel one unsent delivery before the first send, and restore create
   // and re-prepare every visit whose deliveries are all closed in round 4.
   if(planned&&round===2)await setCreate(false);
   if(planned&&round===0){const q=o.state.workspace.submissions.find(x=>['queued','retryable'].includes(x.state));if(q){const s=await store.readState({},orgId),before=structuredClone(s);await configureMis(s,{type:'cancelSubmission',submissionId:q.id},actor,member,env);await store.persist({},before,s,actor,{type:'cancelSubmission'},freshKey(orgId+'-cancel'),'h',{});bump('misCancelled');}}
   if(planned&&round===4){await setCreate(true);await replan();}
   const s=structuredClone(o.state);if(round>4&&s.workspace.submissions.every(x=>['accepted','rejected','cancelled'].includes(x.state)||(x.state==='retryable'&&x.attempts>=3)))break;
   o.interrupt=rng()<0.06;if(o.interrupt)bump('interruptedRounds');
   const tasks=[];const deferred=callbackQueue.splice(0).filter(cb=>{if(cb.orgId===orgId)return true;callbackQueue.push(cb);return false;});
   for(const cb of deferred){tasks.push(misCallback(cb));}bump('misCallbacksAfterResponse',deferred.length);
   for(const sub of s.workspace.submissions){
    if(['queued','retryable'].includes(sub.state)&&sub.attempts<3){const k=rng()<0.3?(rng()<0.5?2:3):1;bump('misSends');bump('concurrentExtraAttempts',k-1);
     tasks.push((async()=>{const keys=Array.from({length:k},()=>freshKey(sub.id));await Promise.all(keys.map(x=>send(sub,x)));if(rng()<0.3){const before=misRecord(sub.delivery.key).submits;const r=await send(sub,keys[0]);if(r.replayed)assert.equal(misRecord(sub.delivery.key).submits,before,'A same-key replay must not reach the partner');}})());}
    else if(['uncertain','sending'].includes(sub.state)){
     if(rng()<0.75){const k=rng()<0.2?2:1;bump('misLookups');bump('concurrentExtraLookups',k-1);tasks.push(Promise.all(Array.from({length:k},()=>lookup(sub,freshKey(sub.id+'-l')))));}
     else tasks.push((async()=>{const before=misRecord(sub.delivery.key).submits;const r=await send(sub,freshKey(sub.id));bump('newKeyReplays');assert.equal(misRecord(sub.delivery.key).submits,before,'A send while unresolved must not reach the partner');assert.ok(r.error||['uncertain','sending','accepted','rejected'].includes(r.state));})());}
    else if(['accepted','rejected'].includes(sub.state)&&rng()<0.3)tasks.push((async()=>{const before=misRecord(sub.delivery.key).submits;const r=await send(sub,freshKey(sub.id));bump('newKeyReplays');assert.equal(misRecord(sub.delivery.key).submits,before,'A resolved delivery must not be resent');})());
   }
   await Promise.all(tasks);o.interrupt=false;
  }
  return {orgId,env,lookup,send,replan,planned};
 }

 // ---------------------------------------------------------------- EHR organisation lifecycle
 const ehrBase='https://ehr.example/fhir';
 async function ehrOrganisation(n,authoritative=false){
  const orgId=(authoritative?'ehra-org-':'ehr-org-')+n,env={SAHA_EXTERNAL_APIS_ENABLED:'true',SAHA_EHR_SOAK:'synthetic-secret',SAHA_EHR_CONNECTIONS:JSON.stringify([{organisationId:orgId,integrationId:'ehr1',baseUrl:ehrBase,credentialBinding:'SAHA_EHR_SOAK'}])};
  const i={id:'ehr1',kind:'ehr',mode:'http',status:'active',version:1,name:'Synthetic EHR',endpoint:ehrBase,credentialBinding:'SAHA_EHR_SOAK',ehr:{read:true,write:true,...(authoritative?{lookup:{version:1,authoritative:true,consistencySeconds:30,ownerId:'worker',setBy:'worker',setAt:new Date().toISOString(),reason:'Synthetic partner contract: identifier search is authoritative after 30 seconds.',history:[]}}:{})}};
  const p={id:'p',name:'Soak Person',sex:'Other',age:30,village:'Soak village',version:1,consentVersion:1,exchangeConsent:true,assigned:true},date=new Date().toISOString().slice(0,16);
  const visits=[0,1,2].map(j=>({id:'v'+j,personId:'p',version:1,state:'confirmed',facts:{date,source:'reported',weight:String(50+j),notes:'Synthetic soak visit'}}));
  const state={organisation:{id:orgId,name:'Soak organisation',revision:1},members:[member],workspace:{role:'clinician',people:[p],visits,integrations:[i],submissions:[],audit:[]}};
  await applyEhr(state,{type:'linkEhr',personId:'p',version:1,integrationId:'ehr1',externalId:'external-1',externalName:'Soak Person',reason:'Synthetic soak identity',confirmed:true},actor,member,env);const linkId=p.ehr.links[0].id;
  await applyEhr(state,{type:'grantEhrPermission',personId:'p',linkId,direction:'write',purpose:'care-coordination',from:'2026-01-01T00:00:00.000Z',to:new Date(Date.now()+86400000).toISOString(),expiresAt:new Date(Date.now()+864000000).toISOString()},actor,member,env);const permissionId=p.ehr.permissions[0].id;
  for(const v of visits)await applyEhr(state,{type:'prepareEhrPublish',personId:'p',linkId,permissionId,visitId:v.id},actor,member,env);
  store.setup(state);const o=store.orgs.get(orgId);
  const transport=(ii,org,e,path,init)=>fhirRequest(ii,org,e,path,init,(url,ri)=>ehrPartner(url,ri));
  const execute=(op,key)=>run(orgId,key,s=>executeEhr({},s,{type:'executeEhrPublish',personId:'p',operationId:op.id,hash:op.hash},actor,member,key,'h-'+key,env,transport));
  const lookup=(op,key)=>run(orgId,key,s=>executeEhr({},s,{type:'lookupEhrPublish',personId:'p',operationId:op.id},actor,member,key,'h-'+key,env,transport));
  for(let round=0;round<10;round++){
   for(const op of o.state.workspace.people[0].ehr.operations){if(op.state==='running'){op.at=new Date(Date.now()-46000).toISOString();bump('ehrStuckCheckpoints');}if(op.publishStartedAt)op.publishStartedAt=new Date(Date.parse(op.publishStartedAt)-40000).toISOString();}
   const ops=structuredClone(o.state.workspace.people[0].ehr.operations);if(ops.every(x=>CLOSED_EHR.includes(x.state)))break;
   o.interrupt=rng()<0.06;if(o.interrupt)bump('interruptedRounds');const tasks=[];
   for(const op of ops){const identifier='urn:saha:documents|'+op.id;
    if(op.state==='prepared'){const k=rng()<0.3?(rng()<0.5?2:3):1;bump('ehrExecutes');bump('concurrentExtraAttempts',k-1);
     tasks.push((async()=>{const keys=Array.from({length:k},()=>freshKey(op.id));await Promise.all(keys.map(x=>execute(op,x)));if(rng()<0.3){const before=ehrRecord(identifier).posts;const r=await execute(op,keys[0]);if(r.replayed)assert.equal(ehrRecord(identifier).posts,before,'A same-key replay must not reach the EHR');}})());}
    else if(['uncertain','running'].includes(op.state)){
     if(rng()<0.75){const k=rng()<0.2?2:1;bump('ehrLookups');bump('concurrentExtraLookups',k-1);tasks.push(Promise.all(Array.from({length:k},()=>lookup(op,freshKey(op.id+'-l')))));}
     else tasks.push((async()=>{const before=ehrRecord(identifier).posts;await execute(op,freshKey(op.id));bump('newKeyReplays');assert.equal(ehrRecord(identifier).posts,before,'An unresolved publication must not be resent');})());}
    else if(CLOSED_EHR.includes(op.state)&&rng()<0.3)tasks.push((async()=>{const before=ehrRecord(identifier).posts;await execute(op,freshKey(op.id));bump('newKeyReplays');assert.equal(ehrRecord(identifier).posts,before,'A closed publication must not be resent');})());
   }
   await Promise.all(tasks);o.interrupt=false;
  }
  return {orgId,lookup,execute,authoritative};
 }
 const CLOSED_EHR=['accepted','blocked','not-stored','conflict'];

 // ---------------------------------------------------------------- drive until the replay/timeout event target is met
 // Counted toward the target: timeouts, lost (dropped, truncated or reset) responses, command replays with the same or a
 // fresh key, extra concurrent attempts and lookups, and duplicate signed callbacks. HTTP errors, mismatched or changed
 // acknowledgements and interrupted final writes are exercised and reported but NOT counted toward the target.
 const TIMEOUT_KEYS=['misSubmitTimeouts','misLookupTimeouts','ehrPostTimeouts','ehrLookupTimeouts','ehrPatientTimeouts','misSubmitDropped','misLookupDropped','ehrPostDropped','ehrLookupDropped'];
 const REPLAY_KEYS=['sameKeyReplays','newKeyReplays','concurrentExtraAttempts','concurrentExtraLookups','misDuplicateCallbacks'];
 const REPLAY_TIMEOUT_KEYS=[...TIMEOUT_KEYS,...REPLAY_KEYS];
 const replayTimeoutEvents=()=>REPLAY_TIMEOUT_KEYS.reduce((a,k)=>a+(counts[k]??0),0);
 const misOrgs=[],ehrOrgs=[],ehrAuthOrgs=[];let n=0;
 for(let k=0;k<PLAN_ORGS;k++)misOrgs.push(await misOrganisation(k,true));
 while(replayTimeoutEvents()<TARGET){misOrgs.push(await misOrganisation(n));ehrOrgs.push(await ehrOrganisation(n));ehrAuthOrgs.push(await ehrOrganisation(n,true));n++;}

 // Slice 7f: EHR states at the end of the fault rounds, before the reconciliation pass, for both partner kinds.
 const tallyOf=(orgs)=>{const t={};for(const org of orgs)for(const op of store.orgs.get(org.orgId).state.workspace.people[0].ehr.operations)t[op.state]=(t[op.state]??0)+1;return t;};
 const beforeReconciliation={ehr:tallyOf(ehrOrgs),ehrAuthoritative:tallyOf(ehrAuthOrgs)};
 // ---------------------------------------------------------------- reconciliation: faults off, resolve only by lookup
 forceDeliver=true;
 for(const cb of callbackQueue.splice(0))await misCallback(cb);
 for(const org of misOrgs){const o=store.orgs.get(org.orgId);for(let pass=0;pass<8;pass++){let open=false;
   for(const x of o.state.workspace.submissions)if(x.state==='sending')x.delivery.startedAt=new Date(Date.now()-31000).toISOString();
   for(const sub of structuredClone(o.state.workspace.submissions)){if(['uncertain','sending'].includes(sub.state)){open=true;await org.lookup(sub,freshKey(sub.id+'-r'));bump('reconcileLookups');}else if(['queued','retryable'].includes(sub.state)&&sub.attempts<3){open=true;await org.send(sub,freshKey(sub.id+'-r'));bump('reconcileSends');}}
   for(const cb of callbackQueue.splice(0))await misCallback(cb);if(org.planned&&pass===0)await org.replan();if(!open&&pass>0)break;}}
 for(const org of [...ehrOrgs,...ehrAuthOrgs]){const o=store.orgs.get(org.orgId);for(let pass=0;pass<4;pass++){let open=false;
   // Simulated clock: the reconciliation runs after the attempt window and the partner's consistency delay.
   for(const op of o.state.workspace.people[0].ehr.operations){if(op.state==='running')op.at=new Date(Date.now()-46000).toISOString();if(op.publishStartedAt)op.publishStartedAt=new Date(Date.now()-(45+30+1)*1000).toISOString();}
   for(const op of structuredClone(o.state.workspace.people[0].ehr.operations)){if(op.state==='running'||(op.state==='uncertain'&&pass===0)){open=true;await org.lookup(op,freshKey(op.id+'-r'));bump('reconcileLookups');}else if(op.state==='prepared'){open=true;await org.execute(op,freshKey(op.id+'-r'));bump('reconcileSends');}}if(!open)break;}}

 // ---------------------------------------------------------------- checks
 const finalMis={},finalEhr={},finalEhrAuth={};let misItems=0,ehrItems=0,ehrAuthItems=0;
 // 1. The naive partner never recorded a second accepted programme record for any idempotency key.
 for(const [key,r] of misLedger){assert.ok(r.accepted<=1,`Duplicate accepted programme record for ${key}`);}assert.equal(counts.misDuplicateAcceptedRecords??0,0);
 // Slice 6ab: across keys too, the partner holds at most one accepted record per visit (plan re-preparation uses a new key).
 for(const [visit,k] of acceptedPerVisit)assert.ok(k<=1,`Two accepted programme records for visit ${visit}`);assert.equal(counts.misDuplicateAcceptedVisits??0,0);passed++;
 // 2. No programme submission reached the partner for a key whose uncertain outcome had not been resolved as not_found.
 assert.equal(counts.misBlindResends??0,0,'blind programme resend');assert.equal(counts.misSubmitAfterTerminal??0,0,'programme resend after a terminal outcome');passed++;
 // 3. Every Saha programme state matches the partner ledger after reconciliation.
 for(const org of misOrgs)for(const sub of store.orgs.get(org.orgId).state.workspace.submissions){misItems++;const r=misLedger.get(sub.delivery.key);finalMis[sub.state]=(finalMis[sub.state]??0)+1;
  assert.ok(sub.attempts<=3,'At most three sends');assert.ok(!r||r.submits<=sub.attempts,'Partner submits never exceed recorded attempts');
  if(sub.state==='accepted'){assert.equal(r.status,'accepted');assert.equal(r.accepted,1);assert.equal(sub.receipt,r.receipt);}
  else if(sub.state==='rejected')assert.equal(r.status,'rejected');
  else if(sub.state==='retryable'){assert.equal(sub.attempts,3,'Only exhausted items stay retryable after reconciliation');assert.ok(!r||!r.status,'retryable means the partner holds no record');}
  // Slice 6ab: closed by a withdrawn operation or cancelled before sending again; the partner holds no record for the key.
  else if(sub.state==='cancelled'){assert.ok(org.planned,'Only planned organisations cancel deliveries');assert.ok(!r||!r.status||r.status==='not_found','A cancelled delivery is one the partner holds no record for');}
  else assert.fail(`Programme delivery left ${sub.state} after reconciliation`);}
 passed++;
 // 4. The naive EHR never stored two documents for one identifier and never received a second POST for one publication.
 for(const [id,r] of ehrLedger){assert.ok(r.docs.length<=1,`Duplicate stored document for ${id}`);assert.ok(r.posts<=1,`Repeated POST for ${id}`);}assert.equal(counts.ehrDuplicateStoredDocuments??0,0);assert.equal(counts.ehrRepeatPosts??0,0);passed++;
 // 5. Every Saha EHR state matches the partner ledger. 'uncertain' is left only where the partner stored nothing: the
 // adapter has no definitive not-found answer (EHR-ABDM.md), so these need partner reconciliation and were never resent.
 // Slice 7f: with the authoritative partner, 'not-stored' only where the partner holds no document; 'conflict' cannot occur
 // here because the partner never holds two documents for one identifier (check 4). The default partner never yields either.
 for(const org of [...ehrOrgs,...ehrAuthOrgs])for(const op of store.orgs.get(org.orgId).state.workspace.people[0].ehr.operations){const r=ehrLedger.get('urn:saha:documents|'+op.id),tally=org.authoritative?finalEhrAuth:finalEhr;if(org.authoritative)ehrAuthItems++;else ehrItems++;tally[op.state]=(tally[op.state]??0)+1;
  if(op.state==='accepted'){assert.equal(r.docs.length,1);assert.equal(op.receipt,'Bundle/'+r.docs[0].id);}
  else if(op.state==='not-stored'){assert.ok(org.authoritative,'Only an authoritative search closes a publication as not stored');assert.ok(!r||r.docs.length===0,'Closed as not stored while the partner holds the document');assert.equal(op.resolution?.outcome,'not-stored');bump(r&&r.posts===1?'ehrNotStoredAfterWrite':'ehrNotStoredNeverWritten');}
  else if(op.state==='blocked')assert.ok(!r||r.posts===0,'A publication closed as not sent never reached the write endpoint');
  // posts 0: the checkpoint was saved but the command was interrupted before its outcome was stored, so Saha cannot
  // know whether the write started; it stays unresolved rather than being closed or resent.
  else if(op.state==='uncertain'){assert.ok(!r||(r.posts<=1&&r.docs.length===0),'An unresolved publication is one where the partner stored nothing');bump((org.authoritative?'ehrAuth':'ehr')+(r&&r.posts===1?'UnresolvedAfterWrite':'UnresolvedNeverWritten'));}
  else assert.fail(`EHR publication left ${op.state} after reconciliation`);}
 passed++;
 // 6. The soak met its event target and exercised every fault class.
 assert.ok(replayTimeoutEvents()>=TARGET);for(const k of ['misSubmitTimeouts','misLookupTimeouts','misSubmitDropped','misLookupDropped','misHttpErrors','misMismatchedReceipts','ehrPostTimeouts','ehrLookupTimeouts','ehrPostDropped','ehrLookupDropped','ehrChangedAcknowledgements','sameKeyReplays','newKeyReplays','concurrentExtraAttempts','casConflicts','misCallbacksScheduled','misDuplicateCallbacks','misCallbackReplayed','interruptedFinishes','ehrStuckCheckpoints','misCallbackApplied','misStuckCheckpoints',...(PLAN_ORGS?['misPlansExecuted','misCancelled','misCreateWithdrawn','misCreateRestored','misReprepared','misReprepareRefused']:[])])assert.ok((counts[k]??0)>0,`fault class not exercised: ${k}`);passed++;
 // 7. Uncertain outcomes were resolved by receipt (lookup or signed callback), and every lookup kept visit fields out.
 assert.ok((counts.misLookupDelivered??0)>0&&(counts.ehrLookupDelivered??0)>0);passed++;
 // 8. Slice 7f: the authoritative partner leaves a smaller unresolved share than the default partner, closes some
 // publications as not stored, and every lookup carried no document (asserted in the mock on each request).
 const share=(t,total)=>total?(t.uncertain??0)/total:0,unresolvedShare={default:share(finalEhr,ehrItems),authoritative:share(finalEhrAuth,ehrAuthItems)};
 assert.ok((finalEhrAuth['not-stored']??0)>0,'the authoritative partner closed publications as not stored');assert.equal(finalEhr['not-stored']??0,0);assert.equal((finalEhr.conflict??0)+(finalEhrAuth.conflict??0),0);
 assert.ok(unresolvedShare.authoritative<unresolvedShare.default,`unresolved share did not drop: ${JSON.stringify(unresolvedShare)}`);passed++;
 const result={passed,suite:'replay and timeout soak: real MIS/EHR execution and HTTP adapters against a naive faulty mock partner',seed:SEED,target:TARGET,replayTimeoutEvents:replayTimeoutEvents(),timeoutAndLostResponseEvents:TIMEOUT_KEYS.reduce((a,k)=>a+(counts[k]??0),0),replayEvents:REPLAY_KEYS.reduce((a,k)=>a+(counts[k]??0),0),countedKeys:{timeoutAndLostResponse:TIMEOUT_KEYS,replay:REPLAY_KEYS},organisations:{mis:misOrgs.length,misPlanned:misOrgs.filter(o=>o.planned).length,ehr:ehrOrgs.length,ehrAuthoritative:ehrAuthOrgs.length},items:{misSubmissions:misItems,ehrPublications:ehrItems,ehrAuthoritativePublications:ehrAuthItems},finalStates:{mis:finalMis,ehr:finalEhr,ehrAuthoritative:finalEhrAuth},unresolvedShare,ehrStatesBeforeReconciliation:beforeReconciliation,unresolvedShareBeforeReconciliation:{default:((beforeReconciliation.ehr.uncertain??0)+(beforeReconciliation.ehr.running??0))/ehrItems,authoritative:((beforeReconciliation.ehrAuthoritative.uncertain??0)+(beforeReconciliation.ehrAuthoritative.running??0))/ehrAuthItems},
  partnerLedger:{misKeys:misLedger.size,misAcceptedRecords:[...misLedger.values()].reduce((a,r)=>a+r.accepted,0),misDuplicateAcceptedRecords:counts.misDuplicateAcceptedRecords??0,misBlindResends:counts.misBlindResends??0,ehrIdentifiers:ehrLedger.size,ehrStoredDocuments:stored,ehrDuplicateStoredDocuments:counts.ehrDuplicateStoredDocuments??0,ehrRepeatPosts:counts.ehrRepeatPosts??0},
  counts:Object.fromEntries(Object.entries(counts).sort(([a],[b])=>a.localeCompare(b))),durationMs:Date.now()-started,
  limits:'In-memory CAS model, not D1; signed callbacks run the real callback route function with an in-memory stand-in for its two D1 queries; same-key replay modelled from stored receipts as server.ts does; simulated clock for stuck checkpoints; consistent partner lookups, no late-arriving requests; the authoritative partner is the same mock with a declared lookup policy (consistency delay 30 s) and simulated clock steps of 40 s per round.',completedAt:new Date().toISOString()};
 writeFileSync('tests/replay-soak-result.json',JSON.stringify(result,null,2)+'\n');if(OUT){mkdirSync(dirname(OUT),{recursive:true});writeFileSync(OUT,JSON.stringify(result,null,2)+'\n');}
 console.log({passed,replayTimeoutEvents:result.replayTimeoutEvents,organisations:result.organisations,finalStates:result.finalStates,unresolvedShare,partnerLedger:result.partnerLedger,durationMs:result.durationMs});
}finally{rmSync(dir,{recursive:true,force:true})}
