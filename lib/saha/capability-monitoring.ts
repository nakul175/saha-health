import type { AgentRun } from './agent';
import type { GovernanceEntry, SafetyCase } from './governance';
import type { OrgState, Visit } from './types';

export type CapabilityMonitoringThresholds={windowDays:number;minimumRuns:number;failureRatePercent:number;unsupportedRatePercent:number;latencyP95Ms:number};
export const DEFAULT_CAPABILITY_MONITORING:CapabilityMonitoringThresholds={windowDays:30,minimumRuns:10,failureRatePercent:10,unsupportedRatePercent:10,latencyP95Ms:30000};
const runs=(s:OrgState,e:GovernanceEntry)=>s.workspace.visits.flatMap(v=>(v.agentRuns??[]).filter(r=>r.governance?.id===e.id).map(r=>({visit:v,run:r})));
const percentile=(values:number[],p:number)=>values.length?values.slice().sort((a,b)=>a-b)[Math.ceil(values.length*p)-1]:null;
const pct=(n:number,d:number)=>d?Math.round(n/d*1000)/10:null;
export function capabilityMonitoring(s:OrgState,e:GovernanceEntry,now=new Date().toISOString(),thresholds:CapabilityMonitoringThresholds=DEFAULT_CAPABILITY_MONITORING){
 const since=Date.parse(now)-thresholds.windowDays*86400000,all=runs(s,e).filter(x=>Date.parse(x.run.createdAt)>=since),finished=all.filter(x=>['review','applied','failed','blocked','cancelled'].includes(x.run.status));
 const failures=finished.filter(x=>['failed','blocked'].includes(x.run.status)).length,unsupported=finished.filter(x=>x.run.assessment?.reason==='unsupported_case').length;
 const latencies=finished.flatMap(x=>x.run.startedAt&&x.run.finishedAt?[Date.parse(x.run.finishedAt)-Date.parse(x.run.startedAt)]:[]).filter(n=>Number.isFinite(n)&&n>=0);
 const incidents=(s.governance?.safety??[]).filter(x=>x.entryId===e.id&&Date.parse(x.createdAt)>=since),reviewed=finished.filter(x=>!!x.run.reviewDecision),accepted=reviewed.filter(x=>x.run.reviewDecision?.decision==='accepted').length;
 const failureRate=pct(failures,finished.length),unsupportedRate=pct(unsupported,finished.length),p95LatencyMs=percentile(latencies,.95),enough=finished.length>=thresholds.minimumRuns;
 const signals=[enough&&failureRate!==null&&failureRate>=thresholds.failureRatePercent?'failure-rate':null,enough&&unsupportedRate!==null&&unsupportedRate>=thresholds.unsupportedRatePercent?'unsupported-rate':null,enough&&p95LatencyMs!==null&&p95LatencyMs>=thresholds.latencyP95Ms?'latency':null,incidents.some(x=>x.state==='open')?'open-incident':null].filter((x):x is string=>!!x);
 return {entryId:e.id,revision:e.revision,state:e.state,window:{from:new Date(since).toISOString(),to:now,days:thresholds.windowDays},thresholds,sample:{runs:all.length,finished:finished.length,minimumMet:enough},availability:{failed:failures,ratePercent:failureRate},latency:{observed:latencies.length,p95Ms:p95LatencyMs},inputQuality:{unable:finished.filter(x=>!!x.run.assessment).length,unsupported,unsupportedRatePercent:unsupportedRate},usage:{total:all.length,byStatus:Object.fromEntries([...new Set(all.map(x=>x.run.status))].map(k=>[k,all.filter(x=>x.run.status===k).length]))},incidents:{open:incidents.filter(x=>x.state==='open').length,closed:incidents.filter(x=>x.state==='closed').length},reviewedOutcomes:{reviewed:reviewed.length,accepted,notAccepted:reviewed.length-accepted},signals,investigationRequired:signals.length>0,automaticSuspension:false};
}
