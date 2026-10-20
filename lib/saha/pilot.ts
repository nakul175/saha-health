import { z } from 'zod';
import { digest, fail, uuid } from './core';
import { allowed } from './access';
import { GATES, operator } from './operations';
import { PACKS } from './programmes';
import type { Actor } from './store';
import type { Member, OrgState } from './types';

export const PILOT_ROLES=['programme','clinical','security','deployment'] as const;
export type PilotRole=typeof PILOT_ROLES[number];
export const TRAINING=[
 {id:'privacy',title:'Consent and privacy',detail:'Use synthetic identities. Check assignment and consent, withdraw access, and explain what stays on the device.'},
 {id:'matching',title:'Patient matching',detail:'Find the intended synthetic person, compare identifiers, refuse an ambiguous match, and use the reviewed correction path.'},
 {id:'capture',title:'Capture and review',detail:'Record measured facts, document missing answers, review AI suggestions, and correct a confirmed record without rewriting history.'},
 {id:'continuity',title:'Offline and receipt recovery',detail:'Unlock the field notebook, handle a stale sync, and recover an uncertain receipt without sending the visit twice.'},
 {id:'model-limits',title:'Model limits and human review',detail:'Recognise unavailable or low-confidence assistance, keep source facts visible, and refuse automatic clinical or operational approval.'},
 {id:'escalation',title:'Escalation and stop procedure',detail:'Record referral evidence, report a defect, find the accountable operator, and rehearse a maintenance pause.'},
 {id:'submission-status',title:'Real submission status',detail:'Distinguish queued, uncertain, accepted and rejected outcomes; recover exact receipts without claiming delivery.'}
] as const;
const id=z.string().trim().min(1).max(200),note=z.string().trim().min(10).max(500),ref=z.string().trim().min(3).max(200),version=z.number().int().min(0);
const ids=(max:number)=>z.array(id).min(1).max(max).refine(x=>new Set(x).size===x.length,'Choose each item once.');
const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(x=>!Number.isNaN(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x,'Use a valid date.');
export const configurationSchema=z.object({name:z.string().trim().min(3).max(100),location:z.string().trim().min(3).max(150),teamIds:ids(5),participantIds:ids(20),packIds:ids(3),connectionIds:z.array(id).max(10).refine(x=>new Set(x).size===x.length),reviewers:z.object({programme:id,clinical:id,security:id,deployment:id}).strict(),start:day,end:day,recordLimit:z.number().int().min(1).max(100),stopRule:note}).strict();
export type PilotConfiguration=z.infer<typeof configurationSchema>;
export type TrainingRecord={id:string;context:string;userId:string;module:string;result:'passed'|'needs_practice';assessorId:string;at:string;evidence:string;note:string;acknowledgedAt?:string};
export type ActivationReview={id:string;context:string;userId:string;memberVersion:number;role:Member['role'];decision:'eligible'|'restricted';by:string;at:string;evidence:string;note:string;trainingRecordIds:string[]};
export type Measurement={id:string;context:string;kind:'baseline'|'outcome';by:string;at:string;since:string;until:string;metrics:{patients:number;confirmed:number;openFollowUps:number;overdueFollowUps:number;openReferrals:number;pendingSubmissions:number};scope:string};
export type Pilot={version:number;configRevision:number;configuration:PilotConfiguration|null;stage:'planning'|'rehearsal'|'paused'|'completed';startedAt?:string;runContext?:string;training:TrainingRecord[];activationReviews:ActivationReview[];measurements:Measurement[];evidence:{id:string;context:string;gate:string;by:string;at:string;reference:string;note:string}[];decisions:{id:string;dossier:string;role:PilotRole;by:string;at:string;decision:'accept'|'changes';reference:string;note:string}[];history:{at:string;by:string;stage:string;reason:string}[]};
export const defaultPilot=():Pilot=>({version:0,configRevision:0,configuration:null,stage:'planning',training:[],activationReviews:[],measurements:[],evidence:[],decisions:[],history:[]});
export const pilotSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('pilotConfigure'),version,configuration:configurationSchema}).strict(),
 z.object({type:z.literal('pilotAssessTraining'),version,userId:id,module:z.enum(['privacy','matching','capture','continuity','model-limits','escalation','submission-status']),result:z.enum(['passed','needs_practice']),reference:ref,note}).strict(),
 z.object({type:z.literal('pilotAcknowledgeTraining'),version,id}).strict(),
 z.object({type:z.literal('pilotReviewActivation'),version,userId:id,decision:z.enum(['eligible','restricted']),reference:ref,note}).strict(),
 z.object({type:z.literal('pilotMeasure'),version,kind:z.enum(['baseline','outcome']),days:z.union([z.literal(7),z.literal(30)])}).strict(),
 z.object({type:z.literal('pilotEvidence'),version,gate:z.enum(['clinical','mis','ehr','abdm','model','device','security','recovery']),reference:ref,note}).strict(),
 z.object({type:z.literal('pilotDecision'),version,role:z.enum(PILOT_ROLES),decision:z.enum(['accept','changes']),reference:ref,note}).strict(),
 z.object({type:z.literal('pilotTransition'),version,stage:z.enum(['rehearsal','paused','completed','live']),reason:note}).strict()
]);
export function pilotManager(m:Member){return operator(m)||m.role==='supervisor';}
export function trainingModules(m:Member){return TRAINING.filter(t=>m.role!=='admin'||['privacy','model-limits','escalation','submission-status'].includes(t.id));}
function active(s:OrgState,id:string){const m=s.members.find(m=>m.userId===id&&m.status==='active');if(!m)fail(422,'Choose an active member in this organisation.');return m;}
function config(p:Pilot){if(!p.configuration)fail(409,'Save the pilot scope first.');return p.configuration!;}
function cohort(s:OrgState,c:PilotConfiguration){return s.workspace.people.filter(p=>c.teamIds.includes(p.teamId)&&(p.enrolments??[]).some(e=>e.state==='active'&&c.packIds.includes(e.packId)));}
export function canMeasure(m:Member,c:PilotConfiguration|null){return !!c&&m.role!=='admin'&&(m.isOwner||m.role==='supervisor')&&c.teamIds.every(t=>m.teamIds.includes(t));}
export function validateConfiguration(s:OrgState,c:PilotConfiguration){
 if(c.end<c.start||Date.parse(c.end)-Date.parse(c.start)>30*86400000)fail(422,'A rehearsal window must be between 1 and 31 calendar days.');
 if(c.teamIds.some(id=>!s.teams.some(t=>t.id===id)))fail(422,'Choose existing organisation teams.');
 if(c.packIds.some(id=>!PACKS.some(p=>p.id===id)))fail(422,'Choose an available programme pack.');
 for(const id of c.participantIds){const m=active(s,id);if(m.role!=='admin'&&!m.teamIds.some(t=>c.teamIds.includes(t)))fail(422,'Participants must belong to a selected team.');}
 if(new Set(Object.values(c.reviewers)).size!==4)fail(422,'Choose four different accountable reviewers.');
 for(const role of PILOT_ROLES){const m=active(s,c.reviewers[role]);if(role==='clinical'&&m.role!=='clinician')fail(422,'The clinical reviewer must be a clinician.');if(role==='programme'&&!m.isOwner&&m.role!=='supervisor')fail(422,'The programme reviewer must be an owner or supervisor.');if(role==='security'&&!operator(m))fail(422,'The security reviewer must have operations access.');if(role==='deployment'&&!m.isOwner)fail(422,'The deployment reviewer must be an owner.');}
 for(const id of c.connectionIds){const i=s.workspace.integrations.find(i=>i.id===id);if(!i||i.status!=='active'||i.mode!=='demo')fail(422,'Select active demonstration connections for this synthetic rehearsal. Live services need a separate approved deployment.');}
}
export async function pilotContext(s:OrgState,p=s.pilot??defaultPilot()){
 const c=p.configuration;if(!c)return '';
 return digest({release:'8 / v1.0-readiness',revision:p.configRevision,configuration:c,teams:s.teams.filter(t=>c.teamIds.includes(t.id)),members:[...new Set([...c.participantIds,...Object.values(c.reviewers)])].sort().map(id=>{const m=s.members.find(x=>x.userId===id);return m?{id,role:m.role,status:m.status,version:m.version,isOwner:m.isOwner,teamIds:[...m.teamIds].sort()}:null}),packs:PACKS.filter(p=>c.packIds.includes(p.id)),connections:c.connectionIds.map(id=>s.workspace.integrations.find(i=>i.id===id)??null)});
}
export async function pilotReadiness(s:OrgState,now=new Date()){
 const p=s.pilot??defaultPilot(),activationReviews=p.activationReviews??[],c=p.configuration,context=await pilotContext(s,p),blockers:string[]=[];
 if(!c)blockers.push('Save a bounded rehearsal scope and appoint four reviewers.');
 else {try{validateConfiguration(s,c)}catch(e){blockers.push(e instanceof Error?e.message:'The scope has changed.');}const today=now.toISOString().slice(0,10);if(today<c.start||today>c.end)blockers.push('The rehearsal is outside its configured UTC dates.');if(!cohort(s,c).length)blockers.push('Enrol at least one synthetic patient in a selected programme before rehearsing.');if(cohort(s,c).length>c.recordLimit)blockers.push('The selected programme cohort exceeds the record limit.');}
 const matrix=(c?.participantIds??[]).flatMap(id=>{const m=s.members.find(x=>x.userId===id);if(!m)return [];return trainingModules(m).map(module=>{const record=p.training.filter(t=>t.context===context&&t.userId===id&&t.module===module.id).at(-1);return {userId:id,module:module.id,record:record??null,ready:record?.result==='passed'&&!!record.acknowledgedAt};});});
 if(matrix.some(t=>!t.ready))blockers.push('Each participant needs assessed and personally acknowledged training for every required module.');
 const baseline=p.measurements.filter(b=>b.kind==='baseline'&&b.context===context).at(-1)??null;
 if(!baseline)blockers.push('Capture a baseline for the current scope.');
 const activationMatrix=(c?.participantIds??[]).flatMap(userId=>{const member=s.members.find(x=>x.userId===userId);if(!member)return [];const required=matrix.filter(t=>t.userId===userId),trainingRecordIds=required.map(t=>t.record?.id).filter((x):x is string=>!!x),competencyComplete=required.length>0&&required.every(t=>t.ready),saved=activationReviews.filter(a=>a.context===context&&a.userId===userId).at(-1)??null,current=!!saved&&saved.memberVersion===member.version&&saved.role===member.role&&saved.trainingRecordIds.length===trainingRecordIds.length&&saved.trainingRecordIds.every((x,i)=>x===trainingRecordIds[i]);const record=current?saved:null;return [{userId,role:member.role,competencyComplete,trainingRecordIds,record,status:!competencyComplete?'training-incomplete':record?.decision==='eligible'?'eligible':record?.decision==='restricted'?'restricted':'review-required'}]});
 const liveCompetencyReady=activationMatrix.length>0&&activationMatrix.every(x=>x.status==='eligible');
 const dossier=await digest({context,baseline:baseline?.id,training:matrix.map(t=>({userId:t.userId,module:t.module,id:t.record?.id,ready:t.ready})),activationReviews:activationMatrix.map(a=>({userId:a.userId,id:a.record?.id??null,status:a.status})),evidence:p.evidence.filter(e=>e.context===context).map(e=>e.id)});
 const reviews=PILOT_ROLES.map(role=>({role,reviewerId:c?.reviewers[role],decision:p.decisions.filter(d=>d.role===role&&d.dossier===dossier&&d.by===c?.reviewers[role]).at(-1)??null}));
 if(reviews.some(r=>r.decision?.decision!=='accept'))blockers.push('Four named reviewers must accept this exact rehearsal dossier from their own accounts.');
 if(s.operations?.maintenance)blockers.push('The organisation is paused for maintenance.');
 if(s.operations?.incidents.some(i=>i.state!=='resolved'&&i.severity!=='normal'))blockers.push('Resolve high or critical incidents before proceeding.');
 const runStale=p.stage==='rehearsal'&&p.runContext!==dossier;
 if(runStale)blockers.push('The active rehearsal dossier changed. Pause and review before starting again.');
 return {context,dossier,blockers,canStart:blockers.length===0,liveReady:false as const,liveCompetencyReady,baseline,matrix,activationMatrix,reviews,effectiveStage:p.stage==='rehearsal'&&(blockers.length>0)?'paused':p.stage,runStale,gates:GATES};
}
function measure(s:OrgState,m:Member,p:Pilot,context:string,kind:'baseline'|'outcome',days:number,now:string):Measurement{
 const c=config(p);if(!canMeasure(m,c))fail(403,'An owner with care access or supervisor covering every selected team must capture measurements.');
 const people=cohort(s,c);if(people.some(x=>!allowed(m,x)))fail(403,'You cannot measure records outside your current assignment scope.');
 const ids=new Set(people.map(x=>x.id)),today=now.slice(0,10),since=kind==='outcome'?p.startedAt:new Date(Date.parse(today+'T00:00:00Z')-(days-1)*86400000).toISOString();if(!since)fail(409,'Start a rehearsal before recording an outcome.');
 const tasks=people.flatMap(x=>x.followUps??[]).filter(t=>c.packIds.includes(t.packId));
 return {id:uuid(),context,kind,by:m.userId,at:now,since,until:now,scope:'Current patients in selected teams with an active selected programme episode. Current membership and assignments; synthetic aggregate counts only.',metrics:{patients:people.length,confirmed:s.workspace.visits.filter(v=>ids.has(v.personId)&&v.state==='confirmed'&&!v.voidedAt&&!v.supersededBy&&!v.imported&&(v.confirmedAt??v.createdAt)>=since&&(v.confirmedAt??v.createdAt)<=now).length,openFollowUps:tasks.filter(t=>t.state==='open').length,overdueFollowUps:tasks.filter(t=>t.state==='open'&&t.due<today).length,openReferrals:s.workspace.referrals.filter(r=>ids.has(r.personId)&&r.state!=='completed').length,pendingSubmissions:s.workspace.submissions.filter(x=>ids.has(x.personId)&&['queued','sending','uncertain','retryable'].includes(x.state)).length}};
}
export function authorizePilotCommand(s:OrgState,m:Member,c:any){
 if(!c.type.startsWith('pilot'))return;
 if(['pilotConfigure','pilotTransition'].includes(c.type)&&!m.isOwner)fail(403,'Only an owner can change scope or rehearsal stage.');
 if(c.type==='pilotAssessTraining'&&(!pilotManager(m)&&m.role!=='clinician'))fail(403,'A clinician, supervisor or operations member must assess training.');
 if(c.type==='pilotEvidence'&&!operator(m)&&!(m.role==='supervisor'&&s.pilot?.configuration?.teamIds.every(t=>m.teamIds.includes(t)))&&!Object.values(s.pilot?.configuration?.reviewers??{}).includes(m.userId))fail(403,'Reviewer or pilot management access required.');
 if(c.type==='pilotDecision'&&s.pilot?.configuration?.reviewers[c.role as PilotRole]!==m.userId)fail(403,'Only the named reviewer can record this decision.');
 if(c.type==='pilotMeasure'&&!canMeasure(m,s.pilot?.configuration??null))fail(403,'Full pilot team reporting access required.');
 if(c.type==='pilotAcknowledgeTraining'&&s.pilot?.training.find(t=>t.id===c.id)?.userId!==m.userId)fail(403,'You can acknowledge only your own training.');
 if(c.type==='pilotReviewActivation'&&!m.isOwner)fail(403,'Only an organisation owner can record activation eligibility.');
}
export async function applyPilot(s:OrgState,input:unknown,u:Actor,m:Member){
 const parsed=pilotSchema.safeParse(input);if(!parsed.success)return null;const c=parsed.data;authorizePilotCommand(s,m,c);const p=s.pilot??=defaultPilot();p.activationReviews??=[];if(p.version!==c.version)fail(409,'Pilot records changed. Refresh, review and retry.');const now=new Date().toISOString();let result:any={ok:true};
 if(p.stage==='completed'&&!['pilotConfigure','pilotReviewActivation'].includes(c.type))fail(409,'The completed rehearsal is immutable. Save a new scope revision to begin another cycle.');
 if(c.type==='pilotConfigure'){
  if(p.stage==='rehearsal')fail(409,'Pause the active rehearsal before changing scope.');validateConfiguration(s,c.configuration);p.configuration=c.configuration;p.configRevision++;p.stage='planning';p.startedAt=undefined;p.runContext=undefined;p.history.push({at:now,by:u.userId,stage:'planning',reason:`Scope revision ${p.configRevision} saved; prior evidence retained.`});
 }else{
  const cfg=config(p),context=await pilotContext(s,p);
  if(c.type==='pilotAssessTraining'){
   if(c.userId===u.userId)fail(422,'A different assessor must record your training result.');const trainee=active(s,c.userId);if(!cfg.participantIds.includes(c.userId)||!trainingModules(trainee).some(t=>t.id===c.module))fail(422,'Choose a required module for a selected participant.');
   if(!operator(m)&&!trainee.teamIds.some(t=>m.teamIds.includes(t)&&cfg.teamIds.includes(t)))fail(403,'The participant is outside your team scope.');if(p.training.length>=500)fail(422,'Training history limit reached.');const record:TrainingRecord={id:uuid(),context,userId:c.userId,module:c.module,result:c.result,assessorId:u.userId,at:now,evidence:c.reference,note:c.note};p.training.push(record);result={trainingId:record.id};
  }else if(c.type==='pilotAcknowledgeTraining'){
   const record=p.training.find(t=>t.id===c.id)!;if(record.context!==context||record.result!=='passed'||p.training.filter(t=>t.context===context&&t.userId===m.userId&&t.module===record.module).at(-1)?.id!==record.id)fail(409,'This assessment is stale or requires more practice.');if(record.acknowledgedAt)fail(409,'This training was already acknowledged.');record.acknowledgedAt=now;
  }else if(c.type==='pilotReviewActivation'){
   const readiness=await pilotReadiness(s),row=readiness.activationMatrix.find(x=>x.userId===c.userId),trainee=active(s,c.userId);if(!cfg.participantIds.includes(c.userId)||!row)fail(422,'Choose a current participant in this pilot scope.');if(c.decision==='eligible'&&!row.competencyComplete)fail(409,'Live activation remains restricted until every role-specific competency is passed and acknowledged.');if(p.activationReviews.length>=200)fail(422,'Activation review history limit reached.');const review:ActivationReview={id:uuid(),context,userId:c.userId,memberVersion:trainee.version,role:trainee.role,decision:c.decision,by:u.userId,at:now,evidence:c.reference,note:c.note,trainingRecordIds:row.trainingRecordIds};p.activationReviews.push(review);result={activationReviewId:review.id,decision:review.decision};
  }else if(c.type==='pilotMeasure'){
   if(c.kind==='baseline'&&p.stage==='rehearsal')fail(409,'Pause the rehearsal before replacing its baseline.');if(c.kind==='outcome'&&(p.stage!=='rehearsal'||(await pilotReadiness(s)).effectiveStage!=='rehearsal'))fail(409,'An active, current rehearsal is required for outcome measurement.');if(p.measurements.length>=100)fail(422,'Measurement history limit reached.');const measured=measure(s,m,p,context,c.kind,c.days,now);p.measurements.push(measured);result={measurementId:measured.id};
  }else if(c.type==='pilotEvidence'){
   if(p.evidence.length>=200)fail(422,'Evidence history limit reached.');p.evidence.push({id:uuid(),context,gate:c.gate,by:u.userId,at:now,reference:c.reference,note:c.note});
  }else if(c.type==='pilotDecision'){
   const r=await pilotReadiness(s);if(c.decision==='accept'&&(!r.baseline||r.matrix.some(t=>!t.ready)))fail(409,'Complete baseline measurement and acknowledged training before acceptance.');if(p.decisions.length>=200)fail(422,'Decision history limit reached.');p.decisions.push({id:uuid(),dossier:r.dossier,role:c.role,by:u.userId,at:now,decision:c.decision,reference:c.reference,note:c.note});
  }else if(c.type==='pilotTransition'){
   if(c.stage==='live'){const r=await pilotReadiness(s);if(!r.liveCompetencyReady)fail(409,'Live activation remains restricted until each participant has a current eligible activation record backed by role-specific competency evidence.');fail(409,'Live clinical rollout is unavailable. External acceptance and unbuilt ABDM workflows remain unresolved.');}
   if(c.stage==='paused'){if(p.stage!=='rehearsal')fail(409,'Only an active rehearsal can be paused.');p.stage='paused';}
   else if(c.stage==='rehearsal'){if(p.stage==='rehearsal')fail(409,'Pause the current rehearsal before restarting.');const r=await pilotReadiness(s);if(r.blockers.length)fail(409,r.blockers.join(' '));p.stage='rehearsal';p.runContext=r.dossier;p.startedAt=now;}
   else if(c.stage==='completed'){const r=await pilotReadiness(s);if(p.stage!=='rehearsal'||r.effectiveStage!=='rehearsal')fail(409,'Only a current accepted rehearsal can be completed.');if(s.operations?.incidents.some(i=>i.state!=='resolved'))fail(409,'Resolve all incidents before completing the rehearsal.');if(!p.measurements.some(b=>b.kind==='outcome'&&b.context===context&&b.since===p.startedAt))fail(409,'Record an outcome measurement for this rehearsal first.');p.stage='completed';}
   p.history.push({at:now,by:u.userId,stage:p.stage,reason:c.reason});
  }
 }
 p.version++;s.workspace.audit.push({id:uuid(),at:now,actorId:u.userId,actor:u.displayName,role:m.role,action:c.type,subject:s.organisation.id,detail:`Synthetic pilot record updated; version ${p.version}, scope revision ${p.configRevision}.`});return result;
}
