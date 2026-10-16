import { z } from 'zod';
import { digest, fail, person, uuid, visit } from './core';
import { PROGRAMMES, currentIdentifiers, type Integration, type Member, type OrgState, type Submission, type TraceRef, type Visit } from './types';
import type { Actor } from './store';
export const MIS_FIELDS=['terminologyCode','weightSource','weightObservedAt','weightUnit','temperatureSource','temperatureObservedAt','temperatureUnit','systolicSource','systolicObservedAt','systolicUnit','diastolicSource','diastolicObservedAt','diastolicUnit','weeksSource','weeksObservedAt','weeksUnit','coughDaysSource','coughDaysObservedAt','coughDaysUnit','personId','visitId','date','source','systolic','diastolic','weight','temperature','weeks','coughDays','notes'] as const;
export type Mapping={source:typeof MIS_FIELDS[number];target:string;required:boolean;transformation?:'identity'|'kg-to-g'|'kg-to-lb'|'celsius-to-fahrenheit'|'weeks-to-days';unit?:'none'|'kg'|'g'|'lb'|'mmHg'|'°C'|'°F'|'weeks'|'days';nullSemantics?:'omit'|'empty'|'null'|'response-state'};
export type MisConfig={contract:'saha-mis-v1';mapping:Mapping[];corrections:boolean;lifecycle?:MappingLifecycle;conformance?:MappingConformance;terminology?:Terminology[];test?:{at:string;version:number;ok:boolean;message:string}};
export type Delivery={mappingRevision?:{id:string;hash:string};endpoint:string;credentialBinding:string;key:string;actorId:string;connectorVersion:number;personVersion:number;consentVersion:number;visitVersion:number;expiresAt:string;payload:Record<string,unknown>;startedAt?:string;operationId?:string;events:{at:string;state:string;detail:string;attempt?:number;ref?:TraceRef}[]};
export const MIS_FIELDS=['personId','visitId','date','source','systolic','diastolic','weight','temperature','weeks','coughDays','notes'] as const;
export type Mapping={source:typeof MIS_FIELDS[number];target:string;required:boolean};
export type ConnectorUpgrade={id:string;fromVersion:number;state:'staged'|'blocked'|'approved'|'rejected'|'activated';mapping:Mapping[];programmes:string[];corrections:boolean;reason:string;issues:string[];queued:string[];inFlight:string[];historical:number;stagedAt:string;stagedBy:string;reviewedAt?:string;reviewedBy?:string;evidence?:string;activatedAt?:string};
export type MisConfig={contract:'saha-mis-v1';mapping:Mapping[];corrections:boolean;test?:{at:string;version:number;ok:boolean;message:string};compatibleVersions?:number[];upgrade?:ConnectorUpgrade};
export type Delivery={endpoint:string;credentialBinding:string;key:string;actorId:string;connectorVersion:number;personVersion:number;consentVersion:number;visitVersion:number;expiresAt:string;payload:Record<string,unknown>;startedAt?:string;operationId?:string;events:{at:string;state:string;detail:string;attempt?:number;ref?:TraceRef}[]};
const id=z.string().min(1).max(200),ver=z.number().int().positive();
export const mappingSchema=z.array(z.object({source:z.enum(MIS_FIELDS),target:z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,63}$/).refine(s=>!['constructor','prototype','__proto__'].includes(s),'Reserved destination field'),required:z.boolean(),transformation:z.enum(['identity','kg-to-g','kg-to-lb','celsius-to-fahrenheit','weeks-to-days']).optional(),unit:z.enum(['none','kg','g','lb','mmHg','°C','°F','weeks','days']).optional(),nullSemantics:z.enum(['omit','empty','null','response-state']).optional()}).strict()).min(1).max(20).refine(rows=>new Set(rows.map(r=>r.target)).size===rows.length,'Destination fields must be unique');
const mappingSourceSchema=z.object({reference:z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/),version:z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/)}).strict();
const terminologySchema=z.array(z.object({target:z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,63}$/),system:z.enum(['partner-local','LOINC']),code:z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/).optional(),status:z.enum(['active','unmapped','deprecated','ambiguous']),replacement:z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/).optional()}).strict()).max(20).refine(xs=>new Set(xs.map(x=>x.target)).size===xs.length,'Terminology targets must be unique');
export type Terminology=z.infer<typeof terminologySchema>[number];
const fixtureFields=z.record(z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,63}$/),z.union([z.string().max(300),z.null()])).refine(x=>Object.keys(x).length<=20,'At most 20 fixture fields');
const fixtureValues=z.record(z.enum(MIS_FIELDS),z.string().max(300)).refine(x=>Object.keys(x).length<=30,'At most 30 fixture inputs');
const fixtureSchema=z.discriminatedUnion('outcome',[
 z.object({name:z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._ -]{0,63}$/),values:fixtureValues,outcome:z.literal('mapped'),expected:fixtureFields}).strict(),
 z.object({name:z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._ -]{0,63}$/),values:fixtureValues,outcome:z.literal('rejected')}).strict(),
]);
const targetList=z.array(z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,63}$/)).max(20).refine(x=>new Set(x).size===x.length,'Targets must be unique');
export const mappingConformanceSchema=z.object({source:mappingSourceSchema,rulesVersion:z.literal('saha-deterministic-mapping-v1'),requiredTargets:targetList,codeTargets:targetList,fixtures:z.array(fixtureSchema).min(1).max(20).refine(x=>new Set(x.map(f=>f.name)).size===x.length,'Fixture names must be unique')}).strict();
export type MappingConformance=z.infer<typeof mappingConformanceSchema>;
export type MappingFieldImpact={target:string;source:Mapping['source'];unsent:number;changed:number;unmappable:number;pendingPlans:number;changedPlans:number;terminology:string};
export type MappingConformanceResult={hash:string;passed:number;failed:number;uncovered:string[];results:{name:string;passed:boolean}[]};
const lifecycleCommand={integrationId:id,version:ver,lifecycleVersion:z.number().int().min(0)},effectiveAt=z.string().datetime({offset:false}).refine(x=>new Date(x).toISOString()===x,'Use a canonical UTC date and time, including milliseconds');
export const MAPPING_COMMANDS=['draftMisMapping','impactMisMapping','reviewMisMapping','applyMisMapping','cancelMisMapping','rollbackMisMapping'] as const;
export const misSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('draftMisMapping'),...lifecycleCommand,mapping:mappingSchema,programmes:z.array(z.enum(PROGRAMMES as [string,...string[]])).min(1).max(5),corrections:z.boolean(),source:mappingSourceSchema,terminology:terminologySchema,conformance:mappingConformanceSchema.optional(),effectiveAt}).strict(),
 z.object({type:z.literal('rollbackMisMapping'),...lifecycleCommand,revisionId:id,effectiveAt}).strict(),
 z.object({type:z.literal('impactMisMapping'),...lifecycleCommand,revisionId:id}).strict(),
 z.object({type:z.literal('reviewMisMapping'),...lifecycleCommand,revisionId:id,impactHash:z.string().regex(/^[a-f0-9]{64}$/)}).strict(),
 z.object({type:z.literal('applyMisMapping'),...lifecycleCommand,revisionId:id,impactHash:z.string().regex(/^[a-f0-9]{64}$/)}).strict(),
 z.object({type:z.literal('cancelMisMapping'),...lifecycleCommand,revisionId:id}).strict(),

 z.object({type:z.literal('configureMis'),integrationId:id,version:ver,programmes:z.array(z.enum(PROGRAMMES as [string,...string[]])).min(1).max(5),mapping:mappingSchema,corrections:z.boolean()}).strict(),
 z.object({type:z.literal('testMis'),integrationId:id,version:ver}).strict(),
 z.object({type:z.literal('activateMis'),integrationId:id,version:ver}).strict(),
 z.object({type:z.literal('stageMisUpgrade'),integrationId:id,version:ver,programmes:z.array(z.enum(PROGRAMMES as [string,...string[]])).min(1).max(5),mapping:mappingSchema,corrections:z.boolean(),reason:z.string().trim().min(10).max(1000)}).strict(),
 z.object({type:z.literal('reviewMisUpgrade'),integrationId:id,version:ver,upgradeId:id,decision:z.enum(['approve','reject']),evidence:z.string().trim().min(10).max(1000)}).strict(),
 z.object({type:z.literal('activateMisUpgrade'),integrationId:id,version:ver,upgradeId:id}).strict(),
 z.object({type:z.literal('sendSubmission'),submissionId:id}).strict(),
 z.object({type:z.literal('lookupSubmission'),submissionId:id}).strict(),
 z.object({type:z.literal('cancelSubmission'),submissionId:id}).strict(),
]);
export type MisCommand=z.infer<typeof misSchema>;
export function misAudit(s:OrgState,u:Actor,m:Member,action:string,subject:string,detail:string,personId?:string){s.workspace.audit.push({id:uuid(),at:new Date().toISOString(),actor:u.displayName,actorId:u.userId,role:m.role,action,subject,detail,personId});}
export function misIntegration(s:OrgState,id:string){const i=s.workspace.integrations.find(i=>i.id===id);if(!i||i.kind!=='mis'||i.mode!=='http')fail(422,'Choose an HTTP programme connection.');return i;}
export function misCredential(i:Integration,orgId:string,env:Record<string,string|undefined>,callback=false){
 if(env.SAHA_EXTERNAL_APIS_ENABLED!=='true')fail(409,'External programme services are disabled.');
 if(!i.endpoint||!i.credentialBinding||!/^SAHA_MIS_[A-Z0-9_]+$/.test(i.credentialBinding))fail(409,'Use a dedicated SAHA_MIS_ server secret binding.');
 const url=new URL(i.endpoint);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.hostname==='localhost'||/^[\d.]+$/.test(url.hostname)||url.hostname.includes(':')||url.hostname.endsWith('.local'))fail(403,'Choose an approved public HTTPS programme origin.');
 let grants:any[]=[];try{grants=JSON.parse(env.SAHA_MIS_CONNECTIONS??'[]');}catch{fail(409,'Server programme grants are invalid.');}
 if(!Array.isArray(grants))fail(409,'Server programme grants are invalid.');
 const grant=grants.find(g=>g.organisationId===orgId&&g.integrationId===i.id&&g.origin===url.origin&&g.credentialBinding===i.credentialBinding);
 if(!grant)fail(403,'This organisation and connection have no server-approved programme grant.');
 const binding=callback?grant.callbackBinding:i.credentialBinding;if(typeof binding!=='string'||!/^SAHA_MIS_[A-Z0-9_]+$/.test(binding)||!env[binding])fail(409,'The dedicated programme credential is not configured.');return env[binding]!;
}
export function misReadiness(i:Integration,orgId:string,env:Record<string,string|undefined>){try{misCredential(i,orgId,env);return {id:i.id,ready:true,message:'Server grant and credential configured.'};}catch(e){return {id:i.id,ready:false,message:e instanceof Error?e.message:'Connection unavailable.'};}}
// This destination is authorized for one subject, not unrelated known patient identities in free-text notes.
export function assertMisPatientNotes(s:OrgState,v:Visit,i:Integration,payload:any){const subjects=s.workspace.people??[],p=subjects.find(p=>p.id===v.personId);if(!p)return;const normalize=(x:string)=>x.normalize('NFKC').replace(/[\u200B-\u200D\u2060\uFEFF]/g,'').replace(/\s+/g,' ').trim().toLowerCase(),values=(p:any)=>[p.id,p.name,p.village,p.abha?.number,p.abha?.number?.replace(/-/g,''),p.abha?.address,...currentIdentifiers(p).map(x=>x.value)].filter(x=>typeof x==='string'&&x.trim().length>=3).map(normalize),own=new Set([...values(p),...(s.members??[]).map(m=>normalize(m.displayName??''))]),others=new Set(subjects.filter(x=>x.id!==p.id).flatMap(values).filter(x=>!own.has(x)));const contains=(text:string,value:string)=>{let start=0;for(;;){const n=text.indexOf(value,start);if(n<0)return false;if(!/[\p{L}\p{N}]/u.test(text[n-1]??'')&&!/[\p{L}\p{N}]/u.test(text[n+value.length]??''))return true;start=n+1;}};for(const map of i.mis?.mapping??[]){if(map.source!=='notes')continue;const text=payload.fields?.[map.target];if(typeof text==='string'&&[...others].some(x=>!/^\d{1,7}$/.test(x)&&contains(normalize(text),x)))fail(409,'Mapped notes contain another known patient identity. Review the patient-specific note before approving delivery; nothing was sent.');}}
export function mappedPayload(i:Integration,v:Visit,s:OrgState){
 if(!i.mis)fail(409,'Configure and test the programme mapping first.');assertMappingEffective(i);const fields=projectMapping(i.mis.mapping,source=>mappingValue(v,source),i.mis.terminology??[],i.mis.conformance);
 let prior:Submission|undefined,ancestor=v.amendsVisitId;const seen=new Set<string>();
 while(ancestor){if(seen.has(ancestor))fail(409,'Correction history is inconsistent.');seen.add(ancestor);const deliveries=s.workspace.submissions.filter(x=>x.visitId===ancestor&&x.connectorId===i.id);if(deliveries.some(x=>['sending','uncertain','queued','retryable'].includes(x.state)))fail(409,'Resolve the original submission before sending its correction.');prior=deliveries.find(x=>x.state==='accepted');if(prior)break;ancestor=s.workspace.visits.find(x=>x.id===ancestor)?.amendsVisitId;}
 if(prior&&!i.mis.corrections)fail(409,'This destination has not enabled correction support.');
 const payload={contract:'saha-mis-v1',environment:'synthetic',operation:prior?'correct':'submit',fields,...(prior?{replaces:{submissionKey:prior.delivery?.key,receipt:prior.receipt}}:{})};assertMisPatientNotes(s,v,i,payload);return payload;
}
export function deliveryEvent(s:Submission,detail:string){s.updatedAt=new Date().toISOString();s.message=detail;s.delivery?.events.push({at:s.updatedAt,state:s.state,detail});}
export async function configureMis(s:OrgState,c:MisCommand,u:Actor,m:Member,env:Record<string,string|undefined>){
 if(c.type==='cancelSubmission'){const sub=s.workspace.submissions.find(x=>x.id===c.submissionId);if(!sub?.delivery)fail(404,'Programme delivery not found.');person(s.workspace,sub.personId);if(!['asha','clinician'].includes(m.role))fail(403,'A care role is required.');if(!['queued','retryable'].includes(sub.state))fail(409,'Only a confirmed unsent delivery can be cancelled. Look up uncertain receipts first.');sub.state='cancelled';deliveryEvent(sub,'Unsent delivery cancelled. No record was recalled.');misAudit(s,u,m,c.type,sub.id,sub.message,sub.personId);return {ok:true};}
 if(!['configureMis','activateMis',...MAPPING_COMMANDS].includes(c.type))return null;
 if(!m.isOwner)fail(403,'Only an organisation owner can configure programme delivery.');
 if(!('integrationId' in c))return null;const i=misIntegration(s,c.integrationId);if(i.version!==c.version)fail(409,'Connection changed. Refresh first.');
 if((MAPPING_COMMANDS as readonly string[]).includes(c.type))return applyMappingLifecycle(s,i,c as any,u,m);
 if(c.type==='configureMis'){if(c.mapping.some(x=>x.transformation||x.unit||x.nullSemantics||x.source==='terminologyCode'))fail(422,'Explicit mapping semantics require a reviewed conformance contract.');if(i.mis?.lifecycle)fail(409,'This connection uses reviewed mapping revisions. Draft a revision instead.');i.mis={contract:'saha-mis-v1',mapping:c.mapping,corrections:c.corrections};i.programmes=c.programmes as any;i.status='suspended';i.version++;}
 else if(c.type==='activateMis'){assertMappingEffective(i);misCredential(i,s.organisation.id,env);if(!i.mis?.test?.ok||i.mis.test.version!==i.version||Date.parse(i.mis.test.at)<Date.now()-86400000)fail(409,'Pass a connection test for this version within 24 hours before activation.');i.status='active';i.version++;i.mis.test.version=i.version;}
 if(!['configureMis','activateMis','stageMisUpgrade','reviewMisUpgrade','activateMisUpgrade'].includes(c.type))return null;
 if(!m.isOwner)fail(403,'Only an organisation owner can configure programme delivery.');
 if(!('integrationId' in c))return null;const i=misIntegration(s,c.integrationId);if(i.version!==c.version)fail(409,'Connection changed. Refresh first.');
 if(c.type==='configureMis'){i.mis={contract:'saha-mis-v1',mapping:c.mapping,corrections:c.corrections};i.programmes=c.programmes as any;i.status='suspended';i.version++;}
 else if(c.type==='activateMis'){misCredential(i,s.organisation.id,env);if(!i.mis?.test?.ok||i.mis.test.version!==i.version||Date.parse(i.mis.test.at)<Date.now()-86400000)fail(409,'Pass a connection test for this version within 24 hours before activation.');i.status='active';i.version++;i.mis.test.version=i.version;}
 else if(c.type==='stageMisUpgrade'){
  if(!i.mis)fail(409,'Configure the current mapping before staging an upgrade.');
  const old=i.mis.mapping,issues:string[]=[];
  for(const row of old){const next=c.mapping.find(x=>x.target===row.target);if(!next)issues.push(`Existing destination field ${row.target} was removed.`);else if(next.source!==row.source||next.required!==row.required)issues.push(`Existing destination field ${row.target} changed meaning or requirement.`);}
  for(const row of c.mapping)if(row.required&&!old.some(x=>x.target===row.target))issues.push(`New mandatory destination field ${row.target} has no value in queued payloads.`);
  const pending=s.workspace.submissions.filter(x=>x.connectorId===i.id&&x.delivery?.connectorVersion===i.version&&['queued','retryable'].includes(x.state)).map(x=>x.id);
  const inFlight=s.workspace.submissions.filter(x=>x.connectorId===i.id&&x.delivery?.connectorVersion===i.version&&['sending','uncertain'].includes(x.state)).map(x=>x.id);
  i.mis.upgrade={id:uuid(),fromVersion:i.version,state:issues.length?'blocked':'staged',mapping:c.mapping,programmes:c.programmes,corrections:c.corrections,reason:c.reason,issues,queued:pending,inFlight,historical:s.workspace.submissions.filter(x=>x.connectorId===i.id&&['accepted','rejected','cancelled'].includes(x.state)).length,stagedAt:new Date().toISOString(),stagedBy:u.userId};
  misAudit(s,u,m,c.type,i.id,issues.length?`Connector upgrade blocked with ${issues.length} compatibility issue(s); ${pending.length} queued and ${inFlight.length} in-flight item(s) preserved on version ${i.version}.`:`Compatible connector upgrade staged; ${pending.length} queued and ${inFlight.length} in-flight item(s) remain pinned to version ${i.version}.`);return {ok:true,upgradeId:i.mis.upgrade.id,state:i.mis.upgrade.state,issues};
 }
 else if(c.type==='reviewMisUpgrade'){
  const x=i.mis?.upgrade;if(!x||x.id!==c.upgradeId||x.fromVersion!==i.version)fail(409,'The staged upgrade is no longer current.');if(x.reviewedAt)fail(409,'This upgrade was already reviewed.');
  if(c.decision==='approve'){if(x.issues.length)fail(409,'A breaking upgrade cannot be approved. Correct the mapping or keep the current version.');x.state='approved';}else x.state='rejected';
  x.reviewedAt=new Date().toISOString();x.reviewedBy=u.userId;x.evidence=c.evidence;misAudit(s,u,m,c.type,i.id,`Connector upgrade ${x.state}; current version ${i.version} and all queued, in-flight and historical records remain unchanged.`);return {ok:true,state:x.state};
 }
 else if(c.type==='activateMisUpgrade'){
  const config=i.mis,x=config?.upgrade;if(!config||!x||x.id!==c.upgradeId||x.fromVersion!==i.version||x.state!=='approved')fail(409,'Approve the current compatible upgrade before activation.');
  const old=i.version;config.mapping=x.mapping;config.corrections=x.corrections;config.compatibleVersions=[...new Set([...(config.compatibleVersions??[]),old])];i.programmes=x.programmes as any;i.version++;config.test=undefined;x.state='activated';x.activatedAt=new Date().toISOString();
  misAudit(s,u,m,c.type,i.id,`Compatible connector upgrade activated as version ${i.version}; unresolved version ${old} work stays pinned and may finish without reinterpretation. A fresh connection test is required for new work.`);return {ok:true,version:i.version};
 }
 misAudit(s,u,m,c.type,i.id,c.type==='configureMis'?'Programme mapping saved; connection suspended and older approvals invalidated.':'Tested programme connection activated.');return {ok:true};
}
export function deliveryCurrent(s:OrgState,sub:Submission,u:Actor,m:Member,env:Record<string,string|undefined>){
 if(!['asha','clinician'].includes(m.role))fail(403,'A care role is required to send records.');const p=person(s.workspace,sub.personId),v=visit(s.workspace,sub.visitId),d=sub.delivery!;
 if(!p.exchangeConsent||p.consentVersion!==d.consentVersion||p.version!==d.personVersion||v.version!==d.visitVersion||v.state!=='confirmed'||v.voidedAt||v.supersededBy)fail(409,'Record or sharing permission changed. Cancel this unsent delivery and review a fresh plan.');
 if(d.actorId!==u.userId||d.expiresAt<new Date().toISOString())fail(409,'The original approving worker must send within the approval window. Cancel unsent delivery and prepare a fresh plan.');
 const i=misIntegration(s,sub.connectorId);assertMappingEffective(i);if(i.status!=='active'||i.version!==d.connectorVersion)fail(409,'Connection changed. Review a fresh plan.');misCredential(i,s.organisation.id,env);return i;
 const i=misIntegration(s,sub.connectorId);if(i.status!=='active'||(i.version!==d.connectorVersion&&!i.mis?.compatibleVersions?.includes(d.connectorVersion)))fail(409,'Connection changed. Review a fresh plan.');misCredential(i,s.organisation.id,env);return i;
}
export const receiptSchema=z.object({contract:z.literal('saha-mis-v1'),key:id,payloadHash:z.string().regex(/^[a-f0-9]{64}$/),status:z.enum(['accepted','rejected','pending','not_found']),receipt:z.string().min(1).max(200).optional(),error:z.string().trim().min(1).max(1000).optional()}).strict();
export function applyReceipt(sub:Submission,raw:unknown,lookup=false){const p=receiptSchema.safeParse(raw);if(!p.success)fail(502,'Programme response did not match the receipt contract.');const r=p.data;if(r.key!==sub.delivery?.key||r.payloadHash!==sub.payloadHash)fail(502,'Programme receipt did not match this delivery.');if(r.status==='accepted'&&!r.receipt)fail(502,'Accepted responses require a destination receipt.');if(r.status==='not_found'&&!lookup)fail(502,'Only a receipt lookup can confirm that a record was not found.');
 if(['accepted','rejected'].includes(sub.state)){if(sub.state!==r.status||(r.status==='accepted'&&sub.receipt!==r.receipt))fail(409,'A conflicting terminal receipt requires partner investigation.');return;}
 if(sub.state==='cancelled'||!sub.attempts)fail(409,'This submission has not been sent.');
 sub.state=r.status==='accepted'?'accepted':r.status==='rejected'?'rejected':r.status==='not_found'?'retryable':'uncertain';if(r.receipt)sub.receipt=r.receipt;const error=r.error??(r.status==='rejected'?'Destination rejected the submitted record.':r.status==='pending'?'Destination has not confirmed a final outcome.':undefined);if(r.status!=='not_found')sub.destinationOutcome={status:r.status==='accepted'?'accepted':r.status==='rejected'?'rejected':'uncertain',at:new Date().toISOString(),...(r.receipt?{receipt:r.receipt}:{}),...(error?{error}:{})};deliveryEvent(sub,r.status==='accepted'?'Programme confirmed acceptance.':r.status==='rejected'?`Programme rejected this payload${r.error?`: ${r.error}`:'.'} Correct the visit and review a new plan.`:r.status==='not_found'?'Programme confirmed no record for this key. A retry reuses the same payload and key.':'Programme is still processing. Look up the receipt; do not resend.');
}
const wireKey=z.string().min(1).max(200),wireHash=z.string().regex(/^[a-f0-9]{64}$/),wireCommon={contract:z.literal('saha-mis-v1')};
const misWireSchema=z.discriminatedUnion('operation',[
 z.object({...wireCommon,operation:z.literal('probe'),environment:z.literal('synthetic'),required:z.object({idempotency:z.literal(true),lookup:z.literal(true),corrections:z.boolean()}).strict()}).strict(),
 z.object({...wireCommon,operation:z.literal('lookup'),key:wireKey,payloadHash:wireHash}).strict(),
 z.object({...wireCommon,operation:z.literal('submit'),environment:z.literal('synthetic'),fields:z.record(z.union([z.string().max(4000),z.null()])),key:wireKey,payloadHash:wireHash}).strict(),
 z.object({...wireCommon,operation:z.literal('correct'),environment:z.literal('synthetic'),fields:z.record(z.union([z.string().max(4000),z.null()])),replaces:z.object({submissionKey:wireKey,receipt:wireKey}).strict(),key:wireKey,payloadHash:wireHash}).strict()
]);
export async function assertMisEnvelope(i:Integration,body:unknown,key:string){const parsed=misWireSchema.safeParse(body);if(!parsed.success)fail(409,'Programme envelope differs from its approved contract. Review or cancel unsent delivery and prepare a fresh plan; nothing was sent.');const b=parsed.data;if(b.operation==='lookup')return;if(b.operation==='probe'){if(b.required.corrections!==!!i.mis?.corrections)fail(409,'Programme probe configuration changed.');return;}assertMappingEffective(i);if(!i.mis||b.key!==key||b.operation==='correct'&&!i.mis.corrections)fail(409,'Programme envelope approval changed; review before sending.');const targets=new Set(i.mis.mapping.map(m=>m.target));if(Object.keys(b.fields).some(k=>!targets.has(k))||i.mis.mapping.some(m=>m.required&&!b.fields[m.target]))fail(409,'Programme fields differ from the approved mapping; review or cancel unsent delivery and prepare a fresh plan.');for(const row of i.mis.mapping){const value=b.fields[row.target],term=i.mis.terminology?.find(t=>t.target===row.target);if(value===null&&row.nullSemantics!=='null'||value===''&&row.nullSemantics!=='empty')fail(409,'Programme missing-value semantics differ from the approved mapping.');if(row.source==='terminologyCode'&&(term?.status==='deprecated'||term?.status==='ambiguous'||value!==(term?.status==='unmapped'?'unmapped':term?.code)))fail(409,'Programme terminology differs from the approved explicit mapping.');}const {key:bodyKey,payloadHash,...payload}=body as any;if(await digest(payload)!==payloadHash)fail(409,'Programme envelope differs from its approved digest; review before sending.');}
export async function misRequest(i:Integration,orgId:string,env:Record<string,string|undefined>,body:unknown,key:string,send:typeof fetch=fetch){
 const secret=misCredential(i,orgId,env);await assertMisEnvelope(i,body,key);const timeout=AbortSignal.timeout(15000);
 const response=await send(i.endpoint!,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${secret}`,'Idempotency-Key':key},body:JSON.stringify(body),redirect:'manual',signal:timeout});
 if(!response.ok)fail(502,`Programme returned HTTP ${response.status}. Receipt is unconfirmed.`);
 const reader=response.body?.getReader();if(!reader)fail(502,'Empty programme response.');let size=0;const chunks:Uint8Array[]=[];
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>16000){await reader.cancel();fail(502,'Programme response exceeded its size limit.');}chunks.push(value);}
 const bytes=new Uint8Array(size);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}try{return JSON.parse(new TextDecoder().decode(bytes));}catch{fail(502,'Programme returned invalid JSON.');}
}

// B07: manifests are append-only. Mutable pointers/events never rewrite a reviewed mapping or a delivery body.
export type MappingManifest={mapping:Mapping[];programmes:string[];corrections:boolean;source:{reference:string;version:string};terminology:z.infer<typeof terminologySchema>;effectiveAt:string;conformance?:MappingConformance;rollbackOf?:string};
export type MappingRevision={id:string;hash:string;manifest:MappingManifest;createdAt:string;by:string;baseline?:boolean};
export type MappingImpact={unsent:number;changed:number;unmappable:number;pendingPlans:number;changedPlans:number;lookupOnly:number;terminalPreserved:number;deprecated:number;ambiguous:number};
export type MappingLifecycle={version:number;currentId:string;pendingId?:string;revisions:MappingRevision[];events:{action:'draft'|'impact'|'review'|'apply'|'cancel';revisionId:string;at:string;by:string;impactHash?:string;counts?:MappingImpact;fields?:MappingFieldImpact[];conformanceHash?:string;conformance?:MappingConformanceResult;connectorVersion?:number}[]};
const canonicalUnits:Partial<Record<Mapping['source'],string>>={weight:'kg',temperature:'°C',systolic:'mmHg',diastolic:'mmHg',weeks:'weeks',coughDays:'days'};
const conversionRules={
 'kg-to-g':{source:'weight',unit:'g',convert:(n:number)=>n*1000},
 'kg-to-lb':{source:'weight',unit:'lb',convert:(n:number)=>n/0.45359237},
 'celsius-to-fahrenheit':{source:'temperature',unit:'°F',convert:(n:number)=>n*9/5+32},
 'weeks-to-days':{source:'weeks',unit:'days',convert:(n:number)=>n*7},
} as const;
function assertMappingRule(row:Mapping){
 const rule=row.transformation??'identity';
 if(rule==='identity'){if(row.unit&&row.unit!==(canonicalUnits[row.source]??'none'))fail(422,`Identity mapping ${row.target} has incompatible destination units.`);}
 else {const conversion=conversionRules[rule];if(!conversion||conversion.source!==row.source||conversion.unit!==row.unit)fail(422,`Unsupported conversion or units for ${row.target}.`);}
}
export function validateMappingManifest(manifest:MappingManifest,current?:MappingConformance,currentSemantics?:{mapping:Mapping[];terminology:Terminology[]}){
 const contract=manifest.conformance,extended=manifest.mapping.some(x=>x.transformation||x.unit||x.nullSemantics||x.source==='terminologyCode')||manifest.terminology.some(t=>t.status==='unmapped');
 if((extended||current)&&!contract)fail(422,'Explicit mapping semantics and governed connections require a source-versioned conformance contract.');
 for(const row of manifest.mapping)assertMappingRule(row);
 for(const term of manifest.terminology){if(term.status==='active'&&!term.code)fail(422,'An active terminology declaration needs an explicit code.');if(term.status==='unmapped'&&(term.code||term.replacement))fail(422,'Unmapped terminology cannot name a code or implicit replacement.');}
 if(!contract)return;
 if(current&&current.source.reference===contract.source.reference&&current.source.version===contract.source.version&&currentSemantics&&(JSON.stringify(currentSemantics.mapping)!==JSON.stringify(manifest.mapping)||JSON.stringify(currentSemantics.terminology)!==JSON.stringify(manifest.terminology)))fail(422,'Change the destination contract source version when mapping or terminology semantics change.');
 if(current&&current.source.reference===contract.source.reference&&current.source.version===contract.source.version&&JSON.stringify(current)!==JSON.stringify(contract))fail(422,'Change the destination contract source version when its requirements or examples change.');
 if(contract.source.reference!==manifest.source.reference||contract.source.version!==manifest.source.version)fail(422,'Mapping and conformance source versions must match.');
 if(manifest.mapping.some(x=>!x.transformation||!x.unit||!x.nullSemantics))fail(422,'Governed mapping rows need explicit transformation, units and missing-value semantics.');
 for(const target of contract.requiredTargets){const row=manifest.mapping.find(x=>x.target===target);if(!row||!row.required)fail(422,`Destination mandatory field ${target} needs a required mapping.`);}
 for(const target of contract.codeTargets){const row=manifest.mapping.find(x=>x.target===target);if(!row||row.source!=='terminologyCode'||!row.required||!contract.requiredTargets.includes(target))fail(422,`Required code field ${target} needs an explicit required terminology mapping.`);if(!manifest.terminology.some(t=>t.target===target))fail(422,`Required code field ${target} needs a terminology declaration.`);}
 for(const row of manifest.mapping.filter(x=>x.source==='terminologyCode'))if(!manifest.terminology.some(t=>t.target===row.target))fail(422,`Code field ${row.target} needs an explicit terminology state.`);
 const targets=new Set(manifest.mapping.map(x=>x.target));for(const fixture of contract.fixtures)if(fixture.outcome==='mapped'&&Object.keys(fixture.expected).some(t=>!targets.has(t)))fail(422,'Conformance examples must name mapped destination fields only.');
}
function projectField(row:Mapping,read:(source:Mapping['source'])=>string|undefined,terms:Terminology[],contract?:MappingConformance):string|null|undefined{
 assertMappingRule(row);const term=terms.find(t=>t.target===row.target);
 if(term&&(term.status==='deprecated'||term.status==='ambiguous'))fail(422,`Field ${row.target} has unresolved terminology.`);
 if(contract?.codeTargets.includes(row.target)&&(!term||term.status!=='active'||!term.code))fail(422,`Field ${row.target} requires an approved explicit code.`);
 let value=row.source==='terminologyCode'?(term?.status==='unmapped'?'unmapped':term?.code):read(row.source);
 if(value===undefined||value===''){
  if(row.required)fail(422,`Required field ${row.target} is missing.`);
  switch(row.nullSemantics??'omit'){
   case 'omit':return undefined;
   case 'empty':return '';
   case 'null':return null;
   case 'response-state':{const source=`${row.source}Source` as Mapping['source'],state=MIS_FIELDS.includes(source)?read(source):undefined;return ['not-asked','declined','unknown','not-applicable'].includes(state??'')?state!:'unknown';}
  }
 }
 if(row.transformation&&row.transformation!=='identity'){
  if(!/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value))fail(422,`Field ${row.target} is not a canonical numeric value.`);
  const number=Number(value),converted=conversionRules[row.transformation].convert(number);if(!Number.isFinite(number)||!Number.isFinite(converted)||Math.abs(converted)>1e12)fail(422,`Field ${row.target} exceeds deterministic conversion bounds.`);
  value=String(Math.round(converted*1e8)/1e8);
 }
 return value;
}
export function projectMapping(mapping:Mapping[],read:(source:Mapping['source'])=>string|undefined,terms:Terminology[]=[],contract?:MappingConformance){
 const fields:Record<string,string|null>={};for(const row of mapping){const value=projectField(row,read,terms,contract);if(value!==undefined)fields[row.target]=value;}return fields;
}
export async function mappingConformance(manifest:MappingManifest):Promise<MappingConformanceResult|undefined>{
 const contract=manifest.conformance;if(!contract)return;
 const results=[];const covered=new Set<string>();for(const fixture of contract.fixtures){let passed=false;try{const actual=projectMapping(manifest.mapping,key=>fixture.values[key],manifest.terminology,contract);passed=fixture.outcome==='mapped'&&await digest(Object.entries(actual).sort(([a],[b])=>a.localeCompare(b)))===await digest(Object.entries(fixture.expected).sort(([a],[b])=>a.localeCompare(b)));if(passed&&fixture.outcome==='mapped')Object.keys(fixture.expected).forEach(x=>covered.add(x));}catch{passed=fixture.outcome==='rejected';}results.push({name:fixture.name,passed});}
 const uncovered=manifest.mapping.filter(x=>!covered.has(x.target)).map(x=>x.target);const result={passed:results.filter(x=>x.passed).length,failed:results.filter(x=>!x.passed).length,uncovered,results};return {hash:await digest({manifestSource:manifest.source,rulesVersion:contract.rulesVersion,fixtures:contract.fixtures,result}),...result};
}

function mappingValue(v:Visit,source:Mapping['source']):string|undefined{
 if(source==='personId')return v.personId;if(source==='visitId')return v.id;
 const match=/^(systolic|diastolic|weight|temperature|weeks|coughDays)(Source|ObservedAt|Unit)$/.exec(source);
 if(!match)return v.facts[source as keyof typeof v.facts] as string|undefined;
 const field=match[1] as 'systolic'|'diastolic'|'weight'|'temperature'|'weeks'|'coughDays',measure=field==='systolic'||field==='diastolic'?'bloodPressure':field;
 const p=v.facts.provenance?.[measure];if(match[2]==='Source')return p?.source??(v.facts[field]?v.facts.source:undefined);
 if(!v.facts[field])return undefined;if(match[2]==='ObservedAt')return p?.at??v.facts.date;
 // Facts contain canonical values; entered-unit evidence is never silently substituted for the canonical unit.
 return {systolic:'mmHg',diastolic:'mmHg',weight:'kg',temperature:'°C',weeks:'weeks',coughDays:'days'}[field];
}
export function assertMappingEffective(i:Integration,now=Date.now()){
 const l=i.mis?.lifecycle;if(!l?.pendingId)return;const r=l.revisions.find(r=>r.id===l.pendingId);
 if(r&&Date.parse(r.manifest.effectiveAt)<=now&&(l.events.some(e=>e.revisionId===r.id&&e.action==='review')||r.manifest.conformance&&(r.manifest.terminology.some(t=>t.status==='deprecated'||t.status==='ambiguous')||r.manifest.conformance.codeTargets.some(target=>!r.manifest.terminology.some(t=>t.target===target&&t.status==='active'&&t.code)))))fail(409,'A reviewed mapping is due. The owner must refresh its impact and publish or cancel it before new approvals or sends. Receipt lookup remains available.');
}
export async function mappingImpact(s:OrgState,i:Integration,r:MappingRevision){
 if(s.workspace.submissions.length+s.workspace.visits.length>5000)fail(409,'Mapping impact exceeds the local review bound. A bounded migration workflow is required; no mapping was changed.');
 const candidate={...i,mis:{contract:'saha-mis-v1' as const,mapping:r.manifest.mapping,corrections:r.manifest.corrections,conformance:r.manifest.conformance,terminology:r.manifest.terminology},programmes:r.manifest.programmes as Integration['programmes']};
 const counts:MappingImpact={unsent:0,changed:0,unmappable:0,pendingPlans:0,changedPlans:0,lookupOnly:0,terminalPreserved:0,deprecated:r.manifest.terminology.filter(x=>x.status==='deprecated').length,ambiguous:r.manifest.terminology.filter(x=>x.status==='ambiguous').length};
 const selected=[];
 const conformance=await mappingConformance(r.manifest);
 const fields:MappingFieldImpact[]|undefined=r.manifest.conformance?[...new Set([...i.mis!.mapping.map(x=>x.target),...r.manifest.mapping.map(x=>x.target)])].map(target=>({target,source:(r.manifest.mapping.find(x=>x.target===target)??i.mis!.mapping.find(x=>x.target===target))!.source,unsent:0,changed:0,unmappable:0,pendingPlans:0,changedPlans:0,terminology:r.manifest.mapping.some(x=>x.target===target)?r.manifest.terminology.find(x=>x.target===target)?.status??'not-declared':'removed'})):undefined;
 function fieldImpact(v:Visit|undefined,old:any,plan:boolean){if(!fields)return;const applicable=v&&candidate.programmes.some(programme=>s.workspace.people.find(p=>p.id===v.personId)?.programmes.includes(programme));for(const field of fields){if(plan)field.pendingPlans++;else field.unsent++;let value:string|null|undefined;try{if(!applicable)throw Error('not applicable');const row=r.manifest.mapping.find(x=>x.target===field.target);value=row?projectField(row,key=>mappingValue(v!,key),r.manifest.terminology,r.manifest.conformance):undefined;if(value!==old?.fields?.[field.target]||(value!==undefined)!==Object.hasOwn(old?.fields??{},field.target)){if(plan)field.changedPlans++;else field.changed++;}}catch{if(plan)field.changedPlans++;else field.unmappable++;}}}

 for(const sub of s.workspace.submissions.filter(x=>x.connectorId===i.id)){
  let next:string|null=null;if(['queued','retryable'].includes(sub.state)){counts.unsent++;const v=s.workspace.visits.find(v=>v.id===sub.visitId);fieldImpact(v,sub.delivery?.payload,false);try{if(!v||!candidate.programmes.some(p=>s.workspace.people.find(p=>p.id===v.personId)?.programmes.includes(p)))throw Error('not applicable');next=await digest(mappedPayload(candidate,v,s));if(next!==sub.payloadHash)counts.changed++;}catch{counts.unmappable++;}}
  else if(['sending','uncertain'].includes(sub.state))counts.lookupOnly++;else counts.terminalPreserved++;
  const v=s.workspace.visits.find(v=>v.id===sub.visitId),p=s.workspace.people.find(p=>p.id===sub.personId);selected.push({id:sub.id,state:sub.state,hash:sub.payloadHash,next,receipt:sub.receipt??null,version:sub.delivery?.connectorVersion??null,currentVisitVersion:v?.version??null,currentPersonVersion:p?.version??null,currentConsentVersion:p?.consentVersion??null,pack:v?.programmeCapture??null,range:v?.valueRangeCapture?.manifestHash??null});
 }
 for(const v of s.workspace.visits.filter(v=>v.plan?.recipients.includes(i.id)&&['proposed','approved'].includes(v.plan.state))){counts.pendingPlans++;fieldImpact(v,v.plan?.payloads?.[i.id],true);let next:string|null=null;try{if(!candidate.programmes.some(programme=>s.workspace.people.find(p=>p.id===v.personId)?.programmes.includes(programme)))throw Error('not applicable');next=await digest(mappedPayload(candidate,v,s));}catch{}const old=v.plan?.payloads?.[i.id];if(!old||!next||await digest(old)!==next)counts.changedPlans++;selected.push({id:v.id,version:v.version,plan:v.plan!.id,planHash:v.plan!.payloadHash,state:v.plan!.state,next,pack:v.programmeCapture??null,range:v.valueRangeCapture?.manifestHash??null});}
 // The plan hash binds material current evidence, including retained correction receipts and source-pack manifests.
 const hash=await digest({format:'saha-mapping-impact-v1',organisationId:s.organisation.id,integrationId:i.id,connectorVersion:i.version,currentMapping:i.mis?.mapping,currentProgrammes:i.programmes,currentCorrections:i.mis?.corrections,revisionHash:r.hash,selected,counts,...(fields?{fields,conformance}: {})});
 return {hash,counts,...(fields?{fields,conformance}: {})};
}
async function applyMappingLifecycle(s:OrgState,i:Integration,c:any,u:Actor,m:Member){
 const existing=i.mis?.lifecycle;if((existing?.version??0)!==c.lifecycleVersion)fail(409,'Mapping lifecycle changed. Refresh first.');
 let l=existing;const now=new Date().toISOString();
 if(c.type==='draftMisMapping'||c.type==='rollbackMisMapping'){
  if(l?.pendingId)fail(409,'Publish or cancel the pending revision first.');if((l?.revisions.length??0)>=50)fail(409,'Mapping history is full; retain it and use a bounded archive workflow.');
  let manifest:MappingManifest;
  if(c.type==='rollbackMisMapping'){const old=l?.revisions.find(r=>r.id===c.revisionId);if(!old||!old.manifest.mapping.length||!l?.events.some(e=>e.revisionId===old.id&&e.action==='apply')&&!old.baseline)fail(409,'Rollback must reference a previously applied mapping.');manifest={...structuredClone(old.manifest),effectiveAt:c.effectiveAt,rollbackOf:old.id};}
  else manifest={mapping:c.mapping,programmes:c.programmes,corrections:c.corrections,source:c.source,terminology:c.terminology,effectiveAt:c.effectiveAt,...(c.conformance?{conformance:c.conformance}:{})};
  validateMappingManifest(manifest,i.mis?.conformance,i.mis?.conformance?{mapping:i.mis.mapping,terminology:i.mis.terminology??[]}:undefined);
  if(manifest.terminology.some(t=>!manifest.mapping.some(x=>x.target===t.target)))fail(422,'Every terminology declaration must name a mapped destination field.');
  if(!l){const base:MappingManifest={mapping:structuredClone(i.mis?.mapping??[]),programmes:[...i.programmes],corrections:i.mis?.corrections??false,source:{reference:'legacy-unreviewed',version:'untracked'},terminology:[],effectiveAt:now};const baseline={id:uuid(),hash:await digest(base),manifest:base,createdAt:now,by:u.userId,baseline:true};l={version:0,currentId:baseline.id,revisions:[baseline],events:[]};}
  const revision={id:uuid(),hash:await digest(manifest),manifest,createdAt:now,by:u.userId};l.revisions.push(revision);l.pendingId=revision.id;l.events.push({action:'draft',revisionId:revision.id,at:now,by:u.userId});l.version++;
  if(!i.mis)i.mis={contract:'saha-mis-v1',mapping:[],corrections:false};i.mis.lifecycle=l;
  misAudit(s,u,m,c.type,i.id,'Immutable mapping draft appended. Connection and prior delivery bodies unchanged.');return {revisionId:revision.id,manifestHash:revision.hash,lifecycleVersion:l.version};
 }
 if(!l||l.pendingId!==c.revisionId)fail(409,'This is not the current pending mapping revision.');const r=l.revisions.find(r=>r.id===c.revisionId)!;
 if(c.type==='cancelMisMapping'){l.events.push({action:'cancel',revisionId:r.id,at:now,by:u.userId});delete l.pendingId;l.version++;misAudit(s,u,m,c.type,i.id,'Pending mapping cancelled; manifest/history retained.');return {ok:true};}
 if(l.events.length>=200)fail(409,'Mapping review history is full. No evidence was discarded.');
 const impact=await mappingImpact(s,i,r);
 if(c.type==='impactMisMapping'){l.events.push({action:'impact',revisionId:r.id,at:now,by:u.userId,impactHash:impact.hash,counts:impact.counts,...(impact.fields?{fields:impact.fields,conformanceHash:impact.conformance!.hash,conformance:impact.conformance}:{})});l.version++;misAudit(s,u,m,c.type,i.id,'Count-only mapping impact reviewed; no patient payloads returned or changed.');return {revisionId:r.id,impactHash:impact.hash,counts:impact.counts,lifecycleVersion:l.version,...(impact.fields?{fields:impact.fields,conformance:impact.conformance}:{})};}
 if(impact.hash!==c.impactHash||!l.events.some(e=>e.action==='impact'&&e.revisionId===r.id&&e.impactHash===c.impactHash))fail(409,'Mapping impact changed or was not prepared. Refresh the dry-run first.');
 if(impact.conformance&&(impact.conformance.failed||impact.conformance.uncovered.length))fail(409,'Conformance examples failed or leave mapped fields uncovered. Create a corrected draft.');
 if(impact.counts.deprecated||impact.counts.ambiguous)fail(409,'Resolve deprecated or ambiguous terminology in a new draft before review/publication.');
 if(c.type==='reviewMisMapping'){l.events.push({action:'review',revisionId:r.id,at:now,by:u.userId,impactHash:impact.hash,counts:impact.counts,...(impact.fields?{fields:impact.fields,conformanceHash:impact.conformance!.hash,conformance:impact.conformance}:{})});l.version++;misAudit(s,u,m,c.type,i.id,'Owner reviewed the exact synthetic mapping/impact. Native clinical approval remains pending.');return {ok:true};}
 if(c.type==='applyMisMapping'){
  if(Date.parse(r.manifest.effectiveAt)>Date.now())fail(409,'The mapping effective time has not arrived.');
  if(!l.events.some(e=>e.action==='review'&&e.revisionId===r.id&&e.impactHash===impact.hash&&s.members.some(m=>m.userId===e.by&&m.status==='active'&&m.isOwner)))fail(409,'Review this exact current impact before publication.');
  i.mis={contract:'saha-mis-v1',mapping:structuredClone(r.manifest.mapping),corrections:r.manifest.corrections,lifecycle:l,...(r.manifest.conformance?{conformance:structuredClone(r.manifest.conformance),terminology:structuredClone(r.manifest.terminology)}:{})};i.programmes=[...r.manifest.programmes] as Integration['programmes'];i.status='suspended';i.version++;l.currentId=r.id;delete l.pendingId;l.version++;l.events.push({action:'apply',revisionId:r.id,at:now,by:u.userId,impactHash:impact.hash,counts:impact.counts,connectorVersion:i.version});misAudit(s,u,m,c.type,i.id,'Reviewed mapping published; connection suspended, prior unsent approvals stale. Stored delivery bodies, terminal receipts and lookup provenance retained.');return {ok:true,revisionId:r.id,connectorVersion:i.version};
 }
 return null;
}

export function pinMisMappingApprovals(before:OrgState,s:OrgState){
 const ref=(id:string)=>{const l=s.workspace.integrations.find(i=>i.id===id)?.mis?.lifecycle,r=l?.revisions.find(r=>r.id===l.currentId);return r?{id:r.id,hash:r.hash}:null;};
 for(const v of s.workspace.visits){if(v.plan&&v.plan.id!==before.workspace.visits.find(x=>x.id===v.id)?.plan?.id){const refs:Record<string,{id:string;hash:string}>={};for(const id of v.plan.recipients){const r=ref(id);if(r)refs[id]=r;}if(Object.keys(refs).length)v.plan.mappingRevisions=refs;}}
 for(const sub of s.workspace.submissions){if(sub.delivery&&!before.workspace.submissions.some(x=>x.id===sub.id)){const r=ref(sub.connectorId);if(r)sub.delivery.mappingRevision=r;}}
}
