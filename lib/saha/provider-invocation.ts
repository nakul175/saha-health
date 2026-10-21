import { digest, fail } from './core';
import type { GovernanceEntry } from './governance';

export type ProviderAgreement={reference:string;purpose:'documentary-evidence';permittedData:['documentary-source'];hostingRegions:string[];maximumRetentionDays:number;trainingUse:'not-authorised';subprocessors:string[]};
export type ProviderInvocationReceipt={contract:'saha-provider-invocation-v1';providerId:string;capabilityId:string;capabilityVersion:number;manifestHash:string;purpose:'documentary-evidence';data:['documentary-source'];payloadHash:string;agreementHash:string;checkedAt:string};

const same=(a:string[],b:string[])=>JSON.stringify([...a].sort())===JSON.stringify([...b].sort());
export function deploymentAgreement(runtime:Record<string,string|undefined>,providerId:string):ProviderAgreement{
 let all:unknown;try{all=JSON.parse(runtime.SAHA_PROVIDER_AGREEMENTS_JSON??'{}');}catch{fail(409,'Provider deployment agreements are invalid; nothing was sent.');}
 const raw=(all&&typeof all==='object'&&!Array.isArray(all))?(all as Record<string,unknown>)[providerId]:undefined;
 if(!raw||typeof raw!=='object'||Array.isArray(raw))fail(409,'No server-approved deployment agreement covers this provider; nothing was sent.');
 const x=raw as Record<string,unknown>;
 if(typeof x.reference!=='string'||x.purpose!=='documentary-evidence'||x.trainingUse!=='not-authorised'||!Array.isArray(x.permittedData)||!Array.isArray(x.hostingRegions)||!Array.isArray(x.subprocessors)||!Number.isInteger(x.maximumRetentionDays))fail(409,'The server-held provider agreement is incomplete; nothing was sent.');
 if(!same(x.permittedData as string[],['documentary-source'])||(x.hostingRegions as unknown[]).some(v=>typeof v!=='string')||(x.subprocessors as unknown[]).some(v=>typeof v!=='string')||(x.maximumRetentionDays as number)<0)fail(409,'The server-held provider agreement is incompatible; nothing was sent.');
 return x as ProviderAgreement;
}

export async function authorizeProviderInvocation(entry:GovernanceEntry,runtime:Record<string,string|undefined>,payload:unknown,at=new Date().toISOString()):Promise<ProviderInvocationReceipt>{
 if(entry.spec.kind!=='capability')fail(409,'A reviewed capability is required; nothing was sent.');const c=entry.spec;
 const agreement=deploymentAgreement(runtime,c.providerId);
 if(c.purpose!==agreement.purpose||c.agreementReference!==agreement.reference||c.trainingUse!==agreement.trainingUse||!c.permittedData||!same(c.permittedData,agreement.permittedData)||c.retentionDays===undefined||c.retentionDays>agreement.maximumRetentionDays||!agreement.hostingRegions.includes(c.hostingRegion)||!c.subprocessors||!same(c.subprocessors,agreement.subprocessors))fail(409,'Provider retention, training, subprocessor, region or purpose terms are incompatible; nothing was sent.');
 return {contract:'saha-provider-invocation-v1',providerId:c.providerId,capabilityId:entry.id,capabilityVersion:entry.version,manifestHash:entry.manifestHash,purpose:c.purpose,data:['documentary-source'],payloadHash:await digest(payload),agreementHash:await digest(agreement),checkedAt:at};
}
