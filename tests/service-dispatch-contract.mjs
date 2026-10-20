import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,mkdirSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const dir=mkdtempSync(join(process.cwd(),'.service-dispatch-'));let passed=0;
try{
 for(const file of readdirSync('lib/saha').filter(x=>x.endsWith('.ts'))){const source=readFileSync(join('lib/saha',file),'utf8');writeFileSync(join(dir,file.replace(/\.ts$/,'.js')),ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'"));}
 writeFileSync(join(dir,'core.js'),`export function fail(status,message){throw Object.assign(Error(message),{status})};export const uuid=()=>crypto.randomUUID();`);
 writeFileSync(join(dir,'store.js'),`export async function readState(db,org){if(org!==db.state.organisation.id)throw Object.assign(Error('wrong organisation'),{status:403});return structuredClone(db.state)};export function scope(s,id){const m=s.members.find(x=>x.userId===id&&x.status==='active');if(!m)throw Object.assign(Error('inactive human'),{status:403});return m}`);
 writeFileSync(join(dir,'access.js'),`export function purposePermits(m,purpose,grants){const g=grants?.find(g=>g.memberId===m.userId&&!g.revokedAt);return !g||!g.purposes.length||g.purposes.includes(purpose)};export function normallyAllowed(m,p,policy){return m.teamIds.includes(p.teamId)&&(!policy?.denied)&&m.role!=='admin'};export const allowed=normallyAllowed;`);
 writeFileSync(join(dir,'access-audit.js'),`export async function recordAccess(db,s,u,m,event){if(db.auditFailure)throw Object.assign(Error('audit unavailable'),{status:503});db.audit.push(event);if(db.revokeDuringAudit)db.state.operations.serviceIdentities[0].status='revoked';if(db.afterAudit)db.afterAudit(db.state)}`);
 const {serviceDispatch}=await import(pathToFileURL(join(dir,'service-dispatch.js'))),{applyServiceIdentity,requireServiceIdentity,independentTargets}=await import(pathToFileURL(join(dir,'service-identity.js')));
 const human={userId:'human',displayName:'Synthetic worker',role:'clinician',status:'active',isOwner:true,version:1,teamIds:['t']},actor={userId:'human',displayName:'Synthetic worker'},service={id:'si',name:'Connector worker',kind:'connector',targetId:'mis',ownerId:'human',status:'active',expiresAt:'2099-01-01T00:00:00Z'};
 for(const file of ['agent-execution','evaluation-execution','ehr-execution','mis-execution','aggregate-execution','destination-enrolment-execution','anaemia-server','frontline-server','server']){assert.match(readFileSync('lib/saha/'+file+'.ts','utf8'),/await serviceDispatch\(/,file+' dispatch boundary missing');passed++;}
 const catalog=JSON.parse(readFileSync('lib/saha/frontline/catalog.json','utf8'));assert.deepEqual(independentTargets.filter(x=>x.startsWith('frontline:')).sort(),catalog.map(x=>'frontline:'+x.id).sort());passed++;
 const inventory=(componentId='mis',release='1')=>({id:'assurance-'+componentId,kind:'provider',name:'Assured '+componentId,release,ownerId:'human',controls:['Signed release provenance'],subprocessors:[{name:'None disclosed',purpose:'Explicit provider declaration',jurisdiction:'Not applicable'}],incidentContact:'SECURITY-CASE-QUEUE',updateObligation:'Notify accountable owner before change.',supportUntil:'2099-01-01',materialChange:'Exact synthetic release assessed.',componentId,version:1,updatedBy:'human',updatedAt:'2026-10-21T00:00:00.000Z',findings:[],history:[]});
 const fixture=()=>({organisation:{id:'org'},members:[structuredClone(human)],operations:{version:0,dataFlows:[{id:'df',targetId:'mis',targetKind:'connector',targetVersion:0,targetFingerprint:'integration:mis:v0',organisationId:'org',state:'approved',accessPurpose:'programme-delivery',directions:['send','lookup','probe'],basis:{kind:'public-task',reference:'AUTH'},retentionRule:'30 days',dataClasses:['visit'],purpose:'programme delivery',recipient:'MIS'}],serviceIdentities:[structuredClone(service)],serviceBindings:{mis:'si'},supplyChain:[inventory()]},workspace:{people:[{id:'p',teamId:'t'}],integrations:[{id:'mis',kind:'mis',mode:'http',status:'active',version:1}],audit:[]}});
 const test=async(name,mutate,code)=>{const prepared=fixture(),db={state:structuredClone(prepared),audit:[]};if(mutate)mutate(db,prepared);let calls=0;try{await serviceDispatch(db,prepared,actor,human,'mis','p',{intent:'send',purpose:'programme-delivery'});calls++;if(code)assert.fail(name+' expected refusal');}catch(e){if(!code)throw e;assert.equal(e.status,code,name);assert.equal(calls,0,name+' dispatched');}passed++;};
 await test('active identity');
 await test('revoked after preparation',d=>d.state.operations.serviceIdentities[0].status='revoked',403);
 await test('expired after preparation',d=>d.state.operations.serviceIdentities[0].expiresAt='2000-01-01T00:00:00Z',403);
 await test('identity removed',d=>d.state.operations.serviceIdentities=[],404);
 await test('different target',d=>d.state.operations.serviceIdentities[0].targetId='other',403);
 await test('different kind',d=>d.state.operations.serviceIdentities[0].kind='agent',403);
 await test('binding removed',d=>d.state.operations.serviceBindings={},403);
 await test('binding replaced',d=>d.state.operations.serviceBindings.mis='replacement',403);
 await test('accountable owner suspended',d=>d.state.members[0].status='suspended',403);
 await test('accountable owner no longer owner/admin',d=>d.state.members[0].isOwner=false,403);
 await test('initiating human version changed',d=>d.state.members[0].version++,403);
 await test('patient team changed',d=>d.state.workspace.people[0].teamId='other',403);
 await test('policy scope denied',d=>d.state.operations.accessScope={denied:true},403);
 await test('connection version changed',d=>d.state.workspace.integrations[0].version=2,403);
 await test('connection removed',d=>d.state.workspace.integrations=[],403);
 await test('connection suspended',d=>d.state.workspace.integrations[0].status='suspended',403);
 await test('exact active release has no inventory',d=>d.state.operations.supplyChain[0].release='2',423);
 await test('active release support expired',d=>d.state.operations.supplyChain[0].supportUntil='2000-01-01',423);
 await test('active provider gains unresolved high component finding',d=>d.state.operations.supplyChain[0].findings.push({id:'high-live',severity:'high',exploitable:false,scope:'component',componentId:'mis',remedy:'Suspend and replace.',state:'open',reportedBy:'human',reportedAt:'2026-10-21T00:00:00.000Z'}),423);
 await test('active provider gains unresolved critical component finding during audit',d=>d.afterAudit=s=>s.operations.supplyChain[0].findings.push({id:'critical-race',severity:'critical',exploitable:true,scope:'component',componentId:'mis',remedy:'Suspend and replace.',state:'open',reportedBy:'human',reportedAt:'2026-10-21T00:00:00.000Z'}),423);
 await test('revoked while audit commits',d=>d.revokeDuringAudit=true,403);
 await test('audit storage failure',d=>d.auditFailure=true,503);
 await test('legacy default still revalidated',(d,s)=>{delete s.operations.serviceBindings;delete d.state.operations.serviceBindings;d.state.operations.serviceIdentities=[]});
 await test('legacy unbound initiating human revoked during audit',(d,s)=>{delete s.operations.serviceBindings;delete d.state.operations.serviceBindings;d.state.operations.serviceIdentities=[];d.afterAudit=state=>{state.members[0].status='suspended'}},403);
 await test('legacy unbound patient assignment revoked during audit',(d,s)=>{delete s.operations.serviceBindings;delete d.state.operations.serviceBindings;d.state.operations.serviceIdentities=[];d.afterAudit=state=>{state.workspace.people[0].teamId='other'}},403);
 await test('authority withdrawn while audit commits',d=>d.afterAudit=s=>{s.operations.dataFlows[0].state='withdrawn'},403);
 await test('unbound flow without authority is refused',(d,s)=>{delete s.operations.serviceBindings;delete d.state.operations.serviceBindings;delete s.operations.dataFlows;delete d.state.operations.dataFlows;d.state.operations.serviceIdentities=[]},403);
 await test('binding added after unbound preparation',(d,s)=>{delete s.operations.serviceBindings},403);
 const s=fixture(),db={state:s,audit:[]};await serviceDispatch(db,s,actor,human,'mis','p',{intent:'send',purpose:'programme-delivery'});assert.match(db.audit[0].detail,/initiating human human; service si; target mis; accountable owner human/);assert.equal(db.audit[0].personId,'p');passed++;
 applyServiceIdentity(s,{type:'serviceIdentityBind',version:0,targetId:'mis',serviceIdentityId:'si'},actor,human);assert.equal(s.operations.serviceBindings.mis,'si');passed++;
 for(const target of ['openai','independent:anaemia','frontline:vision']){if(target==='frontline:vision')continue;const state=fixture();state.operations.serviceIdentities[0]={...service,kind:'agent',targetId:target};assert.equal(requireServiceIdentity(state,'si','agent',target).id,'si');passed++;}
 for(const target of ['independent:anaemia',...catalog.map(x=>'frontline:'+x.id)]){
  const prepared=fixture();prepared.operations.serviceBindings={[target]:'si'};prepared.operations.serviceIdentities[0]={...service,kind:'agent',targetId:target};prepared.operations.dataFlows[0].targetId=target;prepared.operations.dataFlows[0].targetKind='provider';prepared.operations.dataFlows[0].accessPurpose='ai-assistance';prepared.operations.dataFlows[0].targetVersion=1;prepared.operations.dataFlows[0].directions=['send','lookup'];
  prepared.operations.supplyChain=[inventory(target,'1')];
  if(target==='independent:anaemia'){prepared.operations.anaemiaProvider={active:true,version:1,agreementRef:'DEMO-SERVICE-AGREEMENT-v1',updatedAt:'',by:'fixture'};prepared.operations.dataFlows[0].targetFingerprint='anaemia:v1:DEMO-SERVICE-AGREEMENT-v1';}else {const appId=target.slice('frontline:'.length);prepared.operations.frontlineProviders={[appId]:{active:true,version:1}};prepared.operations.dataFlows[0].targetFingerprint=`frontline:${appId}:v1`;}
  const current=structuredClone(prepared),data={state:current,audit:[]};await serviceDispatch(data,prepared,actor,human,target,'p',{intent:'send',purpose:'ai-assistance'});passed++;
  const agreement=target==='independent:anaemia'?current.operations.anaemiaProvider:current.operations.frontlineProviders[target.slice('frontline:'.length)];agreement.active=false;await assert.rejects(()=>serviceDispatch(data,prepared,actor,human,target,'p'),e=>e.status===403);passed++;
 }
 {const target='independent:anaemia',prepared=fixture();prepared.operations.serviceBindings={[target]:'si'};prepared.operations.serviceIdentities[0]={...service,kind:'agent',targetId:target};prepared.operations.dataFlows[0]={...prepared.operations.dataFlows[0],targetId:target,targetKind:'provider',targetVersion:1,targetFingerprint:'anaemia:v1:DEMO-SERVICE-AGREEMENT-v1',accessPurpose:'ai-assistance',directions:['probe'],basis:{kind:'consent',reference:'CONSENT-AI',consentPurpose:'ai'}};prepared.operations.supplyChain=[inventory(target,'1')];delete prepared.operations.anaemiaProvider;const data={state:structuredClone(prepared),audit:[]};await serviceDispatch(data,prepared,actor,human,target,null,{intent:'probe',runtime:{SAHA_ANAEMIA_DEMO_BOOTSTRAP:'true'}});assert.equal(data.audit.length,1);passed++;}
 for(const app of catalog){
  const target='frontline:'+app.id,prepared=fixture();prepared.operations.serviceBindings={[target]:'si'};prepared.operations.serviceIdentities[0]={...service,kind:'agent',targetId:target};prepared.operations.dataFlows[0].targetId=target;prepared.operations.dataFlows[0].targetKind='provider';prepared.operations.dataFlows[0].accessPurpose='ai-assistance';prepared.operations.dataFlows[0].targetVersion=1;prepared.operations.dataFlows[0].targetFingerprint=`frontline:${app.id}:v1`;prepared.operations.dataFlows[0].directions=['send','lookup'];
  prepared.operations.supplyChain=[inventory(target,'1')];
  // No stored agreement: clinical preparation uses the shared synthetic-bootstrap agreement.
  const initial={state:structuredClone(prepared),audit:[]};await serviceDispatch(initial,prepared,actor,human,target,'p',{intent:'send',purpose:'ai-assistance'});passed++;
  for(const when of ['before','during-audit']){
   const db={state:structuredClone(prepared),audit:[]},suspend=state=>{state.operations.frontlineProviders={[app.id]:{active:false,version:2}};};
   if(when==='before')suspend(db.state);else db.afterAudit=suspend;
   let calls=0;await assert.rejects(async()=>{await serviceDispatch(db,prepared,actor,human,target,'p');calls++;},e=>e.status===403);assert.equal(calls,0);assert.equal(db.audit.length,when==='before'?0:1);passed++;
  }
  const configured=structuredClone(prepared);configured.operations.frontlineProviders={[app.id]:{active:true,version:1}};const removed={state:structuredClone(configured),audit:[]};delete removed.state.operations.frontlineProviders;await assert.rejects(()=>serviceDispatch(removed,configured,actor,human,target,'p'),e=>e.status===403);passed++;
 }
 // Replay never relaxes the execution gate: repeating the same checkpoint after revocation still refuses.
 db.state.operations.serviceIdentities[0].status='revoked';for(let n=0;n<2;n++)await assert.rejects(()=>serviceDispatch(db,s,actor,human,'mis','p'),e=>e.status===403);passed++;
 for(const bound of [true,false])for(const intent of ['send','lookup','probe']){
  const prepared=fixture();if(!bound)prepared.operations.serviceBindings={};const data={state:structuredClone(prepared),audit:[]};let validations=0;
  await serviceDispatch(data,prepared,actor,human,'mis','p',{intent,purpose:'programme-delivery',authorize:()=>validations++});assert.equal(validations,2);passed++;
  data.state.operations.maintenance=true;
  if(intent==='lookup')await serviceDispatch(data,prepared,actor,human,'mis','p',{intent,purpose:'programme-delivery'});else await assert.rejects(()=>serviceDispatch(data,prepared,actor,human,'mis','p',{intent,purpose:'programme-delivery'}),e=>e.status===423);passed++;
 }
 for(const mode of ['maintenance','purpose','domain']){
  const prepared=fixture(),data={state:structuredClone(prepared),audit:[],afterAudit:s=>{if(mode==='maintenance')s.operations.maintenance=true;else if(mode==='purpose')s.operations.purposeGrants=[{memberId:'human',purposes:['reporting']}];else s.changed=true;}};let calls=0;
  await assert.rejects(async()=>{await serviceDispatch(data,prepared,actor,human,'mis','p',{intent:'send',purpose:'programme-delivery',authorize:s=>{if(s.changed)throw Object.assign(Error('domain changed'),{status:409});}});calls++;},e=>e.status===(mode==='maintenance'?423:mode==='purpose'?403:409));assert.equal(calls,0);assert.equal(data.audit.length,1);passed++;
 }
 const result={suite:'Opt-in service dispatch execution-boundary authority',passed,completedAt:new Date().toISOString(),coverage:'Injected fresh organisation state, scope and audit storage; no external requests; not hosted D1 acceptance'};mkdirSync('tests/evidence/service-identity-wiring',{recursive:true});writeFileSync('tests/evidence/service-identity-wiring/service-dispatch-result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{rmSync(dir,{recursive:true,force:true});}
