import { installedPacks } from './programmes';
import { z } from 'zod';
import { allowed, withinPolicy } from './access';
import { apply, digest, factsSchema, fail, person, uuid, visit } from './core';
import { programmeApply } from './programme-commands';
import { ABSENCE } from './programmes';
import type { OrgState, Member, Person } from './types';
import { NEXT, REFERRAL_EVENTS, TERMINAL, URGENCIES } from './referral-rules';
import type { Actor } from './store';
// Slice 14e (R73; BR-SEC-03, BR-OFF-07): when the copy a grant put on a worker's device is due for removal. It is due when
//   - the grant was revoked (`revokeFieldLease` stores the order on the grant),
//   - the worker no longer has access to the patient (care transferred, team or membership changed, emergency access over),
//   - the record was merged into another record, or
//   - processing is restricted under a rights request (slice 6b) and the grant can no longer sync (synced, revoked or
//     expired); an open, current grant may still sync first, because recording care continues under a restriction.
// The last three are computed from the current record on every read, so every transfer, merge, suspension and restriction
// path is covered without a stored order. `removal` also holds the notebook's receipt once it has removed the copy
// (lib/saha/field-device.ts). A device that never contacts Saha again keeps its encrypted copy; its grant stays pending.
export const REMOVAL_REASONS=['grant-revoked','access-ended','record-merged','processing-restricted'] as const;
export type RemovalReason=typeof REMOVAL_REASONS[number];
export type RemovalReceipt={id:string;at:string;drafts:number;unsynced:number;media:number;registrations:number;appVersion:string};
export type FieldRemoval={reason:RemovalReason;orderedAt?:string;orderedBy?:string;confirmedAt?:string;receipt?:RemovalReceipt;receipts?:number;lastReceiptAt?:string};
// Grants kept on the record only because their device copy is still awaiting removal (beyond the 20 current grants).
export const HELD_REMOVALS=50;
// The same test as rights.activeRestriction, kept here so this module needs no new dependency.
export const restrictedNow=(p:Person)=>(p.restrictions??[]).find(r=>!r.liftedAt);
export const mergedNow=(p:Person)=>!!p.mergedInto&&!p.mergedInto.unmergedAt;
export function removalDue(s:OrgState,p:Person,l:FieldLease,now:string):RemovalReason|null{
 if(l.removal?.orderedAt)return l.removal.reason;
 if(mergedNow(p))return 'record-merged';
 const m=s.members.find(x=>x.userId===l.actorId);if(!m||!allowed(m,p,now))return 'access-ended';
 if(restrictedNow(p)&&(l.status!=='active'||l.expiresAt<=now))return 'processing-restricted';
 return null;
}
export const pendingRemoval=(s:OrgState,p:Person,l:FieldLease,now:string)=>!l.removal?.confirmedAt&&removalDue(s,p,l,now)!==null;
export type FieldLease={id:string;actorId:string;memberVersion:number;visitId:string;visitVersion:number;identityHash:string;consentVersion:number;expiresAt:string;status:'active'|'revoked'|'synced';packageHash:string;createdAt:string;removal?:FieldRemoval};
const id=z.string().min(1).max(200),ver=z.number().int().positive(),note=z.string().trim().min(5).max(1000);
export const fieldSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('prepareFieldVisit'),personId:id,version:ver}).strict(),
 z.object({type:z.literal('revokeFieldLease'),personId:id,leaseId:id}).strict(),
 z.object({type:z.literal('syncFieldVisit'),personId:id,leaseId:id,packageHash:z.string().length(64),facts:factsSchema,answers:z.record(z.string(),z.string().max(500)),absence:z.record(z.string(),z.enum(ABSENCE))}).strict(),
 z.object({type:z.literal('assignReferral'),referralId:id,version:ver,ownerId:id,due:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(x=>!isNaN(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x),urgency:z.enum(URGENCIES).optional(),reason:note}).strict(),
 z.object({type:z.literal('recordReferralEvent'),referralId:id,version:ver,event:z.enum(REFERRAL_EVENTS as [string,...string[]]),appointmentAt:z.string().datetime().optional(),note,source:z.enum(['worker-observed','facility-reported','patient-reported']),evidenceReference:z.string().trim().min(3).max(200),occurredAt:z.string().datetime(),confirmed:z.literal(true)}).strict()
]);
export async function fieldIdentity(p:{name:string;age:number;sex:string;village:string;teamId:string;assignedTo:string|null}){return digest([p.name,p.age,p.sex,p.village,p.teamId,p.assignedTo]);}
export async function applyField(state:OrgState,input:unknown,u:Actor,m:Member,now=new Date().toISOString()):Promise<any|null>{
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
   // Slice 14e: while processing is restricted no new device copy is issued; recording care online continues.
   if(restrictedNow(p))fail(409,'Processing is restricted for this patient under a rights request, so no offline copy is issued to a device. Record the visit online.');
   const started=await apply(w,{type:'startVisit',personId:p.id},u.userId,{call:async()=>fail(409,'External calls unavailable'),packs:installedPacks(state)},now);const v=visit(w,started.visitId);
   // A new grant replaces this worker's active grant for this visit; old ciphertext is retained locally for review.
   for(const l of p.fieldLeases)if(l.actorId===u.userId&&l.visitId===v.id&&l.status==='active')l.status='revoked';
   // Slice 14e: an expired grant whose device copy is still awaiting removal stays on the record (at most HELD_REMOVALS), so
   // the order reaches the notebook and the pending removal stays visible.
   const live=p.fieldLeases.filter(l=>l.expiresAt>now).slice(-19),held=p.fieldLeases.filter(l=>!live.includes(l)&&pendingRemoval(state,p,l,now)).slice(-HELD_REMOVALS);
   p.fieldLeases=p.fieldLeases.filter(l=>live.includes(l)||held.includes(l));
   const lease:FieldLease={id:uuid(),actorId:u.userId,memberVersion:m.version,visitId:v.id,visitVersion:v.version,identityHash:await fieldIdentity(p),consentVersion:p.consentVersion,expiresAt:new Date(Date.parse(now)+24*3600000).toISOString(),status:'active',packageHash:'',createdAt:now};
   const payload={schema:1,leaseId:lease.id,userId:u.userId,organisationId:state.organisation.id,personId:p.id,personName:p.name,identityHash:lease.identityHash,visitId:v.id,visitVersion:v.version,expiresAt:lease.expiresAt,issuedAt:now,facts:v.facts,programmeCapture:v.programmeCapture??null};
   const keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
   const bytes=new TextEncoder().encode(JSON.stringify(payload));const signature=Array.from(new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},keys.privateKey,bytes)));
   const packet={payload,signature,publicKey:await crypto.subtle.exportKey('jwk',keys.publicKey)};lease.packageHash=await digest(packet);p.fieldLeases.push(lease);
   result={packet,packageHash:lease.packageHash};detail='Signed 24-hour field grant issued for one patient and draft; no offline confirmation or external delivery.';
  }else{
   const l=p.fieldLeases.find(x=>x.id===c.leaseId);if(!l)fail(404,'Field grant not found.');
   if(l.actorId!==u.userId&&!m.isOwner)fail(403,'This field grant belongs to another worker.');
   // Slice 14e: revoking orders the removal of the grant's copy from the worker's device; a grant that already ended (synced,
   // replaced or revoked by a handover) can still be given that order, for example for a lost device.
   if(c.type==='revokeFieldLease'){if(l.removal?.confirmedAt)fail(409,'A notebook already confirmed removing this grant\'s copy from the device.');if(l.removal?.orderedAt)fail(409,'Removal of this grant\'s device copy is already ordered.');const was=l.status;if(l.status==='active')l.status='revoked';l.removal={reason:'grant-revoked',orderedAt:now,orderedBy:u.userId};result={ok:true,removalOrdered:true};
    detail=`Field grant ${was==='active'?'revoked':`(already ${was}) given a removal order`}. The notebook removes this grant's copy from the device and confirms with a receipt when it next contacts Saha online; a device that never reconnects keeps its encrypted copy until the notebook is deleted on that device.`;}
   else{
    if(l.actorId!==u.userId||l.memberVersion!==m.version)fail(403,'The worker or membership changed. Prepare a new field grant.');
    if(l.status!=='active'||l.expiresAt<=now)fail(409,'Field grant expired, revoked or already synced. Reconcile before continuing.');
    if(l.packageHash!==c.packageHash||l.identityHash!==await fieldIdentity(p)||l.consentVersion!==p.consentVersion)fail(409,'Identity, assignment or permission changed. Review this record online.');
    const v=visit(w,l.visitId);if(v.version!==l.visitVersion||v.state!=='draft'||v.voidedAt||v.supersededBy)fail(409,'The server visit changed. Compare both versions before syncing.');
    await apply(w,{type:'saveVisit',visitId:v.id,version:v.version,facts:c.facts},u.userId,{call:async()=>fail(409,'External calls unavailable')},now);
    if(v.programmeCapture?.packs.length)programmeApply(state,{type:'saveProgrammeAnswers',visitId:v.id,version:v.version,answers:c.answers,absence:c.absence},u,m);
    else if(Object.keys(c.answers).length||Object.keys(c.absence).length)fail(422,'This visit has no programme questions.');
    l.status='synced';v.fieldSync={leaseId:l.id,at:now};result={visitId:v.id,version:v.version,leaseId:l.id};detail='Encrypted field draft synced as an unconfirmed visit. Current access, identity, grant and visit version checked.';
   }
  }
 }
 w.audit.push({id:uuid(),at:now,actor:u.displayName,actorId:u.userId,role:m.role,action:c.type,subject,personId:subject,detail});return result;
}
