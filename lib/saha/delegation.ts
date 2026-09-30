import { z } from 'zod';
import { fail, uuid } from './core';
import { allowed } from './access';
import type { Actor } from './store';
import type { Member, OrgState, Person } from './types';

// Slice 1e: time-limited delegation within the current role model (BR-ID-02, BR-ID-09).
// A supervisor (or an owner with a care role) can delegate supervision of teams they supervise to a
// named clinician in those teams; an owner with a care role can delegate reporting-only access to
// teams' aggregate reports to a named clinician or supervisor. A delegation has a reason, an end at
// most 30 days away, can be revoked by its grantor, its delegate or any owner, and is audited on grant,
// revocation and every use. It works only while the grantor still holds the authority and the delegate
// still qualifies, is checked on the server wherever the delegated authority is checked, and never
// widens patient access: supervision needs the delegate's own team membership, and reporting-only
// access yields aggregates, not records. Delegations live in the organisation operations document.
export type DelegationKind='team-supervision'|'reporting';
export type Delegation={id:string;version:number;kind:DelegationKind;grantorId:string;delegateId:string;teamIds:string[];from:string;until:string;reason:string;createdAt:string;revokedAt?:string;revokedBy?:string;revokeReason?:string};
export type DelegationUse={id:string;kind:DelegationKind;grantorId:string;until:string};
export const MAX_DAYS=30,MAX_RECORDS=200,MAX_ACTIVE_PER_DELEGATE=5;
export const KIND_LABEL:Record<DelegationKind,string>={'team-supervision':'Team supervision','reporting':'Reporting only'};
// What each kind lets the delegate do; the UI and documentation show this list.
export const SCOPE:Record<DelegationKind,string>={'team-supervision':'Assign patients within the team, steward rights requests, reassign action-plan items and manage referral ownership for the team\'s patients.','reporting':'View and export the scoped aggregate care report for the teams. No patient records, exception queue, indicators or operations settings.'};
const id=z.string().trim().min(1).max(200),reason=z.string().trim().min(10,'Write at least 10 characters.').max(500);
export const delegationSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('delegationGrant'),kind:z.enum(['team-supervision','reporting']),delegateId:id,teamIds:z.array(id).min(1).max(10).refine(x=>new Set(x).size===x.length,'Choose each team once.'),until:z.string().datetime(),reason}).strict(),
 z.object({type:z.literal('delegationRevoke'),delegationId:id,version:z.number().int().positive(),reason}).strict(),
]);
const TYPES=new Set(['delegationGrant','delegationRevoke']);
const active=(m?:Member):m is Member=>!!m&&m.status==='active';
// Whether a member holds, in their own right, the authority a delegation of this kind passes on.
export function holds(m:Member|undefined,kind:DelegationKind,teamIds:string[]){
 if(!active(m)||m.role==='admin'||!teamIds.every(t=>m.teamIds.includes(t)))return false;
 return kind==='team-supervision'?(m.role==='supervisor'||m.isOwner):m.isOwner;
}
export function qualifies(m:Member|undefined,kind:DelegationKind,teamIds:string[]){
 if(!active(m))return false;
 return kind==='team-supervision'?m.role==='clinician'&&teamIds.every(t=>m.teamIds.includes(t)):['clinician','supervisor'].includes(m.role);
}
const member=(s:OrgState,userId:string)=>s.members.find(x=>x.userId===userId);
export const delegations=(s:OrgState)=>s.operations?.delegations??[];
// A delegation is in force between its start and end, unrevoked, while both parties still qualify.
export function inForce(s:OrgState,d:Delegation,now=new Date().toISOString()){return !d.revokedAt&&d.from<=now&&now<d.until&&holds(member(s,d.grantorId),d.kind,d.teamIds)&&qualifies(member(s,d.delegateId),d.kind,d.teamIds);}
export function heldBy(s:OrgState,m:Member,kind:DelegationKind,now=new Date().toISOString()){return delegations(s).filter(d=>d.delegateId===m.userId&&d.kind===kind&&inForce(s,d,now));}
function used(s:OrgState,d:Delegation){const list=s.delegationUsed??=[];if(!list.some(x=>x.id===d.id))list.push({id:d.id,kind:d.kind,grantorId:d.grantorId,until:d.until});}
// Team supervision: the member's own authority, or a delegation in force for this team (recorded as used).
export function supervises(s:OrgState,m:Member,teamId:string,now=new Date().toISOString(),record=true){
 if(holds(m,'team-supervision',[teamId]))return true;
 const d=heldBy(s,m,'team-supervision',now).find(x=>x.teamIds.includes(teamId));if(!d)return false;if(record)used(s,d);return true;
}
// Reporting: the viewer's own report scope (owners, administrators and supervisors), widened or, for a
// delegate without reporting authority, replaced by the delegated teams' aggregates.
export function reportingScope(s:OrgState,m:Member,now=new Date().toISOString()){
 const own=m.isOwner||m.role==='admin'||m.role==='supervisor',ds=m.role==='admin'?[]:heldBy(s,m,'reporting',now),extra=[...new Set(ds.flatMap(d=>d.teamIds))];
 if(!own&&!ds.length)fail(403,'Supervisor or operations access required.');
 const include=(p:Person)=>(own&&allowed(m,p))||extra.includes(p.teamId);
 return {own,delegations:ds,teams:[...new Set([...(own?m.teamIds:[]),...extra])],include};
}
export function authorizeDelegation(s:OrgState,m:Member,c:any,now=new Date().toISOString()){
 if(!TYPES.has(c?.type))return;if(!active(m))fail(403,'Your membership is inactive.');
 if(c.type==='delegationGrant'){if(!holds(m,c.kind,c.teamIds??[]))fail(403,c.kind==='reporting'?'Only an owner with a care role can delegate reporting for teams they belong to.':'Only a supervisor or an owner with a care role can delegate supervision of teams they belong to.');return;}
 const d=delegations(s).find(x=>x.id===c.delegationId);if(!d)fail(404,'Delegation not found.');
 if(d.grantorId!==m.userId&&d.delegateId!==m.userId&&!m.isOwner)fail(403,'Only the grantor, the delegate or an owner can revoke this delegation.');
}
export function applyDelegation(s:OrgState,input:unknown,u:Actor,m:Member,now=new Date().toISOString()):any|null{
 const parsed=delegationSchema.safeParse(input);if(!parsed.success)return null;const c=parsed.data;authorizeDelegation(s,m,c,now);
 const ops=s.operations??{version:0,maintenance:false,reason:'',updatedAt:'',incidents:[],rates:null},list=ops.delegations??[];const name=(id:string)=>member(s,id)?.displayName??'Former member';
 const teams=(ids:string[])=>ids.map(t=>s.teams.find(x=>x.id===t)?.name??t).join(', ');let d:Delegation,detail:string;
 if(c.type==='delegationGrant'){
  if(c.teamIds.some(t=>!s.teams.some(x=>x.id===t)))fail(422,'Choose teams in this organisation.');
  if(c.delegateId===u.userId)fail(422,'Choose another member; you already hold this authority.');
  const target=member(s,c.delegateId);if(!qualifies(target,c.kind,c.teamIds))fail(422,c.kind==='team-supervision'?'Choose an active clinician who belongs to every selected team.':'Choose an active clinician or supervisor.');
  if(holds(target,c.kind,c.teamIds))fail(422,'This member already holds this authority for these teams.');
  if(c.until<=now||Date.parse(c.until)>Date.parse(now)+MAX_DAYS*86400000)fail(422,`Choose an end within the next ${MAX_DAYS} days.`);
  if(list.some(x=>x.delegateId===c.delegateId&&x.kind===c.kind&&inForce(s,x,now)&&x.teamIds.some(t=>c.teamIds.includes(t))))fail(409,'A delegation of this kind for one of these teams is already in force. Revoke it first.');
  if(list.filter(x=>x.delegateId===c.delegateId&&inForce(s,x,now)).length>=MAX_ACTIVE_PER_DELEGATE)fail(422,'This member already holds the maximum number of delegations.');
  // Slice 6p: only delegations not yet ended or revoked count toward the limit; ended and revoked
  // records stay stored (with their audit events) and no longer block new grants.
  if(list.filter(x=>!x.revokedAt&&x.until>now).length>=MAX_RECORDS)fail(422,'Delegation record limit reached.');
  d={id:uuid(),version:1,kind:c.kind,grantorId:u.userId,delegateId:c.delegateId,teamIds:c.teamIds,from:now,until:new Date(c.until).toISOString(),reason:c.reason,createdAt:now};(ops.delegations??=[]).push(d);s.operations=ops;
  detail=`${KIND_LABEL[d.kind]} delegated to ${target!.displayName} for ${teams(d.teamIds)} until ${d.until.slice(0,16).replace('T',' ')} UTC. ${c.reason}`;
 } else {
  d=list.find(x=>x.id===c.delegationId)!;if(d.version!==c.version)fail(409,'This delegation changed. Refresh before revoking it.');if(d.revokedAt)fail(409,'This delegation is already revoked.');if(d.until<=now)fail(409,'This delegation has already ended.');
  Object.assign(d,{revokedAt:now,revokedBy:u.userId,revokeReason:c.reason,version:d.version+1});
  detail=`${KIND_LABEL[d.kind]} delegation to ${name(d.delegateId)} for ${teams(d.teamIds)} revoked${d.delegateId===u.userId?' by the delegate':''}. ${c.reason}`;
 }
 s.workspace.audit.push({id:uuid(),at:now,actor:u.displayName,actorId:u.userId,role:m.role,action:c.type,subject:d.id,detail});
 return {delegationId:d.id,version:d.version};
}
// Audit lines for authority used under a delegation during one command; appended by the dispatcher.
export function delegationAudit(s:OrgState,u:Actor,m:Member,type:string,personId:string|null,now=new Date().toISOString()){
 for(const x of s.delegationUsed??[])s.workspace.audit.push({id:uuid(),at:now,actor:u.displayName,actorId:u.userId,role:m.role,action:'delegatedAuthority',subject:x.id,personId,detail:`${type} carried out under ${KIND_LABEL[x.kind].toLowerCase()} delegated by ${member(s,x.grantorId)?.displayName??'a former member'}, in force until ${x.until.slice(0,16).replace('T',' ')} UTC.`});
 delete s.delegationUsed;
}
export function delegationView(s:OrgState,m:Member,now=new Date().toISOString()){
 const name=(id:string)=>member(s,id)?.displayName??'Former member',teamName=(t:string)=>s.teams.find(x=>x.id===t)?.name??t;
 const visible=delegations(s).filter(d=>m.isOwner||d.grantorId===m.userId||d.delegateId===m.userId);
 const grantable=(['team-supervision','reporting'] as DelegationKind[]).map(kind=>({kind,label:KIND_LABEL[kind],scope:SCOPE[kind],teams:m.teamIds.filter(t=>holds(m,kind,[t])).map(t=>({id:t,name:teamName(t)})),delegates:s.members.filter(x=>x.userId!==m.userId&&qualifies(x,kind,[])&&!(kind==='reporting'?x.isOwner:holds(x,kind,x.teamIds))&&(kind==='reporting'||x.teamIds.some(t=>m.teamIds.includes(t)))).map(x=>({userId:x.userId,displayName:x.displayName,role:x.role,teamIds:x.teamIds}))})).filter(g=>g.teams.length);
 return {maxDays:MAX_DAYS,grantable,delegations:visible.slice().reverse().map(d=>({...d,kindLabel:KIND_LABEL[d.kind],scope:SCOPE[d.kind],grantor:name(d.grantorId),delegate:name(d.delegateId),revoker:d.revokedBy?name(d.revokedBy):undefined,teams:d.teamIds.map(teamName),state:d.revokedAt?'revoked':now>=d.until?'ended':inForce(s,d,now)?'in force':'not in force',canRevoke:!d.revokedAt&&now<d.until&&(d.grantorId===m.userId||d.delegateId===m.userId||m.isOwner)}))};
}
