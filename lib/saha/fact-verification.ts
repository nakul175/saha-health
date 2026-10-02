import { z } from 'zod';
import { fail, person, uuid, visit } from './core';
import { allowed } from './access';
import { MEASURES, MEASURE_LABEL, measureOf, VALUE_FIELDS, VALUE_RANGES, currentOverride, entryContent, factMeasuresPresent, factReview, overrideConfirmation, rangeText, stampAuthors, stampEntryAuthors, valueTier } from './fact-provenance';
import type { Actor } from './store';
import type { FactAuthor, FactReview, Member, OrgState, OverrideConfirmation, ValueOverride, Visit } from './types';
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
 // Slice 2i: a clinician confirms a recorder's override for a value outside the placeholder confirmation range.
 z.object({type:z.literal('confirmUnusualValue'),visitId:id,version:z.number().int().positive(),field:z.enum(VALUE_FIELDS),overrideId:id,note:z.string().trim().max(500).optional()}).strict(),
]);
export function authorizeFactReview(s:OrgState,m:Member,c:any){
 if(c?.type!=='verifyFact'&&c?.type!=='confirmUnusualValue')return;
 if(m.role!=='clinician')fail(403,c.type==='confirmUnusualValue'?'A clinician with current care scope is required to confirm an unusual value.':'A clinician with current care scope is required to verify or dispute a measurement.');
 const v=visit(s.workspace,c.visitId),p=person(s.workspace,v.personId);if(!allowed(m,p))fail(403,'This patient is outside your care scope.');
}
export function applyFactReview(s:OrgState,input:unknown,u:Actor,m:Member,now=new Date().toISOString()):any|null{
 const parsed=factReviewSchema.safeParse(input);if(!parsed.success)return null;const c=parsed.data;authorizeFactReview(s,m,c);
 if(c.type==='confirmUnusualValue')return confirmUnusual(s,c,u,m,now);
 const v=visit(s.workspace,c.visitId),label=MEASURE_LABEL[c.measure];
 if(v.voidedAt||v.supersededBy)fail(409,'This visit was corrected or marked as wrong-patient. Open the current visit.');
 if(v.state!=='confirmed')fail(409,'Only measurements on a confirmed visit can be verified or disputed.');
 if(v.recordVersion!==c.recordVersion)fail(409,'This visit changed. Refresh before reviewing its measurements.');
 if(!factMeasuresPresent(v.facts).includes(c.measure))fail(422,`${label} was not recorded on this visit.`);
 if(c.decision==='disputed'&&(c.reason??'').length<10)fail(422,'Explain the dispute in at least 10 characters.');
 // Slice 6z: a measurement with no recorded author (recorded before slice 2e) is treated as the confirmer's.
 if((v.factAuthors?.[c.measure]?.userId??v.patientCheck?.by)===u.userId)fail(403,'A different clinician must verify or dispute a measurement you recorded.');
 if(factReview(v,c.measure)?.state===c.decision)fail(409,`${label} is already ${c.decision}.`);
 if((v.factReviews?.length??0)>=100)fail(422,'Measurement review limit reached for this visit.');
 const r:FactReview={id:uuid(),measure:c.measure,state:c.decision,by:u.userId,byName:u.displayName,at:now,...(c.reason?{reason:c.reason}:{})};
 (v.factReviews??=[]).push(r);
 s.workspace.audit.push({id:uuid(),at:now,actorId:u.userId,actor:u.displayName,role:m.role,action:c.type,subject:v.id,personId:v.personId,detail:`${label} ${c.decision} by a clinician on a confirmed visit; facts unchanged.${c.reason?` Reason: ${c.reason}`:''}`});
 return {reviewId:r.id,measure:r.measure,state:r.state};
}
// Slice 2i: the clinician confirmation is bound to one override (value, unit entry and reason). It is appended to the
// visit and audited; facts and the visit version do not change, so the recorder's open draft stays current.
function confirmUnusual(s:OrgState,c:{visitId:string;version:number;field:(typeof VALUE_FIELDS)[number];overrideId:string;note?:string},u:Actor,m:Member,now:string){
 const v=visit(s.workspace,c.visitId),label=VALUE_RANGES.fields[c.field].label;
 if(v.voidedAt||v.supersededBy)fail(409,'This visit was corrected or marked as wrong-patient. Open the current visit.');
 if(v.state!=='draft')fail(409,'Unusual values are confirmed on the draft, before the visit is confirmed.');
 if(v.version!==c.version)fail(409,'This visit changed. Refresh before confirming an unusual value.');
 const o=currentOverride(v,c.field);if(!o||o.id!==c.overrideId)fail(409,`${label}: this unusual value is no longer the current one. Refresh the visit.`);
 if(valueTier(c.field,v.facts[c.field])!=='clinician')fail(409,`${label}: this value needs only the recorder's reason, not a clinician confirmation.`);
 // Slice 6ab: the confirmer must not be the value's recorder (the measurement's author) nor the author of any override
 // carrying the same value in this visit's history; rewording the reason or re-entering the value in another unit
 // credits a new override to someone else but does not make the original recorder independent.
 const measure=measureOf(c.field),recorder=measure?v.factAuthors?.[measure]?.userId:undefined;
 if(o.by.userId===u.userId||recorder===u.userId||(v.valueOverrides??[]).some(x=>x.field===c.field&&x.value===o.value&&x.by.userId===u.userId))fail(403,'A different clinician must confirm an unusual value you recorded.');
 if(overrideConfirmation(v,o))fail(409,`${label}: this unusual value is already confirmed.`);
 if((v.overrideConfirmations?.length??0)>=100)fail(422,'Unusual value confirmation limit reached for this visit.');
 const r:OverrideConfirmation={id:uuid(),overrideId:o.id,field:c.field,by:u.userId,byName:u.displayName,accountCode:m.accountCode,at:now,visitId:v.id,...(c.note?{note:c.note}:{})};
 (v.overrideConfirmations??=[]).push(r);
 s.workspace.audit.push({id:uuid(),at:now,actorId:u.userId,actor:u.displayName,role:m.role,action:'confirmUnusualValue',subject:v.id,personId:v.personId,detail:`${label} ${o.value} ${VALUE_RANGES.fields[c.field].unit} (outside ${rangeText(c.field,o.confirm)}) confirmed by a clinician who did not record it; facts unchanged. Recorder's reason: ${o.reason}${c.note?`. Note: ${c.note}`:''}`});
 return {confirmationId:r.id,field:r.field,overrideId:o.id};
}
// Slice 2i: appends an override (who, when, why, ranges version) for each unusual value whose value, unit entry or reason
// changed, and audits it. A correction draft starts from the corrected visit's history, so unchanged values keep their
// override and confirmation. Nothing is removed: earlier overrides stay as history.
function recordOverrides(v:Visit,base:Visit|undefined,old:Visit|undefined,actor:FactAuthor,s:OrgState,u:Actor,m:Member,now:string){
 if(!old&&base&&!v.valueOverrides){if(base.valueOverrides)v.valueOverrides=structuredClone(base.valueOverrides);if(base.overrideConfirmations)v.overrideConfirmations=structuredClone(base.overrideConfirmations);}
 const added:string[]=[];
 for(const field of VALUE_FIELDS){const reason=v.facts.unusual?.[field],value=v.facts[field];if(!reason||!value)continue;const tier=valueTier(field,value);if(tier==='expected')continue;
  const entered=v.facts.entered?.[field as 'weight'],last=[...(v.valueOverrides??[])].reverse().find(o=>o.field===field);
  if(last&&last.value===value&&last.reason===reason&&JSON.stringify(last.entered??null)===JSON.stringify(entered??null))continue;
  const r=VALUE_RANGES.fields[field];const o:ValueOverride={id:uuid(),field,value,unit:r.unit,...(entered?{entered:{...entered}}:{}),reason,tier,expected:[...r.expected],confirm:[...r.confirm],rangesVersion:VALUE_RANGES.version,by:{...actor},at:now,visitId:v.id};
  (v.valueOverrides??=[]).push(o);added.push(`${r.label} ${value} ${r.unit}${entered?` (entered as ${entered.value} ${entered.unit})`:''} outside ${rangeText(field,r.expected)}${tier==='clinician'?`, beyond ${rangeText(field,r.confirm)} so a clinician must confirm it`:''}; reason: ${reason}`);}
 if(added.length)s.workspace.audit.push({id:uuid(),at:now,actorId:u.userId,actor:u.displayName,role:m.role,action:'recordUnusualValue',subject:v.id,personId:v.personId,detail:`Unusual value recorded with a reason (${VALUE_RANGES.version}, ${VALUE_RANGES.status}): ${added.join('; ')}.`});
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
  recordOverrides(v,base,old,actor,after,u,m,now);
  if(!base&&!factMeasuresPresent(v.facts).length)continue;
  const authors=stampAuthors(base?.facts,v.facts,base?.factAuthors,actor);
  if(authors)v.factAuthors=authors;else delete v.factAuthors;
 }
}
