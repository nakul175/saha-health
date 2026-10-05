import { digest, fail, uuid } from './core';
import { entryContent, measureValue } from './fact-provenance';
import type { Dispute, EntryReview, FactReview, Measure, Member, Visit } from './types';
import type { Actor } from './store';
const own=<T>(r:Record<string,T>|undefined|null,k:string):T|undefined=>r&&Object.prototype.hasOwnProperty.call(r,k)?r[k]:undefined;
export function targetContent(v:Visit,target:string):unknown{
 if(target==='notes')return v.facts.notes??'';
 if(target.startsWith('fact:')){const m=target.slice(5) as Measure;return [m==='bloodPressure'?[v.facts.systolic,v.facts.diastolic]:measureValue(v.facts,m),v.facts.provenance?.[m]??null];}
 const k=target.slice(7),c=entryContent(v);return [own(c.answers,k)??null,own(c.absence,k)??null];
}
export const targetHash=(v:Visit,target:string)=>digest(targetContent(v,target));
// A short display text for the disputed content (kept on the dispute as evidence of what was disputed).
export function targetText(v:Visit,target:string):string{
 if(target==='notes')return (v.facts.notes??'').slice(0,200);
 if(target.startsWith('fact:')){const m=target.slice(5) as Measure;return m==='bloodPressure'?`${v.facts.systolic||'-'}/${v.facts.diastolic||'-'}`:String(measureValue(v.facts,m)||'not recorded').slice(0,60);}
 const k=target.slice(7),c=entryContent(v),a=own(c.answers,k),r=own(c.absence,k);return (a?a:r?`${r} (absence reason)`:'').slice(0,200);
}

// These are trusted current recorders at hold/carry creation, not a claim of missing historical authorship.
const recorderIds=(v:Visit,target:string):string[]=>{
 const recorded=target.startsWith('fact:')?v.factAuthors?.[target.slice(5) as Measure]?.userId:target==='notes'?v.noteAuthor?.userId:v.answerAuthors?.[target.slice(7)]?.userId;
 return [...new Set((recorded?[recorded]:[v.patientCheck?.by,target.startsWith('answer:')?v.programmeCapture?.savedBy:undefined]).filter((x):x is string=>!!x))];
};
// Retained review rows do not contain a historical content hash. Their latest disputed state is a conservative
// hold, not evidence that today's content is identical to the reviewed content. Deterministic IDs allow an
// appended explicit resolution without rewriting or manufacturing an old review/hash.
export function verificationDisputes(v:Visit):Dispute[]{
 const latest=new Map<string,FactReview|EntryReview>();
 for(const r of v.factReviews??[])latest.set('fact:'+r.measure,r);
 for(const r of v.entryReviews??[])latest.set(r.entry,r);
 const linked=new Set((v.disputes??[]).map(d=>d.verification?.reviewId).filter(Boolean));
 return [...latest].filter(([,r])=>r.state==='disputed'&&!linked.has(r.id)).map(([target,r])=>({
  id:'verification:'+r.id,target,reason:r.reason??'Retained disputed verification review; original content binding was not recorded.',reference:'Verification review '+r.id,
  by:r.by,byName:r.byName,accountCode:'not-recorded',role:'clinician',at:r.at,visitVersion:v.version,
  contentHash:'',valueText:'Original reviewed content was not bound',verification:{reviewId:r.id,binding:'legacy-unbound',recorderIds:recorderIds(v,target)}
 }));
}
export const allDisputes=(v:Visit):Dispute[]=>[...(v.disputes??[]),...verificationDisputes(v)];
export const unresolvedDisputes=(v:Visit):Dispute[]=>allDisputes(v).filter(d=>!(v.disputeResolutions??[]).some(r=>r.disputeId===d.id));
// Before adding any newer review, retain unresolved legacy holds. A verification click cannot clear them.
export function retainVerificationHolds(v:Visit){
 const missing=verificationDisputes(v).filter(d=>!(v.disputeResolutions??[]).some(r=>r.disputeId===d.id));
 if((v.disputes?.length??0)+missing.length>50)fail(422,'Dispute limit reached for this visit.');
 if(missing.length)(v.disputes??=[]).push(...missing);
}
export async function appendVerificationDispute(v:Visit,r:FactReview|EntryReview,target:string,u:Actor,m:Member){
 if((v.disputes?.length??0)>=50)fail(422,'Dispute limit reached for this visit.');
 const d:Dispute={id:uuid(),target,reason:r.reason!,reference:'Verification review '+r.id,by:u.userId,byName:u.displayName,accountCode:m.accountCode,role:m.role,at:r.at,visitVersion:v.version,contentHash:await targetHash(v,target),valueText:targetText(v,target),verification:{reviewId:r.id,binding:'exact-content',recorderIds:recorderIds(v,target)}};
 (v.disputes??=[]).push(d);return d;
}
