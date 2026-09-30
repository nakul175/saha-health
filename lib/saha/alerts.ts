// Slice 6g: computed operational alerts (BR-OPS-04, NFR-18). Each rule reads the scoped report, the
// 24-hour request telemetry or the operations record that the viewer is already allowed to see,
// names the role that owns the response and the next safe action. Alerts are recomputed on every
// operations read; nothing is pushed, paged or messaged.
export const ALERT_RULES_VERSION='1.0.0';
export const ERROR_RATE_THRESHOLD=0.05,ERROR_MIN_REQUESTS=20;
export type Alert={id:string;severity:'critical'|'high'|'normal';title:string;count:number;owner:'operations'|'supervisors';action:string;tab:'overview'|'service'};
type Inputs={report:any|null;telemetry:any|null;operations:{maintenance:boolean;reason:string;incidents:{severity:string;state:string}[]}|null};
const RANK={critical:0,high:1,normal:2} as const;
export function alertsFor({report,telemetry,operations}:Inputs):Alert[]{
 const out:Alert[]=[],add=(a:Alert)=>{if(a.count>0)out.push(a);},b=report?.backlog;
 if(b){
  add({id:'destination-uncertain',severity:'high',title:'Programme submissions without a final receipt',count:b.unresolvedSubmissions,owner:'operations',action:'Look up each receipt before any resend. Uncertain outcomes are never retried blindly.',tab:'overview'});
  add({id:'ehr-uncertain',severity:'high',title:'EHR publications without a final receipt',count:b.unresolvedEhr,owner:'operations',action:'Look up the document identifier with the EHR; do not publish again.',tab:'overview'});
  add({id:'referrals-overdue',severity:'high',title:'Referrals past their due date',count:b.overdueReferrals,owner:'supervisors',action:'Review the referral escalation queue in Care handover and record an action or a reasoned delay.',tab:'overview'});
  add({id:'followups-overdue',severity:'normal',title:'Follow-ups past their due date',count:b.overdueFollowUps,owner:'supervisors',action:'Reassign or complete overdue follow-ups from Care handover.',tab:'overview'});
  add({id:'referrals-undated',severity:'normal',title:'Open referrals without a due date',count:b.undatedReferrals,owner:'supervisors',action:'Set a due date so escalation can be tracked.',tab:'overview'});
 }
 if(report?.usage)add({id:'provider-usage-missing',severity:'normal',title:'Provider calls without reported usage',count:report.usage.missingUsage,owner:'operations',action:'Reconcile these calls with the provider before relying on cost estimates.',tab:'overview'});
 if(telemetry&&telemetry.count>=ERROR_MIN_REQUESTS&&telemetry.errorRate!==null&&telemetry.errorRate>ERROR_RATE_THRESHOLD)add({id:'server-errors',severity:'critical',title:`Server error rate above ${ERROR_RATE_THRESHOLD*100}% in the last 24 hours`,count:telemetry.serverErrors,owner:'operations',action:'Open an incident, check the failing routes, and pause the organisation if records are at risk.',tab:'service'});
 if(operations){
  const open=operations.incidents.filter(i=>i.state!=='resolved');
  add({id:'incident-critical-open',severity:'critical',title:'Critical incidents not resolved',count:open.filter(i=>i.severity==='critical').length,owner:'operations',action:'The incident owner updates the incident with evidence, or resolves it.',tab:'service'});
  add({id:'incident-open',severity:'normal',title:'Other incidents not resolved',count:open.filter(i=>i.severity!=='critical').length,owner:'operations',action:'Review each open incident and its owner.',tab:'service'});
  if(operations.maintenance)add({id:'maintenance',severity:'high',title:'Organisation paused for maintenance',count:1,owner:'operations',action:`Resume when the reason is resolved: ${operations.reason}`,tab:'service'});
 }
 return out.sort((a,b)=>RANK[a.severity]-RANK[b.severity]||b.count-a.count||a.id.localeCompare(b.id));
}
