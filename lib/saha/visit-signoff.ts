import { z } from 'zod';
import { digest, fail, person, uuid, visit } from './core';
import { normallyAllowed } from './access';
import { supervises, heldBy } from './delegation';
import { entryAuthor, entryContent, entryKeys, entryReview } from './fact-provenance';
import type { Actor } from './store';
import type { EntryReview, Member, OrgState, SignOff, Visit } from './types';
// Slice 2g (BR-DATA-02): clinician verification of visit notes and programme answers, and optional supervisor
// sign-off before a programme submission is sent.
//
// verifyEntry: a clinician in the patient's normal care scope (emergency access does not count) verifies or disputes
// the visit notes ('notes') or one programme answer ('answer:<question id>') of a current confirmed visit that they did
// not record. Reviews are appended (latest wins); each one changes the visit record (a record revision) and is audited.
//
// Sign-off: an owner turns the organisation's "supervisor sign-off before sending" policy on or off (audited, versioned).
// While it is on, executePlan (which sends demo destinations and queues HTTP ones) and sendSubmission refuse unless the
// visit has a current sign-off: one recorded by a supervisor of the patient's team (the 1e helper, which includes an
// owner with a care role in the team and a team-supervision delegate) who did not confirm or record the visit, bound to
// the visit version and a SHA-256 of its facts and programme answers. Any later change to either makes it stale.
// sendSubmission checks it inside executeMis on the state it then checkpoints, so a stale sign-off never authorizes a send.
const id=z.string().trim().min(1).max(200),entry=z.string().regex(/^(notes|answer:[A-Za-z0-9_-]{1,100})$/,'Choose the visit notes or one programme answer.');
export const signOffSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('verifyEntry'),visitId:id,recordVersion:z.number().int().positive(),entry,decision:z.enum(['verified','disputed']),reason:z.string().trim().max(500).optional()}).strict(),
 z.object({type:z.literal('signOffVisit'),visitId:id,recordVersion:z.number().int().positive(),note:z.string().trim().max(500).optional()}).strict(),
 z.object({type:z.literal('setSignOffPolicy'),required:z.boolean(),version:z.number().int().min(0),reason:z.string().trim().min(10,'Write at least 10 characters.').max(500)}).strict(),
]);
export type SignOffPolicy={required:boolean;version:number;changes:{at:string;by:string;byName:string;required:boolean;reason:string}[]};
export const signOffPolicy=(s:OrgState):SignOffPolicy=>(s.operations as {signOffPolicy?:SignOffPolicy}|undefined)?.signOffPolicy??{required:false,version:0,changes:[]};
const TYPES=new Set(['verifyEntry','signOffVisit','setSignOffPolicy']);
const current=(v:Visit)=>{if(v.voidedAt||v.supersededBy)fail(409,'This visit was corrected or marked as wrong-patient. Open the current visit.');if(v.state!=='confirmed')fail(409,'Only a confirmed visit can be reviewed or signed off.');};
// Everyone who recorded part of the visit: its confirmer and the authors of measurements, notes and answers.
// Slice 6z (sixth review): the person who last saved the programme answers (programmeCapture.savedBy) is a recorder too,
// so a visit recorded before slice 2g (no per-entry authors) cannot be signed off by whoever saved its answers.
const recorders=(v:Visit)=>new Set([v.patientCheck?.by,v.programmeCapture?.savedBy,v.noteAuthor?.userId,...Object.values(v.answerAuthors??{}).map(a=>a.userId),...Object.values(v.factAuthors??{}).map(a=>a?.userId)].filter(Boolean));
// Slice 6z: when no author is recorded for an entry (visits recorded before slice 2g), the visit's confirmer and, for a
// programme answer, the person who saved the programme answers are treated as its authors for the not-your-own rule.
export const presumedEntryAuthors=(v:Visit,entry:string)=>{const a=entryAuthor(v,entry)?.userId;return new Set((a?[a]:[v.patientCheck?.by,entry==='notes'?undefined:v.programmeCapture?.savedBy]).filter((x):x is string=>!!x));};
export function authorizeSignOff(s:OrgState,m:Member,c:any,record=false){
 if(!TYPES.has(c?.type))return;
 if(c.type==='setSignOffPolicy'){if(!m.isOwner||m.status!=='active')fail(403,'Only an organisation owner can change the sign-off policy.');return;}
 const v=visit(s.workspace,c.visitId),p=person(s.workspace,v.personId);
 if(c.type==='verifyEntry'){if(m.role!=='clinician')fail(403,'A clinician with current care scope is required to verify or dispute notes and answers.');if(!normallyAllowed(m,p))fail(403,'This patient is outside your care scope.');return;}
 if(!supervises(s,m,p.teamId,undefined,record))fail(403,"Only a supervisor of the patient's team, or a current supervision delegate, can sign off a submission.");
}
// The content a sign-off is bound to.
export const signOffHash=(v:Visit)=>digest({visitId:v.id,personId:v.personId,version:v.version,facts:v.facts,answers:entryContent(v).answers,absence:entryContent(v).absence,packs:(v.programmeCapture?.packs??[]).map(x=>[x.enrolmentId,x.pack.id,x.pack.version])});
// The latest sign-off, if it still matches the confirmed visit; otherwise null.
export async function currentSignOff(v:Visit):Promise<SignOff|null>{const last=v.signOffs?.at(-1);if(!last||v.state!=='confirmed'||v.voidedAt||v.supersededBy||last.visitVersion!==v.version)return null;return last.contentHash===await signOffHash(v)?last:null;}
export async function applySignOff(s:OrgState,input:unknown,u:Actor,m:Member,now=new Date().toISOString()):Promise<any|null>{
 const parsed=signOffSchema.safeParse(input);if(!parsed.success)return null;const c=parsed.data;authorizeSignOff(s,m,c,true);
 if(c.type==='setSignOffPolicy'){
  const ops=s.operations??{version:0,maintenance:false,reason:'',updatedAt:'',incidents:[],rates:null},old=signOffPolicy(s);
  if(old.version!==c.version)fail(409,'The sign-off policy changed. Refresh before changing it.');if(old.required===c.required)fail(409,`Supervisor sign-off is already ${c.required?'required':'not required'}.`);
  if(old.changes.length>=200)fail(422,'Sign-off policy change limit reached.');
  const next:SignOffPolicy={required:c.required,version:old.version+1,changes:[...old.changes,{at:now,by:u.userId,byName:u.displayName,required:c.required,reason:c.reason}]};
  (ops as {signOffPolicy?:SignOffPolicy}).signOffPolicy=next;s.operations=ops;
  s.workspace.audit.push({id:uuid(),at:now,actorId:u.userId,actor:u.displayName,role:m.role,action:c.type,subject:s.organisation.id,detail:`Supervisor sign-off before sending programme submissions ${c.required?'required':'no longer required'} (policy version ${next.version}). ${c.reason}`});
  return {required:next.required,version:next.version};
 }
 const v=visit(s.workspace,c.visitId);current(v);if(v.recordVersion!==c.recordVersion)fail(409,'This visit changed. Refresh before continuing.');
 if(c.type==='verifyEntry'){
  if(!entryKeys(v).includes(c.entry))fail(422,c.entry==='notes'?'No visit notes were recorded on this visit.':'This programme answer was not recorded on this visit.');
  const label=c.entry==='notes'?'Visit notes':`Programme answer ${c.entry.slice(7)}`;
  if(c.decision==='disputed'&&(c.reason??'').length<10)fail(422,'Explain the dispute in at least 10 characters.');
  if(presumedEntryAuthors(v,c.entry).has(u.userId))fail(403,'A different clinician must verify or dispute an entry you recorded.');
  if(entryReview(v,c.entry)?.state===c.decision)fail(409,`${label} already ${c.decision}.`);
  if((v.entryReviews?.length??0)>=200)fail(422,'Review limit reached for this visit.');
  const r:EntryReview={id:uuid(),entry:c.entry,state:c.decision,by:u.userId,byName:u.displayName,at:now,...(c.reason?{reason:c.reason}:{})};(v.entryReviews??=[]).push(r);
  s.workspace.audit.push({id:uuid(),at:now,actorId:u.userId,actor:u.displayName,role:m.role,action:c.type,subject:v.id,personId:v.personId,detail:`${label} ${c.decision} by a clinician on a confirmed visit; content unchanged.${c.reason?` Reason: ${c.reason}`:''}`});
  return {reviewId:r.id,entry:r.entry,state:r.state};
 }
 if(recorders(v).has(u.userId))fail(403,'A different person must sign off a visit you confirmed or recorded.');
 if(await currentSignOff(v))fail(409,'This visit already has a current sign-off.');
 if((v.signOffs?.length??0)>=50)fail(422,'Sign-off limit reached for this visit.');
 const p=person(s.workspace,v.personId),delegated=m.role==='supervisor'||m.isOwner?undefined:heldBy(s,m,'team-supervision',now).find(d=>d.teamIds.includes(p.teamId));
 const so:SignOff={id:uuid(),by:u.userId,byName:u.displayName,accountCode:m.accountCode,role:m.role,at:now,visitVersion:v.version,contentHash:await signOffHash(v),...(delegated?{delegationId:delegated.id}:{}),...(c.note?{note:c.note}:{})};(v.signOffs??=[]).push(so);
 s.workspace.audit.push({id:uuid(),at:now,actorId:u.userId,actor:u.displayName,role:m.role,action:c.type,subject:v.id,personId:v.personId,detail:`Visit revision ${v.version} signed off for sending to programme destinations; bound to its facts and programme answers.${c.note?` Note: ${c.note}`:''}`});
 return {signOffId:so.id};
}
// Server check before executePlan sends or queues programme submissions. Returns the sign-off relied on, if any.
export async function ensureSignOff(s:OrgState,c:{type:string;visitId?:unknown;planId?:unknown}):Promise<SignOff|null>{
 if(c.type!=='executePlan'||typeof c.visitId!=='string')return null;const v=s.workspace.visits.find(x=>x.id===c.visitId);if(!v||!v.plan||v.plan.id!==c.planId||v.plan.state==='completed')return null;
 const so=await currentSignOff(v);if(signOffPolicy(s).required&&!so)fail(409,'Supervisor sign-off is required before sending. Ask a supervisor of this patient’s team to sign off the confirmed visit.');return so;
}
// Server check inside the delivery checkpoint (executeMis): a current sign-off when the policy is on.
export async function ensureSendSignOff(s:OrgState,visitId:string){const v=s.workspace.visits.find(x=>x.id===visitId);const so=v?await currentSignOff(v):null;if(signOffPolicy(s).required&&!so)fail(409,'Supervisor sign-off is missing or stale: the visit or its programme answers changed after sign-off. Cancel this unsent delivery or obtain a new sign-off.');return so;}
// Marks the submissions a command just created with the sign-off relied on (shown in the submissions view).
export function stampSubmissions(before:OrgState,after:OrgState,so:SignOff|null){if(!so)return;const seen=new Set(before.workspace.submissions.map(x=>x.id));for(const x of after.workspace.submissions)if(!seen.has(x.id))x.signOff={id:so.id,by:so.by,byName:so.byName,at:so.at};}
