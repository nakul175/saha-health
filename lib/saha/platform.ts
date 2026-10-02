import { householdSchema } from './household';
import { caseloadSchema } from './caseload';
import { mergeSchema } from './merge';
import { exceptionalSchema } from './exceptional';
import { rightsSchema } from './rights';
import { consentSchema } from './consent';
import { delegationSchema, heldBy, supervises } from './delegation';
import { indicatorRegistrySchema } from './indicator-registry';
import { retentionSchema } from './retention';
import { fixtureMarkSchema } from './fixture-migration';
import { programmeMigrationSchema } from './programme-migration';
import { packInstallationSchema } from './pack-installation';
import { factReviewSchema } from './fact-verification';
import { signOffSchema } from './visit-signoff';
import { patientImportSchema } from './patient-import';
import { recordImportSchema } from './record-import';
import { referralSchema } from './referrals';
import { actionPlanSchema } from './action-plan';
import { correctionTaskSchema, correctionTasks } from './correction-tasks';
import { rosterSchema } from './roster';
import { abdmSchema } from './abdm';
import { transferSchema } from './abdm-transfer';
import { governanceSchema } from './governance';
import { evaluationSchema } from './evaluation';
import { sandboxSchema } from './provider-sandbox';
import { continuitySchema, transferPatientWork } from './continuity';
import { pilotSchema } from './pilot';
import { outreachSchema } from './outreach';
import { expansionSchema } from './expansion';
import { defaultOperations, operationsSchema } from './operations';
import { alertAckSchema } from './alerts';
import { inboxSchema } from './alert-delivery';
import { notificationChannelSchema } from './notification-channel';
import { invoiceSchema } from './ai-invoice';
import { fieldSchema } from './field';
import { fieldRegistrationSchema } from './field-registration';
import { referralRequestSchema } from './referral-request';
import { ehrSchema } from './ehr';
import { misSchema } from './mis';
import { adapterOperationsSchema } from './adapter-operations';
import { aggregateSchema } from './aggregate-delivery';
import { agentSchema } from './agent';
import { shadowSchema } from './shadow';
import { programmeSchema, programmeApply } from './programme-commands';
import { z } from 'zod';
import { commandSchema, digest, fail, person, visit, uuid } from './core';
import type { Actor } from './store';
import type { OrgState, Member, Role } from './types';
const str=z.string().trim().min(1).max(200), reason=z.string().trim().min(5,'Explain the reason in at least 5 characters.').max(1000), ver=z.number().int().positive();
const role=z.enum(['asha','clinician','supervisor','admin']);
const teamIds=z.array(str).max(20).refine(x=>new Set(x).size===x.length,'Choose each team once.');
export const platformSchema=z.discriminatedUnion('type',[
 ...commandSchema.options,
 ...continuitySchema.options,
 ...householdSchema.options,
 ...caseloadSchema.options,
 ...mergeSchema.options,
 ...exceptionalSchema.options,
 ...rightsSchema.options,
 ...consentSchema.options,
 ...delegationSchema.options,
 ...indicatorRegistrySchema.options,
 ...retentionSchema.options,
 ...fixtureMarkSchema.options,
 ...programmeMigrationSchema.options,
 ...packInstallationSchema.options,
 ...factReviewSchema.options,
 ...signOffSchema.options,
 ...patientImportSchema.options,
 ...recordImportSchema.options,
 ...referralSchema.options,
 ...actionPlanSchema.options,
 ...correctionTaskSchema.options,
 ...rosterSchema.options,
 ...abdmSchema.options,
 ...transferSchema.options,
 ...governanceSchema.options,
 ...evaluationSchema.options,
 ...sandboxSchema.options,
 ...shadowSchema.options,
 ...operationsSchema.options,
 ...alertAckSchema.options,
 ...inboxSchema.options,
 ...notificationChannelSchema.options,
 ...invoiceSchema.options,
 ...pilotSchema.options,
 ...outreachSchema.options,
 ...expansionSchema.options,
 ...fieldSchema.options,
 ...fieldRegistrationSchema.options,
 ...referralRequestSchema.options,
 ...misSchema.options,
 adapterOperationsSchema.innerType(),
 ...aggregateSchema.options,
 ...ehrSchema.options,
 ...agentSchema.options,
 ...programmeSchema.options,
 // Slice 9a: owner-only installation of the demonstration clinical package (synthetic environment only; lib/saha/demonstration.ts).
 z.object({type:z.literal('installDemonstrationPackage')}).strict(),
 z.object({type:z.literal('createOrganisation'),name:str}),
 z.object({type:z.literal('switchOrganisation'),organisationId:str}),
 z.object({type:z.literal('joinOrganisation'),token:z.string().regex(/^[a-f0-9]{64}$/,'Enter the full invitation code.')}),
 z.object({type:z.literal('renameOrganisation'),name:str,version:ver}),
 // Slice 9b: a member sets the name this organisation shows for their own account. There is no member field: it can only
 // ever apply to the signed-in account. Control and bidirectional-override characters are refused.
 z.object({type:z.literal('setMyDisplayName'),name:z.string().trim().min(1,'Enter a name of 1 to 80 characters.').max(80,'Enter a name of 1 to 80 characters.').regex(/^[^\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]+$/,'Remove control characters from the name.'),version:z.number().int().min(0)}).strict(),
 z.object({type:z.literal('createTeam'),name:str}),
 z.object({type:z.literal('createInvite'),accountCode:z.string().trim().regex(/^[A-F0-9]{24}$/,'Use the 24-character account code shown in your teammate’s account.'),label:str,role,teamIds}),
 z.object({type:z.literal('revokeInvite'),inviteId:str}),
 z.object({type:z.literal('updateMember'),userId:str,version:ver,role:z.enum(['asha','clinician','supervisor','admin','provider']),teamIds,isOwner:z.boolean(),status:z.enum(['active','suspended']),reason}),
 z.object({type:z.literal('assignPatient'),personId:str,version:ver,teamId:str,assignedTo:z.string().nullable(),reason}),
 z.object({type:z.literal('correctIdentity'),personId:str,version:ver,name:str,age:z.number().int().min(0).max(120),sex:z.enum(['Female','Male','Other','Unknown']),village:str,reason}),
 z.object({type:z.literal('amendVisit'),visitId:str,version:ver,reason}),
 z.object({type:z.literal('voidVisit'),visitId:str,version:ver,reason}),
]);
export type PlatformCommand=z.infer<typeof platformSchema>;
export function manage(member:Member){if(!member.isOwner)fail(403,'Only organisation owners can manage membership and teams.');}
export function validTeams(state:OrgState,ids:string[],r:Role){if(r!=='admin'&&!ids.length)fail(422,'A care or supervisor role requires at least one team.');if(ids.some(id=>!state.teams.some(t=>t.id===id)))fail(422,'Choose a team in this organisation.');}
// Slice 2j: the audit line names how many downstream tasks were created and how many need a person.
const taskSummary=(t:{state:string}[])=>`${t.length} downstream output${t.length===1?'':'s'} recorded as correction tasks (${t.filter(x=>x.state==='open').length} open).`;
function clinical(member:Member){if(!['asha','clinician'].includes(member.role))fail(403,'A care role is required for this action.');}
export async function platformApply(state:OrgState,c:PlatformCommand,u:Actor,m:Member):Promise<{handled:boolean;result?:any}>{
 const programmeResult=programmeApply(state,c,u,m);if(programmeResult)return {handled:true,result:programmeResult};
 const w=state.workspace,now=new Date().toISOString();let subject=state.organisation.id,detail='',patientId:string|undefined,result:any={ok:true};
 switch(c.type){
 case 'renameOrganisation':manage(m);if(c.version!==state.organisation.revision)fail(409,'Organisation settings changed. Refresh and try again.');state.organisation.name=c.name;detail='Organisation name updated.';break;
 case 'setMyDisplayName':{const ops=state.operations??=defaultOperations(),names=ops.memberNames??={},own=names[u.userId],version=own?.version??0;if(c.version!==version)fail(409,'Your name in this organisation changed. Refresh and try again.');const me=state.members.find(x=>x.userId===u.userId)!,prior=me.displayName;if(c.name===prior&&me.nameSource==='self')fail(422,'This is already your name in this organisation.');if(Object.keys(names).length>=2000&&!own)fail(422,'Display name limit reached for this organisation.');names[u.userId]={name:c.name,version:version+1,at:now};Object.assign(me,{displayName:c.name,nameSource:'self',nameVersion:version+1});subject=u.userId;detail=`Display name in this organisation changed from "${prior}" to "${c.name}". Sign-in identity and access unchanged.`;result={name:c.name,version:version+1};break;}
 case 'createTeam':manage(m);if(state.teams.some(t=>t.name.toLowerCase()===c.name.toLowerCase()))fail(409,'A team with this name already exists.');if(state.teams.length>=30)fail(422,'This release supports up to 30 teams per organisation.');const t={id:uuid(),name:c.name,createdAt:now};state.teams.push(t);subject=t.id;detail=`Team created: ${t.name}.`;result={teamId:t.id};break;
 case 'createInvite':{manage(m);validTeams(state,c.teamIds,c.role);if(state.members.some(x=>x.accountCode===c.accountCode&&x.status==='active'))fail(409,'This account is already an active member. Edit its membership instead.');if(state.invitations.some(i=>i.accountCode===c.accountCode&&i.status==='pending'&&i.expiresAt>now))fail(409,'A current invitation already exists. Revoke it before issuing another.');const bytes=crypto.getRandomValues(new Uint8Array(32));const token=Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');const i={id:uuid(),accountCode:c.accountCode,label:c.label,role:c.role,teamIds:c.teamIds,status:'pending' as const,expiresAt:new Date(Date.now()+72*3600000).toISOString(),createdBy:u.userId,createdAt:now,tokenHash:await digest(token)};state.invitations.push(i);subject=i.id;detail=`Invitation created for ${c.label}; role ${c.role}; expires in 72 hours.`;result={invitationId:i.id,token,expiresAt:i.expiresAt};break;}
 case 'revokeInvite':{manage(m);const i=state.invitations.find(i=>i.id===c.inviteId);if(!i||i.status!=='pending')fail(409,'This invitation is no longer pending.');i.status='revoked';subject=i.id;detail='Invitation revoked.';break;}
 case 'updateMember':{manage(m);const target=state.members.find(x=>x.userId===c.userId);if(!target)fail(404,'Member not found.');if(target.version!==c.version)fail(409,'Membership changed. Refresh before editing it.');if(target.status==='removed')fail(409,'A removed membership cannot be edited. Issue a new invitation to restore access.');if(target.userId.startsWith('fixture:'))fail(409,'Demonstration fixture clinicians belong to the demonstration clinical package and cannot be edited. Suspend or retire the package entries under Clinical governance instead.');validTeams(state,c.teamIds,c.role);if(target.userId===u.userId&&c.status==='suspended')fail(422,'Another owner must suspend your account.');if(target.isOwner&&target.status==='active'&&(!c.isOwner||c.status!=='active')&&state.members.filter(x=>x.isOwner&&x.status==='active').length===1)fail(409,'Keep at least one active organisation owner.');const priorAccess={role:target.role,status:target.status,isOwner:target.isOwner,teams:target.teamIds.map(id=>state.teams.find(t=>t.id===id)?.name??id).join(', ')};Object.assign(target,{role:c.role,isOwner:c.isOwner,status:c.status,teamIds:c.teamIds,version:target.version+1});subject=target.userId;detail=`${target.displayName}: role ${priorAccess.role} → ${c.role}; ${priorAccess.status} → ${c.status}; owner ${priorAccess.isOwner} → ${c.isOwner}; teams ${priorAccess.teams||'none'} → ${c.teamIds.map(id=>state.teams.find(t=>t.id===id)?.name??id).join(', ')||'none'}. Reason: ${c.reason}`;break;}
 case 'assignPatient':{const own=m.isOwner||m.role==='supervisor';if(!own&&!heldBy(state,m,'team-supervision',now).length)fail(403,'An owner with patient access or a team supervisor must manage assignments.');const p=person(w,c.personId);if(p.version!==c.version)fail(409,'Patient assignment changed. Refresh before assigning.');if(!m.teamIds.includes(c.teamId)||!state.teams.some(t=>t.id===c.teamId))fail(403,'The destination team is outside your care scope.');
  // Slice 1e: a supervision delegate may move assignments only within teams delegated to them.
  if(!own&&!(supervises(state,m,p.teamId,now,false)&&supervises(state,m,c.teamId,now,false)))fail(403,'Your supervision delegation does not cover this patient\'s team and the destination team.');if(!own){supervises(state,m,p.teamId,now);supervises(state,m,c.teamId,now);}if(c.assignedTo){const target=state.members.find(x=>x.userId===c.assignedTo&&x.status==='active');if(!target||!['asha','clinician'].includes(target.role)||!target.teamIds.includes(c.teamId))fail(422,'Choose an active care worker in the destination team.');}transferPatientWork(state,p,c,u,now);p.teamId=c.teamId;p.assignedTo=c.assignedTo;p.version++;for(const v of w.visits.filter(v=>v.personId===p.id))if(v.plan&&v.plan.state!=='completed')v.plan.state='blocked';patientId=subject=p.id;detail=`Patient assignment updated. Reason: ${c.reason}`;break;}
 case 'correctIdentity':{clinical(m);const p=person(w,c.personId);if(p.version!==c.version)fail(409,'Patient details changed. Refresh and compare before correcting.');if(p.name===c.name&&p.age===c.age&&p.sex===c.sex&&p.village===c.village)fail(422,'Change at least one identity detail.');Object.assign(p,{name:c.name,age:c.age,sex:c.sex,village:c.village,version:p.version+1});for(const v of w.visits.filter(v=>v.personId===p.id))if(v.plan&&v.plan.state!=='completed')v.plan.state='blocked';subject=patientId=p.id;detail=`Identity corrected. Earlier revisions and completed outputs retained. Reason: ${c.reason}`;break;}
 case 'amendVisit':{clinical(m);const v=visit(w,c.visitId);if(v.recordVersion!==c.version)fail(409,'This visit changed. Refresh before creating a correction.');if(v.state!=='confirmed'||v.voidedAt||v.supersededBy)fail(409,'Choose a current confirmed visit to correct.');const newVisit={id:uuid(),personId:v.personId,version:1,recordVersion:1,state:'draft' as const,facts:structuredClone(v.facts),programmeCapture:v.programmeCapture?structuredClone(v.programmeCapture):undefined,aiResults:[],createdAt:now,amendsVisitId:v.id};
  // Slice 2j: every downstream output of the earlier version becomes an explicit task, computed before anything changes.
  const tasks=correctionTasks(state,v,'amend',u,now,newVisit.id);v.correctionTasks=[...(v.correctionTasks??[]),...tasks];v.supersededBy=newVisit.id;if(v.plan&&v.plan.state!=='completed')v.plan.state='blocked';w.visits.push(newVisit);person(w,v.personId).status='in_progress';subject=v.id;patientId=v.personId;detail=`Correction draft created; original facts and receipts retained. ${taskSummary(tasks)} Reason: ${c.reason}`;result={visitId:newVisit.id};break;}
 case 'voidVisit':{clinical(m);const v=visit(w,c.visitId);if(v.recordVersion!==c.version)fail(409,'This visit changed. Refresh before marking it as wrong-patient.');if(v.voidedAt||v.supersededBy)fail(409,'This visit is already corrected or marked as wrong-patient.');const tasks=v.state==='confirmed'?correctionTasks(state,v,'void',u,now,null):[];if(tasks.length)v.correctionTasks=[...(v.correctionTasks??[]),...tasks];v.voidedAt=now;v.voidReason=c.reason;if(v.plan&&v.plan.state!=='completed')v.plan.state='blocked';subject=v.id;patientId=v.personId;detail=`Marked as recorded against the wrong patient. Further use blocked; no data moved or receipts recalled. ${tasks.length?taskSummary(tasks)+' ':''}Reason: ${c.reason}`;break;}
 default:return {handled:false};
 }
 w.audit.push({id:uuid(),at:now,actor:u.displayName,actorId:u.userId,role:m.role,action:c.type,subject,personId:patientId,detail});return {handled:true,result};
}
