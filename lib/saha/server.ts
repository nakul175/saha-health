import { applyGovernance, authorizeGovernance } from './governance';
import { applyEvaluation, authorizeEvaluation } from './evaluation';
import { executeEvaluation } from './evaluation-execution';
import { applyHousehold, authorizeHousehold } from './household';
import { applyCaseload, authorizeCaseload } from './caseload';
import { applyMerge, authorizeMerge, ensureNotMerged } from './merge';
import { applyExceptional, authorizeExceptional, ensureExceptionalScope } from './exceptional';
import { applyRights, authorizeRights, ensureNotRestricted } from './rights';
import { applyRetention, authorizeRetention } from './retention';
import { applyConsent, authorizeConsent } from './consent';
import { applyDelegation, authorizeDelegation, delegationAudit, heldBy } from './delegation';
import { applyReferral } from './referrals';
import { applyActionPlan, authorizeActionPlan } from './action-plan';
import { applyRoster } from './roster';
import { applyAbdm, authorizeAbdm, redactAbha } from './abdm';
import { applyTransfer, authorizeTransfer } from './abdm-transfer';
import { applyContinuity, authorizeContinuity, ensurePatientIdentity, reviewRegistration } from './continuity';
import { applyPilot, authorizePilotCommand } from './pilot';
import { applyOutreach, authorizeOutreach } from './outreach';
import { applyExpansion, authorizeExpansion } from './expansion';
import { boundedJsonBody } from './request-body';
import { applyOperations, ensureOperating, operator } from './operations';
import { ALERT_OWNERS, applyAlertAck, canAcknowledge } from './alerts';
import { applyField } from './field';
import { applyFieldRegistration, authorizeFieldRegistration } from './field-registration';
import { applyReferralRequest, authorizeReferralRequest } from './referral-request';
import { applyEhr, ehrReadiness } from './ehr';
import { executeEhr } from './ehr-execution';
import { configureMis, misReadiness } from './mis';
import { executeMis } from './mis-execution';
import { providers, agentApply } from './agent';
import { executeAgent } from './agent-execution';
import { env } from 'cloudflare:workers';
import { headers } from 'next/headers';
import { identityConfig, principalFromHeaders, signOutPath } from './identity';
import { seedWorkspace } from './seed';
import { AppError, apply, digest, fail, person, uuid, type Command } from './core';
import { platformApply, platformSchema, validTeams } from './platform';
import { patientTargets } from './partition';
import { accountCode, auditPage, parseCursor, createState, ensureAccount, history, persist, readState, scope, type Actor } from './store';
import type { OrgState, Integration, Snapshot } from './types';
export async function identity(){const cfg=identityConfig(runtime());if(cfg.error)fail(503,'Sign-in is not configured for this deployment.');const u=await principalFromHeaders(await headers(),cfg);if(u)return u;if(import.meta.env.DEV&&cfg.provider==='sites-chatgpt')return {userId:'preview-synthetic-owner',displayName:'Preview owner',email:'preview@example.invalid',fullName:null};return fail(401,'Sign in to use your workspace.');}
export function db(){if(!env.DB)fail(503,'Workspace storage is temporarily unavailable. Your unsaved input has been kept on screen.');return env.DB!;}
export async function loadFor(u:Actor,orgId?:string|null,targets?:(orgId:string)=>Promise<string[]|null>,viewerScoped=false){await ensureAccount(db(),u);let id=orgId;if(!id){const a=await db().prepare('SELECT active_org_id FROM accounts WHERE user_id=?').bind(u.userId).first<{active_org_id:string}>();id=a?.active_org_id;const active=id?await db().prepare('SELECT user_id FROM memberships WHERE org_id=? AND user_id=? AND status=?').bind(id,u.userId,'active').first():null;if(!active){const fallback=await db().prepare('SELECT org_id FROM memberships WHERE user_id=? AND status=? ORDER BY created_at LIMIT 1').bind(u.userId,'active').first<{org_id:string}>();id=fallback?.org_id;if(id)await db().prepare('UPDATE accounts SET active_org_id=? WHERE user_id=?').bind(id,u.userId).run();}}if(!id)fail(403,'Select an active organisation.');const ids=targets?await targets(id):null;const state=await readState(db(),id,ids??undefined,viewerScoped&&!ids?u.userId:undefined);scope(state,u.userId);return state;}
export async function snapshotFor(state:OrgState,u:Actor):Promise<Snapshot>{
 const m=scope(state,u.userId),w=state.workspace;const permitted=new Set(w.people.filter(p=>p.assigned).map(p=>p.id));
 const orgs=await db().prepare('SELECT o.id,o.name,m.role,m.is_owner FROM memberships m JOIN organisations o ON o.id=m.org_id WHERE m.user_id=? AND m.status=? ORDER BY o.created_at').bind(u.userId,'active').all<{id:string;name:string;role:Snapshot['role'];is_owner:number}>();
 const migration=await db().prepare('SELECT migrated_at,counts FROM legacy_migrations WHERE org_id=?').bind(state.organisation.id).first<{migrated_at:string;counts:string}>();
 const {receipts,...base}=w;
 const activity=await auditPage(db(),state.organisation.id,u.userId);
 return {...base,role:m.role,people:w.people.filter(p=>permitted.has(p.id)).map(redactAbha),visits:w.visits.filter(v=>permitted.has(v.personId)),submissions:w.submissions.filter(s=>permitted.has(s.personId)),referrals:w.referrals.filter(r=>permitted.has(r.personId)),audit:activity.events,auditCursor:activity.nextCursor,user:{userId:u.userId,displayName:u.displayName,accountCode:await accountCode(u.userId)},maintenance:{active:!!state.operations?.maintenance,reason:state.operations?.reason??''},environment:'synthetic',externalApisEnabled:externalEnabled(),agentProviders:providers(w.integrations,runtime()),ehrReadiness:w.integrations.filter(i=>i.kind==='ehr'&&i.mode==='http').map(i=>ehrReadiness(i,state.organisation.id,runtime())),misReadiness:w.integrations.filter(i=>i.kind==='mis'&&i.mode==='http').map(i=>misReadiness(i,state.organisation.id,runtime())),organisation:state.organisation,organisations:orgs.results.map(o=>({id:o.id,name:o.name,role:o.role,isOwner:!!o.is_owner})),membership:m,members:state.members.filter(x=>m.isOwner||m.role==='admin'||x.userId===m.userId||x.teamIds.some(t=>m.teamIds.includes(t))),teams:state.teams.filter(t=>m.isOwner||m.role==='admin'||m.teamIds.includes(t.id)),invitations:m.isOwner?state.invitations.map(({tokenHash,...i})=>i):[],canManage:m.isOwner,canAssign:(m.isOwner||m.role==='supervisor'||heldBy(state,m,'team-supervision').length>0)&&m.role!=='admin',delegatedAuthority:heldBy(state,m,'team-supervision').concat(heldBy(state,m,'reporting')).map(d=>({id:d.id,kind:d.kind,teamIds:d.teamIds,until:d.until,grantorId:d.grantorId})),signOutPath:signOutPath(identityConfig(runtime())),migration:migration?{migratedAt:migration.migrated_at,counts:JSON.parse(migration.counts)}:null};
}
export async function snapshot(request?:Request){const u=await identity();return snapshotFor(await loadFor(u,request?.headers.get('x-saha-organisation'),undefined,true),u);}
async function parseRequest(request:Request){const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)fail(403,'Cross-origin changes are not allowed.');if(request.headers.get('sec-fetch-site')==='cross-site')fail(403,'Cross-site changes are not allowed.');if(!request.headers.get('content-type')?.startsWith('application/json'))fail(415,'Use JSON for this operation.');const key=request.headers.get('idempotency-key');if(!key||!/^[a-zA-Z0-9_-]{8,100}$/.test(key))fail(400,'A valid idempotency key is required.');const input=await boundedJsonBody(request,20000);const parsed=platformSchema.safeParse(input);if(!parsed.success)fail(422,parsed.error.issues[0]?.message??'Invalid command.');return {key,c:parsed.data};}
async function dispatchCommand(request:Request,parsed:Awaited<ReturnType<typeof parseRequest>>){
 const u=await identity(),{key,c}=parsed,hash=await digest(c);await ensureAccount(db(),u);
 const old=await db().prepare('SELECT org_id,hash,result,person_id FROM command_receipts WHERE actor_id=? AND key=?').bind(u.userId,key).first<{org_id:string;hash:string;result:string;person_id:string|null}>();
 if(old){if(old.hash!==hash)fail(409,'This operation key was already used for different input.');if(!['switchOrganisation','joinOrganisation','createOrganisation'].includes(c.type)&&request.headers.get('x-saha-organisation')&&old.org_id!==request.headers.get('x-saha-organisation'))fail(409,'This operation key belongs to a different organisation.');const state=await loadFor(u,old.org_id);const m=scope(state,u.userId);if(old.person_id)person(state.workspace,old.person_id);authorizePilotCommand(state,m,c);authorizeOutreach(state,m,c);authorizeExpansion(state,m,c);authorizeContinuity(state,m,c);authorizeFieldRegistration(state,m,c);authorizeReferralRequest(state,m,c);authorizeActionPlan(state,m,c);authorizeHousehold(state,m,c);authorizeCaseload(state,m,c);authorizeMerge(state,m,c);authorizeExceptional(state,m,c);authorizeRights(state,m,c);authorizeConsent(state,m,c);authorizeDelegation(state,m,c);authorizeRetention(state,m,c);authorizeAbdm(state,m,c);authorizeTransfer(state,m,c);authorizeGovernance(state,m,c);authorizeEvaluation(state,m,c);if(c.type==='opsAcknowledgeAlert'){if(!canAcknowledge(m,ALERT_OWNERS[c.alertId]))fail(403,'Your current membership cannot acknowledge this alert.');}else if(c.type.startsWith('ops')&&!operator(m))fail(403,'Operations access required.');if(['opsMaintenance','opsRates','opsBudget'].includes(c.type)&&!m.isOwner)fail(403,'Owner access required.');if(['createInvite','revokeInvite','updateMember','rosterApply','createTeam','renameOrganisation','enableAgentContract','configureMis','activateMis','testMis','configureEhr','activateEhr','probeEhr'].includes(c.type)&&!m.isOwner)fail(403,'Your current membership cannot access this action.');return {result:JSON.parse(old.result),snapshot:await snapshotFor(state,u),replayed:true};}
 if(c.type==='createOrganisation'){
  const count=await db().prepare('SELECT count(*) AS n FROM memberships WHERE user_id=? AND is_owner=1 AND status=?').bind(u.userId,'active').first<{n:number}>();if((count?.n??0)>=10)fail(422,'This release supports up to 10 organisations owned by one account.');
  const now=new Date().toISOString(),orgId=`org_${(await digest(`${u.userId}:${key}`)).slice(0,32)}`,w=seedWorkspace(now);w.people=[];
  const state:OrgState={organisation:{id:orgId,name:c.name,revision:1,createdAt:now},teams:[{id:'default',name:'Care team',createdAt:now}],members:[{userId:u.userId,displayName:u.displayName,accountCode:await accountCode(u.userId),role:'clinician',isOwner:true,status:'active',version:1,teamIds:['default'],createdAt:now}],invitations:[],workspace:w};
  await createState(db(),state,u,'createOrganisation',0,'',{}, {key,hash});return {result:{organisationId:orgId},snapshot:await snapshotFor(await loadFor(u,orgId,undefined,true),u)};
 }
 if(c.type==='joinOrganisation'){
  const invite=await db().prepare('SELECT org_id FROM invitations WHERE token_hash=?').bind(await digest(c.token)).first<{org_id:string}>();if(!invite)fail(404,'Invitation not found or unavailable.');
  const state=await readState(db(),invite.org_id),before=structuredClone(state),now=new Date().toISOString();
  const tokenHash=await digest(c.token),inv=state.invitations.find(x=>x.tokenHash===tokenHash);
  if(!inv||inv.status!=='pending'||inv.expiresAt<=now||inv.accountCode!==await accountCode(u.userId))fail(403,'This invitation is expired, used, revoked or belongs to another account.');
  validTeams(state,inv.teamIds,inv.role);let member=state.members.find(m=>m.userId===u.userId);if(member?.status==='active')fail(409,'You are already a member of this organisation.');
  const next={userId:u.userId,displayName:u.displayName,accountCode:await accountCode(u.userId),role:inv.role,isOwner:false,status:'active' as const,version:(member?.version??0)+1,teamIds:inv.teamIds,createdAt:member?.createdAt??now};if(member)Object.assign(member,next);else state.members.push(next);inv.status='accepted';inv.acceptedBy=u.userId;
  state.workspace.audit.push({id:uuid(),at:now,actor:u.displayName,actorId:u.userId,role:inv.role,action:'acceptInvite',subject:inv.id,detail:'Account-bound invitation accepted. Membership activated.'});
  await persist(db(),before,state,u,c,key,hash,{organisationId:invite.org_id},[],true);return {result:{organisationId:invite.org_id},snapshot:await snapshotFor(await loadFor(u,invite.org_id,undefined,true),u)};
 }
 const requested=c.type==='switchOrganisation'?c.organisationId:request.headers.get('x-saha-organisation');
 // Slice 0a: certified patient commands load only the named patient(s).
 const state=await loadFor(u,requested,orgId=>patientTargets(db(),orgId,c as any)),before=structuredClone(state),m=scope(state,u.userId);ensureOperating(state,c);ensurePatientIdentity(state,c);ensureNotMerged(state,c);ensureExceptionalScope(state,m,c);ensureNotRestricted(state,c);const registration=c.type==='createPerson'?await reviewRegistration(state,m,c):null;let result:any;
 if(c.type==='probeEhr'||c.type==='retrieveEhrDocument'||c.type==='executeEhrPublish'||c.type==='lookupEhrPublish'){const result=await executeEhr(db(),state,c,u,m,key,hash,runtime());return {result,snapshot:await snapshotFor(await loadFor(u,state.organisation.id,undefined,true),u)};}
 if(c.type==='testMis'||c.type==='sendSubmission'||c.type==='lookupSubmission'){const result=await executeMis(db(),state,c,u,m,key,hash,runtime());return {result,snapshot:await snapshotFor(await loadFor(u,state.organisation.id,undefined,true),u)};}
 if(c.type==='runEvaluationCase'){const result=await executeEvaluation(db(),state,c,u,m,key,hash,runtime());return {result,snapshot:await snapshotFor(await loadFor(u,state.organisation.id,undefined,true),u)};}
 if(c.type==='runAI'&&state.workspace.integrations.find(i=>i.id===c.providerId)?.mode==='http')fail(409,'Use the governed evidence assistant for external AI. Legacy free-text AI execution is unavailable.');
 if(c.type==='executeAgent'){const result=await executeAgent(db(),state,c,u,m,key,hash,runtime());return {result,snapshot:await snapshotFor(await loadFor(u,state.organisation.id,undefined,true),u)};}
 if(c.type==='switchOrganisation'){result={organisationId:state.organisation.id};}
 else {
  if(c.type==='createPerson'&&(!m.teamIds.includes(c.teamId)||m.role==='admin'))fail(403,'Choose a care team you belong to.');
  const agent=await agentApply(state,c,u,m,providers(state.workspace.integrations,runtime()));
  const mis=['configureMis','activateMis','cancelSubmission'].includes(c.type)?await configureMis(state,c as any,u,m,runtime()):null;
  const ehr=c.type.includes('Ehr')?await applyEhr(state,c as any,u,m,runtime()):null;
  const field=await applyField(state,c,u,m)??await applyFieldRegistration(state,c,u,m)??await applyReferralRequest(state,c,u,m);
  const pilot=await applyPilot(state,c,u,m);
  const outreach=await applyOutreach(state,c,u,m);
  const expansion=await applyExpansion(state,c,u,m);
  const governance=await applyGovernance(state,c,u,m);
  const evaluation=await applyEvaluation(state,c,u,m,providers(state.workspace.integrations,runtime()));
  const continuity=applyContinuity(state,c,u,m);
  const household=applyHousehold(state,c,u,m);
  const caseload=applyCaseload(state,c,u,m);
  const merge=applyMerge(state,c,u,m);
  const exceptional=applyExceptional(state,c,u,m);
  const rights=applyRights(state,c,u,m);
  const consent=applyConsent(state,c,u,m);
  const delegation=applyDelegation(state,c,u,m);
  const retention=applyRetention(state,c,u,m);
  const referral=applyReferral(state,c,u,m)??applyActionPlan(state,c,u,m);
  const roster=await applyRoster(state,c,u,m);
  const abdm=applyAbdm(state,c,u,m);
  const transfer=await applyTransfer(state,c,u,m);
  const ops=applyOperations(state,c,u,m)??applyAlertAck(state,c,u,m);
  const platform=transfer?{handled:true,result:transfer}:abdm?{handled:true,result:abdm}:roster?{handled:true,result:roster}:referral?{handled:true,result:referral}:retention?{handled:true,result:retention}:rights?{handled:true,result:rights}:consent?{handled:true,result:consent}:delegation?{handled:true,result:delegation}:exceptional?{handled:true,result:exceptional}:merge?{handled:true,result:merge}:caseload?{handled:true,result:caseload}:household?{handled:true,result:household}:evaluation?{handled:true,result:evaluation}:governance?{handled:true,result:governance}:continuity?{handled:true,result:continuity}:expansion?{handled:true,result:expansion}:outreach?{handled:true,result:outreach}:pilot?{handled:true,result:pilot}:ops?{handled:true,result:ops}:field?{handled:true,result:field}:ehr?{handled:true,result:ehr}:mis?{handled:true,result:mis}:agent?{handled:true,result:agent}:await platformApply(state,c,u,m);
  if(platform.handled)result=platform.result;
  else {const oldRole=state.workspace.role;
   if(['toggleIntegration','registerIntegration'].includes(c.type)&&m.isOwner)state.workspace.role='admin';
   result=await apply(state.workspace,c as Command,u.userId,{call:(i,p)=>externalCall(i,p,key)});
   state.workspace.role=oldRole;const a=state.workspace.audit.at(-1);if(a&&!before.workspace.audit.some(x=>x.id===a.id)){a.actorId=u.userId;a.actor=u.displayName;a.role=m.role;}
   if(c.type==='createPerson'){const p=state.workspace.people.find(x=>x.id===result.personId)!;p.assignedTo=u.userId;if(registration)p.identityReview=registration;}
  }
 }
 // Slice 1e: record any delegated authority the command relied on.
 if(state.delegationUsed?.length)delegationAudit(state,u,m,c.type,typeof (c as any).personId==='string'?(c as any).personId:null);
 await persist(db(),before,state,u,c,key,hash,result,[],c.type==='switchOrganisation');
 // Slice 0b: a partitioned command may answer with the partition snapshot for the client to merge.
 if(request.headers.get('x-saha-response')==='delta'&&state.partition){const partition=state.partition;return {result,delta:await snapshotFor(await loadFor(u,state.organisation.id,async()=>partition),u),partition};}
 return {result,snapshot:await snapshotFor(await loadFor(u,state.organisation.id,undefined,true),u)};
}
export async function command(request:Request){await identity();const parsed=await parseRequest(request);try{return await dispatchCommand(request,parsed);}catch(e){
 // Concurrent identical commands may race past the receipt read. Replay only a
 // committed receipt, after the normal current-membership checks run again.
 if(!(e instanceof AppError)||e.status===409){const u=await identity(),key=request.headers.get('idempotency-key');if(key){const saved=await db().prepare('SELECT key FROM command_receipts WHERE actor_id=? AND key=?').bind(u.userId,key).first();if(saved)return dispatchCommand(request,parsed);}}
 throw e;
}}
export async function patientHistory(request:Request){const u=await identity(),s=await loadFor(u,request.headers.get('x-saha-organisation')),id=new URL(request.url).searchParams.get('personId')??'';person(s.workspace,id);return history(db(),s.organisation.id,id,parseCursor(new URL(request.url).searchParams.get('cursor')));}
export async function organisationAudit(request:Request){const u=await identity(),s=await loadFor(u,request.headers.get('x-saha-organisation'));return auditPage(db(),s.organisation.id,u.userId,parseCursor(new URL(request.url).searchParams.get('cursor')));}
export const runtime=()=>env as unknown as Record<string,string|undefined>;
export const externalEnabled=()=>runtime().SAHA_EXTERNAL_APIS_ENABLED==='true';
export async function externalCall(i:Integration,payload:unknown,key:string){const e=runtime();if(!externalEnabled())fail(409,'External AI calls are not enabled in this sandbox. Configure approved server credentials before connecting a live provider.');if(!i.endpoint||!i.credentialBinding)fail(409,'Provider endpoint and credential binding are required.');const u=new URL(i.endpoint);const allowed=(e.SAHA_ALLOWED_ORIGINS??'').split(',').map(x=>x.trim()).filter(Boolean);if(u.protocol!=='https:'||!allowed.includes(u.origin)||u.username||u.password||u.search||u.hash)fail(403,'This provider origin is not on the server-approved allowlist.');const keyValue=e[i.credentialBinding];if(!keyValue)fail(409,'The provider credential is not configured on the server.');let response:Response;try{response=await fetch(i.endpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${keyValue}`,'Idempotency-Key':key},body:JSON.stringify(payload),redirect:'error',signal:AbortSignal.timeout(15000)});}catch{fail(502,'Provider did not return a confirmed result. Do not assume a clinical finding.');}if(!response!.ok)fail(502,`Provider returned HTTP ${response!.status}. No result was accepted.`);const reader=response!.body?.getReader();if(!reader)fail(502,'Provider returned no response.');let size=0;const chunks:Uint8Array[]=[];while(true){const {value,done}=await reader!.read();if(done)break;size+=value.length;if(size>16000){await reader!.cancel();fail(502,'Provider response exceeds the permitted size.');}chunks.push(value);}try{const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return JSON.parse(new TextDecoder().decode(bytes));}catch{fail(502,'Provider returned invalid JSON.');}}
export function json(value:unknown,status=200){return Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
export function error(e:unknown){if(e instanceof AppError)return json({error:e.message},e.status);console.error('Workspace operation failed',e instanceof Error?e.name:'unknown');if(import.meta.env.DEV)console.error(e);return json({error:'The workspace is unavailable. Your input remains on screen; please try again.'},503);}
