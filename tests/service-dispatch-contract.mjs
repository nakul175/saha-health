import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const dir=mkdtempSync(join(process.cwd(),'.service-dispatch-'));let passed=0;
try{
 for(const f of ['service-dispatch','service-identity','identity'])writeFileSync(join(dir,f+'.js'),ts.transpileModule(readFileSync('lib/saha/'+f+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'"));
 writeFileSync(join(dir,'core.js'),`export function fail(status,message){throw Object.assign(Error(message),{status})};export const uuid=()=>crypto.randomUUID();`);
 writeFileSync(join(dir,'store.js'),`export async function readState(db,org){if(org!==db.state.organisation.id)throw Object.assign(Error('wrong organisation'),{status:403});return structuredClone(db.state)};export function scope(s,id){const m=s.members.find(x=>x.userId===id&&x.status==='active');if(!m)throw Object.assign(Error('inactive human'),{status:403});return m}`);
 writeFileSync(join(dir,'access.js'),`export function normallyAllowed(m,p,policy){return m.teamIds.includes(p.teamId)&&(!policy?.denied)&&m.role!=='admin'}`);
 writeFileSync(join(dir,'access-audit.js'),`export async function recordAccess(db,s,u,m,event){if(db.auditFailure)throw Object.assign(Error('audit unavailable'),{status:503});db.audit.push(event);if(db.revokeDuringAudit)db.state.operations.serviceIdentities[0].status='revoked'}`);
 const {serviceDispatch}=await import(pathToFileURL(join(dir,'service-dispatch.js'))),{applyServiceIdentity,requireServiceIdentity,independentTargets}=await import(pathToFileURL(join(dir,'service-identity.js')));
 const human={userId:'human',displayName:'Synthetic worker',role:'clinician',status:'active',isOwner:true,version:1,teamIds:['t']},actor={userId:'human',displayName:'Synthetic worker'},service={id:'si',name:'Connector worker',kind:'connector',targetId:'mis',ownerId:'human',status:'active',expiresAt:'2099-01-01T00:00:00Z'};
 for(const file of ['agent-execution','evaluation-execution','ehr-execution','mis-execution','aggregate-execution','destination-enrolment-execution','anaemia-server','frontline-server','server']){assert.match(readFileSync('lib/saha/'+file+'.ts','utf8'),/await serviceDispatch\(/,file+' dispatch boundary missing');passed++;}
 const catalog=JSON.parse(readFileSync('lib/saha/frontline/catalog.json','utf8'));assert.deepEqual(independentTargets.filter(x=>x.startsWith('frontline:')).sort(),catalog.map(x=>'frontline:'+x.id).sort());passed++;
 const fixture=()=>({organisation:{id:'org'},members:[structuredClone(human)],operations:{version:0,serviceIdentities:[structuredClone(service)],serviceBindings:{mis:'si'}},workspace:{people:[{id:'p',teamId:'t'}],integrations:[{id:'mis',kind:'mis',status:'active'}],audit:[]}});
 const test=async(name,mutate,code)=>{const prepared=fixture(),db={state:structuredClone(prepared),audit:[]};if(mutate)mutate(db,prepared);let calls=0;try{await serviceDispatch(db,prepared,actor,human,'mis','p');calls++;if(code)assert.fail(name+' expected refusal');}catch(e){if(!code)throw e;assert.equal(e.status,code,name);assert.equal(calls,0,name+' dispatched');}passed++;};
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
 await test('connection removed',d=>d.state.workspace.integrations=[],403);
 await test('connection suspended',d=>d.state.workspace.integrations[0].status='suspended',403);
 await test('revoked while audit commits',d=>d.revokeDuringAudit=true,403);
 await test('audit storage failure',d=>d.auditFailure=true,503);
 await test('legacy default unchanged',(d,s)=>{delete s.operations.serviceBindings;d.state.operations.serviceIdentities=[]});
 const s=fixture(),db={state:s,audit:[]};await serviceDispatch(db,s,actor,human,'mis','p');assert.match(db.audit[0].detail,/initiating human human; service si; target mis; accountable owner human/);assert.equal(db.audit[0].personId,'p');passed++;
 applyServiceIdentity(s,{type:'serviceIdentityBind',version:0,targetId:'mis',serviceIdentityId:'si'},actor,human);assert.equal(s.operations.serviceBindings.mis,'si');passed++;
 for(const target of ['openai','independent:anaemia','frontline:vision']){if(target==='frontline:vision')continue;const state=fixture();state.operations.serviceIdentities[0]={...service,kind:'agent',targetId:target};assert.equal(requireServiceIdentity(state,'si','agent',target).id,'si');passed++;}
 // Replay never relaxes the execution gate: repeating the same checkpoint after revocation still refuses.
 db.state.operations.serviceIdentities[0].status='revoked';for(let n=0;n<2;n++)await assert.rejects(()=>serviceDispatch(db,s,actor,human,'mis','p'),e=>e.status===403);passed++;
 const result={suite:'Opt-in service dispatch execution-boundary authority',passed,completedAt:new Date().toISOString(),coverage:'Injected fresh organisation state, scope and audit storage; no external requests; not hosted D1 acceptance'};mkdirSync('tests/evidence/service-identity-wiring',{recursive:true});writeFileSync('tests/evidence/service-identity-wiring/service-dispatch-result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{rmSync(dir,{recursive:true,force:true});}
