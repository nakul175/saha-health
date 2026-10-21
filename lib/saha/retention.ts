import { z } from 'zod';
import { fail, person, uuid } from './core';
import type { Actor } from './store';
import type { Member, OrgState } from './types';
import {decidePolicyDisposition,POLICY_CONTROLLED_CLASSES,retentionMilestones,type DispositionDecision,type RetentionMilestones} from './retention-class-policy';

// BR-SEC-09: owner-maintained schedules and an append-only tombstone ledger.
// Accountability records stay immutable while disposed operational material is
// excluded from every state read.
export const RECORD_CLASSES=['patient-record','programme-receipt','audit-event','outreach-message','rights-request','field-package','transcript','raw-audio','model-output','local-cache','export','backup'] as const;
export type RecordClass=typeof RECORD_CLASSES[number];
// Only classes whose operational payload can be removed without erasing the
// immutable clinical/audit history are enabled. Patient records, model output
// embedded in visit revisions, field packages and caches stay review-only
// until their own approved chain-safe disposal design exists.
export const DISPOSABLE_CLASSES=['programme-receipt','outreach-message','rights-request','transcript','raw-audio'] as const satisfies readonly RecordClass[];
const OPERATIONAL_CLASSES=['patient-record','programme-receipt','audit-event','outreach-message','rights-request','field-package','transcript','raw-audio','model-output','local-cache'] as const satisfies readonly RecordClass[];
export const TRIGGER:Record<RecordClass,string>={
 'patient-record':'last activity on the patient (registration or visit)',
 'programme-receipt':'last update of the submission','audit-event':'time of the event','outreach-message':'creation of the message','rights-request':'closure of the request','field-package':'creation of the field package','transcript':'creation of the transcript','raw-audio':'creation of the recording','model-output':'creation of the model output','local-cache':'creation of the local cache package','export':'creation of the export','backup':'creation of the backup',
};
export type RetentionRule={recordClass:RecordClass;years:number;purpose:string;location:string;jurisdiction:string};
export type RetentionPolicy={version:number;rules:RetentionRule[];basis:string;setBy:string;setAt:string};
export type Hold={id:string;scope:'organisation'|'person';personId?:string;reason:string;reference:string;placedBy:string;placedAt:string;released?:{by:string;at:string;reason:string}};
export type RetentionArtifact={id:string;recordClass:RecordClass;recordId:string;personId?:string;createdAt:string;purpose:string;location:string;jurisdiction:string;registeredBy:string;registeredAt:string};
export type RetentionTombstone={id:string;recordClass:RecordClass;recordId:string;personId?:string;policyVersion:number;triggerAt:string;purpose:string;location:string;jurisdiction:string;disposedBy:string;disposedAt:string;reason:string};
export type Retention={policies:RetentionPolicy[];holds:Hold[];artifacts?:RetentionArtifact[];tombstones?:RetentionTombstone[]};

const text=z.string().trim().min(10,'Write at least 10 characters.').max(1000),ref=z.string().trim().min(3).max(200),id=z.string().trim().min(1).max(200),dimension=z.string().trim().min(2).max(120),instant=z.string().datetime({offset:true});
const rule=z.object({recordClass:z.enum(RECORD_CLASSES),years:z.number().int().min(1).max(50),purpose:dimension,location:dimension,jurisdiction:dimension}).strict();
const tombstone=z.object({id,recordClass:z.enum(RECORD_CLASSES),recordId:id,personId:id.optional(),policyVersion:z.number().int().positive(),triggerAt:instant,purpose:dimension,location:dimension,jurisdiction:dimension,disposedBy:id,disposedAt:instant,reason:text}).passthrough();
export function retentionTombstonesFromRaw(raw:string|null|undefined):RetentionTombstone[]{
 if(raw==null)return[];let value:unknown;try{value=JSON.parse(raw);}catch{fail(503,'Current retention authority is invalid. Nothing was returned.');}
 const parsed=z.object({tombstones:z.array(tombstone).optional()}).passthrough().safeParse(value);if(!parsed.success)fail(503,'Current retention authority is invalid. Nothing was returned.');
 const seen=new Set<string>();for(const item of parsed.data.tombstones??[]){const key=tuple(item.recordClass,item.recordId);if(seen.has(key))fail(503,'Current retention authority contains duplicate tombstones. Nothing was returned.');seen.add(key);if(item.recordClass==='audit-event')fail(503,'Immutable audit events cannot be disposed or hidden by retention authority.');}
 return (parsed.data.tombstones??[]) as RetentionTombstone[];
}
export const retentionSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('retentionPolicySet'),rules:z.array(rule).min(1).max(RECORD_CLASSES.length).refine(r=>new Set(r.map(x=>x.recordClass)).size===r.length,'Set each record class once.'),basis:text}).strict(),
 z.object({type:z.literal('retentionHoldPlace'),scope:z.enum(['organisation','person']),personId:id.optional(),reason:text,reference:ref}).strict(),
 z.object({type:z.literal('retentionHoldRelease'),holdId:id,reason:text}).strict(),
 z.object({type:z.literal('retentionArtifactRegister'),recordClass:z.enum(RECORD_CLASSES),recordId:id,personId:id.optional(),createdAt:instant.optional(),purpose:dimension,location:dimension,jurisdiction:dimension}).strict(),
 z.object({type:z.literal('retentionDisposalApply'),expectedPolicyVersion:z.number().int().positive(),artifacts:z.array(z.object({recordClass:z.enum(RECORD_CLASSES),recordId:id}).strict()).min(1).max(100),reason:text}).strict(),
]);
const TYPES:Set<string>=new Set(retentionSchema.options.map(x=>x.shape.type.value));
export function authorizeRetention(_s:OrgState,m:Member,c:any){if(TYPES.has(c?.type)&&!m.isOwner)fail(403,'Only an organisation owner can manage retention, holds and disposal.');}
const currentPolicy=(r:Retention)=>r.policies.at(-1)??null;
const held=(r:Retention,personId?:string)=>r.holds.some(h=>!h.released&&(h.scope==='organisation'||(personId&&h.personId===personId)));
const tuple=(recordClass:RecordClass,recordId:string)=>`${recordClass}\u0000${recordId}`;
export const yearsAgo=(now:string,years:number)=>{const d=new Date(now);d.setUTCFullYear(d.getUTCFullYear()-years);return d.toISOString();};
export function assertRetentionPurgeAuthority(s:OrgState,t:RetentionTombstone){const r=s.retention;if(!r||held(r,t.personId))fail(409,'A current hold prevents private-object disposal.');const p=currentPolicy(r),rule=p?.rules.find(x=>x.recordClass===t.recordClass);if(!p||p.version!==t.policyVersion||!rule||rule.purpose!==t.purpose||rule.location!==t.location||rule.jurisdiction!==t.jurisdiction)fail(409,'The retention schedule changed before private-object disposal. Review the pending disposal.');if(!(t.recordClass==='raw-audio'||t.recordClass==='transcript'))fail(422,'This disposal has no private-object reconciliation path.');}
type CanonicalBinding={createdAt:string;personId?:string};
const operational=(recordClass:RecordClass)=>(OPERATIONAL_CLASSES as readonly string[]).includes(recordClass);
const disposable=(recordClass:RecordClass)=>(DISPOSABLE_CLASSES as readonly string[]).includes(recordClass);
function canonicalBinding(s:OrgState,recordClass:RecordClass,recordId:string):CanonicalBinding|null{
 const w=s.workspace,one=(items:CanonicalBinding[])=>{if(items.length>1)fail(409,'The operational record identifier is not uniquely bound.');return items[0]??null;};
 if(recordClass==='patient-record'){const p=w.people.find(x=>x.id===recordId);if(!p)return null;const activity=[p.createdAt,...w.visits.filter(v=>v.personId===p.id).flatMap(v=>[v.createdAt,v.confirmedAt].filter((x):x is string=>!!x))].sort().at(-1)!;return {createdAt:activity,personId:p.id};}
 if(recordClass==='programme-receipt')return one(w.submissions.filter(x=>x.id===recordId).map(x=>({createdAt:x.updatedAt,personId:x.personId})));
 if(recordClass==='audit-event')return one(w.audit.filter(x=>x.id===recordId).map(x=>({createdAt:x.at,...(x.personId?{personId:x.personId}: {})})));
 if(recordClass==='outreach-message')return one((s.outreach?.messages??[]).filter(x=>x.id===recordId).map(x=>({createdAt:x.createdAt,personId:x.personId})));
 if(recordClass==='rights-request')return one((s.rightsRequests??[]).filter(x=>x.id===recordId&&x.closed).map(x=>({createdAt:x.closed!.at,personId:x.personId})));
 if(recordClass==='field-package'||recordClass==='local-cache')return one(w.people.flatMap(p=>(p.fieldLeases??[]).filter(x=>x.id===recordId).map(x=>({createdAt:x.createdAt,personId:p.id}))));
 if(recordClass==='model-output')return one(w.visits.flatMap(v=>(v.aiResults??[]).filter(x=>x.id===recordId).map(x=>({createdAt:x.createdAt,personId:v.personId}))));
 if(recordClass==='raw-audio'||recordClass==='transcript')return one(w.visits.flatMap(v=>(v.media??[]).filter(x=>x.id===recordId&&(recordClass==='raw-audio'?(x.purpose==='voice-note'):(x.purpose!=='voice-note'))).map(x=>({createdAt:x.at,personId:v.personId}))));
 return null;
}

export type ArtifactPolicyDisposition={decision:DispositionDecision;milestones:RetentionMilestones|null};
export function policyDispositionForArtifact(s:OrgState,a:RetentionArtifact,now=new Date().toISOString()):ArtifactPolicyDisposition{
 if(!(POLICY_CONTROLLED_CLASSES as readonly string[]).includes(a.recordClass))return {milestones:null,decision:{state:'retained',claim:'retained',reason:'This class uses its existing chain-safe disposal path.',retryable:false}};
 const recordClass=a.recordClass as typeof POLICY_CONTROLLED_CLASSES[number],hold=held(s.retention??{policies:[],holds:[]},a.personId),milestones=recordClass==='backup'?null:retentionMilestones(recordClass,a.createdAt);
 if(a.recordClass==='patient-record')return {milestones,decision:decidePolicyDisposition({recordClass:a.recordClass,hold,jurisdictionScheduleApproved:false,minimumEvidenceSchemaApproved:false})};
 if(a.recordClass==='model-output')return {milestones,decision:decidePolicyDisposition({recordClass:a.recordClass,hold,classification:'unclassified',provenanceEnvelopeRetained:false,humanDecisionRetained:false})};
 if(a.recordClass==='field-package'||a.recordClass==='local-cache'){
  const lease=s.workspace.people.flatMap(p=>(p.fieldLeases??[]).filter(x=>x.id===a.recordId)).at(0),expired=!!milestones&&milestones.recommendedAt<=now;
  return {milestones,decision:decidePolicyDisposition({recordClass:a.recordClass,hold,expired,unsyncedClinicalWork:lease?.status!=='synced',keyInaccessible:false,authoritativeDeviceEvidence:false})};
 }
 if(a.recordClass==='audit-event')return {milestones,decision:decidePolicyDisposition({recordClass:a.recordClass,hold,detailErasureDesign:'unapproved',minimumEnvelopeRetained:true,chainVerified:true,detailUnavailable:false})};
 if(a.recordClass==='export')return {milestones,decision:decidePolicyDisposition({recordClass:a.recordClass,hold,serverPayloadPersisted:false,destinationRegistered:false,keyInaccessible:false,authoritativeDestinationEvidence:false})};
 if(a.recordClass==='backup')return {milestones:null,decision:{state:'policy-blocked',claim:'retained',reason:'Backup cadence and an approved recovery window are not configured for this generation.',retryable:false}};
 return {milestones:null,decision:{state:'retained',claim:'retained',reason:'This class uses its existing chain-safe disposal path.',retryable:false}};
}

export function applyRetention(s:OrgState,input:unknown,u:Actor,m:Member,now=new Date().toISOString()):any|null{
 const parsed=retentionSchema.safeParse(input);if(!parsed.success){const type=input&&typeof input==='object'&&'type' in input?(input as {type?:unknown}).type:null;if(typeof type==='string'&&TYPES.has(type))fail(422,'This retention command uses an unsupported legacy or malformed contract. Refresh and submit the current command version.');return null;}const c=parsed.data;authorizeRetention(s,m,c);
 const r=s.retention??={policies:[],holds:[],artifacts:[],tombstones:[]};r.artifacts??=[];r.tombstones??=[];
 let subject=s.organisation.id,personId:string|undefined,detail='',result:any={ok:true};
 if(c.type==='retentionPolicySet'){
  if(r.policies.length>=100)fail(422,'Retention policy history limit reached; an archival policy is required.');
  const p:RetentionPolicy={version:(r.policies.at(-1)?.version??0)+1,rules:[...c.rules].sort((a,b)=>RECORD_CLASSES.indexOf(a.recordClass)-RECORD_CLASSES.indexOf(b.recordClass)),basis:c.basis,setBy:u.userId,setAt:now};
  r.policies.push(p);detail=`Retention schedule version ${p.version}: ${p.rules.map(x=>`${x.recordClass} ${x.years} years (${x.purpose}; ${x.location}; ${x.jurisdiction})`).join('; ')}. Basis: ${c.basis}. Disposal requires a separate current-version command.`;result={version:p.version};
 } else if(c.type==='retentionHoldPlace'){
  if(c.scope==='person'){if(!c.personId)fail(422,'Choose the patient to hold.');const p=person(s.workspace,c.personId);personId=p.id;if(r.holds.some(h=>!h.released&&h.scope==='person'&&h.personId===p.id))fail(409,'This patient already has a current hold.');}
  else {if(c.personId)fail(422,'An organisation hold does not name a patient.');if(r.holds.some(h=>!h.released&&h.scope==='organisation'))fail(409,'An organisation hold is already in place.');}
  if(r.holds.length>=500)fail(422,'Hold history limit reached; an archival policy is required.');
  const h:Hold={id:uuid(),scope:c.scope,...(personId?{personId}:{}),reason:c.reason,reference:c.reference,placedBy:u.userId,placedAt:now};r.holds.push(h);subject=h.id;detail=`${c.scope==='organisation'?'Organisation-wide':'Patient'} hold placed. Reference ${c.reference}. ${c.reason}`;result={holdId:h.id};
 } else if(c.type==='retentionHoldRelease'){
  const h=r.holds.find(x=>x.id===c.holdId);if(!h)fail(404,'Hold not found.');if(h.released)fail(409,'This hold is already released.');if(h.personId){person(s.workspace,h.personId);personId=h.personId;}h.released={by:u.userId,at:now,reason:c.reason};subject=h.id;detail=`Hold released. ${c.reason}`;
 } else if(c.type==='retentionArtifactRegister'){
  if(r.artifacts.length>=5000)fail(422,'Retention inventory limit reached; archive the inventory before adding records.');if(r.artifacts.some(a=>tuple(a.recordClass,a.recordId)===tuple(c.recordClass,c.recordId)))fail(409,'This retention artifact is already registered.');if(r.tombstones.some(t=>tuple(t.recordClass,t.recordId)===tuple(c.recordClass,c.recordId)))fail(409,'A disposed record identifier cannot be registered again.');
  const canonical=canonicalBinding(s,c.recordClass,c.recordId);let createdAt:string;if(operational(c.recordClass)){if(!canonical)fail(404,'The operational record is unavailable in the current authorised scope.');createdAt=canonical.createdAt;personId=canonical.personId;}else{if(c.personId)fail(422,'Unbound inventory metadata cannot claim a patient relationship.');if(!c.createdAt)fail(422,'Record the inventory creation time.');createdAt=c.createdAt;}
  if(createdAt>now)fail(422,'The artifact creation time cannot be in the future.');const body={recordClass:c.recordClass,recordId:c.recordId,createdAt,purpose:c.purpose,location:c.location,jurisdiction:c.jurisdiction};const a:RetentionArtifact={...body,id:uuid(),...(personId?{personId}:{}),registeredBy:u.userId,registeredAt:now};r.artifacts.push(a);subject=a.id;detail=`Retention artifact registered: ${a.recordClass} ${a.recordId}; ${a.purpose}; ${a.location}; ${a.jurisdiction}. Operational age and patient binding are derived from the canonical record.`;result={artifactId:a.id};
 } else {
  const policy=currentPolicy(r);if(!policy||policy.version!==c.expectedPolicyVersion)fail(409,'The retention schedule changed or is unavailable. Refresh before disposal.');if(held(r))fail(409,'An organisation hold prevents disposal.');const unique=new Set(c.artifacts.map(a=>tuple(a.recordClass,a.recordId)));if(unique.size!==c.artifacts.length)fail(422,'Choose each retention artifact once.');
  const selected=c.artifacts.map(x=>{const a=r.artifacts!.find(a=>tuple(a.recordClass,a.recordId)===tuple(x.recordClass,x.recordId));if(!a)fail(404,'Retention artifact not found.');if(!disposable(x.recordClass)){const disposition=policyDispositionForArtifact(s,a,now).decision;fail(422,`This record class has no supported physical-disposal command. Current disposition: ${disposition.state}/${disposition.claim}. ${disposition.reason}`);}if(r.tombstones!.some(t=>tuple(t.recordClass,t.recordId)===tuple(x.recordClass,x.recordId)))fail(409,'This artifact is already disposed.');const canonical=canonicalBinding(s,a.recordClass,a.recordId);if(!canonical||canonical.createdAt!==a.createdAt||canonical.personId!==a.personId)fail(409,'The artifact canonical age or patient binding changed or is unavailable. Refresh the inventory before disposal.');if(held(r,canonical.personId))fail(409,'A current hold protects one or more selected artifacts.');const rule=policy.rules.find(q=>q.recordClass===a.recordClass);if(!rule)fail(409,'The current policy does not schedule one or more selected artifacts.');if(rule.purpose!==a.purpose||rule.location!==a.location||rule.jurisdiction!==a.jurisdiction)fail(409,'An artifact no longer matches the current purpose, location and jurisdiction schedule.');if(canonical.createdAt>=yearsAgo(now,rule.years))fail(409,'One or more selected artifacts have not reached the configured disposal date.');return {a,rule};});
  for(const {a,rule} of selected)r.tombstones.push({id:uuid(),recordClass:a.recordClass,recordId:a.recordId,...(a.personId?{personId:a.personId}:{}),policyVersion:policy.version,triggerAt:a.createdAt,purpose:rule.purpose,location:rule.location,jurisdiction:rule.jurisdiction,disposedBy:u.userId,disposedAt:now,reason:c.reason});subject=selected.length===1?selected[0].a.recordId:s.organisation.id;personId=selected.length===1?selected[0].a.personId:undefined;detail=`Controlled disposal applied to ${selected.length} artifact${selected.length===1?'':'s'} under policy ${policy.version}; append-only tombstones retained. ${c.reason}`;result={disposed:selected.length,tombstoneIds:r.tombstones.slice(-selected.length).map(t=>t.id)};
 }
 s.workspace.audit.push({id:uuid(),at:now,actorId:u.userId,actor:u.displayName,role:m.role,action:c.type,subject,personId,detail});return result;
}

// Called after database reads. Rows remain for immutable accountability, but
// disposed operational content cannot be opened, acted on, exported or revived
// by a restore that contains the tombstone ledger.
export function applyRetentionTombstones(s:OrgState):OrgState{
 const tombstones=retentionTombstonesFromRaw(JSON.stringify(s.retention??{})),dead=new Set(tombstones.map(t=>tuple(t.recordClass,t.recordId)));if(!dead.size)return s;const w=s.workspace,people=new Set(w.people.filter(p=>dead.has(tuple('patient-record',p.id))).map(p=>p.id));w.people=w.people.filter(p=>!people.has(p.id));w.visits=w.visits.filter(v=>!people.has(v.personId)).map(v=>({...v,aiResults:(v.aiResults??[]).filter(a=>!dead.has(tuple('model-output',a.id))),media:(v.media??[]).filter(a=>!dead.has(tuple(a.purpose==='voice-note'?'raw-audio':'transcript',a.id)))}));w.submissions=w.submissions.filter(x=>!people.has(x.personId)&&!dead.has(tuple('programme-receipt',x.id)));w.referrals=w.referrals.filter(x=>!people.has(x.personId));if(s.outreach)s.outreach.messages=s.outreach.messages.filter(x=>!people.has(x.personId)&&!dead.has(tuple('outreach-message',x.id)));if(s.rightsRequests)s.rightsRequests=s.rightsRequests.filter(x=>!people.has(x.personId)&&!dead.has(tuple('rights-request',x.id)));for(const p of w.people)if(p.fieldLeases)p.fieldLeases=p.fieldLeases.filter(x=>!dead.has(tuple('field-package',x.id))&&!dead.has(tuple('local-cache',x.id)));return s;
}

export function retentionReview(s:OrgState,m:Member,audit:{total:number;pastSchedule:number},now=new Date().toISOString()){
 if(!m.isOwner)fail(403,'Only an organisation owner can review retention.');
 const r=s.retention??{policies:[],holds:[],artifacts:[],tombstones:[]},policy=currentPolicy(r),holds=r.holds.filter(h=>!h.released),orgHold=holds.some(h=>h.scope==='organisation'),heldPeople=new Set(holds.filter(h=>h.personId).map(h=>h.personId!)),dead=new Set((r.tombstones??[]).map(t=>tuple(t.recordClass,t.recordId))),w=s.workspace;
 const last=new Map<string,string>();for(const p of w.people)last.set(p.id,p.createdAt);for(const v of w.visits){const t=[v.createdAt,v.confirmedAt].filter((x):x is string=>!!x).sort().at(-1)!;if(t>(last.get(v.personId)??''))last.set(v.personId,t);}
 const artifacts=(r.artifacts??[]).filter(a=>!dead.has(tuple(a.recordClass,a.recordId)));
 const dated:Record<RecordClass,{id:string;personId?:string;at:string}[]>={'patient-record':w.people.map(p=>({id:p.id,personId:p.id,at:last.get(p.id)!})),'programme-receipt':w.submissions.map(x=>({id:x.id,personId:x.personId,at:x.updatedAt})),'audit-event':[],'outreach-message':(s.outreach?.messages??[]).map(x=>({id:x.id,personId:x.personId,at:x.createdAt})),'rights-request':(s.rightsRequests??[]).filter(x=>x.closed).map(x=>({id:x.id,personId:x.personId,at:x.closed!.at})),'field-package':w.people.flatMap(p=>(p.fieldLeases??[]).map(l=>({id:l.id,personId:p.id,at:l.createdAt}))),'transcript':w.visits.flatMap(v=>(v.media??[]).filter(x=>x.purpose!=='voice-note').map(x=>({id:x.id,personId:v.personId,at:x.at}))),'raw-audio':w.visits.flatMap(v=>(v.media??[]).filter(x=>x.purpose==='voice-note').map(x=>({id:x.id,personId:v.personId,at:x.at}))),'model-output':w.visits.flatMap(v=>(v.aiResults??[]).map(a=>({id:a.id,personId:v.personId,at:a.createdAt}))),'local-cache':w.people.flatMap(p=>(p.fieldLeases??[]).map(l=>({id:l.id,personId:p.id,at:l.createdAt}))),'export':artifacts.filter(a=>a.recordClass==='export').map(a=>({id:a.recordId,at:a.createdAt})),'backup':artifacts.filter(a=>a.recordClass==='backup').map(a=>({id:a.recordId,at:a.createdAt}))};
 const review=RECORD_CLASSES.map(recordClass=>{const rule=policy?.rules.find(x=>x.recordClass===recordClass),cutoff=rule?yearsAgo(now,rule.years):null,supported=disposable(recordClass);if(recordClass==='audit-event'){const past=cutoff?audit.pastSchedule:0;return {recordClass,trigger:TRIGGER[recordClass],rule:rule??null,years:rule?.years??null,total:audit.total,pastSchedule:past,eligible:0,held:orgHold?past:0,disposalSupported:false};}const items=dated[recordClass],past=cutoff?items.filter(i=>i.at<cutoff):[],heldCount=orgHold?past.length:past.filter(i=>i.personId&&heldPeople.has(i.personId)).length;return {recordClass,trigger:TRIGGER[recordClass],rule:rule??null,years:rule?.years??null,total:items.length,pastSchedule:past.length,eligible:supported?past.length-heldCount:0,held:heldCount,disposalSupported:supported};});
 const name=(id:string)=>s.members.find(x=>x.userId===id)?.displayName??'Former member',inScope=(personId?:string)=>!personId||w.people.some(x=>x.id===personId&&x.assigned);
 const inventory=artifacts.map(a=>{const protectedByScope=!inScope(a.personId),canonical=operational(a.recordClass)?canonicalBinding(s,a.recordClass,a.recordId):null,rule=policy?.rules.find(q=>q.recordClass===a.recordClass),bound=!!canonical&&canonical.createdAt===a.createdAt&&canonical.personId===a.personId,eligible=!protectedByScope&&disposable(a.recordClass)&&bound&&!!rule&&rule.purpose===a.purpose&&rule.location===a.location&&rule.jurisdiction===a.jurisdiction&&a.createdAt<yearsAgo(now,rule.years);if(protectedByScope)return {id:a.id,outsideScope:true,eligible:false,held:held(r,a.personId)};const policyDisposition=policyDispositionForArtifact(s,a,now);return {...a,eligible,held:held(r,a.personId),disposalSupported:disposable(a.recordClass),canonicalBinding:bound,policyDisposition};});
 return {policy:policy?{...policy,setBy:name(policy.setBy)}:null,history:r.policies.map(p=>({version:p.version,setAt:p.setAt,setBy:name(p.setBy)})).reverse(),holds:r.holds.map(h=>{const p=h.personId?w.people.find(x=>x.id===h.personId&&x.assigned):undefined;if(h.personId&&!p)return {id:h.id,scope:h.scope,placedAt:h.placedAt,...(h.released?{released:{at:h.released.at}}:{}),outsideScope:true,personName:'Patient outside your scope'};return {...h,placedBy:name(h.placedBy),personName:h.personId?p!.name:null};}).reverse(),holdsOutsideScope:r.holds.filter(h=>h.personId&&!w.people.some(x=>x.id===h.personId&&x.assigned)).length,review,classes:RECORD_CLASSES.map(c=>({recordClass:c,trigger:TRIGGER[c],canonical:operational(c),disposable:disposable(c)})),inventory:{active:artifacts.length,disposed:(r.tombstones??[]).length,outsideScope:inventory.filter(a=>a.outsideScope).length,artifacts:inventory},disposal:'Enabled only for canonically bound operational records with a supported chain-safe disposal path and append-only tombstones. Audit events, exports, backups and unbound inventory remain review-only; holds and stale schedules fail closed.'};
}
