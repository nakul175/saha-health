import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const dir=mkdtempSync(join(process.cwd(),'.hosting-controls-'));let passed=0;const check=fn=>{fn();passed++};
try{
 for(const f of ['hosting-controls','hosting-controls-server'])writeFileSync(join(dir,f+'.js'),ts.transpileModule(readFileSync('lib/saha/'+f+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'"));
 writeFileSync(join(dir,'core.js'),`export function fail(status,message){throw Object.assign(Error(message),{status})};export const uuid=()=>crypto.randomUUID();`);
 writeFileSync(join(dir,'server.js'),`export async function identity(){return globalThis.__actor};export async function loadFor(){return globalThis.__state};export function json(value,status=200){return Response.json(value,{status})}`);writeFileSync(join(dir,'store.js'),`export function scope(s,id){const m=s.members.find(x=>x.userId===id&&x.status==='active');if(!m)throw Object.assign(Error('inactive'),{status:403});return m}`);
 const H=await import(pathToFileURL(join(dir,'hosting-controls.js'))),HS=await import(pathToFileURL(join(dir,'hosting-controls-server.js')));
 const ui=readFileSync('app/hosting-controls/page.tsx','utf8');check(()=>{for(const label of ['Hosting and cross-border controls','Approved locations','Processing chain','Owner authority reference','Save versioned controls'])assert.match(ui,new RegExp(label));});
 const owner={userId:'owner',displayName:'Synthetic owner',role:'clinician',status:'active',isOwner:true,version:1,teamIds:['default']},worker={...owner,userId:'worker',displayName:'Synthetic worker',isOwner:false,role:'asha'},actor={userId:'owner',displayName:'Synthetic owner'};
 const state=()=>({organisation:{id:'org'},members:[owner,worker],operations:{version:0,maintenance:false,reason:'',updatedAt:'',incidents:[],rates:null},workspace:{audit:[],people:[],visits:[],integrations:[],submissions:[],referrals:[],receipts:{}}});
 const routes=[
  {id:'primary-d1',area:'primary-storage',targetId:'workspace-d1',purpose:'care-record-storage',direction:'at-rest',location:'IN',authorityReference:'OWNER-LOCATION-001',enabled:true},
  {id:'programme-mis',area:'provider',targetId:'mis',purpose:'programme-delivery',direction:'outbound',location:'IN',authorityReference:'OWNER-TRANSFER-002',enabled:true},
  {id:'encrypted-backup',area:'backup',targetId:'encrypted-archive',purpose:'disaster-recovery',direction:'outbound',location:'IN',authorityReference:'OWNER-BACKUP-003',enabled:true},
  {id:'aggregate-analytics',area:'analytics',targetId:'approved-reporting',purpose:'aggregate-reporting',direction:'outbound',location:'IN',authorityReference:'OWNER-ANALYTICS-004',enabled:true},
  {id:'support-console',area:'support',targetId:'approved-support',purpose:'incident-support',direction:'interactive-access',location:'IN',authorityReference:'OWNER-SUPPORT-005',enabled:true},
 ];
 const command=(extra={})=>({type:'setHostingControls',version:0,state:'active',approvedLocations:['IN'],routes:structuredClone(routes),reason:'Security owner approved this synthetic deployment policy.',...extra});
 const throws=(fn,status,pattern)=>assert.throws(fn,e=>e.status===status&&pattern.test(e.message));
 check(()=>assert.equal(H.hostingControlsSchema.safeParse(command()).success,true));
 check(()=>throws(()=>H.authorizeHostingControls(worker,{type:'setHostingControls'}),403,/Only an organisation owner/));
 const s=state();check(()=>assert.deepEqual(H.applyHostingControls(s,command(),actor,owner,'2026-10-20T00:00:00.000Z'),{version:1,state:'active',approvedLocations:1,routes:5}));
 check(()=>assert.equal(s.operations.hostingControls.setBy,'owner'));
 check(()=>assert.equal(s.workspace.audit.at(-1).action,'setHostingControls'));
 check(()=>assert.match(s.workspace.audit.at(-1).detail,/No provider or jurisdiction was inferred/));
 check(()=>assert.equal(H.assertHostingRoute(s,s,{area:'provider',targetId:'mis',purpose:'programme-delivery',direction:'outbound'}).location,'IN'));
 check(()=>throws(()=>H.assertHostingRoute(s,s,{area:'provider',targetId:'mis',purpose:'diagnostic',direction:'outbound'}),403,/not approved/));
 check(()=>throws(()=>H.assertHostingRoute(s,s,{area:'provider',targetId:'mis',purpose:'programme-delivery',direction:'inbound'}),403,/not approved/));
 check(()=>throws(()=>H.assertHostingRoute(s,s,{area:'provider',targetId:'other',purpose:'programme-delivery',direction:'outbound'}),403,/not approved/));
 const changed=structuredClone(s);changed.operations.hostingControls.version=2;check(()=>throws(()=>H.assertHostingRoute(s,changed,{area:'provider',targetId:'mis',purpose:'programme-delivery',direction:'outbound'}),403,/changed before transfer/));
 const drafted=structuredClone(s);drafted.operations.hostingControls.state='draft';check(()=>throws(()=>H.assertHostingRoute(drafted,drafted,{area:'provider',targetId:'mis',purpose:'programme-delivery',direction:'outbound'}),403,/not active/));
 const outside=structuredClone(s);outside.operations.hostingControls.routes.find(x=>x.id==='programme-mis').location='US';check(()=>throws(()=>H.assertHostingRoute(outside,outside,{area:'provider',targetId:'mis',purpose:'programme-delivery',direction:'outbound'}),403,/outside/));
 check(()=>assert.equal(H.assertHostingRoute(state(),state(),{area:'provider',targetId:'mis',purpose:'programme-delivery',direction:'outbound'}),undefined));
 check(()=>throws(()=>H.applyHostingControls(state(),command({routes:routes.filter(x=>x.area!=='support')}),actor,owner),422,/support route/));
 check(()=>throws(()=>H.applyHostingControls(state(),command({routes:routes.map(x=>x.id==='programme-mis'?{...x,location:'US'}:x)}),actor,owner),422,/outside/));
 check(()=>throws(()=>H.applyHostingControls(state(),command({approvedLocations:['IN','IN']}),actor,owner),422,/each approved location once/));
 check(()=>throws(()=>H.applyHostingControls(state(),command({routes:[...routes,{...routes[1],id:'programme-copy'}]}),actor,owner),422,/area, target, purpose and direction/));
 check(()=>throws(()=>H.applyHostingControls(s,command(),actor,owner),409,/changed/));
 const draftState=state();check(()=>assert.equal(H.applyHostingControls(draftState,command({state:'draft',routes:[routes[0]]}),actor,owner).state,'draft'));
 check(()=>assert.equal(H.hostingControlsView(state()).configured,false));
 check(()=>assert.equal(H.hostingControlsView(s).enforced,true));
 globalThis.__actor=actor;globalThis.__state=s;let response=await HS.hostingControlsRead(new Request('https://saha.invalid/api/hosting-controls')),body=await response.json();check(()=>assert.equal(body.enforced,true));
 globalThis.__actor={userId:'worker',displayName:'Synthetic worker'};await assert.rejects(()=>HS.hostingControlsRead(new Request('https://saha.invalid/api/hosting-controls')),e=>e.status===403&&/Only an organisation owner/.test(e.message));passed++;
 const result={suite:'SAHA-135 hosting and cross-border controls',passed,failed:0,coverage:'Synthetic owner configuration, positive route, location/purpose/direction/target refusals, stale/race refusal, draft/error/authorization/replay-safe version checks. No provider contacted and no legal location inferred.',completedAt:new Date().toISOString()};mkdirSync('tests/evidence/saha-135-hosting-controls',{recursive:true});writeFileSync('tests/evidence/saha-135-hosting-controls/hosting-controls-contract.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{rmSync(dir,{recursive:true,force:true});}
