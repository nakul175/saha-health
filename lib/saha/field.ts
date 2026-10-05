import { rangeCaptureFor, rangeContextProblem } from './fact-provenance';
import { installedPacks, offlineWorkFor, packAt } from './programmes';
import { z } from 'zod';
import { withinPolicy } from './access';
import { apply, digest, factsSchema, programmeRecord, fail, person, uuid, visit } from './core';
import { programmeApply } from './programme-commands';
import { ABSENCE } from './programmes';
import type { OrgState, Member } from './types';
import { NEXT, REFERRAL_EVENTS, TERMINAL, URGENCIES } from './referral-rules';
import type { Actor } from './store';
export type PreparedTask={taskId:string;title:string;due:string;episodeId:string;packId:string;packVersion:number;hash:string};
export async function preparedTask(state:OrgState,p:import('./types').Person,taskId:string):Promise<PreparedTask>{
 const t=p.followUps?.find(x=>x.id===taskId&&x.state==='open');const e=p.enrolments?.find(x=>x.id===t?.enrolmentId&&x.state==='active');const pack=e&&packAt(e.packId,e.packVersion,state);
 if(!t||!e||!pack||(p as any).installedWork?.some((x:any)=>x.id===taskId))fail(409,'Due work requires current online source review.');
 return {taskId:t!.id,title:t!.title,due:t!.due,episodeId:e!.id,packId:e!.packId,packVersion:e!.packVersion,hash:await digest({task:t,episode:{id:e!.id,state:e!.state,packId:e!.packId,packVersion:e!.packVersion},pack})};
}
export async function preparedTasksCurrent(state:OrgState,p:import('./types').Person,tasks:PreparedTask[]){for(const t of tasks)if(await digest(await preparedTask(state,p,t.taskId))!==await digest(t))fail(409,'Prepared due work changed. Review the original task online before syncing.');}
export type FieldLease={id:string;actorId:string;memberVersion:number;visitId:string;visitVersion:number;identityHash:string;consentVersion:number;expiresAt:string;status:'active'|'revoked'|'synced';packageHash:string;createdAt:string;offlineWorkHash?:string;preparedTasks?:PreparedTask[]};
const id=z.string().min(1).max(200),ver=z.number().int().positive(),note=z.string().trim().min(5).max(1000);
export const fieldSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('prepareFieldVisit'),personId:id,version:ver,workSelection:z.object({expectedActorId:id,planHash:z.string().regex(/^[0-9a-f]{64}$/)}).strict().optional()}).strict(),
 z.object({type:z.literal('revokeFieldLease'),personId:id,leaseId:id}).strict(),
 z.object({type:z.literal('syncFieldVisit'),personId:id,leaseId:id,packageHash:z.string().length(64),offlineWorkHash:z.string().regex(/^[0-9a-f]{64}$/).optional(),facts:factsSchema,answers:programmeRecord(z.string().max(500)),absence:programmeRecord(z.enum(ABSENCE))}).strict(),
 z.object({type:z.literal('assignReferral'),referralId:id,version:ver,ownerId:id,due:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(x=>!isNaN(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x),urgency:z.enum(URGENCIES).optional(),reason:note}).strict(),
 z.object({type:z.literal('recordReferralEvent'),referralId:id,version:ver,event:z.enum(REFERRAL_EVENTS as [string,...string[]]),appointmentAt:z.string().datetime().optional(),note,source:z.enum(['worker-observed','facility-reported','patient-reported']),evidenceReference:z.string().trim().min(3).max(200),occurredAt:z.string().datetime(),confirmed:z.literal(true)}).strict()
]);
export async function fieldIdentity(p:{name:string;age:number;sex:string;village:string;teamId:string;assignedTo:string|null}){return digest([p.name,p.age,p.sex,p.village,p.teamId,p.assignedTo]);}
export async function applyField(state:OrgState,input:unknown,u:Actor,m:Member,now=new Date().toISOString(),environment='synthetic',preparedTasks?:PreparedTask[]):Promise<any|null>{
 const parsed=fieldSchema.safeParse(input);if(!parsed.success)return null;const c=parsed.data,w=state.workspace;
 if(!['asha','clinician'].includes(m.role))fail(403,'A current care role is required.');
 let subject='',detail='',result:any={ok:true};
 if(c.type==='assignReferral'||c.type==='recordReferralEvent'){
  const r=w.referrals.find(x=>x.id===c.referralId);if(!r)fail(404,'Referral not found.');const p=person(w,r.personId),v=visit(w,r.visitId);subject=p.id;
  if(v.voidedAt||v.supersededBy)fail(409,'Review the corrected source visit before updating this referral.');
  if((r.version??1)!==c.version)fail(409,'Referral changed. Refresh before continuing.');
  if(TERMINAL.has(r.state))fail(409,`A ${r.state} referral is closed; its evidence is immutable.`);
  if(c.type==='assignReferral'){
   const owner=state.members.find(x=>x.userId===c.ownerId&&x.status==='active'&&['asha','clinician'].includes(x.role)&&x.teamIds.includes(p.teamId)&&(x.role!=='asha'||p.assignedTo===x.userId)&&withinPolicy(x,p));if(!owner)fail(422,'Choose a care worker with current patient access.');
   r.ownerId=owner.userId;r.due=c.due;if(c.urgency)r.urgency=c.urgency;detail=`Referral owner and due date recorded${c.urgency?`; urgency ${c.urgency}`:''}. `+c.reason;
  }else{
   if(!r.ownerId||!r.due)fail(409,'Assign an owner and due date first.');
   const owner=state.members.find(x=>x.userId===r.ownerId&&x.status==='active'&&x.teamIds.includes(p.teamId)&&['asha','clinician'].includes(x.role)&&(x.role!=='asha'||p.assignedTo===x.userId)&&withinPolicy(x,p));if(!owner)fail(409,'Reassign this referral to an active care worker.');
   if(r.ownerId!==u.userId&&!m.isOwner)fail(403,'Only the referral owner or organisation owner can record its outcome.');
   if(!(NEXT as any)[r.state]?.includes(c.event))fail(409,`A referral that is ${r.state} cannot move to ${c.event}. Record referral events in order.`);
   if(c.event==='scheduled'){if(!c.appointmentAt)fail(422,'Record the appointment time for a scheduled referral.');r.appointmentAt=new Date(c.appointmentAt).toISOString();}else if(c.appointmentAt)fail(422,'An appointment time applies only to a scheduled referral.');
   if(Date.parse(c.occurredAt)>Date.parse(now)+300000||Date.parse(c.occurredAt)<Math.floor(Date.parse(r.createdAt)/1000)*1000||Date.parse(c.occurredAt)<Math.floor(Date.parse(r.events?.at(-1)?.occurredAt??r.createdAt)/1000)*1000)fail(422,'Event time must follow the previous event and cannot be in the future.');
   r.events??=[];r.events.push({id:uuid(),state:c.event,note:c.note,source:c.source,evidenceReference:c.evidenceReference,occurredAt:c.occurredAt,recordedAt:now,actorId:u.userId});r.state=c.event as any;detail=`Referral ${c.event}${c.event==='scheduled'?` for ${r.appointmentAt}`:''}; ${c.source}; evidence recorded manually. No facility API verification or message sent.`;
  }
  r.version=(r.version??1)+1;
 }else{
  const p=person(w,c.personId);subject=p.id;p.fieldLeases??=[];
  if(c.type==='prepareFieldVisit'){
   if(p.version!==c.version)fail(409,'Patient changed. Refresh before preparing field work.');
   if(preparedTasks){if(preparedTasks.length>10)fail(422,'Prepare at most ten declared tasks for one patient.');await preparedTasksCurrent(state,p,preparedTasks);}
   const started=await apply(w,{type:'startVisit',personId:p.id},u.userId,{call:async()=>fail(409,'External calls unavailable'),packs:installedPacks(state),rangeCapture:p=>rangeCaptureFor(state,p),rangeEnvironment:environment},now);const v=visit(w,started.visitId);if(v.valueRangeCapture?.mode==='population-demo'&&!['synthetic','training'].includes(environment))fail(409,'Demonstration value ranges require a synthetic or training environment.');const stale=rangeContextProblem(v,p);if(stale)fail(409,stale);
   // A new grant replaces this worker's active grant for this visit; old ciphertext is retained locally for review.
   for(const l of p.fieldLeases)if(l.actorId===u.userId&&l.visitId===v.id&&l.status==='active')l.status='revoked';
   p.fieldLeases=p.fieldLeases.filter(l=>l.expiresAt>now).slice(-19);
   const lease:FieldLease={id:uuid(),actorId:u.userId,memberVersion:m.version,visitId:v.id,visitVersion:v.version,identityHash:await fieldIdentity(p),consentVersion:p.consentVersion,expiresAt:new Date(Date.parse(now)+24*3600000).toISOString(),status:'active',packageHash:'',createdAt:now};
   let prepared;try{prepared=offlineWorkFor(v.programmeCapture)}catch{fail(422,'Prepared programme work exceeds the notebook limit.');}const offlineWork={...prepared!,hash:await digest(prepared!)};lease.offlineWorkHash=offlineWork.hash;if(preparedTasks)lease.preparedTasks=structuredClone(preparedTasks);
   const payload={schema:1,...(preparedTasks?{preparedWork:{format:'saha-prepared-due-work-v1',tasks:structuredClone(preparedTasks),notice:'Documentary capture only; task completion and clinical decisions require online review.'}}:{}),offlineWork,leaseId:lease.id,userId:u.userId,organisationId:state.organisation.id,personId:p.id,personName:p.name,identityHash:lease.identityHash,visitId:v.id,visitVersion:v.version,expiresAt:lease.expiresAt,issuedAt:now,facts:v.facts,programmeCapture:v.programmeCapture??null,...(v.valueRangeCapture?{valueRangeCapture:v.valueRangeCapture}:{})};
   const keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
   const bytes=new TextEncoder().encode(JSON.stringify(payload));const signature=Array.from(new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},keys.privateKey,bytes)));
   const packet={payload,signature,publicKey:await crypto.subtle.exportKey('jwk',keys.publicKey)};lease.packageHash=await digest(packet);p.fieldLeases.push(lease);
   result={packet,packageHash:lease.packageHash};detail='Signed 24-hour field grant issued for one patient and draft; prepared documentary task/guidance v1 hash '+offlineWork.hash+'; clinical approval pending; no offline confirmation or external delivery.';
  }else{
   const l=p.fieldLeases.find(x=>x.id===c.leaseId);if(!l)fail(404,'Field grant not found.');
   if(l.actorId!==u.userId&&!m.isOwner)fail(403,'This field grant belongs to another worker.');
   if(c.type==='revokeFieldLease'){if(l.status!=='active')fail(409,'Grant is no longer active.');l.status='revoked';detail='Field grant revoked. Offline copies cannot be remotely erased.';}
   else{
    if(l.actorId!==u.userId||l.memberVersion!==m.version)fail(403,'The worker or membership changed. Prepare a new field grant.');
    if(l.status!=='active'||l.expiresAt<=now)fail(409,'Field grant expired, revoked or already synced. Reconcile before continuing.');
    if(l.packageHash!==c.packageHash||l.identityHash!==await fieldIdentity(p)||l.consentVersion!==p.consentVersion)fail(409,'Identity, assignment or permission changed. Review this record online.');
    if(l.preparedTasks)await preparedTasksCurrent(state,p,l.preparedTasks);
    const v=visit(w,l.visitId);if(v.version!==l.visitVersion||v.state!=='draft'||v.voidedAt||v.supersededBy)fail(409,'The server visit changed. Compare both versions before syncing.');
    if(l.offlineWorkHash){if(c.offlineWorkHash!==undefined&&c.offlineWorkHash!==l.offlineWorkHash)fail(409,'Prepared task descriptor changed. Reconcile this grant online.');let currentHash:string;try{currentHash=await digest(offlineWorkFor(v.programmeCapture))}catch{fail(409,'Prepared programme guidance is unavailable. Reconcile online.');}if(currentHash!==l.offlineWorkHash)fail(409,'Prepared programme guidance changed. Reconcile this grant online.');for(const item of v.programmeCapture?.packs??[]){if(!p.enrolments?.some(e=>e.id===item.enrolmentId&&e.state==='active'&&e.packId===item.pack.id&&e.packVersion===item.pack.version))fail(409,'Prepared programme episode changed or closed. Review online.');}}
    await apply(w,{type:'saveVisit',visitId:v.id,version:v.version,facts:c.facts},u.userId,{call:async()=>fail(409,'External calls unavailable'),rangeEnvironment:environment},now);
    if(v.programmeCapture?.packs.length)programmeApply(state,{type:'saveProgrammeAnswers',visitId:v.id,version:v.version,answers:c.answers,absence:c.absence},u,m);
    else if(Object.keys(c.answers).length||Object.keys(c.absence).length)fail(422,'This visit has no programme questions.');
    l.status='synced';v.fieldSync={leaseId:l.id,at:now};result={visitId:v.id,version:v.version,leaseId:l.id};detail='Encrypted field draft synced as an unconfirmed visit. Current access, identity, grant and visit version checked.'+(l.offlineWorkHash?' Prepared documentary task/guidance hash '+l.offlineWorkHash+' and active episode versions checked.':'');
   }
  }
 }
 w.audit.push({id:uuid(),at:now,actor:u.displayName,actorId:u.userId,role:m.role,action:c.type,subject,personId:subject,detail});return result;
}
