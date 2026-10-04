import { z } from 'zod';
import { consentStanding, digest, fail, noticesOf, person, uuid } from './core';
import { normallyAllowed } from './access';
import { operationRefusal, operationsOf, type Refusal } from './adapter-operations';
import { receiptSchema } from './mis';
import { ehrAccess, ehrState, identityHash, withinPermission } from './ehr';
import { activeRestriction } from './rights';
import { fhirDocument, inspectDocument } from './fhir-document';
import { publicationReceipt } from './ehr-provider';
import { validateOutbound } from './fhir-validate';
import { purposeRefusal } from './purpose-scope';
import { sendBlock } from './send-gate';
import type { Actor } from './store';
import type { Integration, Member, OrgState, Person, TraceRef, Visit } from './types';

// Slice 14c (R58; BR-INT-02, BR-RULE-04, BR-INT-21): withdrawal (void) of an accepted programme submission, and withdrawal or
// amendment of a published EHR document, through approval.
//
// A withdrawal is its own record on the visit whose output it withdraws (`Visit.withdrawals`). It names the original
// submission or publication by id and receipt; the original is kept and never edited. Each withdrawal is
//   prepared  (a care worker with normal access: the exact payload, its SHA-256 and what it is bound to),
//   approved  (a care worker with normal access, bound to that payload hash, for 15 minutes, as for sharing plans),
//   executed  (by the approving person inside that window: one checkpoint, one request, its own receipt),
// and an unknown outcome is resolved only by a receipt lookup under the withdrawal's own key, never by sending again.
//
// - The destination must permit the operation (slice 7e): `delete` ("delete or void") for a withdrawal, `update` for an
//   EHR amendment. It is checked when preparing, approving, before the checkpoint and again on a fresh read inside it; a
//   withdrawn permission closes the withdrawal as not sent. A destination without the permission gets no withdrawal: its
//   correction task (slice 2j) stays a manual correction with the destination.
// - Preparing binds the patient (record version and sharing-permission version), the visit (facts version and whether it
//   is current, superseded or voided), the destination connection version, its operation-setting version and route, and the
//   original's accepted receipt (and, for an amendment, the correction visit, patient link, identity and write permission).
//   Any change refuses approval and sending; the withdrawal is cancelled and prepared again.
// - Programme destinations: the `saha-mis-v1` contract gains operation `withdraw`, naming the original delivery key and
//   receipt and a reason code (never the free-text reason or any visit fact). The two demonstration simulators answer it
//   in process: the maternal register accepts with its own receipt; the community MIS records it but loses the response,
//   so the withdrawal is uncertain until a lookup finds the receipt. HTTP connections send the same payload through the
//   existing programme adapter (external services stay off unless a deployment enables them).
// - EHR connections (HTTP only): a withdrawal is a conditional create of a notice document whose Composition is
//   `entered-in-error` and `replaces` the published document identifier (patient by external id only, no visit content).
//   An amendment is the confirmed correction visit's document, `replaces` the published one, subject to the same
//   permission, identity, date-range and dispute/sign-off checks as a publication. Lookups search the withdrawal's own
//   identifier; only one matching document equal to the one sent resolves it.
// - When the destination confirms, the visit's open correction tasks for that output are closed with the verified receipt
//   (a withdrawal closes the tasks of a wrong-patient visit; an EHR amendment those of an amended visit).
export const WITHDRAWAL_CONTRACT='saha-mis-v1';
export const WITHDRAWAL_APPROVAL_MINUTES=15;
export const WITHDRAWAL_LIMIT=10;
export const WITHDRAWAL_LOOKUP_LIMIT=24;
export const WITHDRAWAL_EVENT_LIMIT=50;
export const WITHDRAWAL_OPEN=['prepared','approved','sending','uncertain'] as const;
export const WITHDRAWAL_TERMINAL=['accepted','rejected','not-stored','cancelled'] as const;
export const WITHDRAWAL_REASONS=['wrong-patient','entered-in-error','corrected'] as const;
export const WITHDRAWAL_REASON_LABEL:Record<WithdrawalReason,string>={'wrong-patient':'recorded against the wrong patient','entered-in-error':'entered in error','corrected':'replaced by a corrected record'};
export const NOTICE_SYSTEM='urn:saha:withdrawals',DOCUMENT_SYSTEM='urn:saha:documents';
export const WITHDRAWAL_TYPES=new Set(['prepareWithdrawal','approveWithdrawal','executeWithdrawal','lookupWithdrawal','cancelWithdrawal']);
export type WithdrawalReason=typeof WITHDRAWAL_REASONS[number];
export type WithdrawalState='prepared'|'approved'|'sending'|'accepted'|'rejected'|'uncertain'|'not-stored'|'cancelled';
export type WithdrawalBound={personVersion:number;consentVersion:number;visitVersion:number;visitStatus:string;integrationVersion:number;operationsVersion:number;route?:{endpoint:string;credentialBinding:string};linkId?:string;externalId?:string;permissionId?:string;identityHash?:string;correctionVisitId?:string;correctionVersion?:number};
export type Withdrawal={
 id:string;kind:'programme-submission'|'ehr-publication';operation:'withdraw'|'amend';adapterOperation:'delete'|'update';
 visitId:string;personId:string;original:{id:string;receipt:string};destination:{id:string;name:string;mode:'demo'|'http'};
 reasonCode:WithdrawalReason;reason:string;bound:WithdrawalBound;payload?:any;payloadHash:string;state:WithdrawalState;
 preparedBy:string;preparedByName:string;preparedAt:string;approvedBy?:string;approvedByName?:string;approvedAt?:string;expiresAt?:string;
 attempts:number;lookups?:number;receipt?:string;startedAt?:string;operationId?:string;refusal?:Refusal;closedTaskIds?:string[];
 events:{at:string;state:string;detail:string;attempt?:number;ref?:TraceRef}[];message:string;updatedAt:string};
const id=z.string().trim().min(1).max(200),hash=z.string().regex(/^[a-f0-9]{64}$/);
export const withdrawalSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('prepareWithdrawal'),personId:id,target:z.enum(['programme-submission','ehr-publication']),refId:id,operation:z.enum(['withdraw','amend']),reasonCode:z.enum(WITHDRAWAL_REASONS),reason:z.string().trim().min(10,'Explain the reason in at least 10 characters.').max(500)}).strict(),
 z.object({type:z.literal('approveWithdrawal'),personId:id,withdrawalId:id,payloadHash:hash}).strict(),
 z.object({type:z.literal('executeWithdrawal'),personId:id,withdrawalId:id}).strict(),
 z.object({type:z.literal('lookupWithdrawal'),personId:id,withdrawalId:id}).strict(),
 z.object({type:z.literal('cancelWithdrawal'),personId:id,withdrawalId:id}).strict(),
]);
export type WithdrawalCommand=z.infer<typeof withdrawalSchema>;
const label=(w:Pick<Withdrawal,'operation'>)=>w.operation==='amend'?'amendment':'withdrawal';
export const visitStatus=(v:Visit)=>v.voidedAt?'voided':v.supersededBy?'superseded:'+v.supersededBy:'current';

// Who acts on a withdrawal: an ASHA or clinician with normal (not emergency-only) access to the patient. Owner authority
// and supervision do not replace patient scope. The same check runs on an idempotent replay.
export function withdrawalActor(s:OrgState,m:Member,personId:string):Person{
 const p=person(s.workspace,personId);
 if(!['asha','clinician'].includes(m.role)||!normallyAllowed(m,p))fail(403,'A care worker (ASHA or clinician) with normal access to this patient prepares, approves, sends and looks up withdrawals.');
 return p;
}
// An amendment carries the correction visit's document to the EHR: a member whose purpose grant (slice 13a) excludes care
// coordination may not prepare, approve or send one. A withdrawal sends no new content, so no purpose grant stops it.
export function ensureAmendPurpose(m:Member,w:Pick<Withdrawal,'operation'>){if(w.operation!=='amend')return;const why=purposeRefusal(m,'care-coordination');if(why)fail(403,why);}
export function authorizeWithdrawal(s:OrgState,m:Member,c:any){if(WITHDRAWAL_TYPES.has(c?.type)&&typeof c.personId==='string')withdrawalActor(s,m,c.personId);}
export function findWithdrawal(s:OrgState,personId:string,withdrawalId:string):{v:Visit;w:Withdrawal}{
 for(const v of s.workspace.visits)if(v.personId===personId){const w=v.withdrawals?.find(x=>x.id===withdrawalId);if(w)return {v,w};}
 return fail(404,'Withdrawal not found for this patient.');
}
// The visit at the end of the correction chain of `v`, or null when `v` was never amended.
export function correctionVisitOf(s:OrgState,v:Visit):Visit|null{let cur=v;const seen=new Set([v.id]);for(;;){const next=s.workspace.visits.find(x=>x.amendsVisitId===cur.id);if(!next||seen.has(next.id))break;seen.add(next.id);cur=next;}return cur.id===v.id?null:cur;}
const currentConfirmed=(v:Visit|null|undefined):v is Visit=>!!v&&v.state==='confirmed'&&!v.voidedAt&&!v.supersededBy&&!v.imported;
export function withdrawalEvent(w:Withdrawal,at:string,state:string,detail:string){w.updatedAt=at;w.message=detail;w.events.push({at,state,detail});}
export function withdrawalAudit(s:OrgState,u:Actor,m:Member,action:string,w:Withdrawal,detail:string,at:string){s.workspace.audit.push({id:uuid(),at,actor:u.displayName,actorId:u.userId,role:m.role,action,subject:w.id,personId:w.personId,detail});}

// The programme withdrawal payload (saha-mis-v1, operation withdraw): the original delivery key and receipt and a reason code.
export function programmeWithdrawalPayload(sub:{id:string;receipt?:string;delivery?:{key:string}},reasonCode:WithdrawalReason){
 return {contract:WITHDRAWAL_CONTRACT,environment:'synthetic',operation:'withdraw',withdraws:{submissionKey:sub.delivery?.key??sub.id,receipt:sub.receipt},reason:reasonCode};
}
// The EHR withdrawal notice: a document whose Composition is entered-in-error and replaces the published document identifier.
// It names the external patient by id only and carries no visit content.
export function withdrawalNotice(withdrawalId:string,originalId:string,externalId:string,organisation:string,reasonCode:WithdrawalReason,at:string){
 const ref=()=>`urn:uuid:${uuid()}`,compositionRef=ref(),patientRef=ref(),orgRef=ref();
 return {resourceType:'Bundle',id:withdrawalId,meta:{versionId:'1',tag:[{system:'urn:saha:environment',code:'synthetic-unvalidated'}]},identifier:{system:NOTICE_SYSTEM,value:withdrawalId},type:'document',timestamp:at,entry:[
  {fullUrl:compositionRef,resource:{resourceType:'Composition',id:withdrawalId,status:'entered-in-error',type:{text:'Community visit record'},subject:{reference:patientRef},date:at,author:[{reference:orgRef}],title:'Withdrawal of a synthetic community visit record',relatesTo:[{code:'replaces',targetIdentifier:{system:DOCUMENT_SYSTEM,value:originalId}}],section:[{title:'Withdrawal',text:{status:'generated',div:`<div xmlns="http://www.w3.org/1999/xhtml"><p>Document ${originalId} is withdrawn: ${WITHDRAWAL_REASON_LABEL[reasonCode]}.</p></div>`}}]}},
  {fullUrl:patientRef,resource:{resourceType:'Patient',id:externalId}},
  {fullUrl:orgRef,resource:{resourceType:'Organization',id:uuid(),name:organisation}}]};
}
// The EHR's acknowledgement of a notice: the same identifier and entries, and a server id.
export function noticeReceipt(raw:any,expected:any){
 if(raw?.resourceType!=='Bundle'||raw.type!=='document'||raw.identifier?.system!==expected.identifier.system||raw.identifier?.value!==expected.identifier.value||typeof raw.id!=='string'||!/^[A-Za-z0-9.-]{1,64}$/.test(raw.id))fail(502,'EHR acknowledgement does not match the withdrawal notice identifier.');
 if(JSON.stringify(raw.entry)!==JSON.stringify(expected.entry))fail(502,'EHR returned changed withdrawal notice content. Reconcile with the partner.');
 return 'Bundle/'+raw.id;
}

// The destination of a programme submission or EHR publication, checked for a withdrawal.
function programmeTarget(s:OrgState,p:Person,refId:string){
 const sub=s.workspace.submissions.find(x=>x.id===refId&&x.personId===p.id);if(!sub)fail(404,'Programme submission not found for this patient.');
 if(sub.state!=='accepted'||!sub.receipt)fail(409,'Only a submission the destination accepted, with its receipt, can be withdrawn. Look up an unknown outcome first; an unsent delivery is cancelled instead.');
 const v=s.workspace.visits.find(x=>x.id===sub.visitId);if(!v)fail(404,'Visit not found.');
 const i=s.workspace.integrations.find(x=>x.id===sub.connectorId);if(!i||i.kind!=='mis'||i.mode==='unconfigured')fail(409,'The destination connection no longer exists. Record the withdrawal with the destination by its own process.');
 if(i.status!=='active')fail(409,`${i.name} is not active.`);
 if(i.mode==='http'&&(i.endpoint!==sub.delivery?.endpoint||i.credentialBinding!==sub.delivery?.credentialBinding))fail(409,'The connection route changed since this submission was sent. Partner reconciliation is required; nothing was prepared.');
 return {sub,v,i};
}
function ehrTarget(s:OrgState,p:Person,refId:string){
 const e=ehrState(p),op=e.operations.find(o=>o.id===refId);if(!op)fail(404,'EHR publication not found for this patient.');
 if(op.state!=='accepted'||!op.receipt)fail(409,'Only a publication the EHR accepted, with its receipt, can be withdrawn or amended. Look up an unknown outcome first.');
 const link=e.links.find(l=>l.id===op.linkId);if(!link)fail(409,'The patient link of this publication no longer exists.');
 const i=s.workspace.integrations.find(x=>x.id===link.integrationId);if(!i||i.kind!=='ehr'||i.mode!=='http')fail(409,'The EHR connection no longer exists. Record the withdrawal with the EHR by its own process.');
 if(i.status!=='active'||!i.ehr?.write)fail(409,`${i.name} is not active for document storage.`);
 const v=s.workspace.visits.find(x=>x.id===op.visitId);if(!v)fail(404,'Visit not found.');
 return {op,link,i,v};
}
const currentWritePermission=(p:Person,linkId:string,now:string)=>ehrState(p).permissions.filter(g=>g.linkId===linkId&&g.direction==='write'&&g.status==='active'&&g.purpose==='care-coordination'&&g.expiresAt>now).at(-1);

// Null when everything the withdrawal was prepared against is unchanged; otherwise what changed.
// Slice 14 integration (review finding): an EHR amendment writes a corrected document to an outside system, which a processing
// restriction pauses (rights.ts PAUSED_WHEN_RESTRICTED covers executeEhrPublish the same way). A withdrawal or retraction only
// withdraws what was sent, so it continues.
export const AMEND_RESTRICTED='Processing is restricted for this patient under a rights request: an amendment writes a new document to the EHR, so it is paused. A plain withdrawal or retraction can still be recorded.';
export const amendRestricted=(p:Person,w:{operation:string})=>w.operation==='amend'&&!!activeRestriction(p);
export async function bindingProblem(s:OrgState,w:Withdrawal,now=new Date().toISOString()):Promise<string|null>{
 const p=s.workspace.people.find(x=>x.id===w.personId),v=s.workspace.visits.find(x=>x.id===w.visitId),b=w.bound;
 if(!p||!v)return 'the patient or visit is no longer available';
 if(amendRestricted(p,w))return 'processing was restricted for the patient';
 if(p.version!==b.personVersion||p.consentVersion!==b.consentVersion)return 'the patient record or sharing permission changed';
 if(v.version!==b.visitVersion||visitStatus(v)!==b.visitStatus)return 'the visit changed (amended, marked wrong-patient or edited)';
 const i=s.workspace.integrations.find(x=>x.id===w.destination.id);
 if(!i||i.status!=='active'||i.version!==b.integrationVersion)return 'the destination connection changed';
 if(operationsOf(i).version!==b.operationsVersion)return 'the destination\'s permitted operations changed';
 if(b.route&&(i.endpoint!==b.route.endpoint||i.credentialBinding!==b.route.credentialBinding))return 'the connection route changed';
 if(w.kind==='programme-submission'){const sub=s.workspace.submissions.find(x=>x.id===w.original.id);if(!sub||sub.state!=='accepted'||sub.receipt!==w.original.receipt)return 'the original submission changed';return null;}
 const op=p.ehr?.operations.find(o=>o.id===w.original.id);if(!op||op.state!=='accepted'||op.receipt!==w.original.receipt)return 'the original publication changed';
 if(w.operation==='amend'){
  // Slice 14 integration: a sharing permission that has lapsed (expired, or given under an earlier material notice) no longer authorises the write.
  {const st=consentStanding(p,'exchange',now,noticesOf(s));if(st.state==='expired'||st.state==='renewal-needed')return `the sharing permission is no longer in force (${st.state==='expired'?'expired':'needs renewal under the current notice'})`;}
  const cv=s.workspace.visits.find(x=>x.id===b.correctionVisitId);if(!currentConfirmed(cv)||cv.version!==b.correctionVersion)return 'the correction visit changed';
  const link=p.ehr?.links.find(l=>l.id===b.linkId),g=p.ehr?.permissions.find(x=>x.id===b.permissionId);
  if(!p.exchangeConsent||!link||link.status!=='active'||link.identityHash!==b.identityHash||b.identityHash!==await identityHash(p)||!g||g.status!=='active'||g.expiresAt<=now)return 'the patient link, identity or EHR write permission changed';
 }
 return null;
}

async function prepare(s:OrgState,c:Extract<WithdrawalCommand,{type:'prepareWithdrawal'}>,u:Actor,m:Member,now:string){
 const p=withdrawalActor(s,m,c.personId),wid=uuid();
 if(amendRestricted(p,c))fail(409,AMEND_RESTRICTED);
 let v:Visit,i:Integration,payload:any,original:{id:string;receipt:string},adapter:'delete'|'update',bound:Omit<WithdrawalBound,'personVersion'|'consentVersion'|'visitVersion'|'visitStatus'|'integrationVersion'|'operationsVersion'>={};
 if(c.target==='programme-submission'){
  if(c.operation!=='withdraw')fail(422,'A programme submission is corrected through the correction visit\'s plan; here it can only be withdrawn.');
  const t=programmeTarget(s,p,c.refId);v=t.v;i=t.i;adapter='delete';original={id:t.sub.id,receipt:t.sub.receipt!};
  if(i.mode==='http')bound.route={endpoint:i.endpoint!,credentialBinding:i.credentialBinding!};
  {const refused=operationRefusal(i,'delete','patient');if(refused)fail(409,`${refused} Nothing was prepared: record the withdrawal with the destination by its own process (the visit's correction task, when it has one).`);}
  payload=programmeWithdrawalPayload(t.sub,c.reasonCode);
 }else{
  const t=ehrTarget(s,p,c.refId);v=t.v;i=t.i;adapter=c.operation==='amend'?'update':'delete';original={id:t.op.id,receipt:t.op.receipt!};bound.linkId=t.link.id;bound.externalId=t.link.externalId;
  {const refused=operationRefusal(i,adapter,'patient');if(refused)fail(409,`${refused} Nothing was prepared: ${c.operation==='amend'?'amend':'withdraw'} the document with the EHR by its own process (the visit's correction task, when it has one).`);}
  if(c.operation==='withdraw')payload=withdrawalNotice(wid,t.op.id,t.link.externalId,s.organisation.name,c.reasonCode,now);
  else{
   // An amendment carries the correction visit's document: the purpose, permission, identity and dispute checks of a publication apply.
   ensureAmendPurpose(m,c);
   const cv=correctionVisitOf(s,v);if(!currentConfirmed(cv))fail(409,'An amendment carries the confirmed correction visit of this visit. Confirm the correction visit first.');
   const g=currentWritePermission(p,t.link.id,now);if(!g)fail(409,'A current care-coordination write permission for this patient link is required.');
   await ehrAccess(s,p,t.link.id,g.id,'write');
   {const b=await sendBlock(s,cv,i,'prepare');if(b.block)fail(409,b.block.text);}
   const bundle:any=fhirDocument(p,cv,s.organisation.name,u.displayName,wid,t.link.externalId);bundle.entry[0].resource.relatesTo=[{code:'replaces',targetIdentifier:{system:DOCUMENT_SYSTEM,value:t.op.id}}];
   validateOutbound(bundle,t.link.externalId,now);withinPermission(inspectDocument(bundle,t.link.externalId),g);
   payload=bundle;Object.assign(bound,{permissionId:g.id,identityHash:await identityHash(p),correctionVisitId:cv.id,correctionVersion:cv.version});
  }
 }
 const list=v.withdrawals??[];
 if(list.some(x=>x.original.id===original.id&&(WITHDRAWAL_OPEN as readonly string[]).includes(x.state)))fail(409,'A withdrawal of this record is already open. Approve, send, look up or cancel it first.');
 if(list.some(x=>x.original.id===original.id&&x.state==='accepted'))fail(409,'The destination already confirmed a withdrawal or amendment of this record. Nothing more is sent from Saha.');
 if(list.length>=WITHDRAWAL_LIMIT)fail(422,`This visit already has ${WITHDRAWAL_LIMIT} withdrawals. Resolve the remaining ones with the destination by its own process.`);
 const w:Withdrawal={id:wid,kind:c.target,operation:c.operation,adapterOperation:adapter,visitId:v.id,personId:p.id,original,destination:{id:i.id,name:i.name,mode:i.mode==='http'?'http':'demo'},reasonCode:c.reasonCode,reason:c.reason,
  bound:{personVersion:p.version,consentVersion:p.consentVersion,visitVersion:v.version,visitStatus:visitStatus(v),integrationVersion:i.version,operationsVersion:operationsOf(i).version,...bound},
  payload,payloadHash:await digest(payload),state:'prepared',preparedBy:u.userId,preparedByName:u.displayName,preparedAt:now,attempts:0,events:[],message:'',updatedAt:now};
 withdrawalEvent(w,now,'prepared',`Prepared by ${u.displayName}: ${label(w)} of ${c.target==='programme-submission'?'submission':'document'} ${original.receipt} at ${i.name} (${WITHDRAWAL_REASON_LABEL[c.reasonCode]}). Review the exact payload; a care worker approves it, then sends it within ${WITHDRAWAL_APPROVAL_MINUTES} minutes. Nothing was sent.`);
 v.withdrawals=[...list,w];
 withdrawalAudit(s,u,m,c.type,w,`${label(w)[0].toUpperCase()+label(w).slice(1)} ${w.id} prepared for ${i.name}: ${c.target==='programme-submission'?'programme submission':'EHR publication'} ${original.id} (receipt ${original.receipt}), operation ${adapter}; payload SHA-256 ${w.payloadHash}. The original and its receipt are kept unchanged. Reason: ${c.reason}`,now);
 return {withdrawalId:w.id,state:w.state,payloadHash:w.payloadHash};
}
async function approve(s:OrgState,c:Extract<WithdrawalCommand,{type:'approveWithdrawal'}>,u:Actor,m:Member,now:string){
 withdrawalActor(s,m,c.personId);const {w}=findWithdrawal(s,c.personId,c.withdrawalId);
 if(w.state!=='prepared')fail(409,'Only a prepared withdrawal can be approved.');
 ensureAmendPurpose(m,w);
 if(w.payloadHash!==c.payloadHash)fail(409,'This is not the withdrawal you reviewed. Refresh and review it again.');
 const problem=await bindingProblem(s,w,now);if(problem)fail(409,`Not approved: ${problem} since this ${label(w)} was prepared. Cancel it and prepare a new one.`);
 const i=s.workspace.integrations.find(x=>x.id===w.destination.id)!,refused=operationRefusal(i,w.adapterOperation,'patient');if(refused)fail(409,`${refused} Cancel this ${label(w)}.`);
 w.state='approved';w.approvedBy=u.userId;w.approvedByName=u.displayName;w.approvedAt=now;w.expiresAt=new Date(Date.parse(now)+WITHDRAWAL_APPROVAL_MINUTES*60000).toISOString();
 withdrawalEvent(w,now,'approved',`Approved by ${u.displayName} for the exact payload (SHA-256 ${w.payloadHash}). ${u.displayName} sends it before ${w.expiresAt}.`);
 withdrawalAudit(s,u,m,c.type,w,`${label(w)[0].toUpperCase()+label(w).slice(1)} ${w.id} for ${w.destination.name} approved for ${WITHDRAWAL_APPROVAL_MINUTES} minutes (payload SHA-256 ${w.payloadHash}).`,now);
 return {withdrawalId:w.id,state:w.state,expiresAt:w.expiresAt};
}
function cancel(s:OrgState,c:Extract<WithdrawalCommand,{type:'cancelWithdrawal'}>,u:Actor,m:Member,now:string){
 withdrawalActor(s,m,c.personId);const {w}=findWithdrawal(s,c.personId,c.withdrawalId);
 if(w.state!=='prepared'&&w.state!=='approved')fail(409,'Only a withdrawal that was never sent can be cancelled. Look up an unknown outcome instead.');
 w.state='cancelled';delete w.payload;withdrawalEvent(w,now,'cancelled',`Cancelled by ${u.displayName}. Nothing was sent.`);
 withdrawalAudit(s,u,m,c.type,w,`${label(w)[0].toUpperCase()+label(w).slice(1)} ${w.id} for ${w.destination.name} cancelled before sending. Nothing was sent.`,now);
 return {withdrawalId:w.id,state:w.state};
}
// Prepare, approve and cancel run inside the ordinary command commit; execute and lookup have their own checkpoints
// (withdrawal-execution.ts). Returns null for any other command.
export async function applyWithdrawal(s:OrgState,input:unknown,u:Actor,m:Member,now=new Date().toISOString()):Promise<any|null>{
 const parsed=withdrawalSchema.safeParse(input);if(!parsed.success)return null;const c=parsed.data;
 if(c.type==='prepareWithdrawal')return prepare(s,c,u,m,now);
 if(c.type==='approveWithdrawal')return approve(s,c,u,m,now);
 if(c.type==='cancelWithdrawal')return cancel(s,c,u,m,now);
 return null;
}

// The demonstration simulators' answer to a withdrawal (in process, deterministic). A simulator whose behaviour is
// "uncertain" records the withdrawal but loses its response; a lookup then finds the receipt without anything being sent
// again. A simulator rejects a withdrawal of a receipt it never issued.
export function demoWithdrawalTransport(i:Integration,w:Withdrawal,lookup:boolean):unknown{
 const receipt=`SIM-W-${w.id.replace(/[^0-9a-f]/gi,'').slice(0,8).toUpperCase()}`,known=typeof w.original.receipt==='string'&&w.original.receipt.startsWith('SIM-');
 const answer=(status:'accepted'|'rejected'|'not_found')=>({contract:WITHDRAWAL_CONTRACT,key:w.id,payloadHash:w.payloadHash,status,...(status==='accepted'?{receipt}:{})});
 if(lookup)return answer(i.behavior==='reject'||!known?'not_found':'accepted');
 if(i.behavior==='reject'||!known)return answer('rejected');
 if(i.behavior==='uncertain')throw new Error('Simulated lost response.');
 return answer('accepted');
}
// Applies a destination answer (or a lost one) to a withdrawal that was sent or looked up.
export function applyWithdrawalReceipt(w:Withdrawal,raw:unknown,lost:boolean,lookup:boolean,at:string){
 const unknown=()=>{w.state='uncertain';withdrawalEvent(w,at,'uncertain',lost?`No response from ${w.destination.name}. Look up this ${label(w)}'s receipt before anything else; do not resend.`:`No matching definitive receipt was received${lookup?' by this lookup':''}. The outcome stays unknown: look it up again or reconcile with ${w.destination.name}; do not resend.`);};
 if(lost)return unknown();
 let status:'accepted'|'rejected'|'pending'|'not_found',receipt:string|undefined;
 try{
  if(w.kind==='programme-submission'){
   const r=receiptSchema.safeParse(raw);if(!r.success)throw new Error('contract');const x=r.data;
   if(x.key!==w.id||x.payloadHash!==w.payloadHash||(x.status==='accepted'&&!x.receipt)||(x.status==='not_found'&&!lookup))throw new Error('mismatch');
   status=x.status;receipt=x.receipt;
  }else{
   let res:any=raw;if(lookup){const b:any=raw;if(b?.resourceType!=='Bundle'||b.type!=='searchset'||!Array.isArray(b.entry)||b.entry.length!==1)throw new Error('lookup');res=b.entry[0].resource;}
   receipt=w.operation==='amend'?publicationReceipt(res,w.payload,w.bound.externalId!):noticeReceipt(res,w.payload);status='accepted';
  }
 }catch{return unknown();}
 if(status==='pending')return unknown();
 if(status==='accepted'){w.state='accepted';w.receipt=receipt;withdrawalEvent(w,at,'accepted',`${w.destination.name} confirmed the ${label(w)} with receipt ${receipt}${lookup?', found by lookup; nothing was sent again':''}. The original receipt ${w.original.receipt} is kept unchanged.`);}
 else if(status==='rejected'){w.state='rejected';withdrawalEvent(w,at,'rejected',`${w.destination.name} rejected this ${label(w)}. The original record stands at the destination; resolve it with the destination, or prepare a new ${label(w)} if appropriate.`);}
 else{w.state='not-stored';withdrawalEvent(w,at,'not-stored',`${w.destination.name} confirmed it holds no ${label(w)} under this key. Nothing was resent; prepare and approve a new ${label(w)} if it is still needed.`);}
 if((WITHDRAWAL_TERMINAL as readonly string[]).includes(w.state))delete w.payload;
}
// When the destination confirms, the visit's open correction tasks for that output are completed with the verified receipt:
// a withdrawal completes the tasks of a wrong-patient visit, an EHR amendment those of an amended visit.
export function completeCorrectionTasks(s:OrgState,v:Visit,w:Withdrawal,u:Actor,m:Member,at:string){
 if(w.state!=='accepted'||!w.receipt)return [];const closed:string[]=[];
 for(const t of v.correctionTasks??[]){
  if(t.state!=='open'||!t.external||t.output.refId!==w.original.id||t.output.kind!==w.kind)continue;
  const fits=w.operation==='withdraw'?t.cause==='void'&&['send-withdrawal','manual-correction','look-up-first'].includes(t.action):t.cause==='amend'&&['send-correction','manual-correction','look-up-first'].includes(t.action);
  if(!fits)continue;
  t.state='closed';t.closed={by:u.userId,byName:u.displayName,at,verified:true,receiptId:w.receipt,reason:`Completed by ${label(w)} ${w.id}: ${w.destination.name} confirmed receipt ${w.receipt}.`};closed.push(t.id);
  s.workspace.audit.push({id:uuid(),at,actorId:u.userId,actor:u.displayName,role:m.role,action:'closeCorrectionTask',subject:v.id,personId:v.personId,detail:`Correction task closed (${t.output.label}) by the confirmed ${label(w)} ${w.id}: receipt ${w.receipt} verified. The original record and its receipt ${w.original.receipt} were not changed.`});
 }
 if(closed.length)w.closedTaskIds=[...(w.closedTaskIds??[]),...closed];
 return closed;
}
