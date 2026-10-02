import { z } from 'zod';
import { fail, person, uuid } from './core';
import { normallyAllowed } from './access';
import { supervises } from './delegation';
import { operationRefusal } from './adapter-operations';
import { TERMINAL } from './referral-rules';
import type { Actor } from './store';
import type { CorrectionTask, Member, OrgState, Person, Visit } from './types';

// Slice 2j: correction propagation (BR-DATA-06, BR-RULE-04).
//
// When a confirmed visit is amended (a correction draft supersedes it) or voided (recorded against the wrong
// patient), every downstream output that used that version becomes one explicit, owned task on the earlier visit:
//
// - External outputs (programme submissions and EHR publications). Nothing is sent, recalled or rewritten
//   automatically. When the destination supports corrections (a programme destination with correction support
//   whose operation setting permits `update`) and the visit was amended, the task is to send the correction
//   through the normal path: confirm the correction visit, then prepare, approve and execute its plan, which sends
//   a correction replacing the earlier receipt. Otherwise the task is a manual correction with the destination,
//   closed with evidence. An unknown outcome is looked up first; an unsent delivery is cancelled (the server
//   already refuses to send a delivery whose visit is no longer current).
// - Internal outputs. Work the server already refuses on a superseded or voided visit (pending plans, prepared
//   EHR publications, open assistant requests) is recorded as invalidated; worker-activity evidence and
//   indicators are recomputed on every read and recorded as such. Outputs a person must judge (referrals and
//   follow-ups created from the visit, protocol evaluations, applied assistant results, shadow comparisons and
//   indicator figures already released) become review tasks.
//
// Closing an open task needs evidence: a Saha receipt id of the accepted correction (checked against the
// destination and the correction chain) or a reason of at least 10 characters, with an optional destination
// reference. Closing is audited and never changes the output itself. Tasks are stored on the earlier visit and
// are never deleted.
export const CORRECTION_RULES_VERSION='1.0.0';
export const CORRECTION_KIND_LABEL:Record<CorrectionTask['output']['kind'],string>={'programme-submission':'Programme submission','ehr-publication':'EHR publication',plan:'Sharing plan',referral:'Referral','follow-up':'Follow-up','protocol-evaluation':'Protocol evaluation','assistant-result':'Assistant result','shadow-comparison':'Shadow comparison','worker-activity':'Worker activity','indicator-releases':'Indicator releases'};
export const CORRECTION_ACTION_LABEL:Record<CorrectionTask['action'],string>={'send-correction':'Send the destination\'s correction','manual-correction':'Manual correction with the destination','look-up-first':'Look up the outcome first','cancel-unsent':'Cancel the unsent delivery',review:'Review',invalidated:'Invalidated',recomputed:'Recomputed on read'};
const MAX_TASKS=60;

// The visits that correct `id`, directly or through later corrections (the amends chain, newest last).
export function correctionsOf(s:OrgState,id:string):Visit[]{
 const out:Visit[]=[],seen=new Set<string>([id]);let cur=id;
 for(;;){const next=s.workspace.visits.find(v=>v.amendsVisitId===cur);if(!next||seen.has(next.id))return out;seen.add(next.id);out.push(next);cur=next.id;}
}

export function correctionTasks(s:OrgState,v:Visit,cause:'amend'|'void',u:Actor,now:string,correctionVisitId:string|null):CorrectionTask[]{
 const w=s.workspace,p=person(w,v.personId),tasks:CorrectionTask[]=[];
 const add=(t:Omit<CorrectionTask,'id'|'visitId'|'correctionVisitId'|'cause'|'createdAt'|'createdBy'|'ownerId'|'state'>&{state?:CorrectionTask['state']})=>tasks.push({id:uuid(),visitId:v.id,correctionVisitId,cause,createdAt:now,createdBy:u.userId,ownerId:u.userId,state:t.state??'open',...t});
 const amend=cause==='amend';
 // Programme submissions of this version.
 for(const x of w.submissions)if(x.visitId===v.id){
  const i=w.integrations.find(y=>y.id===x.connectorId),destination={id:x.connectorId,name:x.connectorName},output={kind:'programme-submission' as const,refId:x.id,label:`${x.connectorName} submission`,stateAtCorrection:x.state,destination,receipt:x.receipt??null};
  if(x.state==='accepted'){
   const supports=amend&&!!i?.mis?.corrections&&!operationRefusal(i,'update','patient');
   if(supports)add({output,external:true,action:'send-correction',instruction:`${x.connectorName} accepted receipt ${x.receipt??'(none recorded)'}. Confirm the correction visit, then prepare, approve and execute its plan: the destination receives a correction replacing that receipt. Nothing is sent automatically.`});
   else add({output,external:true,action:'manual-correction',instruction:amend?`${x.connectorName} accepted receipt ${x.receipt??'(none recorded)'} and this destination has no correction path enabled in Saha. Correct the record with the destination by its own process and record the outcome here.`:`${x.connectorName} accepted receipt ${x.receipt??'(none recorded)'} for the wrong patient. Saha has no void operation for programme destinations: ask the destination to reverse or void it and record the outcome here.`});
  }else if(x.state==='uncertain'||x.state==='sending')add({output,external:true,action:'look-up-first',instruction:`The outcome at ${x.connectorName} is unknown. Look up the receipt first; if it was received, correct or reverse it with the destination. Never resend blindly.`});
  else if(x.state==='queued'||x.state==='retryable')add({output,external:true,action:'cancel-unsent',instruction:`This delivery was not sent and can no longer be sent from the earlier version. Cancel it; ${amend?'the correction visit gets its own plan':'nothing reaches the destination'}.`});
 }
 // EHR publications of this version.
 for(const o of p.ehr?.operations??[])if(o.visitId===v.id){
  const output={kind:'ehr-publication' as const,refId:o.id,label:'EHR publication',stateAtCorrection:o.state,receipt:o.receipt??null};
  if(o.state==='accepted')add({output,external:true,action:'manual-correction',instruction:`The EHR accepted document ${o.receipt??'(no identifier recorded)'}. Saha has no EHR amendment or void path: ${amend?'amend':'withdraw'} it with the EHR by its own process and record the outcome here.`});
  else if(o.state==='uncertain'||o.state==='running')add({output,external:true,action:'look-up-first',instruction:'The EHR outcome is unknown. Look up the document identifier with the EHR first; if it was received, correct or withdraw it there. Never publish again blindly.'});
  else if(o.state==='prepared')add({output,external:false,action:'invalidated',state:'done',instruction:'The prepared publication can no longer be executed: the server refuses publication of a visit that is not current.'});
 }
 // The visit's sharing plan.
 if(v.plan&&v.plan.state!=='completed')add({output:{kind:'plan',refId:v.plan.id,label:'Sharing plan',stateAtCorrection:v.plan.state},external:false,action:'invalidated',state:'done',instruction:'The plan was blocked and cannot be approved or executed.'});
 // Referrals created from this visit, or naming it as a source, that are still open.
 for(const r of w.referrals)if(r.personId===p.id&&!TERMINAL.has(r.state)&&(r.visitId===v.id||r.sources?.some(x=>x.visitId===v.id)))
  add({output:{kind:'referral',refId:r.id,label:`Referral to ${r.facility}`,stateAtCorrection:r.state},external:false,action:'review',instruction:amend?'Check that the referral still follows from the corrected facts; record a referral event or close it with a reason. If the facility was told, tell them of the correction.':'This referral was made from a visit recorded against the wrong patient. Cancel it or confirm it applies, and tell the facility if it was contacted.'});
 // Open follow-ups created between this visit's confirmation and the correction. Follow-ups do not record the
 // visit that created them, so these are listed as possible dependants for review.
 for(const f of p.followUps??[])if(f.state==='open'&&v.confirmedAt&&f.createdAt>=v.confirmedAt&&f.createdAt<=now)
  add({output:{kind:'follow-up',refId:f.id,label:`Follow-up "${f.title}"`,stateAtCorrection:f.state},external:false,action:'review',instruction:'Created after this visit was confirmed, so it may depend on it. Keep it, reschedule it or close it with a reason.'});
 // Protocol evaluations of this version.
 for(const c of v.protocolChecks??[]){
  const output={kind:'protocol-evaluation' as const,refId:c.id,label:`Protocol evaluation (${c.findings.length} finding${c.findings.length===1?'':'s'})`,stateAtCorrection:c.decision?`decided: ${c.decision.decision}`:'undecided'};
  if(!c.decision&&!c.findings.length)add({output,external:false,action:'invalidated',state:'done',instruction:'No findings and no decision; the evaluation is not offered for review on a visit that is not current.'});
  else add({output,external:false,action:'review',instruction:c.decision?`A clinician decided on findings from the earlier facts. ${amend?'Run the protocol check on the confirmed correction visit and review it; ':'Confirm nothing was acted on for this patient; '}the earlier decision is kept.`:`Findings from the earlier facts are no longer listed for review. ${amend?'Run the protocol check on the confirmed correction visit.':'Confirm nothing was acted on for this patient.'}`});
 }
 // Assistant results on this version.
 for(const r of v.agentRuns??[]){
  const output={kind:'assistant-result' as const,refId:r.id,label:`Assistant ${r.task} (${r.provider.name})`,stateAtCorrection:r.status};
  if(r.status==='applied')add({output,external:false,action:'review',instruction:amend?'Values from this assistant result were applied to the earlier version and copied into the correction draft. Check each one against the source before confirming the correction.':'Values from this assistant result were applied to a visit recorded against the wrong patient. Confirm none was relied on for this patient.'});
  else if(['pending','running','review'].includes(r.status))add({output,external:false,action:'invalidated',state:'done',instruction:'The request can no longer be approved or applied: the server refuses assistant work on a visit that is not current.'});
 }
 for(const r of v.aiResults??[])if(r.reviewed)add({output:{kind:'assistant-result',refId:r.id,label:`Reviewed AI result (${r.providerName})`,stateAtCorrection:'reviewed'},external:false,action:'review',instruction:'A reviewed AI result was based on the earlier facts. Check whether anything was decided from it.'});
 // Shadow comparisons that used this version's confirmed values (governance evidence; not recomputed here).
 for(const sh of s.governance?.shadows??[])for(const r of sh.results)if(r.visitId===v.id&&r.status==='compared')
  add({output:{kind:'shadow-comparison',refId:sh.id,label:'Shadow comparison',stateAtCorrection:`compared at visit version ${r.visitVersion}`},external:false,action:'review',instruction:'This shadow comparison scored the assistant against values that were later corrected. Exclude or note it when the shadow operation is reviewed in Clinical governance.'});
 // Worker-activity evidence is recomputed from record revisions on every read.
 add({output:{kind:'worker-activity',refId:null,label:'Worker activity evidence',stateAtCorrection:'performed'},external:false,action:'recomputed',state:'done',instruction:`Worker activity is computed on each read; this visit now shows as ${amend?'corrected':'wrong-patient'}.`});
 // Indicator releases that may have counted this version: counts only.
 const releases=((s.operations as any)?.indicatorReleases??[]) as {at:string}[];
 const counted=v.confirmedAt?releases.filter(r=>typeof r?.at==='string'&&r.at>=v.confirmedAt!).length:0;
 add({output:{kind:'indicator-releases',refId:null,label:'Indicator releases',stateAtCorrection:`${counted} release${counted===1?'':'s'} since confirmation`,count:counted},external:false,action:counted?'review':'recomputed',state:counted?'open':'done',
  instruction:counted?`${counted} indicator release${counted===1?'':'s'} recorded since this visit was confirmed may have counted it. Indicators are recomputed on each read; figures already released are not recalled. Decide whether a reissued figure is needed.`:'No indicator release is recorded since confirmation; indicators are recomputed on each read.'});
 // Slice 6ad (ninth review, finding 9): a visit with more downstream outputs than MAX_TASKS can still be corrected
 // (there is no administrator path, so refusing could make a wrong-patient visit impossible to void). Every external
 // output keeps its own task; internal outputs past the cap are folded into one review task per kind with the count.
 if(tasks.length<=MAX_TASKS)return tasks;
 const ext=tasks.filter(t=>t.external);
 if(ext.length>MAX_TASKS)fail(422,`This visit has more than ${MAX_TASKS} deliveries to external destinations. Resolve or look up the open deliveries first; nothing was changed.`);
 const internal=tasks.filter(t=>!t.external),kept=internal.slice(0,MAX_TASKS-ext.length),rest=internal.slice(MAX_TASKS-ext.length),folded=new Map<CorrectionTask['output']['kind'],CorrectionTask[]>();
 for(const t of rest)folded.set(t.output.kind,[...(folded.get(t.output.kind)??[]),t]);
 const out=[...ext,...kept];
 for(const [kind,ts] of folded){const open=ts.filter(t=>t.state==='open').length;
  out.push({...ts[0],id:uuid(),output:{kind,refId:null,label:`${ts.length} further ${CORRECTION_KIND_LABEL[kind].toLowerCase()} outputs`,stateAtCorrection:`${ts.length} not listed one by one`,count:ts.length},state:open?'open':'done',action:open?'review':ts[0].action,
   instruction:`This visit has more than ${MAX_TASKS} downstream outputs, so ${ts.length} ${CORRECTION_KIND_LABEL[kind].toLowerCase()} outputs are listed here as one task${open?`; ${open} of them need review. Review them from the patient's record`:''}.`});}
 return out;
}

// Who may close a task: a care worker with normal access to the patient, or a supervisor or owner of the
// patient's team (slice 1e supervision). Administrators, members outside the team and emergency-only access
// are refused; owner authority does not override patient scope.
const canClose=(s:OrgState,m:Member,p:Person)=>(['asha','clinician'].includes(m.role)&&normallyAllowed(m,p))||supervises(s,m,p.teamId);
const id=z.string().trim().min(1).max(200);
export const correctionTaskSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('closeCorrectionTask'),personId:id,visitId:id,taskId:id,receiptId:z.string().trim().min(1).max(200).optional(),reference:z.string().trim().min(1).max(200).optional(),reason:z.string().trim().min(10,'Explain the outcome in at least 10 characters.').max(500).optional()}).strict(),
]);
export function authorizeCorrectionTask(s:OrgState,m:Member,c:any){
 if(c?.type!=='closeCorrectionTask')return;const p=person(s.workspace,c.personId);
 if(!canClose(s,m,p))fail(403,'A care worker with current access, or a supervisor or owner of the patient\'s team, closes correction tasks.');
}
export function applyCorrectionTask(s:OrgState,input:unknown,u:Actor,m:Member,now=new Date().toISOString()):any|null{
 const parsed=correctionTaskSchema.safeParse(input);if(!parsed.success)return null;const c=parsed.data,w=s.workspace;
 authorizeCorrectionTask(s,m,c);const p=person(w,c.personId);
 const v=w.visits.find(x=>x.id===c.visitId&&x.personId===p.id);if(!v)fail(404,'Visit not found for this patient.');
 const t=v!.correctionTasks?.find(x=>x.id===c.taskId);if(!t)fail(404,'Correction task not found on this visit.');
 if(t!.state!=='open')fail(409,'This correction task is already closed.');
 if(!c.receiptId&&!c.reason)fail(422,'Give the receipt of the correction or a reason of at least 10 characters.');
 let verified=false;
 if(c.receiptId){
  // A receipt id must be an accepted correction from Saha to the same destination, sent from a visit that corrects this one.
  if(t!.output.kind!=='programme-submission'||t!.action!=='send-correction')fail(422,'A Saha receipt closes only a correction sent through Saha. Record the destination\'s reference and a reason instead.');
  const chain=new Set(correctionsOf(s,v!.id).map(x=>x.id));
  const sent=w.submissions.find(x=>chain.has(x.visitId)&&x.connectorId===t!.output.destination?.id&&x.state==='accepted'&&x.receipt===c.receiptId);
  if(!sent)fail(422,'This receipt is not an accepted correction to this destination from a visit that corrects this one.');
  verified=true;
 }
 if(t!.action==='cancel-unsent'){const sub=w.submissions.find(x=>x.id===t!.output.refId);if(sub&&['queued','retryable','sending'].includes(sub.state))fail(409,'Cancel the unsent delivery first; it is still waiting.');}
 if(t!.action==='look-up-first'&&t!.output.kind==='programme-submission'){const sub=w.submissions.find(x=>x.id===t!.output.refId);if(sub&&['uncertain','sending'].includes(sub.state)&&!c.reason)fail(409,'Look up the receipt first, or record what the destination said.');}
 t!.state='closed';t!.closed={by:u.userId,byName:u.displayName,at:now,verified,...(c.receiptId?{receiptId:c.receiptId}:{}),...(c.reference?{reference:c.reference}:{}),...(c.reason?{reason:c.reason}:{})};
 w.audit.push({id:uuid(),at:now,actorId:u.userId,actor:u.displayName,role:m.role,action:c.type,subject:v!.id,personId:p.id,detail:`Correction task closed (${CORRECTION_KIND_LABEL[t!.output.kind]}: ${t!.output.label}; ${CORRECTION_ACTION_LABEL[t!.action]}). ${verified?`Correction receipt ${c.receiptId} verified.`:`Reason: ${c.reason}`}${c.reference?` Destination reference: ${c.reference}.`:''} The output itself was not changed.`});
 return {taskId:t!.id,state:'closed',verified};
}

// Open tasks of one patient, newest visit first, for the action plan (4b) and exception queue (6i).
export function openCorrectionTasks(s:OrgState,p:Person){
 const out:{task:CorrectionTask;visit:Visit}[]=[];
 for(const v of s.workspace.visits)if(v.personId===p.id)for(const t of v.correctionTasks??[])if(t.state==='open')out.push({task:t,visit:v});
 return out;
}
