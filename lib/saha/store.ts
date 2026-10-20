import { allowed, bindAccessPolicy, policySql } from './access';
import {hydrateTransitionAuthority} from './installed-transition-authority';
export { allowed } from './access';
import type { D1Database } from '@cloudflare/workers-types';
import { AppError, digest, fail, uuid } from './core';
import { seedWorkspace } from './seed';
import type { OrgState, Workspace, Member, Person, Visit, Audit, RecordRevision } from './types';
import type { DelegationUse } from './delegation';
import { PATIENT_COMMANDS, PATIENT_TABLES } from './partition';
import { ACCESS_AUDIT, SUMMARY_ACCESS_ACTIONS, ACCESS_SIDE_TABLES, ACCESS_CHAIN_ATTEMPTS, accessChainBackoff, isAuditSequenceConflict, chainBackoff, chainMoved, linkRows } from './audit-chain';
import {assertPrimaryStorageWrite} from './hosting-controls';
let primaryStorageRuntime=()=>undefined as string|undefined;
export function bindPrimaryStorageRuntime(read:()=>string|undefined){primaryStorageRuntime=read;}
export type Actor={userId:string;displayName:string;email:string};
// Human access-only audit writes pin the membership already used to shape the read.
// System access writers omit this; this snapshot never grants patient or purpose scope.
export type AccessMembership={userId:string;version:number;role:Member['role'];isOwner:boolean};
// A known read-authority refusal never proves an earlier clinical write was unapplied.
export class AccessMembershipRefused extends AppError{constructor(){super(403,'Current organisation membership changed or is unavailable. This response was withheld. If a write was attempted, keep its original reference and check its outcome after access is restored.');}}
type Value=string|number|null;
export type Row={table:string;values:Record<string,Value>;keys:string[];append?:boolean};
const row=(table:string,values:Record<string,Value>,keys=['org_id','id'],append=false):Row=>({table,values,keys,append});
const j=(x:unknown)=>JSON.stringify(x);
// Slice 13d (round-10 review L6): an overall bound on the organisation's operations document, beside the per-collection caps.
// The indicator differencing ledger kept in the same row has its own writer and bound (indicator-differencing, 1 MB) and is not
// counted. A change that would take the rest past the bound, and grow it, is refused; a change that shrinks it never is.
export const OPERATIONS_BYTES=1_000_000;
// Slice 13f (review finding 7): safety actions are never refused by the bound, even when they grow a full document: pausing
// for maintenance, revoking a purpose grant or a delegation, and recording an aggregate send's outcome or lookup.
export const OPERATIONS_BOUND_EXEMPT:ReadonlySet<string>=new Set(['serviceIdentityRevoke','opsMaintenance','revokeAccessPurpose','delegationRevoke','sendAggregateReport','lookupAggregateReport']);
export const OPERATIONS_FULL='The organisation\'s settings document is full, so this change was not saved. Remove settings that are no longer needed, or ask for help.';
export function operationsBytes(ops:unknown){if(!ops||typeof ops!=='object')return 0;const {indicatorReleases:_,...rest}=ops as Record<string,unknown>;return new TextEncoder().encode(JSON.stringify(rest)).length;}
const same=(a:unknown,b:unknown)=>j(a)===j(b);
export const accountCode=async(id:string)=>(await digest(`saha-account:${id}`)).slice(0,24).toUpperCase();
export const homeOrg=async(id:string)=>`org_${(await digest(`saha-home:${id}`)).slice(0,32)}`;
// Every statement is guarded by a transaction-local CAS token. D1 batch rolls back
// all writes on error; a losing CAS leaves every dependent statement a no-op.
// Slice 6w: the indicator differencing ledger in the operations row is written only by its own statement
// (indicators-server). A command that saves the operations row keeps the ledger as currently stored, so a
// command built on an older read never drops releases recorded since.
// Slice 13d (round-10 L1): the scheduled job's own records (`scheduledJob`, `auditChain`) are kept the same way, because they
// are written by `persistScheduledRecord` below without moving the organisation revision.
export const SCHEDULED_RECORD_KEYS=['scheduledJob','auditChain'] as const;
const KEEP_LEDGER='data='+['indicatorReleases',...SCHEDULED_RECORD_KEYS].reduce((x,k)=>`CASE WHEN json_type(operations.data,'$.${k}') IS NULL THEN json_remove(${x},'$.${k}') ELSE json_set(${x},'$.${k}',json(json_extract(operations.data,'$.${k}'))) END`,'excluded.data');
export function guarded(db:D1Database,orgId:string,token:string,rows:Row[],accessMembership?:AccessMembership,expectedChanges?:number[]){
 if(accessMembership&&rows.some(r=>r.table!=='audit_events'||r.append!==true||r.values.org_id!==orgId))throw new Error('Human access audits require same-organisation append-only audit rows.');
 const groups=new Map<string,Row[]>();for(const r of rows){const key=r.table+'|'+Object.keys(r.values).join(',')+'|'+r.append;groups.set(key,[...(groups.get(key)??[]),r]);}
 const statements=[];
 for(const rs of groups.values()){
  const first=rs[0],cols=Object.keys(first.values),size=Math.max(1,Math.floor(88/cols.length));
  for(let n=0;n<rs.length;n+=size){const part=rs.slice(n,n+size);const binds=part.flatMap(r=>cols.map(k=>r.values[k]));const select=cols.map((_,i)=>`column${i+1}`).join(',');const updates=cols.filter(c=>!first.keys.includes(c));const conflict=first.append?'':updates.length?` ON CONFLICT (${first.keys.join(',')}) DO UPDATE SET ${updates.map(c=>first.table==='operations'&&c==='data'?KEEP_LEDGER:`${c}=excluded.${c}`).join(',')}`:' ON CONFLICT DO NOTHING';
   expectedChanges?.push(part.length);
   const permission=accessMembership
    ?{sql:"EXISTS (SELECT 1 FROM organisations o JOIN memberships m ON m.org_id=o.id WHERE o.id=? AND m.user_id=? AND m.status='active' AND m.version=? AND m.role=? AND m.is_owner=?)",binds:[orgId,accessMembership.userId,accessMembership.version,accessMembership.role,accessMembership.isOwner?1:0]}
    :{sql:'EXISTS (SELECT 1 FROM organisations WHERE id=? AND last_command=?)',binds:[orgId,token]};
   statements.push(db.prepare(`INSERT INTO ${first.table} (${cols.join(',')}) SELECT ${select} FROM (VALUES ${part.map(()=>`(${cols.map(()=>'?').join(',')})`).join(',')}) WHERE ${permission.sql}${conflict}`).bind(...binds,...permission.binds));
  }
 }
 return statements;
}
export function scope(state:OrgState,userId:string){const m=state.members.find(x=>x.userId===userId&&x.status==='active');if(!m)fail(403,'Your organisation membership is inactive or unavailable.');state.workspace.role=m.role;bindAccessPolicy(state);for(const p of state.workspace.people)p.assigned=allowed(m,p);return m;}
// Reads organisation-level state and either every patient (personIds omitted) or only the
// named patients (slice 0a partition). Lookups are indexed maps so reading grows linearly.
// Slice 0b-2: the patients one viewer may see, as an SQL predicate on patients p, mirroring access.ts:
// team scope (ASHAs only their assigned patients) or a current emergency-access grant (clinicians).
// Returns null when the viewer sees every patient (all teams), so the plain organisation read applies.
export async function viewerScope(db:D1Database,orgId:string,userId:string,now=new Date().toISOString()):Promise<{sql:string;binds:Value[]}|null>{
 // Slice 13a: the organisation's facility/locality scope and programme grants (only those two keys of the operations
 // row) narrow normal access here exactly as in access.ts; an emergency-access grant is not narrowed by them.
 const [m,t,all,ops]=await db.batch([db.prepare('SELECT role,status FROM memberships WHERE org_id=? AND user_id=?').bind(orgId,userId),db.prepare('SELECT team_id FROM team_members WHERE org_id=? AND user_id=?').bind(orgId,userId),db.prepare('SELECT id FROM teams WHERE org_id=?').bind(orgId),db.prepare("SELECT json_extract(data,'$.accessScope') AS scope,json_extract(data,'$.purposeGrants') AS grants FROM operations WHERE org_id=?").bind(orgId)]);
 const member=(m.results as {role:string;status:string}[])[0],teams=(t.results as {team_id:string}[]).map(r=>r.team_id),orgTeams=(all.results as {id:string}[]).map(r=>r.id);
 if(!member||member.status!=='active'||member.role==='admin'||member.role==='provider')return {sql:'0',binds:[]};
 const row=(ops.results as {scope:string|null;grants:string|null}[])[0],parse=(x:string|null|undefined)=>{try{return x?JSON.parse(x):undefined;}catch{return undefined;}};
 const policy=policySql({userId,teamIds:teams},{accessScope:parse(row?.scope),purposeGrants:parse(row?.grants)});
 if(member.role!=='asha'&&orgTeams.every(x=>teams.includes(x))&&!policy)return null;
 const inTeams=teams.length?`p.team_id IN (${teams.map(()=>'?').join(',')})`:'0';
 const team=member.role==='asha'?`(p.assigned_to=? AND ${inTeams})`:inTeams,teamBinds:Value[]=member.role==='asha'?[userId,...teams]:[...teams];
 const base=policy?`(${team} AND ${policy.sql})`:team,baseBinds:Value[]=policy?[...teamBinds,...policy.binds]:teamBinds;
 if(member.role!=='clinician')return {sql:base,binds:baseBinds};
 // With a policy, an in-team patient outside it can still be reached by an emergency-access grant, so the grant
 // branch is not limited to patients outside the viewer's teams.
 const grant=`instr(p.data,'"exceptionalAccess"')>0 AND EXISTS (SELECT 1 FROM json_each(p.data,'$.exceptionalAccess') g WHERE json_extract(g.value,'$.userId')=? AND json_extract(g.value,'$.closedAt') IS NULL AND json_extract(g.value,'$.until')>?)`;
 if(policy)return {sql:`(${base} OR (${grant}))`,binds:[...baseBinds,userId,now]};
 return {sql:`(${base} OR (NOT ${inTeams} AND ${grant}))`,binds:[...baseBinds,...teams,userId,now]};
}
// Slice 0b-3: windowed=true reads exactly the named patients (possibly none) for one viewer's paged workspace;
// the state is read-only and is not a command partition.
// Slice 9b: the name an organisation shows for a member. A name the member set for themselves in this organisation comes
// first; otherwise, when the sign-in identity carries only an email address (Cloudflare Access without a name claim), the
// label of the member's latest accepted invitation; otherwise the sign-in name. The sign-in name is kept as accountName so
// the account can still be identified. Display only: identity, membership and authorisation are unchanged.
const EMAIL_NAME=/^[^\s@]+@[^\s@]+$/;
export function namedMembers(members:Member[],invitations:Record<string,any>[],operations?:string|null):Member[]{
 let names:Record<string,{name:string;version:number}>={};try{names=operations?JSON.parse(operations).memberNames??{}:{};}catch{names={};}
 const label=new Map<string,{at:string;label:string}>();for(const i of invitations)if(i.status==='accepted'&&i.accepted_by&&typeof i.label==='string'&&i.label.trim()){const prior=label.get(i.accepted_by);if(!prior||prior.at<=i.created_at)label.set(i.accepted_by,{at:i.created_at,label:i.label.trim()});}
 return members.map(m=>{const own=names[m.userId],invited=label.get(m.userId)?.label,account=m.displayName;
  if(own?.name)return {...m,displayName:own.name,accountName:account,nameSource:'self' as const,nameVersion:own.version};
  if(invited&&EMAIL_NAME.test(account??''))return {...m,displayName:invited,accountName:account,nameSource:'invitation' as const,nameVersion:0};
  return {...m,accountName:account,nameSource:'account' as const,nameVersion:0};});
}
export async function readState(db:D1Database,orgId:string,personIds?:string[],viewer?:string,windowed=false):Promise<OrgState>{
 const ids=personIds&&(personIds.length||windowed)?[...new Set(personIds)]:null,marks=ids?(ids.length?ids.map(()=>'?').join(','):'NULL'):undefined;
 const vs=!ids&&viewer?await viewerScope(db,orgId,viewer):null,scoped=vs?viewer!:null;
 const permitted=vs?`SELECT p.id FROM patients p WHERE p.org_id=? AND ${vs.sql}`:'',pb:Value[]=vs?[orgId,...vs.binds]:[];
 const tables=['organisations','teams','memberships','team_members','invitations','patients','visits','integrations','plans','ai_results','submissions','referrals','audit_events','operations','pilot','outreach','expansions','governance','households','caseload_transfers','identity_cases','rights_requests','retention'];
 const query=(t:string)=>{
  if(t==='organisations')return db.prepare('SELECT * FROM organisations WHERE id=?').bind(orgId);
  // Slice 0b-2: a workspace read for one viewer loads only that viewer's permitted patients and
  // nothing patient-level the snapshot does not show. Such a state is never persisted.
  if(scoped&&t==='patients')return db.prepare(`SELECT * FROM patients p WHERE p.org_id=? AND ${vs!.sql} ORDER BY p.id`).bind(orgId,...vs!.binds);
  if(scoped&&['visits','submissions','referrals'].includes(t))return db.prepare(`SELECT * FROM ${t} WHERE org_id=? AND person_id IN (${permitted})${t==='visits'?" ORDER BY json_extract(data,'$.createdAt'),id":' ORDER BY id'}`).bind(orgId,...pb);
  if(scoped&&['plans','ai_results'].includes(t))return db.prepare(`SELECT * FROM ${t} WHERE org_id=? AND visit_id IN (SELECT id FROM visits WHERE org_id=? AND person_id IN (${permitted}))`).bind(orgId,orgId,...pb);
  if(scoped&&['households','caseload_transfers','identity_cases','rights_requests','audit_events'].includes(t))return db.prepare(`SELECT * FROM ${t} WHERE org_id=? AND 0`).bind(orgId);
  if(t==='memberships')return db.prepare('SELECT m.*,a.display_name,a.account_code FROM memberships m JOIN accounts a ON a.user_id=m.user_id WHERE m.org_id=?').bind(orgId);
  // Patient collections have an explicit order so partitions and full loads agree (slice 0b).
  if(ids&&t==='patients')return db.prepare(`SELECT * FROM patients WHERE org_id=? AND id IN (${marks}) ORDER BY id`).bind(orgId,...ids);
  if(ids&&['visits','submissions','referrals'].includes(t))return db.prepare(`SELECT * FROM ${t} WHERE org_id=? AND person_id IN (${marks})${t==='visits'?" ORDER BY json_extract(data,'$.createdAt'),id":' ORDER BY id'}`).bind(orgId,...ids);
  if(ids&&['plans','ai_results'].includes(t))return db.prepare(`SELECT * FROM ${t} WHERE org_id=? AND visit_id IN (SELECT id FROM visits WHERE org_id=? AND person_id IN (${marks}))`).bind(orgId,orgId,...ids);
  if(ids&&t==='households')return db.prepare(`SELECT * FROM households WHERE org_id=? AND id IN (SELECT json_extract(data,'$.householdId') FROM patients WHERE org_id=? AND id IN (${marks}))`).bind(orgId,orgId,...ids);
  // Slice 1b: caseload transfers are organisation-level; a patient partition never changes them.
  if(ids&&t==='caseload_transfers')return db.prepare('SELECT * FROM caseload_transfers WHERE org_id=? AND 0').bind(orgId);
  if(ids&&t==='identity_cases')return db.prepare(`SELECT * FROM identity_cases WHERE org_id=? AND (survivor_id IN (${marks}) OR duplicate_id IN (${marks})) ORDER BY created_at,id`).bind(orgId,...ids,...ids);
  if(ids&&t==='rights_requests')return db.prepare(`SELECT * FROM rights_requests WHERE org_id=? AND person_id IN (${marks}) ORDER BY created_at,id`).bind(orgId,...ids);
  if(t==='rights_requests')return db.prepare('SELECT * FROM rights_requests WHERE org_id=? ORDER BY created_at,id').bind(orgId);
  if(t==='identity_cases')return db.prepare('SELECT * FROM identity_cases WHERE org_id=? ORDER BY created_at,id').bind(orgId);
  if(t==='caseload_transfers')return db.prepare('SELECT * FROM caseload_transfers WHERE org_id=? ORDER BY created_at,id').bind(orgId);
  if(ids&&t==='audit_events')return db.prepare(`SELECT * FROM audit_events WHERE org_id=? AND person_id IN (${marks}) ORDER BY at DESC LIMIT 250`).bind(orgId,...ids);
  return db.prepare(`SELECT * FROM ${t} WHERE org_id=?${t==='audit_events'?' ORDER BY at DESC LIMIT 250':t==='visits'?" ORDER BY json_extract(data,'$.createdAt'),id":['patients','submissions','referrals'].includes(t)?' ORDER BY id':''}`).bind(orgId);
 };
 const results=await db.batch(tables.map(query));
 const values=Object.fromEntries(tables.map((t,i)=>[t,results[i].results as Record<string,any>[]]));
 const org=values.organisations[0];if(!org)fail(404,'Organisation not found.');
 const plans=new Map(values.plans.map(p=>[p.id,p.data as string])),ai=new Map<string,string[]>();for(const a of values.ai_results)ai.set(a.visit_id,[...(ai.get(a.visit_id)??[]),a.data]);
 const teamIds=new Map<string,string[]>();for(const t of values.team_members)teamIds.set(t.user_id,[...(teamIds.get(t.user_id)??[]),t.team_id]);
 const w:Workspace={schemaVersion:1,revision:org.revision,role:'admin',people:values.patients.map(r=>({...JSON.parse(r.data),version:r.version,teamId:r.team_id,assignedTo:r.assigned_to,assigned:false})),visits:values.visits.map(r=>{const {planId,...data}=JSON.parse(r.data);const plan=planId?plans.get(planId):undefined;return {...data,version:r.version,recordVersion:r.record_version,plan:plan?JSON.parse(plan):undefined,aiResults:(ai.get(r.id)??[]).map(a=>JSON.parse(a))};}),integrations:values.integrations.map(r=>JSON.parse(r.data)),submissions:values.submissions.map(r=>JSON.parse(r.data)),referrals:values.referrals.map(r=>JSON.parse(r.data)),receipts:{},audit:values.audit_events.reverse().map(r=>({id:r.id,at:r.at,actor:r.actor_name,actorId:r.actor_id,role:r.role,action:r.action,subject:r.subject,detail:r.detail,personId:r.person_id}))};
 // Slice 13a: bind the organisation's access policy to its members (lib/saha/access.ts).
 const state=bindAccessPolicy({retention:values.retention[0]?JSON.parse(values.retention[0].data):undefined,governance:values.governance[0]?JSON.parse(values.governance[0].data):undefined,outreach:values.outreach[0]?JSON.parse(values.outreach[0].data):undefined,expansions:values.expansions[0]?JSON.parse(values.expansions[0].data):undefined,pilot:values.pilot[0]?JSON.parse(values.pilot[0].data):undefined,operations:values.operations[0]?JSON.parse(values.operations[0].data):undefined,organisation:{id:org.id,name:org.name,revision:org.revision,createdAt:org.created_at,patientRevision:org.patient_revision??0},teams:values.teams.map(r=>({id:r.id,name:r.name,createdAt:r.created_at})),members:namedMembers(values.memberships.map(r=>({userId:r.user_id,displayName:r.display_name,accountCode:r.account_code,role:r.role,isOwner:!!r.is_owner,status:r.status,version:r.version,createdAt:r.created_at,teamIds:teamIds.get(r.user_id)??[]})),values.invitations,values.operations[0]?.data),invitations:values.invitations.map(r=>({id:r.id,accountCode:r.account_code,label:r.label,role:r.role,teamIds:JSON.parse(r.team_ids),status:r.status,expiresAt:r.expires_at,createdBy:r.created_by,createdAt:r.created_at,tokenHash:r.token_hash,acceptedBy:r.accepted_by??undefined})),households:values.households.map(r=>({...JSON.parse(r.data),version:r.version,teamId:r.team_id})),...(ids?{}:{caseloads:values.caseload_transfers.map(r=>({...JSON.parse(r.data),version:r.version,state:r.state}))}),identityCases:values.identity_cases.map(r=>({...JSON.parse(r.data),version:r.version,state:r.state})),rightsRequests:values.rights_requests.map(r=>({...JSON.parse(r.data),version:r.version,state:r.state})),workspace:w,patientRevs:Object.fromEntries(values.patients.map(r=>[r.id,r.rev??0])),...(ids&&!windowed?{partition:ids}:{}),...((!ids||windowed)&&viewer?{readOnlyFor:viewer}:{})});
 await hydrateTransitionAuthority(db,state);return state;
}
function revisionChanges(previous:unknown,current:unknown){
 const flatten=(value:any,prefix=''):Record<string,string>=>{const out:Record<string,string>={};for(const [key,val] of Object.entries(value??{})){if(['assigned','plan','aiResults','version','recordVersion'].includes(key))continue;const name=prefix?prefix+'.'+key:key;if(val!==null&&typeof val==='object'&&!Array.isArray(val))Object.assign(out,flatten(val,name));else out[name]=val==null?'—':Array.isArray(val)?val.join(', '):String(val);}return out;};
 const before=flatten(previous),after=flatten(current);return [...new Set([...Object.keys(before),...Object.keys(after)])].filter(k=>before[k]!==after[k]).map(field=>({field,before:before[field]??'—',after:after[field]??'—'}));
}
export function rowsForState(state:OrgState,previous:OrgState|null,actor:Actor,action:string,reason:string,now:string){
 const orgId=state.organisation.id,rows:Row[]=[];const old=previous?.workspace;
 // Indexed previous state: diffing is linear in the organisation size (slice 0a).
 const byId=<T,>(xs:T[]|undefined,key:(x:T)=>string)=>new Map((xs??[]).map(x=>[key(x),x] as const));
 const prevTeams=byId(previous?.teams,t=>t.id),prevMembers=byId(previous?.members,m=>m.userId),prevInvites=byId(previous?.invitations,i=>i.id),prevPeople=byId(old?.people,p=>p.id),prevVisits=byId(old?.visits,v=>v.id),prevIntegrations=byId(old?.integrations,i=>i.id),prevSubmissions=byId(old?.submissions,x=>x.id),prevReferrals=byId(old?.referrals,r=>r.id),prevAudit=new Set((old?.audit??[]).map(a=>a.id));
 if(state.governance&&!same(state.governance,previous?.governance))rows.push(row('governance',{org_id:orgId,data:j(state.governance)},['org_id']));
 if(state.retention&&!same(state.retention,previous?.retention))rows.push(row('retention',{org_id:orgId,data:j(state.retention)},['org_id']));
 if(state.outreach&&!same(state.outreach,previous?.outreach))rows.push(row('outreach',{org_id:orgId,data:j(state.outreach)},['org_id']));
 if(state.expansions&&!same(state.expansions,previous?.expansions))rows.push(row('expansions',{org_id:orgId,data:j(state.expansions)},['org_id']));
 if(state.pilot&&!same(state.pilot,previous?.pilot))rows.push(row('pilot',{org_id:orgId,data:j(state.pilot)},['org_id']));
 if(state.operations&&!same(state.operations,previous?.operations)){const data=j(state.operations);if(!OPERATIONS_BOUND_EXEMPT.has(action)&&operationsBytes(state.operations)>OPERATIONS_BYTES&&operationsBytes(state.operations)>operationsBytes(previous?.operations))fail(413,OPERATIONS_FULL);rows.push(row('operations',{org_id:orgId,data},['org_id']));}
 const prevHouseholds=byId(previous?.households,h=>h.id);for(const h of state.households??[]){if(!same(h,prevHouseholds.get(h.id)))rows.push(row('households',{org_id:orgId,id:h.id,version:h.version,team_id:h.teamId,data:j(h)}));}
 const prevRights=byId(previous?.rightsRequests,r=>r.id);for(const r of state.rightsRequests??[]){if(!same(r,prevRights.get(r.id)))rows.push(row('rights_requests',{org_id:orgId,id:r.id,version:r.version,state:r.state,person_id:r.personId,due_at:r.dueAt,created_at:r.receivedAt,data:j(r)}));}
 const prevCases=byId(previous?.identityCases,k=>k.id);for(const k of state.identityCases??[]){if(!same(k,prevCases.get(k.id)))rows.push(row('identity_cases',{org_id:orgId,id:k.id,version:k.version,state:k.state,survivor_id:k.survivorId,duplicate_id:k.duplicateId,created_at:k.proposedAt,data:j(k)}));}
 const prevCaseloads=byId(previous?.caseloads,t=>t.id);for(const t of state.caseloads??[]){if(!same(t,prevCaseloads.get(t.id)))rows.push(row('caseload_transfers',{org_id:orgId,id:t.id,version:t.version,team_id:t.teamId,state:t.state,created_at:t.createdAt,data:j(t)}));}
 for(const team of state.teams){if(!same(team,prevTeams.get(team.id)))rows.push(row('teams',{org_id:orgId,id:team.id,name:team.name,created_at:team.createdAt}));}
 for(const m of state.members){if(!same(m,prevMembers.get(m.userId)))rows.push(row('memberships',{org_id:orgId,user_id:m.userId,role:m.role,is_owner:+m.isOwner,status:m.status,version:m.version,created_at:m.createdAt},['org_id','user_id']));}
 for(const i of state.invitations){if(!same(i,prevInvites.get(i.id)))rows.push(row('invitations',{id:i.id,org_id:orgId,token_hash:i.tokenHash!,account_code:i.accountCode,label:i.label,role:i.role,team_ids:j(i.teamIds),status:i.status,expires_at:i.expiresAt,created_by:i.createdBy,created_at:i.createdAt,accepted_by:i.acceptedBy??null},['id']));}
 function revision(type:'person'|'visit',entity:Person|Visit,before:Person|Visit|undefined){rows.push(row('record_revisions',{id:uuid(),org_id:orgId,person_id:type==='person'?entity.id:(entity as Visit).personId,entity_type:type,entity_id:entity.id,version:type==='person'?entity.version:(entity as Visit).recordVersion,actor_id:actor.userId,actor_name:actor.displayName,action,reason,data:j(entity),changes:j(revisionChanges(before,entity)),created_at:now},['id'],true));}
 for(const p of state.workspace.people){const before=prevPeople.get(p.id);if(same(p,before))continue;if(before&&p.version<=before.version)p.version=before.version+1;const {assigned,...data}=p;rows.push(row('patients',{org_id:orgId,id:p.id,version:p.version,name:p.name,team_id:p.teamId,assigned_to:p.assignedTo,data:j(data)}));revision('person',p,before);}
 for(const v of state.workspace.visits){const before=prevVisits.get(v.id);if(same(v,before))continue;v.recordVersion=before?before.recordVersion+1:1;const {plan,aiResults,...data}=v;rows.push(row('visits',{org_id:orgId,id:v.id,person_id:v.personId,version:v.version,record_version:v.recordVersion,state:v.state,data:j({...data,planId:plan?.id})}));if(plan&&!same(plan,before?.plan))rows.push(row('plans',{org_id:orgId,id:plan.id,visit_id:v.id,state:plan.state,data:j(plan)}));for(const a of aiResults){if(!same(a,before?.aiResults.find(x=>x.id===a.id)))rows.push(row('ai_results',{org_id:orgId,id:a.id,visit_id:v.id,data:j(a)}));}revision('visit',v,before);}
 for(const i of state.workspace.integrations){if(!same(i,prevIntegrations.get(i.id)))rows.push(row('integrations',{org_id:orgId,id:i.id,version:i.version,kind:i.kind,status:i.status,data:j(i)}));}
 for(const s of state.workspace.submissions){if(!same(s,prevSubmissions.get(s.id)))rows.push(row('submissions',{org_id:orgId,id:s.id,visit_id:s.visitId,person_id:s.personId,state:s.state,data:j(s)}));}
 for(const r of state.workspace.referrals){if(!same(r,prevReferrals.get(r.id)))rows.push(row('referrals',{org_id:orgId,id:r.id,person_id:r.personId,data:j(r)}));}
 for(const a of state.workspace.audit){if(prevAudit.has(a.id))continue;rows.push(auditRow(orgId,a,actor.userId,state.workspace));}
 return rows;
}
function auditRow(orgId:string,a:Audit,fallbackActor:string,w:Workspace){const personId=a.personId??(w.people.some(p=>p.id===a.subject)?a.subject:w.visits.find(v=>v.id===a.subject)?.personId??w.submissions.find(s=>s.id===a.subject)?.personId??null);return row('audit_events',{org_id:orgId,id:a.id,person_id:personId,actor_id:a.actorId??fallbackActor,actor_name:a.actor,role:a.role,action:a.action,subject:a.subject,detail:a.detail,at:a.at},['org_id','id'],true);}
// Append only to new command events before chain hashing. Membership comes from
// the pre-mutation state, not a self-edited member or the command receipt's actor.
// Read/system operational writers keep their existing separate evidence semantics.
export function appendCommandAuthority(rows:Row[],before:OrgState,uses:readonly DelegationUse[]|undefined=undefined,membershipSource:'pre-mutation'|'bootstrap'='pre-mutation',delegationActorId:string|null=null){
 for(const r of rows){if(r.table!=='audit_events')continue;const v=r.values,member=before.members.find(m=>m.userId===v.actor_id),system=v.role==='system';
  const envelope={format:'saha-command-authority-v1',initiatorId:v.actor_id,principal:system?'system':member?'member':'non-member',membershipSource,membership:system||!member?null:{role:member.role,status:member.status,version:member.version,isOwner:member.isOwner},delegationEvidence:system?'not-applicable':uses===undefined?'not-tracked':'recorded-uses',delegations:system||!member||member.userId!==delegationActorId?[]:(uses??[]).map(d=>({id:d.id,kind:d.kind,grantorId:d.grantorId,until:d.until}))};
  v.detail=String(v.detail)+'\nCommand authority: '+j(envelope);
 }
}
// Slice 6j: a commit that loses the audit-chain race is rebuilt on the new head this many times.
export const CHAIN_ATTEMPTS=6;
export async function persist(db:D1Database,before:OrgState,after:OrgState,actor:Actor,command:{type:string;reason?:string;authorityDelegations?:readonly DelegationUse[];taskId?:string;parentId?:string;kind?:string;visitId?:string;accessMembership?:AccessMembership},key:string,hash:string,result:any,extraRows:Row[]=[],switchOrg=false){
 if(before.readOnlyFor)throw new Error('A viewer-scoped read cannot be persisted.');
 const checkStorage=()=>assertPrimaryStorageWrite(before,after,primaryStorageRuntime(),command.type==='setHostingControls');checkStorage();
 const orgId=before.organisation.id,now=new Date().toISOString();const rows=rowsForState(after,before,actor,command.type,command.reason??'',now);
 const actionEvent=after.workspace.audit.find(a=>!before.workspace.audit.some(b=>b.id===a.id));const patientId=actionEvent?.personId??after.workspace.people.find(p=>p.id===actionEvent?.subject)?.id??after.workspace.visits.find(v=>v.id===actionEvent?.subject)?.personId??after.workspace.visits.find(v=>v.id===result?.visitId)?.personId??null;
 // Slice 6t: an access-audit commit appends audit events only: no command receipt (a read is not replayed).
 const access=command.type===ACCESS_AUDIT;
 const accessMembership=access?command.accessMembership:undefined;
 if(accessMembership!==undefined&&(!accessMembership||typeof accessMembership!=='object'||Array.isArray(accessMembership)||accessMembership.userId!==actor.userId||!Number.isSafeInteger(accessMembership.version)||accessMembership.version<1||typeof accessMembership.role!=='string'||!accessMembership.role||typeof accessMembership.isOwner!=='boolean'))throw new Error('Invalid initiating access membership.');
 // Only an unambiguous newly appended initiating-member event proves mutation
 // linkage. Existing/imported/system/helper histories are never reconstructed.
 const initiating=after.workspace.audit.filter(a=>!before.workspace.audit.some(b=>b.id===a.id)&&a.action===command.type&&(a.actorId??actor.userId)===actor.userId&&a.role===before.members.find(m=>m.userId===actor.userId)?.role);
 const provenance=initiating.length===1?initiating[0]:null;
 const programmeVisit=command.type==='saveProgrammeAnswers'&&command.visitId?after.workspace.visits.find(v=>v.id===command.visitId):null;
 const programmeContext=provenance&&programmeVisit&&provenance.subject===programmeVisit.personId&&provenance.personId===programmeVisit.personId?{visitId:programmeVisit.id}:null;
 const taskContext=provenance&&['assignReconciliationTask','acknowledgeReconciliationTask','closeCorrectionTask'].includes(command.type)&&command.taskId?{taskId:command.taskId,parentId:command.parentId??provenance.subject,kind:command.kind??'correction'}:null;
 if(!access)rows.push(row('command_receipts',{actor_id:actor.userId,key,org_id:orgId,hash,result:j(result),person_id:patientId,created_at:now,command_type:command.type,mutation_subject_id:provenance?.subject??null,mutation_event_id:provenance?.id??null,mutation_context:taskContext?j(taskContext):programmeContext?j(programmeContext):null},['actor_id','key'],true));rows.push(...extraRows);
 if(!access)appendCommandAuthority(rows,before,command.authorityDelegations??after.delegationUsed,'pre-mutation',actor.userId);
 const teamChanges=after.members.filter(m=>!same(before.members.find(x=>x.userId===m.userId)?.teamIds,m.teamIds));
 if(accessMembership&&rows.some(r=>r.table!=='audit_events'||r.append!==true||r.values.org_id!==orgId))throw new Error('Human access audits require same-organisation append-only audit rows.');
 if(access&&(teamChanges.length||switchOrg||rows.some(r=>r.table!=='audit_events'&&!ACCESS_SIDE_TABLES.has(r.table))||!rows.length))throw new Error('An access-audit commit may only append audit events.');
 const plan=access?{patients:null,reason:'access audit only'}:commitPlan(before,after,command.type,rows,teamChanges.length>0,switchOrg);
 // Slice 6j: audit rows are linked to the chain head read just before the batch. The unique
 // (org_id, seq) index refuses a second commit built on the same head; nothing of that batch
 // is written, so it is rebuilt on the new head. Patient and organisation guards are unchanged.
 const chainAttempts=access?ACCESS_CHAIN_ATTEMPTS:CHAIN_ATTEMPTS;
 for(let attempt=1;;attempt++){
 const token=uuid(),chain=await linkRows(db,orgId,rows,now);
 // Organisation-wide commits still serialise on the organisation revision and also refuse to
 // commit over any patient change made since they read. Patient-scoped commits (slice 0a)
 // require the organisation revision unchanged and each touched patient unchanged, so
 // teammates on different patients no longer collide.
 // Slice 6t: an access-audit commit takes the batch token without moving either revision, so a read
 // never makes a teammate's command conflict; the audit chain's unique sequence still orders it.
 const head=access
  ?db.prepare('UPDATE organisations SET last_command=? WHERE id=?').bind(token,orgId)
  :plan.patients
  ?db.prepare(`UPDATE organisations SET patient_revision=patient_revision+1,last_command=? WHERE id=? AND revision=? AND (SELECT count(*) FROM patients WHERE org_id=? AND (${plan.patients.map(()=>'(id=? AND rev=?)').join(' OR ')}))=?`).bind(token,orgId,before.organisation.revision,orgId,...plan.patients.flatMap(id=>[id,before.patientRevs![id]]),plan.patients.length)
  :db.prepare('UPDATE organisations SET revision=revision+1,patient_revision=patient_revision+1,last_command=?,name=? WHERE id=? AND revision=? AND patient_revision=?').bind(token,after.organisation.name,orgId,before.organisation.revision,before.organisation.patientRevision??0);
 const auditRows=chain.genesis?[chain.genesis,...rows]:rows;
 // Human read audits need no organisation token: the exact current membership
 // guards each append and the unique audit sequence is their atomic chain CAS.
 // System/clinical writers retain their original token acquisition and gating.
 const expectedAccessChanges:number[]=[];
 const stmts=accessMembership?guarded(db,orgId,token,auditRows,accessMembership,expectedAccessChanges):[head,...(plan.patients?[db.prepare(`UPDATE patients SET rev=rev+1 WHERE org_id=? AND id IN (${plan.patients.map(()=>'?').join(',')}) AND EXISTS (SELECT 1 FROM organisations WHERE id=? AND last_command=?)`).bind(orgId,...plan.patients,orgId,token)]:[]),...guarded(db,orgId,token,chain.genesis?[chain.genesis,...rows]:rows)];
 for(const m of teamChanges){
  stmts.push(db.prepare('DELETE FROM team_members WHERE org_id=? AND user_id=? AND EXISTS (SELECT 1 FROM organisations WHERE id=? AND last_command=?)').bind(orgId,m.userId,orgId,token));
  if(m.teamIds.length)stmts.push(...guarded(db,orgId,token,m.teamIds.map(t=>row('team_members',{org_id:orgId,team_id:t,user_id:m.userId},['org_id','team_id','user_id']))));
 }
 if(switchOrg)stmts.push(db.prepare('UPDATE accounts SET active_org_id=? WHERE user_id=? AND EXISTS (SELECT 1 FROM organisations WHERE id=? AND last_command=?)').bind(orgId,actor.userId,orgId,token));
 checkStorage();
 let saved;try{saved=await db.batch(stmts);}catch(e){if(access&&!isAuditSequenceConflict(e))throw e;if(!await chainMoved(db,orgId,chain.base))throw e;if(attempt<chainAttempts){await(access?accessChainBackoff(attempt):chainBackoff(attempt));continue;}fail(409,'Many changes are being saved in this organisation at once. Nothing was saved; your input is kept on screen. Please try again.');}
 if(accessMembership){
  if(saved.length!==expectedAccessChanges.length||saved.some(result=>!Number.isSafeInteger(result.meta?.changes)||result.meta.changes<0))throw new Error('Access audit append result is unavailable.');
  if(saved.some((result,i)=>result.meta.changes<expectedAccessChanges[i])){
   const current=await db.prepare('SELECT role,status,version,is_owner FROM memberships WHERE org_id=? AND user_id=?').bind(orgId,actor.userId).first<{role:string;status:string;version:number;is_owner:number}>();
   if(!current||current.status!=='active'||current.version!==accessMembership.version||current.role!==accessMembership.role||current.is_owner!==(accessMembership.isOwner?1:0))throw new AccessMembershipRefused();
   throw new Error('Access audit append was incomplete.');
  }
  if(saved.some((result,i)=>result.meta.changes>expectedAccessChanges[i])){
   // Native D1 includes trigger side writes in changes. Excess alone proves no
   // append: verify every intended immutable event before the helper's final
   // membership checkpoint. A deficit is never compensated by another chunk.
   const cols=['org_id','id','person_id','actor_id','actor_name','role','action','subject','detail','at','seq','prev_hash','hash'];
   for(let n=0;n<auditRows.length;n+=88){
    const part=auditRows.slice(n,n+88),ids=part.map(r=>r.values.id);
    if(new Set(ids).size!==part.length||part.some(r=>Object.keys(r.values).length!==cols.length))throw new Error('Access audit append witness is invalid.');
    const observed=(await db.prepare(`SELECT ${cols.join(',')} FROM audit_events WHERE org_id=? AND id IN (${part.map(()=>'?').join(',')})`).bind(orgId,...ids).all<Record<string,Value>>()).results;
    const actual=new Map(observed.map(r=>[r.id,r]));
    if(observed.length!==part.length||actual.size!==part.length||part.some(r=>cols.some(c=>actual.get(r.values.id)?.[c]!==r.values[c])))throw new Error('Access audit append could not be verified.');
   }
  }
 }else if(saved[0].meta.changes!==1)fail(409,plan.patients?'A teammate changed this patient record. Refresh to load their changes, then review and retry. Your unsaved input is kept on screen.':'A teammate changed this organisation. Refresh to load their changes, then review and retry. Your unsaved input is kept on screen.');
 return {...plan,attempts:attempt};
 }
}
// Slice 13d (round-10 L1): the scheduled job's evaluation and audit-chain verification records were organisation-wide commits,
// so a command a person prepared just before one got a 409. They are now written like the indicator ledger: one targeted,
// compare-and-set write of that key (the stored value must still be the one the job read) and its chained audit event, in one
// batch that takes the batch token without moving either revision. Ordinary operations writes keep these keys as stored
// (KEEP_LEDGER), so a command built on an older read cannot roll them back. Nothing is written while the organisation is in
// maintenance or when another run recorded first; the caller is told it was not recorded.
// The same fields as operations.defaultOperations(), not imported so the store keeps no dependency on the operations module.
const NEW_OPERATIONS={version:0,maintenance:false,reason:'',updatedAt:'',incidents:[],rates:null};
export async function persistScheduledRecord(db:D1Database,orgId:string,key:typeof SCHEDULED_RECORD_KEYS[number],previous:unknown,record:unknown,event:Audit):Promise<boolean>{
 if(!SCHEDULED_RECORD_KEYS.includes(key))throw new Error('Not a scheduled record.');
 const now=new Date().toISOString(),path=`$.${key}`,prior=previous==null?'':j(previous);
 for(let attempt=1;;attempt++){
  const token=uuid(),rows=[row('audit_events',{org_id:orgId,id:event.id,person_id:null,actor_id:event.actorId??'system',actor_name:event.actor,role:event.role,action:event.action,subject:event.subject,detail:event.detail,at:event.at},['org_id','id'],true)],chain=await linkRows(db,orgId,rows,now);
  const stmts=[
   db.prepare(`UPDATE organisations SET last_command=? WHERE id=? AND NOT EXISTS (SELECT 1 FROM operations WHERE org_id=? AND json_extract(data,'$.maintenance')=1) AND COALESCE((SELECT json(json_extract(data,'${path}')) FROM operations WHERE org_id=?),'')=?`).bind(token,orgId,orgId,orgId,prior),
   db.prepare(`INSERT INTO operations (org_id,data) SELECT ?,? WHERE EXISTS (SELECT 1 FROM organisations WHERE id=? AND last_command=?) ON CONFLICT(org_id) DO UPDATE SET data=json_set(operations.data,'${path}',json(?))`).bind(orgId,j({...NEW_OPERATIONS,[key]:record}),orgId,token,j(record)),
   ...guarded(db,orgId,token,chain.genesis?[chain.genesis,...rows]:rows)];
  let saved;try{saved=await db.batch(stmts);}catch(e){if(!await chainMoved(db,orgId,chain.base))throw e;if(attempt<CHAIN_ATTEMPTS){await chainBackoff(attempt);continue;}return false;}
  return saved[0].meta.changes===1;
 }
}
// Decides whether a commit can use the patient-scoped guard. Every condition must hold;
// otherwise the organisation-wide guard applies (the pre-0a behaviour).
export function commitPlan(before:OrgState,after:OrgState,type:string,rows:Row[],teamChange:boolean,switchOrg:boolean):{patients:string[]|null;reason:string}{
 if(!before.partition)return {patients:null,reason:'organisation-wide load'};
 if(!PATIENT_COMMANDS.has(type))return {patients:null,reason:'command not certified for patient scope'};
 if(teamChange||switchOrg||after.organisation.name!==before.organisation.name)return {patients:null,reason:'organisation settings changed'};
 const visitPerson=new Map(after.workspace.visits.map(v=>[v.id,v.personId])),touched=new Set<string>();
 for(const r of rows){
  if(!PATIENT_TABLES.has(r.table))return {patients:null,reason:`organisation-level ${r.table} changed`};
  const v=r.values,pid=r.table==='patients'?v.id:v.person_id??(typeof v.visit_id==='string'?visitPerson.get(v.visit_id):null);
  if(pid!=null&&r.table!=='command_receipts'&&r.table!=='audit_events')touched.add(String(pid));
 }
 const ids=[...touched];
 if(!ids.length)return {patients:null,reason:'no patient record changed'};
 if(ids.some(id=>before.patientRevs?.[id]===undefined||!before.partition!.includes(id)))return {patients:null,reason:'a touched patient was not loaded'};
 return {patients:ids,reason:'patient-scoped'};
}
// Slice 6n: `fixtures` decides which seeded synthetic records a new home organisation receives.
// Slice 9a: `prepare` may add to a new, non-legacy home organisation before it is written (the demonstration clinical package).
export async function ensureAccount(db:D1Database,u:Actor,fixtures:(w:Workspace)=>Workspace=w=>w,prepare?:(state:OrgState)=>Promise<void>){
 const code=await accountCode(u.userId),now=new Date().toISOString();
 await db.prepare('INSERT INTO accounts (user_id,account_code,display_name,email,created_at) VALUES (?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET display_name=excluded.display_name,email=excluded.email').bind(u.userId,code,u.displayName,u.email,now).run();
 const orgId=await homeOrg(u.userId);
 const migrated=await db.prepare('SELECT owner_id FROM legacy_migrations WHERE owner_id=?').bind(u.userId).first();
 if(!migrated){const legacy=await db.prepare('SELECT revision,state FROM workspaces WHERE owner_id=?').bind(u.userId).first<{revision:number;state:string}>();const w:Workspace=legacy?JSON.parse(legacy.state):fixtures(seedWorkspace());
  if(!Array.isArray(w.people)||!Array.isArray(w.visits))fail(503,'Existing records could not be migrated. The original workspace has been preserved.');
  for(const p of w.people){p.version=1;p.teamId='default';p.assignedTo=p.assigned?u.userId:null;}
  for(const v of w.visits){v.recordVersion=1;if(v.plan&&v.plan.state!=='completed')v.plan.state='blocked';}
  const state:OrgState={organisation:{id:orgId,name:'Rampur care organisation',revision:1,createdAt:now},teams:[{id:'default',name:'Rampur care team',createdAt:now}],members:[{userId:u.userId,accountCode:code,displayName:u.displayName,role:'clinician',isOwner:true,status:'active',version:1,teamIds:['default'],createdAt:now}],invitations:[],workspace:w};
  if(!legacy&&prepare)await prepare(state);
  await createState(db,state,u,legacy?'migrateWorkspace':'createWorkspace',legacy?.revision??0,legacy?await digest(legacy.state):await digest(w),w.receipts);
 }
 const account=await db.prepare('SELECT active_org_id FROM accounts WHERE user_id=?').bind(u.userId).first<{active_org_id:string|null}>();
 if(!account?.active_org_id)await db.prepare('UPDATE accounts SET active_org_id=? WHERE user_id=? AND active_org_id IS NULL').bind(orgId,u.userId).run();
 return code;
}
export async function createState(db:D1Database,state:OrgState,u:Actor,action:string,sourceRevision=0,sourceHash='',legacyReceipts:Workspace['receipts']={},operation?:{key:string;hash:string}){
 const orgId=state.organisation.id,token=uuid(),now=state.organisation.createdAt;
 const baselineEvent={id:uuid(),at:now,actor:u.displayName,actorId:u.userId,role:'clinician' as const,action,subject:orgId,detail:action==='migrateWorkspace'?'Legacy workspace copied to structured records. Original retained. Old unexecuted approvals require a new review.':'Organisation created with an owner and a care team.'};state.workspace.audit.push(baselineEvent);
 const rows=rowsForState(state,null,u,action,'Initial baseline; earlier events remain in the activity log.',now);
 appendCommandAuthority(rows.filter(r=>r.table==='audit_events'&&r.values.id===baselineEvent.id),state,[],'bootstrap');
 rows.push(...state.members.flatMap(m=>m.teamIds.map(t=>row('team_members',{org_id:orgId,team_id:t,user_id:m.userId},['org_id','team_id','user_id']))));
 if(action!=='createOrganisation')rows.push(row('legacy_migrations',{owner_id:u.userId,org_id:orgId,source_revision:sourceRevision,source_hash:sourceHash,counts:j({people:state.workspace.people.length,visits:state.workspace.visits.length,integrations:state.workspace.integrations.length,submissions:state.workspace.submissions.length,referrals:state.workspace.referrals.length,audit:state.workspace.audit.length-1,receipts:Object.keys(legacyReceipts).length}),migrated_at:now},['owner_id'],true));
 for(const [key,r] of Object.entries(legacyReceipts))rows.push(row('command_receipts',{actor_id:u.userId,key,org_id:orgId,hash:r.hash,result:j(r.result),person_id:state.workspace.visits.find(v=>v.id===r.result?.visitId)?.personId??r.result?.personId??null,created_at:now},['actor_id','key'],true));
 if(operation)rows.push(row('command_receipts',{actor_id:u.userId,key:operation.key,org_id:orgId,hash:operation.hash,result:j({organisationId:orgId}),person_id:null,created_at:now},['actor_id','key'],true));
 const chain=await linkRows(db,orgId,rows,now);
 await db.batch([db.prepare('INSERT OR IGNORE INTO organisations (id,name,revision,last_command,created_at) VALUES (?,?,1,?,?)').bind(orgId,state.organisation.name,token,now),...guarded(db,orgId,token,chain.genesis?[chain.genesis,...rows]:rows),...(operation?[db.prepare('UPDATE accounts SET active_org_id=? WHERE user_id=? AND EXISTS (SELECT 1 FROM organisations WHERE id=? AND last_command=?)').bind(orgId,u.userId,orgId,token)]:[])]);
}
export async function history(db:D1Database,orgId:string,personId:string,cursor:[string,string]|null=null){const r=await db.prepare(`SELECT * FROM record_revisions WHERE org_id=? AND person_id=?${cursor?' AND (created_at<? OR (created_at=? AND id<?))':''} ORDER BY created_at DESC,id DESC LIMIT 51`).bind(orgId,personId,...(cursor?[cursor[0],cursor[0],cursor[1]]:[])).all<Record<string,any>>();const rows=r.results.slice(0,50),last=rows.at(-1);return {revisions:rows.map(r=>({id:r.id,personId:r.person_id,entityType:r.entity_type,entityId:r.entity_id,version:r.version,actorId:r.actor_id,actorName:r.actor_name,action:r.action,reason:r.reason,data:JSON.parse(r.data),changes:JSON.parse(r.changes),createdAt:r.created_at})) as RecordRevision[],nextCursor:r.results.length>50?j([last!.created_at,last!.id]):null};}
export function parseCursor(value:string|null){if(!value)return null;if(value.length>500)fail(400,'Invalid history cursor.');try{const c=JSON.parse(value);if(!Array.isArray(c)||c.length!==2||c.some(x=>typeof x!=='string'||x.length>200))fail(400,'Invalid history cursor.');return c as [string,string];}catch{fail(400,'Invalid history cursor.');}}
// Slice 10h: summary access events (workspace loads, searches, list pages, aggregate views) are left out of the default Activity
// log page so that routine loads do not bury other events; `summaries` asks for them. The audit chain and its exports always hold them.
function auditPageStatement(db:D1Database,orgId:string,userId:string,cursor:[string,string]|null=null,summaries=false){
 const q=`SELECT a.* FROM audit_events a JOIN memberships m ON m.org_id=a.org_id AND m.user_id=? AND m.status='active' WHERE a.org_id=? AND ((a.person_id IS NULL AND (m.is_owner=1 OR m.role='admin')) OR EXISTS (SELECT 1 FROM patients p JOIN team_members t ON t.org_id=p.org_id AND t.team_id=p.team_id AND t.user_id=m.user_id WHERE p.org_id=a.org_id AND p.id=a.person_id AND m.role NOT IN ('admin','provider') AND (m.role!='asha' OR p.assigned_to=m.user_id)))${summaries?'':` AND a.action NOT IN (${SUMMARY_ACCESS_ACTIONS.map(x=>`'${x}'`).join(',')})`}${cursor?' AND (a.at<? OR (a.at=? AND a.id<?))':''} ORDER BY a.at DESC,a.id DESC LIMIT 101`;
 return db.prepare(q).bind(userId,orgId,...(cursor?[cursor[0],cursor[0],cursor[1]]:[]));
}
function auditPageResult(results:Record<string,any>[]){
 const rows=results.slice(0,100),last=rows.at(-1);return {events:rows.map(r=>({id:r.id,at:r.at,actor:r.actor_name,actorId:r.actor_id,role:r.role,action:r.action,subject:r.subject,detail:r.detail,personId:r.person_id})) as Audit[],nextCursor:results.length>100?j([last!.at,last!.id]):null};
}
export async function auditPage(db:D1Database,orgId:string,userId:string,cursor:[string,string]|null=null,summaries=false){
 return auditPageResult((await auditPageStatement(db,orgId,userId,cursor,summaries).all<Record<string,any>>()).results);
}
// Response decorations are independent reads after the caller's durable workspace access audit.
// Keep the same fresh SQL visibility predicate; batching does not reuse membership or patient scope.
export async function snapshotDecorations(db:D1Database,orgId:string,userId:string){
 const [orgs,migration,activity]=await db.batch([
  db.prepare('SELECT o.id,o.name,m.role,m.is_owner FROM memberships m JOIN organisations o ON o.id=m.org_id WHERE m.user_id=? AND m.status=? ORDER BY o.created_at').bind(userId,'active'),
  db.prepare('SELECT migrated_at,counts FROM legacy_migrations WHERE org_id=?').bind(orgId),
  auditPageStatement(db,orgId,userId),
 ]);
 return {orgs:orgs.results as {id:string;name:string;role:Member['role'];is_owner:number}[],migration:(migration.results[0]??null) as {migrated_at:string;counts:string}|null,activity:auditPageResult(activity.results as Record<string,any>[])};
}

// The availability ledger is append-only. Its sample and chained audit commit together,
// without moving clinical revisions. SQL guards recheck policy and human authority at
// the write itself, including a revocation racing the audit-head read. First slot wins.
export async function persistAvailabilitySample(db:D1Database,config:unknown,maintenance:boolean,sample:import('./availability-types').AvailabilitySample,event:Audit,member:Member|null,dependency:{id:string;version:number;kind:string;status:string;mode:string}|null,dependencyId:string|null):Promise<boolean>{
 const orgId=sample.org_id,now=sample.recorded_at;
 for(let attempt=1;;attempt++){
  const token=uuid(),rows=[row('availability_samples',{...sample},['org_id','slot','source'],true),row('audit_events',{org_id:orgId,id:event.id,person_id:null,actor_id:event.actorId??'system',actor_name:event.actor,role:event.role,action:event.action,subject:orgId,detail:event.detail,at:event.at},['org_id','id'],true)],chain=await linkRows(db,orgId,rows,now);
  const authority=member?' AND EXISTS (SELECT 1 FROM memberships WHERE org_id=? AND user_id=? AND status=\'active\' AND role=? AND is_owner=? AND (is_owner=1 OR role=\'admin\'))':'';
  const target=dependency?` AND EXISTS (SELECT 1 FROM integrations WHERE org_id=? AND id=? AND version=? AND kind=? AND status=? AND json_extract(data,'$.mode')=?)`:dependencyId?' AND NOT EXISTS (SELECT 1 FROM integrations WHERE org_id=? AND id=?)':'';
  const targetArgs=dependency?[orgId,dependency.id,dependency.version,dependency.kind,dependency.status,dependency.mode]:dependencyId?[orgId,dependencyId]:[];
  const head=db.prepare(`UPDATE organisations SET last_command=? WHERE id=? AND EXISTS (SELECT 1 FROM operations WHERE org_id=? AND json(json_extract(data,'$.availability'))=? AND COALESCE(json_extract(data,'$.maintenance'),0)=?) AND NOT EXISTS (SELECT 1 FROM availability_samples WHERE org_id=? AND slot=? AND source=?)${authority}${target}`).bind(token,orgId,orgId,j(config),maintenance?1:0,orgId,sample.slot,sample.source,...(member?[orgId,member.userId,member.role,member.isOwner?1:0]:[]),...targetArgs);
  let saved;try{saved=await db.batch([head,...guarded(db,orgId,token,chain.genesis?[chain.genesis,...rows]:rows)]);}catch(e){if(!await chainMoved(db,orgId,chain.base))throw e;if(attempt<CHAIN_ATTEMPTS){await chainBackoff(attempt);continue;}return false;}
  return saved[0].meta.changes===1;
 }
}

// B26: a count, protected receipt and chained count-only event commit atomically.
// Current human care membership and exact opt-in configuration are checked at
// the write. No clinical revisions move, and a saved event is never counted twice.
export async function persistBurdenCounter(db:D1Database,state:OrgState,actor:Actor,member:Member,key:string,hash:string,code:import('./work-burden-types').BurdenCode){
 const config=state.operations?.workBurden;if(!config?.enabled)return {recorded:false,replayed:false};
 const orgId=state.organisation.id,now=new Date().toISOString(),day=new Date(now);day.setUTCHours(0,0,0,0);day.setUTCDate(day.getUTCDate()-((day.getUTCDay()+6)%7));const bucket=day.toISOString();
 const receiptKey='burden:'+key;
 const prior=async()=>{const r=await db.prepare('SELECT org_id,hash,result FROM command_receipts WHERE actor_id=? AND key=?').bind(actor.userId,receiptKey).first<{org_id:string;hash:string;result:string}>();if(!r)return null;if(r.org_id!==orgId||r.hash!==hash)fail(409,'This measurement key already identifies a different event.');return JSON.parse(r.result);};
 if(await prior())return {recorded:false,replayed:true};
 const event:Audit={id:uuid(),at:now,actorId:actor.userId,actor:actor.displayName,role:member.role,action:'workBurdenCounter',subject:orgId,detail:`Count-only work-burden event ${code}; UTC week ${bucket.slice(0,10)}; configuration ${config.version}.`};
 const rows=[row('command_receipts',{actor_id:actor.userId,key:receiptKey,org_id:orgId,hash,result:j({code,recorded:true}),person_id:null,created_at:now},['actor_id','key'],true),auditRow(orgId,event,actor.userId,state.workspace)];
 appendCommandAuthority(rows,state,[],'pre-mutation',actor.userId);
 for(let attempt=1;;attempt++){
  const token=uuid(),chain=await linkRows(db,orgId,rows,now);
  const roles=code.startsWith('reconciliation-')?"'asha','clinician','supervisor'":"'asha','clinician'";
  const head=db.prepare(`UPDATE organisations SET last_command=? WHERE id=? AND EXISTS (SELECT 1 FROM memberships WHERE org_id=? AND user_id=? AND status='active' AND role=? AND version=? AND role IN (${roles})) AND EXISTS (SELECT 1 FROM operations WHERE org_id=? AND json_extract(data,'$.workBurden.enabled')=1 AND json_extract(data,'$.workBurden.version')=?) AND NOT EXISTS (SELECT 1 FROM command_receipts WHERE actor_id=? AND key=?)`).bind(token,orgId,orgId,actor.userId,member.role,member.version,orgId,config.version,actor.userId,receiptKey);
  const metric=db.prepare(`INSERT INTO request_metrics (org_id,bucket,route,status,count,total_ms,max_ms) SELECT ?,?,?,0,1,0,0 WHERE EXISTS (SELECT 1 FROM organisations WHERE id=? AND last_command=?) ON CONFLICT(org_id,bucket,route,status) DO UPDATE SET count=count+1`).bind(orgId,bucket,'burden:'+code,orgId,token);
  let saved;try{saved=await db.batch([head,metric,...guarded(db,orgId,token,chain.genesis?[chain.genesis,...rows]:rows)]);}catch(e){if(await prior())return {recorded:false,replayed:true};if(!await chainMoved(db,orgId,chain.base))throw e;if(attempt<CHAIN_ATTEMPTS){await chainBackoff(attempt);continue;}fail(409,'Measurement contention; keep the same event key for retry.');}
  if(saved[0].meta.changes===1)return {recorded:true,replayed:false};
  if(await prior())return {recorded:false,replayed:true};fail(403,'Current care membership and enabled measurement are required.');
 }
}
