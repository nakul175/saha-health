import type { D1Database } from '@cloudflare/workers-types';
import { AppError, fail, uuid } from './core';
import { misCredential, misRequest } from './mis';
import { ehrCredential } from './ehr';
import { fhirRequest } from './ehr-provider';
import { persist, readState, scope, type Actor } from './store';
import { linkTrace } from './trace';
import { operationRefusal, refusalOf, type Refusal } from './adapter-operations';
import { sendBlock } from './send-gate';
import { DOCUMENT_SYSTEM, NOTICE_SYSTEM, WITHDRAWAL_CONTRACT, WITHDRAWAL_EVENT_LIMIT, WITHDRAWAL_LOOKUP_LIMIT, WITHDRAWAL_TERMINAL, applyWithdrawalReceipt, bindingProblem, completeCorrectionTasks, demoWithdrawalTransport, ensureAmendPurpose, findWithdrawal, withdrawalActor, withdrawalAudit, withdrawalEvent, type Withdrawal, type WithdrawalCommand } from './withdrawal';
import type { Integration, Member, OrgState } from './types';
// Slice 14c: sending and looking up a withdrawal or EHR amendment (see withdrawal.ts). The pattern is the programme delivery's
// (slice 5b/7e): every check, then a checkpoint commit before the request, the operation and the bindings rechecked on a
// fresh read inside it, one request, and the answer stored on a fresh read. An answer that is missing or does not match
// leaves the withdrawal uncertain; only a lookup under its own key resolves it. Nothing is ever sent twice.
export type WithdrawalTransports={mis:typeof misRequest;fhir:typeof fhirRequest;demo:typeof demoWithdrawalTransport};
const LOOKUP_SETTLE_MS=45000;
const credential=(i:Integration,orgId:string,env:Record<string,string|undefined>)=>i.kind==='mis'?misCredential(i,orgId,env):ehrCredential(i,orgId,env);
async function request(s:OrgState,i:Integration,w:Withdrawal,lookup:boolean,env:Record<string,string|undefined>,t:WithdrawalTransports,operationId:string):Promise<unknown>{
 if(w.kind==='programme-submission'){
  if(i.mode==='demo')return t.demo(i,w,lookup);
  const body=lookup?{contract:WITHDRAWAL_CONTRACT,operation:'lookup',key:w.id,payloadHash:w.payloadHash}:{...w.payload,key:w.id,payloadHash:w.payloadHash};
  return t.mis(i,s.organisation.id,env,body,lookup?'lookup_'+operationId:w.id);
 }
 const identifier='identifier='+encodeURIComponent((w.operation==='amend'?DOCUMENT_SYSTEM:NOTICE_SYSTEM)+'|'+w.id);
 if(lookup)return t.fhir(i,s.organisation.id,env,'Bundle?'+identifier+'&_count=2');
 return t.fhir(i,s.organisation.id,env,'Bundle',{method:'POST',headers:{'Content-Type':'application/fhir+json',Prefer:'return=representation','If-None-Exist':identifier},body:JSON.stringify(w.payload)});
}
// A withdrawal whose operation is no longer permitted after approval is closed as not sent, with the refusal recorded (slice 7e).
async function closeRefused(db:D1Database,s:OrgState,w:Withdrawal,c:WithdrawalCommand,u:Actor,m:Member,key:string,hash:string,text:string,refusal:Refusal){
 const before=structuredClone(s),at=new Date().toISOString();w.state='cancelled';w.refusal=refusal;delete w.payload;
 withdrawalEvent(w,at,'cancelled',`Not sent: ${text} Nothing was sent to ${w.destination.name}; this ${w.operation==='amend'?'amendment':'withdrawal'} is closed. Prepare a new one if it is still needed.`);
 withdrawalAudit(s,u,m,'adapterOperationRefused',w,w.message,at);linkTrace(before,s,c.type,key,u.userId);
 await persist(db,before,s,u,c,key,hash,{withdrawalId:w.id,state:w.state,refused:true});return {withdrawalId:w.id,state:w.state,refused:true,message:w.message};
}
export async function executeWithdrawal(db:D1Database,s:OrgState,c:WithdrawalCommand,u:Actor,m:Member,key:string,hash:string,env:Record<string,string|undefined>,transports:Partial<WithdrawalTransports>={}){
 if(c.type!=='executeWithdrawal'&&c.type!=='lookupWithdrawal')fail(422,'Unsupported withdrawal operation.');
 const t:WithdrawalTransports={mis:misRequest,fhir:fhirRequest,demo:demoWithdrawalTransport,...transports},lookup=c.type==='lookupWithdrawal';
 withdrawalActor(s,m,c.personId);const {v,w}=findWithdrawal(s,c.personId,c.withdrawalId),now=new Date().toISOString();
 if(w.events.length>=WITHDRAWAL_EVENT_LIMIT)fail(409,'Withdrawal event limit reached. Investigate with the destination.');
 const i=s.workspace.integrations.find(x=>x.id===w.destination.id);if(!i)fail(409,'The destination connection no longer exists. Partner reconciliation is required; nothing is sent.');
 const kindName=w.operation==='amend'?'amendment':'withdrawal';
 if(lookup){
  if(w.state!=='uncertain'&&w.state!=='sending')fail(409,`Only a ${kindName} whose outcome is unknown needs a receipt lookup.`);
  if(w.state==='sending'&&Date.parse(w.startedAt??'')>Date.now()-LOOKUP_SETTLE_MS)fail(409,`The ${kindName} may still be in progress. Refresh shortly before looking up its receipt.`);
  if((w.lookups??0)>=WITHDRAWAL_LOOKUP_LIMIT)fail(409,`This ${kindName} has had ${WITHDRAWAL_LOOKUP_LIMIT} receipt lookups, the limit. Reconcile it with ${w.destination.name}; do not resend.`);
  if(w.bound.route&&(i.endpoint!==w.bound.route.endpoint||i.credentialBinding!==w.bound.route.credentialBinding))fail(409,'The connection route changed. Partner reconciliation is required; do not resend.');
  {const refused=operationRefusal(i,'lookup','none');if(refused)fail(409,refused+' The outcome stays unknown; do not resend.');}
  if(w.destination.mode==='http')credential(i,s.organisation.id,env);
 }else{
  if(w.state==='prepared')fail(409,`Approve the ${kindName} before sending it.`);
  // A replay or a second press never sends again: anything past approval is reported as it stands.
  if(w.state!=='approved')return {withdrawalId:w.id,state:w.state};
  if(w.approvedBy!==u.userId)fail(409,`The care worker who approved this ${kindName} sends it, within the approval window.`);
  ensureAmendPurpose(m,w);
  if(!w.expiresAt||w.expiresAt<now)fail(409,`The approval has expired. Cancel this ${kindName} and prepare a new one.`);
  {const refused=operationRefusal(i,w.adapterOperation,'patient');if(refused)return await closeRefused(db,s,w,c,u,m,key,hash,refused,refusalOf(i,w.adapterOperation,'before-send'));}
  {const problem=await bindingProblem(s,w,now);if(problem)fail(409,`Not sent: ${problem} since this ${kindName} was prepared. Cancel it and prepare a new one.`);}
  if(w.destination.mode==='http')credential(i,s.organisation.id,env);
  // An amendment carries the correction visit's content: an open dispute or missing sign-off stops it, as for a publication.
  if(w.operation==='amend'){const g=await sendBlock(s,s.workspace.visits.find(x=>x.id===w.bound.correctionVisitId),i,'plan');if(g.block)fail(409,g.block.text);}
 }
 // Checkpoint, saved before the request.
 const before=structuredClone(s),operationId=uuid(),at=new Date().toISOString();w.operationId=operationId;w.startedAt=at;
 if(lookup){w.lookups=(w.lookups??0)+1;withdrawalEvent(w,at,'lookup',`Receipt lookup ${w.lookups} reserved; nothing is resent.`);}
 else{w.state='sending';w.attempts++;withdrawalEvent(w,at,'sending',`Checkpoint saved before the request to ${w.destination.name}.`);}
 withdrawalAudit(s,u,m,c.type,w,w.message,at);linkTrace(before,s,c.type,key,u.userId);
 await persist(db,before,s,u,c,key,hash,{withdrawalId:w.id,state:w.state});
 // The operation, the bindings and (for an amendment) the send gate, rechecked on the stored state immediately before the request.
 let stop:string|null=null,refusal:Refusal|undefined;
 {const latest=await readState(db,s.organisation.id),li=latest.workspace.integrations.find(x=>x.id===i.id),op=lookup?'lookup' as const:w.adapterOperation;
  stop=li?operationRefusal(li,op,lookup?'none':'patient'):'The destination connection no longer exists.';if(stop&&li)refusal=refusalOf(li,op,'checkpoint');
  if(!stop&&!lookup){try{if(!['asha','clinician'].includes(scope(latest,u.userId).role))stop='Your care role changed after the checkpoint.';}catch{stop='Your membership changed after the checkpoint.';}}
  if(!stop&&!lookup){const lw=latest.workspace.visits.find(x=>x.id===v.id)?.withdrawals?.find(x=>x.id===w.id);const problem=lw?await bindingProblem(latest,lw):'the withdrawal is no longer stored';if(problem)stop=`${problem[0].toUpperCase()+problem.slice(1)} after the checkpoint.`;
   if(!stop&&w.operation==='amend'&&li){const g=await sendBlock(latest,latest.workspace.visits.find(x=>x.id===w.bound.correctionVisitId),li,'checkpoint');if(g.block)stop=g.block.text;}}}
 let raw:unknown,lost=false;
 if(!stop)try{raw=await request(s,i,w,lookup,env,t,operationId);}catch{lost=true;}
 for(let n=0;n<3;n++){
  const after=await readState(db,s.organisation.id),old=structuredClone(after),tv=after.workspace.visits.find(x=>x.id===v.id),target=tv?.withdrawals?.find(x=>x.id===w.id);
  if(!tv||!target)fail(409,'The withdrawal checkpoint is unavailable. Look it up; do not resend.');
  if(target.operationId!==operationId||(WITHDRAWAL_TERMINAL as readonly string[]).includes(target.state))return {withdrawalId:target.id,state:target.state};
  const done=new Date().toISOString();let closed:string[]=[];
  // Receipts describe what already happened at the destination; they are kept even if access changed while in flight.
  if(stop){
   if(lookup)withdrawalEvent(target,done,target.state,`Receipt lookup not made: ${stop} The outcome stays unknown; do not resend.`);
   else{target.state='cancelled';target.attempts=Math.max(0,target.attempts-1);if(refusal)target.refusal=refusal;delete target.payload;withdrawalEvent(target,done,'cancelled',`Not sent: ${stop} This took effect after the checkpoint and before the request, so nothing was sent and the reserved attempt is released. This ${kindName} is closed; prepare a new one if it is still needed.`);}
  }else{applyWithdrawalReceipt(target,raw,lost,lookup,done);closed=completeCorrectionTasks(after,tv,target,u,m,done);}
  const action=stop?(refusal?'adapterOperationRefused':'withdrawalNotSent'):'withdrawalReceipt';
  withdrawalAudit(after,u,m,action,target,target.message+(closed.length?` ${closed.length} correction task${closed.length===1?'':'s'} completed.`:''),done);linkTrace(old,after,action,'wd_finish_'+operationId,u.userId);
  try{await persist(db,old,after,u,{type:action},'wd_finish_'+operationId,hash,{withdrawalId:target.id,state:target.state});return {withdrawalId:target.id,state:target.state,...(target.receipt?{receipt:target.receipt}:{}),...(closed.length?{closedTasks:closed}:{}),...(stop?{message:target.message}:{})};}
  catch(e){if(!(e instanceof AppError&&e.status===409)||n===2)throw e;}
 }
 fail(409,'The withdrawal result is unresolved. Refresh and look it up; do not resend.');
}
