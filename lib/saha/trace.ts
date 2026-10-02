import { fail } from './core';
import { allowed } from './access';
import { operator } from './operations';
import { timedOut } from './task-limits';
import { ACCESS_ACTION_NAMES, type Member, type OrgState, type Person, type TraceRef, type Visit } from './types';
// Slice 6y: a read-only trace from the user commands that started a visit's external work to the execution
// checkpoints, the provider or destination receipts and callbacks, and the audit events (NFR-18, BR-REP-01).
//
// Correlation. From this slice on, every step an external execution adds (a programme delivery event, an EHR
// publication state, an assistant request state, a demo submission) carries a TraceRef: the command type, its
// receipt key, the actor and the id of the audit event written in the same commit. `linkTrace` stamps it on
// the steps a commit adds, just before the commit is persisted. Nothing written earlier is rewritten: older
// steps have no reference and the trace shows them as "not linked".
//
// Content. Ids, states, times, attempt numbers, limits, command types and actor names only: no facts, notes,
// payloads, document text, audit detail text or credentials.
// Slice 6aa: 1.1.0 adds receiptExists (a redacted trace no longer carries the receipt itself) and truncated.
export const TRACE_VERSION='1.1.0';
export const MIS_MAX_ATTEMPTS=3;
// Audit actions that belong to a visit's external work (listed for the visit even when not linked to a step).
export const EXECUTION_ACTIONS=['preparePlan','approvePlan','executePlan','sendSubmission','lookupSubmission','cancelSubmission','misReceipt','misCallback','prepareEhrPublish','executeEhrPublish','lookupEhrPublish','ehrReceipt','prepareAgent','executeAgent','cancelAgent','agentResult','closeTimedOutAgent','applyAgent','reviewAgent','adapterOperationRefused','scheduledTimeoutReview'] as const;
const DESTINATION=new Set(['misReceipt','ehrReceipt','agentResult']),CALLBACK=new Set(['misCallback']);
const ID=/^[A-Za-z0-9_-]{1,200}$/;

// ---- stamping (write side) ----
export function linkTrace(before:OrgState,after:OrgState,command:string,key:string,actorId:string,now=new Date().toISOString()){
 const seen=new Set((before.workspace.audit??[]).map(a=>a.id)),fresh=(after.workspace.audit??[]).filter(a=>!seen.has(a.id));
 // The audit event about the record itself, else its visit, else its patient, else the commit's first event.
 const audit=(subjects:string[])=>{for(const x of subjects){const a=fresh.find(e=>e.subject===x);if(a)return a.id;}return fresh[0]?.id??null;};
 const ref=(subjects:string[]):TraceRef=>({command,key,actorId,auditId:audit(subjects)});
 const prevSubs=new Map((before.workspace.submissions??[]).map(x=>[x.id,x]));
 for(const x of after.workspace.submissions??[]){
  const old=prevSubs.get(x.id),subjects=[x.id,x.visitId,x.personId];
  if(x.delivery){const n=old?.delivery?.events.length??0;for(let i=n;i<x.delivery.events.length;i++){const e=x.delivery.events[i];if(!e.ref){e.ref=ref(subjects);e.attempt=x.attempts;}}}
  else if(!old)x.trace=[{at:x.createdAt,state:x.state,attempt:x.attempts,ref:ref(subjects)}];
 }
 const prevOps=new Map((before.workspace.people??[]).flatMap(p=>(p.ehr?.operations??[]).map(o=>[o.id,o] as const)));
 for(const p of after.workspace.people??[])for(const o of p.ehr?.operations??[]){
  const old=prevOps.get(o.id);if(old&&old.state===o.state&&old.at===o.at)continue;
  (o.events??=[]).push({at:o.at,state:o.state,ref:ref([o.id,o.visitId,p.id])});
 }
 // Slice 7g: aggregate report events (organisation-level, kept in the operations record).
 const prevReports=new Map((((before.operations as any)?.aggregateReports??[]) as {id:string;events:any[]}[]).map(r=>[r.id,r]));
 for(const r of (((after.operations as any)?.aggregateReports??[]) as {id:string;destinationId:string;attempts:number;events:{ref?:TraceRef;attempt?:number}[]}[])){const n=prevReports.get(r.id)?.events.length??0;for(let i=n;i<r.events.length;i++){const e=r.events[i];if(!e.ref){e.ref=ref([r.id,r.destinationId]);e.attempt=r.attempts;}}}
 const prevRuns=new Map((before.workspace.visits??[]).flatMap(v=>(v.agentRuns??[]).map(r=>[r.id,r] as const)));
 for(const v of after.workspace.visits??[])for(const r of v.agentRuns??[]){
  const old=prevRuns.get(r.id);if(old&&old.status===r.status&&!!old.timeoutDecision===!!r.timeoutDecision&&!!old.reviewDecision===!!r.reviewDecision)continue;
  const at=!old?r.createdAt:r.status==='running'?r.startedAt??now:old.status==='running'&&r.finishedAt?r.finishedAt:now;
  (r.trace??=[]).push({at,state:r.status,attempt:r.callCount,ref:ref([r.id,v.id,v.personId])});
 }
}

// ---- reading ----
export type TraceQuery={visit?:string;submission?:string;publication?:string};
export function parseTraceQuery(params:URLSearchParams):TraceQuery{
 const keys=['visit','submission','publication'] as const,given=keys.filter(k=>params.has(k));
 if(given.length!==1||[...params.keys()].length!==1)fail(422,'Name one visit, submission or publication, and nothing else.');
 const k=given[0],v=params.get(k)??'';if(!ID.test(v))fail(422,'Use a record identifier.');
 return {[k]:v};
}
type Target={scope:'full'|'redacted';person:Person;visit:Visit|null;focus:string|null;threadIds:string[];redactedKind?:'submission'|'ehr-publication'};
// Who may see a trace: anyone who may open the visit (care scope, including a current emergency-access grant)
// sees all of it. Owners and administrators may see the trace of a programme submission or EHR publication of
// a patient outside their scope, as the exception queue shows them: that item only, without patient or visit
// identifiers, assistant requests or record-access events. Everyone else gets 404, as for a missing record.
export function traceTarget(s:OrgState,m:Member,q:TraceQuery,now=new Date().toISOString()):Target{
 if(m.status!=='active')fail(403,'Your membership is inactive.');
 const missing=()=>fail(404,'Record not found in your workspace.');
 let p:Person|undefined,v:Visit|undefined,focus:string|null=null,kind:'submission'|'ehr-publication'|undefined;
 if(q.visit){v=s.workspace.visits.find(x=>x.id===q.visit);p=v&&s.workspace.people.find(x=>x.id===v!.personId);}
 else if(q.submission){const x=s.workspace.submissions.find(y=>y.id===q.submission);if(x){p=s.workspace.people.find(y=>y.id===x.personId);v=s.workspace.visits.find(y=>y.id===x.visitId);focus='submission:'+x.id;kind='submission';}}
 else if(q.publication){for(const y of s.workspace.people){const o=y.ehr?.operations.find(z=>z.id===q.publication);if(o){p=y;v=s.workspace.visits.find(z=>z.id===o.visitId);focus='ehr-publication:'+o.id;kind='ehr-publication';break;}}}
 if(!p)return missing();
 if(allowed(m,p,now)){if(!v)return missing();return {scope:'full',person:p,visit:v,focus,threadIds:[]};}
 if(operator(m)&&kind&&focus)return {scope:'redacted',person:p,visit:null,focus,threadIds:[focus],redactedKind:kind};
 return missing();
}
export type TraceAuditRow={id:string;at:string;actor_name:string;role:string;action:string;subject:string;seq:number|null};
export type TraceReceiptRow={actor_id:string;key:string;created_at:string};
export type Step={at:string;state:string;attempt:number|null;source:'command'|'destination'|'callback'|'not linked';command:string|null;actor:string|null;receiptId:string|null;receiptAt:string|null;receiptFound:boolean|null;auditId:string|null;auditSeq:number|null;linked:boolean};
export type Thread={id:string;kind:'submission'|'ehr-publication'|'assistant';recordId:string;destination:string;state:string;receipt:string|null;receiptExists?:boolean;attempts:{used:number;limit:number|null;rule:string};limits:{timeMinutes:number|null;attempts:number|null}|null;taskAttempt:number|null;timedOut:boolean;steps:Step[];refusal:{operation:string;settingVersion:number;aggregateOnly:boolean;stage:string;at:string}|null};
type Raw={thread:Thread;steps:{at:string;state:string;attempt?:number;ref?:TraceRef}[]};
function threads(s:OrgState,t:Target,now:string):Raw[]{
 const out:Raw[]=[],p=t.person,want=(id:string)=>t.scope==='full'||t.threadIds.includes(id);
 const base=(id:string,kind:Thread['kind'],recordId:string,destination:string,state:string):Thread=>({id,kind,recordId,destination,state,receipt:null,attempts:{used:0,limit:null,rule:''},limits:null,taskAttempt:null,timedOut:false,steps:[],refusal:null});
 for(const x of s.workspace.submissions){
  if(x.personId!==p.id||(t.visit&&x.visitId!==t.visit.id)||!want('submission:'+x.id))continue;
  const th=base('submission:'+x.id,'submission',x.id,x.connectorName,x.state);th.receipt=x.receipt??null;th.refusal=x.refusal?{...x.refusal}:null;
  th.attempts=x.mode==='http'?{used:x.attempts,limit:MIS_MAX_ATTEMPTS,rule:`At most ${MIS_MAX_ATTEMPTS} sends with the same key; an unknown outcome is looked up, never resent.`}:{used:x.attempts,limit:1,rule:'Demo destination: one simulated delivery.'};
  const steps:Raw['steps']=x.delivery?x.delivery.events.map(e=>({at:e.at,state:e.state,attempt:e.attempt,ref:e.ref})):x.trace?.length?x.trace:[{at:x.updatedAt,state:x.state}];
  out.push({thread:th,steps});
 }
 for(const o of p.ehr?.operations??[]){
  if((t.visit&&o.visitId!==t.visit.id)||!want('ehr-publication:'+o.id))continue;
  const th=base('ehr-publication:'+o.id,'ehr-publication',o.id,s.workspace.integrations.find(i=>i.id===p.ehr?.links.find(l=>l.id===o.linkId)?.integrationId)?.name??'EHR',o.state);th.receipt=o.receipt??null;th.refusal=o.refusal?{...o.refusal}:null;
  th.attempts={used:o.state==='prepared'?0:1,limit:1,rule:'One publication per approval; an unknown outcome is looked up by document identifier, never published again.'};
  const steps:Raw['steps']=[...(o.events??[])];if(!steps.length||steps.at(-1)!.state!==o.state||steps.at(-1)!.at!==o.at)steps.push({at:o.at,state:o.state});
  out.push({thread:th,steps});
 }
 if(t.scope==='full'&&t.visit){
  const runs=t.visit.agentRuns??[];
  for(const r of runs){
   const th=base('assistant:'+r.id,'assistant',r.id,r.provider.name,r.status);th.limits=r.limits??null;th.timedOut=timedOut(r,now);
   th.attempts={used:r.callCount,limit:1,rule:'One provider call per approved request; automatic retries are disabled.'};
   if(r.callCount>0)th.taskAttempt=runs.filter(y=>y.task===r.task&&y.callCount>0&&(y.startedAt??y.createdAt)<=(r.startedAt??r.createdAt)).length;
   const steps:Raw['steps']=[...(r.trace??[])],has=(state:string)=>steps.some(x=>x.state===state);
   if(!has('pending'))steps.push({at:r.createdAt,state:'pending'});
   if(r.startedAt&&!has('running'))steps.push({at:r.startedAt,state:'running',attempt:r.callCount});
   if(r.finishedAt&&!['pending','running'].includes(r.status)&&!has(r.status))steps.push({at:r.finishedAt,state:r.status});
   // Slice 10a: the scheduled job marked this request as needing review (a mark only; the request itself is unchanged).
   if(r.timeoutReview&&!has('flagged for review'))steps.push({at:r.timeoutReview.at,state:'flagged for review'});
   if(r.timeoutDecision&&!steps.some(x=>x.at===r.timeoutDecision!.at))steps.push({at:r.timeoutDecision.at,state:'closed after time limit'});
   out.push({thread:th,steps});
  }
 }
 return out;
}
// The audit ids, receipt keys and subjects the server looks up for this target.
export function traceLookups(s:OrgState,t:Target,now=new Date().toISOString()){
 const raw=threads(s,t,now),refs=raw.flatMap(r=>r.steps.map(x=>x.ref).filter((x):x is TraceRef=>!!x));
 const subjects=[...new Set([...(t.visit?[t.visit.id]:[]),...raw.map(r=>r.thread.recordId)])];
 return {auditIds:[...new Set(refs.map(r=>r.auditId).filter((x):x is string=>!!x))],receipts:[...new Map(refs.map(r=>[r.actorId+'\u0000'+r.key,{actorId:r.actorId,key:r.key}])).values()],subjects,personId:t.person.id,visitId:t.visit?.id??null,access:t.scope==='full'};
}
export function assembleTrace(s:OrgState,m:Member,t:Target,audit:TraceAuditRow[],receipts:TraceReceiptRow[],now=new Date().toISOString(),truncated=false){
 const names=new Map(s.members.map(x=>[x.userId,x.displayName])),byAudit=new Map(audit.map(a=>[a.id,a])),byReceipt=new Map(receipts.map(r=>[r.actor_id+'\u0000'+r.key,r]));
 const actor=(id:string)=>id.startsWith('mis_callback_')?'Programme receipt callback':names.get(id)??'Former member';
 const raw=threads(s,t,now),linkedAudit=new Map<string,string[]>();
 for(const r of raw){
  r.thread.steps=r.steps.map((x):Step=>{
   if(!x.ref)return {at:x.at,state:x.state,attempt:x.attempt??null,source:'not linked',command:null,actor:null,receiptId:null,receiptAt:null,receiptFound:null,auditId:null,auditSeq:null,linked:false};
   const a=x.ref.auditId?byAudit.get(x.ref.auditId):undefined,rc=byReceipt.get(x.ref.actorId+'\u0000'+x.ref.key);if(a){const l=linkedAudit.get(a.id)??[];if(!l.includes(r.thread.id))l.push(r.thread.id);linkedAudit.set(a.id,l);}
   return {at:x.at,state:x.state,attempt:x.attempt??null,source:DESTINATION.has(x.ref.command)?'destination':CALLBACK.has(x.ref.command)?'callback':'command',command:x.ref.command,actor:actor(x.ref.actorId),receiptId:x.ref.key,receiptAt:rc?.created_at??null,receiptFound:!!rc,auditId:x.ref.auditId,auditSeq:a?.seq??null,linked:true};
  }).sort((a,b)=>a.at.localeCompare(b.at));
 }
 const access=new Set<string>(ACCESS_ACTION_NAMES);
 // Redacted traces list only the audit events linked to the item's own steps (plus, for older programme
 // deliveries, events about the submission itself); never record-access events.
 const events=audit.filter(a=>t.scope==='full'||linkedAudit.has(a.id)||(!access.has(a.action)&&t.threadIds.some(id=>id.endsWith(':'+a.subject))))
  .map(a=>({id:a.id,at:a.at,seq:a.seq,action:a.action,actor:a.actor_name,role:a.role,kind:access.has(a.action)?(a.action==='externalRequest'?'external-request':'record-access'):'execution',subject:t.scope==='full'?a.subject:null,steps:linkedAudit.get(a.id)??[]}))
  .sort((a,b)=>a.at.localeCompare(b.at)||(a.seq??0)-(b.seq??0));
 // Slice 6aa (seventh review, finding 7): a redacted trace says whether the destination returned a receipt, not the receipt.
 const list=raw.map(r=>({...r.thread,receipt:t.scope==='full'?r.thread.receipt:null,receiptExists:!!r.thread.receipt})).sort((a,b)=>(a.steps[0]?.at??'').localeCompare(b.steps[0]?.at??''));
 // Slice 6aa (finding 8): truncated is true when a lookup reached its limit; the newest events are the ones kept.
 return {traceVersion:TRACE_VERSION,generatedAt:now,scope:t.scope,truncated,
  visit:t.scope==='full'&&t.visit?{id:t.visit.id,personId:t.person.id,state:t.visit.state,version:t.visit.version}:null,
  focus:t.focus,threads:list,events,
  notLinked:list.reduce((n,x)=>n+x.steps.filter(y=>!y.linked).length,0),
  note:t.scope==='full'?'Ids, states and times only. Steps recorded before correlation references existed are shown as not linked.':`This ${t.redactedKind==='ehr-publication'?'publication':'submission'} is for a patient outside your care scope: patient and visit identifiers, assistant requests and record-access events are not shown.`,
  viewer:{role:m.role,isOwner:m.isOwner}};
}
