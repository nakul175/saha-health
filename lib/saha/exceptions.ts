import { z } from 'zod';
import { fail, uuid } from './core';
import { allowed, normallyAllowed } from './access';
import { defaultOperations, operator, requireReporting } from './operations';
import { activeOwner } from './referrals';
import { escalation } from './referral-rules';
import { PACKS } from './programmes';
import type { Member, OrgState, Person } from './types';
import { planItemWaiting } from './plan-dependency-state';
import type { Actor } from './store';

// Slice 6i: item-level operational exception queue (BR-REP-01; item links for NFR-18). Computed on read
// from the records that hold each problem. Supervisors and owners see rows for patients in their care
// scope with a link that opens the patient and visit. Operations members (owners, administrators) also see
// destination-delivery rows for patients outside that scope, without patient details or links.
export const EXCEPTION_RULES_VERSION='1.4.0';
export type ExceptionKind='safety-case'|'submission'|'ehr-publication'|'referral-overdue'|'emergency-access-unreviewed'|'protocol-review'|'follow-up-overdue'|'identity-provisional'|'identity-conflict'|'field-grant-expired'|'device-diagnostic'|'abdm-received'|'referral-request-waiting'|'operation-refused'|'correction-task';
export type ExceptionRow={id:string;kind:ExceptionKind;severity:'critical'|'high'|'normal';what:string;since:string;ageDays:number;owner:string;recovery:string;patient:{id:string;name:string}|null;link:{personId:string;visitId:string|null;href:string}|null;trace:{query:'submission'|'publication';id:string}|null;assignment:{version:number;assignedTo:string;assignedToName:string;assignedBy:string;assignedAt:string;reason:string}|null;diagnosticActorId?:string};
export type DeviceDiagnostic={id:string;actorId:string;at:string;code:'storage-quota'|'storage-write'|'crypto-unavailable'|'sync-transport'|'sync-refused'|'purge-write';draftCount:number;pendingCount:number};
const RANK={critical:0,high:1,normal:2} as const;
// Destination-delivery problems are operations work: shown, redacted, to operations members for any patient.
const OPERATIONS_KINDS=new Set<ExceptionKind>(['submission','ehr-publication','operation-refused']);
export const STALE_RUNNING_MINUTES=10,MAX_ROWS=500,MAX_ASSIGNMENTS=1000;
// Slice 3i (rules 1.1.0): a field referral request undecided this long is raised here as well as in its own queue.
export const REQUEST_WAIT_HOURS=48;
const day=86400000;
export const href=(personId:string,visitId:string|null)=>`/?patient=${encodeURIComponent(personId)}${visitId?`&visit=${encodeURIComponent(visitId)}`:''}`;

export function exceptionQueue(s:OrgState,m:Member,now=new Date().toISOString()){
 requireReporting(m);if(m.status!=='active')fail(403,'Your membership is inactive.');
 const today=now.slice(0,10),members=new Map(s.members.map(x=>[x.userId,x])),rows:ExceptionRow[]=[];
 const name=(id?:string|null)=>id?members.get(id)?.displayName??'Former member':null;
 const assigned=(id:string)=>{const a=s.operations?.exceptionAssignments?.[id];return a?{version:a.version,assignedTo:a.assignedTo,assignedToName:name(a.assignedTo)!,assignedBy:a.assignedBy,assignedAt:a.assignedAt,reason:a.reason}:null;};
 // Records indexed by patient once, so the queue grows linearly with the organisation.
 const byPerson=<T extends {personId:string}>(xs:readonly T[])=>{const m=new Map<string,T[]>();for(const x of xs){const l=m.get(x.personId);if(l)l.push(x);else m.set(x.personId,[x]);}return m;};
 const subs=byPerson(s.workspace.submissions),refs=byPerson(s.workspace.referrals),visits=byPerson(s.workspace.visits),safety=byPerson(s.governance?.safety??[]);
 const team=(p:Person)=>s.teams.find(t=>t.id===p.teamId)?.name??'the patient\'s team';
 for(const p of s.workspace.people){
  const visible=m.role!=='admin'&&allowed(m,p,now),ops=operator(m);if(!visible&&!ops)continue;
  // Slice 6y: delivery rows name the submission or publication whose trace the viewer may open (GET /api/trace).
  const add=(r:Omit<ExceptionRow,'patient'|'link'|'ageDays'|'trace'|'assignment'>,visitId:string|null,trace:ExceptionRow['trace']=null)=>{
   if(!visible&&!OPERATIONS_KINDS.has(r.kind))return;
   const assignment=assigned(r.id);rows.push({...r,ageDays:Math.max(0,Math.floor((Date.parse(now)-Date.parse(r.since))/day)),owner:assignment?.assignedToName??r.owner,patient:visible?{id:p.id,name:p.name}:null,link:visible?{personId:p.id,visitId,href:href(p.id,visitId)}:null,trace,assignment});
  };
  // Programme submissions whose destination outcome is unknown, retryable or rejected (and not since accepted).
  const mine=subs.get(p.id)??[];
  for(const x of mine){
   if(x.state==='rejected'&&mine.some(y=>y.visitId===x.visitId&&y.connectorId===x.connectorId&&y.createdAt>x.createdAt))continue;
   if(!['uncertain','retryable','rejected'].includes(x.state))continue;
   add({id:'submission:'+x.id,kind:'submission',severity:x.state==='rejected'?'normal':'high',what:`${x.connectorName}: ${x.state==='uncertain'?'outcome unknown':x.state==='retryable'?'delivery failed, retryable':'rejected by the destination'} after ${x.attempts} attempt${x.attempts===1?'':'s'}`,since:x.updatedAt,owner:'Operations (owner or administrator)',
    recovery:x.state==='uncertain'?'Look up the receipt before any resend; never send again blindly.':x.state==='retryable'?'Retry with the original key, or cancel if the visit changed.':'Read the rejection, correct the visit by amendment, then prepare a new submission.'},x.visitId,{query:'submission',id:x.id});
  }
  // Slice 7e (rules 1.2.0): deliveries closed as not sent because the destination's operation was withdrawn or
  // it is aggregate-only, until a later submission for the same visit and destination exists.
  for(const x of mine){
   if(!x.refusal||x.state!=='cancelled'||mine.some(y=>y.visitId===x.visitId&&y.connectorId===x.connectorId&&y.createdAt>x.createdAt))continue;
   add({id:'operation-refused:submission:'+x.id,kind:'operation-refused',severity:'normal',what:`${x.connectorName}: not sent, ${x.refusal.aggregateOnly?'destination is aggregate-only':x.refusal.operation+' not permitted'} (setting version ${x.refusal.settingVersion})`,since:x.refusal.at,owner:'Operations (owner or administrator)',recovery:'Nothing was sent. If this destination should receive the record, an owner reviews its operation setting and a care worker prepares a new plan. Never resend the closed item.'},x.visitId,{query:'submission',id:x.id});
  }
  for(const o of p.ehr?.operations??[]){
   if(!o.refusal||o.state!=='blocked'||(p.ehr?.operations??[]).some(y=>y.visitId===o.visitId&&y.linkId===o.linkId&&y.at>o.at&&y.id!==o.id))continue;
   add({id:'operation-refused:ehr-publication:'+o.id,kind:'operation-refused',severity:'normal',what:`EHR publication not sent, ${o.refusal.operation} not permitted (setting version ${o.refusal.settingVersion})`,since:o.refusal.at,owner:'Operations (owner or administrator)',recovery:'Nothing was sent. If the EHR should receive the document, an owner reviews the connection\'s operation setting and a care worker prepares a new publication.'},o.visitId,{query:'publication',id:o.id});
  }
  // EHR publications without a final receipt. Slice 7f (rules 1.3.0): rows name the connection's reconciliation owner
  // when one is set; a conflict (several documents, or a different one, under the publication's identifier) is that
  // owner's; a publication the EHR's authoritative search showed as not stored is listed until a later publication of
  // the same visit to the same link exists.
  for(const [operationIndex,o] of (p.ehr?.operations??[]).entries()){
   const ops=p.ehr?.operations??[],link=p.ehr?.links.find(l=>l.id===o.linkId),conn=link?s.workspace.integrations.find(i=>i.id===link.integrationId):undefined,ownerId=conn?.ehr?.lookup?.ownerId??null;
   const owner=ownerId?`${name(ownerId)} (reconciliation owner)`:'Operations (owner or administrator)';
   if(o.state==='conflict'){add({id:'ehr-publication:'+o.id,kind:'ehr-publication',severity:'high',what:`EHR publication conflict: ${o.resolution?.matches===1?'the one document under its identifier differs from the published document':`${o.resolution?.matches??'several'} documents carry its identifier`}`,since:o.resolution?.at??o.at,owner,recovery:'Compare the matching documents with the partner and agree which one stands. Saha does not choose; do not publish again.'},o.visitId,{query:'publication',id:o.id});continue;}
   // Operations append in preparation order. Equal-millisecond timestamps do not make a replacement disappear.
   if(o.state==='not-stored'){if(ops.some((y,index)=>y.id!==o.id&&y.visitId===o.visitId&&y.linkId===o.linkId&&(y.at>o.at||y.at===o.at&&index>operationIndex)))continue;
    add({id:'ehr-publication:'+o.id,kind:'ehr-publication',severity:'normal',what:'EHR publication not stored (authoritative identifier search found no document)',since:o.resolution?.at??o.at,owner:`Care workers of ${team(p)}`,recovery:'Nothing was resent. If the document is still needed, a care worker prepares a new publication and approves it.'},o.visitId,{query:'publication',id:o.id});continue;}
   if(!(o.state==='uncertain'||o.state==='running'&&Date.parse(now)-Date.parse(o.at)>STALE_RUNNING_MINUTES*60000))continue;
   add({id:'ehr-publication:'+o.id,kind:'ehr-publication',severity:'high',what:`EHR publication ${o.state==='uncertain'?'outcome unknown':'still running after '+STALE_RUNNING_MINUTES+' minutes'}`,since:o.at,owner,recovery:'Look up the document identifier with the EHR; do not publish again.'},o.visitId,{query:'publication',id:o.id});
  }
  if(!visible)continue;
  // Open clinical safety cases.
  for(const c of safety.get(p.id)??[])if(c.state==='open')
   add({id:'safety-case:'+c.id,kind:'safety-case',severity:'critical',what:`Open clinical safety case (${c.kind.replace(/-/g,' ')})`,since:c.createdAt,owner:name(c.ownerId)??`Clinicians of ${team(p)}`,recovery:'The clinical owner reviews the evidence in Clinical governance and resolves or reassigns the case.'},c.visitId);
  // Escalated referrals (slice 4a rules).
  for(const r of refs.get(p.id)??[]){
   if(planItemWaiting(s,p,{kind:'referral',id:r.id}))continue;
   const e=escalation(r,activeOwner(s,r,p),now);if(e.level!=='escalated')continue;
   add({id:'referral-overdue:'+r.id,kind:'referral-overdue',severity:(r.urgency??'routine')==='emergency'?'critical':'high',what:`Referral to ${r.facility}: ${e.reasons.join('; ')}`,since:r.due&&r.due<today?r.due+'T00:00:00.000Z':r.events?.at(-1)?.occurredAt??r.createdAt,
    owner:activeOwner(s,r,p)?name(r.ownerId)!:`Supervisors of ${team(p)}`,recovery:'Record the next referral event with evidence, a reasoned delay, or assign an owner from the patient\'s action plan.'},r.visitId);
  }
  // Emergency access that has ended without the team's review.
  for(const g of p.exceptionalAccess??[])if(!g.review&&(g.closedAt||g.until<=now))
   add({id:'emergency-access-unreviewed:'+g.id,kind:'emergency-access-unreviewed',severity:'high',what:`Emergency access by ${name(g.userId)??'a clinician'} ended without review`,since:g.closedAt??g.until,owner:`Supervisors and owners of ${team(p)}`,recovery:'Review the access and its reason in Care handover and record whether it was appropriate.'},null);
  // The latest protocol evaluation of each current visit, with findings and no clinician decision.
  for(const v of visits.get(p.id)??[])if(!v.voidedAt&&!v.supersededBy){
   const c=v.protocolChecks?.at(-1);if(!c||c.decision||!c.findings.length)continue;
   add({id:'protocol-review:'+c.id,kind:'protocol-review',severity:c.findings.some(f=>f.urgency==='urgent_review')?'high':'normal',what:`${c.findings.length} protocol finding${c.findings.length===1?'':'s'} awaiting clinician review`,since:c.at,owner:`Clinicians of ${team(p)}`,recovery:'A clinician with access accepts, rejects or overrides the findings on the visit.'},v.id);
  }
  // Slice 3i: field referral requests on a current visit left undecided for REQUEST_WAIT_HOURS or more.
  for(const v of visits.get(p.id)??[]){const q=v.referralRequest;if(!q||q.decision||v.voidedAt||v.supersededBy||Date.parse(now)-Date.parse(q.requestedAt)<REQUEST_WAIT_HOURS*3600000)continue;const ready=v.state==='confirmed';
   add({id:'referral-request-waiting:'+v.id,kind:'referral-request-waiting',severity:v.clinicalConcern?.value==='yes'?'high':'normal',what:`Field referral request to ${q.facility} not decided${ready?'':'; the visit is not confirmed'}`,since:q.requestedAt,owner:ready?`Clinicians of ${team(p)}`:name(q.requestedBy)??`Supervisors of ${team(p)}`,recovery:ready?'A clinician opens the visit and creates the referral or declines the request with a reason.':'The worker who recorded the visit confirms it; a clinician then decides the request.'},v.id);}
  // Slice 2j (rules 1.3.0): open correction tasks of amended or voided visits, external outputs first.
  for(const v of visits.get(p.id)??[])for(const t of v.correctionTasks??[])if(t.state==='open'){
   const o=t.ownerId?members.get(t.ownerId):undefined,ok=!!o&&o.status==='active'&&['asha','clinician'].includes(o.role)&&normallyAllowed(o,p);
   add({id:'correction-task:'+t.id,kind:'correction-task',severity:t.external?'high':'normal',what:`${t.cause==='amend'?'Corrected':'Wrong-patient'} visit: ${t.output.label} (${t.output.stateAtCorrection}) ${t.external?'needs a correction with the destination':'needs review'}`,since:t.createdAt,owner:ok?o!.displayName:`Supervisors of ${team(p)}`,recovery:`${t.instruction} Close it from the patient's action plan with the correction receipt or a reason.`},v.id);
  }
  // Overdue programme follow-ups.
  for(const t of p.followUps??[])if(t.state==='open'&&t.due<today&&!planItemWaiting(s,p,{kind:'follow-up',id:t.id})){
   const o=members.get(t.ownerId),ok=!!o&&o.status==='active'&&['asha','clinician'].includes(o.role)&&normallyAllowed(o,p);
   add({id:'follow-up-overdue:'+t.id,kind:'follow-up-overdue',severity:'normal',what:`${PACKS.find(x=>x.id===t.packId)?.name??t.packId} follow-up "${t.title}" due ${t.due}${ok?'':'; owner has no current access'}`,since:t.due+'T00:00:00.000Z',owner:ok?o!.displayName:`Supervisors of ${team(p)}`,recovery:'Complete it, or reassign it from the patient\'s action plan.'},null);
  }
  // Identities kept provisional at registration.
  if(p.identityReview?.state==='provisional')
   add({id:'identity-provisional:'+p.id,kind:'identity-provisional',severity:'normal',what:'Identity recorded as provisional; confirmed care, referrals and sharing are held',since:p.identityReview.at,owner:`Clinicians of ${team(p)}`,recovery:'A clinician reviews possible matches in Care handover and resolves the identity with a reference.'},null);
  // Field grants that expired without a sync: offline work on that device cannot be accepted on this grant.
  for(const l of p.fieldLeases??[])if(l.status==='active'&&l.expiresAt<=now)
   add({id:'field-grant-expired:'+l.id,kind:'field-grant-expired',severity:'normal',what:'Field visit grant expired without a sync',since:l.expiresAt,owner:name(l.actorId)??`Supervisors of ${team(p)}`,recovery:'Ask the worker whether anything was captured offline; prepare a new field visit to sync it, otherwise revoke the grant.'},l.visitId);
  // ABDM records received and not yet reviewed.
  for(const r of p.abdmReceived??[])if(r.state==='review'||r.state==='quarantined')
   add({id:'abdm-received:'+r.id,kind:'abdm-received',severity:r.state==='quarantined'?'high':'normal',what:r.state==='quarantined'?`Quarantined ABDM record (${r.hiType}): ${r.quarantineReason??'validation or reconciliation required'}`:`Received ABDM record (${r.hiType}) awaiting review`,since:r.receivedAt,owner:`Clinicians of ${team(p)}`,recovery:r.state==='quarantined'?'Resolve the patient, duplicate or document conflict through the configured reconciliation process; local observations remain unchanged.':'A clinician with access accepts or rejects the record on the patient screen.'},null);
 }
 // Open identity conflicts name two records. They are visible only to a current identity steward with normal
 // access to both records; owner status and emergency access never widen this scope.
 for(const c of s.identityCases??[]){if(c.state!=='proposed')continue;const survivor=s.workspace.people.find(p=>p.id===c.survivorId),duplicate=s.workspace.people.find(p=>p.id===c.duplicateId);if(!survivor||!duplicate||!['clinician','supervisor'].includes(m.role)||!normallyAllowed(m,survivor)||!normallyAllowed(m,duplicate))continue;
  const id='identity-conflict:'+c.id,assignment=assigned(id);rows.push({id,kind:'identity-conflict',severity:'high',what:`Possible duplicate identity: ${duplicate.name} and ${survivor.name} await an independent steward decision`,since:c.proposedAt,ageDays:Math.max(0,Math.floor((Date.parse(now)-Date.parse(c.proposedAt))/day)),owner:assignment?.assignedToName??`Identity stewards of ${team(duplicate)}`,recovery:'A different identity steward compares both records and accepts or rejects the proposal. Records are never merged automatically.',patient:{id:duplicate.id,name:duplicate.name},link:{personId:duplicate.id,visitId:null,href:href(duplicate.id,null)},trace:null,assignment});
 }
 rows.sort((a,b)=>RANK[a.severity]-RANK[b.severity]||b.ageDays-a.ageDays||a.since.localeCompare(b.since)||a.id.localeCompare(b.id));
 const counts:Record<string,number>={};for(const r of rows)counts[r.kind]=(counts[r.kind]??0)+1;
 return {rulesVersion:EXCEPTION_RULES_VERSION,generatedAt:now,total:rows.length,counts,items:rows.slice(0,MAX_ROWS),truncated:rows.length>MAX_ROWS,
  scope:m.role==='admin'?'Administrators see destination-delivery exceptions without patient details.':operator(m)?'Patients in your care teams, plus destination-delivery exceptions for other patients without patient details.':'Patients in your care teams.'};
}

// Device reports are retained in their append-only D1 evidence table, outside the organisation JSON. This pure
// projection lets the route join those fixed-code, count-only reports to the ordinary queue without patient data.
export function deviceDiagnosticRows(s:OrgState,m:Member,reports:readonly DeviceDiagnostic[],now=new Date().toISOString()):ExceptionRow[]{
 requireReporting(m);const assignments=s.operations?.exceptionAssignments??{},members=new Map(s.members.map(x=>[x.userId,x])),rows:ExceptionRow[]=[];
 for(const report of reports){const worker=members.get(report.actorId);if(!worker||worker.status!=='active')continue;const inScope=operator(m)||(m.role==='supervisor'&&worker.teamIds.some(t=>m.teamIds.includes(t)));if(!inScope)continue;
  const id='device-diagnostic:'+report.id,a=assignments[id],label=report.code.replaceAll('-',' '),serious=['storage-write','crypto-unavailable','purge-write'].includes(report.code);
  rows.push({id,kind:'device-diagnostic',severity:serious?'high':'normal',what:`Device reported ${label}; ${report.draftCount} draft${report.draftCount===1?'':'s'}, ${report.pendingCount} awaiting a confirmed sync outcome`,since:report.at,ageDays:Math.max(0,Math.floor((Date.parse(now)-Date.parse(report.at))/day)),owner:a?members.get(a.assignedTo)?.displayName??'Former member':`${worker.displayName}'s supervisors`,recovery:'Contact the worker, preserve the encrypted notebook and exact receipt key, then retry only the documented same-key recovery after connectivity, storage and access are verified.',patient:null,link:null,trace:null,diagnosticActorId:worker.userId,assignment:a?{version:a.version,assignedTo:a.assignedTo,assignedToName:members.get(a.assignedTo)?.displayName??'Former member',assignedBy:a.assignedBy,assignedAt:a.assignedAt,reason:a.reason}:null});
 }
 return rows.sort((a,b)=>RANK[a.severity]-RANK[b.severity]||b.ageDays-a.ageDays||a.since.localeCompare(b.since)||a.id.localeCompare(b.id));
}
export function withDeviceDiagnostics<T extends ReturnType<typeof exceptionQueue>>(base:T,diagnostics:ExceptionRow[]){
 const items=[...base.items,...diagnostics].sort((a,b)=>RANK[a.severity]-RANK[b.severity]||b.ageDays-a.ageDays||a.since.localeCompare(b.since)||a.id.localeCompare(b.id)),counts={...base.counts};if(diagnostics.length)counts['device-diagnostic']=(counts['device-diagnostic']??0)+diagnostics.length;
 return {...base,total:base.total+diagnostics.length,counts,items:items.slice(0,MAX_ROWS),truncated:base.truncated||items.length>MAX_ROWS};
}

const id=z.string().trim().min(1).max(240),reason=z.string().trim().min(10,'Explain the assignment in at least 10 characters.').max(500);
export const exceptionAssignmentSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('assignException'),itemId:id,itemSince:z.string().datetime({offset:true}),rulesVersion:z.literal(EXCEPTION_RULES_VERSION),expectedAssignmentVersion:z.number().int().min(0),assigneeId:id,reason}).strict(),
]);
const deliveryKind=(kind:ExceptionKind)=>OPERATIONS_KINDS.has(kind);
const deliveryKindFromId=(id:string)=>id.startsWith('submission:')||id.startsWith('ehr-publication:')||id.startsWith('operation-refused:');
export function authorizeExceptionAssignment(s:OrgState,m:Member,c:{type?:string;itemId?:string},receiptPersonId?:string|null){
 if(c?.type!=='assignException')return;const itemId=c.itemId;if(!itemId)fail(422,'The exception identifier is required.');requireReporting(m);if(deliveryKindFromId(itemId)){if(!operator(m))fail(403,'Operations access is required to assign a destination exception.');return;}
 // Fresh commands are checked against the exact current queue in applyExceptionAssignment. Receipt replays also
 // re-check the retained patient scope, even if the exception has since resolved and is no longer in the queue.
 if(!receiptPersonId)return;const p=s.workspace.people.find(x=>x.id===receiptPersonId);if(!p)fail(403,'This exception is outside your current scope.');
 if(itemId.startsWith('identity-conflict:')){const cse=(s.identityCases??[]).find(x=>'identity-conflict:'+x.id===itemId),other=cse?s.workspace.people.find(x=>x.id===(cse.survivorId===p.id?cse.duplicateId:cse.survivorId)):null;if(!cse||!other||!['clinician','supervisor'].includes(m.role)||!normallyAllowed(m,p)||!normallyAllowed(m,other))fail(403,'This identity exception is outside your current scope.');}
 else if(!allowed(m,p))fail(403,'This exception is outside your current scope.');
}
export function applyExceptionAssignment(s:OrgState,input:unknown,u:Actor,m:Member,now=new Date().toISOString(),additionalRows:readonly ExceptionRow[]=[]):{ok:true;itemId:string;assignmentVersion:number;assigneeId:string;assigneeName:string}|null{
 const parsed=exceptionAssignmentSchema.safeParse(input);if(!parsed.success)return null;const c=parsed.data;authorizeExceptionAssignment(s,m,c);
 const row=[...exceptionQueue(s,m,now).items,...additionalRows].find(x=>x.id===c.itemId);if(!row)fail(409,'This exception is resolved or outside your current scope. Refresh the queue.');
 if(row.since!==c.itemSince)fail(409,'This exception changed. Refresh the queue before assigning it.');
 const ops=s.operations??=defaultOperations(),assignments=ops.exceptionAssignments??={},prior=assignments[c.itemId];if((prior?.version??0)!==c.expectedAssignmentVersion)fail(409,'This exception assignment changed. Refresh the queue.');
 if(!prior&&Object.keys(assignments).length>=MAX_ASSIGNMENTS)fail(422,'Exception assignment history is full; archive policy review is required.');
 const target=s.members.find(x=>x.userId===c.assigneeId&&x.status==='active');if(!target)fail(422,'Choose an active member.');
 if(deliveryKind(row.kind)){if(!operator(target))fail(422,'Choose an active operations member for a destination exception.');}
 else if(row.kind==='device-diagnostic'){const worker=s.members.find(x=>x.userId===row.diagnosticActorId);if(!worker||(!operator(target)&&(target.role!=='supervisor'||!target.teamIds.some(t=>worker.teamIds.includes(t)))))fail(422,'Choose an operations member or a supervisor responsible for this worker.');}
 else{
  if(!row.patient)fail(409,'This patient-scoped exception is unavailable. Refresh the queue.');const p=s.workspace.people.find(x=>x.id===row.patient!.id);if(!p||!normallyAllowed(target,p))fail(422,'Choose a member whose current responsibilities cover this patient.');
  if(row.kind==='identity-conflict'){const cse=(s.identityCases??[]).find(x=>'identity-conflict:'+x.id===row.id),other=cse?s.workspace.people.find(x=>x.id===(cse.survivorId===p.id?cse.duplicateId:cse.survivorId)):null;if(!cse||!other||!['clinician','supervisor'].includes(target.role)||!normallyAllowed(target,other))fail(422,'Choose an identity steward with current access to both records.');}
  else if(['safety-case','protocol-review','identity-provisional','abdm-received','referral-request-waiting'].includes(row.kind)&&!['clinician','supervisor'].includes(target.role))fail(422,'Choose a clinician or supervisor for this review.');
  else if(row.kind==='emergency-access-unreviewed'&&target.role!=='supervisor')fail(422,'Choose a supervisor for this access review.');
  else if(!['asha','clinician','supervisor'].includes(target.role))fail(422,'Choose an active care worker or supervisor.');
 }
 const version=(prior?.version??0)+1,history=[...(prior?.history??[]),...(prior?[{version:prior.version,assignedTo:prior.assignedTo,assignedBy:prior.assignedBy,assignedAt:prior.assignedAt,reason:prior.reason}]:[])].slice(-20);
 assignments[c.itemId]={version,itemId:c.itemId,itemSince:row.since,assignedTo:target.userId,assignedBy:u.userId,assignedAt:now,reason:c.reason,history};ops.exceptionAssignments=assignments;ops.version++;ops.updatedAt=now;
 s.workspace.audit.push({id:uuid(),at:now,actorId:u.userId,actor:u.displayName,role:m.role,action:'assignException',subject:c.itemId,personId:row.patient?.id??null,detail:`Exception ${c.itemId} assigned to ${target.displayName} at assignment version ${version}. Recovery action unchanged. Reason: ${c.reason}`});
 return {ok:true,itemId:c.itemId,assignmentVersion:version,assigneeId:target.userId,assigneeName:target.displayName};
}
