import { z } from 'zod';
import { fail, person, uuid } from './core';
import { normallyAllowed } from './access';
import type { Actor } from './store';
import type { Member, OrgState, Person } from './types';
import { supervises } from './delegation';

// Slice 6b: rights and grievance requests (BR-SEC-10). A request is recorded against one patient
// with how the requester's identity (or a representative's authority) was checked, gets a due date
// and a named owner, and closes with an outcome, a response and evidence. Where data already left
// Saha, each destination becomes an item someone must mark as notified. A fulfilled restriction
// request pauses external sharing and optional AI for the patient until it is lifted.
export type RightsKind='access'|'correction'|'restriction'|'deletion'|'grievance';
export type RightsItem={id:string;kind:'programme-destination'|'ehr-destination';ref:string;detail:string;state:'open'|'notified'|'not-required';note?:string;by?:string;at?:string};
export type RightsRequest={id:string;version:number;personId:string;kind:RightsKind;channel:'in-person'|'phone'|'written';requester:'self'|'proxy';proxyGrantId?:string;identityCheck:string;detail:string;receivedAt:string;dueAt:string;createdBy:string;ownerId:string;state:'open'|'closed';
 closed?:{by:string;at:string;outcome:'fulfilled'|'partially-fulfilled'|'refused'|'withdrawn';response:string;evidence:string};items:RightsItem[];history:{at:string;by:string;action:string;note:string}[]};
export type Restriction={requestId:string;from:string;by:string;liftedAt?:string;liftedBy?:string;liftReason?:string};
export const DUE_DAYS=30,MAX_OPEN_PER_PERSON=10;
const id=z.string().trim().min(1).max(200),version=z.number().int().positive(),text=z.string().trim().min(10,'Write at least 10 characters.').max(2000),ref=z.string().trim().min(3).max(200);
export const rightsSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('rightsCreate'),personId:id,kind:z.enum(['access','correction','restriction','deletion','grievance']),channel:z.enum(['in-person','phone','written']),requester:z.enum(['self','proxy']),proxyGrantId:id.optional(),identityCheck:ref,detail:text}).strict(),
 z.object({type:z.literal('rightsAssign'),requestId:id,version,ownerId:id,note:text}).strict(),
 z.object({type:z.literal('rightsClose'),requestId:id,version,outcome:z.enum(['fulfilled','partially-fulfilled','refused','withdrawn']),response:text,evidence:ref}).strict(),
 z.object({type:z.literal('rightsItemResolve'),requestId:id,version,itemId:id,state:z.enum(['notified','not-required']),note:z.string().trim().min(5).max(1000)}).strict(),
 z.object({type:z.literal('rightsRestrictionLift'),requestId:id,version,reason:text}).strict(),
]);
const TYPES=new Set(['rightsCreate','rightsAssign','rightsClose','rightsItemResolve','rightsRestrictionLift']);
// Commands paused while processing is restricted: external sharing, programme sending and optional AI.
export const PAUSED_WHEN_RESTRICTED=new Set(['preparePlan','approvePlan','executePlan','sendSubmission','runAI','prepareAgent','executeAgent','applyAgent','prepareEhrPublish','executeEhrPublish','messageCreate','messageApprove']);
export function activeRestriction(p:Person){return (p.restrictions??[]).find(r=>!r.liftedAt);}
export function ensureNotRestricted(s:OrgState,c:any){
 if(!PAUSED_WHEN_RESTRICTED.has(c.type))return;const w=s.workspace;let pid:string|undefined=c.personId;
 if(c.visitId)pid=w.visits.find(v=>v.id===c.visitId)?.personId;if(c.submissionId)pid=w.submissions.find(v=>v.id===c.submissionId)?.personId;if(c.messageId)pid=s.outreach?.messages.find(v=>v.id===c.messageId)?.personId;if(c.planId&&c.itemId)pid=s.outreach?.plans.find(v=>v.id===c.planId)?.items.find(v=>v.id===c.itemId)?.personId;
 const p=pid?w.people.find(x=>x.id===pid):undefined;
 if(p&&activeRestriction(p))fail(409,'Processing is restricted for this patient under a rights request. Recording care continues; external sharing, programme sending, reminders and optional AI are paused.');
}
const staff=(m:Member)=>m.status==='active'&&m.role!=='admin';
// Slice 1e: a team supervisor or owner with a care role, or a clinician holding a supervision delegation for the team.
const steward=(s:OrgState,m:Member,p:Person,now?:string)=>supervises(s,m,p.teamId,now);
function request(s:OrgState,requestId:string,v:number){const r=(s.rightsRequests??[]).find(x=>x.id===requestId);if(!r)fail(404,'Rights request not found.');if(r.version!==v)fail(409,'This request changed. Refresh before continuing.');return r;}
export function authorizeRights(s:OrgState,m:Member,c:any,now?:string){
 if(!TYPES.has(c?.type))return;if(!staff(m))fail(403,'Rights requests contain patient information; an administrator role cannot handle them.');
 if(c.type==='rightsCreate'){person(s.workspace,c.personId);return;}
 const r=(s.rightsRequests??[]).find(x=>x.id===c.requestId);if(!r)fail(404,'Rights request not found.');const p=person(s.workspace,r.personId);
 if(c.type==='rightsAssign'&&!steward(s,m,p,now))fail(403,'A supervisor or owner of the patient\'s team assigns rights requests.');
 if(['rightsClose','rightsRestrictionLift','rightsItemResolve'].includes(c.type)&&r.ownerId!==m.userId&&!steward(s,m,p,now))fail(403,'Only the request owner or a supervisor or owner of the patient\'s team can do this.');
}
// Destinations that already hold data about the patient.
function destinations(s:OrgState,p:Person,now:string):RightsItem[]{
 const items:RightsItem[]=[];
 for(const x of s.workspace.submissions)if(x.personId===p.id&&['accepted','uncertain'].includes(x.state))items.push({id:uuid(),kind:'programme-destination',ref:x.id,detail:`${x.connectorName} holds a ${x.state} submission from ${x.createdAt.slice(0,10)}. Tell it about this request through its process.`,state:'open'});
 for(const o of p.ehr?.operations??[])if(['accepted','uncertain'].includes(o.state))items.push({id:uuid(),kind:'ehr-destination',ref:o.id,detail:`An EHR received a ${o.state} publication on ${o.at.slice(0,10)}. Tell it about this request through its process.`,state:'open'});
 return items;
}
export function applyRights(s:OrgState,input:unknown,u:Actor,m:Member,now=new Date().toISOString()):any|null{
 const parsed=rightsSchema.safeParse(input);if(!parsed.success)return null;const c=parsed.data;authorizeRights(s,m,c,now);
 s.rightsRequests??=[];const w=s.workspace;let r:RightsRequest,detail='',result:any={ok:true};
 if(c.type==='rightsCreate'){
  const p=person(w,c.personId);
  if(c.requester==='proxy'){const g=(p.proxies??[]).find(x=>x.id===c.proxyGrantId);if(!g||g.revokedAt||g.expiresAt<=now)fail(422,'A representative needs a current proxy grant recorded on this patient. Record one first.');}
  else if(c.proxyGrantId)fail(422,'A proxy grant applies only to a representative\'s request.');
  if(s.rightsRequests.filter(x=>x.personId===p.id&&x.state==='open').length>=MAX_OPEN_PER_PERSON)fail(422,'Too many open requests for this patient. Close some first.');
  const dueAt=new Date(Date.parse(now)+DUE_DAYS*86400000).toISOString();
  r={id:uuid(),version:1,personId:p.id,kind:c.kind,channel:c.channel,requester:c.requester,...(c.proxyGrantId?{proxyGrantId:c.proxyGrantId}:{}),identityCheck:c.identityCheck,detail:c.detail,receivedAt:now,dueAt,createdBy:u.userId,ownerId:u.userId,state:'open',items:['correction','restriction','deletion'].includes(c.kind)?destinations(s,p,now):[],history:[{at:now,by:u.userId,action:'received',note:`Identity checked: ${c.identityCheck}`}]};
  s.rightsRequests.push(r);detail=`${c.kind} request received (${c.channel}, ${c.requester==='proxy'?'representative with a current proxy grant':'the patient'}); due ${dueAt.slice(0,10)}; ${r.items.length} destinations to notify.`;result={requestId:r.id,dueAt,items:r.items.length};
 }
 else {
  r=request(s,c.requestId,c.version);const p=person(w,r.personId);
  if(c.type==='rightsAssign'){if(r.state!=='open')fail(409,'This request is closed.');const o=s.members.find(x=>x.userId===c.ownerId);if(!o||!staff(o)||!normallyAllowed(o,p))fail(422,'Choose an active member with care access to this patient.');r.ownerId=o.userId;r.history.push({at:now,by:u.userId,action:'assigned',note:c.note});detail=`Rights request assigned to ${o.displayName}. ${c.note}`;}
  else if(c.type==='rightsClose'){
   if(r.state!=='open')fail(409,'This request is already closed.');
   if(['fulfilled','partially-fulfilled'].includes(c.outcome)&&r.items.some(i=>i.state==='open'))fail(409,'Record each destination as notified or not required before closing this request as fulfilled.');
   r.state='closed';r.closed={by:u.userId,at:now,outcome:c.outcome,response:c.response,evidence:c.evidence};r.history.push({at:now,by:u.userId,action:c.outcome,note:c.response});
   if(r.kind==='restriction'&&c.outcome==='fulfilled'){if(!activeRestriction(p)){(p.restrictions??=[]).push({requestId:r.id,from:now,by:u.userId});p.version++;}}
   detail=`Rights request closed: ${c.outcome}${now>r.dueAt?' (after the due date)':''}. Evidence ${c.evidence}. ${c.response}${r.kind==='restriction'&&c.outcome==='fulfilled'?' Processing restriction now in force.':''}`;result={state:r.state,late:now>r.dueAt};
  }
  else if(c.type==='rightsItemResolve'){const i=r.items.find(x=>x.id===c.itemId);if(!i)fail(404,'Destination item not found.');if(i.state!=='open')fail(409,'This destination is already recorded.');Object.assign(i,{state:c.state,note:c.note,by:u.userId,at:now});r.history.push({at:now,by:u.userId,action:`destination ${c.state}`,note:c.note});detail=`Destination ${i.kind} recorded as ${c.state}: ${c.note}`;}
  else {const x=activeRestriction(p);if(!x||x.requestId!==r.id)fail(409,'No restriction from this request is in force.');Object.assign(x,{liftedAt:now,liftedBy:u.userId,liftReason:c.reason});p.version++;r.history.push({at:now,by:u.userId,action:'restriction lifted',note:c.reason});detail=`Processing restriction lifted. ${c.reason}`;}
 }
 r.version=c.type==='rightsCreate'?1:r.version+1;
 w.audit.push({id:uuid(),at:now,actorId:u.userId,actor:u.displayName,role:m.role,action:c.type,subject:r.id,personId:r.personId,detail});
 return result;
}
export function rightsView(s:OrgState,m:Member,personId:string|null,now=new Date().toISOString()){
 const name=(id:string)=>s.members.find(x=>x.userId===id)?.displayName??'Former member';
 const row=(r:RightsRequest)=>{const p=s.workspace.people.find(x=>x.id===r.personId)!;return {...r,personName:p.name,owner:name(r.ownerId),overdue:r.state==='open'&&r.dueAt<now,openItems:r.items.filter(i=>i.state==='open').length,canAssign:steward(s,m,p,now),canClose:r.state==='open'&&(r.ownerId===m.userId||steward(s,m,p,now)),restriction:activeRestriction(p)?.requestId===r.id,canLift:activeRestriction(p)?.requestId===r.id&&(r.ownerId===m.userId||steward(s,m,p,now)),history:r.history.map(h=>({...h,by:name(h.by)}))};};
 if(personId){const p=person(s.workspace,personId);return {personId:p.id,restricted:!!activeRestriction(p),requests:(s.rightsRequests??[]).filter(r=>r.personId===p.id).sort((a,b)=>b.receivedAt.localeCompare(a.receivedAt)).map(row),owners:s.members.filter(x=>staff(x)&&normallyAllowed(x,p)).map(x=>({userId:x.userId,displayName:x.displayName})),proxies:(p.proxies??[]).filter(g=>!g.revokedAt&&g.expiresAt>now).map(g=>({id:g.id,name:s.workspace.people.find(x=>x.id===g.proxyPersonId)?.name??'Registered person',relationship:g.relationship})),dueDays:DUE_DAYS};}
 const open=(s.rightsRequests??[]).filter(r=>r.state==='open'&&s.workspace.people.find(x=>x.id===r.personId)?.assigned).sort((a,b)=>a.dueAt.localeCompare(b.dueAt)).slice(0,100).map(row);
 return {open,overdue:open.filter(r=>r.overdue).length,dueDays:DUE_DAYS};
}
