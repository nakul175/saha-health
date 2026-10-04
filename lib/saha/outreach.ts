import { z } from 'zod';
import { consentStanding, digest, fail, lapseMessage, person, uuid } from './core';
import { allowed, normallyAllowed } from './access';
import { operator } from './operations';
import { contactWithdrawalItems, recordConsent, recordTerms } from './consent';
import type { Actor } from './store';
import type { Member, OrgState, Person } from './types';

export const MESSAGE_COPY={
 en:'This is a reminder to get in touch using the contact details already provided to you. Do not reply with personal information.',
 hi:'यह संपर्क करने का एक अनुस्मारक है। कृपया पहले से दिए गए संपर्क विवरण का उपयोग करें। उत्तर में व्यक्तिगत जानकारी न भेजें।',
} as const;
export type ContactPreferences={version:number;method:'none'|'in_person'|'sms';destination:string;ownership:'personal'|'shared'|'unknown';language:'en'|'hi';timezone:string;from:string;to:string;permission:boolean;privateContact:boolean;reference:string;updatedAt:string;by:string};
export type OutreachItem={id:string;personId:string;ownerId:string;reason:string;state:'planned'|'attempted'|'completed'|'cancelled';events:{at:string;by:string;state:string;note:string;reference:string;visitId?:string}[]};
export type OutreachPlan={id:string;version:number;title:string;date:string;teamId:string;criteria:string;createdAt:string;createdBy:string;state:'draft'|'scheduled'|'completed'|'cancelled';items:OutreachItem[];history:{at:string;by:string;state:string;reason:string}[]};
export type MessageTemplate={id:string;version:number;language:'en'|'hi';body:string;state:'review'|'approved'|'suspended';createdBy:string;createdAt:string;reviewedBy?:string;reviewerVersion?:number;reference?:string;reason?:string};
export type OutreachMessage={id:string;version:number;planId:string;itemId:string;personId:string;templateId:string;templateVersion:number;body:string;scheduledAt:string;createdAt:string;createdBy:string;authorVersion:number;state:'draft'|'approved'|'simulated'|'failed'|'cancelled';approval?:{by:string;memberVersion:number;at:string;hash:string};attempts:{at:string;by:string;result:'simulated'|'failed';receipt:string}[];recovery?:{ownerId:string;state:'open'|'resolved';resolution?:string;reference?:string;at?:string};cancelReason?:string};
export type Outreach={plans:OutreachPlan[];templates:MessageTemplate[];messages:OutreachMessage[]};
export const defaultOutreach=():Outreach=>({plans:[],templates:[],messages:[]});
const id=z.string().trim().min(1).max(200),version=z.number().int().positive(),note=z.string().trim().min(10).max(500),reference=z.string().trim().min(3).max(200);
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>!isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s,'Use a valid date.');
const time=z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const contactSchema=z.object({method:z.enum(['none','in_person','sms']),destination:z.string().trim().max(50).regex(/^(TEST-[A-Z0-9-]{3,30})?$/,'Only a synthetic TEST- contact identifier is accepted.'),ownership:z.enum(['personal','shared','unknown']),language:z.enum(['en','hi']),timezone:z.string().max(80).refine(s=>{try{new Intl.DateTimeFormat('en',{timeZone:s});return !!s}catch{return false}},'Use a valid IANA time zone.'),from:time,to:time,permission:z.boolean(),privateContact:z.boolean(),reference}).strict();
export const outreachSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('setContactPreferences'),personId:id,version,preferences:contactSchema}).strict(),
 z.object({type:z.literal('outreachCreate'),title:z.string().trim().min(3).max(100),date,teamId:id,ownerId:id,personIds:z.array(id).min(1).max(30).refine(x=>new Set(x).size===x.length),criteria:note}).strict(),
 z.object({type:z.literal('outreachTransition'),planId:id,version,state:z.enum(['scheduled','completed','cancelled']),reason:note}).strict(),
 z.object({type:z.literal('outreachRecord'),planId:id,itemId:id,version,state:z.enum(['attempted','completed','cancelled']),note,reference,visitId:id.optional()}).strict(),
 z.object({type:z.literal('outreachAssign'),planId:id,itemId:id,version,ownerId:id,reason:note}).strict(),
 z.object({type:z.literal('messageTemplatePropose'),language:z.enum(['en','hi'])}).strict(),
 z.object({type:z.literal('messageTemplateReview'),templateId:id,version,state:z.enum(['approved','suspended']),reference,reason:note}).strict(),
 z.object({type:z.literal('messageCreate'),planId:id,itemId:id,templateId:id,scheduledAt:z.string().datetime()}).strict(),
 z.object({type:z.literal('messageApprove'),messageId:id,version,hash:z.string().length(64)}).strict(),
 z.object({type:z.literal('messageSimulate'),messageId:id,version,outcome:z.enum(['simulated','failed'])}).strict(),
 z.object({type:z.literal('messageRetry'),messageId:id,version,scheduledAt:z.string().datetime(),reason:note}).strict(),
 z.object({type:z.literal('messageCancel'),messageId:id,version,reason:note}).strict(),
 z.object({type:z.literal('messageResolve'),messageId:id,version,note,reference}).strict(),
]);
function care(m:Member){if(!['asha','clinician','supervisor'].includes(m.role))fail(403,'Care-team access is required.');}
function member(s:OrgState,userId:string){return s.members.find(m=>m.userId===userId&&m.status==='active');}
function owner(s:OrgState,p:Person,userId:string){const m=member(s,userId);if(!m||!['asha','clinician'].includes(m.role)||!normallyAllowed(m,p))fail(422,'Choose an active care worker with access to every selected patient.');return m;}
function current(n:number,expected:number){if(n!==expected)fail(409,'This outreach record changed. Refresh and review before retrying.');}
function planFor(s:OrgState,id:string){const p=s.outreach?.plans.find(p=>p.id===id);if(!p)fail(404,'Outreach plan not found.');return p;}
function messageFor(s:OrgState,id:string){const v=s.outreach?.messages.find(v=>v.id===id);if(!v)fail(404,'Message not found.');return v;}
function templateFor(s:OrgState,id:string){const t=s.outreach?.templates.find(t=>t.id===id);if(!t)fail(404,'Template not found.');return t;}
function scheduled(s:string,now:string){const at=Date.parse(s);if(at<Date.parse(now)-300000||at>Date.parse(now)+30*86400000)fail(422,'Schedule within the next 30 days.');}
export function inContactWindow(p:ContactPreferences,at:string){const parts=new Intl.DateTimeFormat('en-GB',{timeZone:p.timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(at)),clock=parts.find(x=>x.type==='hour')!.value+':'+parts.find(x=>x.type==='minute')!.value;return clock>=p.from&&clock<p.to;}
// Slice 14d: `now` decides whether the contact permission is still in force (it expires; see core.ts consentStanding).
function safeContact(p:Person,at:string,now:string){const c=p.contactPreferences;if(!c||c.method!=='sms'||!c.permission||c.ownership!=='personal'||c.privateContact||!c.destination)fail(409,'Automated contact is not permitted. Use the agreed private or in-person contact route.');const standing=consentStanding(p,'contact',now);if(standing.state!=='in-force')fail(409,lapseMessage(standing)??'Automated contact is not permitted. Use the agreed private or in-person contact route.');if(!inContactWindow(c,at))fail(409,'The message is outside the permitted local contact hours.');return c;}
function approvedTemplate(s:OrgState,id:string){const t=templateFor(s,id),reviewer=t.reviewedBy?member(s,t.reviewedBy):undefined;if(t.state!=='approved'||!reviewer||!operator(reviewer)||reviewer.version!==t.reviewerVersion)fail(409,'The neutral template needs current independent operations approval.');return t;}
export function outreachEvidenceCurrent(s:OrgState,i:OutreachItem){const event=i.events.filter(e=>e.state==='completed').at(-1);return i.state!=='completed'||!!s.workspace.visits.find(v=>v.id===event?.visitId&&v.personId===i.personId&&v.state==='confirmed'&&!v.voidedAt&&!v.supersededBy);}
export function authorizeOutreach(s:OrgState,m:Member,c:any){
 if(c.type.startsWith('messageTemplate')){if(!operator(m))fail(403,'Operations access required for message templates.');return;}
 if(!['setContactPreferences'].includes(c.type)&&!c.type.startsWith('outreach')&&!c.type.startsWith('message'))return;
 care(m);
 if(c.type==='outreachCreate')for(const id of c.personIds)person(s.workspace,id);
 if(c.personId)person(s.workspace,c.personId);
 if(c.messageId)person(s.workspace,messageFor(s,c.messageId).personId);
 if(c.planId){const p=planFor(s,c.planId);if(c.itemId){const i=p.items.find(i=>i.id===c.itemId);if(!i)fail(404,'Outreach item not found.');person(s.workspace,i.personId);}else for(const i of p.items)person(s.workspace,i.personId);}
 if(c.type==='messageApprove'&&!['clinician','supervisor'].includes(m.role))fail(403,'A clinician or supervisor must review the message.');
 if(c.type==='setContactPreferences'&&m.role==='supervisor'&&c.preferences.permission)fail(403,'A care worker must record a new contact permission.');
}
export async function messageReview(s:OrgState,v:OutreachMessage,now=new Date().toISOString()){
 const p=s.workspace.people.find(p=>p.id===v.personId);if(!p)fail(404,'Patient unavailable.');const plan=planFor(s,v.planId),item=plan.items.find(i=>i.id===v.itemId);if(!item||['cancelled','completed'].includes(item.state)||plan.state!=='scheduled')fail(409,'An active scheduled outreach item is required.');
 const author=member(s,v.createdBy);if(!author||author.version!==v.authorVersion||!allowed(author,p))fail(409,'The message author no longer has the same patient access. Prepare a new message.');
 owner(s,p,item.ownerId);const t=approvedTemplate(s,v.templateId),contact=safeContact(p,v.scheduledAt,now);if(t.version!==v.templateVersion||t.body!==v.body||t.language!==contact.language)fail(409,'Template or contact language changed. Cancel and prepare a new message.');
 return {hash:await digest({id:v.id,identity:{name:p.name,age:p.age,sex:p.sex,village:p.village,teamId:p.teamId,assignedTo:p.assignedTo},contact,template:t,authorVersion:author.version,planVersion:plan.version,item,scheduledAt:v.scheduledAt}),destination:contact.destination,language:t.language,body:t.body,now};
}
export async function applyOutreach(s:OrgState,input:unknown,u:Actor,m:Member,now=new Date().toISOString()):Promise<any|null>{
 const parsed=outreachSchema.safeParse(input);if(!parsed.success)return null;const c=parsed.data;authorizeOutreach(s,m,c);const out=s.outreach??=defaultOutreach();let result:any={ok:true},personId:string|undefined;
 if(c.type==='setContactPreferences'){
  const p=person(s.workspace,c.personId);personId=p.id;current(p.version,c.version);if(c.preferences.from>=c.preferences.to)fail(422,'Contact hours must start before they end on the same local day.');if(c.preferences.method==='sms'&&!c.preferences.destination)fail(422,'Enter a synthetic contact identifier.');
  const was=!!p.contactPreferences?.permission,from=p.contactPreferences?.version??0;
  // Slice 14d: a permission that is still on but has expired is renewed by saving the preferences with permission.
  const lapsed=was&&c.preferences.permission&&consentStanding(p,'contact',now).state!=='in-force';
  p.contactPreferences={...c.preferences,version:from+1,updatedAt:now,by:u.userId};p.version++;
  // Slice 6o: a permission change is recorded in the patient's consent history with what it stopped.
  // Slice 14d: a permission given (or renewed) records its expiry (consent.ts recordTerms).
  if(was!==c.preferences.permission||lapsed){const give=c.preferences.permission,items=give?[]:contactWithdrawalItems(s,p,now,'Contact permission withdrawn.');const e=recordConsent(p,{purpose:'contact',action:give?'granted':'withdrawn',at:now,by:u.userId,byName:u.displayName,role:m.role,channel:'contact-preferences',reference:c.preferences.reference,reason:give?'':'Recorded with contact preferences.',fromVersion:from,toVersion:from+1,items});if(give)recordTerms(s,p,e,undefined,u,m,now);}
  // Revocation and preference changes cancel pending work, never silently re-address it.
  for(const v of out.messages.filter(v=>v.personId===p.id&&['draft','approved','failed'].includes(v.state))){v.state='cancelled';v.cancelReason='Contact preferences changed; review before preparing new work.';v.version++;}
 }else if(c.type==='outreachCreate'){
  if(out.plans.length>=100)fail(422,'Outreach plan limit reached.');if(!m.teamIds.includes(c.teamId))fail(403,'Choose your care team.');if(c.date<now.slice(0,10)||Date.parse(c.date)>Date.parse(now)+90*86400000)fail(422,'Choose a date within the next 90 days.');
  const items=c.personIds.map(id=>{const p=person(s.workspace,id);if(p.teamId!==c.teamId)fail(422,'Every patient must belong to the selected team.');owner(s,p,c.ownerId);if(out.plans.some(plan=>!['cancelled','completed'].includes(plan.state)&&plan.date===c.date&&plan.items.some(i=>i.personId===id&&!['cancelled','completed'].includes(i.state))))fail(409,'An active outreach item already exists for this patient and date.');return {id:uuid(),personId:p.id,ownerId:c.ownerId,reason:c.criteria,state:'planned' as const,events:[]};});
  const plan:OutreachPlan={id:uuid(),version:1,title:c.title,date:c.date,teamId:c.teamId,criteria:c.criteria,createdAt:now,createdBy:u.userId,state:'draft',items,history:[{at:now,by:u.userId,state:'draft',reason:c.criteria}]};out.plans.push(plan);result={planId:plan.id};
 }else if(c.type==='outreachTransition'){
  const p=planFor(s,c.planId);current(p.version,c.version);if(p.createdBy!==m.userId&&!m.isOwner&&m.role!=='supervisor')fail(403,'Only the planner, owner or supervisor can change this plan.');if(['completed','cancelled'].includes(p.state))fail(409,'Closed outreach plans are immutable.');
  if(c.state==='scheduled'){if(p.state!=='draft')fail(409,'Only a draft can be scheduled.');for(const i of p.items)owner(s,person(s.workspace,i.personId),i.ownerId);}
  if(c.state==='completed'&&(p.state!=='scheduled'||p.items.some(i=>!['completed','cancelled'].includes(i.state)||!outreachEvidenceCurrent(s,i))))fail(409,'Resolve every outreach item and changed visit evidence before closing the plan.');
  if(c.state==='cancelled'){for(const i of p.items.filter(i=>!['completed','cancelled'].includes(i.state))){i.state='cancelled';i.events.push({at:now,by:u.userId,state:'cancelled',note:c.reason,reference:'Plan cancellation'});}for(const v of out.messages.filter(v=>v.planId===p.id&&['draft','approved','failed'].includes(v.state))){v.state='cancelled';v.cancelReason=c.reason;v.version++;}}
  p.state=c.state;p.version++;p.history.push({at:now,by:u.userId,state:c.state,reason:c.reason});
 }else if(c.type==='outreachAssign'){
  const p=planFor(s,c.planId),i=p.items.find(i=>i.id===c.itemId)!;personId=i.personId;current(p.version,c.version);if(['completed','cancelled'].includes(p.state)||['completed','cancelled'].includes(i.state))fail(409,'Only unresolved outreach can be reassigned.');if(i.events.length>=20)fail(422,'Outreach event limit reached.');if(!m.isOwner&&m.role!=='supervisor'&&p.createdBy!==m.userId)fail(403,'A planner, owner or scoped supervisor must reassign outreach.');owner(s,person(s.workspace,i.personId),c.ownerId);i.ownerId=c.ownerId;i.events.push({at:now,by:u.userId,state:'assigned',note:c.reason,reference:'Assignment change'});p.version++;for(const v of out.messages.filter(v=>v.itemId===i.id&&v.recovery?.state==='open')){v.recovery!.ownerId=c.ownerId;v.version++;}
 }else if(c.type==='outreachRecord'){
  const p=planFor(s,c.planId),i=p.items.find(i=>i.id===c.itemId)!;personId=i.personId;current(p.version,c.version);const reopen=i.state==='completed'&&!outreachEvidenceCurrent(s,i)&&c.state==='attempted'&&p.state!=='cancelled';if(!reopen&&(p.state!=='scheduled'||['completed','cancelled'].includes(i.state)))fail(409,'Choose an unresolved item in a scheduled plan.');if(i.ownerId!==m.userId&&!m.isOwner&&m.role!=='supervisor')fail(403,'The assignee or scoped supervisor must record this outcome.');if(!reopen)owner(s,person(s.workspace,i.personId),i.ownerId);if(i.events.length>=20)fail(422,'Outreach event limit reached.');if(reopen){p.state='scheduled';p.history.push({at:now,by:u.userId,state:'scheduled',reason:'Reopened after linked visit evidence changed: '+c.note});}
  if(c.state==='completed'){const v=s.workspace.visits.find(v=>v.id===c.visitId&&v.personId===i.personId);if(!v||v.state!=='confirmed'||v.voidedAt||v.supersededBy||v.createdAt<p.createdAt)fail(422,'Link a current confirmed visit created for this outreach period.');}
  else if(c.visitId)fail(422,'Only a completed visit outcome can link a visit.');
  i.state=c.state;i.events.push({at:now,by:u.userId,state:c.state,note:c.note,reference:c.reference,...(c.visitId?{visitId:c.visitId}:{})});p.version++;
  if(c.state!=='attempted')for(const v of out.messages.filter(v=>v.itemId===i.id&&['draft','approved','failed'].includes(v.state))){v.state='cancelled';v.cancelReason='Outreach item closed.';v.version++;}
 }else if(c.type==='messageTemplatePropose'){
  if(out.templates.some(t=>t.language===c.language))fail(409,'A template for this language already exists; review or suspend it.');const t:MessageTemplate={id:uuid(),version:1,language:c.language,body:MESSAGE_COPY[c.language],state:'review',createdBy:u.userId,createdAt:now};out.templates.push(t);result={templateId:t.id};
 }else if(c.type==='messageTemplateReview'){
  const t=templateFor(s,c.templateId);current(t.version,c.version);if(c.state==='approved'&&t.createdBy===u.userId)fail(403,'A different operations member must approve the template.');t.state=c.state;t.reference=c.reference;t.reason=c.reason;t.reviewedBy=u.userId;t.reviewerVersion=m.version;t.version++;
 }else if(c.type==='messageCreate'){
  const p=planFor(s,c.planId),i=p.items.find(i=>i.id===c.itemId)!;personId=i.personId;if(out.messages.length>=500)fail(422,'Message history limit reached.');scheduled(c.scheduledAt,now);const t=approvedTemplate(s,c.templateId);
  if(out.messages.some(v=>v.personId===i.personId&&v.scheduledAt.slice(0,10)===c.scheduledAt.slice(0,10)&&v.state!=='cancelled'))fail(409,'A message already exists for this patient and UTC day. Inspect its receipt or retry the failed record.');
  const v:OutreachMessage={id:uuid(),version:1,planId:p.id,itemId:i.id,personId:i.personId,templateId:t.id,templateVersion:t.version,body:t.body,scheduledAt:c.scheduledAt,createdAt:now,createdBy:u.userId,authorVersion:m.version,state:'draft',attempts:[]};await messageReview(s,v,now);out.messages.push(v);result={messageId:v.id};
 }else{
  const v=messageFor(s,c.messageId);personId=v.personId;current(v.version,c.version);
  if(c.type==='messageApprove'){
   if(v.state!=='draft')fail(409,'Only a draft message can be approved.');if(v.createdBy===m.userId)fail(403,'A different clinician or supervisor must review the message.');const review=await messageReview(s,v,now);if(review.hash!==c.hash)fail(409,'Message context changed. Review the current preview.');v.approval={by:m.userId,memberVersion:m.version,at:now,hash:c.hash};v.state='approved';
  }else if(c.type==='messageSimulate'){
   if(v.state!=='approved')fail(409,'Approve the current message before simulation.');const review=await messageReview(s,v,now),approver=member(s,v.approval!.by),p=person(s.workspace,v.personId);
   if(!approver||!['clinician','supervisor'].includes(approver.role)||!allowed(approver,p)||approver.version!==v.approval!.memberVersion||review.hash!==v.approval!.hash||Date.parse(now)-Date.parse(v.approval!.at)>86400000)fail(409,'Message approval expired or access/context changed. Cancel and prepare a new message.');
   if(now<v.scheduledAt)fail(409,'This message is not due yet.');safeContact(p,now,now);if(v.attempts.length>=3)fail(409,'Retry limit reached. Resolve this through the outreach follow-up.');
   const receipt='SIM-MSG-'+uuid();v.attempts.push({at:now,by:u.userId,result:c.outcome,receipt});v.state=c.outcome;if(c.outcome==='failed')v.recovery={ownerId:planFor(s,v.planId).items.find(i=>i.id===v.itemId)!.ownerId,state:'open'};result={receipt,state:v.state,realMessageSent:false};
  }else if(c.type==='messageRetry'){
   if(v.state!=='failed'||v.attempts.length>=3)fail(409,'Only a failed message below the attempt limit can be retried.');scheduled(c.scheduledAt,now);if(out.messages.some(x=>x.id!==v.id&&x.personId===v.personId&&x.state!=='cancelled'&&x.scheduledAt.slice(0,10)===c.scheduledAt.slice(0,10)))fail(409,'Another message already occupies this UTC day.');v.scheduledAt=c.scheduledAt;v.state='draft';v.approval=undefined;await messageReview(s,v,now);
  }else if(c.type==='messageCancel'){
   if(!['draft','approved','failed'].includes(v.state))fail(409,'Only pending messages can be cancelled.');v.state='cancelled';v.cancelReason=c.reason;
  }else if(c.type==='messageResolve'){
   if(v.recovery?.state!=='open')fail(409,'No unresolved message follow-up exists.');if(m.userId!==v.recovery.ownerId&&!m.isOwner&&m.role!=='supervisor')fail(403,'The responsible worker or scoped supervisor must resolve this follow-up.');Object.assign(v.recovery,{state:'resolved',resolution:c.note,reference:c.reference,at:now});
  }
  v.version++;
 }
 s.workspace.audit.push({id:uuid(),at:now,actorId:u.userId,actor:u.displayName,role:m.role,action:c.type,subject:personId??s.organisation.id,personId,detail:c.type==='messageSimulate'?'Message simulator executed. No provider called, no patient contacted, no acknowledgement or care completion inferred.':`Outreach record updated: ${c.type}.`});return result;
}
