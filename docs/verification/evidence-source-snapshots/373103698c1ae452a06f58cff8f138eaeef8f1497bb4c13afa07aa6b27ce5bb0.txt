import { z } from 'zod';
import { withinPolicy } from './access';
import { fail, person, visit, uuid, programmeRecord } from './core';
import { ABSENCE, adoptedVersion, packAt, enrollableAt, own, questions } from './programmes';
import type { OrgState, Member } from './types';
import type { Actor } from './store';
const id=z.string().min(1).max(200),version=z.number().int().positive();
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(x=>!isNaN(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x,'Enter a valid date.');
export const programmeSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('enrolProgramme'),personId:id,version,packId:z.string().regex(/^[a-z][a-z0-9_]{1,31}$/),episodeLabel:z.string().trim().min(3).max(200),startDate:date.nullable()}),
 z.object({type:z.literal('closeEnrolment'),personId:id,version,enrolmentId:id,outcome:z.string().trim().min(5).max(500)}),
 z.object({type:z.literal('saveProgrammeAnswers'),visitId:id,version,answers:programmeRecord(z.string().trim().max(500)),absence:programmeRecord(z.enum(ABSENCE))}),
 z.object({type:z.literal('scheduleFollowUp'),personId:id,version,enrolmentId:id,title:z.string().trim().min(3).max(200),due:date,ownerId:id,completionRuleId:id.optional()}),
 z.object({type:z.literal('resolveFollowUp'),personId:id,version,taskId:id,state:z.enum(['completed','cancelled']),resolution:z.string().trim().min(5).max(500)})
]);
export function programmeApply(state:OrgState,input:unknown,u:Actor,m:Member):any|null{
 const parsed=programmeSchema.safeParse(input);if(!parsed.success)return null;const c=parsed.data,w=state.workspace,now=new Date().toISOString();
 if(!['asha','clinician'].includes(m.role))fail(403,'A care role is required for programme changes.');
 let subject='',detail='',result:any={ok:true};
 if(c.type==='saveProgrammeAnswers'){
  const v=visit(w,c.visitId);if(v.version!==c.version)fail(409,'The visit changed. Refresh before editing programme answers.');if(v.state!=='draft'||v.voidedAt||v.supersededBy)fail(409,'Programme answers require a current draft.');
  if(!v.programmeCapture?.packs.length)fail(422,'This visit has no programme packs. Enrol first, then start a new visit.');
  const candidate={...v.programmeCapture,answers:c.answers,absence:c.absence};const qs=questions(candidate);
  for(const [key,value] of Object.entries(c.answers)){const q=qs.find(q=>q.id===key&&!q.fact);if(!q||!q.options?.includes(value))fail(422,'An answer is invalid or belongs to an inactive question.');}
  for(const key of Object.keys(c.absence)){const q=qs.find(q=>q.id===key);if(!q)fail(422,'Absence reason belongs to an inactive question.');if((q.fact?v.facts[q.fact]:own(c.answers,key)))fail(422,'Remove the answer before recording an absence reason.');}
  v.programmeCapture={...candidate,savedBy:u.userId,savedAt:now};v.version++;subject=v.personId;detail='Programme answers and explicit absence reasons saved against pinned pack versions.';
 }else{
  const p=person(w,c.personId);if(p.version!==c.version)fail(409,'The patient changed. Refresh before editing programme work.');p.enrolments??=[];p.followUps??=[];subject=p.id;
  if(c.type==='enrolProgramme'){
   if(p.enrolments.some(e=>e.packId===c.packId&&e.state==='active'))fail(409,'This programme already has an active episode.');if(c.startDate&&c.startDate>now.slice(0,10))fail(422,'Episode start cannot be in the future.');
   // Slice 4f: episodes open only on a compiled or an activated installed version (the adopted one).
   const pack=enrollableAt(c.packId,adoptedVersion(state,c.packId),state);if(!pack)fail(422,'Choose an available programme pack.');const e={id:uuid(),packId:pack.id,packVersion:pack.version,state:'active' as const,episodeLabel:c.episodeLabel,startDate:c.startDate,createdAt:now,createdBy:u.userId,registration:'not_submitted' as const};p.enrolments.push(e);if(!p.programmes.includes(pack.programme))p.programmes.push(pack.programme);detail=`Local sandbox episode opened: ${pack.name} v${pack.version}. Official registration not submitted.`;result={enrolmentId:e.id};
  }else if(c.type==='closeEnrolment'){
   const e=p.enrolments.find(e=>e.id===c.enrolmentId);if(!e||e.state!=='active')fail(409,'Choose an active episode.');if(w.visits.some(v=>v.personId===p.id&&v.state==='draft'&&!v.voidedAt&&!v.supersededBy&&v.programmeCapture?.packs.some(x=>x.enrolmentId===e.id)))fail(409,'Finish the open programme visit before closing this episode.');e.state='closed';e.closedAt=now;e.outcome=c.outcome;
   for(const t of p.followUps.filter(t=>t.enrolmentId===e.id&&t.state==='open')){t.state='cancelled';t.closedAt=now;t.resolution='Episode closed: '+c.outcome;}detail='Episode closed; open follow-ups cancelled and history retained. '+c.outcome;
  }else if(c.type==='scheduleFollowUp'){
   const e=p.enrolments.find(e=>e.id===c.enrolmentId&&e.state==='active');if(!e)fail(409,'Follow-ups require an active episode.');const owner=state.members.find(x=>x.userId===c.ownerId&&x.status==='active'&&['asha','clinician'].includes(x.role)&&x.teamIds.includes(p.teamId)&&withinPolicy(x,p));if(!owner||(owner.role==='asha'&&p.assignedTo!==owner.userId))fail(422,'Choose a care worker with access to this patient.');if(p.followUps.some(t=>t.enrolmentId===e.id&&t.title===c.title&&t.due===c.due&&t.state==='open'))fail(409,'This follow-up is already open.');const pack=packAt(e.packId,e.packVersion,state),rule=c.completionRuleId?pack?.completionRules?.find(x=>x.id===c.completionRuleId):undefined;if(c.completionRuleId&&(!rule||!pack?.installed))fail(422,'Choose a completion rule from this pinned installed programme pack.');const t={id:uuid(),...(rule&&pack?.installed?{completionContract:{rule:structuredClone(rule),packId:pack.id,packVersion:pack.version,...pack.installed}}:{}),enrolmentId:e.id,packId:e.packId,title:c.title,due:c.due,ownerId:c.ownerId,state:'open' as const,createdAt:now,createdBy:u.userId};p.followUps.push(t);detail='Worker-reviewed follow-up scheduled: '+c.title;result={taskId:t.id};
  }else{
   const t=p.followUps.find(t=>t.id===c.taskId);if(!t||t.state!=='open')fail(409,'Choose an open follow-up.');t.state=c.state;t.resolution=c.resolution;t.closedAt=now;detail=`Follow-up ${c.state}: ${c.resolution}`;
  }
  p.version++;for(const v of w.visits.filter(v=>v.personId===p.id))if(v.plan&&v.plan.state!=='completed')v.plan.state='blocked';
 }
 w.audit.push({id:uuid(),at:now,actor:u.displayName,actorId:u.userId,role:m.role,action:c.type,subject,personId:subject,detail});return result;
}
