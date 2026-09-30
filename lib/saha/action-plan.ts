import { z } from 'zod';
import { fail, person, uuid } from './core';
import { allowed, normallyAllowed } from './access';
import { PACKS } from './programmes';
import { escalation, STATE_LABEL, TERMINAL, type ReferralState, type Urgency } from './referral-rules';
import type { Actor } from './store';
import type { Member, OrgState, Person, Referral } from './types';

// Slice 4b: one per-patient action plan (BR-CARE-05) with visible ownership (BR-CARE-01).
// Computed on read from the records that already hold the work; nothing is copied or sent.
export type PlanKind='safety-case'|'referral'|'protocol-review'|'follow-up'|'outreach'|'message-follow-up';
export type Attention='escalated'|'overdue'|'due-today'|'now'|'undated'|'upcoming';
export type PlanTarget={kind:'follow-up'|'referral';id:string;version:number};
export type PlanItem={key:string;kind:PlanKind;title:string;reason:string;sources:{kind:PlanKind;id:string;label:string;programme?:string;visitId?:string}[];
 owner:{userId:string;displayName:string;role:string;eligible:boolean}|null;queue:string|null;ownershipGap:string|null;due:string|null;urgency:Urgency;status:string;daysOverdue:number;attention:Attention;
 // How ownership changes: this slice's command, an existing screen, or not at all.
 assignVia:'action-plan'|'governance'|'outreach'|'none';targets:PlanTarget[];canAssign:boolean;canClaim:boolean};
const ATTENTION:Record<Attention,number>={escalated:0,overdue:1,'due-today':2,now:3,undated:4,upcoming:5};
const URGENCY:Record<Urgency,number>={emergency:0,urgent:1,routine:2};
const KIND:Record<PlanKind,number>={'safety-case':0,referral:1,'protocol-review':2,'follow-up':3,outreach:4,'message-follow-up':5};
const day=86400000;
// Stewards may reassign any open item of a patient in their team; this mirrors referrals.ts.
export const steward=(m:Member,p:Person)=>m.status==='active'&&m.role!=='admin'&&(m.role==='supervisor'||m.isOwner)&&m.teamIds.includes(p.teamId);
// Eligible owners of care tasks: active care workers with normal (not emergency) access to the patient.
export const eligibleOwner=(o:Member|undefined,p:Person)=>!!o&&['asha','clinician'].includes(o.role)&&normallyAllowed(o,p);
const careWorker=(m:Member,p:Person)=>['asha','clinician'].includes(m.role)&&normallyAllowed(m,p);
function dated(due:string|null,now:string):{attention:Attention;daysOverdue:number}{
 const today=now.slice(0,10);if(!due||!/^\d{4}-\d{2}-\d{2}$/.test(due))return {attention:'undated',daysOverdue:0};
 if(due<today)return {attention:'overdue',daysOverdue:Math.floor((Date.parse(today)-Date.parse(due))/day)};return {attention:due===today?'due-today':'upcoming',daysOverdue:0};
}
const norm=(s:string)=>s.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g,' ').trim();

export function actionPlan(s:OrgState,m:Member,p:Person,now=new Date().toISOString()){
 if(m.role==='admin'||!allowed(m,p,now))fail(403,'This patient is outside your current care scope.');
 const members=new Map(s.members.filter(x=>x.status==='active').map(x=>[x.userId,x])),team=s.teams.find(t=>t.id===p.teamId)?.name??'the patient\'s team';
 const lead=steward(m,p),care=careWorker(m,p);
 const who=(id:string|null|undefined,eligible:(o:Member|undefined)=>boolean)=>{if(!id)return null;const o=members.get(id);return {userId:id,displayName:o?.displayName??'Former member',role:o?.role??'unknown',eligible:eligible(o)};};
 const gapFor=(owner:PlanItem['owner'],label='care worker')=>!owner?`No named ${label}`:!owner.eligible?`${owner.displayName} no longer has current care access`:null;
 const items:PlanItem[]=[];
 // Programme follow-ups. Same title, due date and owner across programme episodes are one reminder
 // with every source kept; different titles, dates or owners stay separate work (BR-CARE-05).
 const groups=new Map<string,NonNullable<Person['followUps']>>();
 for(const t of p.followUps??[])if(t.state==='open'){const k=[norm(t.title),t.due,t.ownerId].join('|');groups.set(k,[...(groups.get(k)??[]),t]);}
 for(const group of groups.values()){
  const t=group[0],owner=who(t.ownerId,o=>eligibleOwner(o,p)),gap=gapFor(owner),d=dated(t.due,now);
  const programmes=group.map(x=>PACKS.find(pk=>pk.id===x.packId)?.name??x.packId);
  items.push({key:'follow-up:'+group.map(x=>x.id).sort().join('+'),kind:'follow-up',title:t.title,reason:group.length>1?`Scheduled by ${group.length} programme episodes (${[...new Set(programmes)].join(', ')}); shown once`:`${programmes[0]} follow-up`,
   sources:group.map((x,i)=>({kind:'follow-up' as const,id:x.id,label:`${programmes[i]} follow-up`,programme:programmes[i]})),owner,queue:gap?`Supervisors of ${team}`:null,ownershipGap:gap,due:t.due,urgency:'routine',status:d.attention==='overdue'?'Overdue':'Open',daysOverdue:d.daysOverdue,attention:gap?'escalated':d.attention,
   assignVia:'action-plan',targets:group.map(x=>({kind:'follow-up' as const,id:x.id,version:p.version})),canAssign:lead,canClaim:!!gap&&care});
 }
 // Referrals, with the slice 4a escalation rules.
 for(const r of s.workspace.referrals)if(r.personId===p.id&&!TERMINAL.has(r.state)){
  const owner=who(r.ownerId,o=>eligibleOwner(o,p)),gap=gapFor(owner),e=escalation(r as any,!!owner?.eligible,now),d=dated(r.due??null,now);
  items.push({key:'referral:'+r.id,kind:'referral',title:`Referral to ${r.facility}`,reason:r.reason+(e.reasons.length?` · ${e.reasons.join('; ')}`:''),sources:[{kind:'referral',id:r.id,label:'Referral',visitId:r.visitId}],owner,queue:gap?`Supervisors of ${team}`:null,ownershipGap:gap,due:r.due??null,urgency:r.urgency??'routine',
   status:STATE_LABEL[r.state as ReferralState]??r.state,daysOverdue:e.daysOverdue||d.daysOverdue,attention:gap||e.level==='escalated'?'escalated':d.attention,assignVia:'action-plan',targets:[{kind:'referral',id:r.id,version:r.version??1}],canAssign:lead,canClaim:!!gap&&care});
 }
 // Open clinical safety cases: owner must be a clinician with normal access (governance.ts ownPatient).
 for(const c of s.governance?.safety??[])if(c.personId===p.id&&c.state==='open'){
  const owner=who(c.ownerId,o=>!!o&&o.role==='clinician'&&normallyAllowed(o,p)),gap=gapFor(owner,'clinical owner');
  items.push({key:'safety-case:'+c.id,kind:'safety-case',title:`Clinical safety case: ${c.kind.replace(/-/g,' ')}`,reason:c.summary,sources:[{kind:'safety-case',id:c.id,label:'Safety case',visitId:c.visitId}],owner,queue:gap?`Clinicians of ${team}`:null,ownershipGap:gap,due:null,urgency:'urgent',status:'Open',daysOverdue:0,attention:'escalated',
   assignVia:'governance',targets:[],canAssign:false,canClaim:false});
 }
 // The latest protocol evaluation of each current visit, when it has findings and no clinician decision.
 // It belongs to the team's clinician review queue rather than a named person.
 const clinicians=[...members.values()].filter(o=>o.role==='clinician'&&normallyAllowed(o,p)).length;
 for(const v of s.workspace.visits)if(v.personId===p.id&&!v.voidedAt&&!v.supersededBy){
  const check=v.protocolChecks?.at(-1);if(!check||check.decision||!check.findings.length)continue;
  const urgent=check.findings.some(f=>f.urgency==='urgent_review'),gap=clinicians?null:`No clinician with current access in ${team}`;
  items.push({key:'protocol-review:'+check.id,kind:'protocol-review',title:`Review ${check.findings.length} protocol finding${check.findings.length===1?'':'s'}`,reason:check.findings.map(f=>f.label).join('; '),sources:[{kind:'protocol-review',id:check.id,label:'Protocol evaluation',visitId:v.id}],owner:null,queue:`Clinicians of ${team}`,ownershipGap:gap,due:null,urgency:urgent?'urgent':'routine',status:'Awaiting clinician review',daysOverdue:0,
   attention:gap?'escalated':urgent?'now':'undated',assignVia:'none',targets:[],canAssign:false,canClaim:false});
 }
 // Outreach items and failed-message follow-ups keep their own reassignment on the Outreach page.
 for(const plan of s.outreach?.plans??[])if(!['completed','cancelled'].includes(plan.state))for(const i of plan.items)if(i.personId===p.id&&!['completed','cancelled'].includes(i.state)){
  const owner=who(i.ownerId,o=>eligibleOwner(o,p)),gap=gapFor(owner),d=dated(plan.date,now);
  items.push({key:'outreach:'+i.id,kind:'outreach',title:plan.title,reason:`Outreach ${plan.state}; item ${i.state}`,sources:[{kind:'outreach',id:i.id,label:'Outreach plan'}],owner,queue:gap?`Supervisors of ${team}`:null,ownershipGap:gap,due:plan.date,urgency:'routine',status:i.state,daysOverdue:d.daysOverdue,attention:gap?'escalated':d.attention,assignVia:'outreach',targets:[],canAssign:false,canClaim:false});
 }
 for(const msg of s.outreach?.messages??[])if(msg.personId===p.id&&msg.recovery?.state==='open'){
  const owner=who(msg.recovery.ownerId,o=>eligibleOwner(o,p)),gap=gapFor(owner);
  items.push({key:'message-follow-up:'+msg.id,kind:'message-follow-up',title:'Follow up a failed reminder',reason:'A simulated reminder failed; the patient has not been reached by message.',sources:[{kind:'message-follow-up',id:msg.id,label:'Message follow-up'}],owner,queue:gap?`Supervisors of ${team}`:null,ownershipGap:gap,due:null,urgency:'routine',status:'Open',daysOverdue:0,attention:gap?'escalated':'undated',assignVia:'outreach',targets:[],canAssign:false,canClaim:false});
 }
 items.sort((a,b)=>ATTENTION[a.attention]-ATTENTION[b.attention]||URGENCY[a.urgency]-URGENCY[b.urgency]||b.daysOverdue-a.daysOverdue||(a.due??'9999').localeCompare(b.due??'9999')||KIND[a.kind]-KIND[b.kind]||a.key.localeCompare(b.key));
 const eligible=[...members.values()].filter(o=>eligibleOwner(o,p)).map(o=>({userId:o.userId,displayName:o.displayName,role:o.role})).sort((a,b)=>a.displayName.localeCompare(b.displayName)||a.userId.localeCompare(b.userId));
 return {personId:p.id,personVersion:p.version,generatedAt:now,items,unowned:items.filter(i=>i.ownershipGap).length,canAssign:lead,eligibleOwners:lead?eligible:eligible.filter(o=>o.userId===m.userId),
  rules:'Ordered: ownership gaps and escalations first, then overdue, due today, needing review now, undated and upcoming; within each, higher urgency and longer overdue first. Follow-ups with the same title, due date and owner are shown once with every programme source. Computed on read; nothing is sent.'};
}

// Take ownership of, or reassign, open follow-ups and referrals shown in the plan (BR-CARE-01).
const text=z.string().trim().min(10).max(500),id=z.string().trim().min(1).max(200);
export const actionPlanSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('assignPlanItem'),personId:id,version:z.number().int().positive(),targets:z.array(z.object({kind:z.enum(['follow-up','referral']),id,version:z.number().int().positive()}).strict()).min(1).max(20),ownerId:id,reason:text}).strict(),
]);
export function authorizeActionPlan(s:OrgState,m:Member,c:any){
 if(c?.type!=='assignPlanItem')return;const p=person(s.workspace,c.personId);
 if(steward(m,p))return;
 if(!careWorker(m,p))fail(403,'A supervisor or owner of the patient\'s team, or a care worker with current access, is required.');
 if(c.ownerId!==m.userId)fail(403,'Care workers can take ownership for themselves only. Ask a supervisor to assign someone else.');
}
export function applyActionPlan(s:OrgState,input:unknown,u:Actor,m:Member,now=new Date().toISOString()):any|null{
 const parsed=actionPlanSchema.safeParse(input);if(!parsed.success)return null;const c=parsed.data,w=s.workspace;
 authorizeActionPlan(s,m,c);const p=person(w,c.personId);if(p.version!==c.version)fail(409,'Patient changed. Refresh the action plan before assigning.');
 if(new Set(c.targets.map(t=>t.kind+':'+t.id)).size!==c.targets.length)fail(422,'List each item once.');
 const owner=s.members.find(x=>x.userId===c.ownerId&&x.status==='active');if(!eligibleOwner(owner,p))fail(422,'Choose an active care worker with current access to this patient.');
 const lead=steward(m,p),changed:string[]=[];let personChanged=false;
 for(const t of c.targets){
  if(t.kind==='follow-up'){
   const f=p.followUps?.find(x=>x.id===t.id);if(!f||f.state!=='open')fail(409,'Choose an open follow-up of this patient.');
   if(!lead&&eligibleOwner(s.members.find(x=>x.userId===f.ownerId&&x.status==='active'),p))fail(403,'This follow-up already has an owner with current access. Ask a supervisor to reassign it.');
   if(f.ownerId===owner!.userId)fail(409,'This follow-up already belongs to that care worker.');
   changed.push(`follow-up "${f.title}" from ${f.ownerId||'nobody'}`);f.ownerId=owner!.userId;personChanged=true;
  }else{
   const r:Referral|undefined=w.referrals.find(x=>x.id===t.id&&x.personId===p.id);if(!r||TERMINAL.has(r.state))fail(409,'Choose an open referral of this patient.');
   if((r.version??1)!==t.version)fail(409,'Referral changed. Refresh the action plan before assigning.');
   if(!lead&&eligibleOwner(s.members.find(x=>x.userId===r.ownerId&&x.status==='active'),p))fail(403,'This referral already has an owner with current access. Ask a supervisor to reassign it.');
   if(r.ownerId===owner!.userId)fail(409,'This referral already belongs to that care worker.');
   changed.push(`referral to ${r.facility} from ${r.ownerId??'nobody'}`);r.ownerId=owner!.userId;r.version=(r.version??1)+1;
  }
 }
 if(personChanged)p.version++;
 w.audit.push({id:uuid(),at:now,actorId:u.userId,actor:u.displayName,role:m.role,action:c.type,subject:p.id,personId:p.id,detail:`${c.ownerId===u.userId&&!lead?'Ownership taken':'Reassigned'} to ${owner!.displayName}: ${changed.join('; ')}. ${c.reason}`});
 return {assigned:c.targets.length,ownerId:owner!.userId};
}
