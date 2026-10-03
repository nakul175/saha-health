import { normallyAllowed } from './access';
import { digest, fail } from './core';
import { MEASURE_LABEL, entryContent, entryKeys, factMeasuresPresent, measureValue } from './fact-provenance';
import type { Dispute, DisputeResolution, Integration, Measure, Member, OrgState, Person, SignOff, SignOffWithdrawal, Visit } from './types';
// Slice 10g (BR-DATA-02): what stops a visit from being sent. One leaf module (it imports only core, fact-provenance
// and types) so that the executors (mis-execution, ehr-execution), the dispatcher and the screens ask the same questions.
//
// 1. Disputes. A care-team member raises a dispute on one confirmed fact, note or programme answer; it stays open until a
//    clinician appends a resolution (the dispute is never edited or removed). While it is open on a current visit, no
//    programme plan or EHR publication that would carry that item is prepared, approved or run.
// 2. Sign-off policy. The organisation default (slice 2g) can be overridden per programme and per destination by the
//    owner. A destination rule wins; otherwise the most protective rule of the programmes the send concerns applies;
//    otherwise the organisation default, which has only ever covered programme (MIS) destinations.
// 3. Sign-off withdrawal. A supervisor withdraws a current sign-off with a reason. The sign-off record stays; until a
//    supervisor signs the visit off again, sending is blocked, whatever the policy says (a withdrawal is a hold).
//
// Nothing here recalls anything already sent. Every check is pure over the stored state, so it can be repeated on a fresh
// read inside an execution checkpoint, immediately before a request leaves.
export type SignOffRule='required'|'not-required';
export type SignOffRules={programmes:Record<string,SignOffRule>;destinations:Record<string,SignOffRule>};
export type SignOffChange={at:string;by:string;byName:string;required:boolean;reason:string;kind?:'default'|'rules';rules?:SignOffRules};
export type SignOffPolicy={required:boolean;version:number;changes:SignOffChange[];rules?:SignOffRules};
export const signOffPolicy=(s:OrgState):SignOffPolicy=>(s.operations as {signOffPolicy?:SignOffPolicy}|undefined)?.signOffPolicy??{required:false,version:0,changes:[]};
export const signOffRules=(s:OrgState):SignOffRules=>signOffPolicy(s).rules??{programmes:{},destinations:{}};
const own=<T>(r:Record<string,T>|undefined|null,k:string):T|undefined=>r&&Object.prototype.hasOwnProperty.call(r,k)?r[k]:undefined;
// ---- sign-off content binding (moved here from visit-signoff so the executors need no further imports) ----
export const signOffHash=(v:Visit)=>digest({visitId:v.id,personId:v.personId,version:v.version,facts:v.facts,answers:entryContent(v).answers,absence:entryContent(v).absence,packs:(v.programmeCapture?.packs??[]).map(x=>[x.enrolmentId,x.pack.id,x.pack.version])});
export const withdrawalOf=(v:Pick<Visit,'signOffWithdrawals'>,signOffId:string):SignOffWithdrawal|null=>(v.signOffWithdrawals??[]).find(w=>w.signOffId===signOffId)??null;
const live=(v:Visit)=>v.state==='confirmed'&&!v.voidedAt&&!v.supersededBy;
// The latest sign-off, if it still matches the confirmed visit and has not been withdrawn; otherwise null.
export async function currentSignOff(v:Visit):Promise<SignOff|null>{const last=v.signOffs?.at(-1);if(!last||!live(v)||last.visitVersion!==v.version||withdrawalOf(v,last.id))return null;return last.contentHash===await signOffHash(v)?last:null;}
// A withdrawn latest sign-off with no later sign-off holds sending of the visit.
export const withdrawalHold=(v:Visit):SignOffWithdrawal|null=>{const last=v.signOffs?.at(-1);return last&&live(v)?withdrawalOf(v,last.id):null;};
// ---- disputes ----
export const DISPUTE_TARGET=/^(notes|fact:(bloodPressure|weight|temperature|weeks|coughDays)|answer:[A-Za-z0-9_-]{1,100})$/;
export const disputeLabel=(target:string,questionLabel?:string)=>target==='notes'?'Visit notes':target.startsWith('fact:')?MEASURE_LABEL[target.slice(5) as Measure]??target.slice(5):questionLabel??`Programme answer ${target.slice(7)}`;
// What can be disputed on a visit: each recorded measurement, the notes and each recorded programme answer.
export const disputeTargets=(v:Visit):string[]=>[...factMeasuresPresent(v.facts).map(m=>'fact:'+m),...entryKeys(v)];
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
export const resolutionOf=(v:Pick<Visit,'disputeResolutions'>,d:Pick<Dispute,'id'>):DisputeResolution|null=>(v.disputeResolutions??[]).find(r=>r.disputeId===d.id)??null;
// Open disputes that can stop a send: a dispute on a visit that was corrected or voided is closed by that, and the
// correction draft carries any still-open dispute forward (carryDisputes in visit-signoff).
export const openDisputes=(v:Visit):Dispute[]=>live(v)?(v.disputes??[]).filter(d=>!resolutionOf(v,d)):[];
const FIELDS:Record<string,string[]>={bloodPressure:['systolic','diastolic']};
// Would this destination carry the disputed item? Demonstration programme destinations record the whole visit. A mapped
// (HTTP) programme destination carries exactly the facts its mapping reads; programme answers are not part of any mapping
// yet, so an answer dispute stops every programme destination (fail closed). The EHR document carries every recorded
// measurement and the notes, and no programme answers. Other connection kinds are never sent a visit by Saha.
export function carries(i:Pick<Integration,'kind'|'mode'|'mis'>,target:string):boolean{
 if(i.kind==='mis'){
  if(i.mode!=='http'||target.startsWith('answer:'))return true;
  const src=new Set((i.mis?.mapping??[]).map(x=>String(x.source)));
  return target==='notes'?src.has('notes'):(FIELDS[target.slice(5)]??[target.slice(5)]).some(f=>src.has(f));
 }
 return i.kind==='ehr'&&!target.startsWith('answer:');
}
export const disputesFor=(v:Visit,i:Pick<Integration,'kind'|'mode'|'mis'>):Dispute[]=>openDisputes(v).filter(d=>carries(i,d.target));
// ---- sign-off policy resolution ----
export type SignOffNeed={required:boolean;basis:'destination'|'programme'|'organisation'|'none';programme?:string};
export function signOffRequirement(s:OrgState,i:Pick<Integration,'id'|'kind'|'programmes'>,p:Pick<Person,'programmes'>|undefined):SignOffNeed{
 const pol=signOffPolicy(s),rules=pol.rules,d=own(rules?.destinations,i.id);
 if(d)return {required:d==='required',basis:'destination'};
 const base=i.kind==='mis'&&pol.required,mine=p?.programmes??[],concerned=(i.programmes??[]).filter(x=>mine.includes(x)),progs=concerned.length?concerned:mine;
 const explicit=progs.filter(x=>own(rules?.programmes,x));
 const hit=progs.find(x=>(own(rules?.programmes,x)?own(rules?.programmes,x)==='required':base));
 if(hit)return {required:true,basis:own(rules?.programmes,hit)?'programme':'organisation',programme:hit};
 return {required:false,basis:explicit.length?'programme':'none'};
}
const basisText=(n:SignOffNeed,i:Pick<Integration,'name'>)=>n.basis==='destination'?`the sign-off rule for ${i.name}`:n.basis==='programme'?`the sign-off rule for ${n.programme}`:'your organisation’s sign-off policy';
const day=(at:string)=>at.slice(0,10);
// ---- the gate ----
export type SendBlock={kind:'dispute'|'withdrawn'|'sign-off';text:string;disputeIds:string[]};
const quote=(t:string)=>t.length>120?t.slice(0,117)+'...':t;
export function disputeBlock(v:Visit|undefined,i:Pick<Integration,'name'|'kind'|'mode'|'mis'>):SendBlock|null{
 if(!v)return null;const hit=disputesFor(v,i);if(!hit.length)return null;const d=hit[0];
 const more=hit.length>1?` and ${hit.length-1} more open dispute${hit.length>2?'s':''}`:'';
 return {kind:'dispute',disputeIds:hit.map(x=>x.id),text:`Open dispute on ${disputeLabel(d.target)}: “${quote(d.reason)}” (reference ${quote(d.reference)}), raised by ${d.byName} on ${day(d.at)}${more}. ${i.name} would receive ${hit.length>1?'these items':'this item'}, so nothing is prepared or sent there until a clinician resolves ${hit.length>1?'them':'it'}. Anything already sent is not recalled.`};
}
// phase 'prepare': disputes only (plans may be prepared and approved before sign-off). 'plan': executePlan, before any
// submission is created. 'checkpoint': inside the delivery checkpoint, where the sign-off wording of slice 2g is kept.
export async function sendBlock(s:OrgState,v:Visit|undefined,i:Pick<Integration,'id'|'name'|'kind'|'mode'|'mis'|'programmes'>,phase:'prepare'|'plan'|'checkpoint'):Promise<{block:SendBlock|null;signOff:SignOff|null}>{
 if(!v)return {block:null,signOff:null};
 const dispute=disputeBlock(v,i);if(dispute)return {block:dispute,signOff:null};
 if(phase==='prepare')return {block:null,signOff:null};
 const so=await currentSignOff(v),hold=so?null:withdrawalHold(v);
 if(hold)return {block:{kind:'withdrawn',disputeIds:[],text:`Sending is blocked: ${hold.byName} withdrew the supervisor sign-off on ${day(hold.at)} (“${quote(hold.reason)}”). A supervisor must sign the visit off again before it is sent. Anything already sent is not recalled.`},signOff:null};
 const need=signOffRequirement(s,i,s.workspace.people.find(x=>x.id===v.personId));
 if(need.required&&!so)return {block:{kind:'sign-off',disputeIds:[],text:phase==='plan'?`Supervisor sign-off is required before sending. Ask a supervisor of this patient’s team to sign off the confirmed visit. It is required for ${i.name} by ${basisText(need,i)}.`:`Supervisor sign-off is missing or stale: the visit or its programme answers changed after sign-off. Cancel this unsent ${i.kind==='ehr'?'publication':'delivery'} or obtain a new sign-off.`},signOff:null};
 return {block:null,signOff:so};
}
// Dispatcher check, before the command runs: preparing and approving plans stop on disputes; running a plan checks every
// recipient (disputes, withdrawal hold, sign-off policy). Returns the sign-off relied on, if any. Raw lookups only: the
// command itself reports a missing or out-of-scope record. The reason, reference and name in a dispute or withdrawal text
// are shown only to a member in the patient's normal care scope; anyone else who reaches this check (it runs before the
// command's own authority check) is told only that sending is blocked.
const GENERIC='Sending is blocked for this visit. Ask a member of the patient’s care team for the reason.';
export async function ensureCanSend(s:OrgState,c:{type:string;visitId?:unknown;planId?:unknown;recipients?:unknown;personId?:unknown;linkId?:unknown},m?:Member):Promise<SignOff|null>{
 const v=typeof c.visitId==='string'?s.workspace.visits.find(x=>x.id===c.visitId):undefined;if(!v)return null;
 const integration=(id:unknown)=>s.workspace.integrations.find(x=>x.id===id),pt=s.workspace.people.find(x=>x.id===v.personId);
 const stop=(b:SendBlock)=>fail(409,!m||(pt&&normallyAllowed(m,pt))||b.kind==='sign-off'?b.text:GENERIC);
 if(c.type==='preparePlan'&&Array.isArray(c.recipients)){for(const id of c.recipients){const i=integration(id);const b=i?disputeBlock(v,i):null;if(b)stop(b);}return null;}
 if(c.type==='prepareEhrPublish'){const i=integration(pt?.ehr?.links.find(l=>l.id===c.linkId)?.integrationId);const b=i?disputeBlock(v,i):null;if(b)stop(b);return null;}
 if((c.type==='approvePlan'||c.type==='executePlan')&&v.plan&&v.plan.id===c.planId){
  if(c.type==='executePlan'&&v.plan.state==='completed')return null;
  let relied:SignOff|null=null;
  for(const id of v.plan.recipients??[]){const i=integration(id);if(!i)continue;const g=await sendBlock(s,v,i,c.type==='executePlan'?'plan':'prepare');if(g.block)stop(g.block);relied=g.signOff??relied;}
  return c.type==='executePlan'?relied??await currentSignOff(v):null;
 }
 return null;
}
