type DynamicValue = ReturnType<typeof JSON.parse>;

// SAHA-117 / BR-OPS-04 / NFR-18: a redacted operational failure projection.
// It contains counts and age only: no patient, visit, payload, provider response or free-text error.
import type { OrgState } from './types';
export const OPERATIONAL_SIGNAL_VERSION='1.0.0',QUEUE_STALL_MINUTES=5,FAILURE_WINDOW_HOURS=24;
export type OperationalSignals={version:typeof OPERATIONAL_SIGNAL_VERSION;asOf:string;queue:{stalled:number;oldestMinutes:number|null};connector:{unresolved:number};model:{unavailable:number};permission:{refused:number};telemetry:{configured:boolean;gap:boolean}};
const age=(value:string|undefined,now:number)=>value&&Number.isFinite(Date.parse(value))?Math.max(0,Math.floor((now-Date.parse(value))/60000)):null;
export function operationalSignals(s:OrgState,now=new Date().toISOString(),telemetryConfigured=true):OperationalSignals{
 const at=Date.parse(now),cutoff=at-QUEUE_STALL_MINUTES*60000,failureCutoff=new Date(at-FAILURE_WINDOW_HOURS*3600000).toISOString(),ages:number[]=[];
 const stale=(value:string|undefined)=>{const n=age(value,at);if(n!==null&&Date.parse(value!)<=cutoff)ages.push(n);};
 for(const x of s.workspace.submissions)if(x.state==='sending')stale(x.delivery?.startedAt??x.updatedAt);
 for(const p of s.workspace.people)for(const x of p.ehr?.operations??[])if(x.state==='running')stale(x.publishStartedAt??x.at);
 for(const x of ((s.operations as DynamicValue)?.aggregateReports??[]) as {state:string;startedAt?:string;updatedAt?:string}[])if(x.state==='sending')stale(x.startedAt??x.updatedAt);
 for(const v of s.workspace.visits)for(const x of v.agentRuns??[])if(x.status==='running')stale(x.startedAt??x.createdAt);
 const unresolved=s.workspace.submissions.filter(x=>['uncertain','retryable'].includes(x.state)||(x.state==='rejected'&&x.updatedAt>=failureCutoff)).length+s.workspace.people.flatMap(p=>p.ehr?.operations??[]).filter(x=>['uncertain','conflict'].includes(x.state)).length+(((s.operations as DynamicValue)?.aggregateReports??[]) as {state:string;updatedAt?:string}[]).filter(x=>x.state==='uncertain'||(x.state==='rejected'&&(x.updatedAt??'')>=failureCutoff)).length;
 const unavailable=s.workspace.visits.flatMap(v=>v.agentRuns??[]).filter(x=>(['failed','blocked'].includes(x.status)&&(x.finishedAt??x.createdAt)>=failureCutoff)||(x.status==='running'&&age(x.startedAt??x.createdAt,at)!==null&&age(x.startedAt??x.createdAt,at)!>=QUEUE_STALL_MINUTES)).length;
 const refused=s.workspace.audit.filter(x=>x.at>=failureCutoff&&['adapterOperationRefused','sendBlocked'].includes(x.action)).length;
 return {version:OPERATIONAL_SIGNAL_VERSION,asOf:now,queue:{stalled:ages.length,oldestMinutes:ages.length?Math.max(...ages):null},connector:{unresolved},model:{unavailable},permission:{refused},telemetry:{configured:telemetryConfigured,gap:!telemetryConfigured}};
}
export function telemetryConfigured(env:Record<string,string|undefined>){return env.SAHA_TELEMETRY_ENABLED!=='false';}
