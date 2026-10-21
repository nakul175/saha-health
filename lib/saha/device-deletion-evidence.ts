import {digest,fail} from './core';

const hex=/^[0-9a-f]{64}$/;
const ref=/^[A-Za-z0-9._:-]{3,200}$/;

export type BrowserDeletionAcknowledgement={
 instructionId:string;leaseId:string;packageHash:string;removedDrafts:number;removedMedia:number;
 localRevision:number;attestation:'browser-transaction-completed';
};
export type DeviceDeletionTombstone={
 recordClass:'field-package'|'local-cache';recordId:string;disposedAt:string;instructionId:string;
};
export type AuthoritativeDeviceDeletionStatement={
 format:'saha-authoritative-device-deletion-v1';authorityKind:'managed-device'|'os-attestation'|'independent-device-lab';
 authorityReference:string;deviceKeyId:string;instructionId:string;leaseId:string;packageHash:string;
 vaultRevision:number;deletedAt:string;nonce:string;statementHash:string;signature:string;
};
export type DeviceDeletionVerifier=(input:{canonicalStatement:string;statement:AuthoritativeDeviceDeletionStatement})=>Promise<{verified:boolean;evidenceReference?:string}>;
export type DeviceDeletionGateInput={acknowledgement:BrowserDeletionAcknowledgement|null;tombstone:DeviceDeletionTombstone|null;statement:AuthoritativeDeviceDeletionStatement|null;verify:DeviceDeletionVerifier|null};

const instant=(value:string)=>{const date=new Date(value);return Number.isFinite(date.valueOf())&&date.toISOString()===value;};
const canonical=(statement:AuthoritativeDeviceDeletionStatement)=>JSON.stringify({format:statement.format,authorityKind:statement.authorityKind,authorityReference:statement.authorityReference,deviceKeyId:statement.deviceKeyId,instructionId:statement.instructionId,leaseId:statement.leaseId,packageHash:statement.packageHash,vaultRevision:statement.vaultRevision,deletedAt:statement.deletedAt,nonce:statement.nonce});

// A browser acknowledgement is deliberately insufficient. Completion needs an independently
// verified statement bound to the exact purge instruction and the append-only retention tombstone.
export async function authoritativeDeviceDeletionEvidence(input:DeviceDeletionGateInput){
 const acknowledgement=input.acknowledgement;if(!acknowledgement)return {verified:false as const,reason:'browser-acknowledgement-missing'};
 if(acknowledgement.attestation!=='browser-transaction-completed')fail(422,'Unsupported browser deletion acknowledgement.');
 const tombstone=input.tombstone;if(!tombstone)return {verified:false as const,reason:'retention-tombstone-missing'};
 if(tombstone.instructionId!==acknowledgement.instructionId||tombstone.recordId!==acknowledgement.leaseId)return {verified:false as const,reason:'retention-tombstone-mismatch'};
 const statement=input.statement;if(!statement)return {verified:false as const,reason:'authoritative-device-statement-missing'};
 if(statement.format!=='saha-authoritative-device-deletion-v1'||!ref.test(statement.authorityReference)||!ref.test(statement.deviceKeyId)||!ref.test(statement.nonce)||!ref.test(statement.signature)||!hex.test(statement.instructionId)||!hex.test(statement.packageHash)||!Number.isInteger(statement.vaultRevision)||statement.vaultRevision<=0||!instant(statement.deletedAt))fail(422,'Invalid authoritative device deletion statement.');
 if(statement.instructionId!==acknowledgement.instructionId||statement.leaseId!==acknowledgement.leaseId||statement.packageHash!==acknowledgement.packageHash||statement.vaultRevision!==acknowledgement.localRevision||statement.deletedAt<tombstone.disposedAt)return {verified:false as const,reason:'authoritative-device-statement-mismatch'};
 const canonicalStatement=canonical(statement);if(statement.statementHash!==await digest(canonicalStatement))return {verified:false as const,reason:'authoritative-device-statement-hash-mismatch'};
 if(!input.verify)return {verified:false as const,reason:'authoritative-device-verifier-unavailable'};
 const verdict=await input.verify({canonicalStatement,statement});if(!verdict.verified||!verdict.evidenceReference?.trim())return {verified:false as const,reason:'authoritative-device-verification-refused'};
 return {verified:true as const,claim:'physically-deleted' as const,evidenceReference:verdict.evidenceReference,recordClass:tombstone.recordClass,recordId:tombstone.recordId,instructionId:tombstone.instructionId,verifiedAt:statement.deletedAt};
}

export const canonicalDeviceDeletionStatement=canonical;
