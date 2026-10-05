import {z} from 'zod';
import {apply, commandSchema, digest, fail, person, uuid, visit} from './core';
import {normallyAllowed} from './access';
import {ensurePurpose} from './purpose-scope';
import {ehrAccess, identityHash, withinPermission, inboundCandidateAuthority} from './ehr';
import {inspectDocument} from './fhir-document';
import {stampAuthors} from './fact-provenance';
import type {Actor} from './store';
import type {EhrDocument,EhrOperation} from './ehr';
import type {Facts, Member, OrgState, Visit} from './types';

export type InboundConflict={id:string;kind:'inbound-document'|'accepted-destination';documentId:string;visitId:string;operationId?:string;candidateId?:string;acceptedSnapshot?:EhrOperation;by:string;at:string;ownerId:string;version:number;localHash:string;localSnapshot:Visit;sourceVersion:string;incomingVersion:string;effectiveAt:string;source:EhrDocument;incoming:EhrDocument;state:'open'|'resolved';assignments:{by:string;at:string;from:string;to:string;beforeBasis:string;afterBasis:string}[];decisions:{id:string;by:string;at:string;decision:'keep-local'|'reference-source'|'merge-draft';basis:string;choices:Record<string,'local'|'incoming'>;beforeHash:string;afterHash:string;hashRules:'saha-inbound-visit-v1'}[]};
const id=z.string().min(1).max(200),sha=z.string().regex(/^[a-f0-9]{64}$/),ver=z.number().int().positive(),token=z.string().regex(/^[A-Za-z0-9._-]{1,64}$/);
const base={personId:id,expectedActorId:id,key:z.string().uuid()};
export const inboundSchema=z.discriminatedUnion('type',[
 z.object({...base,type:z.literal('stage'),kind:z.enum(['inbound-document','accepted-destination']),documentId:id,visitId:id,operationId:id.optional(),candidateId:id.optional(),sourceVersion:token,incomingVersion:token,effectiveAt:z.string().datetime(),ownerId:id,json:z.string().min(1).max(12000)}).strict(),
 z.object({...base,type:z.literal('assign'),conflictId:id,version:ver,ownerId:id}).strict(),
 z.object({...base,type:z.literal('decide'),conflictId:id,version:ver,basis:sha,decision:z.enum(['keep-local','reference-source','merge-draft']),choices:z.record(z.enum(['systolic','diastolic','weight','temperature']),z.enum(['local','incoming']))}).strict(),
]);
export type InboundCommand=z.infer<typeof inboundSchema>;
export function inboundCare(s:OrgState,m:Member,personId:string,clinical=false){
 const p=person(s.workspace,personId);
 if(!normallyAllowed(m,p)||!['clinician','supervisor'].includes(m.role)||clinical&&m.role!=='clinician')fail(403,'Current normal care scope and clinician review authority are required.');
 ensurePurpose(m,'care-coordination',s.operations?.purposeGrants);
 if(p.mergedInto||p.identityReview?.state==='provisional'||(p.restrictions??[]).some(x=>!x.liftedAt))fail(409,'Reconcile patient identity before reviewing inbound changes.');
 return p;
}
export function conflictFor(s:OrgState,personId:string,id:string){const p=person(s.workspace,personId),c=p.ehr?.inboundConflicts?.find(x=>x.id===id);if(!c)fail(404,'Inbound conflict not found.');return c;}
export function currentReviewer(s:OrgState,personId:string,id:string){const m=s.members.find(x=>x.userId===id);if(!m)fail(403,'A current scoped clinician must own this review.');inboundCare(s,m,personId,true);return m;}
export async function conflictBasis(s:OrgState,personId:string,c:InboundConflict){
 const p=person(s.workspace,personId),v=visit(s.workspace,c.visitId),d=p.ehr?.documents.find(x=>x.id===c.documentId);
 if(v.personId!==p.id||!d||d.hash!==c.source.hash||await digest(d.bundle)!==c.source.hash||await digest(c.source.bundle)!==c.source.hash||await digest(c.incoming.bundle)!==c.incoming.hash)fail(409,'Original source or local record changed. Preserve evidence and stage a fresh review.');
 const {i,link,permission}=await ehrAccess(s,p,d.linkId,d.permissionId,'read');
 const incomingSummary=inspectDocument(c.incoming.bundle,link.externalId);if(await digest(incomingSummary)!==await digest(c.incoming.summary)||await digest(c.source.summary)!==await digest(d.summary))fail(409,'Source summary differs from its retained document. Nothing was changed.');withinPermission(incomingSummary,permission);
 if(c.candidateId){const candidate=p.ehr?.inboundCandidates?.find(x=>x.id===c.candidateId);if(!candidate||candidate.documentId!==d.id||candidate.source.hash!==c.source.hash||candidate.incoming.hash!==c.incoming.hash||await digest(candidate.incoming.bundle)!==c.incoming.hash||candidate.sourceVersion!==c.sourceVersion||candidate.incomingVersion!==c.incomingVersion||candidate.effectiveAt!==c.effectiveAt||candidate.authorityHash!==await inboundCandidateAuthority(s,p,candidate.incoming.linkId,candidate.incoming.permissionId))fail(409,'Retrieved source authority changed. Retain historical evidence and retrieve a fresh version.');}
 const operation=c.operationId?p.ehr?.operations.find(x=>x.id===c.operationId):null;
 if(c.kind==='accepted-destination'&&(!operation||operation.state!=='accepted'||!operation.receipt||![v.id,v.amendsVisitId].includes(operation.visitId)||operation.linkId!==link.id||operation.hash!==c.source.hash||await digest(operation.bundle)!==operation.hash))fail(409,'The original accepted destination receipt is required.');
 return digest({identity:await identityHash(p),personVersion:p.version,consentVersion:p.consentVersion,link,permission,integration:{id:i.id,version:i.version,kind:i.kind,mode:i.mode,status:i.status,endpoint:i.endpoint,credentialBinding:i.credentialBinding,ehr:i.ehr},local:v,sourceHash:d.hash,incomingHash:c.incoming.hash,sourceVersion:c.sourceVersion,incomingVersion:c.incomingVersion,effectiveAt:c.effectiveAt,operation:operation??null});
}
// New decision fingerprints canonicalise visit object keys; existing approved document hashes remain byte-contract hashes.
export function canonicalVisit(value:any):any{if(Array.isArray(value))return value.map(canonicalVisit);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonicalVisit(value[k])]));return value;}
export const inboundVisitHash=(value:Visit)=>digest({rules:'saha-inbound-visit-v1',visit:canonicalVisit(value)});
const fields:Record<string,'systolic'|'diastolic'|'weight'|'temperature'>={'8480-6':'systolic','8462-4':'diastolic','29463-7':'weight','8310-5':'temperature'};
export function incomingValues(c:InboundConflict){
 const result:Partial<Record<'systolic'|'diastolic'|'weight'|'temperature',{value:string;date:string}>>={};
 for(const o of c.incoming.summary.observations){const f=fields[o.code];if(!f)continue;if(result[f])fail(422,'More than one incoming observation maps to a field. A partner-specific review is required.');result[f]={value:o.value,date:o.date};}
 return result;
}
export async function applyInbound(s:OrgState,c:InboundCommand,u:Actor,m:Member,rangeEnvironment:string){
 const p=inboundCare(s,m,c.personId,c.type==='decide'),now=new Date().toISOString();let result:any;
 if(c.type==='stage'){
  if(c.kind==='inbound-document'&&c.operationId)fail(422,'An accepted operation applies only to a destination conflict.');
  const d=p.ehr?.documents.find(x=>x.id===c.documentId);if(!d)fail(404,'Choose an existing source document.');
  const {link,permission}=await ehrAccess(s,p,d.linkId,d.permissionId,'read');const v=visit(s.workspace,c.visitId);if(v.personId!==p.id||v.voidedAt||v.supersededBy)fail(409,'Choose a current local visit or correction draft.');
  currentReviewer(s,p.id,c.ownerId);
  if(c.sourceVersion===c.incomingVersion)fail(409,'Different content requires a distinct declared source version.');
  let bundle:any;try{bundle=JSON.parse(c.json);}catch{fail(422,'Invalid FHIR document JSON.');}
  const summary=inspectDocument(bundle,link.externalId);withinPermission(summary,permission);
  if(summary.patientName.trim().replace(/\s+/g,' ').toLowerCase()!==link.externalName.trim().replace(/\s+/g,' ').toLowerCase())fail(409,'Incoming patient identity differs from the current confirmed link.');
  const hash=await digest(bundle);if(hash===d.hash||summary.identifier!==d.summary.identifier)fail(409,'Choose a changed version of the same source document identifier.');
  if(d.bundle.meta?.versionId&&d.bundle.meta.versionId!==c.sourceVersion||bundle.meta?.versionId&&bundle.meta.versionId!==c.incomingVersion)fail(409,'Declared version must match the original document version token.');
  const candidate=c.candidateId?p.ehr!.inboundCandidates?.find(x=>x.id===c.candidateId):null;
  if(c.candidateId&&(!candidate||c.kind!=='inbound-document'||candidate.documentId!==d.id||candidate.source.hash!==d.hash||await digest(candidate.source.bundle)!==d.hash||await digest(candidate.incoming.bundle)!==hash||candidate.incoming.hash!==hash||candidate.sourceVersion!==c.sourceVersion||candidate.incomingVersion!==c.incomingVersion||candidate.effectiveAt!==c.effectiveAt||candidate.authorityHash!==await inboundCandidateAuthority(s,p,candidate.incoming.linkId,candidate.incoming.permissionId)))fail(409,'Retrieved source or its current authority changed. Preserve evidence and retrieve a fresh version.');
  const list=p.ehr!.inboundConflicts??=[];if(list.length>=40)fail(413,'Inbound conflict history is full. Existing evidence is preserved.');
  
  const item:InboundConflict={id:uuid(),kind:c.kind,documentId:d.id,visitId:v.id,candidateId:c.candidateId,operationId:c.operationId,acceptedSnapshot:c.operationId?structuredClone(p.ehr!.operations.find(x=>x.id===c.operationId)):undefined,by:u.userId,at:now,ownerId:c.ownerId,version:1,sourceVersion:c.sourceVersion,incomingVersion:c.incomingVersion,effectiveAt:c.effectiveAt,source:structuredClone(d),incoming:{id:uuid(),linkId:d.linkId,permissionId:d.permissionId,hash,bundle,summary,status:'review',at:now,origin:candidate?'ehr':'file'},localHash:'',localSnapshot:structuredClone(v),state:'open',assignments:[],decisions:[]};
  item.localHash=await conflictBasis(s,p.id,item);if(list.some(x=>x.documentId===d.id&&x.incoming.hash===hash&&x.visitId===v.id&&x.state==='open'&&x.localHash===item.localHash))fail(409,'This exact version and local state already have an open review.');p.version++;item.localHash=await conflictBasis(s,p.id,item);list.push(item);result={conflictId:item.id,version:1,basis:item.localHash};
 }else{
  const item=conflictFor(s,p.id,c.conflictId);if(c.type==='decide')currentReviewer(s,p.id,item.ownerId);
  if(item.state!=='open'||item.version!==c.version)fail(409,'The review changed. Refresh the conflict without repeating clinical work.');
  if(c.type==='assign'){currentReviewer(s,p.id,c.ownerId);if(item.assignments.length>=50)fail(413,'Assignment history is full.');const beforeBasis=item.localHash,from=item.ownerId;let currentBasis:string|null=null;try{currentBasis=await conflictBasis(s,p.id,item);}catch{/* Reassignment restores responsibility, never clinical eligibility. */}p.version++;item.ownerId=c.ownerId;item.version++;if(beforeBasis===currentBasis)item.localHash=await conflictBasis(s,p.id,item);item.assignments.push({by:u.userId,at:now,from,to:c.ownerId,beforeBasis,afterBasis:item.localHash});result={conflictId:item.id,version:item.version};}
  else{
   if(item.ownerId!==u.userId||item.by===u.userId)fail(403,'The currently assigned independent clinician must make this decision.');
   const basis=await conflictBasis(s,p.id,item);if(c.basis!==basis||item.localHash!==basis)fail(409,'Local facts, pending correction or source authority changed. Stage a fresh review; nothing is overwritten.');
   const v=visit(s.workspace,item.visitId),beforeHash=await inboundVisitHash(v),choices=c.choices;
   if(c.decision!=='merge-draft'&&Object.keys(choices).length)fail(422,'Field choices apply only to an explicit draft merge.');
   if(c.decision==='merge-draft'){
    if(Date.parse(item.effectiveAt)>Date.now())fail(409,'The source version is not effective yet. Preserve the draft and review it when due.');
    if(v.state!=='draft'||v.imported)fail(409,'Confirmed and imported records are preserved. Open an explicit current correction draft before staging a merge.');
    const values=incomingValues(item),keys=Object.keys(values);if(!keys.length||keys.some(k=>!(k in choices))||Object.keys(choices).some(k=>!(k in values)))fail(422,'Choose local or incoming for every mapped observation, exactly once.');
    if((choices.systolic==='incoming')!==(choices.diastolic==='incoming'))fail(422,'Choose the same source for both blood pressure readings.');
    if(choices.systolic==='incoming'&&(!values.systolic||!values.diastolic||values.systolic.date!==values.diastolic.date))fail(422,'Incoming blood pressure readings must share one observation time.');
    const facts:Facts=structuredClone(v.facts);for(const field of keys as (keyof typeof values)[])if(choices[field]==='incoming'){const value=values[field]!;facts[field]=value.value;const measure=field==='systolic'||field==='diastolic'?'bloodPressure':field;facts.provenance??={};facts.provenance[measure]={source:'reported',at:value.date.slice(0,16)};if(facts.entered)delete facts.entered[field];if(facts.unusual)delete facts.unusual[field];}
    const prior=structuredClone(v.facts);await apply(s.workspace,commandSchema.parse({type:'saveVisit',visitId:v.id,version:v.version,facts}),u.displayName,{rangeEnvironment,call:async()=>{fail(409,'Inbound review never calls providers.');}},now);
    v.recordVersion++;v.factAuthors=stampAuthors(prior,v.facts,v.factAuthors,{userId:u.userId,name:u.displayName,accountCode:m.accountCode,role:m.role,at:now});
   }
   const decisionId=uuid();if(c.decision==='merge-draft')(v.inboundSourceDecisions??=[]).push({conflictId:item.id,decisionId,sourceHash:item.incoming.hash,by:u.userId,at:now});
   const entry={id:decisionId,by:u.userId,at:now,decision:c.decision,basis,choices:structuredClone(choices),beforeHash,afterHash:await inboundVisitHash(v),hashRules:'saha-inbound-visit-v1' as const};
   p.version++;item.decisions.push(entry);item.state='resolved';item.version++;result={conflictId:item.id,decisionId:entry.id,visitId:v.id,version:item.version,externalWrites:0};
  }
 }
 s.workspace.audit.push({id:uuid(),at:now,actorId:u.userId,actor:u.displayName,role:m.role,action:'inboundConflict'+c.type,subject:p.id,personId:p.id,detail:`Inbound ${c.type}; review ${result.conflictId}; exact source versions retained; zero external writes.`});return result;
}
