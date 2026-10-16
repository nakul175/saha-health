import assert from 'node:assert/strict';
import ts from 'typescript';
import {createHash} from 'node:crypto';
const payloadDigest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
// Slice 7e: separate operation permissions for every record adapter (BR-INT-02, BR-INT-09).
const dir=mkdtempSync(join(process.cwd(),'.adapter-operations-'));let passed=0;const failures=[];
const check=async(name,f)=>{try{await f();passed++;}catch(e){failures.push(name+': '+(e?.message??e));}};
const rejects=async(f,status,re)=>{let err;try{await f();}catch(e){err=e;}assert.ok(err,'expected a refusal');assert.equal(err.status,status,err.message);if(re)assert.match(err.message,re);return err;};
try{
 for(const f of ['abdm', 'abdm-transfer', 'access', 'access-audit', 'action-plan', 'adapter-operations', 'agent', 'agent-minimisation', 'ai-budget', 'alerts', 'anaemia', 'audit-chain', 'capability-lifecycle', 'caseload', 'consent', 'continuity', 'service-dispatch','core', 'delegation', 'ehr', 'ehr-execution','ehr-probe', 'ehr-provider', 'environment', 'evaluation', 'exceptional', 'exceptions', 'expansion', 'facility-scope', 'fact-provenance', 'fhir-document', 'fhir-validate', 'field', 'field-registration', 'governance', 'household', 'household-constants', 'household-visit', 'household-visit-constants', 'identity', 'imported-visits', 'media', 'merge', 'mis', 'mis-execution', 'operations', 'outreach', 'pack-installation', 'partition', 'pilot', 'programme-commands', 'programmes', 'provider-sandbox', 'purpose-scope', 'referral-needs', 'referral-request', 'referral-rules', 'referrals', 'retention', 'rights', 'seed', 'send-gate', 'service-identity', 'shadow', 'store', 'task-limits', 'trace', 'types', 'visit-signoff']){writeFileSync(join(dir,f+'.js'),ts.transpileModule(readFileSync(`lib/saha/${f}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'"));}
 // Injectable persistence with a hook that runs after each commit (used to withdraw an operation between the
 // checkpoint and the external request). The HTTP suite exercises the real D1 persistence.
 writeFileSync(join(dir,'store.js'),`import {AppError} from './core.js'; export let saved;let hook=null;export function setup(s,h=null){saved=structuredClone(s);hook=h}export async function readState(){return structuredClone(saved)}export function scope(s,id){const m=s.members.find(m=>m.userId===id);if(!m||m.status==='suspended')throw new AppError(403,'Member revoked');return m}export async function persist(db,before,after,u,c){if(before.organisation.revision!==saved.organisation.revision)throw new AppError(409,'CAS conflict');saved=structuredClone(after);saved.organisation.revision++;if(hook)hook(saved,c);}`);
 writeFileSync(join(dir,'access-audit.js'),`export async function recordAccess(){}`);
 const imp=f=>import(pathToFileURL(join(dir,f+'.js')));
 const A=await imp('adapter-operations'),store=await imp('store'),{executeMis}=await imp('mis-execution'),{executeEhr}=await imp('ehr-execution'),{applyEhr}=await imp('ehr'),{exceptionQueue}=await imp('exceptions'),{AppError,uuid}=await imp('core'),{mappedPayload}=await imp('mis');
 const fail=(status,message)=>{throw new AppError(status,message)};
 const owner={userId:'own',displayName:'Owner',role:'clinician',status:'active',isOwner:true,teamIds:['t1']},worker={userId:'worker',displayName:'Synthetic worker',role:'clinician',status:'active',isOwner:false,teamIds:['t1']};
 const setting=(allowed,extra={})=>({version:1,allowed,aggregateOnly:false,setBy:'own',setAt:new Date().toISOString(),reason:'Synthetic test change',history:[],...extra});

 // 1. Defaults express the release behaviour before this slice; AI providers are not record adapters.
 await check('defaults',()=>{
  assert.deepEqual(A.operationsOf({kind:'mis',name:'M'}),{version:0,allowed:['create','update','lookup'],aggregateOnly:false,explicit:false});
  assert.deepEqual(A.operationsOf({kind:'ehr',name:'E'}).allowed,['create','lookup']);
  assert.deepEqual(A.operationsOf({kind:'abdm',name:'G'}).allowed,['create','delete','lookup']);
  assert.equal(A.operationRefusal({kind:'ai',name:'AI'},'create'),null);
  for(const op of ['create','update','lookup'])assert.equal(A.operationRefusal({kind:'mis',name:'M'},op),null);
  assert.match(A.operationRefusal({kind:'mis',name:'M'},'delete'),/not permitted to delete or void records \(operation setting version 0\)/);
  assert.match(A.operationRefusal({kind:'ehr',name:'E'},'update'),/not permitted to update records/);
  assert.equal(A.misOperation({operation:'correct'}),'update');assert.equal(A.misOperation({operation:'submit'}),'create');assert.equal(A.misOperation(undefined),'create');
 });
 // 2. Aggregate-only: never a patient-level record; aggregate reports and receipt lookups only when permitted.
 await check('aggregate-only policy',()=>{
  const i={kind:'mis',name:'District aggregate MIS',operations:setting(['lookup','aggregate'],{aggregateOnly:true})};
  assert.match(A.operationRefusal(i,'create','patient'),/aggregate-only destination: it may receive aggregate reports only, never a patient-level record/);
  assert.match(A.operationRefusal(i,'lookup','patient'),/aggregate-only/);
  assert.equal(A.operationRefusal(i,'aggregate','aggregate'),null);assert.equal(A.operationRefusal(i,'lookup','none'),null);
  const narrowed={...i,operations:setting(['aggregate'],{aggregateOnly:true})};assert.match(A.operationRefusal(narrowed,'lookup','none'),/not permitted to look up/);
  const s=A.adapterOperationsSchema;
  assert.equal(s.safeParse({type:'setAdapterOperations',integrationId:'m',version:0,allowed:['create','aggregate'],aggregateOnly:true,reason:'Aggregate only'}).success,false);
  assert.equal(s.safeParse({type:'setAdapterOperations',integrationId:'m',version:0,allowed:['lookup'],aggregateOnly:true,reason:'Aggregate only'}).success,false);
  assert.equal(s.safeParse({type:'setAdapterOperations',integrationId:'m',version:0,allowed:['aggregate','lookup'],aggregateOnly:true,reason:'Aggregate only'}).success,true);
  assert.equal(s.safeParse({type:'setAdapterOperations',integrationId:'m',version:0,allowed:['lookup','lookup'],aggregateOnly:false,reason:'Duplicate'}).success,false);
  assert.equal(s.safeParse({type:'setAdapterOperations',integrationId:'m',version:0,allowed:['read'],aggregateOnly:false,reason:'Unknown op'}).success,false);
 });
 // 3. Owner-managed, versioned and audited; history kept; a stale version, a no-op and EHR aggregate-only refused.
 await check('owner-managed versioned setting',async()=>{
  const s={organisation:{id:'org',revision:1},members:[owner,worker],workspace:{integrations:[{id:'m',kind:'mis',mode:'demo',name:'Register',version:4,status:'active'},{id:'e',kind:'ehr',mode:'http',name:'EHR',version:2,status:'active'},{id:'ai',kind:'ai',mode:'demo',name:'AI',version:1,status:'active'}],audit:[]}};
  const cmd={type:'setAdapterOperations',integrationId:'m',version:0,allowed:['lookup','create'],aggregateOnly:false,reason:'Updates need a separate process'};
  assert.equal(A.applyAdapterOperations(s,{type:'configureMis'},owner,owner,fail,uuid),null);
  await rejects(()=>A.applyAdapterOperations(s,cmd,owner,worker,fail,uuid),403,/Only an organisation owner/);
  await rejects(()=>A.applyAdapterOperations(s,{...cmd,version:1},owner,owner,fail,uuid),409,/changed/);
  await rejects(()=>A.applyAdapterOperations(s,{...cmd,integrationId:'ai'},owner,owner,fail,uuid),422,/programme, EHR or ABDM/);
  await rejects(()=>A.applyAdapterOperations(s,{...cmd,integrationId:'e',allowed:['aggregate'],aggregateOnly:true},owner,owner,fail,uuid),422,/Only a programme destination can be aggregate-only/);
  await rejects(()=>A.applyAdapterOperations(s,{...cmd,allowed:['create','update','lookup']},owner,owner,fail,uuid),409,/Nothing changed/);
  assert.deepEqual(A.applyAdapterOperations(s,cmd,owner,owner,fail,uuid),{integrationId:'m',version:1,allowed:['create','lookup'],aggregateOnly:false});
  const i=s.workspace.integrations[0];assert.equal(i.version,4,'integration version (approvals) is not bumped; every step rechecks the operation');assert.equal(i.operations.setBy,'own');assert.deepEqual(i.operations.history,[]);
  assert.equal(s.workspace.audit.at(-1).action,'setAdapterOperations');assert.match(s.workspace.audit.at(-1).detail,/create, lookup \(setting version 1\).*Reason: Updates need a separate process/);
  A.applyAdapterOperations(s,{...cmd,version:1,allowed:['aggregate','lookup'],aggregateOnly:true},owner,owner,fail,uuid);
  assert.equal(i.operations.version,2);assert.equal(i.operations.aggregateOnly,true);assert.deepEqual(i.operations.history.map(h=>[h.version,h.allowed]),[[1,['create','lookup']]]);
  assert.match(s.workspace.audit.at(-1).detail,/aggregate reports only/);
  assert.equal(JSON.stringify(s).includes('SAHA_'),false);
 });

 // 4. MIS deliveries: refused before the checkpoint, and withdrawn inside it, are closed as not sent; nothing is requested.
 const i={id:'mis1',kind:'mis',mode:'http',name:'Programme MIS',status:'active',version:1,endpoint:'https://programme.example/api',credentialBinding:'SAHA_MIS_TEST',mis:{contract:'saha-mis-v1',corrections:true,mapping:[{source:'weight',target:'weight',required:true}]}};
 const env={SAHA_EXTERNAL_APIS_ENABLED:'true',SAHA_MIS_TEST:'test',SAHA_MIS_CONNECTIONS:JSON.stringify([{organisationId:'org',integrationId:'mis1',origin:'https://programme.example',credentialBinding:'SAHA_MIS_TEST'}])};
 const misState=(state='queued',ops,correction=false)=>{
  const current={id:'v',personId:'p',state:'confirmed',version:1,facts:{weight:correction?'56':'55'},...(correction?{amendsVisitId:'previous-v'}:{})};
  const previous=correction?[{id:'previous',visitId:'previous-v',personId:'p',connectorId:'mis1',state:'accepted',receipt:'PREVIOUS-1',delivery:{key:'previous',events:[]}}]:[];
  const s={organisation:{id:'org',revision:1},members:[worker,owner],teams:[{id:'t1',name:'Team'}],workspace:{role:'clinician',people:[{id:'p',name:'Synthetic person',assigned:true,exchangeConsent:true,version:1,consentVersion:1,teamId:'t1'}],visits:[current],integrations:[{...i,...(ops?{operations:ops}:{})}],submissions:previous,audit:[]}};
  const payload=mappedPayload(i,current,s);s.workspace.submissions.unshift({id:'sub',visitId:'v',personId:'p',connectorId:'mis1',connectorName:'Programme MIS',state,attempts:state==='uncertain'?1:0,payloadHash:payloadDigest(payload),createdAt:new Date(Date.now()-60000).toISOString(),updatedAt:new Date().toISOString(),delivery:{endpoint:i.endpoint,credentialBinding:i.credentialBinding,key:'sub',actorId:'worker',connectorVersion:1,personVersion:1,consentVersion:1,visitVersion:1,expiresAt:new Date(Date.now()+60000).toISOString(),startedAt:new Date(Date.now()-60000).toISOString(),payload,events:[]}});return s;
 };
 let calls=0;const transport=async(_i,_org,_env,body)=>{calls++;return {contract:'saha-mis-v1',key:'sub',payloadHash:body.payloadHash,status:'accepted',receipt:'PARTNER-1'}};
 await check('MIS send refused before the checkpoint',async()=>{
  const s=misState('queued',setting(['update','lookup']));store.setup(s);calls=0;
  const r=await executeMis({},structuredClone(s),{type:'sendSubmission',submissionId:'sub'},worker,worker,'k1','h',env,transport);
  const sub=store.saved.workspace.submissions[0];
  assert.equal(calls,0);assert.equal(r.refused,true);assert.equal(sub.state,'cancelled');assert.equal(sub.attempts,0);
  assert.deepEqual({op:sub.refusal.operation,v:sub.refusal.settingVersion,stage:sub.refusal.stage},{op:'create',v:1,stage:'before-send'});
  assert.match(sub.delivery.events.at(-1).detail,/^Not sent: Programme MIS is not permitted to create records/);assert.equal(sub.delivery.events.at(-1).ref.command,'sendSubmission');
  assert.equal(store.saved.workspace.audit.at(-1).action,'adapterOperationRefused');assert.equal(sub.delivery.events.at(-1).ref.auditId,store.saved.workspace.audit.at(-1).id);
 });
 await check('MIS correction needs update',async()=>{
  const s=misState('queued',setting(['create','lookup']),true);store.setup(s);calls=0;
  const r=await executeMis({},structuredClone(s),{type:'sendSubmission',submissionId:'sub'},worker,worker,'k2','h',env,transport);
  assert.equal(calls,0);assert.equal(r.state,'cancelled');assert.equal(store.saved.workspace.submissions[0].refusal.operation,'update');
 });
 await check('MIS aggregate-only destination never receives a patient-level record',async()=>{
  const s=misState('queued',setting(['aggregate','lookup'],{aggregateOnly:true}));store.setup(s);calls=0;
  const r=await executeMis({},structuredClone(s),{type:'sendSubmission',submissionId:'sub'},worker,worker,'k3','h',env,transport);
  const sub=store.saved.workspace.submissions[0];assert.equal(calls,0);assert.equal(r.refused,true);assert.equal(sub.refusal.aggregateOnly,true);assert.match(sub.message,/aggregate-only destination/);
 });
 await check('MIS withdrawal inside the checkpoint stops the send',async()=>{
  const s=misState('queued');let withdrawn=false;
  store.setup(s,(saved,c)=>{if(c.type==='sendSubmission'&&!withdrawn){withdrawn=true;saved.workspace.integrations[0].operations=setting(['update','lookup']);}});calls=0;
  const r=await executeMis({},structuredClone(s),{type:'sendSubmission',submissionId:'sub'},worker,worker,'k4','h',env,transport);
  const sub=store.saved.workspace.submissions[0];
  assert.equal(calls,0,'no request after the withdrawal');assert.equal(r.refused,true);assert.equal(sub.state,'cancelled');assert.equal(sub.attempts,0,'reserved attempt released');assert.deepEqual(sub.attemptLog,[],'a checkpoint stopped before transport is not recorded as an attempted external write');
  assert.deepEqual([sub.refusal.operation,sub.refusal.stage,sub.refusal.settingVersion],['create','checkpoint',1]);
  assert.deepEqual(sub.delivery.events.map(e=>e.state),['sending','cancelled']);assert.equal(sub.delivery.events[1].ref.command,'adapterOperationRefused');assert.match(sub.delivery.events[1].detail,/withdrawn after the checkpoint and before the request, so nothing was sent/);
  // Replaying the original command key finds a closed delivery and sends nothing.
  const again=await executeMis({},await store.readState(),{type:'sendSubmission',submissionId:'sub'},worker,worker,'k4b','h',env,transport);assert.equal(again.state,'cancelled');assert.equal(calls,0);
 });
 await check('MIS default setting still sends',async()=>{
  const s=misState('queued');store.setup(s);calls=0;
  const r=await executeMis({},structuredClone(s),{type:'sendSubmission',submissionId:'sub'},worker,worker,'k5','h',env,transport),sub=store.saved.workspace.submissions[0];assert.equal(calls,1);assert.equal(r.state,'accepted');assert.equal(sub.refusal,undefined);assert.deepEqual({destination:sub.attemptLog[0].destination.name,version:sub.attemptLog[0].submittedVersion,actor:sub.attemptLog[0].initiatingAuthority.actorId,status:sub.attemptLog[0].status,receipt:sub.attemptLog[0].receipt},{destination:'Programme MIS',version:1,actor:'worker',status:'accepted',receipt:'PARTNER-1'});
 });
 await check('MIS receipt lookup refused before and inside the checkpoint',async()=>{
  const s=misState('uncertain',setting(['create','update']));store.setup(s);calls=0;
  await rejects(()=>executeMis({},structuredClone(s),{type:'lookupSubmission',submissionId:'sub'},worker,worker,'k6','h',env,transport),409,/not permitted to look up records or receipts.*stays unknown; do not resend/);
  assert.equal(calls,0);assert.equal(store.saved.workspace.submissions[0].state,'uncertain');
  const t=misState('uncertain');let done=false;store.setup(t,(saved,c)=>{if(c.type==='lookupSubmission'&&!done){done=true;saved.workspace.integrations[0].operations=setting(['create','update']);}});
  const r=await executeMis({},structuredClone(t),{type:'lookupSubmission',submissionId:'sub'},worker,worker,'k7','h',env,transport);
  const sub=store.saved.workspace.submissions[0];assert.equal(calls,0);assert.equal(r.state,'uncertain');assert.match(sub.delivery.events.at(-1).detail,/^Receipt lookup not made/);assert.equal(sub.refusal,undefined);
 });
 // 5. The exception queue raises refused deliveries for operations members, until a later submission exists.
 await check('exception queue row',async()=>{
  const s=misState('queued',setting(['lookup']));store.setup(s);await executeMis({},structuredClone(s),{type:'sendSubmission',submissionId:'sub'},worker,worker,'k8','h',env,transport);
  const st=await store.readState();st.workspace.referrals=[];st.governance={safety:[]};const q=exceptionQueue(st,owner);
  const row=q.items.find(x=>x.kind==='operation-refused');assert.ok(row,'row present');assert.equal(q.rulesVersion,'1.3.0');
  assert.equal(row.id,'operation-refused:submission:sub');assert.match(row.what,/Programme MIS: not sent, create not permitted \(setting version 1\)/);assert.deepEqual(row.trace,{query:'submission',id:'sub'});
  st.workspace.submissions.push({...st.workspace.submissions[0],id:'sub2',state:'accepted',refusal:undefined,createdAt:new Date(Date.now()+1000).toISOString()});
  assert.equal(exceptionQueue(st,owner).items.some(x=>x.kind==='operation-refused'),false,'a later submission resolves it');
 });

 // 6. EHR publication: refused at preparation, closed as not sent before the checkpoint and inside it.
 const ehrI={id:'ehr1',kind:'ehr',mode:'http',name:'District EHR',status:'active',version:1,endpoint:'https://ehr.example/fhir',credentialBinding:'SAHA_EHR_TEST',ehr:{read:true,write:true}};
 const eenv={SAHA_EXTERNAL_APIS_ENABLED:'true',SAHA_EHR_TEST:'test-secret',SAHA_EHR_CONNECTIONS:JSON.stringify([{organisationId:'org',integrationId:'ehr1',baseUrl:ehrI.endpoint,credentialBinding:ehrI.credentialBinding}])};
 const prepared=async()=>{
  const p={id:'p',name:'Test Person',sex:'Other',age:30,village:'Test village',version:1,consentVersion:1,exchangeConsent:true,assigned:true,teamId:'t1'},v={id:'v',personId:'p',version:1,state:'confirmed',facts:{date:new Date().toISOString().slice(0,16),source:'reported',weight:'55',notes:'Synthetic visit'}};
  const state={organisation:{id:'org',name:'Test organisation',revision:1},members:[{...worker,isOwner:true}],workspace:{role:'clinician',people:[p],visits:[v],integrations:[structuredClone(ehrI)],submissions:[],audit:[]}};const m=state.members[0];
  await applyEhr(state,{type:'linkEhr',personId:'p',version:1,integrationId:'ehr1',externalId:'external-1',externalName:'Test Person',reason:'Check synthetic ID',confirmed:true},worker,m,eenv);const linkId=p.ehr.links[0].id;
  await applyEhr(state,{type:'grantEhrPermission',personId:'p',linkId,direction:'write',purpose:'care-coordination',from:'2026-01-01T00:00:00.000Z',to:new Date(Date.now()+60000).toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()},worker,m,eenv);
  return {state,m,linkId,permissionId:p.ehr.permissions[0].id};
 };
 let writes=0;const remote={resourceType:'Patient',id:'external-1',name:[{text:'Test Person'}]};
 await check('EHR prepare refused without create',async()=>{
  const {state,m,linkId,permissionId}=await prepared();state.workspace.integrations[0].operations=setting(['lookup']);
  await rejects(()=>applyEhr(state,{type:'prepareEhrPublish',personId:'p',linkId,permissionId,visitId:'v'},worker,m,eenv),409,/District EHR is not permitted to create records/);
  assert.equal(state.workspace.people[0].ehr.operations.length,0);
 });
 await check('EHR publish closed as not sent before the checkpoint',async()=>{
  const {state,m,linkId,permissionId}=await prepared();await applyEhr(state,{type:'prepareEhrPublish',personId:'p',linkId,permissionId,visitId:'v'},worker,m,eenv);const op=state.workspace.people[0].ehr.operations[0];
  state.workspace.integrations[0].operations=setting(['lookup']);store.setup(state);writes=0;
  const r=await executeEhr({},structuredClone(state),{type:'executeEhrPublish',personId:'p',operationId:op.id,hash:op.hash},worker,m,'e1','h',eenv,async()=>{writes++;return remote});
  const saved=store.saved.workspace.people[0].ehr.operations[0];assert.equal(writes,0);assert.equal(r.refused,true);assert.equal(saved.state,'blocked');assert.equal(saved.refusal.stage,'before-send');assert.match(saved.message,/^Not sent: District EHR is not permitted to create records/);
  assert.equal(saved.events.at(-1).ref.command,'executeEhrPublish');
  const st=await store.readState();st.workspace.referrals=[];st.teams=[];st.governance={safety:[]};const row=exceptionQueue(st,{...m}).items.find(x=>x.kind==='operation-refused');assert.ok(row);assert.deepEqual(row.trace,{query:'publication',id:op.id});
 });
 await check('EHR withdrawal inside the checkpoint stops the write',async()=>{
  const {state,m,linkId,permissionId}=await prepared();await applyEhr(state,{type:'prepareEhrPublish',personId:'p',linkId,permissionId,visitId:'v'},worker,m,eenv);const op=state.workspace.people[0].ehr.operations[0];
  store.setup(state);writes=0;let patientReads=0;
  const transport=async(_i,_o,_e,path)=>{if(path.startsWith('Patient/')){patientReads++;store.saved.workspace.integrations[0].operations=setting(['lookup']);return remote;}writes++;return {};};
  const r=await executeEhr({},structuredClone(state),{type:'executeEhrPublish',personId:'p',operationId:op.id,hash:op.hash},worker,m,'e2','h',eenv,transport);
  const saved=store.saved.workspace.people[0].ehr.operations[0];assert.equal(patientReads,1,'authorized patient GET reached the operation-withdrawal checkpoint');assert.equal(writes,0,'no document write');assert.equal(r.state,'blocked');assert.equal(saved.refusal.stage,'checkpoint');assert.equal(saved.refusal.operation,'create');
  assert.match(saved.message,/^Not sent: District EHR is not permitted to create records/);assert.deepEqual(saved.events.map(e=>e.state),['running','blocked']);assert.equal(saved.events[1].ref.command,'adapterOperationRefused');
 });
 await check('EHR lookup refused before and inside the checkpoint',async()=>{
  const {state,m,linkId,permissionId}=await prepared();await applyEhr(state,{type:'prepareEhrPublish',personId:'p',linkId,permissionId,visitId:'v'},worker,m,eenv);const op=state.workspace.people[0].ehr.operations[0];
  op.state='uncertain';op.at=new Date(Date.now()-60000).toISOString();state.workspace.integrations[0].operations=setting(['create']);store.setup(state);writes=0;
  await rejects(()=>executeEhr({},structuredClone(state),{type:'lookupEhrPublish',personId:'p',operationId:op.id},worker,m,'e3','h',eenv,async()=>{writes++;return {}}),409,/not permitted to look up/);
  state.workspace.integrations[0].operations=setting(['create','lookup']);let done=false;store.setup(state,(saved,c)=>{if(c.type==='lookupEhrPublish'&&!done){done=true;saved.workspace.integrations[0].operations=setting(['create'],{version:2});}});
  const r=await executeEhr({},structuredClone(state),{type:'lookupEhrPublish',personId:'p',operationId:op.id},worker,m,'e4','h',eenv,async()=>{writes++;return {}});
  assert.equal(writes,0);assert.equal(r.state,'uncertain');assert.match(store.saved.workspace.people[0].ehr.operations[0].message,/^Receipt lookup not made/);
 });
 assert.deepEqual(failures,[]);
 writeFileSync('tests/adapter-operations-contract-result.json',JSON.stringify({suite:'adapter-operations-contract',passed,failed:0,at:new Date().toISOString()},null,1)+'\n');
 console.log(JSON.stringify({suite:'adapter-operations-contract',passed}));
}catch(e){console.error(e);console.error(failures.join('\n'));process.exitCode=1;}finally{rmSync(dir,{recursive:true,force:true});}
