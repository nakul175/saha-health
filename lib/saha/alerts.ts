// Slice 6g: computed operational alerts (BR-OPS-04, NFR-18). Each rule reads the scoped report, the
// 24-hour request telemetry or the operations record that the viewer is already allowed to see,
// names the role that owns the response and the next safe action. Alerts are recomputed on every
// operations read; nothing is pushed, paged or messaged.
// Slice 6h: the owning role can acknowledge an alert with a note. An acknowledgement applies while the
// alert's count is unchanged and for at most 24 hours; operations acknowledgements are shared, supervisor
// acknowledgements are per supervisor because each sees a differently scoped count.
import { z } from 'zod';
import { fail, uuid } from './core';
import type { Actor } from './store';
import type { Member, OrgState } from './types';
export const ALERT_RULES_VERSION='1.0.0';
export const ERROR_RATE_THRESHOLD=0.05,ERROR_MIN_REQUESTS=20;
export type Alert={id:string;severity:'critical'|'high'|'normal';title:string;count:number;owner:'operations'|'supervisors';action:string;tab:'overview'|'service';acknowledged?:{by:string;at:string;note:string}|null};
export const ALERT_OWNERS={'destination-uncertain':'operations','ehr-uncertain':'operations','referrals-overdue':'supervisors','followups-overdue':'supervisors','referrals-undated':'supervisors','provider-usage-missing':'operations','server-errors':'operations','incident-critical-open':'operations','incident-open':'operations','maintenance':'operations'} as const;
export const ACK_HOURS=24,MAX_ACKS=200;
export type AlertAck={alertId:keyof typeof ALERT_OWNERS;count:number;userId:string;by:string;at:string;note:string;scope:'organisation'|'user'};
export const alertAckSchema=z.discriminatedUnion('type',[z.object({type:z.literal('opsAcknowledgeAlert'),alertId:z.enum(Object.keys(ALERT_OWNERS) as [keyof typeof ALERT_OWNERS,...(keyof typeof ALERT_OWNERS)[]]),count:z.number().int().min(1).max(1000000),note:z.string().trim().min(5,'Say what is being done, in at least 5 characters.').max(300)}).strict()]);
export function canAcknowledge(m:Member,owner:'operations'|'supervisors'){if(m.status!=='active')return false;return owner==='operations'?(m.isOwner||m.role==='admin'):(m.role==='supervisor'||(m.isOwner&&m.role!=='admin'));}
export function applyAlertAck(s:OrgState,input:unknown,u:Actor,m:Member,now=new Date().toISOString()){
 const parsed=alertAckSchema.safeParse(input);if(!parsed.success)return null;const c=parsed.data,owner=ALERT_OWNERS[c.alertId];
 if(!canAcknowledge(m,owner))fail(403,owner==='operations'?'Operations access is required to acknowledge this alert.':'A supervisor or owner with care reporting acknowledges this alert.');
 const ops=s.operations;if(!ops)fail(409,'Operations are not set up for this organisation.');const scope=owner==='operations'?'organisation':'user';
 const acks=(ops!.acknowledgements??=[]).filter(a=>!(a.alertId===c.alertId&&(scope==='organisation'?a.scope==='organisation':a.scope==='user'&&a.userId===u.userId)));
 if(acks.length>=MAX_ACKS)acks.sort((a,b)=>a.at.localeCompare(b.at)).shift();
 acks.push({alertId:c.alertId,count:c.count,userId:u.userId,by:u.displayName,at:now,note:c.note,scope});ops!.acknowledgements=acks;
 s.workspace.audit.push({id:uuid(),at:now,actorId:u.userId,actor:u.displayName,role:m.role,action:'opsAcknowledgeAlert',subject:s.organisation.id,detail:`Alert ${c.alertId} acknowledged at count ${c.count}: ${c.note}`});
 return {alertId:c.alertId,acknowledgedAt:now};
}

type Inputs={report:any|null;telemetry:any|null;operations:{maintenance:boolean;reason:string;incidents:{severity:string;state:string}[]}|null;acknowledgements?:AlertAck[];viewerId?:string;now?:string};
const RANK={critical:0,high:1,normal:2} as const;
export function alertsFor({report,telemetry,operations,acknowledgements=[],viewerId,now=new Date().toISOString()}:Inputs):Alert[]{
 const out:Alert[]=[],add=(a:Alert)=>{if(a.count>0)out.push(a);},b=report?.backlog;
 if(b){
  add({id:'destination-uncertain',severity:'high',title:'Programme submissions not yet confirmed by the destination',count:b.unresolvedSubmissions,owner:'operations',action:'Check each one: look up the receipt of any uncertain submission before a resend; queued and retryable ones may be retried with their original key.',tab:'overview'});
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
 const since=new Date(Date.parse(now)-ACK_HOURS*3600000).toISOString();
 for(const a of out){const ack=acknowledgements.filter(k=>k.alertId===a.id&&(k.scope==='organisation'||k.userId===viewerId)&&k.count===a.count&&k.at>since&&k.at<=now).sort((x,y)=>y.at.localeCompare(x.at))[0];a.acknowledged=ack?{by:ack.by,at:ack.at,note:ack.note}:null;}
 return out.sort((a,b)=>Number(!!a.acknowledged)-Number(!!b.acknowledged)||RANK[a.severity]-RANK[b.severity]||b.count-a.count||a.id.localeCompare(b.id));
}
