import {serviceDispatch} from './service-dispatch';
import type { D1Database } from '@cloudflare/workers-types';
import { AppError, fail, uuid } from './core';
import { persist, readState, scope, type Actor } from './store';
import { linkTrace } from './trace';
import { recordAccess } from './access-audit';
import { operationRefusal, refusalOf, type Refusal } from './adapter-operations';
import { resolveDefinition, MIN_CELL, releasePopulation } from './indicators';
import { ledgerFull, pruneLedger, screenReleases } from './indicator-differencing';
import { candidateReleases, ledgerHash, readLedger, writeLedger, type Candidate } from './indicator-ledger';
import { aggregateDestination, aggregateRefusal, applyAggregateReceipt, approveReport, buildPayload, bytesOf, compactReports, computeRuns, OPEN_STATES, PAYLOAD_BYTES, REPORTS_BYTES, demoAggregateTransport, findReport, minimisationCheck, REPORT_LIMIT, reportEvent, reportingScope, reportList, type AggregateCommand, type AggregateReport, type AggregateTransport, type TeamRun } from './aggregate-delivery';
import type { Member, OrgState } from './types';
// Slice 7g: preparing, approving, sending and looking up aggregate reports (see aggregate-delivery.ts).
export const LEDGER_WRITE_REFUSED='the differencing ledger could not record this release (storage refused the write), so the release could not be protected.';
const LEDGER_ATTEMPTS=3,receiver=(destinationId:string)=>`destination:${destinationId}`;
const audit=(s:OrgState,u:Actor,m:Member,action:string,subject:string,detail:string,at:string)=>s.workspace.audit.push({id:uuid(),at,actor:u.displayName,actorId:u.userId,role:m.role,action,subject,detail});
// The differencing screen for one report against the destination's recent releases (slice 6s/6w): a team whose
// cohort would reveal a remainder of 1 to 4 is withheld whole; otherwise each definition is screened.
// Slice 6ab (round-5 integration limit): each measure release is also checked against the organisation's people now
// (slice 6aa population check), as the indicator page does.
async function screen(db:D1Database,s:OrgState,destinationId:string,runs:TeamRun[],at:string){
 const orgId=s.organisation.id,population=await releasePopulation(s,ledgerHash(orgId),new Date(at));
 const {ledger,text}=await readLedger(db,orgId);let working=ledger;const released=new Map<string,Set<string>>(),accepted:Candidate[]=[];
 for(const run of runs){if(!run.results)continue;
  const cands=await candidateReleases(orgId,receiver(destinationId),{team:run.teamId},run.series,at),res=screenReleases(working,cands,MIN_CELL,at,population);
  if(res.refused.some(c=>c.isCohort)){released.set(run.teamId,new Set());continue;}
  const withheld=new Set(res.refused.flatMap(c=>c.ids));released.set(run.teamId,new Set(res.accepted.flatMap(c=>c.ids).filter(x=>!withheld.has(x))));
  accepted.push(...res.accepted);working=[...working,...res.accepted.map(c=>c.release)];}
 return {released,accepted,ledger,text};
}
// Recomputes a report from its recorded parameters (pinned definition versions, period, teams, grouping and the
// preparation time) on the state given, screened against the destination's current releases.
async function compute(db:D1Database,s:OrgState,m:Member,r:Pick<AggregateReport,'id'|'definitions'|'teamIds'|'group'|'period'|'computedAt'|'destinationId'>,releaseAt:string){
 const runs=computeRuns(s,m,r,new Date(r.computedAt)),sc=await screen(db,s,r.destinationId,runs,releaseAt);
 return {payload:await buildPayload(s,r.id,r,runs,sc.released,r.computedAt),screen:sc};
}
async function prepare(db:D1Database,s:OrgState,c:Extract<AggregateCommand,{type:'prepareAggregateReport'}>,u:Actor,m:Member,key:string,hash:string){
 reportingScope(m,c.teamIds);
 // The aggregate operation is checked before anything is prepared.
 const now=new Date(),at=now.toISOString(),i=aggregateDestination(s,c.destinationId),refused=aggregateRefusal(i,'before-send',at);if(refused)fail(409,refused.text+' Nothing was prepared.');
 // Slice 6ad (ninth review, finding 4): expired reports are closed first, and only open reports count.
 const expired=compactReports(s,at);
 if(reportList(s).filter(r=>OPEN_STATES.includes(r.state)).length>=REPORT_LIMIT)fail(409,`This organisation has ${REPORT_LIMIT} open aggregate reports, the most this release keeps open. Send, or let expire, an open report first.`);
 const definitions=c.definitions.map(ref=>{const d=resolveDefinition(s,ref);return `${d.id}@${d.version}`;});
 const id=uuid(),params={id,definitions,teamIds:c.teamIds,group:c.group,period:c.period,computedAt:at,destinationId:i.id};
 const {payload}=await compute(db,s,m,params,at);
 if(!payload.manifest.rows)fail(422,'Nothing in this report can be released: every block is withheld to protect small groups. Widen the teams, period or grouping.');
 const check=minimisationCheck(payload,s,'prepare',at);if(!check.passed)fail(422,`The report failed the payload minimisation check: ${check.problems[0]} Nothing was prepared.`);
 // Slice 6ad (finding 3): a payload and the stored reports are bounded so the operations row never reaches D1's limit.
 if(bytesOf(payload)>PAYLOAD_BYTES)fail(422,`This report is too large to keep (${Math.ceil(bytesOf(payload)/1000)} kB; at most ${PAYLOAD_BYTES/1000} kB). Choose fewer teams or indicators, or a coarser grouping. Nothing was prepared.`);
 const before=structuredClone(s),r:AggregateReport={...params,destinationName:i.name,state:'prepared',preparedBy:u.userId,preparedByName:u.displayName,preparedAt:at,payload,payloadSha256:payload.manifest.sha256,rowCount:payload.manifest.rows,attempts:0,minimisation:[check],events:[],message:'',updatedAt:at};
 reportEvent(r,at,`Prepared by ${u.displayName}: ${definitions.join(', ')} for ${c.period.start} to ${c.period.end}, ${c.teamIds.length} team${c.teamIds.length===1?'':'s'}. A different authorised person must approve it before it is sent.`);
 if(bytesOf(reportList(s))+bytesOf(r)>REPORTS_BYTES)fail(409,'The stored aggregate reports have reached the space this release keeps for them. Nothing was prepared; archiving closed reports is not built in this release.');
 reportList(s).push(r);
 for(const x of expired)audit(s,u,m,'aggregateReportExpired',x.id,x.message,at);
 audit(s,u,m,'prepareAggregateReport',id,`Aggregate report ${id} prepared for ${i.name}: ${definitions.join(', ')}; ${r.rowCount} rows; SHA-256 ${r.payloadSha256}; minimisation check passed (${check.fields} fields, ${check.cells} cells).`,at);
 linkTrace(before,s,c.type,key,u.userId);
 await persist(db,before,s,u,c,key,hash,{reportId:id,state:r.state});
 return {reportId:id,state:r.state,rows:r.rowCount,sha256:r.payloadSha256};
}
// A report that may not be sent is closed as not sent, with the reason recorded; it is never retried automatically.
async function closeRefused(db:D1Database,s:OrgState,r:AggregateReport,c:{type:string},u:Actor,m:Member,key:string,hash:string,text:string,refusal:Refusal&{reason?:string}){
 const before=structuredClone(s),at=new Date().toISOString();r.state='cancelled';r.refusal=refusal;delete r.payload;
 reportEvent(r,at,`Not sent: ${text} Nothing was sent to the destination; this report is closed. Prepare a new report if it is still needed.`);
 audit(s,u,m,'aggregateReportRefused',r.id,r.message,at);linkTrace(before,s,c.type,key,u.userId);
 await persist(db,before,s,u,c,key,hash,{reportId:r.id,state:r.state,refused:true});return {reportId:r.id,state:r.state,refused:true,message:r.message};
}
async function send(db:D1Database,s:OrgState,c:Extract<AggregateCommand,{type:'sendAggregateReport'|'lookupAggregateReport'}>,u:Actor,m:Member,key:string,hash:string,transport:AggregateTransport){
 const r=findReport(s,c.reportId);reportingScope(m,r.teamIds);const lookup=c.type==='lookupAggregateReport',now=new Date().toISOString();
 const i=s.workspace.integrations.find(x=>x.id===r.destinationId);if(!i)fail(409,'The destination connection no longer exists. Nothing was sent.');
 let releases:Candidate[]=[];
 if(lookup){
  if(!['uncertain','sending'].includes(r.state))fail(409,'Only a report with an unknown outcome needs a receipt lookup.');
  if(r.state==='sending'&&Date.parse(r.startedAt??'')>Date.now()-30000)fail(409,'The report is still being sent. Refresh shortly before looking up its receipt.');
  const refused=operationRefusal(i!,'lookup','none');if(refused)fail(409,refused+' The outcome stays unknown; do not resend.');
 } else {
  if(['accepted','rejected','cancelled'].includes(r.state))return {reportId:r.id,state:r.state};
  if(['uncertain','sending'].includes(r.state))fail(409,'The outcome of the earlier send is unknown. Look up its receipt; the report is never sent twice.');
  if(r.state!=='approved')fail(409,'A different authorised person must approve this report before it is sent.');
  if(![r.preparedBy,r.approvedBy].includes(u.userId))fail(403,'Only the person who prepared or approved this report may send it.');
  if(!r.expiresAt||r.expiresAt<now)fail(409,'The approval has expired. Prepare and approve a new report.');
  // Before the checkpoint: the operation, the stored payload's minimisation, and a recomputation that must match what was approved.
  const refused=aggregateRefusal(i!,'before-send',now);if(refused)return await closeRefused(db,s,r,c,u,m,key,hash,refused.text,refused.refusal);
  const check=minimisationCheck(r.payload,s,'before-send',now);r.minimisation.push(check);
  if(!check.passed)return await closeRefused(db,s,r,c,u,m,key,hash,`the payload failed the minimisation check (${check.problems[0]})`,{...refusalOf(i!,'aggregate','before-send',now),reason:'minimisation'});
  const again=await compute(db,s,m,r,now);
  if(again.payload.manifest.sha256!==r.payloadSha256)return await closeRefused(db,s,r,c,u,m,key,hash,'the report would now differ from what was approved, because records or earlier reports to this destination changed.',{...refusalOf(i!,'aggregate','before-send',now),reason:'changed'});
  releases=again.screen.accepted;
 }
 // Slice 6t: the request is recorded in the audit chain before it is sent; if it cannot be, nothing is sent.
 await recordAccess(db,s,u,m,{action:'externalRequest',subject:r.id,personId:null,detail:`${c.type}: ${lookup?'receipt lookup':'aggregate report'} ${r.id} to ${i!.name} about to be sent (${r.rowCount} rows, SHA-256 ${r.payloadSha256}; no patient-level data). The outcome is recorded separately.`});
 const before=structuredClone(s),operationId=uuid();r.operationId=operationId;r.startedAt=now;if(!lookup){r.state='sending';r.attempts++;}
 reportEvent(r,now,lookup?'Receipt lookup reserved; the report is not sent again.':'Checkpoint saved before the request to the destination.');
 audit(s,u,m,c.type,r.id,r.message,now);linkTrace(before,s,c.type,key,u.userId);
 await persist(db,before,s,u,c,key,hash,{reportId:r.id,state:r.state});
 // Inside the checkpoint, on a fresh read: the operation, the stored payload, and (for a send) the destination's release ledger.
 let withdrawn:string|null=null,refusal:(Refusal&{reason?:string})|undefined,check:ReturnType<typeof minimisationCheck>|undefined;
 {const latest=await readState(db,s.organisation.id),li=latest.workspace.integrations.find(x=>x.id===r.destinationId),stored=latest.operations&&((latest.operations as any).aggregateReports??[]).find((x:AggregateReport)=>x.id===r.id);
  if(!li)withdrawn='The destination connection no longer exists.';
  else if(lookup){withdrawn=operationRefusal(li,'lookup','none');if(withdrawn)refusal=refusalOf(li,'lookup','checkpoint');}
  // Slice 6ad (ninth review, finding 7): the checkpoint also re-checks operating mode, as an EHR publication does.
  else if(latest.operations?.maintenance){withdrawn='the organisation was paused for maintenance.';refusal={...refusalOf(li,'aggregate','checkpoint'),reason:'maintenance'};}
  else {const x=aggregateRefusal(li,'checkpoint',new Date().toISOString());if(x){withdrawn=x.text;refusal=x.refusal;}
   else {check=minimisationCheck(stored?.payload,latest,'checkpoint',new Date().toISOString());if(!check.passed){withdrawn=`the payload failed the minimisation check (${check.problems[0]})`;refusal={...refusalOf(li,'aggregate','checkpoint'),reason:'minimisation'};}}
   // Slice 13d (tenth review): the population screen counts the people in the sender's scope, as at preparation. The state read
   // inside the checkpoint is unscoped (every person unassigned), which made the population empty and the screen pass trivially.
   if(!withdrawn){try{scope(latest,m.userId);}catch{withdrawn='the sender\'s membership is no longer active.';refusal=refusalOf(li,'aggregate','checkpoint');}}
   if(!withdrawn)withdrawn=await recordReleases(db,latest,releases,now);
   if(withdrawn&&!refusal&&li)refusal={...refusalOf(li,'aggregate','checkpoint'),reason:'differencing'};}}
 let raw:unknown;if(!withdrawn)try{raw=await transport(i!,lookup?{contract:'saha-aggregate-v1',operation:'lookup',key:r.id,payloadHash:r.payloadSha256}:r.payload,lookup?'lookup_'+operationId:r.id);}catch(e){if(e&&typeof e==='object'&&'serviceRefusal' in e)withdrawn=e instanceof Error?e.message:'Service authority unavailable.';}
 for(let n=0;n<3;n++){
  const after=await readState(db,s.organisation.id),old=structuredClone(after),target=((after.operations as any)?.aggregateReports??[]).find((x:AggregateReport)=>x.id===r.id) as AggregateReport|undefined,at=new Date().toISOString();
  if(!target)fail(409,'The report checkpoint is unavailable.');
  if(target!.operationId!==operationId||['accepted','rejected','cancelled'].includes(target!.state)){
   // Slice 6ad (ninth review, finding 6): an answer that arrives after a lookup took over, or after the report closed,
   // is appended as evidence, never discarded. It resolves the report only while its outcome is still unknown.
   if(withdrawn||raw===undefined)return {reportId:r.id,state:target!.state};
   const was=target!.state,copy=structuredClone(target!);let note:string;
   try{applyAggregateReceipt(copy,raw,lookup,at);note=`Late answer to an earlier ${lookup?'receipt lookup':'send'}: ${copy.message}`;
    if(['sending','uncertain'].includes(was)&&['accepted','rejected'].includes(copy.state)){target!.state=copy.state;if(copy.receipt)target!.receipt=copy.receipt;}
    else if(copy.receipt&&!target!.receipt&&copy.state==='accepted'&&was==='accepted')target!.receipt=copy.receipt;}
   catch(e){note=`Late answer to an earlier ${lookup?'receipt lookup':'send'} did not match the aggregate receipt contract (${e instanceof Error?e.message:'unreadable'}).`;}
   reportEvent(target!,at,note+(target!.state===was?' The report state is unchanged.':''));if(!OPEN_STATES.includes(target!.state))delete target!.payload;
   audit(after,u,m,'aggregateReceipt',target!.id,target!.message,at);linkTrace(old,after,'aggregateReceipt','agg_late_'+operationId,u.userId);
   try{await persist(db,old,after,u,{type:'aggregateReceipt'},'agg_late_'+operationId,hash,{reportId:target!.id,state:target!.state});return {reportId:target!.id,state:target!.state,...(target!.receipt?{receipt:target!.receipt}:{})};}
   catch(e){if(!(e instanceof AppError&&e.status===409)||n===2)throw e;continue;}
  }
  if(check)target!.minimisation.push(check);
  if(withdrawn){
   if(lookup){target!.state='uncertain';reportEvent(target!,at,`Receipt lookup not made: ${withdrawn} The outcome stays unknown; do not resend.`);}
   else {target!.state='cancelled';target!.refusal=refusal;target!.attempts=Math.max(0,target!.attempts-1);reportEvent(target!,at,`Not sent: ${withdrawn} This was found after the checkpoint and before the request, so nothing was sent and the reserved attempt is released. This report is closed; prepare a new report if it is still needed.`);}
  }
  else try{applyAggregateReceipt(target!,raw,lookup,at);}catch{target!.state='uncertain';reportEvent(target!,at,'No matching definitive receipt was received. Look up this report before anything else; it is never sent again.');}
  if(!OPEN_STATES.includes(target!.state))delete target!.payload;
  const action=withdrawn&&!lookup?'aggregateReportRefused':'aggregateReceipt';
  // Receipts describe what already happened outside Saha; they are kept even if the sender's access changed in flight.
  audit(after,u,m,action,target!.id,target!.message,at);linkTrace(old,after,action,'agg_finish_'+operationId,u.userId);
  try{await persist(db,old,after,u,{type:action},'agg_finish_'+operationId,hash,{reportId:target!.id,state:target!.state});return {reportId:target!.id,state:target!.state,...(target!.receipt?{receipt:target!.receipt}:{}),...(withdrawn&&!lookup?{refused:true,message:target!.message}:{})};}
  catch(e){if(!(e instanceof AppError&&e.status===409)||n===2)throw e;}
 }
 fail(409,'Receipt storage remains unresolved. Refresh and look up the report; do not resend.');
}
// The release is recorded in the differencing ledger as a release to the destination before the request is made. A
// report sent to the same destination since this one was approved can make it unsafe: then nothing is sent.
// Slice 6ab: the checkpoint screen also uses the population check on the state read inside the checkpoint, and a ledger
// write that D1 refuses (for example a value over its size limit) closes the report as not sent with a clear reason.
async function recordReleases(db:D1Database,s:OrgState,releases:Candidate[],at:string):Promise<string|null>{
 const orgId=s.organisation.id,population=await releasePopulation(s,ledgerHash(orgId),new Date(at));
 for(let attempt=1;attempt<=LEDGER_ATTEMPTS;attempt++){
  const {ledger,text}=await readLedger(db,orgId),{refused}=screenReleases(ledger,releases,MIN_CELL,at,population);
  if(refused.length)return 'together with reports sent to this destination since approval and the people recorded now, it would reveal a group of fewer than 5 people.';
  if(ledgerFull(ledger,releases.map(c=>c.release),at))return 'the differencing ledger is full for this destination; try again when older releases leave the seven-day window.';
  let written=false;try{written=await writeLedger(db,orgId,text,pruneLedger([...ledger,...releases.map(c=>c.release)],at));}catch{return LEDGER_WRITE_REFUSED;}
  if(written)return null;
 }
 return 'many indicator releases were being recorded at once, so this release could not be recorded.';
}
export async function executeAggregate(db:D1Database,s:OrgState,c:AggregateCommand,u:Actor,m:Member,key:string,hash:string,transport:AggregateTransport=demoAggregateTransport){
 let serviceRefusal='';const deliver=transport;transport=async(i,...args)=>{try{await serviceDispatch(db,s,u,m,i.id,null,{intent:c.type==='lookupAggregateReport'?'lookup':'send',purpose:'reporting',authorize:(latest,member)=>{
   if(!('reportId' in c))fail(422,'Unsupported report request.');const prepared=findReport(s,c.reportId),r=findReport(latest,c.reportId);reportingScope(member,r.teamIds);
   if(r.operationId!==prepared.operationId||r.payloadSha256!==prepared.payloadSha256||!['sending','uncertain'].includes(r.state))fail(409,'Report checkpoint changed.');
   const li=latest.workspace.integrations.find(x=>x.id===i.id);if(!li||li.version!==i.version)fail(409,'Report destination changed.');
   if(c.type==='lookupAggregateReport'){const refusal=operationRefusal(li,'lookup','none');if(refusal)fail(409,refusal);return;}
   aggregateDestination(latest,r.destinationId);const refusal=aggregateRefusal(li,'checkpoint',new Date().toISOString());if(refusal)fail(409,refusal.text);
   if(JSON.stringify([r.teamIds,r.definitions,r.period,r.group,r.preparedBy,r.approvedBy,r.approvedAt,r.expiresAt])!==JSON.stringify([prepared.teamIds,prepared.definitions,prepared.period,prepared.group,prepared.preparedBy,prepared.approvedBy,prepared.approvedAt,prepared.expiresAt]))fail(409,'Report approval or scope changed.');
   if(r.state!=='sending'||![r.preparedBy,r.approvedBy].includes(u.userId)||!r.expiresAt||r.expiresAt<new Date().toISOString())fail(409,'Report approval changed or expired.');
   const check=minimisationCheck(r.payload,latest,'checkpoint',new Date().toISOString());if(!check.passed)fail(409,'Report minimisation changed.');
   // The ledger already contains this reserved release. Compare its prepared source population
   // instead of recording or recomputing the same release twice in the audit window.
   const source=(state:OrgState)=>{const people=state.workspace.people.filter(p=>r.teamIds.includes(p.teamId)),ids=new Set(people.map(p=>p.id));return JSON.stringify({people:people.map(p=>[p.id,p.version,p.consentVersion]).sort(),visits:state.workspace.visits.filter(v=>ids.has(v.personId)).map(v=>[v.id,v.version,v.state,v.voidedAt,v.supersededBy]).sort()});};
   if(source(s)!==source(latest))fail(409,'Report source records changed during dispatch. Prepare a new report.');
  }});}catch(e){serviceRefusal=e instanceof Error?e.message:'Service authority unavailable.';throw Object.assign(e instanceof Error?e:Error(serviceRefusal),{serviceRefusal:true});}return deliver(i,...args);};
 if(c.type==='prepareAggregateReport')return prepare(db,s,c,u,m,key,hash);
 if(c.type==='approveAggregateReport'){const before=structuredClone(s),result=approveReport(s,c,u,m,new Date().toISOString());linkTrace(before,s,c.type,key,u.userId);await persist(db,before,s,u,c,key,hash,result);return result;}
 return send(db,s,c,u,m,key,hash,transport);
}
