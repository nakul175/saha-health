import { AppError, fail, uuid } from './core';
import { applyReceipt, deliveryCurrent, deliveryEvent, misAudit, misCredential, misIntegration, misRequest, type MisCommand } from './mis';
import { persist, readState, scope, type Actor } from './store';
import { person } from './core';
import { ensureSendSignOff } from './visit-signoff';
import { sendBlock } from './send-gate';
import { linkTrace, MIS_MAX_ATTEMPTS } from './trace';
import { misOperation, operationRefusal, refusalOf, type Refusal } from './adapter-operations';
import type { D1Database } from '@cloudflare/workers-types';
import type { Member, OrgState, SendBlockRecord, Submission } from './types';
// Slice 7e: a delivery whose operation is no longer permitted is closed as not sent, with the refusal recorded.
async function closeRefused(db:D1Database,s:OrgState,sub:Submission,c:MisCommand,u:Actor,m:Member,key:string,hash:string,text:string,refusal:Refusal){
 const before=structuredClone(s);sub.state='cancelled';sub.refusal=refusal;deliveryEvent(sub,`Not sent: ${text} Nothing was sent to the destination; this delivery is closed. Prepare a new plan if it is still needed.`);misAudit(s,u,m,'adapterOperationRefused',sub.id,sub.message,sub.personId);
 linkTrace(before,s,c.type,key,u.userId);await persist(db,before,s,u,c,key,hash,{submissionId:sub.id,state:sub.state,refused:true});return {submissionId:sub.id,state:sub.state,refused:true,message:sub.message};
}
export async function executeMis(db:D1Database,s:OrgState,c:MisCommand,u:Actor,m:Member,key:string,hash:string,env:Record<string,string|undefined>,transport:typeof misRequest=misRequest){
 if(c.type==='testMis'){
  if(!m.isOwner)fail(403,'Only an organisation owner can test a connection.');const i=misIntegration(s,c.integrationId);if(i.version!==c.version||!i.mis)fail(409,'Save a current programme mapping before testing.');misCredential(i,s.organisation.id,env);
  const before=structuredClone(s);misAudit(s,u,m,c.type,i.id,'Synthetic connection probe reserved. No patient data submitted.');await persist(db,before,s,u,c,key,hash,{status:'testing'});
  let ok=false;try{const r=await transport(i,s.organisation.id,env,{contract:'saha-mis-v1',operation:'probe',environment:'synthetic',required:{idempotency:true,lookup:true,corrections:i.mis.corrections}},key);ok=r?.contract==='saha-mis-v1'&&r.idempotency===true&&r.lookup===true&&(!i.mis.corrections||r.corrections===true);}catch{}
  const after=await readState(db,s.organisation.id),member=scope(after,u.userId);if(!member.isOwner)fail(403,'Owner access changed during the test.');const target=misIntegration(after,i.id);if(target.version!==i.version)fail(409,'Connection changed during the test. Retest the new version.');const old=structuredClone(after);target.mis!.test={at:new Date().toISOString(),version:target.version,ok,message:ok?'Contract probe passed. Partner delivery acceptance still requires testing.':'Connection probe failed. Check grant, credentials and partner contract.'};misAudit(after,u,member,'misTestResult',i.id,target.mis!.test.message);await persist(db,old,after,u,{type:'misTestResult'},'mis_test_'+uuid(),hash,{ok});return {ok};
 }
 if(c.type!=='sendSubmission'&&c.type!=='lookupSubmission')fail(422,'Unsupported delivery operation.');
 const sub=s.workspace.submissions.find(x=>x.id===c.submissionId);if(!sub?.delivery)fail(404,'Programme delivery not found.');person(s.workspace,sub.personId);if(sub.delivery.events.length>=50)fail(409,'Delivery event limit reached. Investigate with the partner.');
 const lookup=c.type==='lookupSubmission';let i;
 if(lookup){if(!['uncertain','sending'].includes(sub.state))fail(409,'Only an unresolved delivery needs a receipt lookup.');if(sub.state==='sending'&&Date.parse(sub.delivery.startedAt??'')>Date.now()-30000)fail(409,'Delivery is still in progress. Refresh shortly before looking up its receipt.');i=misIntegration(s,sub.connectorId);if(i.endpoint!==sub.delivery.endpoint||i.credentialBinding!==sub.delivery.credentialBinding)fail(409,'Connection route changed. Partner reconciliation is required; do not resend.');{const refused=operationRefusal(i,'lookup','none');if(refused)fail(409,refused+' The outcome stays unknown; do not resend.');}misCredential(i,s.organisation.id,env);}
 else {if(!['queued','retryable'].includes(sub.state))return {submissionId:sub.id,state:sub.state};if(sub.attempts>=MIS_MAX_ATTEMPTS)fail(409,'Three attempts reached. Contact the destination; no further send is permitted.');
  // Slice 7e: only the approving care worker may act on the delivery; a withdrawn operation closes it as not sent.
  if(!['asha','clinician'].includes(m.role))fail(403,'A care role is required to send records.');if(sub.delivery.actorId!==u.userId)fail(409,'The original approving worker must send within the approval window. Cancel unsent delivery and prepare a fresh plan.');
  {const now=misIntegration(s,sub.connectorId),refused=operationRefusal(now,misOperation(sub.delivery.payload),'patient');if(refused)return await closeRefused(db,s,sub,c,u,m,key,hash,refused,refusalOf(now,misOperation(sub.delivery.payload),'before-send'));}
  i=deliveryCurrent(s,sub,u,m,env);
  // Slice 2g: a current supervisor sign-off, checked on the state this checkpoint persists (stale ones never authorize a send).
  // Slice 10g: the same call also stops an open dispute on anything this destination carries, a withdrawn sign-off, and a
  // sign-off rule for this destination or programme; the delivery stays queued so it can be sent once that is resolved.
  const so=await ensureSendSignOff(s,sub.visitId,i);if(so)sub.signOff={id:so.id,by:so.by,byName:so.byName,at:so.at};}
 const before=structuredClone(s),operationId=uuid();sub.delivery.operationId=operationId;sub.delivery.startedAt=new Date().toISOString();if(!lookup){sub.state='sending';sub.attempts++;}deliveryEvent(sub,lookup?'Receipt lookup reserved; no visit is resent.':'Delivery checkpoint saved before the programme request.');misAudit(s,u,m,c.type,sub.id,sub.message,sub.personId);
 // Slice 6y: the checkpoint step carries its command, receipt key and audit event.
 linkTrace(before,s,c.type,key,u.userId);
 await persist(db,before,s,u,c,key,hash,{submissionId:sub.id,state:sub.state});
 // Slice 7e: recheck the operation on the stored state after the checkpoint, immediately before the request.
 const op=lookup?'lookup' as const:misOperation(sub.delivery.payload);let withdrawn:string|null=null,refusal:Refusal|undefined,blocked:SendBlockRecord|undefined;
 {const latest=await readState(db,s.organisation.id),li=latest.workspace.integrations.find(x=>x.id===sub.connectorId);withdrawn=li?operationRefusal(li,op,lookup?'none':'patient'):'The destination connection no longer exists.';if(withdrawn&&li)refusal=refusalOf(li,op,'checkpoint');
  // Slice 10g: disputes, a withdrawn sign-off and the sign-off rule are rechecked on the same fresh read, immediately before the request.
  if(!withdrawn&&li&&!lookup){const g=await sendBlock(latest,latest.workspace.visits.find(x=>x.id===sub.visitId),li,'checkpoint');if(g.block){withdrawn=g.block.text;blocked={kind:g.block.kind==='dispute'?'dispute':'sign-off',stage:'checkpoint',at:new Date().toISOString(),...(g.block.disputeIds.length?{disputeIds:g.block.disputeIds}:{})};}}}
 let raw:unknown;if(!withdrawn)try{raw=await transport(i,s.organisation.id,env,lookup?{contract:'saha-mis-v1',operation:'lookup',key:sub.delivery.key,payloadHash:sub.payloadHash}:{...sub.delivery.payload,key:sub.delivery.key,payloadHash:sub.payloadHash},lookup?'lookup_'+operationId:sub.delivery.key);}catch{}
 for(let n=0;n<3;n++){
  const after=await readState(db,s.organisation.id),old=structuredClone(after),target=after.workspace.submissions.find(x=>x.id===sub.id);if(!target?.delivery)fail(409,'Delivery checkpoint is unavailable.');if(target.delivery.operationId!==operationId||['accepted','rejected','cancelled'].includes(target.state))return {submissionId:sub.id,state:target.state};
  // Receipts describe what already happened outside Saha. Retain them even if
  // access or consent changed while in flight; the response snapshot rechecks access.
  if(withdrawn){
   if(lookup){target.state='uncertain';deliveryEvent(target,`Receipt lookup not made: ${withdrawn} The outcome stays unknown; do not resend.`);}
   else {target.state='cancelled';if(blocked)target.block=blocked;else target.refusal=refusal;target.attempts=Math.max(0,target.attempts-1);deliveryEvent(target,`Not sent: ${withdrawn} ${blocked?'A dispute or sign-off change took effect':'The operation was withdrawn'} after the checkpoint and before the request, so nothing was sent and the reserved attempt is released. This delivery is closed; prepare a new plan if it is still needed.`);}
  }
  else try{applyReceipt(target,raw,lookup);}catch{target.state='uncertain';deliveryEvent(target,'No matching definitive receipt was received. Look up this key before any resend.');}
  const action=withdrawn?(blocked?'sendBlocked':'adapterOperationRefused'):'misReceipt';
  misAudit(after,u,m,action,target.id,target.message,target.personId);linkTrace(old,after,action,'mis_finish_'+operationId,u.userId);
  try{await persist(db,old,after,u,{type:action},'mis_finish_'+operationId,hash,{submissionId:target.id,state:target.state});return {submissionId:target.id,state:target.state,...(withdrawn&&!lookup?{refused:true,message:target.message}:{})};}catch(e){if(!(e instanceof AppError&&e.status===409)||n===2)throw e;}
 }
 fail(409,'Receipt storage remains unresolved. Refresh and look up the delivery; do not resend.');
}
