import { z } from 'zod';
import { fail, person, uuid, visit } from './core';
import { normallyAllowed } from './access';
import { supervises, heldBy } from './delegation';
import { entryAuthor, entryKeys, entryReview } from './fact-provenance';
import { DISPUTE_TARGET, currentSignOff, disputeLabel, disputeTargets, ensureCanSend, openDisputes, resolutionOf, sendBlock, signOffHash, signOffPolicy, signOffRules, targetHash, targetText, type SignOffPolicy, type SignOffRules } from './send-gate';
import type { Actor } from './store';
import type { Dispute, DisputeResolution, EntryReview, Integration, Member, OrgState, SignOff, SignOffWithdrawal, Visit } from './types';
import { PROGRAMMES } from './types';
// Slice 10g: the sign-off helpers live in send-gate.ts (shared with the executors); re-exported so callers are unchanged.
export { currentSignOff, signOffHash, signOffPolicy } from './send-gate';
export type { SignOffPolicy } from './send-gate';
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
//
// Slice 10g adds, in the same module and under the same dispatch: raiseDispute / resolveDispute (an enforced dispute on a
// confirmed fact, note or answer, resolved only by a clinician's appended evidence), withdrawSignOff (a supervisor's
// appended withdrawal, which holds sending until the visit is signed off again), and setSignOffRules (owner-set sign-off
// rules per programme and per destination, sharing the policy's version). What those mean for a send is decided in
// send-gate.ts, which the dispatcher (ensureSignOff), executeMis and executeEhr all call.
const id=z.string().trim().min(1).max(200),entry=z.string().regex(/^(notes|answer:[A-Za-z0-9_-]{1,100})$/,'Choose the visit notes or one programme answer.');
const rule=z.enum(['required','not-required','inherit']),rv=z.number().int().positive();
export const signOffSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('verifyEntry'),visitId:id,recordVersion:z.number().int().positive(),entry,decision:z.enum(['verified','disputed']),reason:z.string().trim().max(500).optional()}).strict(),
 z.object({type:z.literal('signOffVisit'),visitId:id,recordVersion:z.number().int().positive(),note:z.string().trim().max(500).optional()}).strict(),
 z.object({type:z.literal('setSignOffPolicy'),required:z.boolean(),version:z.number().int().min(0),reason:z.string().trim().min(10,'Write at least 10 characters.').max(500)}).strict(),
 // Slice 10g: owner-set sign-off rules per programme and per destination ('inherit' removes a rule), a supervisor's
 // withdrawal of a current sign-off, and an enforced dispute with its clinician resolution.
 z.object({type:z.literal('setSignOffRules'),version:z.number().int().min(0),programmes:z.record(z.string().max(60),rule),destinations:z.record(z.string().max(200),rule),reason:z.string().trim().min(10,'Write at least 10 characters.').max(500)}).strict(),
 z.object({type:z.literal('withdrawSignOff'),visitId:id,recordVersion:rv,reason:z.string().trim().min(10,'Explain the withdrawal in at least 10 characters.').max(500)}).strict(),
 z.object({type:z.literal('raiseDispute'),visitId:id,recordVersion:rv,target:z.string().regex(DISPUTE_TARGET,'Choose a recorded measurement, the visit notes or one programme answer.'),reason:z.string().trim().min(10,'Explain the dispute in at least 10 characters.').max(500),reference:z.string().trim().min(3,'Say where the conflicting information comes from (at least 3 characters).').max(200)}).strict(),
 z.object({type:z.literal('resolveDispute'),visitId:id,recordVersion:rv,disputeId:id,outcome:z.enum(['stands','corrected']),evidence:z.string().trim().min(10,'Write the evidence for the resolution in at least 10 characters.').max(500),reference:z.string().trim().max(200).optional()}).strict(),
]);
const TYPES=new Set(['verifyEntry','signOffVisit','setSignOffPolicy','setSignOffRules','withdrawSignOff','raiseDispute','resolveDispute']);
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
 if(c.type==='setSignOffPolicy'||c.type==='setSignOffRules'){if(!m.isOwner||m.status!=='active')fail(403,'Only an organisation owner can change the sign-off policy.');return;}
 const v=visit(s.workspace,c.visitId),p=person(s.workspace,v.personId);
 if(c.type==='verifyEntry'){if(m.role!=='clinician')fail(403,'A clinician with current care scope is required to verify or dispute notes and answers.');if(!normallyAllowed(m,p))fail(403,'This patient is outside your care scope.');return;}
 // Slice 10g: any care-team member in normal scope may raise a dispute (it only stops sending); a clinician resolves it.
 if(c.type==='raiseDispute'){if(!['asha','clinician','supervisor'].includes(m.role)||m.status!=='active')fail(403,'A care-team member with current care scope can raise a dispute.');if(!normallyAllowed(m,p))fail(403,'This patient is outside your care scope.');return;}
 if(c.type==='resolveDispute'){if(m.role!=='clinician')fail(403,'A clinician with current care scope is required to resolve a dispute.');if(!normallyAllowed(m,p))fail(403,'This patient is outside your care scope.');return;}
 if(!supervises(s,m,p.teamId,undefined,record))fail(403,c.type==='withdrawSignOff'?"Only a supervisor of the patient's team, or a current supervision delegate, can withdraw a sign-off.":"Only a supervisor of the patient's team, or a current supervision delegate, can sign off a submission.");
}
export async function applySignOff(s:OrgState,input:unknown,u:Actor,m:Member,now=new Date().toISOString()):Promise<any|null>{
 const parsed=signOffSchema.safeParse(input);if(!parsed.success)return null;const c=parsed.data;authorizeSignOff(s,m,c,true);
 if(c.type==='setSignOffPolicy'){
  const ops=s.operations??{version:0,maintenance:false,reason:'',updatedAt:'',incidents:[],rates:null},old=signOffPolicy(s);
  if(old.version!==c.version)fail(409,'The sign-off policy changed. Refresh before changing it.');if(old.required===c.required)fail(409,`Supervisor sign-off is already ${c.required?'required':'not required'}.`);
  if(old.changes.length>=200)fail(422,'Sign-off policy change limit reached.');
  const next:SignOffPolicy={...old,required:c.required,version:old.version+1,changes:[...old.changes,{at:now,by:u.userId,byName:u.displayName,required:c.required,reason:c.reason,kind:'default'}]};
  (ops as {signOffPolicy?:SignOffPolicy}).signOffPolicy=next;s.operations=ops;
  s.workspace.audit.push({id:uuid(),at:now,actorId:u.userId,actor:u.displayName,role:m.role,action:c.type,subject:s.organisation.id,detail:`Supervisor sign-off before sending programme submissions ${c.required?'required':'no longer required'} as the organisation default (policy version ${next.version}); programme and destination rules are unchanged. ${c.reason}`});
  return {required:next.required,version:next.version};
 }
 // Slice 10g: sign-off rules per programme and per destination. The map replaces the previous rules ('inherit' removes
 // one); the policy version is shared with the organisation default, so a stale view is refused whichever part it edits.
 if(c.type==='setSignOffRules'){
  const ops=s.operations??{version:0,maintenance:false,reason:'',updatedAt:'',incidents:[],rates:null},old=signOffPolicy(s),prior=signOffRules(s);
  if(old.version!==c.version)fail(409,'The sign-off policy changed. Refresh before changing it.');
  const rules:SignOffRules={programmes:{},destinations:{}};
  for(const [k,r] of Object.entries(c.programmes)){if(!(PROGRAMMES as string[]).includes(k))fail(422,`${k.slice(0,40)} is not a programme.`);if(r!=='inherit')rules.programmes[k]=r;}
  for(const [k,r] of Object.entries(c.destinations)){const i=s.workspace.integrations.find(x=>x.id===k);if(!i||!['mis','ehr'].includes(i.kind))fail(422,'Sign-off rules apply to programme and EHR destinations only.');if(r!=='inherit')rules.destinations[k]=r;}
  if(Object.keys(rules.programmes).length+Object.keys(rules.destinations).length>60)fail(422,'Too many sign-off rules.');
  if(JSON.stringify(sortKeys(rules))===JSON.stringify(sortKeys(prior)))fail(409,'Nothing changed.');
  if(old.changes.length>=200)fail(422,'Sign-off policy change limit reached.');
  const next:SignOffPolicy={...old,version:old.version+1,rules,changes:[...old.changes,{at:now,by:u.userId,byName:u.displayName,required:old.required,reason:c.reason,kind:'rules',rules}]};
  (ops as {signOffPolicy?:SignOffPolicy}).signOffPolicy=next;s.operations=ops;
  const line=(r:Record<string,string>,name:(k:string)=>string)=>Object.entries(r).map(([k,x])=>`${name(k)} ${x}`).join(', ')||'none';
  s.workspace.audit.push({id:uuid(),at:now,actorId:u.userId,actor:u.displayName,role:m.role,action:c.type,subject:s.organisation.id,detail:`Supervisor sign-off rules set (policy version ${next.version}). Programmes: ${line(rules.programmes,k=>k)}. Destinations: ${line(rules.destinations,k=>s.workspace.integrations.find(x=>x.id===k)?.name??k)}. A destination rule wins over programme rules, which win over the organisation default (${old.required?'required':'not required'}, programme destinations only). Sends already made are not affected. ${c.reason}`});
  return {version:next.version,programmes:rules.programmes,destinations:rules.destinations};
 }
 const v=visit(s.workspace,c.visitId);current(v);if(v.recordVersion!==c.recordVersion)fail(409,'This visit changed. Refresh before continuing.');
 if(c.type==='raiseDispute'){
  if(!disputeTargets(v).includes(c.target))fail(422,'That measurement, note or answer was not recorded on this visit.');
  if(openDisputes(v).some(d=>d.target===c.target))fail(409,'This item already has an open dispute. A clinician resolves it first.');
  if((v.disputes?.length??0)>=50)fail(422,'Dispute limit reached for this visit.');
  const d:Dispute={id:uuid(),target:c.target,reason:c.reason,reference:c.reference,by:u.userId,byName:u.displayName,accountCode:m.accountCode,role:m.role,at:now,visitVersion:v.version,contentHash:await targetHash(v,c.target),valueText:targetText(v,c.target)};(v.disputes??=[]).push(d);
  s.workspace.audit.push({id:uuid(),at:now,actorId:u.userId,actor:u.displayName,role:m.role,action:c.type,subject:v.id,personId:v.personId,detail:`${disputeLabel(c.target)} disputed on a confirmed visit; sending to any destination that would carry it is blocked until a clinician resolves the dispute. Content unchanged. Reason: ${c.reason} Reference: ${c.reference}`});
  return {disputeId:d.id,target:d.target};
 }
 if(c.type==='resolveDispute'){
  const d=(v.disputes??[]).find(x=>x.id===c.disputeId);if(!d)fail(404,'Dispute not found on this visit.');if(resolutionOf(v,d))fail(409,'This dispute is already resolved.');
  const same=await targetHash(v,d.target)===d.contentHash;
  if(c.outcome==='stands'){
   if(!same)fail(409,'The disputed content has changed since the dispute was raised, so it cannot stand. Resolve it as corrected, with evidence.');
   if(d.by===u.userId)fail(403,'A different clinician must close a dispute you raised.');
   if(presumedTargetAuthors(v,d.target).has(u.userId))fail(403,'A different clinician from the one who recorded this must close the dispute as standing.');
  }
  else if(same)fail(409,'The disputed content has not changed. Correct the visit first (a correction draft carries the dispute forward), or resolve it as standing if the recorded value is right.');
  if((v.disputeResolutions?.length??0)>=50)fail(422,'Resolution limit reached for this visit.');
  const r:DisputeResolution={id:uuid(),disputeId:d.id,outcome:c.outcome,by:u.userId,byName:u.displayName,accountCode:m.accountCode,at:now,evidence:c.evidence,...(c.reference?{reference:c.reference}:{})};(v.disputeResolutions??=[]).push(r);
  s.workspace.audit.push({id:uuid(),at:now,actorId:u.userId,actor:u.displayName,role:m.role,action:c.type,subject:v.id,personId:v.personId,detail:`Dispute on ${disputeLabel(d.target)} resolved as ${c.outcome==='stands'?'standing as recorded':'corrected'} by a clinician; the dispute and its reason are kept. Evidence: ${c.evidence}${c.reference?` Reference: ${c.reference}`:''}`});
  return {resolutionId:r.id,disputeId:d.id,outcome:r.outcome};
 }
 if(c.type==='withdrawSignOff'){
  const last=await currentSignOff(v);if(!last)fail(409,'This visit has no current sign-off to withdraw.');
  const p=person(s.workspace,v.personId),delegated=m.role==='supervisor'||m.isOwner?undefined:heldBy(s,m,'team-supervision',now).find(d=>d.teamIds.includes(p.teamId));
  if((v.signOffWithdrawals?.length??0)>=50)fail(422,'Withdrawal limit reached for this visit.');
  const w:SignOffWithdrawal={id:uuid(),signOffId:last.id,by:u.userId,byName:u.displayName,accountCode:m.accountCode,role:m.role,at:now,reason:c.reason,...(delegated?{delegationId:delegated.id}:{})};(v.signOffWithdrawals??=[]).push(w);
  s.workspace.audit.push({id:uuid(),at:now,actorId:u.userId,actor:u.displayName,role:m.role,action:c.type,subject:v.id,personId:v.personId,detail:`Supervisor sign-off by ${last.byName} withdrawn before sending; the sign-off record is kept. Sending of this visit is blocked until a supervisor signs it off again. Anything already sent is not recalled. Reason: ${c.reason}`});
  return {withdrawalId:w.id,signOffId:last.id};
 }
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
// Server check before the dispatcher runs a plan command. Slice 10g: preparePlan, approvePlan and prepareEhrPublish stop on
// open disputes that the destination would carry; executePlan also applies the withdrawal hold and the sign-off policy
// per destination (send-gate.ts). Returns the sign-off relied on, if any.
export const ensureSignOff=ensureCanSend;
// Server check inside the delivery checkpoint (executeMis), run on the state it then checkpoints and again on a fresh read
// immediately before the request: disputes, withdrawal hold and the sign-off rule for this destination.
export async function ensureSendSignOff(s:OrgState,visitId:string,i:Pick<Integration,'id'|'name'|'kind'|'mode'|'mis'|'programmes'>){const v=s.workspace.visits.find(x=>x.id===visitId);const g=await sendBlock(s,v,i,'checkpoint');if(g.block)fail(409,g.block.text);return g.signOff;}
// Slice 10g: the presumed authors of a disputed item, for the not-your-own rule when a dispute is closed as standing.
export const presumedTargetAuthors=(v:Visit,target:string)=>target.startsWith('fact:')?new Set([v.factAuthors?.[target.slice(5) as keyof NonNullable<Visit['factAuthors']>]?.userId??v.patientCheck?.by].filter((x):x is string=>!!x)):presumedEntryAuthors(v,target);
const sortKeys=(r:SignOffRules)=>({programmes:Object.fromEntries(Object.entries(r.programmes).sort()),destinations:Object.fromEntries(Object.entries(r.destinations).sort())});
// After a command: a new correction draft carries the still-open disputes of the visit it corrects (a correction must
// resolve them, or an amendment would clear a dispute without anyone answering it). Resolved disputes are not carried.
export function carryDisputes(before:OrgState,after:OrgState,u:Actor,m:Member,now=new Date().toISOString()){
 const known=new Set(before.workspace.visits.map(v=>v.id));
 for(const v of after.workspace.visits){
  if(known.has(v.id)||!v.amendsVisitId||v.disputes?.length)continue;const base=after.workspace.visits.find(x=>x.id===v.amendsVisitId);if(!base)continue;
  const open=(base.disputes??[]).filter(d=>!resolutionOf(base,d)&&disputeTargets(v).includes(d.target));if(!open.length)continue;
  v.disputes=open.map(d=>({...d,id:uuid(),visitVersion:v.version,carriedFrom:d.id}));
  after.workspace.audit.push({id:uuid(),at:now,actorId:u.userId,actor:u.displayName,role:m.role,action:'carryDisputes',subject:v.id,personId:v.personId,detail:`${open.length} open dispute${open.length===1?'':'s'} carried from the corrected visit to this correction draft (${open.map(d=>disputeLabel(d.target)).join(', ')}). They block sending until a clinician resolves them on the corrected visit.`});
 }
}
// Marks the submissions a command just created with the sign-off relied on (shown in the submissions view).
export function stampSubmissions(before:OrgState,after:OrgState,so:SignOff|null){if(!so)return;const seen=new Set(before.workspace.submissions.map(x=>x.id));for(const x of after.workspace.submissions)if(!seen.has(x.id))x.signOff={id:so.id,by:so.by,byName:so.byName,at:so.at};}
