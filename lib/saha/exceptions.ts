import { fail } from './core';
import { allowed, normallyAllowed } from './access';
import { operator, requireReporting } from './operations';
import { activeOwner } from './referrals';
import { escalation } from './referral-rules';
import { PACKS } from './programmes';
import type { Member, OrgState, Person } from './types';

// Slice 6i: item-level operational exception queue (BR-REP-01; item links for NFR-18). Computed on read
// from the records that hold each problem. Supervisors and owners see rows for patients in their care
// scope with a link that opens the patient and visit. Operations members (owners, administrators) also see
// destination-delivery rows for patients outside that scope, without patient details or links.
export const EXCEPTION_RULES_VERSION='1.3.0';
export type ExceptionKind='safety-case'|'submission'|'ehr-publication'|'referral-overdue'|'emergency-access-unreviewed'|'protocol-review'|'follow-up-overdue'|'identity-provisional'|'field-grant-expired'|'abdm-received'|'referral-request-waiting'|'operation-refused'|'correction-task';
export type ExceptionRow={id:string;kind:ExceptionKind;severity:'critical'|'high'|'normal';what:string;since:string;ageDays:number;owner:string;recovery:string;patient:{id:string;name:string}|null;link:{personId:string;visitId:string|null;href:string}|null;trace:{query:'submission'|'publication';id:string}|null};
const RANK={critical:0,high:1,normal:2} as const;
// Destination-delivery problems are operations work: shown, redacted, to operations members for any patient.
const OPERATIONS_KINDS=new Set<ExceptionKind>(['submission','ehr-publication','operation-refused']);
export const STALE_RUNNING_MINUTES=10,MAX_ROWS=500;
// Slice 3i (rules 1.1.0): a field referral request undecided this long is raised here as well as in its own queue.
export const REQUEST_WAIT_HOURS=48;
const day=86400000;
export const href=(personId:string,visitId:string|null)=>`/?patient=${encodeURIComponent(personId)}${visitId?`&visit=${encodeURIComponent(visitId)}`:''}`;

export function exceptionQueue(s:OrgState,m:Member,now=new Date().toISOString()){
 requireReporting(m);if(m.status!=='active')fail(403,'Your membership is inactive.');
 const today=now.slice(0,10),members=new Map(s.members.map(x=>[x.userId,x])),rows:ExceptionRow[]=[];
 const name=(id?:string|null)=>id?members.get(id)?.displayName??'Former member':null;
 // Records indexed by patient once, so the queue grows linearly with the organisation.
 const byPerson=<T extends {personId:string}>(xs:readonly T[])=>{const m=new Map<string,T[]>();for(const x of xs){const l=m.get(x.personId);if(l)l.push(x);else m.set(x.personId,[x]);}return m;};
 const subs=byPerson(s.workspace.submissions),refs=byPerson(s.workspace.referrals),visits=byPerson(s.workspace.visits),safety=byPerson(s.governance?.safety??[]);
 const team=(p:Person)=>s.teams.find(t=>t.id===p.teamId)?.name??'the patient\'s team';
 for(const p of s.workspace.people){
  const visible=m.role!=='admin'&&allowed(m,p,now),ops=operator(m);if(!visible&&!ops)continue;
  // Slice 6y: delivery rows name the submission or publication whose trace the viewer may open (GET /api/trace).
  const add=(r:Omit<ExceptionRow,'patient'|'link'|'ageDays'|'trace'>,visitId:string|null,trace:ExceptionRow['trace']=null)=>{
   if(!visible&&!OPERATIONS_KINDS.has(r.kind))return;
   rows.push({...r,ageDays:Math.max(0,Math.floor((Date.parse(now)-Date.parse(r.since))/day)),patient:visible?{id:p.id,name:p.name}:null,link:visible?{personId:p.id,visitId,href:href(p.id,visitId)}:null,trace});
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
  // EHR publications without a final receipt.
  for(const o of p.ehr?.operations??[]){
   if(!(o.state==='uncertain'||o.state==='running'&&Date.parse(now)-Date.parse(o.at)>STALE_RUNNING_MINUTES*60000))continue;
   add({id:'ehr-publication:'+o.id,kind:'ehr-publication',severity:'high',what:`EHR publication ${o.state==='uncertain'?'outcome unknown':'still running after '+STALE_RUNNING_MINUTES+' minutes'}`,since:o.at,owner:'Operations (owner or administrator)',recovery:'Look up the document identifier with the EHR; do not publish again.'},o.visitId,{query:'publication',id:o.id});
  }
  if(!visible)continue;
  // Open clinical safety cases.
  for(const c of safety.get(p.id)??[])if(c.state==='open')
   add({id:'safety-case:'+c.id,kind:'safety-case',severity:'critical',what:`Open clinical safety case (${c.kind.replace(/-/g,' ')})`,since:c.createdAt,owner:name(c.ownerId)??`Clinicians of ${team(p)}`,recovery:'The clinical owner reviews the evidence in Clinical governance and resolves or reassigns the case.'},c.visitId);
  // Escalated referrals (slice 4a rules).
  for(const r of refs.get(p.id)??[]){
   const e=escalation(r as any,activeOwner(s,r,p),now);if(e.level!=='escalated')continue;
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
  for(const t of p.followUps??[])if(t.state==='open'&&t.due<today){
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
  for(const r of p.abdmReceived??[])if(r.state==='review')
   add({id:'abdm-received:'+r.id,kind:'abdm-received',severity:'normal',what:`Received ABDM record (${r.hiType}) awaiting review`,since:r.receivedAt,owner:`Clinicians of ${team(p)}`,recovery:'A clinician with access accepts or rejects the record on the patient screen.'},null);
 }
 rows.sort((a,b)=>RANK[a.severity]-RANK[b.severity]||b.ageDays-a.ageDays||a.since.localeCompare(b.since)||a.id.localeCompare(b.id));
 const counts:Record<string,number>={};for(const r of rows)counts[r.kind]=(counts[r.kind]??0)+1;
 return {rulesVersion:EXCEPTION_RULES_VERSION,generatedAt:now,total:rows.length,counts,items:rows.slice(0,MAX_ROWS),truncated:rows.length>MAX_ROWS,
  scope:m.role==='admin'?'Administrators see destination-delivery exceptions without patient details.':operator(m)?'Patients in your care teams, plus destination-delivery exceptions for other patients without patient details.':'Patients in your care teams.'};
}
