import { AppError, digest, fail } from './core';
import { z } from 'zod';
import { inspectDocument } from './fhir-document';

// Slice 7c: one pinned, versioned rule set applied to every outbound FHIR document (EHR publication
// and the mock ABDM HIP) and to documents received over the mock ABDM transfer (BR-INT-17). It is a
// local structural subset of HL7 FHIR R4, not the NRCeS implementation guide: no profile package,
// terminology server or ABDM validator is installed.
export const VALIDATION_RULESET={
 id:'saha-fhir-r4-document-structure',
 // 1.1.0 (integration of #144, review finding): Provenance became a permitted resource type in slice R21, so the
 // rule set accepts documents 1.0.0 refused; a stamp names the version that checked the document.
 version:'1.1.0',
 fhirVersion:'4.0.1',
 basis:[
  'HL7 FHIR R4 Bundle invariants bdl-7 (unique fullUrl), bdl-9 (document identifier with system and value), bdl-10 (document timestamp) and bdl-11 (Composition first)',
  'Saha structural subset: permitted resource types (Composition, Patient, Encounter, Observation, Organization, Practitioner and, from 1.1.0, Provenance), one Composition and one Patient, every reference resolved inside the bundle, final Composition with type, title and author, dated observations with time zone, UCUM units for the supported LOINC vital signs',
 ],
 profilePackage:null,
 terminology:null,
} as const;
export type ValidationStamp={ruleset:string;version:string;fhirVersion:string;checkedAt:string;warnings:string[]};
// Returns a stamp for a document that passes; otherwise refuses with the rule set, version and the
// specific failure, before anything is encrypted, stored or sent.
export function validateOutbound(bundle:unknown,expectedPatientId?:string,now=new Date().toISOString()):ValidationStamp{
 try{const summary=inspectDocument(bundle,expectedPatientId);return {ruleset:VALIDATION_RULESET.id,version:VALIDATION_RULESET.version,fhirVersion:VALIDATION_RULESET.fhirVersion,checkedAt:now,warnings:summary.warnings};}
 catch(e){if(e instanceof AppError)fail(422,`Document failed ${VALIDATION_RULESET.id} ${VALIDATION_RULESET.version}: ${e.message} Nothing was sent.`);throw e;}
}


// SAHA-081: deployment-pinned schema/profile/terminology/mapping/business-rule custody.

const pin=z.object({id:z.string().min(1).max(160),version:z.string().min(1).max(80),sha256:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
const policySchema=z.object({
 id:z.string().min(1).max(160),version:z.string().min(1).max(80),fhirVersion:z.literal('4.0.1'),
 package:pin,terminology:pin,mapping:pin,businessRules:pin,
 profiles:z.record(z.string().min(1),z.string().url()),
 valueSets:z.record(z.string().url(),z.array(z.string().min(1)).min(1)),
 constraints:z.object({resourceCardinality:z.record(z.string().min(1),z.object({min:z.number().int().nonnegative(),max:z.number().int().positive()}).refine(x=>x.max>=x.min)).default({}),requireSignature:z.boolean().default(false),units:z.record(z.string().min(1),z.array(z.string().min(1)).min(1)).default({})}).strict(),
 warningPolicy:z.object({version:z.string().min(1).max(80),sha256:z.string().regex(/^[a-f0-9]{64}$/),accepted:z.array(z.string().min(1)).max(100)}).strict(),
 supportedArtifacts:z.array(z.string().min(1).max(80)).min(1),
}).strict();
export type ExchangeConformancePolicy=z.infer<typeof policySchema>;
export type PinnedConformanceStamp=ValidationStamp&{policyId:string;policyVersion:string;policyDigest:string;package:string;terminology:string;mapping:string;businessRules:string;warningPolicy:string;artifact:string;profile:string;ownerAccepted:false};

export function exactPolicy(env:Record<string,string|undefined>,organisationId:string,integrationId:string):ExchangeConformancePolicy|null{
 const raw=env.SAHA_EHR_CONFORMANCE_POLICIES;if(!raw)return null;let parsed:unknown;try{parsed=JSON.parse(raw);}catch{fail(409,'Invalid pinned EHR conformance policy configuration.');}
 if(!Array.isArray(parsed))fail(409,'Invalid pinned EHR conformance policy configuration.');
 const match=(parsed as any[]).find(x=>x?.organisationId===organisationId&&x?.integrationId===integrationId);
 if(!match)return null;const result=policySchema.safeParse(match.policy);if(!result.success)fail(409,'The pinned EHR conformance policy is invalid.');return result.data;
}

function references(bundle:any):any[]{return Array.isArray(bundle?.entry)?bundle.entry.map((e:any)=>e?.resource).filter(Boolean):[];}

export async function validatePinnedExchange(bundle:unknown,artifact:string,policy:ExchangeConformancePolicy,expectedPatientId?:string,now=new Date().toISOString()):Promise<PinnedConformanceStamp>{
 const checked=policySchema.safeParse(policy);if(!checked.success)fail(409,'The pinned EHR conformance policy is invalid.');policy=checked.data;
 if(!policy.supportedArtifacts.includes(artifact))fail(422,`Artifact ${artifact} is not covered by pinned policy ${policy.id} ${policy.version}. Nothing was sent.`);
 const profile=policy.profiles[artifact];if(!profile)fail(422,`Artifact ${artifact} has no pinned profile in ${policy.id} ${policy.version}. Nothing was sent.`);
 const structural=validateOutbound(bundle,expectedPatientId,now),resources=references(bundle as any),composition=resources.find(r=>r.resourceType==='Composition');
 if(!Array.isArray(composition?.meta?.profile)||!composition.meta.profile.includes(profile))fail(422,`Document failed pinned profile ${profile}: Composition.meta.profile is missing. Nothing was sent.`);
 for(const [resourceType,limit] of Object.entries(policy.constraints.resourceCardinality)){const count=resources.filter(r=>r.resourceType===resourceType).length;if(count<limit.min||count>limit.max)fail(422,`Document failed pinned profile ${profile}: ${resourceType} cardinality ${count} is outside ${limit.min}..${limit.max}. Nothing was sent.`);}
 const signature=(bundle as any)?.signature;if(policy.constraints.requireSignature&&!signature)fail(422,`Document failed pinned business rules ${policy.businessRules.id} ${policy.businessRules.version}: Bundle.signature is required. Nothing was sent.`);
 if(signature&&(!Array.isArray(signature.type)||!signature.type.some((x:any)=>x?.system&&x?.code)||!signature.when||!signature.who?.reference||!signature.data))fail(422,`Document failed pinned business rules ${policy.businessRules.id} ${policy.businessRules.version}: Bundle.signature is incomplete. Nothing was sent.`);
 for(const r of resources)for(const coding of [r?.code?.coding,r?.category?.flatMap((x:any)=>x?.coding??[]),r?.type?.coding].flat().filter(Boolean) as any[]){
  if(!coding?.system||!coding?.code)continue;const allowed=policy.valueSets[coding.system];if(allowed&&!allowed.includes(coding.code))fail(422,`Document failed pinned terminology ${policy.terminology.id} ${policy.terminology.version}: code ${coding.system}|${coding.code} is not allowed. Nothing was sent.`);
 }
 for(const r of resources.filter(x=>x.resourceType==='Observation'&&x.valueQuantity)){const allowed=policy.constraints.units[r.code?.coding?.[0]?.code];if(allowed&&!allowed.includes(r.valueQuantity.code))fail(422,`Document failed pinned unit rules ${policy.businessRules.id} ${policy.businessRules.version}: ${r.code?.coding?.[0]?.code}|${r.valueQuantity.code} is not allowed. Nothing was sent.`);}
 const warnings=structural.warnings.filter(w=>!policy.warningPolicy.accepted.includes(w));if(warnings.length)fail(422,`Document has warnings not accepted by warning policy ${policy.warningPolicy.version}: ${warnings.join(' ')} Nothing was sent.`);
 return {...structural,policyId:policy.id,policyVersion:policy.version,policyDigest:await digest(policy),package:`${policy.package.id} ${policy.package.version} ${policy.package.sha256}`,terminology:`${policy.terminology.id} ${policy.terminology.version} ${policy.terminology.sha256}`,mapping:`${policy.mapping.id} ${policy.mapping.version} ${policy.mapping.sha256}`,businessRules:`${policy.businessRules.id} ${policy.businessRules.version} ${policy.businessRules.sha256}`,warningPolicy:`${policy.warningPolicy.version} ${policy.warningPolicy.sha256}`,artifact,profile,ownerAccepted:false};
}

export async function validateConfiguredExchange(bundle:unknown,artifact:string,env:Record<string,string|undefined>,organisationId:string,integrationId:string,expectedPatientId?:string,now?:string){
 const policy=exactPolicy(env,organisationId,integrationId);if(!policy)return null;return validatePinnedExchange(bundle,artifact,policy,expectedPatientId,now);
}

export async function prepareConfiguredExchange(bundle:any,artifact:string,env:Record<string,string|undefined>,organisationId:string,integrationId:string,expectedPatientId?:string,now?:string){
 const policy=exactPolicy(env,organisationId,integrationId);if(!policy)return null;const mapped=structuredClone(bundle),composition=references(mapped).find(r=>r.resourceType==='Composition'),profile=policy.profiles[artifact];
 if(!composition||!profile)fail(422,`Artifact ${artifact} has no pinned profile in ${policy.id} ${policy.version}. Nothing was sent.`);
 composition.meta={...(composition.meta??{}),profile:[profile]};return {bundle:mapped,validation:await validatePinnedExchange(mapped,artifact,policy,expectedPatientId,now)};
}

export async function assertConfiguredExchangeCurrent(bundle:unknown,validation:ValidationStamp|PinnedConformanceStamp|undefined,artifact:string,env:Record<string,string|undefined>,organisationId:string,integrationId:string,expectedPatientId?:string){
 const current=exactPolicy(env,organisationId,integrationId),pinned=!!validation&&'policyDigest' in validation;if(!current){if(pinned)fail(409,'The pinned conformance policy was removed after preparation. Nothing was sent.');return true;}
 if(!pinned)fail(409,'A pinned conformance policy was added after preparation. Prepare and review the document again. Nothing was sent.');
 const fresh=await validatePinnedExchange(bundle,artifact,current,expectedPatientId);if(fresh.policyDigest!==(validation as PinnedConformanceStamp).policyDigest)fail(409,'The pinned conformance policy changed after preparation. Prepare and review the document again. Nothing was sent.');return true;
}

export function assertPolicyUpgrade(previous:ExchangeConformancePolicy,next:ExchangeConformancePolicy,evidence:{regressionPassed:boolean;ownerApproved:boolean}){
 if(previous.id!==next.id)fail(409,'A policy upgrade must retain the policy identity.');
 if(previous.version===next.version)fail(409,'The pinned policy version did not change.');
 if(!evidence.regressionPassed)fail(409,'Pinned policy upgrades require a passing regression corpus.');
 if(!evidence.ownerApproved)fail(409,'Pinned policy upgrades require separate integration-owner approval.');
 return true;
}
