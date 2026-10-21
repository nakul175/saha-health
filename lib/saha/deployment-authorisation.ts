import { z } from 'zod';
import { digest, fail, uuid } from './core';
import type { Actor } from './store';
import type { Member, OrgState } from './types';
import { entryFor, entryScope, governanceState } from './governance';

const id=z.string().trim().min(1).max(200),text=z.string().trim().min(10).max(1000),version=z.number().int().positive(),hash=z.string().regex(/^[0-9a-f]{64}$/);
export const deploymentAuthorisationSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('recordDeploymentEvidence'),entryId:id,entryVersion:version,manifestHash:hash,evaluationId:id,evaluationContext:text,limitations:text,reference:id}).strict(),
 z.object({type:z.literal('recordRegulatoryDecision'),entryId:id,entryVersion:version,manifestHash:hash,evidenceId:id,status:z.enum(['cleared','restricted','rejected']),reference:id,reason:text}).strict(),
 z.object({type:z.literal('authoriseClinicalDeployment'),entryId:id,entryVersion:version,manifestHash:hash,evidenceId:id,regulatoryDecisionId:id,deploymentScope:text,signedReference:id,expiresAt:z.string().datetime()}).strict(),
 z.object({type:z.literal('withdrawClinicalDeployment'),entryId:id,entryVersion:version,authorisationId:id,reason:text}).strict(),
]);
export type DeploymentEvidenceRecord={id:string;entryId:string;manifestHash:string;evaluationId:string;evaluationContext:string;limitations:string;reference:string;by:string;memberVersion:number;at:string};
export type RegulatoryDecisionRecord={id:string;entryId:string;manifestHash:string;evidenceId:string;status:'cleared'|'restricted'|'rejected';reference:string;reason:string;by:string;memberVersion:number;at:string};
export type ClinicalDeploymentAuthorisation={id:string;entryId:string;manifestHash:string;evidenceId:string;regulatoryDecisionId:string;deploymentScope:string;scopeHash:string;signedReference:string;by:string;memberVersion:number;reviewBy:string;reviewAt:string;reviewReference:string;expiresAt:string;at:string;withdrawn?:{by:string;at:string;reason:string}};
export type DeploymentAuthorisationState={evidence:DeploymentEvidenceRecord[];regulatory:RegulatoryDecisionRecord[];authorisations:ClinicalDeploymentAuthorisation[]};
export const deploymentState=(s:OrgState):DeploymentAuthorisationState=>governanceState(s).deploymentAuthorisations??{evidence:[],regulatory:[],authorisations:[]};
const currentMember=(s:OrgState,userId:string)=>s.members.find(x=>x.userId===userId&&x.status==='active');
const audit=(s:OrgState,actor:Actor,m:Member,action:string,subject:string,detail:string)=>s.workspace.audit.push({id:uuid(),at:new Date().toISOString(),actorId:actor.userId,actor:actor.displayName,role:m.role,action,subject,detail});

export function deploymentAuthorisationIssues(s:OrgState,entryId:string,now=new Date().toISOString()){
 const e=entryFor(s,entryId),state=deploymentState(s),issues:string[]=[];
 const auth=[...state.authorisations].reverse().find(x=>x.entryId===entryId&&!x.withdrawn);
 if(!auth)return ['Signed deployment authorisation required'];
 const evidence=state.evidence.find(x=>x.id===auth.evidenceId),regulatory=state.regulatory.find(x=>x.id===auth.regulatoryDecisionId);
 if(auth.manifestHash!==e.manifestHash)issues.push('Capability manifest changed after authorisation');
 if(auth.expiresAt<=now)issues.push('Deployment authorisation expired');
 if(!e.review||e.review.by!==auth.reviewBy||e.review.at!==auth.reviewAt||e.review.reference!==auth.reviewReference)issues.push('Independent review changed after authorisation');
 if(!evidence||evidence.entryId!==e.id||evidence.manifestHash!==e.manifestHash)issues.push('Bound evidence is unavailable or stale');
 if(!regulatory||regulatory.entryId!==e.id||regulatory.evidenceId!==evidence?.id||regulatory.manifestHash!==e.manifestHash||regulatory.status!=='cleared')issues.push('Current cleared regulatory decision required');
 for(const row of [evidence,regulatory,auth])if(row){const m=currentMember(s,row.by);if(!m||m.version!==row.memberVersion||m.role!=='clinician')issues.push('Recorded authority changed');}
 if(evidence&&(evidence.by===auth.by||e.review?.by===auth.by))issues.push('Deployment signer must be independent of evidence preparation and clinical review');
 const ev=governanceState(s).evaluations.find(x=>x.id===evidence?.evaluationId);
 if(!ev||ev.state!=='completed'||!ev.metrics?.passed||ev.manifestHash!==e.manifestHash)issues.push('Passing version-bound evaluation evidence required');
 return [...new Set(issues)];
}
export function authorizeDeploymentAuthorisation(s:OrgState,m:Member,input:unknown){
 const parsed=deploymentAuthorisationSchema.safeParse(input);if(!parsed.success)return;const c=parsed.data,e=entryFor(s,c.entryId);
 if(e.spec.kind!=='capability'||!entryScope(m,e))fail(403,'This capability is outside current review scope.');
 if(m.role!=='clinician')fail(403,'A current clinician governance role is required.');
 if(c.type==='recordDeploymentEvidence'&&!m.isOwner)fail(403,'A clinician organisation owner must register deployment evidence.');
 if(['authoriseClinicalDeployment','withdrawClinicalDeployment'].includes(c.type)&&!m.isOwner)fail(403,'A clinician organisation owner must sign or withdraw deployment authorisation.');
}
export async function applyDeploymentAuthorisation(s:OrgState,input:unknown,actor:Actor,m:Member,now=new Date().toISOString()){
 const parsed=deploymentAuthorisationSchema.safeParse(input);if(!parsed.success)return null;const c=parsed.data,e=entryFor(s,c.entryId);authorizeDeploymentAuthorisation(s,m,c);
 if(e.version!==c.entryVersion)fail(409,'Capability or review changed. Refresh.');
 const g=governanceState(s);g.deploymentAuthorisations??={evidence:[],regulatory:[],authorisations:[]};const state=g.deploymentAuthorisations;
 if(c.type==='recordDeploymentEvidence'){
  if(c.manifestHash!==e.manifestHash)fail(409,'Capability manifest changed. Refresh.');const ev=g.evaluations.find(x=>x.id===c.evaluationId);
  if(!ev||ev.entryId!==e.id||ev.manifestHash!==e.manifestHash||ev.state!=='completed'||!ev.metrics?.passed)fail(409,'A passing evaluation for this exact manifest is required.');
  if(state.evidence.length>=300)fail(422,'Deployment evidence limit reached; archive policy required.');const row:DeploymentEvidenceRecord={id:uuid(),entryId:e.id,manifestHash:e.manifestHash,evaluationId:ev.id,evaluationContext:c.evaluationContext,limitations:c.limitations,reference:c.reference,by:actor.userId,memberVersion:m.version,at:now};state.evidence.push(row);audit(s,actor,m,c.type,row.id,'Version-bound deployment evidence recorded; no regulatory or deployment approval inferred.');return {evidenceId:row.id,clinicalAuthorised:false};
 }
 if(c.type==='recordRegulatoryDecision'){
  if(c.manifestHash!==e.manifestHash)fail(409,'Capability manifest changed. Refresh.');const evidence=state.evidence.find(x=>x.id===c.evidenceId);
  if(!evidence||evidence.entryId!==e.id||evidence.manifestHash!==e.manifestHash)fail(409,'Exact deployment evidence is unavailable or stale.');if(evidence.by===actor.userId)fail(403,'A different clinician must record the regulatory decision.');
  if(state.regulatory.length>=300)fail(422,'Regulatory decision limit reached; archive policy required.');const row:RegulatoryDecisionRecord={id:uuid(),entryId:e.id,manifestHash:e.manifestHash,evidenceId:evidence.id,status:c.status,reference:c.reference,reason:c.reason,by:actor.userId,memberVersion:m.version,at:now};state.regulatory.push(row);audit(s,actor,m,c.type,row.id,'Separate regulatory decision recorded; no deployment authorisation inferred.');return {regulatoryDecisionId:row.id,clinicalAuthorised:false};
 }
 if(c.type==='authoriseClinicalDeployment'){
  if(c.manifestHash!==e.manifestHash||!e.review||!['reviewed','active'].includes(e.state))fail(409,'A current independently reviewed capability is required.');const evidence=state.evidence.find(x=>x.id===c.evidenceId),regulatory=state.regulatory.find(x=>x.id===c.regulatoryDecisionId);
  if(!evidence||evidence.entryId!==e.id||evidence.manifestHash!==e.manifestHash)fail(409,'Exact deployment evidence is unavailable or stale.');if(!regulatory||regulatory.entryId!==e.id||regulatory.evidenceId!==evidence.id||regulatory.manifestHash!==e.manifestHash||regulatory.status!=='cleared')fail(409,'A current cleared regulatory decision bound to this evidence is required.');
  if(actor.userId===evidence.by||actor.userId===e.review.by)fail(403,'Deployment authorisation requires a signer independent of evidence preparation and clinical review.');if(c.expiresAt<=now)fail(422,'Deployment authorisation expiry must be in the future.');
  if(state.authorisations.length>=300)fail(422,'Deployment authorisation limit reached; archive policy required.');const row:ClinicalDeploymentAuthorisation={id:uuid(),entryId:e.id,manifestHash:e.manifestHash,evidenceId:evidence.id,regulatoryDecisionId:regulatory.id,deploymentScope:c.deploymentScope,scopeHash:await digest({manifestHash:e.manifestHash,deploymentScope:c.deploymentScope}),signedReference:c.signedReference,by:actor.userId,memberVersion:m.version,reviewBy:e.review.by,reviewAt:e.review.at,reviewReference:e.review.reference,expiresAt:c.expiresAt,at:now};state.authorisations.push(row);const issues=deploymentAuthorisationIssues(s,e.id,now);if(issues.length){state.authorisations.pop();fail(409,issues.join('; '));}audit(s,actor,m,c.type,row.id,'Exact evidence, independent review, regulatory clearance and signed deployment scope bound; no hosting action performed.');return {authorisationId:row.id,clinicalAuthorised:true};
 }
 const auth=state.authorisations.find(x=>x.id===c.authorisationId&&x.entryId===e.id);if(!auth||auth.withdrawn)fail(409,'Current deployment authorisation is unavailable.');auth.withdrawn={by:actor.userId,at:now,reason:c.reason};audit(s,actor,m,c.type,auth.id,'Signed deployment authorisation withdrawn; history retained and activation qualification removed.');return {authorisationId:auth.id,clinicalAuthorised:false};
}
