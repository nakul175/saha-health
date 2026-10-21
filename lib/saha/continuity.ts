import { transitionSuperseded, followUpOpen } from './programmes';
import { z } from 'zod';
import { digest, fail, person, uuid } from './core';
import { allowed } from './access';
import { TERMINAL } from './referral-rules';
import type { Actor } from './store';
import type { Member, OrgState, Person } from './types';

export type IdentityReview={state:'local'|'provisional'|'resolved';by:string;at:string;reason:string;reference?:string;candidateCount:number;reviewHash?:string};
export type AssignmentEvent={id:string;at:string;by:string;fromTeam:string;fromOwner:string|null;teamId:string;ownerId:string|null;reason:string;openWork:number;transferId?:string;acknowledgement?:{by:string;at:string;reference:string}};
const id=z.string().trim().min(1).max(200),reason=z.string().trim().min(10).max(1000);
export const matchInput=z.object({name:id,age:z.number().int().min(0).max(120),sex:z.enum(['Female','Male','Other','Unknown']),village:id,teamId:id}).strict();
export const registrationReviewSchema=z.object({hash:z.string().length(64),decision:z.enum(['distinct','provisional']),reason}).strict();
export const continuitySchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('resolvePatientIdentity'),personId:id,version:z.number().int().positive(),reference:id,reason}).strict(),
 z.object({type:z.literal('acknowledgeAssignment'),personId:id,version:z.number().int().positive(),assignmentId:id,reference:id}).strict(),
]);
const normal=(s:string)=>s.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu,' ').trim();
function near(a:string,b:string){if(a.length<5||b.length<5||Math.abs(a.length-b.length)>2)return false;let row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const next=[i];for(let j=1;j<=b.length;j++)next[j]=Math.min(next[j-1]+1,row[j]+1,row[j-1]+(a[i-1]===b[j-1]?0:1));row=next;}return row[b.length]<=2;}
// Slice 2f: the same normalisation and near-name test compare rows within an import file.
export const normalName=normal,nearName=near;
export async function patientMatches(s:OrgState,m:Member,input:z.infer<typeof matchInput>){
 if(!['asha','clinician','supervisor'].includes(m.role)||!m.teamIds.includes(input.teamId))fail(403,'Choose a team within your patient access.');
 const name=normal(input.name),village=normal(input.village);
 const candidates=s.workspace.people.filter(p=>allowed(m,p)&&!p.mergedInto).flatMap(p=>{const exact=normal(p.name)===name,similar=normal(p.village)===village&&Math.abs(p.age-input.age)<=2&&(p.sex===input.sex||p.sex==='Unknown'||input.sex==='Unknown')&&near(normal(p.name),name);return exact||similar?[{id:p.id,name:p.name,age:p.age,sex:p.sex,village:p.village,version:p.version,identityState:p.identityReview?.state??'not-recorded',match:exact?'Same normalised name':'Similar name, locality and age'}]:[]}).sort((a,b)=>a.id.localeCompare(b.id));
 return {hash:await digest({input,candidates}),candidates:candidates.slice(0,20),overflow:candidates.length>20,scope:'Only records permitted to your current account are searched. Candidates are not identity decisions.'};
}
export async function reviewRegistration(s:OrgState,m:Member,c:any,now=new Date().toISOString()):Promise<IdentityReview>{
 if(!['asha','clinician'].includes(m.role))fail(403,'A care role is required to register a person.');
 const review=await patientMatches(s,m,matchInput.parse({name:c.name,age:c.age,sex:c.sex,village:c.village,teamId:c.teamId}));
 if(review.overflow)fail(409,'Too many possible matches. Review existing records with your supervisor before registering.');
 if(review.candidates.length&&!c.registrationReview)fail(409,'Possible patient matches need review before a new record is created.');
 if(c.registrationReview&&c.registrationReview.hash!==review.hash)fail(409,'The patient matches or entered details changed. Search and review again.');
 return {state:c.registrationReview?.decision==='provisional'?'provisional':'local',by:m.userId,at:now,reason:c.registrationReview?.reason??'No candidate found in the permitted local records; no national identity verification claimed.',candidateCount:review.candidates.length,...(c.registrationReview?{reviewHash:review.hash}:{})};
}
// Provisional records may retain drafts. They cannot become confirmed encounters,
// external disclosures, referrals or approved reminders until a clinician reviews identity.
export function ensurePatientIdentity(s:OrgState,c:any){
 const guarded=new Set(['confirmVisit','preparePlan','approvePlan','executePlan','runAI','createReferral','prepareAgent','executeAgent','applyAgent','linkEhr','grantEhrPermission','importEhrDocument','reviewEhrDocument','retrieveEhrDocument','prepareEhrPublish','executeEhrPublish','sendSubmission','messageCreate','messageApprove','messageSimulate']);
 if(!guarded.has(c.type))return;
 let pid=c.personId;if(c.visitId)pid=s.workspace.visits.find(v=>v.id===c.visitId)?.personId;if(c.submissionId)pid=s.workspace.submissions.find(v=>v.id===c.submissionId)?.personId;if(c.messageId)pid=s.outreach?.messages.find(v=>v.id===c.messageId)?.personId;if(c.planId&&c.itemId)pid=s.outreach?.plans.find(v=>v.id===c.planId)?.items.find(v=>v.id===c.itemId)?.personId;
 if(pid&&person(s.workspace,pid).identityReview?.state==='provisional')fail(409,'Patient identity is unresolved. Keep this as a draft and request clinician identity review.');
}
export function openPatientWork(s:OrgState,p:Person){
 return [
  ...(p.followUps??[]).filter(t=>followUpOpen(s,t)).map(t=>({kind:'follow-up',id:t.id,ownerId:t.ownerId,due:t.due})),
  ...s.workspace.referrals.filter(r=>r.personId===p.id&&!TERMINAL.has(r.state)).map(r=>({kind:'referral',id:r.id,ownerId:r.ownerId??null,due:r.due??null})),
  ...(s.outreach?.plans??[]).filter(plan=>!['completed','cancelled'].includes(plan.state)).flatMap(plan=>plan.items.filter(i=>i.personId===p.id&&!['completed','cancelled'].includes(i.state)).map(i=>({kind:'outreach',id:i.id,ownerId:i.ownerId,due:plan.date}))),
  ...(s.outreach?.messages??[]).filter(v=>v.personId===p.id&&v.recovery?.state==='open').map(v=>({kind:'message follow-up',id:v.id,ownerId:v.recovery!.ownerId,due:null})),
 ];
}
export function transferPatientWork(s:OrgState,p:Person,c:{teamId:string;assignedTo:string|null;reason:string},u:Actor,now=new Date().toISOString()):AssignmentEvent|undefined{
 const work=openPatientWork(s,p);if(work.length&&!c.assignedTo)fail(409,'Open work needs a responsible care worker. Choose an assignee before transferring.');
 if(p.teamId===c.teamId&&p.assignedTo===c.assignedTo&&!work.some(t=>t.ownerId!==c.assignedTo))return;
 p.assignmentHistory??=[];if(p.assignmentHistory.length>=100)fail(422,'Assignment history limit reached; an archival policy is required.');
 const handover:AssignmentEvent={id:uuid(),at:now,by:u.userId,fromTeam:p.teamId,fromOwner:p.assignedTo,teamId:c.teamId,ownerId:c.assignedTo,reason:c.reason,openWork:work.length};p.assignmentHistory.push(handover);
 if(c.assignedTo){
  for(const t of p.followUps??[])if(t.state==='open'&&!transitionSuperseded(s,t))t.ownerId=c.assignedTo;
  for(const r of s.workspace.referrals)if(r.personId===p.id&&!TERMINAL.has(r.state)){r.ownerId=c.assignedTo;r.version=(r.version??1)+1;}
  for(const plan of s.outreach?.plans??[]){let changed=false;for(const i of plan.items)if(i.personId===p.id&&!['completed','cancelled'].includes(i.state)&&!['completed','cancelled'].includes(plan.state)){i.ownerId=c.assignedTo;changed=true;}if(changed){plan.version++;plan.history.push({at:now,by:u.userId,state:plan.state,reason:'Care handover: '+c.reason});}}
 }
 for(const v of s.outreach?.messages??[])if(v.personId===p.id){let changed=false;if(c.assignedTo&&v.recovery?.state==='open'){v.recovery.ownerId=c.assignedTo;changed=true;}if(['draft','approved','failed'].includes(v.state)){v.state='cancelled';v.cancelReason='Care assignment changed. Prepare a new reviewed reminder.';changed=true;}if(changed)v.version++;}
 for(const l of p.fieldLeases??[])if(l.status==='active')l.status='revoked';
 return handover;
}
export function authorizeContinuity(s:OrgState,m:Member,c:any){
 if(!['resolvePatientIdentity','acknowledgeAssignment'].includes(c.type))return;const p=person(s.workspace,c.personId);
 if(c.type==='resolvePatientIdentity'&&m.role!=='clinician')fail(403,'A clinician with patient access must resolve identity.');
 if(c.type==='acknowledgeAssignment'&&p.assignedTo!==m.userId)fail(403,'Only the current assigned worker can acknowledge this handover.');
}
export function applyContinuity(s:OrgState,input:unknown,u:Actor,m:Member,now=new Date().toISOString()):any|null{
 const parsed=continuitySchema.safeParse(input);if(!parsed.success)return null;const c=parsed.data;authorizeContinuity(s,m,c);const p=person(s.workspace,c.personId);if(p.version!==c.version)fail(409,'Patient context changed. Refresh before reviewing.');
 if(c.type==='resolvePatientIdentity'){if(p.identityReview?.state!=='provisional')fail(409,'This patient has no unresolved identity review.');p.identityReview={...p.identityReview,state:'resolved',by:u.userId,at:now,reason:c.reason,reference:c.reference};}
 else{const event=p.assignmentHistory?.at(-1);if(!event||event.id!==c.assignmentId||event.ownerId!==u.userId||event.teamId!==p.teamId)fail(409,'Review the current handover.');if(event.acknowledgement)fail(409,'This handover is already acknowledged.');event.acknowledgement={by:u.userId,at:now,reference:c.reference};}
 p.version++;s.workspace.audit.push({id:uuid(),at:now,actorId:u.userId,actor:u.displayName,role:m.role,action:c.type,subject:p.id,personId:p.id,detail:c.type==='resolvePatientIdentity'?'Local identity review recorded with evidence; no records merged or external identifiers verified.':'Current assignee acknowledged care handover.'});return {ok:true};
}
