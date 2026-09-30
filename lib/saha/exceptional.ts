import { z } from 'zod';
import { fail, uuid } from './core';
import { exceptionalGrant, normallyAllowed } from './access';
import type { Actor } from './store';
import type { Member, OrgState, Person } from './types';

// Slice 6a: exceptional ("break-glass") access (BR-SEC-11). A clinician may open time-limited
// access to one patient outside their normal scope by record reference, with a reason. The grant
// permits reading and recording urgent care only; it never permits external sharing, identity,
// assignment, household or consent changes. Every grant is audited and must be reviewed by a
// supervisor or owner of the patient's team who did not use it.
export type ExceptionalGrant={id:string;userId:string;reason:string;from:string;until:string;closedAt?:string;closedBy?:string;review?:{by:string;at:string;outcome:'appropriate'|'inappropriate';note:string}};
export const MIN_MINUTES=15,MAX_MINUTES=240,MAX_ACTIVE=3,MAX_PER_DAY=10;
const id=z.string().trim().min(1).max(200),reason=z.string().trim().min(20,'Explain the emergency in at least 20 characters.').max(1000),note=z.string().trim().min(5).max(1000);
export const exceptionalSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('exceptionalOpen'),recordRef:z.string().trim().min(4).max(100),minutes:z.number().int().min(MIN_MINUTES).max(MAX_MINUTES),reason}).strict(),
 z.object({type:z.literal('exceptionalClose'),personId:id,grantId:id}).strict(),
 z.object({type:z.literal('exceptionalReview'),personId:id,grantId:id,outcome:z.enum(['appropriate','inappropriate']),note}).strict(),
]);
// Commands a clinician may run on a patient reached only through exceptional access.
export const PERMITTED_UNDER_EXCEPTIONAL=new Set(['startVisit','saveVisit','confirmVisit','createReferral','createDirectoryReferral','saveClinicalConcern','checkProtocol','scheduleFollowUp','saveProgrammeAnswers','exceptionalClose']);
function target(s:OrgState,c:any){const w=s.workspace;let pid:string|undefined=c.personId;if(c.visitId)pid=w.visits.find(v=>v.id===c.visitId)?.personId;if(c.submissionId)pid=w.submissions.find(v=>v.id===c.submissionId)?.personId;if(c.referralId)pid=w.referrals.find(v=>v.id===c.referralId)?.personId;if(c.messageId)pid=s.outreach?.messages.find(v=>v.id===c.messageId)?.personId;return pid?w.people.find(p=>p.id===pid):undefined;}
// Refuses anything beyond urgent care on a patient the member reaches only through a grant.
export function ensureExceptionalScope(s:OrgState,m:Member,c:any,now=new Date().toISOString()){
 if(PERMITTED_UNDER_EXCEPTIONAL.has(c.type))return;const p=target(s,c);
 if(p&&!normallyAllowed(m,p)&&exceptionalGrant(m,p,now))fail(403,'Emergency access permits reading and recording urgent care only. Ask the patient\'s team for anything else.');
}
export function resolveRecord(s:OrgState,ref:string){
 const r=ref.trim().toLowerCase().replace(/^record\s+/,'');
 const found=s.workspace.people.filter(p=>{const i=p.id.toLowerCase();return i===r||i==='p_'+r||(r.length>=8&&i.startsWith(r));});
 if(!found.length)fail(404,'No record matches this reference in this organisation.');if(found.length>1)fail(409,'This reference matches more than one record. Enter the full record reference.');
 return found[0];
}
const reviewer=(s:OrgState,m:Member,p:Person)=>m.status==='active'&&(m.role==='supervisor'||(m.isOwner&&m.role!=='admin'))&&m.teamIds.includes(p.teamId);
export function applyExceptional(s:OrgState,input:unknown,u:Actor,m:Member,now=new Date().toISOString()):any|null{
 const parsed=exceptionalSchema.safeParse(input);if(!parsed.success)return null;const c=parsed.data;const w=s.workspace;let p:Person,detail:string,result:any={ok:true};
 if(c.type==='exceptionalOpen'){
  if(m.role!=='clinician'||m.status!=='active')fail(403,'Only a clinician can open emergency access.');
  p=resolveRecord(s,c.recordRef);
  if(normallyAllowed(m,p))fail(409,'You already have access to this patient.');
  if(p.mergedInto)fail(409,'This record was merged into another record. Use the surviving record.');
  if(exceptionalGrant(m,p,now))fail(409,'You already have current emergency access to this patient.');
  const mine=w.people.flatMap(q=>(q.exceptionalAccess??[]).filter(g=>g.userId===m.userId));
  if(mine.filter(g=>!g.closedAt&&g.until>now).length>=MAX_ACTIVE)fail(429,`At most ${MAX_ACTIVE} emergency accesses can be open at once. Close one first.`);
  const dayAgo=new Date(Date.parse(now)-86400000).toISOString();if(mine.filter(g=>g.from>dayAgo).length>=MAX_PER_DAY)fail(429,`At most ${MAX_PER_DAY} emergency accesses can be opened in 24 hours.`);
  if((p.exceptionalAccess??[]).length>=200)fail(422,'Emergency access history limit reached for this record; an archival policy is required.');
  const g:ExceptionalGrant={id:uuid(),userId:m.userId,reason:c.reason,from:now,until:new Date(Date.parse(now)+c.minutes*60000).toISOString()};
  (p.exceptionalAccess??=[]).push(g);p.version++;p.assigned=true;
  detail=`Emergency access opened for ${c.minutes} minutes by ${u.displayName}, outside normal care scope. Reading and urgent care recording only; review required. Reason: ${c.reason}`;result={personId:p.id,grantId:g.id,until:g.until};
 }
 else {
  p=w.people.find(x=>x.id===c.personId)!;if(!p)fail(404,'Patient not found.');const g=(p.exceptionalAccess??[]).find(x=>x.id===c.grantId);if(!g)fail(404,'Emergency access grant not found.');
  if(c.type==='exceptionalClose'){if(g.userId!==m.userId)fail(403,'Only the clinician who opened emergency access can close it early.');if(g.closedAt||g.until<=now)fail(409,'This emergency access has already ended.');g.closedAt=now;g.closedBy=u.userId;detail='Emergency access closed early by the clinician who opened it.';}
  else {if(!reviewer(s,m,p))fail(403,'A supervisor or owner of the patient\'s team must review emergency access.');if(g.userId===m.userId)fail(403,'A different person must review your emergency access.');if(g.review)fail(409,'This emergency access has already been reviewed.');if(!g.closedAt&&g.until>now)fail(409,'Review emergency access after it has ended.');g.review={by:u.userId,at:now,outcome:c.outcome,note:c.note};detail=`Emergency access by ${s.members.find(x=>x.userId===g.userId)?.displayName??'a former member'} reviewed: ${c.outcome}. ${c.note}`;}
  p.version++;
 }
 w.audit.push({id:uuid(),at:now,actorId:u.userId,actor:u.displayName,role:m.role,action:c.type,subject:p.id,personId:p.id,detail});
 return result;
}
export function authorizeExceptional(s:OrgState,m:Member,c:any){
 if(c?.type==='exceptionalOpen'&&m.role!=='clinician')fail(403,'Only a clinician can open emergency access.');
 if(c?.type==='exceptionalReview'){const p=s.workspace.people.find(x=>x.id===c.personId);if(!p||!reviewer(s,m,p))fail(403,'A supervisor or owner of the patient\'s team must review emergency access.');}
}
// Grants the viewer holds, and grants the viewer may review.
export function exceptionalView(s:OrgState,m:Member,now=new Date().toISOString()){
 const name=(id:string)=>s.members.find(x=>x.userId===id)?.displayName??'Former member';
 const row=(p:Person,g:ExceptionalGrant)=>({personId:p.id,name:p.name,grantId:g.id,user:name(g.userId),userId:g.userId,reason:g.reason,from:g.from,until:g.until,closedAt:g.closedAt??null,active:!g.closedAt&&g.until>now,review:g.review?{...g.review,by:name(g.review.by)}:null});
 const mine=s.workspace.people.flatMap(p=>(p.exceptionalAccess??[]).filter(g=>g.userId===m.userId).map(g=>row(p,g))).sort((a,b)=>b.from.localeCompare(a.from)).slice(0,20);
 const reviews=s.workspace.people.filter(p=>reviewer(s,m,p)).flatMap(p=>(p.exceptionalAccess??[]).filter(g=>g.userId!==m.userId&&!g.review).map(g=>row(p,g))).sort((a,b)=>a.from.localeCompare(b.from)).slice(0,100);
 const reviewed=s.workspace.people.filter(p=>reviewer(s,m,p)).flatMap(p=>(p.exceptionalAccess??[]).filter(g=>g.review).map(g=>row(p,g))).sort((a,b)=>b.review!.at.localeCompare(a.review!.at)).slice(0,20);
 return {canOpen:m.role==='clinician',canReview:m.status==='active'&&(m.role==='supervisor'||(m.isOwner&&m.role!=='admin')),mine,reviews,reviewed,limits:{minMinutes:MIN_MINUTES,maxMinutes:MAX_MINUTES,maxActive:MAX_ACTIVE,maxPerDay:MAX_PER_DAY},rule:'Emergency access is for urgent care of a patient outside your normal scope. It lasts at most four hours, permits reading and recording urgent care only, and is reviewed afterwards by a supervisor or owner of the patient\'s team.'};
}
