import { z } from 'zod';
import { checkFacts, factsSchema, fail, uuid } from './core';
import { registrationReviewSchema, reviewRegistration } from './continuity';
import { captureFor, installedPacks } from './programmes';
import { PROGRAMMES, type OrgState, type Member, type Person, type Visit } from './types';
import type { Actor } from './store';
import type { RequestDecision } from './referral-request';
import type { RegistrationRemoval } from './field-device';
// Slice 3g: a person registered offline in the field notebook, with an optional first visit draft and an
// optional referral request, is synced in ONE command, so person, visit and request are created together or
// not at all (BR-OFF-05). The notebook's registration id is stored on the person, so a resend under a new
// operation key returns the earlier result instead of creating a second person. The usual duplicate review
// applies (reviewRegistration): possible matches refuse until the worker reviews them; the notebook then
// calls POST /api/patient-matches for {hash,candidates} and resends with registrationReview.
// Slice 14e: `deviceRemoval` records a notebook's receipt for removing the synced registration copy from the device.
export type FieldRegistration={id:string;by:string;capturedAt:string;syncedAt:string;deviceRemoval?:RegistrationRemoval};
export type ReferralRequest={facility:string;reason:string;requestedBy:string;requestedAt:string;capturedAt:string;decision?:RequestDecision};
const str=z.string().trim().min(1).max(200);
export const fieldRegistrationSchema=z.discriminatedUnion('type',[z.object({
 type:z.literal('registerFieldPerson'),registrationId:z.string().uuid(),capturedAt:z.string().datetime(),
 name:str,age:z.number().int().min(0).max(120),sex:z.enum(['Female','Male','Other','Unknown']),village:str,programme:z.enum(PROGRAMMES as [string,...string[]]),teamId:str,
 registrationReview:registrationReviewSchema.optional(),facts:factsSchema.optional(),
 referralRequest:z.object({facility:z.string().trim().min(3).max(200),reason:z.string().trim().min(5).max(1000)}).strict().optional(),
}).strict()]);
// Also applied when an idempotent request is replayed.
export function authorizeFieldRegistration(s:OrgState,m:Member,c:any){
 if(c.type!=='registerFieldPerson')return;
 if(!['asha','clinician'].includes(m.role))fail(403,'A current care role is required to register a person.');
 if(!m.teamIds.includes(c.teamId)||!s.teams.some(t=>t.id===c.teamId))fail(403,'Choose a care team you belong to.');
}
export async function applyFieldRegistration(s:OrgState,input:unknown,u:Actor,m:Member,now=new Date().toISOString()):Promise<any|null>{
 const parsed=fieldRegistrationSchema.safeParse(input);if(!parsed.success)return null;const c=parsed.data,w=s.workspace;
 authorizeFieldRegistration(s,m,c);
 // A registration id already on a person means an earlier send was applied: answer with that result.
 const prior=w.people.find(p=>p.fieldRegistration?.id===c.registrationId);
 if(prior){
  if(prior.fieldRegistration!.by!==u.userId)fail(409,'This registration id was used by another worker. Nothing was created.');
  if(!prior.assigned)fail(409,'This registration was already synced, but the person is no longer in your care scope. Nothing new was created. Ask your supervisor.');
  const v=w.visits.find(x=>x.personId===prior.id&&x.fieldRegistrationId===c.registrationId);
  w.audit.push({id:uuid(),at:now,actorId:u.userId,actor:u.displayName,role:m.role,action:'registerFieldPerson',subject:prior.id,personId:prior.id,detail:'Repeated field registration recognised by its registration id; no second person or visit was created.'});
  return {personId:prior.id,visitId:v?.id??null,referralRequested:!!v?.referralRequest,identity:prior.identityReview?.state??null,alreadyRegistered:true};
 }
 if(Date.parse(c.capturedAt)>Date.parse(now)+300000)fail(422,'The capture time cannot be in the future.');
 const facts=c.facts?checkFacts(c.facts,Date.parse(now)):undefined;
 if(c.referralRequest&&!c.facts)fail(422,'A referral request needs the visit it came from.');
 const review=await reviewRegistration(s,m,{name:c.name,age:c.age,sex:c.sex,village:c.village,teamId:c.teamId,registrationReview:c.registrationReview},now);
 const p:Person={id:uuid(),name:c.name,age:c.age,sex:c.sex,village:c.village,programmes:[c.programme as any,...(c.programme==='General care'?[]:['General care' as const])],task:'New home visit',due:'Today',status:c.facts?'in_progress':'due',aiConsent:false,exchangeConsent:false,consentVersion:1,assigned:true,createdAt:now,version:1,teamId:c.teamId,assignedTo:u.userId,identityReview:review,fieldRegistration:{id:c.registrationId,by:u.userId,capturedAt:c.capturedAt,syncedAt:now}};
 w.people.push(p);let visitId:string|null=null;
 if(facts){const v:Visit={id:uuid(),personId:p.id,version:1,state:'draft',facts,createdAt:now,aiResults:[],recordVersion:1,programmeCapture:captureFor(p.enrolments??[],installedPacks(s)),fieldRegistrationId:c.registrationId,...(c.referralRequest?{referralRequest:{...c.referralRequest,requestedBy:u.userId,requestedAt:now,capturedAt:c.capturedAt}}:{})};w.visits.push(v);visitId=v.id;}
 w.audit.push({id:uuid(),at:now,actorId:u.userId,actor:u.displayName,role:m.role,action:'registerFieldPerson',subject:p.id,personId:p.id,detail:`Person registered offline in the field notebook (captured ${c.capturedAt}) and synced${c.facts?' with a first visit draft':''}${c.referralRequest?' and a referral request for clinician review':''}. Identity: ${review.state}${c.registrationReview?` after a ${c.registrationReview.decision} review of ${review.candidateCount} possible match${review.candidateCount===1?'':'es'}`:''}. Nothing was confirmed, referred or sent.`});
 return {personId:p.id,visitId,referralRequested:!!c.referralRequest,identity:review.state,alreadyRegistered:false};
}
