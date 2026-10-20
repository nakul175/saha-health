import {z} from 'zod';
import {allowed, normallyAllowed} from './access';
import {fail, person, uuid} from './core';
import {supervises} from './delegation';
import {followUpOpen} from './programmes';
import {CONSTRAINTS, TERMINAL, type Urgency} from './referral-rules';
import type {Actor} from './store';
import type {Member, OrgState, Person, PlanItemRef} from './types';

export type DueWorkPolicy={version:number;state:'draft'|'active';timezone:string;escalateAfterDays:Record<Urgency,number>;unknownOutcomeAfterDays:number;reason:string;updatedAt:string;updatedBy:string;activatedAt?:string;activatedBy?:string};
export type DueWorkDelay={id:string;at:string;by:string;from:string;to:string;constraint:typeof CONSTRAINTS[number];reason:string;policyVersion:number};
const delayed=<T extends object>(task:T)=>task as T&{delays?:DueWorkDelay[]};
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(x=>!isNaN(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x);
export const dueWorkSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('opsDueWorkPolicy'),version:z.number().int().min(0),policyVersion:z.number().int().min(0),state:z.enum(['draft','active']),timezone:z.string().trim().min(1).max(80),emergencyDays:z.number().int().min(0).max(30),urgentDays:z.number().int().min(0).max(60),routineDays:z.number().int().min(0).max(180),unknownOutcomeDays:z.number().int().min(1).max(30),reason:z.string().trim().min(10).max(500)}).strict(),
 z.object({type:z.literal('delayDueWork'),personId:z.string().min(1).max(200),personVersion:z.number().int().positive(),taskId:z.string().min(1).max(200),expectedDue:date,due:date,constraint:z.enum(CONSTRAINTS),reason:z.string().trim().min(10).max(1000),policyVersion:z.number().int().positive()}).strict(),
]);

export function timezoneValid(value:string){try{new Intl.DateTimeFormat('en',{timeZone:value}).format(new Date());return true;}catch{return false;}}
type DueWorkOperations={version:number;updatedAt:string;dueWorkPolicy?:DueWorkPolicy};
const operations=(s:OrgState)=>s.operations as (typeof s.operations&DueWorkOperations)|undefined;
const policyFor=(s:OrgState)=>operations(s)?.dueWorkPolicy;
export function localDate(now:string,timezone:string){return new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));}
const day=86400000;
const openRef=(s:OrgState,p:Person,r:PlanItemRef)=>r.kind==='follow-up'?!!p.followUps?.some(x=>x.id===r.id&&followUpOpen(s,x)):r.kind==='referral'?s.workspace.referrals.some(x=>x.id===r.id&&x.personId===p.id&&!TERMINAL.has(x.state)):s.workspace.visits.some(v=>v.personId===p.id&&!v.voidedAt&&!v.supersededBy&&v.protocolChecks?.some(c=>c.id===r.id&&!c.decision&&c.findings.length));
const waiting=(s:OrgState,p:Person,ref:PlanItemRef)=>(p.planDependencies??[]).filter(d=>!d.removed&&d.dependent.kind===ref.kind&&d.dependent.id===ref.id&&openRef(s,p,d.blocker)).map(d=>({dependencyId:d.id,kind:d.blocker.kind,id:d.blocker.id}));
const currentOwner=(s:OrgState,p:Person,id:string|undefined)=>{const m=s.members.find(x=>x.userId===id);return m&&['asha','clinician'].includes(m.role)&&normallyAllowed(m,p)?m:null;};
const previousOwner=(s:OrgState,p:Person)=>{const e=p.assignmentHistory?.at(-1);if(!e)return null;return {userId:e.fromOwner,displayName:s.members.find(x=>x.userId===e.fromOwner)?.displayName??'Former member',teamId:e.fromTeam,at:e.at,reason:e.reason,openWorkAtTransfer:e.openWork};};
const overdue=(due:string,today:string)=>due<today?Math.max(1,Math.floor((Date.parse(today+'T00:00:00Z')-Date.parse(due+'T00:00:00Z'))/day)):0;

export function dueWorkQueue(s:OrgState,m:Member,now=new Date().toISOString()){
 if(m.role==='admin')fail(403,'Due-work queues contain patient information.');
 const policy=policyFor(s);if(!policy||policy.state!=='active')return {policy:null,configurationRequired:true,items:[],scope:'No active organisation-approved due-work policy. No escalation threshold is inferred.'};
 const today=localDate(now,policy.timezone),members=new Map(s.members.map(x=>[x.userId,x]));
 const rows:any[]=[],leadTeams=new Set<string>();
 for(const p of s.workspace.people){if(p.mergedInto||!allowed(m,p,now))continue;const lead=supervises(s,m,p.teamId,now,false);if(lead)leadTeams.add(p.teamId);
  for(const t of p.followUps??[]){if(!followUpOpen(s,t))continue;const mine=t.ownerId===m.userId;if(!mine&&!lead)continue;const owner=currentOwner(s,p,t.ownerId),blocked=waiting(s,p,{kind:'follow-up',id:t.id}),days=overdue(t.due,today),gap=!owner,threshold=policy.escalateAfterDays.routine,escalated=gap||(!blocked.length&&days>threshold);if(lead&&!mine&&!escalated)continue;
   rows.push({key:'follow-up:'+t.id,kind:'follow-up',personId:p.id,personVersion:p.version,personName:p.name,teamId:p.teamId,title:t.title,due:t.due,urgency:'routine',daysOverdue:days,attention:escalated?'escalated':blocked.length?'waiting':days?'overdue':t.due===today?'due-today':'upcoming',reasons:[...(gap?['No active owner with current care access']:[]),...(escalated&&days>threshold?[`Overdue by ${days} days under policy v${policy.version}`]:[]),...(blocked.length?[`Waiting on ${blocked.length} open plan item${blocked.length===1?'':'s'}`]:[])],owner:owner?{userId:owner.userId,displayName:owner.displayName}:null,previousOwner:previousOwner(s,p),waitingOn:blocked,delays:delayed(t).delays??[],mine,canDelay:(mine||lead)&&!blocked.length});
  }
  for(const r of s.workspace.referrals){if(r.personId!==p.id||TERMINAL.has(r.state))continue;const mine=r.ownerId===m.userId;if(!mine&&!lead)continue;const owner=currentOwner(s,p,r.ownerId),blocked=waiting(s,p,{kind:'referral',id:r.id}),days=r.due?overdue(r.due,today):0,urgency:Urgency=r.urgency??'routine',threshold=policy.escalateAfterDays[urgency],gap=!owner,stale=['unknown','not-attended'].includes(r.state)&&Math.floor((Date.parse(now)-Date.parse(r.events?.at(-1)?.occurredAt??r.createdAt))/day)>=policy.unknownOutcomeAfterDays,escalated=gap||stale||(!blocked.length&&days>threshold);if(lead&&!mine&&!escalated)continue;
   rows.push({key:'referral:'+r.id,kind:'referral',personId:p.id,personVersion:p.version,personName:p.name,teamId:p.teamId,title:`Referral to ${r.facility}`,due:r.due??null,urgency,daysOverdue:days,attention:escalated?'escalated':blocked.length?'waiting':days?'overdue':r.due===today?'due-today':'upcoming',reasons:[...(gap?['No active owner with current care access']:[]),...(stale?[`${r.state==='unknown'?'Outcome unknown':'Missed appointment'} beyond policy v${policy.version}`]:[]),...(escalated&&days>threshold?[`Overdue by ${days} days under policy v${policy.version}`]:[]),...(!r.due?['No due date']:[]),...(blocked.length?[`Waiting on ${blocked.length} open plan item${blocked.length===1?'':'s'}`]:[])],owner:owner?{userId:owner.userId,displayName:owner.displayName}:null,previousOwner:previousOwner(s,p),waitingOn:blocked,delays:r.delays??[],mine,canDelay:false});
  }
 }
 const attention:Record<string,number>={escalated:0,overdue:1,'due-today':2,upcoming:3,waiting:4},urg:Record<Urgency,number>={emergency:0,urgent:1,routine:2};rows.sort((a,b)=>attention[a.attention]-attention[b.attention]||urg[a.urgency as Urgency]-urg[b.urgency as Urgency]||b.daysOverdue-a.daysOverdue||String(a.due??'9999').localeCompare(String(b.due??'9999'))||a.key.localeCompare(b.key));
 return {policy:{version:policy.version,timezone:policy.timezone,escalateAfterDays:policy.escalateAfterDays,unknownOutcomeAfterDays:policy.unknownOutcomeAfterDays,activatedAt:policy.activatedAt,activatedBy:members.get(policy.activatedBy??'')?.displayName??policy.activatedBy},configurationRequired:false,items:rows.slice(0,500),escalated:rows.filter(x=>x.attention==='escalated').length,truncated:rows.length>500,scope:leadTeams.size?`Your owned open work plus escalated items in ${leadTeams.size} permitted team${leadTeams.size===1?'':'s'}.`:'Your owned open work, prioritised under the active policy.'};
}

export function applyDueWork(s:OrgState,input:unknown,u:Actor,m:Member,now=new Date().toISOString()):any|null{
 const parsed=dueWorkSchema.safeParse(input);if(!parsed.success||parsed.data.type!=='delayDueWork')return null;const c=parsed.data,p=person(s.workspace,c.personId),policy=policyFor(s);
 if(!policy||policy.state!=='active'||policy.version!==c.policyVersion)fail(409,'The due-work policy changed or is not active. Refresh before recording a delay.');
 const task=p.followUps?.find(x=>x.id===c.taskId);if(!task||!followUpOpen(s,task))fail(409,'Choose an open current follow-up.');
 if(p.version!==c.personVersion||task.due!==c.expectedDue)fail(409,'The patient or due work changed. Refresh before recording a delay.');
 if(task.ownerId!==m.userId&&!supervises(s,m,p.teamId))fail(403,'Only the current task owner or a supervisor of the patient’s team can record this delay.');
 if(!allowed(m,p,now))fail(403,'This patient is outside your current care scope.');
 const today=localDate(now,policy.timezone);if(c.due<=task.due||c.due<today)fail(422,'Choose a later due date that is not before today.');if(Date.parse(c.due)>Date.parse(today+'T00:00:00Z')+180*day)fail(422,'A delay can move due work at most 180 days ahead.');
 const blocked=waiting(s,p,{kind:'follow-up',id:task.id});if(blocked.length)fail(409,'This item is waiting on another open plan item. Resolve or remove that dependency before changing its due date.');
 const record=delayed(task);(record.delays??=[]).push({id:uuid(),at:now,by:u.userId,from:task.due,to:c.due,constraint:c.constraint,reason:c.reason,policyVersion:policy.version});if(record.delays.length>50)fail(422,'This task has too many recorded delays; review it with the team.');const from=task.due;task.due=c.due;p.version++;
 s.workspace.audit.push({id:uuid(),at:now,actorId:u.userId,actor:u.displayName,role:m.role,action:c.type,subject:p.id,personId:p.id,detail:`Follow-up ${task.id} delayed from ${from} to ${c.due} under due-work policy v${policy.version} (${c.constraint}). ${c.reason}`});return {taskId:task.id,due:task.due,policyVersion:policy.version};
}

export function applyDueWorkPolicy(s:OrgState,input:unknown,u:Actor,m:Member,now=new Date().toISOString()):any|null{
 const parsed=dueWorkSchema.safeParse(input);if(!parsed.success||parsed.data.type!=='opsDueWorkPolicy')return null;const c=parsed.data;if(!m.isOwner)fail(403,'Only an organisation owner can configure the due-work policy.');const ops=operations(s);if(!ops||c.version!==ops.version)fail(409,'Operations changed. Refresh and review the latest state.');if(c.policyVersion!==(ops.dueWorkPolicy?.version??0))fail(409,'The due-work policy changed. Refresh before saving.');if(!timezoneValid(c.timezone))fail(422,'Choose a valid IANA timezone.');
 const nextVersion=c.policyVersion+1;ops.dueWorkPolicy={version:nextVersion,state:c.state,timezone:c.timezone,escalateAfterDays:{emergency:c.emergencyDays,urgent:c.urgentDays,routine:c.routineDays},unknownOutcomeAfterDays:c.unknownOutcomeDays,reason:c.reason,updatedAt:now,updatedBy:u.userId,...(c.state==='active'?{activatedAt:now,activatedBy:u.userId}:{})};ops.version++;ops.updatedAt=now;
 s.workspace.audit.push({id:uuid(),at:now,actorId:u.userId,actor:u.displayName,role:m.role,action:c.type,subject:s.organisation.id,detail:`Due-work policy v${nextVersion} saved as ${c.state}; timezone ${c.timezone}; escalation after emergency ${c.emergencyDays}, urgent ${c.urgentDays}, routine ${c.routineDays} overdue days; unknown outcome ${c.unknownOutcomeDays} days. Local operational approval only; no clinical policy or external notification provider is implied. ${c.reason}`});return {policyVersion:nextVersion,state:c.state};
}

export function authorizeDueWork(s:OrgState,m:Member,c:any,now=new Date().toISOString()){
 if(c?.type!=='delayDueWork')return;const p=person(s.workspace,c.personId),task=p.followUps?.find(x=>x.id===c.taskId);
 if(!task||!followUpOpen(s,task))fail(409,'Choose an open current follow-up.');
 if(!allowed(m,p,now)||task.ownerId!==m.userId&&!supervises(s,m,p.teamId,now,false))fail(403,'Only the current task owner or a supervisor of the patient’s team can record this delay.');
}
