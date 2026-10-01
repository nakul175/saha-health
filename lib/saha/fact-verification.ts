import { z } from 'zod';
import { fail, person, uuid, visit } from './core';
import { allowed } from './access';
import { MEASURES, MEASURE_LABEL, entryContent, factMeasuresPresent, factReview, stampAuthors, stampEntryAuthors } from './fact-provenance';
import type { Actor } from './store';
import type { FactReview, Member, OrgState } from './types';
// Slice 2e: per-measurement author and clinician verification (BR-DATA-02).
//
// Authors: after every command, each visit whose facts changed is compared with its previous facts (for a new
// correction draft, with the visit it corrects). A measurement whose value or own source/time entry changed is
// credited to the authenticated server identity and its current role; clients cannot send an author. Unchanged
// measurements keep their author; older facts without one stay without one ("not recorded").
//
// Verification: a clinician in the patient's normal care scope verifies or disputes one measurement of a current
// confirmed visit. Reviews are appended (latest wins), never rewritten; each one changes the visit record, so the
// store writes a record revision, and it is audited. Facts are not changed and the visit version is not bumped.
const id=z.string().trim().min(1).max(200);
export const factReviewSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('verifyFact'),visitId:id,recordVersion:z.number().int().positive(),measure:z.enum(MEASURES),decision:z.enum(['verified','disputed']),reason:z.string().trim().max(500).optional()}).strict(),
]);
export function authorizeFactReview(s:OrgState,m:Member,c:any){
 if(c?.type!=='verifyFact')return;
 if(m.role!=='clinician')fail(403,'A clinician with current care scope is required to verify or dispute a measurement.');
 const v=visit(s.workspace,c.visitId),p=person(s.workspace,v.personId);if(!allowed(m,p))fail(403,'This patient is outside your care scope.');
}
export function applyFactReview(s:OrgState,input:unknown,u:Actor,m:Member,now=new Date().toISOString()):any|null{
 const parsed=factReviewSchema.safeParse(input);if(!parsed.success)return null;const c=parsed.data;authorizeFactReview(s,m,c);
 const v=visit(s.workspace,c.visitId),label=MEASURE_LABEL[c.measure];
 if(v.voidedAt||v.supersededBy)fail(409,'This visit was corrected or marked as wrong-patient. Open the current visit.');
 if(v.state!=='confirmed')fail(409,'Only measurements on a confirmed visit can be verified or disputed.');
 if(v.recordVersion!==c.recordVersion)fail(409,'This visit changed. Refresh before reviewing its measurements.');
 if(!factMeasuresPresent(v.facts).includes(c.measure))fail(422,`${label} was not recorded on this visit.`);
 if(c.decision==='disputed'&&(c.reason??'').length<10)fail(422,'Explain the dispute in at least 10 characters.');
 if(v.factAuthors?.[c.measure]?.userId===u.userId)fail(403,'A different clinician must verify or dispute a measurement you recorded.');
 if(factReview(v,c.measure)?.state===c.decision)fail(409,`${label} is already ${c.decision}.`);
 if((v.factReviews?.length??0)>=100)fail(422,'Measurement review limit reached for this visit.');
 const r:FactReview={id:uuid(),measure:c.measure,state:c.decision,by:u.userId,byName:u.displayName,at:now,...(c.reason?{reason:c.reason}:{})};
 (v.factReviews??=[]).push(r);
 s.workspace.audit.push({id:uuid(),at:now,actorId:u.userId,actor:u.displayName,role:m.role,action:c.type,subject:v.id,personId:v.personId,detail:`${label} ${c.decision} by a clinician on a confirmed visit; facts unchanged.${c.reason?` Reason: ${c.reason}`:''}`});
 return {reviewId:r.id,measure:r.measure,state:r.state};
}
// Credits changed measurements to the authenticated actor. Runs on the server after a command changed state.
export function recordFactAuthors(before:OrgState,after:OrgState,u:Actor,m:Member,now=new Date().toISOString()){
 const prev=new Map(before.workspace.visits.map(v=>[v.id,v]));
 const actor={userId:u.userId,name:u.displayName,accountCode:m.accountCode,role:m.role,at:now};
 for(const v of after.workspace.visits){
  const old=prev.get(v.id),base=old??(v.amendsVisitId?prev.get(v.amendsVisitId):undefined);
  // Slice 2g: visit notes and programme answers follow the same rule (author kept when unchanged).
  const content=JSON.stringify(entryContent(v));if(!old||JSON.stringify(entryContent(old))!==content){const e=stampEntryAuthors(base?entryContent(base):undefined,entryContent(v),base,actor);
   if(e.noteAuthor)v.noteAuthor=e.noteAuthor;else delete v.noteAuthor;if(e.answerAuthors)v.answerAuthors=e.answerAuthors;else delete v.answerAuthors;}
  if(old&&JSON.stringify(old.facts)===JSON.stringify(v.facts))continue;
  if(!base&&!factMeasuresPresent(v.facts).length)continue;
  const authors=stampAuthors(base?.facts,v.facts,base?.factAuthors,actor);
  if(authors)v.factAuthors=authors;else delete v.factAuthors;
 }
}
