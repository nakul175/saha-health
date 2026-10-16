import { z } from 'zod';
import { digest, fail, person, uuid, visit } from './core';
import { allowed, normallyAllowed } from './access';
import { factProvenance, measureOf } from './fact-provenance';
import type { OrgState, Member, Visit, Person } from './types';
import type { Actor } from './store';
import type { AgentProvider, AgentRun } from './agent';
import type { Evaluation } from './evaluation';
import { checkMonthlyBudget } from './ai-budget';
import type { ProviderSandbox, ProposalOrigin } from './provider-sandbox';
import type { Shadow } from './shadow';
import { capabilityImpact, impactSummary } from './capability-lifecycle';
import type { DeploymentAuthorisationState } from './deployment-authorisation';
export const SOURCE_DOCUMENT_BYTES=512*1024;
export const sourceDocumentRef=z.object({id:z.string().uuid(),sha256:z.string().regex(/^[0-9a-f]{64}$/),mime:z.enum(['text/plain','application/pdf']),bytes:z.number().int().min(1).max(SOURCE_DOCUMENT_BYTES),acquiredAt:z.string().datetime(),expiresAt:z.string().datetime(),licenceReference:z.string().trim().min(3).max(200),acquisition:z.enum(['synthetic-upload','approved-origin-retrieval']),trainingOnly:z.literal(true),retrieval:z.object({url:z.string().url().max(500),origin:z.string().url().max(500),expectedSha256:z.string().regex(/^[0-9a-f]{64}$/),receivedAt:z.string().datetime(),method:z.literal('GET')}).strict().optional()}).strict().refine(d=>d.acquisition==='synthetic-upload'?!d.retrieval:!!d.retrieval&&d.retrieval.expectedSha256===d.sha256&&new URL(d.retrieval.url).origin===d.retrieval.origin,'Acquisition provenance must match its exact digest and origin.');
const id=z.string().trim().min(1).max(200),text=z.string().trim().min(10).max(1000),version=z.number().int().positive();
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(x=>Number.isFinite(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x);
const unique=(v:string[])=>new Set(v).size===v.length;
const teamIds=z.array(id).min(1).max(20).refine(unique),roles=z.array(z.enum(['asha','clinician'])).min(1).max(2).refine(unique);
const programme=z.enum(['General care','Maternal care','TB screening','Chronic care','Child health']);
const capabilityRegistrationDetails=z.object({
 manifestVersion:z.string().regex(/^v[1-9]\d*\.\d+\.\d+$/),
 intendedUse:text,
 inputContract:text,
 outputContract:text,
 providerContract:id,
 modelContract:id,
 toolContracts:z.array(id).max(10).refine(unique),
 permittedData:z.array(z.enum(['encounter-text','documentary-observations','language','task-context'])).min(1).max(4).refine(unique),
 population:text,
 limitations:text,
 safetyFallback:text,
 evaluationEvidence:id,
 approvalVersion:id,
 incidentOwnerId:id
}).strict();
const common={key:z.string().regex(/^[a-z][a-z0-9-]{2,60}$/),title:id,ownerId:id,teamIds,effectiveFrom:date,reviewBy:date,changeSummary:text};
const conditions=z.object({field:z.enum(['systolic','diastolic','weight','temperature','weeks','coughDays','workerConcern']),operator:z.enum(['gte','lte','eq','missing']),value:z.string().trim().max(30)}).strict();
export const ruleSchema=z.object({id:z.string().regex(/^[a-z][a-z0-9-]{0,40}$/),label:id,condition:conditions,urgency:z.enum(['review','urgent_review']),action:text,serviceId:id}).strict();
export const governanceSpec=z.discriminatedUnion('kind',[
 z.object({...common,kind:z.literal('source'),publisher:id,edition:id,url:z.string().url().max(500).refine(s=>{try{const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password}catch{return false}}),applicability:text,summary:text,document:sourceDocumentRef.optional()}).strict(),
 z.object({...common,kind:z.literal('service'),location:id,services:text,contactRoute:id,constraints:text,verifiedOn:date,verificationReference:id}).strict(),
 z.object({...common,kind:z.literal('protocol'),programme,ageMin:z.number().int().min(0).max(120),ageMax:z.number().int().min(0).max(120),roles,sourceIds:z.array(id).min(1).max(5).refine(unique),maxObservationAgeHours:z.number().int().min(1).max(720),rules:z.array(ruleSchema).min(1).max(12),transition:z.literal('new-reviews-only')}).strict(),
 z.object({...common,kind:z.literal('capability'),providerId:id,model:id,agentVersion:id,purpose:z.literal('documentary-evidence'),ageMin:z.number().int().min(0).max(120),ageMax:z.number().int().min(0).max(120),roles,languages:z.array(z.enum(['en','hi'])).min(1).max(2).refine(unique),settings:z.array(z.enum(['community','facility'])).min(1).max(2).refine(unique),devices:z.array(z.literal('browser')).length(1),tasks:z.array(z.enum(['extract','summary'])).min(1).max(2).refine(unique),jurisdictions:z.array(z.literal('IN')).length(1).default(['IN']),connectivity:z.array(z.literal('online')).length(1).default(['online']),minimumInputQuality:z.literal('adequate').default('adequate'),excludedUses:text,supportContact:id,hostingRegion:id,retentionTerms:text,trainingUse:z.literal('not-authorised'),agreementReference:id,dailyCallLimit:z.number().int().min(1).max(100),dailyTokenBudget:z.number().int().min(6000).max(600000),
  // Slice 5e: optional task limits, bound into the manifest and reviewed with the revision.
  taskTimeLimitMinutes:z.number().int().min(1).max(240).optional(),taskAttemptLimit:z.number().int().min(1).max(5).optional(),registration:capabilityRegistrationDetails.optional()}).strict()
]);
export type GovernanceSpec=z.infer<typeof governanceSpec>;
export type GovernanceEntry={id:string;revision:number;version:number;spec:GovernanceSpec;manifestHash:string;createdBy:string;createdAt:string;replacesId?:string;replacedBy?:string;origin?:ProposalOrigin;state:'draft'|'reviewed'|'active'|'suspended'|'retired';review?:{by:string;memberVersion:number;ownerVersion:number;authorVersion:number;at:string;reference:string;findings:string;dependencyStamp:string;evaluationId?:string};history:{at:string;by:string;state:string;reason:string}[]};
export type ProtocolCheck={id:string;at:string;by:string;byVersion:number;visitVersion:number;personVersion:number;contextHash:string;protocols:{id:string;manifestHash:string;revision:number;title:string}[];findings:{entryId:string;ruleId:string;label:string;urgency:string;action:string;service:{id:string;title:string;contactRoute:string;location:string};evidence:string;sources:{title:string;url:string;edition:string;entryId?:string;document?:z.infer<typeof sourceDocumentRef>}[]}[];unknowns:string[];decision?:{by:string;at:string;decision:'accepted'|'rejected'|'override';reason:string;reference:string}};
export type SafetyCase={id:string;personId:string;visitId:string;ownerId:string;createdBy:string;createdAt:string;version:number;kind:string;summary:string;state:'open'|'closed';entryId?:string;evidence:{visitVersion:number;recordVersion:number;agentRuns:{id:string;provider:string;model:string;status:string}[];protocolCheckIds:string[]};resolution?:{by:string;at:string;reason:string;reference:string}};
export type Governance={entries:GovernanceEntry[];evaluations:Evaluation[];safety:SafetyCase[];sandbox?:ProviderSandbox;shadows?:Shadow[];deploymentAuthorisations?:DeploymentAuthorisationState};
export const governanceState=(s:OrgState)=>s.governance??{entries:[],evaluations:[],safety:[]};
export const governanceSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('createGovernance'),spec:governanceSpec,replacesId:id.optional()}).strict(),
 z.object({type:z.literal('reviewGovernance'),entryId:id,version,reference:id,findings:text,evaluationId:id.optional()}).strict(),
 z.object({type:z.literal('transitionGovernance'),entryId:id,version,state:z.enum(['active','suspended','retired']),reason:text}).strict(),
 z.object({type:z.literal('suspendCapabilitySafety'),entryId:id,version,ownerId:id,reason:text,lookbackDays:z.number().int().min(1).max(365).default(30)}).strict(),
 z.object({type:z.literal('checkProtocol'),visitId:id,version}).strict(),
 z.object({type:z.literal('saveClinicalConcern'),visitId:id,version,concern:z.enum(['yes','no','unknown']),reference:id}).strict(),
 z.object({type:z.literal('reviewProtocol'),visitId:id,version,checkId:id,decision:z.enum(['accepted','rejected','override']),reason:text,reference:id}).strict(),
 z.object({type:z.literal('createDirectoryReferral'),visitId:id,version,serviceId:id,serviceVersion:version,reason:text}).strict(),
 z.object({type:z.literal('reportSafety'),visitId:id,version,ownerId:id,kind:z.enum(['misleading-output','wrong-patient','missed-escalation','potential-harm']),summary:text,entryId:id.optional(),hold:z.boolean()}).strict(),
 z.object({type:z.literal('resolveSafety'),caseId:id,version,reason:text,reference:id}).strict(),
 z.object({type:z.literal('assignSafety'),caseId:id,version,ownerId:id,reason:text}).strict(),
 z.object({type:z.literal('reviewAgentResult'),visitId:id,runId:id,version,decision:z.enum(['accepted','rejected','override']),reason:text,reference:id}).strict(),
]);
export function entryFor(s:OrgState,id:string){const e=governanceState(s).entries.find(e=>e.id===id);if(!e)fail(404,'Review package not found.');return e;}
const member=(s:OrgState,id:string)=>s.members.find(m=>m.userId===id&&m.status==='active');
// Slice 5b: provider accounts author capability proposals in their sandbox only (authorizeSandbox).
export const governanceManager=(m:Member)=>m.isOwner||m.role==='clinician'||m.role==='admin'||m.role==='provider';
export function entryScope(m:Member,e:GovernanceEntry){return m.status==='active'&&(m.isOwner||m.role==='admin'||e.spec.teamIds.some(t=>m.teamIds.includes(t)));}
function dependencies(s:OrgState,e:GovernanceEntry){return e.spec.kind==='protocol'?[...e.spec.sourceIds,...new Set(e.spec.rules.map(r=>r.serviceId))].map(id=>entryFor(s,id)):[];}
function dependencyStamp(s:OrgState,e:GovernanceEntry){return JSON.stringify(dependencies(s,e).map(d=>({id:d.id,version:d.version,manifestHash:d.manifestHash})));}
export function entryIssues(s:OrgState,e:GovernanceEntry,now=new Date().toISOString()):string[]{
 const issues:string[]=[],today=now.slice(0,10),r=e.review,o=member(s,e.spec.ownerId),author=member(s,e.createdBy),reviewer=r?member(s,r.by):undefined;
 if(e.spec.kind==='source'&&e.spec.document?.expiresAt&&e.spec.document.expiresAt<=now)issues.push('Acquired source document expired');if(e.spec.effectiveFrom>today)issues.push('Not yet effective');if(e.spec.reviewBy<today)issues.push('Review date expired');
 if(!o||o.role!=='clinician'||!e.spec.teamIds.every(t=>o.teamIds.includes(t)))issues.push('Clinical owner unavailable');
 if(!r)issues.push('Independent clinical review required');else{
  if(!reviewer||reviewer.role!=='clinician'||reviewer.userId===e.createdBy||reviewer.version!==r.memberVersion||!e.spec.teamIds.every(t=>reviewer.teamIds.includes(t)))issues.push('Clinical reviewer authority changed');
  if(!author||author.version!==r.authorVersion||o?.version!==r.ownerVersion)issues.push('Accountable membership changed');
  if(r.dependencyStamp!==dependencyStamp(s,e))issues.push('Referenced source or service changed');
 }
 for(const d of dependencies(s,e))if(d.state!=='active'||entryIssues(s,d,now).length)issues.push('Referenced source or service is unavailable: '+d.spec.title);
 if(e.spec.kind==='capability'&&r){const ev=governanceState(s).evaluations.find(x=>x.id===r.evaluationId);if(!ev||ev.state!=='completed'||!ev.metrics?.passed||ev.manifestHash!==e.manifestHash)issues.push('Passing version-bound synthetic evaluation required');}
 return [...new Set(issues)];
}
export function activeEntry(s:OrgState,e:GovernanceEntry,now=new Date().toISOString()){return e.state==='active'&&!entryIssues(s,e,now).length;}
export function capabilityFor(s:OrgState,providerId:string){return governanceState(s).entries.filter(e=>e.spec.kind==='capability'&&e.spec.providerId===providerId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.revision-a.revision).find(e=>e.state==='active');}
export type CapabilityContext={language:string;setting:string;device:string;jurisdiction?:string;connectivity?:string;inputQuality?:'adequate'|'insufficient'|'unknown';intendedUse?:string};
export type CapabilityExclusion={code:'permission'|'availability'|'evidence'|'version'|'jurisdiction'|'role'|'intended-use'|'population'|'language'|'setting'|'device'|'task'|'connectivity'|'input-quality';detail:string};
export type CapabilityEligibility={eligible:boolean;providerId:string;governance:null|{id:string;version:number;manifestHash:string};exclusions:CapabilityExclusion[]};
/** Eligibility is resolved completely before cost or latency may rank a candidate. */
export function capabilityEligibility(s:OrgState,m:Member,p:Person,provider:AgentProvider,task:string,context:CapabilityContext,agentVersion:string):CapabilityEligibility{
 const registered=governanceState(s).entries.some(e=>e.spec.kind==='capability'&&e.spec.providerId===provider.id),exclusions:CapabilityExclusion[]=[];
 if(!provider.available)exclusions.push({code:'availability',detail:provider.reason});
 if(!p.aiConsent)exclusions.push({code:'permission',detail:'Current permission for AI assistance is required.'});
 if(!['asha','clinician'].includes(m.role))exclusions.push({code:'role',detail:'A current care role is required.'});
 if(provider.mode==='local'&&(!registered||task==='review'))return {eligible:exclusions.length===0,providerId:provider.id,governance:null,exclusions};
 const e=capabilityFor(s,provider.id);
 if(!e||e.spec.kind!=='capability'||!activeEntry(s,e))return {eligible:false,providerId:provider.id,governance:null,exclusions:[...exclusions,{code:'evidence',detail:'A current independent review and passing version-bound evaluation are required.'}]};
 const c=e.spec,governance={id:e.id,version:e.version,manifestHash:e.manifestHash};
 if(c.model!==provider.model||c.agentVersion!==agentVersion)exclusions.push({code:'version',detail:'The approved model or agent version changed.'});
 if(!(c.jurisdictions??['IN']).includes((context.jurisdiction??'IN') as 'IN'))exclusions.push({code:'jurisdiction',detail:'The declared jurisdiction is outside the approved capability scope.'});
 if(!(c.roles as readonly string[]).includes(m.role))exclusions.push({code:'role',detail:'The current role is outside the approved capability scope.'});
 if((context.intendedUse??'documentary-evidence')!==c.purpose)exclusions.push({code:'intended-use',detail:'The intended use is outside the approved capability scope.'});
 if(!c.teamIds.includes(p.teamId)||typeof p.age!=='number'||!Number.isFinite(p.age)||p.age<c.ageMin||p.age>c.ageMax)exclusions.push({code:'population',detail:'The person or population is outside the approved capability scope.'});
 if(!(c.languages as readonly string[]).includes(context.language))exclusions.push({code:'language',detail:'The requested language is outside the approved capability scope.'});
 if(!(c.settings as readonly string[]).includes(context.setting))exclusions.push({code:'setting',detail:'The care setting is outside the approved capability scope.'});
 if(!(c.devices as readonly string[]).includes(context.device))exclusions.push({code:'device',detail:'The device is outside the approved capability scope.'});
 if(!(c.tasks as readonly string[]).includes(task))exclusions.push({code:'task',detail:'The task is outside the approved capability scope.'});
 if(!(c.connectivity??['online']).includes((context.connectivity??'online') as 'online'))exclusions.push({code:'connectivity',detail:'The current connectivity is outside the approved capability scope.'});
 if((context.inputQuality??'adequate')!==(c.minimumInputQuality??'adequate'))exclusions.push({code:'input-quality',detail:'The input quality does not meet the approved capability minimum.'});
 return {eligible:exclusions.length===0,providerId:provider.id,governance,exclusions};
}
export function checkCapability(s:OrgState,m:Member,p:Person,provider:AgentProvider,task:string,context:CapabilityContext,agentVersion:string){
 const decision=capabilityEligibility(s,m,p,provider,task,context,agentVersion);if(decision.eligible)return decision.governance;
 const first=decision.exclusions[0];if(first.code==='evidence')fail(409,'This provider needs a current, independently reviewed capability and passing evaluation.');if(first.code==='version')fail(409,'The approved model or agent version changed.');
 fail(409,`This provider is outside the approved capability scope and ineligible before ranking (${decision.exclusions.map(x=>x.code).join(', ')}). ${decision.exclusions.map(x=>x.detail).join(' ')}`);
}
export function rankEligibleCapabilities<T extends {provider:AgentProvider;cost:number;latencyMs:number}>(s:OrgState,m:Member,p:Person,task:string,context:CapabilityContext,agentVersion:string,candidates:T[]){
 const evaluated=candidates.map(candidate=>({candidate,decision:capabilityEligibility(s,m,p,candidate.provider,task,context,agentVersion)}));
 return {eligible:evaluated.filter(x=>x.decision.eligible).sort((a,b)=>a.candidate.cost-b.candidate.cost||a.candidate.latencyMs-b.candidate.latencyMs),excluded:evaluated.filter(x=>!x.decision.eligible)};
}
export function checkCapabilityBudget(s:OrgState,e:GovernanceEntry,excludeRunId?:string,now=new Date().toISOString()){
 if(e.spec.kind!=='capability')return;const spec=e.spec;const rows=s.workspace.visits.flatMap(v=>v.agentRuns??[]).filter(r=>r.id!==excludeRunId&&r.provider.id===spec.providerId&&(r.callCount>0&&(r.startedAt??r.createdAt).slice(0,10)===now.slice(0,10)||r.status==='pending'&&r.expiresAt>=now));
 if(rows.length>=e.spec.dailyCallLimit||rows.reduce((n,r)=>n+(r.usage?r.usage.inputTokens+r.usage.outputTokens:6000),0)+6000>e.spec.dailyTokenBudget)fail(429,'This capability reached its daily call or reserved-token budget. Continue structured capture; no provider substitution was made.');
 checkMonthlyBudget(s,e,excludeRunId,now);
}
function clinical(s:OrgState,m:Member,p?:Person){if(m.role!=='clinician'||(p&&!allowed(m,p)))fail(403,'A clinician with current care scope is required.');}
export function authorizeGovernance(s:OrgState,m:Member,c:any){
 if(!governanceSchema.options.some(o=>o.shape.type.value===c.type))return;
 if(c.entryId&&['reviewGovernance','transitionGovernance','suspendCapabilitySafety'].includes(c.type)){const e=entryFor(s,c.entryId);if(!entryScope(m,e))fail(403,'This review package is outside your team scope.');}
 if(c.type==='createGovernance'){if(!governanceManager(m))fail(403,'Clinical or organisation management access is required.');}
 if(c.type==='reviewGovernance')clinical(s,m);
 if(c.type==='transitionGovernance'&&!m.isOwner)fail(403,'An organisation owner must change deployment status.');
 if(c.type==='suspendCapabilitySafety'&&!m.isOwner)fail(403,'An organisation owner must suspend a capability and assign its safety follow-up.');
 if(c.visitId){const v=visit(s.workspace,c.visitId);if(m.role==='admin')fail(403,'Patient access is required.');if(['saveClinicalConcern','checkProtocol','createDirectoryReferral','reviewAgentResult'].includes(c.type)&&!['asha','clinician'].includes(m.role))fail(403,'A care role is required.');if(c.type==='reviewProtocol'||c.type==='reportSafety'&&c.hold)clinical(s,m,person(s.workspace,v.personId));}
 if(c.caseId){const sc=governanceState(s).safety.find(x=>x.id===c.caseId);if(!sc)fail(404,'Safety case not found.');const p=person(s.workspace,sc.personId);clinical(s,m,p);if(c.type==='resolveSafety'&&sc.ownerId!==m.userId)fail(403,'Only the current clinical case owner may resolve it.');}
}
function ownPatient(s:OrgState,id:string,p:Person){const m=member(s,id);if(!m||m.role!=='clinician'||!normallyAllowed(m,p))fail(422,'Choose an active clinician with patient access.');return m;}
export async function protocolPreview(s:OrgState,m:Member,v:Visit,now=new Date().toISOString()){
 const p=person(s.workspace,v.personId),findings:ProtocolCheck['findings']=[],unknowns:string[]=[],protocols:ProtocolCheck['protocols']=[];
 for(const e of governanceState(s).entries){const c=e.spec;if(c.kind!=='protocol'||!activeEntry(s,e,now)||!c.teamIds.includes(p.teamId)||!c.roles.includes(m.role as any)||!p.programmes.includes(c.programme)||p.age<c.ageMin||p.age>c.ageMax)continue;
  protocols.push({id:e.id,manifestHash:e.manifestHash,revision:e.revision,title:c.title});
  for(const rule of c.rules){const f=rule.condition.field,raw=f==='workerConcern'?v.clinicalConcern?.value:v.facts[f],date=f==='workerConcern'?v.clinicalConcern?.at:(measureOf(f)?factProvenance(v.facts,measureOf(f)!).at:v.facts.date)+'Z',age=date?Date.parse(now)-Date.parse(date):NaN;
   const missing=!raw||raw==='unknown'||!Number.isFinite(age)||age< -300000||age>c.maxObservationAgeHours*3600000;
   if(missing){unknowns.push(rule.label+': current evidence required');if(rule.condition.operator!=='missing')continue;}
   const hit=rule.condition.operator==='missing'?missing:rule.condition.operator==='eq'?raw===rule.condition.value:rule.condition.operator==='gte'?Number(raw)>=Number(rule.condition.value):Number(raw)<=Number(rule.condition.value);
   if(!hit)continue;const service=entryFor(s,rule.serviceId);if(service.spec.kind!=='service')continue;
   findings.push({entryId:e.id,ruleId:rule.id,label:rule.label,urgency:rule.urgency,action:rule.action,service:{id:service.id,title:service.spec.title,contactRoute:service.spec.contactRoute,location:service.spec.location},evidence:missing?'Current input unavailable':`${f}: ${raw} · ${date}`,sources:c.sourceIds.map(id=>{const x=entryFor(s,id).spec;if(x.kind!=='source')fail(409,'Source kind changed.');return {title:x.title,url:x.url,edition:x.edition,...(x.document?{entryId:id,document:x.document}:{})};})});
  }
 }
 const contextHash=await digest({visitId:v.id,visitVersion:v.version,personId:p.id,personVersion:p.version,protocols,dependencies:protocols.map(e=>dependencyStamp(s,entryFor(s,e.id))),findings,unknowns});
 return {protocols,findings,unknowns,contextHash,visitVersion:v.version,personVersion:p.version};
}
function event(s:OrgState,u:Actor,m:Member,action:string,subject:string,detail:string,personId?:string){s.workspace.audit.push({id:uuid(),at:new Date().toISOString(),actorId:u.userId,actor:u.displayName,role:m.role,action,subject,detail,...(personId?{personId}:{})});}
export async function applyGovernance(s:OrgState,input:unknown,u:Actor,m:Member,now=new Date().toISOString()):Promise<any|null>{
 const parsed=governanceSchema.safeParse(input);if(!parsed.success)return null;const c=parsed.data;authorizeGovernance(s,m,c);s.governance??={entries:[],evaluations:[],safety:[]};const g=s.governance;
 if(c.type==='createGovernance'){
  const spec=c.spec;if(spec.effectiveFrom>spec.reviewBy)fail(422,'Review date must follow the effective date.');if(!spec.teamIds.every(t=>s.teams.some(x=>x.id===t)&&(m.isOwner||m.role==='admin'||m.teamIds.includes(t))))fail(403,'Choose teams within your management scope.');
  const owner=member(s,spec.ownerId);if(!owner||owner.role!=='clinician'||!spec.teamIds.every(t=>owner.teamIds.includes(t)))fail(422,'An active clinical owner must cover every selected team.');
  if('ageMin' in spec&&spec.ageMin>spec.ageMax)fail(422,'Age range is reversed.');
  if(spec.kind==='protocol'){if(new Set(spec.rules.map(r=>r.id)).size!==spec.rules.length)fail(422,'Rule identifiers must be unique.');for(const r of spec.rules){if(r.condition.field==='workerConcern'&&!['eq','missing'].includes(r.condition.operator))fail(422,'Concern uses a stated value or missing check.');if(r.condition.field==='workerConcern'&&r.condition.operator==='eq'&&!['yes','no'].includes(r.condition.value))fail(422,'Choose yes or no for concern.');if(r.condition.field!=='workerConcern'&&r.condition.operator!=='missing'&&!/^\d+(\.\d+)?$/.test(r.condition.value))fail(422,'Numeric conditions need a numeric value.');}
   for(const sid of spec.sourceIds){const d=entryFor(s,sid);if(d.spec.kind!=='source'||!activeEntry(s,d)||!spec.teamIds.every(t=>d.spec.teamIds.includes(t)))fail(409,'Every source must be current and cover the protocol teams.');}for(const r of spec.rules){const d=entryFor(s,r.serviceId);if(d.spec.kind!=='service'||!activeEntry(s,d)||!spec.teamIds.every(t=>d.spec.teamIds.includes(t)))fail(409,'Every referral service must be current and cover the protocol teams.');}
  }
  if(spec.kind==='service'&&(spec.verifiedOn>now.slice(0,10)||spec.verifiedOn>spec.reviewBy))fail(422,'Service verification cannot be in the future or after review expiry.');
  if(spec.kind==='capability'&&g.entries.some(e=>e.spec.kind==='capability'&&e.spec.providerId===spec.providerId&&e.spec.key!==spec.key))fail(409,'Use the existing provider package key and create a new revision.');
  const prior=c.replacesId?entryFor(s,c.replacesId):undefined;if(prior&&(prior.spec.key!==spec.key||prior.spec.kind!==spec.kind||!entryScope(m,prior)))fail(409,'A new revision must keep the same package key, kind and scope authority.');if(!prior&&g.entries.some(e=>e.spec.key===spec.key))fail(409,'Use a new revision for this existing package key.');if(prior&&g.entries.some(e=>e.replacesId===prior.id))fail(409,'A later revision already exists.');if(g.entries.length>=150)fail(422,'Review package limit reached; archive policy required.');
  const e:GovernanceEntry={id:uuid(),revision:(prior?.revision??0)+1,version:1,spec,manifestHash:await digest(spec),createdBy:u.userId,createdAt:now,state:'draft',...(prior?{replacesId:prior.id}:{}),history:[{at:now,by:u.userId,state:'draft',reason:spec.changeSummary}]};g.entries.push(e);event(s,u,m,c.type,e.id,'Immutable review package created: '+spec.kind+' '+spec.title);return {entryId:e.id};
 }
 if(c.type==='reviewGovernance'||c.type==='transitionGovernance'){
  const e=entryFor(s,c.entryId);if(e.version!==c.version)fail(409,'Review package changed. Refresh.');
  if(c.type==='reviewGovernance'){
   if(!['draft','suspended'].includes(e.state)||e.createdBy===u.userId)fail(403,'A different clinician must review this draft or suspended package.');if(!e.spec.teamIds.every(t=>m.teamIds.includes(t)))fail(403,'Reviewer must cover every selected team.');
   const author=member(s,e.createdBy),owner=member(s,e.spec.ownerId);if(!author||!owner)fail(409,'Author or clinical owner unavailable.');
   if(e.spec.kind==='capability'){const ev=g.evaluations.find(x=>x.id===c.evaluationId);if(!ev||ev.manifestHash!==e.manifestHash||ev.state!=='completed'||!ev.metrics?.passed)fail(409,'Run and review a passing synthetic evaluation for this exact manifest.');}
   e.review={by:u.userId,memberVersion:m.version,ownerVersion:owner.version,authorVersion:author.version,at:now,reference:c.reference,findings:c.findings,dependencyStamp:dependencyStamp(s,e),...(c.evaluationId?{evaluationId:c.evaluationId}:{})};e.state='reviewed';
  }else{
   if(e.state==='retired')fail(409,'Retired packages are immutable. Create a new revision.');
   if(c.state==='active'){if(e.state!=='reviewed')fail(409,'Independent review must precede activation.');const issues=entryIssues(s,e,now);if(issues.length)fail(409,issues.join('; '));for(const old of g.entries)if(old.id!==e.id&&old.spec.key===e.spec.key&&old.state==='active'){old.state='retired';old.replacedBy=e.id;old.version++;old.history.push({at:now,by:u.userId,state:'retired',reason:'Replaced by reviewed revision '+e.revision});}}
   e.state=c.state;
  }
  e.version++;e.history.push({at:now,by:u.userId,state:e.state,reason:c.type==='reviewGovernance'?c.findings:c.reason});
  // Slice 5d: stopping a capability names the in-progress work it leaves behind (all revisions it replaced stay separate).
  const impact=e.spec.kind==='capability'&&['suspended','retired'].includes(e.state)?capabilityImpact(s.workspace.visits,e).counts:undefined;
  event(s,u,m,c.type,e.id,'Review package '+e.state+'; synthetic use only.'+(impact?' In-progress work: '+impactSummary(impact)+'.':''));return {entryId:e.id,...(impact?{impact}:{})};
 }
 if(c.type==='suspendCapabilitySafety'){
  const e=entryFor(s,c.entryId);if(e.spec.kind!=='capability')fail(422,'Choose a named capability version.');if(e.version!==c.version)fail(409,'Review package changed. Refresh.');if(e.state==='retired')fail(409,'Retired packages are immutable.');
  const owner=member(s,c.ownerId);if(!owner||owner.role!=='clinician'||!e.spec.teamIds.every(t=>owner.teamIds.includes(t)))fail(422,'Choose an active clinician who covers the capability teams.');
  const affected=affectedCapabilityEncounters(s,e,now,c.lookbackDays),grouped=new Map<string,typeof affected>();for(const row of affected)grouped.set(row.visit.id,[...(grouped.get(row.visit.id)??[]),row]);
  e.state='suspended';e.version++;e.history.push({at:now,by:u.userId,state:'suspended',reason:c.reason});g.safetyFollowups??=[];
  const followupIds:string[]=[];for(const [visitId,rows] of grouped){for(const {run} of rows)if(run.status==='pending'){run.status='cancelled';run.finishedAt=now;run.message='Cancelled before dispatch because the exact capability version was suspended.';}
   const existing=g.safetyFollowups.find(x=>x.entryId===e.id&&x.visitId===visitId&&x.state==='open');if(existing)continue;const v=rows[0].visit,id=uuid();g.safetyFollowups.push({id,entryId:e.id,entryRevision:e.revision,visitId,personId:v.personId,runIds:rows.map(x=>x.run.id),ownerId:c.ownerId,state:'open',createdAt:now,createdBy:u.userId,reason:c.reason});followupIds.push(id);}
  event(s,u,m,c.type,e.id,`Named capability revision ${e.revision} suspended; ${affected.length} affected run(s), ${followupIds.length} accountable encounter follow-up(s), ${affected.filter(x=>x.run.status==='cancelled').length} unsent request(s) cancelled.`);return {entryId:e.id,revision:e.revision,affectedRuns:affected.length,followupIds,cancelledUnsent:affected.filter(x=>x.run.status==='cancelled').length};
 }
 if(c.type==='resolveSafety'||c.type==='assignSafety'){
  const sc=g.safety.find(x=>x.id===c.caseId)!;if(sc.version!==c.version||sc.state!=='open')fail(409,'Safety case changed or is closed.');const p=person(s.workspace,sc.personId);
  if(c.type==='assignSafety'){ownPatient(s,c.ownerId,p);sc.ownerId=c.ownerId;}else{sc.state='closed';sc.resolution={by:u.userId,at:now,reference:c.reference,reason:c.reason};}sc.version++;event(s,u,m,c.type,sc.id,c.reason,p.id);return {caseId:sc.id};
 }
 const v=visit(s.workspace,c.visitId),p=person(s.workspace,v.personId);if(v.version!==c.version)fail(409,'Visit changed. Refresh before reviewing.');
 if(c.type==='reportSafety'){
  let holdNote='';ownPatient(s,c.ownerId,p);if(c.hold&&!c.entryId)fail(422,'Select a capability or protocol to suspend.');if(g.safety.length>=200)fail(422,'Safety case limit reached.');if(c.entryId){const e=entryFor(s,c.entryId);if(!entryScope(m,e)||!e.spec.teamIds.includes(p.teamId))fail(403,'Capability or protocol is outside patient scope.');if(!['protocol','capability'].includes(e.spec.kind))fail(422,'Select a capability or protocol.');if(c.hold){if(e.state==='retired')fail(409,'Retired packages cannot be changed.');e.state='suspended';e.version++;e.history.push({at:now,by:u.userId,state:'suspended',reason:'Safety report: '+c.summary});if(e.spec.kind==='capability')holdNote=' Capability suspended; in-progress work: '+impactSummary(capabilityImpact(s.workspace.visits,e).counts)+'.';}}
  const sc:SafetyCase={id:uuid(),personId:p.id,visitId:v.id,ownerId:c.ownerId,createdBy:u.userId,createdAt:now,version:1,kind:c.kind,summary:c.summary,state:'open',...(c.entryId?{entryId:c.entryId}:{}),evidence:{visitVersion:v.version,recordVersion:v.recordVersion,agentRuns:(v.agentRuns??[]).map(r=>({id:r.id,provider:r.provider.name,model:r.provider.model,status:r.status})),protocolCheckIds:(v.protocolChecks??[]).map(r=>r.id)}};g.safety.push(sc);event(s,u,m,c.type,sc.id,'Clinical safety case opened; original version references preserved.'+holdNote,p.id);return {caseId:sc.id};
 }
 if(v.voidedAt||v.supersededBy)fail(409,'Use the current visit.');
 if(c.type==='saveClinicalConcern'){if(v.state!=='draft')fail(409,'Concerns can be captured in a current draft.');v.clinicalConcern={value:c.concern,reference:c.reference,by:u.userId,at:now};v.version++;}
 if(c.type==='checkProtocol'){if(p.identityReview?.state==='provisional')fail(409,'Resolve patient identity before a protocol review.');const preview=await protocolPreview(s,m,v,now);if(!preview.protocols.length)fail(409,'No current protocol covers this person and care role.');v.protocolChecks??=[];if(v.protocolChecks.length>=50)fail(422,'Protocol review limit reached.');const saved={id:uuid(),at:now,by:u.userId,byVersion:m.version,...preview};v.protocolChecks.push(saved);event(s,u,m,c.type,v.id,'Rule evaluation saved with exact source and service versions.',p.id);return {checkId:saved.id};}
 if(c.type==='reviewProtocol'){const check=v.protocolChecks?.find(x=>x.id===c.checkId);if(!check||check.decision)fail(409,'Choose an unreviewed rule evaluation.');const original=member(s,check.by);if(!original||original.version!==check.byVersion||!allowed(original,p))fail(409,'The evaluating worker authority changed. Save a new rule review.');const preview=await protocolPreview(s,original,v,now);if(preview.contextHash!==check.contextHash)fail(409,'Facts, permissions, sources or services changed. Run a fresh rule review.');check.decision={by:u.userId,at:now,decision:c.decision,reason:c.reason,reference:c.reference};}
 if(c.type==='createDirectoryReferral'){
  if(v.state!=='confirmed'||p.identityReview?.state==='provisional')fail(409,'A current confirmed visit and resolved identity are required.');const e=entryFor(s,c.serviceId);if(e.spec.kind!=='service'||e.version!==c.serviceVersion||!activeEntry(s,e,now)||!e.spec.teamIds.includes(p.teamId))fail(409,'The selected service is stale or unavailable. Ask the supervisor for a verified alternative.');const r={id:uuid(),personId:p.id,visitId:v.id,facility:e.spec.title,reason:c.reason,state:'draft' as const,version:1,createdAt:now,directory:{entryId:e.id,manifestHash:e.manifestHash,revision:e.revision,contactRoute:e.spec.contactRoute,location:e.spec.location,verifiedOn:e.spec.verifiedOn,reviewBy:e.spec.reviewBy}};s.workspace.referrals.push(r);event(s,u,m,c.type,r.id,'Referral prepared from reviewed directory; no facility contacted.',p.id);return {referralId:r.id};
 }
 if(c.type==='reviewAgentResult'){const r=v.agentRuns?.find(r=>r.id===c.runId);if(!r||!['review','applied'].includes(r.status)||r.reviewDecision)fail(409,'Choose a result awaiting a human decision.');if(c.decision==='override')clinical(s,m,p);r.reviewDecision={by:u.userId,at:now,decision:c.decision,reason:c.reason,reference:c.reference};if(c.decision!=='accepted'&&r.status==='review')r.status='cancelled';}
 event(s,u,m,c.type,v.id,'Human action and evidence reference recorded; source results retained.',p.id);return {ok:true};
}
