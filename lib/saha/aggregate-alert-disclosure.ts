import type {D1Database} from '@cloudflare/workers-types';
import type {Member,OrgState} from './types';
import {scope,readState} from './store';
import {careReport} from './operations';
import {reportingScope} from './delegation';
import {ensurePurpose} from './purpose-scope';
import {releaseOperational} from './operational-disclosure';
import {alertsFor} from './alerts';
import {digest,fail} from './core';
export const CLINICAL_AGGREGATE_ALERTS=['destination-uncertain','ehr-uncertain','referrals-overdue','followups-overdue','referrals-undated','provider-usage-missing'] as const;
export const clinicalAggregateAlert=(id:string)=>(CLINICAL_AGGREGATE_ALERTS as readonly string[]).includes(id);
export const AGGREGATE_ALERT_NOTICE='Historical care reporting notifications have no certified original contribution evidence. Their counts, events and unread totals are unavailable here. Current reporting alerts are regenerated under your current reporting permissions and small-group protection. Open the individual care record for authorised clinical work.';
export type AggregateAlertContext=Awaited<ReturnType<typeof captureAggregateAlerts>>;
const sourceBasis=(s:OrgState,m:Member,at:string)=>{const reach=reportingScope(s,m,at),people=s.workspace.people.filter(reach.include),ids=new Set(people.map(p=>p.id)),report=careReport(s,m,7,new Date(at),reach.include);return {member:m,reach:{teams:reach.teams,own:reach.own,delegations:reach.delegations},people:people.map(p=>[p.id,p.version]),visits:s.workspace.visits.filter(v=>ids.has(v.personId)).map(v=>[v.id,v.version,v.recordVersion]),report:{...report,activeWorkers:null,activeWorkersCoverage:null}};};
// Historical event counts cannot be certified by a new current projection. They stay immutable
// and private; this sidecar is a newly governed current view, without historical event IDs/times.
export async function captureAggregateAlerts(d:D1Database,s:OrgState,userId:string,at=new Date().toISOString()){
 const m=scope(s,userId);let basis:string|null=null,available=false,current:ReturnType<typeof alertsFor>=[];
 try{if(m.role==='admin')throw Error('No clinical reporting');ensurePurpose(m,'reporting',s.operations?.purposeGrants);const reach=reportingScope(s,m,at),raw=careReport(s,m,7,new Date(at),reach.include);basis=await digest(sourceBasis(s,m,at));const projected=await releaseOperational(d,s,m,raw,reach.include,at);if(projected.privacy?.withheld===false){available=true;current=alertsFor({report:projected,telemetry:null,operations:null}).filter(a=>clinicalAggregateAlert(a.id));}}
 catch{available=false;current=[];}
 return {m,at,basis,available,current,notice:AGGREGATE_ALERT_NOTICE};
}
export async function checkAggregateAlertContext(d:D1Database,orgId:string,ctx:AggregateAlertContext){
 const s=await readState(d,orgId),m=scope(s,ctx.m.userId);if(m.version!==ctx.m.version||m.role!==ctx.m.role||m.isOwner!==ctx.m.isOwner)fail(409,'Notification authority changed. Refresh the current view.');
 if(ctx.available){ensurePurpose(m,'reporting',s.operations?.purposeGrants);if(await digest(sourceBasis(s,m,ctx.at))!==ctx.basis)fail(409,'Current reporting authority or source changed. Refresh before viewing reporting alerts.');}
 return m;
}
// A read-only assertion inside the notification batch: malformed JSON aborts and rolls
// back the batch when its exact source/policy/membership basis changed, including an
// AFTER INSERT adversarial change. No clinical/organisation revision is advanced.
export function aggregateAlertTransactionGuard(d:D1Database,s:OrgState){
 const memberships=JSON.stringify(s.members.filter(m=>m.status==='active').map(m=>({id:m.userId,version:m.version,role:m.role,owner:m.isOwner?1:0}))),org=s.organisation.id;
 return d.prepare(`SELECT CASE WHEN EXISTS(SELECT 1 FROM organisations WHERE id=? AND revision=? AND COALESCE(patient_revision,0)=?) AND (SELECT count(*) FROM json_each(?) e JOIN memberships m ON m.org_id=? AND m.user_id=json_extract(e.value,'$.id') AND m.status='active' AND m.version=json_extract(e.value,'$.version') AND m.role=json_extract(e.value,'$.role') AND m.is_owner=json_extract(e.value,'$.owner'))=json_array_length(?) AND COALESCE((SELECT json(json_extract(data,'$.purposeGrants')) FROM operations WHERE org_id=?),'null')=? AND COALESCE((SELECT json(json_extract(data,'$.accessScope')) FROM operations WHERE org_id=?),'null')=? THEN 1 ELSE json('Current aggregate alert basis changed') END AS current`).bind(org,s.organisation.revision,s.organisation.patientRevision??0,memberships,org,memberships,org,JSON.stringify(s.operations?.purposeGrants??null),org,JSON.stringify(s.operations?.accessScope??null));
}
export function aggregateAlertGuardedDatabase(d:D1Database,s:OrgState):D1Database{
 return {prepare:(query:string)=>d.prepare(query),batch:async(statements:Parameters<D1Database['batch']>[0])=>{const rows=await d.batch([aggregateAlertTransactionGuard(d,s),...statements,aggregateAlertTransactionGuard(d,s)]);return rows.slice(1,-1);}} as D1Database;
}
