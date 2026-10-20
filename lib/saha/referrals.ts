import { z } from 'zod';
import { fail, person, uuid } from './core';
import { normallyAllowed } from './access';
import { CONSTRAINTS, escalation, TERMINAL, URGENCIES } from './referral-rules';
import type { Actor } from './store';
import type { Member, OrgState, Person, Referral } from './types';
import { supervises } from './delegation';
import { planItemWaiting } from './plan-dependency-state';

// Slice 4a: reasoned referral delays and the escalation queue (BR-CARE-03, BR-CARE-04).
export const referralSchema=z.discriminatedUnion('type',[
 // Slice 4d: link one more source of the same patient to an open referral.
 z.object({type:z.literal('linkReferralSource'),referralId:z.string().min(1).max(200),version:z.number().int().positive(),kind:z.enum(['visit','protocol-evaluation','programme-episode']),sourceId:z.string().trim().min(1).max(200),note:z.string().trim().min(5).max(500)}).strict(),
 z.object({type:z.literal('referralDelay'),referralId:z.string().min(1).max(200),version:z.number().int().positive(),due:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(x=>!isNaN(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x),constraint:z.enum(CONSTRAINTS),reason:z.string().trim().min(10).max(1000)}).strict(),
]);
// Slice 1e: a team supervisor or owner with a care role, or a clinician holding a supervision delegation for the team.
const steward=(s:OrgState,m:Member,p:Person)=>supervises(s,m,p.teamId);
export const activeOwner=(s:OrgState,r:Referral,p:Person)=>{const o=s.members.find(x=>x.userId===r.ownerId);return !!o&&['asha','clinician'].includes(o.role)&&normallyAllowed(o,p);};
// Slice 4d: the referral owner, a steward of the patient's team or a clinician with normal access links sources.
// Also applied when an idempotent request is replayed.
export function authorizeReferralSource(s:OrgState,m:Member,c:any){
 if(c?.type!=='linkReferralSource')return;const r=s.workspace.referrals.find(x=>x.id===c.referralId);if(!r)fail(404,'Referral not found.');const p=person(s.workspace,r.personId);
 if(m.role==='admin'||!(r.ownerId===m.userId&&normallyAllowed(m,p))&&!steward(s,m,p)&&!(m.role==='clinician'&&normallyAllowed(m,p)))fail(403,'The referral owner, a clinician with current access, or a supervisor or owner of the patient\'s team links referral sources.');
}
const MAX_SOURCES=20;
function linkSource(s:OrgState,c:Extract<z.infer<typeof referralSchema>,{type:'linkReferralSource'}>,r:Referral,p:Person,u:Actor,m:Member,now:string){
 const w=s.workspace;authorizeReferralSource(s,m,c);
 if((r.version??1)!==c.version)fail(409,'Referral changed. Refresh before continuing.');
 if(TERMINAL.has(r.state))fail(409,'This referral is closed; its evidence cannot change.');if(p.mergedInto)fail(409,'This record was merged into another record.');
 let src:{refId:string;visitId?:string;sourceAt:string;label:string}|undefined;
 if(c.kind==='visit'){const v=w.visits.find(x=>x.id===c.sourceId&&x.personId===p.id);if(v){if(v.voidedAt||v.supersededBy)fail(409,'This visit was corrected or marked as wrong-patient. Link the current visit.');src={refId:v.id,visitId:v.id,sourceAt:v.confirmedAt??v.createdAt,label:'visit'};}}
 else if(c.kind==='protocol-evaluation'){for(const v of w.visits)if(v.personId===p.id){const k=v.protocolChecks?.find(x=>x.id===c.sourceId);if(k){if(v.voidedAt||v.supersededBy)fail(409,'This evaluation belongs to a corrected or voided visit.');src={refId:k.id,visitId:v.id,sourceAt:k.at,label:'protocol evaluation'};break;}}}
 else{const e=p.enrolments?.find(x=>x.id===c.sourceId);if(e)src={refId:e.id,sourceAt:e.createdAt,label:'programme episode "'+e.episodeLabel+'"'};}
 if(!src)fail(422,'The source must be a record of the same patient.');
 if(c.kind==='visit'&&src!.refId===r.visitId)fail(409,'This visit is already the referral\'s first source.');
 if((r.sources??[]).some(x=>x.kind===c.kind&&x.refId===src!.refId))fail(409,'This source is already linked.');
 if((r.sources??[]).length>=MAX_SOURCES)fail(422,'A referral can have at most 20 linked sources.');
 (r.sources??=[]).push({id:uuid(),kind:c.kind,refId:src!.refId,...(src!.visitId?{visitId:src!.visitId}:{}),sourceAt:src!.sourceAt,linkedAt:now,by:u.userId,note:c.note});r.version=(r.version??1)+1;
 w.audit.push({id:uuid(),at:now,actorId:u.userId,actor:u.displayName,role:m.role,action:c.type,subject:p.id,personId:p.id,detail:`Referral to ${r.facility} linked to ${src!.label} ${src!.refId} (${src!.sourceAt.slice(0,10)}). ${c.note}`});
 return {referralId:r.id,sources:1+r.sources.length};
}
export function applyReferral(s:OrgState,input:unknown,u:Actor,m:Member,now=new Date().toISOString()):any|null{
 const parsed=referralSchema.safeParse(input);if(!parsed.success)return null;const c=parsed.data,w=s.workspace;
 const r=w.referrals.find(x=>x.id===c.referralId);if(!r)fail(404,'Referral not found.');const p=person(w,r.personId);
 if(c.type==='linkReferralSource')return linkSource(s,c,r,p,u,m,now);
 if(r.ownerId!==u.userId&&!steward(s,m,p))fail(403,'Only the referral owner or a supervisor or owner of the patient\'s team can change its due date.');
 if((r.version??1)!==c.version)fail(409,'Referral changed. Refresh before continuing.');
 if(TERMINAL.has(r.state))fail(409,'This referral is closed.');if(!r.due)fail(409,'Assign an owner and due date first.');
 const today=now.slice(0,10);if(c.due<=r.due||c.due<today)fail(422,'Choose a later due date, not in the past.');
 if(Date.parse(c.due)>Date.parse(today)+180*86400000)fail(422,'A delay can move the due date at most 180 days ahead.');
 (r.delays??=[]).push({id:uuid(),at:now,by:u.userId,from:r.due,to:c.due,constraint:c.constraint,reason:c.reason});if(r.delays.length>50)fail(422,'Too many delays recorded; review this referral with the team.');
 const from=r.due;r.due=c.due;r.version=(r.version??1)+1;
 w.audit.push({id:uuid(),at:now,actorId:u.userId,actor:u.displayName,role:m.role,action:c.type,subject:p.id,personId:p.id,detail:`Referral to ${r.facility} delayed from ${from} to ${c.due} (${c.constraint}). ${c.reason}`});
 return {due:c.due};
}
// Stewards see every open referral in scope needing attention; care workers see the ones they own.
export function escalationQueue(s:OrgState,m:Member,now=new Date().toISOString()){
 if(m.role==='admin')fail(403,'Referral escalations contain patient information.');
 const rank={escalated:0,watch:1,none:2},urg={emergency:0,urgent:1,routine:2};
 const items=s.workspace.referrals.flatMap(r=>{const p=s.workspace.people.find(x=>x.id===r.personId);if(!p?.assigned||planItemWaiting(s,p,{kind:'referral',id:r.id}))return [];const mine=r.ownerId===m.userId,lead=steward(s,m,p);if(!mine&&!lead)return [];
  const e=escalation(r as any,activeOwner(s,r,p),now);if(e.level==='none')return [];
  return [{referralId:r.id,version:r.version??1,personId:p.id,name:p.name,facility:r.facility,state:r.state,urgency:r.urgency??'routine',due:r.due??null,owner:s.members.find(x=>x.userId===r.ownerId)?.displayName??null,mine,...e}];
 }).sort((a,b)=>rank[a.level]-rank[b.level]||urg[a.urgency]-urg[b.urgency]||b.daysOverdue-a.daysOverdue);
 return {items:items.slice(0,200),escalated:items.filter(i=>i.level==='escalated').length,rules:'Escalated: no active owner; overdue beyond 0 days (emergency), 1 day (urgent) or 7 days (routine); outcome unknown or appointment missed for 2 days; emergency referral not yet accepted. A dependent referral waits without escalation while its recorded blocker remains open. These are local defaults, not an approved urgency policy.'};
}
