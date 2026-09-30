import { boundedJsonBody } from './request-body';
import { applyOperations, ensureOperating, operator } from './operations';
import { applyField } from './field';
import { applyEhr, ehrReadiness } from './ehr';
import { executeEhr } from './ehr-execution';
import { configureMis, misReadiness } from './mis';
import { executeMis } from './mis-execution';
import { providers, agentApply } from './agent';
import { executeAgent } from './agent-execution';
import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { seedWorkspace } from './seed';
import { AppError, apply, digest, fail, person, uuid, type Command } from './core';
import { platformApply, platformSchema, validTeams } from './platform';
import { accountCode, auditPage, parseCursor, createState, ensureAccount, history, persist, readState, scope, type Actor } from './store';
import type { OrgState, Integration, Snapshot } from './types';
export async function identity(){const u=await getChatGPTUser();if(u)return u;if(import.meta.env.DEV)return {userId:'preview-synthetic-owner',displayName:'Preview owner',email:'preview@example.invalid',fullName:null};return fail(401,'Sign in to use your workspace.');}
export function db(){if(!env.DB)fail(503,'Workspace storage is temporarily unavailable. Your unsaved input has been kept on screen.');return env.DB!;}
export async function loadFor(u:Actor,orgId?:string|null){await ensureAccount(db(),u);let id=orgId;if(!id){const a=await db().prepare('SELECT active_org_id FROM accounts WHERE user_id=?').bind(u.userId).first<{active_org_id:string}>();id=a?.active_org_id;const active=id?await db().prepare('SELECT user_id FROM memberships WHERE org_id=? AND user_id=? AND status=?').bind(id,u.userId,'active').first():null;if(!active){const fallback=await db().prepare('SELECT org_id FROM memberships WHERE user_id=? AND status=? ORDER BY created_at LIMIT 1').bind(u.userId,'active').first<{org_id:string}>();id=fallback?.org_id;if(id)await db().prepare('UPDATE accounts SET active_org_id=? WHERE user_id=?').bind(id,u.userId).run();}}if(!id)fail(403,'Select an active organisation.');const state=await readState(db(),id);scope(state,u.userId);return state;}
export async function snapshotFor(state:OrgState,u:Actor):Promise<Snapshot>{
 const m=scope(state,u.userId),w=state.workspace;const permitted=new Set(w.people.filter(p=>p.assigned).map(p=>p.id));
 const orgs=await db().prepare('SELECT o.id,o.name,m.role,m.is_owner FROM memberships m JOIN organisations o ON o.id=m.org_id WHERE m.user_id=? AND m.status=? ORDER BY o.created_at').bind(u.userId,'active').all<{id:string;name:string;role:Snapshot['role'];is_owner:number}>();
 const migration=await db().prepare('SELECT migrated_at,counts FROM legacy_migrations WHERE org_id=?').bind(state.organisation.id).first<{migrated_at:string;counts:string}>();
 const {receipts,...base}=w;
 const activity=await auditPage(db(),state.organisation.id,u.userId);
 return {...base,role:m.role,people:w.people.filter(p=>permitted.has(p.id)),visits:w.visits.filter(v=>permitted.has(v.personId)),submissions:w.submissions.filter(s=>permitted.has(s.personId)),referrals:w.referrals.filter(r=>permitted.has(r.personId)),audit:activity.events,auditCursor:activity.nextCursor,user:{userId:u.userId,displayName:u.displayName,accountCode:await accountCode(u.userId)},maintenance:{active:!!state.operations?.maintenance,reason:state.operations?.reason??''},environment:'synthetic',externalApisEnabled:externalEnabled(),agentProviders:providers(w.integrations,runtime()),ehrReadiness:w.integrations.filter(i=>i.kind==='ehr'&&i.mode==='http').map(i=>ehrReadiness(i,state.organisation.id,runtime())),misReadiness:w.integrations.filter(i=>i.kind==='mis'&&i.mode==='http').map(i=>misReadiness(i,state.organisation.id,runtime())),organisation:state.organisation,organisations:orgs.results.map(o=>({id:o.id,name:o.name,role:o.role,isOwner:!!o.is_owner})),membership:m,members:state.members.filter(x=>m.isOwner||m.role==='admin'||x.userId===m.userId||x.teamIds.some(t=>m.teamIds.includes(t))),teams:state.teams.filter(t=>m.isOwner||m.role==='admin'||m.teamIds.includes(t.id)),invitations:m.isOwner?state.invitations.map(({tokenHash,...i})=>i):[],canManage:m.isOwner,canAssign:(m.isOwner||m.role==='supervisor')&&m.role!=='admin',migration:migration?{migratedAt:migration.migrated_at,counts:JSON.parse(migration.counts)}:null};
}
export async function snapshot(request?:Request){const u=await identity();return snapshotFor(await loadFor(u,request?.headers.get('x-saha-organisation')),u);}
async function parseRequest(request:Request){const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)fail(403,'Cross-origin changes are not allowed.');if(request.headers.get('sec-fetch-site')==='cross-site')fail(403,'Cross-site changes are not allowed.');if(!request.headers.get('content-type')?.startsWith('application/json'))fail(415,'Use JSON for this operation.');const key=request.headers.get('idempotency-key');if(!key||!/^[a-zA-Z0-9_-]{8,100}$/.test(key))fail(400,'A valid idempotency key is required.');const input=await boundedJsonBody(request,20000);const parsed=platformSchema.safeParse(input);if(!parsed.success)fail(422,parsed.error.issues[0]?.message??'Invalid command.');return {key,c:parsed.data};}
async function dispatchCommand(request:Request,parsed:Awaited<ReturnType<typeof parseRequest>>){
 const u=await identity(),{key,c}=parsed,hash=await digest(c);await ensureAccount(db(),u);
 const old=await db().prepare('SELECT org_id,hash,result,person_id FROM command_receipts WHERE actor_id=? AND key=?').bind(u.userId,key).first<{org_id:string;hash:string;result:string;person_id:string|null}>();
 if(old){if(old.hash!==hash)fail(409,'This operation key was already used for different input.');if(!['switchOrganisation','joinOrganisation','createOrganisation'].includes(c.type)&&request.headers.get('x-saha-organisation')&&old.org_id!==request.headers.get('x-saha-organisation'))fail(409,'This operation key belongs to a different organisation.');const state=await loadFor(u,old.org_id);const m=scope(state,u.userId);if(old.person_id)person(state.workspace,old.person_id);if(c.type.startsWith('ops')&&!operator(m))fail(403,'Operations access required.');if(['opsMaintenance','opsRates'].includes(c.type)&&!m.isOwner)fail(403,'Owner access required.');if(['createInvite','revokeInvite','updateMember','createTeam','renameOrganisation','enableAgentContract','configureMis','activateMis','testMis','configureEhr','activateEhr','probeEhr'].includes(c.type)&&!m.isOwner)fail(403,'Your current membership cannot access this action.');return {result:JSON.parse(old.result),snapshot:await snapshotFor(state,u),replayed:true};}
 if(c.type==='createOrganisation'){
  const count=await db().prepare('SELECT count(*) AS n FROM memberships WHERE user_id=? AND is_owner=1 AND status=?').bind(u.userId,'active').first<{n:number}>();if((count?.n??0)>=10)fail(422,'This release supports up to 10 organisations owned by one account.');
  const now=new Date().toISOString(),orgId=`org_${(await digest(`${u.userId}:${key}`)).slice(0,32)}`,w=seedWorkspace(now);w.people=[];
  const state:OrgState={organisation:{id:orgId,name:c.name,revision:1,createdAt:now},teams:[{id:'default',name:'Care team',createdAt:now}],members:[{userId:u.userId,displayName:u.displayName,accountCode:await accountCode(u.userId),role:'clinician',isOwner:true,status:'active',version:1,teamIds:['default'],createdAt:now}],invitations:[],workspace:w};
  await createState(db(),state,u,'createOrganisation',0,'',{}, {key,hash});return {result:{organisationId:orgId},snapshot:await snapshotFor(await loadFor(u,orgId),u)};
 }
 if(c.type==='joinOrganisation'){
  const invite=await db().prepare('SELECT org_id FROM invitations WHERE token_hash=?').bind(await digest(c.token)).first<{org_id:string}>();if(!invite)fail(404,'Invitation not found or unavailable.');
  const state=await readState(db(),invite.org_id),before=structuredClone(state),now=new Date().toISOString();
  const tokenHash=await digest(c.token),inv=state.invitations.find(x=>x.tokenHash===tokenHash);
  if(!inv||inv.status!=='pending'||inv.expiresAt<=now||inv.accountCode!==await accountCode(u.userId))fail(403,'This invitation is expired, used, revoked or belongs to another account.');
  validTeams(state,inv.teamIds,inv.role);let member=state.members.find(m=>m.userId===u.userId);if(member?.status==='active')fail(409,'You are already a member of this organisation.');
  const next={userId:u.userId,displayName:u.displayName,accountCode:await accountCode(u.userId),role:inv.role,isOwner:false,status:'active' as const,version:(member?.version??0)+1,teamIds:inv.teamIds,createdAt:member?.createdAt??now};if(member)Object.assign(member,next);else state.members.push(next);inv.status='accepted';inv.acceptedBy=u.userId;
  state.workspace.audit.push({id:uuid(),at:now,actor:u.displayName,actorId:u.userId,role:inv.role,action:'acceptInvite',subject:inv.id,detail:'Account-bound invitation accepted. Membership activated.'});
  await persist(db(),before,state,u,c,key,hash,{organisationId:invite.org_id},[],true);return {result:{organisationId:invite.org_id},snapshot:await snapshotFor(await loadFor(u,invite.org_id),u)};
 }
 const requested=c.type==='switchOrganisation'?c.organisationId:request.headers.get('x-saha-organisation');
 const state=await loadFor(u,requested),before=structuredClone(state),m=scope(state,u.userId);ensureOperating(state,c);let result:any;
 if(c.type==='probeEhr'||c.type==='retrieveEhrDocument'||c.type==='executeEhrPublish'||c.type==='lookupEhrPublish'){const result=await executeEhr(db(),state,c,u,m,key,hash,runtime());return {result,snapshot:await snapshotFor(await loadFor(u,state.organisation.id),u)};}
 if(c.type==='testMis'||c.type==='sendSubmission'||c.type==='lookupSubmission'){const result=await executeMis(db(),state,c,u,m,key,hash,runtime());return {result,snapshot:await snapshotFor(await loadFor(u,state.organisation.id),u)};}
 if(c.type==='executeAgent'){const result=await executeAgent(db(),state,c,u,m,key,hash,runtime());return {result,snapshot:await snapshotFor(await loadFor(u,state.organisation.id),u)};}
 if(c.type==='switchOrganisation'){result={organisationId:state.organisation.id};}
 else {
  if(c.type==='createPerson'&&(!m.teamIds.includes(c.teamId)||m.role==='admin'))fail(403,'Choose a care team you belong to.');
  const agent=await agentApply(state,c,u,m,providers(state.workspace.integrations,runtime()));
  const mis=['configureMis','activateMis','cancelSubmission'].includes(c.type)?await configureMis(state,c as any,u,m,runtime()):null;
  const ehr=c.type.includes('Ehr')?await applyEhr(state,c as any,u,m,runtime()):null;
  const field=await applyField(state,c,u,m);
  const ops=applyOperations(state,c,u,m);
  const platform=ops?{handled:true,result:ops}:field?{handled:true,result:field}:ehr?{handled:true,result:ehr}:mis?{handled:true,result:mis}:agent?{handled:true,result:agent}:await platformApply(state,c,u,m);
  if(platform.handled)result=platform.result;
  else {const oldRole=state.workspace.role;
   if(['toggleIntegration','registerIntegration'].includes(c.type)&&m.isOwner)state.workspace.role='admin';
   result=await apply(state.workspace,c as Command,u.userId,{call:(i,p)=>externalCall(i,p,key)});
   state.workspace.role=oldRole;const a=state.workspace.audit.at(-1);if(a&&!before.workspace.audit.some(x=>x.id===a.id)){a.actorId=u.userId;a.actor=u.displayName;a.role=m.role;}
   if(c.type==='createPerson'){const p=state.workspace.people.find(x=>x.id===result.personId)!;p.assignedTo=u.userId;}
  }
 }
 await persist(db(),before,state,u,c,key,hash,result,[],c.type==='switchOrganisation');
 return {result,snapshot:await snapshotFor(await loadFor(u,state.organisation.id),u)};
}
export async function command(request:Request){await identity();const parsed=await parseRequest(request);try{return await dispatchCommand(request,parsed);}catch(e){
 // Concurrent identical commands may race past the receipt read. Replay only a
 // committed receipt, after the normal current-membership checks run again.
 if(!(e instanceof AppError)||e.status===409){const u=await identity(),key=request.headers.get('idempotency-key');if(key){const saved=await db().prepare('SELECT key FROM command_receipts WHERE actor_id=? AND key=?').bind(u.userId,key).first();if(saved)return dispatchCommand(request,parsed);}}
 throw e;
}}
export async function patientHistory(request:Request){const u=await identity(),s=await loadFor(u,request.headers.get('x-saha-organisation')),id=new URL(request.url).searchParams.get('personId')??'';person(s.workspace,id);return history(db(),s.organisation.id,id,parseCursor(new URL(request.url).searchParams.get('cursor')));}
export async function organisationAudit(request:Request){const u=await identity(),s=await loadFor(u,request.headers.get('x-saha-organisation'));return auditPage(db(),s.organisation.id,u.userId,parseCursor(new URL(request.url).searchParams.get('cursor')));}
const runtime=()=>env as unknown as Record<string,string|undefined>;
export const externalEnabled=()=>runtime().SAHA_EXTERNAL_APIS_ENABLED==='true';
export async function externalCall(i:Integration,payload:unknown,key:string){const e=runtime();if(!externalEnabled())fail(409,'External AI calls are not enabled in this sandbox. Configure approved server credentials before connecting a live provider.');if(!i.endpoint||!i.credentialBinding)fail(409,'Provider endpoint and credential binding are required.');const u=new URL(i.endpoint);const allowed=(e.SAHA_ALLOWED_ORIGINS??'').split(',').map(x=>x.trim()).filter(Boolean);if(u.protocol!=='https:'||!allowed.includes(u.origin)||u.username||u.password||u.search||u.hash)fail(403,'This provider origin is not on the server-approved allowlist.');const keyValue=e[i.credentialBinding];if(!keyValue)fail(409,'The provider credential is not configured on the server.');let response:Response;try{response=await fetch(i.endpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${keyValue}`,'Idempotency-Key':key},body:JSON.stringify(payload),redirect:'error',signal:AbortSignal.timeout(15000)});}catch{fail(502,'Provider did not return a confirmed result. Do not assume a clinical finding.');}if(!response!.ok)fail(502,`Provider returned HTTP ${response!.status}. No result was accepted.`);const reader=response!.body?.getReader();if(!reader)fail(502,'Provider returned no response.');let size=0;const chunks:Uint8Array[]=[];while(true){const {value,done}=await reader!.read();if(done)break;size+=value.length;if(size>16000){await reader!.cancel();fail(502,'Provider response exceeds the permitted size.');}chunks.push(value);}try{const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return JSON.parse(new TextDecoder().decode(bytes));}catch{fail(502,'Provider returned invalid JSON.');}}
export function json(value:unknown,status=200){return Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
export function error(e:unknown){if(e instanceof AppError)return json({error:e.message},e.status);console.error('Workspace operation failed',e instanceof Error?e.name:'unknown');if(import.meta.env.DEV)console.error(e);return json({error:'The workspace is unavailable. Your input remains on screen; please try again.'},503);}
