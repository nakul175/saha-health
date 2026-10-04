import { z } from 'zod';
import { fail, person, uuid } from './core';
import type { Actor } from './store';
import type { Member, OrgState } from './types';

// Slice 6c: retention schedules, legal holds and a disposal-eligibility review (BR-SEC-09).
// The review counts records that a schedule would make eligible, so an organisation can check its policy against its data.
// Slice 14f: a rule may also allow disposal (`dispose`), for patient records and visit media only; disposal itself is a
// separate, two-owner step (lib/saha/disposal.ts, disposal-server.ts). Other classes are reviewed only and never deleted.
// Periods are set by owners and are engineering placeholders for synthetic testing, not an approved records schedule.
export const RECORD_CLASSES=['patient-record','programme-receipt','audit-event','outreach-message','rights-request','field-package','visit-media'] as const;
export type RecordClass=typeof RECORD_CLASSES[number];
export const DISPOSABLE_CLASSES=['patient-record','visit-media'] as const;
export type DisposableClass=typeof DISPOSABLE_CLASSES[number];
export const TRIGGER:Record<RecordClass,string>={'patient-record':'last activity on the patient (registration or visit)','programme-receipt':'last update of the submission','audit-event':'time of the event','outreach-message':'creation of the message','rights-request':'closure of the request','field-package':'creation of the field package','visit-media':'upload of the photo or voice note'};
export const PLACEHOLDER_NOTE='Periods are engineering placeholders set by an owner for synthetic testing, not an approved records schedule.';
export type RetentionRule={recordClass:RecordClass;years:number;dispose?:boolean};
export type RetentionPolicy={version:number;rules:RetentionRule[];basis:string;setBy:string;setAt:string};
export type Hold={id:string;scope:'organisation'|'person';personId?:string;reason:string;reference:string;placedBy:string;placedAt:string;released?:{by:string;at:string;reason:string}};
// Slice 14f: one disposal plan (dry run) and its outcome. `items` (identifiers only) is kept while the plan waits for a second
// owner, then dropped: the disposal register (table disposals) holds every disposed record.
export type DisposalItem={recordClass:DisposableClass;table:string;id:string;personId:string;teamId:string};
export type DisposalBatch={id:string;state:'prepared'|'applied'|'cancelled'|'expired';planHash:string;policyVersion:number;preparedBy:string;preparedAt:string;expiresAt:string;counts:Record<string,number>;excluded:{organisationHold:boolean;held:number;outsideAuthority:number;deferred:number;blocked:Record<string,number>;media:{held:number;outsideAuthority:number;deferred:number}};items?:DisposalItem[];approvedBy?:string;appliedAt?:string;register?:{first:number;last:number;head:string;entries:number;revisions:number};cancelled?:{by:string;at:string;reason:string}};
export type Retention={policies:RetentionPolicy[];holds:Hold[];disposals?:DisposalBatch[]};
const text=z.string().trim().min(10,'Write at least 10 characters.').max(1000),ref=z.string().trim().min(3).max(200),id=z.string().trim().min(1).max(200);
export const retentionSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('retentionPolicySet'),rules:z.array(z.object({recordClass:z.enum(RECORD_CLASSES),years:z.number().int().min(1).max(50),dispose:z.boolean().optional()}).strict()).min(1).max(RECORD_CLASSES.length).refine(r=>new Set(r.map(x=>x.recordClass)).size===r.length,'Set each record class once.').refine(r=>r.every(x=>!x.dispose||(DISPOSABLE_CLASSES as readonly string[]).includes(x.recordClass)),'Disposal can be allowed only for patient records and visit media in this release.'),basis:text}).strict(),
 z.object({type:z.literal('retentionHoldPlace'),scope:z.enum(['organisation','person']),personId:id.optional(),reason:text,reference:ref}).strict(),
 z.object({type:z.literal('retentionHoldRelease'),holdId:id,reason:text}).strict(),
]);
const TYPES=new Set(['retentionPolicySet','retentionHoldPlace','retentionHoldRelease']);
export function authorizeRetention(_s:OrgState,m:Member,c:any){if(TYPES.has(c?.type)&&!m.isOwner)fail(403,'Only an organisation owner can manage retention and holds.');}
export function applyRetention(s:OrgState,input:unknown,u:Actor,m:Member,now=new Date().toISOString()):any|null{
 const parsed=retentionSchema.safeParse(input);if(!parsed.success)return null;const c=parsed.data;authorizeRetention(s,m,c);
 const r=s.retention??={policies:[],holds:[]};let subject=s.organisation.id,personId:string|undefined,detail='',result:any={ok:true};
 if(c.type==='retentionPolicySet'){
  if(r.policies.length>=100)fail(422,'Retention policy history limit reached; an archival policy is required.');
  const p:RetentionPolicy={version:(r.policies.at(-1)?.version??0)+1,rules:[...c.rules].map(x=>x.dispose?x:{recordClass:x.recordClass,years:x.years}).sort((a,b)=>RECORD_CLASSES.indexOf(a.recordClass)-RECORD_CLASSES.indexOf(b.recordClass)),basis:c.basis,setBy:u.userId,setAt:now};
  const disposing=p.rules.filter(x=>x.dispose).map(x=>x.recordClass);
  r.policies.push(p);detail=`Retention schedule version ${p.version}: ${p.rules.map(x=>`${x.recordClass} ${x.years} years${x.dispose?' (disposal allowed)':''}`).join('; ')}. Basis: ${c.basis}. ${disposing.length?`Disposal is allowed for ${disposing.join(' and ')}, each disposal needing a plan prepared by one owner and applied by a second owner; other classes are reviewed only.`:'No class allows disposal. No records are deleted.'} ${PLACEHOLDER_NOTE}`;result={version:p.version};
 }
 else if(c.type==='retentionHoldPlace'){
  if(c.scope==='person'){if(!c.personId)fail(422,'Choose the patient to hold.');const p=person(s.workspace,c.personId);personId=p.id;if(r.holds.some(h=>!h.released&&h.scope==='person'&&h.personId===p.id))fail(409,'This patient already has a current hold.');}
  else {if(c.personId)fail(422,'An organisation hold does not name a patient.');if(r.holds.some(h=>!h.released&&h.scope==='organisation'))fail(409,'An organisation hold is already in place.');}
  if(r.holds.length>=500)fail(422,'Hold history limit reached; an archival policy is required.');
  const h:Hold={id:uuid(),scope:c.scope,...(personId?{personId}:{}),reason:c.reason,reference:c.reference,placedBy:u.userId,placedAt:now};r.holds.push(h);subject=h.id;
  detail=`${c.scope==='organisation'?'Organisation-wide':'Patient'} hold placed. Reference ${c.reference}. ${c.reason}`;result={holdId:h.id};
 }
 else {
  const h=r.holds.find(x=>x.id===c.holdId);if(!h)fail(404,'Hold not found.');if(h.released)fail(409,'This hold is already released.');
  if(h.personId){person(s.workspace,h.personId);personId=h.personId;}
  h.released={by:u.userId,at:now,reason:c.reason};subject=h.id;detail=`Hold released. ${c.reason}`;
 }
 s.workspace.audit.push({id:uuid(),at:now,actorId:u.userId,actor:u.displayName,role:m.role,action:c.type,subject,personId,detail});
 return result;
}
export const yearsAgo=(now:string,years:number)=>{const d=new Date(now);d.setUTCFullYear(d.getUTCFullYear()-years);return d.toISOString();};
// Counts only. Patient-linked classes exclude held patients; an organisation hold makes nothing eligible.
// Slice 14f: `disposed` names patients removed by a disposal (from the register), so a released hold on one is labelled as such.
export function retentionReview(s:OrgState,m:Member,audit:{total:number;pastSchedule:number},now=new Date().toISOString(),disposed:ReadonlySet<string>=new Set()){
 if(!m.isOwner)fail(403,'Only an organisation owner can review retention.');
 const r=s.retention??{policies:[],holds:[]},policy=r.policies.at(-1)??null,holds=r.holds.filter(h=>!h.released),orgHold=holds.some(h=>h.scope==='organisation'),held=new Set(holds.filter(h=>h.personId).map(h=>h.personId!));
 const w=s.workspace,last=new Map<string,string>();
 for(const p of w.people)last.set(p.id,p.createdAt);for(const v of w.visits){const t=[v.createdAt,v.confirmedAt].filter(Boolean).sort().at(-1)!;if(t>(last.get(v.personId)??''))last.set(v.personId,t);}
 const dated:Record<RecordClass,{personId?:string;at:string}[]>={
  'patient-record':w.people.map(p=>({personId:p.id,at:last.get(p.id)!})),
  'programme-receipt':w.submissions.map(x=>({personId:x.personId,at:x.updatedAt})),
  'audit-event':[],
  'outreach-message':(s.outreach?.messages??[]).map(x=>({personId:x.personId,at:x.createdAt})),
  'rights-request':(s.rightsRequests??[]).filter(x=>x.closed).map(x=>({personId:x.personId,at:x.closed!.at})),
  'field-package':w.people.flatMap(p=>(p.fieldLeases??[]).map(l=>({personId:p.id,at:l.createdAt}))),
  // Slice 14f: visit media stored on the server (not removed from a draft and not yet disposed), dated from its upload.
  'visit-media':w.visits.flatMap(v=>(v.media??[]).filter(x=>!x.removedAt).map(x=>({personId:v.personId,at:x.at}))),
 };
 const review=RECORD_CLASSES.map(recordClass=>{const rule=policy?.rules.find(x=>x.recordClass===recordClass);const cutoff=rule?yearsAgo(now,rule.years):null;
  const disposal=rule?.dispose?'dispose':'review only';
  if(recordClass==='audit-event'){const past=cutoff?audit.pastSchedule:0;return {recordClass,trigger:TRIGGER[recordClass],years:rule?.years??null,disposal,total:audit.total,pastSchedule:past,eligible:orgHold?0:past,held:orgHold?past:0};}
  const items=dated[recordClass],past=cutoff?items.filter(i=>i.at<cutoff):[],heldCount=orgHold?past.length:past.filter(i=>i.personId&&held.has(i.personId)).length;
  return {recordClass,trigger:TRIGGER[recordClass],years:rule?.years??null,disposal,total:items.length,pastSchedule:past.length,eligible:past.length-heldCount,held:heldCount};});
 const name=(id:string)=>s.members.find(x=>x.userId===id)?.displayName??'Former member';
 return {policy:policy?{...policy,setBy:name(policy.setBy)}:null,history:r.policies.map(p=>({version:p.version,setAt:p.setAt,setBy:name(p.setBy)})).reverse(),holds:r.holds.map(h=>{const p=h.personId?w.people.find(x=>x.id===h.personId&&x.assigned):undefined;
  // Slice 6u: a hold on a patient the viewer may not see shows only its id, scope, placement time and release time.
  // Slice 14f: the same for a (released) hold on a patient record since disposed.
  if(h.personId&&!p)return {id:h.id,scope:h.scope,placedAt:h.placedAt,...(h.released?{released:{at:h.released.at}}:{}),outsideScope:true,...(disposed.has(h.personId)?{disposedRecord:true,personName:'Disposed record'}:{personName:'Patient outside your scope'})};
  return {...h,placedBy:name(h.placedBy),personName:h.personId?p!.name:null};}).reverse(),holdsOutsideScope:r.holds.filter(h=>h.personId&&!disposed.has(h.personId)&&!w.people.some(x=>x.id===h.personId&&x.assigned)).length,review,classes:RECORD_CLASSES.map(c=>({recordClass:c,trigger:TRIGGER[c],disposable:(DISPOSABLE_CLASSES as readonly string[]).includes(c)})),
  disposal:disposalText(policy),disposals:batchView(s,m,r.disposals??[],now,name)};
}
function disposalText(policy:RetentionPolicy|null){
 const on=(policy?.rules??[]).filter(x=>x.dispose).map(x=>x.recordClass.replace(/-/g,' '));
 if(!on.length)return `Review only: no record class in the current schedule allows disposal, so Saha never deletes these records. ${PLACEHOLDER_NOTE}`;
 return `Disposal is allowed for ${on.join(' and ')}. One owner prepares a plan (identifiers and counts only) and a second owner applies exactly that plan; held records, records outside the care scope of either owner, records a rule keeps and records linked to open work or other records are never disposed. Disposed records leave a tombstone in the disposal register, which a restore re-applies. Other classes are reviewed only and never deleted. ${PLACEHOLDER_NOTE}`;
}
// Slice 14f: disposal plans, newest first. A waiting plan lists the identifiers of records in the viewer's own care scope only.
function batchView(s:OrgState,m:Member,batches:DisposalBatch[],now:string,name:(id:string)=>string){
 const visible=new Set(s.workspace.people.filter(p=>p.assigned).map(p=>p.id));
 return batches.map(b=>{const state=b.state==='prepared'&&b.expiresAt<=now?'expired':b.state;const items=state==='prepared'?(b.items??[]):[];
  return {id:b.id,state,planHash:b.planHash,policyVersion:b.policyVersion,preparedBy:name(b.preparedBy),preparedAt:b.preparedAt,expiresAt:b.expiresAt,counts:b.counts,excluded:b.excluded,
   ...(state==='prepared'?{items:items.filter(i=>visible.has(i.personId)).map(({recordClass,table,id,personId})=>({recordClass,table,id,personId})),itemsOutsideYourScope:items.filter(i=>!visible.has(i.personId)).length,canApply:b.preparedBy!==m.userId}:{}),
   ...(b.approvedBy?{approvedBy:name(b.approvedBy),appliedAt:b.appliedAt,register:b.register}:{}),...(b.cancelled?{cancelled:{by:name(b.cancelled.by),at:b.cancelled.at,reason:b.cancelled.reason}}:{})};}).reverse();
}
