import { z } from 'zod';
import { AppError, fail, uuid } from './core';
import { allowed } from './access';
import { openPatientWork, transferPatientWork, type AssignmentEvent } from './continuity';
import type { Actor } from './store';
import type { Member, OrgState, Person, Role } from './types';

// Slice 1b: workforce lifecycle and bulk caseload transfer (BR-ID-01, BR-ID-04).
// A transfer names the patients the steward reviewed. It applies immediately or at a scheduled
// effective time; application re-checks every patient and never leaves open work without an owner.
// Slice 1f: a due scheduled transfer is applied automatically (applied.automatic) when Saha is next used at or after its
// effective time; if a re-check fails it is held (state 'held') for a steward to apply or cancel. A household transfer
// records the household it was made from and re-checks membership at application.
export type CaseloadTransfer={id:string;version:number;teamId:string;fromUserId:string;toUserId:string;personIds:string[];effectiveAt:string;reason:string;state:'scheduled'|'held'|'applied'|'cancelled';createdBy:string;createdAt:string;
 householdId?:string;
 held?:{at:string;reason:string};
 applied?:{by:string;at:string;moved:string[];skipped:{personId:string;reason:string}[];assignments:Record<string,string>;automatic?:boolean};
 cancelled?:{by:string;at:string;reason:string};
 acknowledgement?:{by:string;at:string;reference:string;patients:string[];notAcknowledged:string[]}};
export const MAX_TRANSFER=200,MAX_AHEAD_DAYS=60,URGENT_DAYS=2,MAX_TRANSFERS=500;
const id=z.string().trim().min(1).max(200),version=z.number().int().positive(),reason=z.string().trim().min(10,'Explain the reason in at least 10 characters.').max(1000);
export const caseloadSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('caseloadTransfer'),teamId:id,fromUserId:id,toUserId:id,personIds:z.array(id).min(1).max(MAX_TRANSFER).refine(x=>new Set(x).size===x.length,'List each patient once.'),effectiveAt:z.string().datetime().nullable(),reason}).strict(),
 // Slice 1f: transfer every current member of one household held by the sending worker, as one transfer.
 z.object({type:z.literal('caseloadHouseholdTransfer'),teamId:id,fromUserId:id,toUserId:id,householdId:id,householdVersion:version,effectiveAt:z.string().datetime().nullable(),reason}).strict(),
 z.object({type:z.literal('caseloadApply'),transferId:id,version}).strict(),
 z.object({type:z.literal('caseloadCancel'),transferId:id,version,reason}).strict(),
 z.object({type:z.literal('caseloadAcknowledge'),transferId:id,version,reference:id}).strict(),
 z.object({type:z.literal('removeMember'),userId:id,version,reason}).strict(),
]);
export type CaseloadCommand=z.infer<typeof caseloadSchema>;
const TYPES=new Set(['caseloadTransfer','caseloadHouseholdTransfer','caseloadApply','caseloadCancel','caseloadAcknowledge','removeMember']);

// Urgent: open work that is overdue or due within URGENT_DAYS days of now.
export function urgent(item:{due:string|null},now:string){if(!item.due)return false;const limit=new Date(Date.parse(now)+URGENT_DAYS*86400000).toISOString().slice(0,10);return item.due.slice(0,10)<=limit;}
export function steward(s:OrgState,m:Member,teamId:string){
 if(m.role==='admin'||(!m.isOwner&&m.role!=='supervisor'))fail(403,'An owner with patient access or a team supervisor must manage caseloads.');
 if(!m.teamIds.includes(teamId)||!s.teams.some(t=>t.id===teamId))fail(403,'This team is outside your care scope.');
}
function receiver(s:OrgState,userId:string,teamId:string){const r=s.members.find(x=>x.userId===userId);if(!r||r.userId.startsWith('fixture:')||r.status!=='active'||!['asha','clinician'].includes(r.role)||!r.teamIds.includes(teamId))fail(422,'Choose an active care worker in this team to receive the caseload.');return r;}
function transfer(s:OrgState,transferId:string,v:number){const t=(s.caseloads??[]).find(x=>x.id===transferId);if(!t)fail(404,'Caseload transfer not found.');if(t.version!==v)fail(409,'This transfer changed. Refresh before continuing.');return t;}
// Slice 1f: a household transfer needs every current member inside the requester's care scope. A household with no member in
// scope answers as not found; otherwise members outside scope are counted, never named. Checked again on replay.
function householdInScope(s:OrgState,m:Member,householdId:string){
 const h=(s.households??[]).find(x=>x.id===householdId);
 const members=(h?.members??[]).filter(x=>!x.to).map(x=>s.workspace.people.find(p=>p.id===x.personId)).filter((p):p is Person=>!!p);
 const visible=members.filter(p=>allowed(m,p)),out=members.length-visible.length;
 if(!h||!visible.length)fail(404,'Household not found.');
 if(out)fail(403,`${out} current member${out>1?'s':''} of this household ${out>1?'are':'is'} outside your care scope. Transfer the members you manage individually, or ask a steward with that scope.`);
 return {h:h!,visible};
}
export function authorizeCaseload(s:OrgState,m:Member,c:any){
 if(!TYPES.has(c?.type))return;
 if(c.type==='removeMember'){if(!m.isOwner)fail(403,'Only organisation owners can remove members.');return;}
 if(c.type==='caseloadTransfer'){steward(s,m,c.teamId);return;}
 if(c.type==='caseloadHouseholdTransfer'){steward(s,m,c.teamId);householdInScope(s,m,c.householdId);return;}
 const t=(s.caseloads??[]).find(x=>x.id===c.transferId);if(!t)fail(404,'Caseload transfer not found.');
 if(c.type==='caseloadAcknowledge'){if(t.toUserId!==m.userId)fail(403,'Only the receiving worker can acknowledge this caseload.');return;}
 steward(s,m,t.teamId);
}
// Moves one patient and all of its open work to the receiving worker, as a single-patient
// assignment would, and tags the handover with the transfer.
function reassign(s:OrgState,p:Person,t:CaseloadTransfer,u:Actor,now:string):AssignmentEvent|undefined{
 const event=transferPatientWork(s,p,{teamId:t.teamId,assignedTo:t.toUserId,reason:`Caseload transfer: ${t.reason}`},u,now);
 p.teamId=t.teamId;p.assignedTo=t.toUserId;p.version++;
 for(const v of s.workspace.visits)if(v.personId===p.id&&v.plan&&v.plan.state!=='completed')v.plan.state='blocked';
 if(event)event.transferId=t.id;return event;
}
// `mayAccess` is the applying steward's patient scope: the requester's for a manual application, the scheduling
// steward's (re-checked) for an automatic one.
function applyTransfer(s:OrgState,t:CaseloadTransfer,u:Actor,now:string,mayAccess:(p:Person)=>boolean=p=>!!p.assigned){
 receiver(s,t.toUserId,t.teamId);
 const moved:string[]=[],skipped:{personId:string;reason:string}[]=[],assignments:Record<string,string>={};
 const household=t.householdId?(s.households??[]).find(h=>h.id===t.householdId):undefined;
 for(const pid of t.personIds){
  const p=s.workspace.people.find(x=>x.id===pid);
  if(!p){skipped.push({personId:pid,reason:'Patient record not found.'});continue;}
  if(!mayAccess(p)){skipped.push({personId:pid,reason:'Outside your current patient scope.'});continue;}
  if(p.teamId!==t.teamId||p.assignedTo!==t.fromUserId){skipped.push({personId:pid,reason:'Assignment changed after the transfer was scheduled.'});continue;}
  if(t.householdId&&!household?.members.some(x=>x.personId===pid&&!x.to)){skipped.push({personId:pid,reason:'Left the household after the transfer was scheduled.'});continue;}
  const event=reassign(s,p,t,u,now);moved.push(pid);if(event)assignments[pid]=event.id;
 }
 if(!moved.length)fail(409,'No patient in this transfer is still assigned to the sending worker. Cancel it instead.');
 t.state='applied';t.applied={by:u.userId,at:now,moved,skipped,assignments};t.version++;
 return {moved:moved.length,skipped};
}
export function applyCaseload(s:OrgState,input:unknown,u:Actor,m:Member,now=new Date().toISOString()):any|null{
 const parsed=caseloadSchema.safeParse(input);if(!parsed.success)return null;const c=parsed.data;authorizeCaseload(s,m,c);
 s.caseloads??=[];const w=s.workspace;let subject:string=s.organisation.id,detail='',result:any={ok:true};
 if(c.type==='caseloadTransfer'||c.type==='caseloadHouseholdTransfer'){
  if(c.fromUserId===c.toUserId)fail(422,'Choose a different receiving worker.');
  receiver(s,c.toUserId,c.teamId);
  // Slice 1f: a household transfer takes every current member the sending worker holds in this team. A member outside
  // the requester's scope refuses the whole transfer (counted, never named); a household with no member in scope is
  // answered as not found. Members in scope but held elsewhere are reported and stay where they are.
  let notIncluded:{personId:string;reason:string}[]=[],householdId:string|undefined;
  const personIds=c.type==='caseloadTransfer'?c.personIds:(()=>{
   const {h,visible}=householdInScope(s,m,c.householdId);
   if(h.version!==c.householdVersion)fail(409,'This household changed. Refresh before transferring it.');
   const held=visible.filter(p=>p.teamId===c.teamId&&p.assignedTo===c.fromUserId);
   notIncluded=visible.filter(p=>!held.includes(p)).map(p=>({personId:p.id,reason:'Held by another worker or team; not part of this transfer.'}));
   if(!held.length)fail(409,'No current member of this household is in the sending worker\'s caseload in this team.');
   if(held.length>MAX_TRANSFER)fail(422,`A transfer can include up to ${MAX_TRANSFER} patients.`);
   householdId=h.id;return held.map(p=>p.id);
  })();
  const effectiveAt=c.effectiveAt?new Date(c.effectiveAt).toISOString():now;
  if(c.effectiveAt&&(effectiveAt<=now||Date.parse(effectiveAt)>Date.parse(now)+MAX_AHEAD_DAYS*86400000))fail(422,`Choose an effective time in the future, within ${MAX_AHEAD_DAYS} days, or transfer now.`);
  const stale=personIds.filter(pid=>{const p=w.people.find(x=>x.id===pid);return !p||!p.assigned||p.teamId!==c.teamId||p.assignedTo!==c.fromUserId;});
  if(stale.length)fail(409,`${stale.length} selected patient${stale.length>1?'s are':' is'} no longer assigned to the sending worker in this team. Review the caseload again.`);
  const pending=new Set(s.caseloads.filter(t=>t.state==='scheduled'||t.state==='held').flatMap(t=>t.personIds));
  const overlap=personIds.filter(pid=>pending.has(pid));if(overlap.length)fail(409,`${overlap.length} selected patient${overlap.length>1?'s are':' is'} already in a scheduled transfer. Cancel or apply it first.`);
  if(s.caseloads.length>=MAX_TRANSFERS)fail(422,'Caseload transfer history limit reached; an archival policy is required.');
  const t:CaseloadTransfer={id:uuid(),version:1,teamId:c.teamId,fromUserId:c.fromUserId,toUserId:c.toUserId,personIds:[...personIds].sort(),effectiveAt,reason:c.reason,state:'scheduled',createdBy:u.userId,createdAt:now,...(householdId?{householdId}:{})};
  s.caseloads.push(t);subject=t.id;
  const from=s.members.find(x=>x.userId===c.fromUserId)?.displayName??'former member',to=s.members.find(x=>x.userId===c.toUserId)!.displayName;
  const kind=householdId?'Household caseload':'Caseload';
  if(!c.effectiveAt){const r=applyTransfer(s,t,u,now);detail=`${kind} of ${r.moved} patients moved from ${from} to ${to}; open work reassigned; acknowledgement pending. Reason: ${c.reason}`;result={transferId:t.id,state:t.state,moved:r.moved,skipped:r.skipped};}
  else {detail=`${kind} transfer of ${t.personIds.length} patients from ${from} to ${to} scheduled for ${effectiveAt}; it applies automatically when Saha is next used at or after that time. Reason: ${c.reason}`;result={transferId:t.id,state:t.state,effectiveAt};}
  if(householdId){result.householdId=householdId;result.notIncluded=notIncluded;}
 }
 else if(c.type==='caseloadApply'){
  const t=transfer(s,c.transferId,c.version);if(t.state!=='scheduled'&&t.state!=='held')fail(409,'Only a scheduled or held transfer can be applied.');
  if(t.effectiveAt>now)fail(409,`This transfer takes effect at ${t.effectiveAt}. Apply it at or after that time.`);
  const r=applyTransfer(s,t,u,now);subject=t.id;detail=`Scheduled caseload transfer applied: ${r.moved} moved, ${r.skipped.length} skipped because their assignment changed.`;result={transferId:t.id,state:t.state,moved:r.moved,skipped:r.skipped};
 }
 else if(c.type==='caseloadCancel'){
  const t=transfer(s,c.transferId,c.version);if(t.state!=='scheduled'&&t.state!=='held')fail(409,'Only a scheduled or held transfer can be cancelled.');
  t.state='cancelled';t.cancelled={by:u.userId,at:now,reason:c.reason};t.version++;subject=t.id;detail=`Scheduled caseload transfer cancelled; assignments unchanged. Reason: ${c.reason}`;
 }
 else if(c.type==='caseloadAcknowledge'){
  const t=transfer(s,c.transferId,c.version);if(t.state!=='applied'||!t.applied)fail(409,'Only an applied transfer can be acknowledged.');if(t.acknowledgement)fail(409,'This caseload transfer is already acknowledged.');
  const acknowledged:string[]=[],not:string[]=[];
  for(const pid of t.applied.moved){const p=w.people.find(x=>x.id===pid),event=p?.assignmentHistory?.at(-1);
   if(p&&p.assigned&&p.assignedTo===u.userId&&event&&event.id===t.applied.assignments[pid]&&!event.acknowledgement){event.acknowledgement={by:u.userId,at:now,reference:c.reference};p.version++;acknowledged.push(pid);}else not.push(pid);}
  t.acknowledgement={by:u.userId,at:now,reference:c.reference,patients:acknowledged,notAcknowledged:not};t.version++;subject=t.id;
  detail=`Receiving worker acknowledged ${acknowledged.length} handovers${not.length?`; ${not.length} had moved again and were not acknowledged`:''}.`;result={acknowledged:acknowledged.length,notAcknowledged:not.length};
 }
 else {
  const target=s.members.find(x=>x.userId===c.userId);if(!target)fail(404,'Member not found.');if(target.version!==c.version)fail(409,'Membership changed. Refresh before removing it.');
  if(target.userId===u.userId)fail(422,'Another owner must remove your membership.');if(target.status==='removed')fail(409,'This membership is already removed.');
  if(target.isOwner&&target.status==='active'&&s.members.filter(x=>x.isOwner&&x.status==='active').length===1)fail(409,'Keep at least one active organisation owner.');
  const patients=w.people.filter(p=>p.assignedTo===target.userId).length,work=w.people.reduce((n,p)=>n+openPatientWork(s,p).filter(x=>x.ownerId===target.userId).length,0);
  if(patients||work)fail(409,`Transfer this member's caseload first: ${patients} assigned patient${patients===1?'':'s'} and ${work} open item${work===1?'':'s'} remain.`);
  if(s.caseloads.some(t=>(t.state==='scheduled'||t.state==='held')&&(t.toUserId===target.userId||t.fromUserId===target.userId)))fail(409,'Cancel or apply scheduled caseload transfers involving this member first.');
  const prior=`${target.role}, ${target.status}, owner ${target.isOwner}`;Object.assign(target,{status:'removed',isOwner:false,teamIds:[],version:target.version+1});
  subject=target.userId;detail=`${target.displayName} removed (was ${prior}). No caseload or open work remained. Records and history are retained. Reason: ${c.reason}`;
 }
 w.audit.push({id:uuid(),at:now,actorId:u.userId,actor:u.displayName,role:m.role,action:c.type,subject,detail});
 return result;
}

export type Gap={personId:string;name:string;kind:'unassigned-open-work'|'inactive-assignee'|'assignee-outside-team'|'other-owner';detail:string;urgent:boolean};
// Responsibility gaps among the patients the viewer may see.
export function responsibilityGaps(s:OrgState,people:Person[],now:string):Gap[]{
 const active=new Map(s.members.filter(x=>x.status==='active').map(x=>[x.userId,x]));const name=(id:string|null)=>s.members.find(x=>x.userId===id)?.displayName??'an unknown account';const gaps:Gap[]=[];
 for(const p of people){const work=openPatientWork(s,p),hot=work.some(x=>urgent(x,now));
  if(!p.assignedTo){if(work.length)gaps.push({personId:p.id,name:p.name,kind:'unassigned-open-work',detail:`${work.length} open item${work.length>1?'s':''} with no assigned worker.`,urgent:hot});continue;}
  const a=active.get(p.assignedTo);
  if(!a)gaps.push({personId:p.id,name:p.name,kind:'inactive-assignee',detail:`Assigned to ${name(p.assignedTo)}, whose membership is ${s.members.find(x=>x.userId===p.assignedTo)?.status??'missing'}.`,urgent:hot});
  else if(!a.teamIds.includes(p.teamId))gaps.push({personId:p.id,name:p.name,kind:'assignee-outside-team',detail:`Assigned to ${a.displayName}, who is no longer in the patient's team.`,urgent:hot});
  const others=work.filter(x=>x.ownerId&&x.ownerId!==p.assignedTo);
  if(others.length)gaps.push({personId:p.id,name:p.name,kind:'other-owner',detail:`${others.length} open item${others.length>1?'s are':' is'} owned by ${[...new Set(others.map(x=>name(x.ownerId)))].join(', ')} rather than the assigned worker.`,urgent:others.some(x=>urgent(x,now))});
 }
 return gaps.sort((a,b)=>+b.urgent-+a.urgent||a.name.localeCompare(b.name));
}
// The caseload view: workload by worker, gaps, transfers and an optional preview of one worker's caseload.
export function caseloadView(s:OrgState,m:Member,q:{teamId?:string|null;fromUserId?:string|null},now=new Date().toISOString()){
 const names=(id:string)=>s.members.find(x=>x.userId===id)?.displayName??'Former member';
 const summary=(t:CaseloadTransfer)=>({id:t.id,version:t.version,household:!!t.householdId,held:t.held??null,automatic:!!t.applied?.automatic,teamId:t.teamId,team:s.teams.find(x=>x.id===t.teamId)?.name??t.teamId,from:names(t.fromUserId),fromUserId:t.fromUserId,to:names(t.toUserId),toUserId:t.toUserId,patients:t.personIds.length,effectiveAt:t.effectiveAt,reason:t.reason,state:t.state,due:t.state==='scheduled'&&t.effectiveAt<=now,moved:t.applied?.moved.length??0,skipped:t.applied?.skipped.length??0,acknowledged:t.acknowledgement?{at:t.acknowledgement.at,patients:t.acknowledgement.patients.length,notAcknowledged:t.acknowledgement.notAcknowledged.length}:null,createdAt:t.createdAt});
 const incoming=(s.caseloads??[]).filter(t=>t.toUserId===m.userId&&t.state==='applied').sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,20).map(summary);
 const canSteward=m.role!=='admin'&&(m.isOwner||m.role==='supervisor');
 if(!canSteward){if(q.fromUserId||q.teamId)fail(403,'An owner with patient access or a team supervisor must manage caseloads.');return {steward:false,incoming,rules:RULES};}
 const teams=s.teams.filter(t=>m.teamIds.includes(t.id));const visible=s.workspace.people.filter(p=>p.assigned&&m.teamIds.includes(p.teamId));
 const work=new Map(visible.map(p=>[p.id,openPatientWork(s,p)]));
 const workers=s.members.filter(x=>x.role!=='admin'&&(x.teamIds.some(t=>m.teamIds.includes(t))||visible.some(p=>p.assignedTo===x.userId))).map(x=>{const mine=visible.filter(p=>p.assignedTo===x.userId);const items=visible.flatMap(p=>work.get(p.id)!.filter(i=>i.ownerId===x.userId));return {userId:x.userId,displayName:x.displayName,role:x.role,status:x.status,version:x.version,teamIds:x.teamIds.filter(t=>m.teamIds.includes(t)),patients:mine.length,openWork:items.length,urgent:items.filter(i=>urgent(i,now)).length};}).sort((a,b)=>b.patients-a.patients||a.displayName.localeCompare(b.displayName));
 const gaps=responsibilityGaps(s,visible,now);
 const transfers=(s.caseloads??[]).filter(t=>m.teamIds.includes(t.teamId)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,50).map(summary);
 let preview=null;
 if(q.fromUserId||q.teamId){if(!q.fromUserId||!q.teamId)fail(422,'Choose a worker and a team.');steward(s,m,q.teamId);
  const scheduled=new Map((s.caseloads??[]).filter(t=>t.state==='scheduled'||t.state==='held').flatMap(t=>t.personIds.map(pid=>[pid,t.id] as const)));
  const list=visible.filter(p=>p.teamId===q.teamId&&p.assignedTo===q.fromUserId).sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
  preview={teamId:q.teamId,fromUserId:q.fromUserId,from:names(q.fromUserId),total:list.length,overflow:list.length>MAX_TRANSFER,patients:list.slice(0,MAX_TRANSFER).map(p=>{const items=work.get(p.id)!;const h=p.householdId?(s.households??[]).find(x=>x.id===p.householdId&&x.members.some(y=>y.personId===p.id&&!y.to)):undefined;return {id:p.id,name:p.name,age:p.age,village:p.village,household:h?{id:h.id,version:h.version,label:h.label}:null,openWork:items.length,urgent:items.filter(i=>urgent(i,now)).length,scheduledIn:scheduled.get(p.id)??null};}),recipients:s.members.filter(x=>x.status==='active'&&!x.userId.startsWith('fixture:')&&['asha','clinician'].includes(x.role)&&x.teamIds.includes(q.teamId!)&&x.userId!==q.fromUserId).map(x=>({userId:x.userId,displayName:x.displayName,role:x.role}))};
 }
 return {steward:true,teams:teams.map(t=>({id:t.id,name:t.name})),workers,gaps:gaps.slice(0,100),gapCount:gaps.length,transfers,incoming,preview,rules:RULES};
}
export const RULES=`Urgent means open work overdue or due within ${URGENT_DAYS} days. A transfer moves every open item for each patient to the receiving worker, revokes active field packages and blocks unapproved external-sharing plans. A scheduled transfer applies automatically, with the same re-checks, the first time Saha is used at or after its effective time; there is no timer, so the exact time depends on use. If a re-check fails it is held for a steward to apply or cancel. A household transfer moves every current member the sending worker holds in the team. A member can be removed only after their caseload and open work are transferred.`;

// Slice 1f: automatic application of due scheduled transfers. Each due transfer is applied with the authority of the
// steward who scheduled it, re-checked now: an active member who still stewards the team, a receiver who is still an
// active care worker in it, and each patient still in the steward's scope and still held by the sending worker (and, for a
// household transfer, still a current member). A failed re-check holds the transfer once, with the reason, for a steward
// to apply or cancel; a held transfer is never retried automatically. Exactly-once application is the caller's commit
// guard: the result is committed with the organisation-wide revision check, so a concurrent evaluation that loaded the
// same revision cannot commit a second application.
export const SCHEDULER:Actor={userId:'system',displayName:'Saha scheduled transfer',email:''};
export function dueTransfers(s:OrgState,now:string){return (s.caseloads??[]).filter(t=>t.state==='scheduled'&&t.effectiveAt<=now).sort((a,b)=>a.effectiveAt.localeCompare(b.effectiveAt)||a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));}
export function applyDueTransfers(s:OrgState,now:string,limit=Infinity){
 const out:{transferId:string;state:'applied'|'held';moved:number;skipped:number;reason?:string}[]=[];
 const audit=(t:CaseloadTransfer,action:string,detail:string)=>s.workspace.audit.push({id:uuid(),at:now,actorId:SCHEDULER.userId,actor:SCHEDULER.displayName,role:'system' as Role,action,subject:t.id,detail});
 // Slice 6ae (tenth review, finding 1): the state is copied before each transfer is applied; a refusal part-way through
 // restores the copy, so every assignment is exactly as it was, and the transfer is held on the restored state.
 // Slice 10a: the scheduled job bounds its work per run; the rest stay scheduled (oldest first) for the next run.
 for(const id of dueTransfers(s,now).slice(0,limit).map(x=>x.id)){
  const t=(s.caseloads??[]).find(x=>x.id===id)!;
  const creator=s.members.find(x=>x.userId===t.createdBy&&x.status==='active');
  let reason='';
  if(!creator)reason='The steward who scheduled it is no longer an active member.';
  else if(creator.role==='admin'||(!creator.isOwner&&creator.role!=='supervisor')||!creator.teamIds.includes(t.teamId)||!s.teams.some(x=>x.id===t.teamId))reason='The steward who scheduled it no longer manages this team.';
  else {const r=s.members.find(x=>x.userId===t.toUserId);if(!r||r.status!=='active'||!['asha','clinician'].includes(r.role)||!r.teamIds.includes(t.teamId))reason='The receiving worker is no longer an active care worker in this team.';}
  if(!reason){
   const before=structuredClone(s);
   try{const r=applyTransfer(s,t,SCHEDULER,now,p=>allowed(creator!,p,now));t.applied!.automatic=true;
    audit(t,'caseloadAutoApply',`Scheduled caseload transfer applied automatically at ${now} (effective ${t.effectiveAt}) with the scheduling steward's authority re-checked: ${r.moved} moved, ${r.skipped.length} skipped. Acknowledgement pending.`);
    out.push({transferId:t.id,state:'applied',moved:r.moved,skipped:r.skipped.length});continue;}
   catch(e){if(!(e instanceof AppError))throw e;reason=e.status===409?'No patient in it is still assigned to the sending worker.':e.message;
    // Undo everything the refused application changed, then hold the transfer on the restored state.
    for(const k of Object.keys(s) as (keyof OrgState)[])if(!(k in before))delete (s as any)[k];
    for(const k of Object.keys(before) as (keyof OrgState)[])(s as any)[k]=before[k];}
  }
  const h=(s.caseloads??[]).find(x=>x.id===id)!;
  h.state='held';h.held={at:now,reason};h.version++;
  audit(h,'caseloadHold',`Scheduled caseload transfer not applied automatically: ${reason} Assignments are unchanged. A steward must apply or cancel it.`);
  out.push({transferId:h.id,state:'held',moved:0,skipped:0,reason});
 }
 return out;
}
