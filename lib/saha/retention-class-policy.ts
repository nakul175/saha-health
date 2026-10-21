import {fail} from './core';

export const POLICY_CONTROLLED_CLASSES=['patient-record','model-output','field-package','local-cache','audit-event','export','backup'] as const;
export type PolicyControlledClass=typeof POLICY_CONTROLLED_CLASSES[number];
export type DispositionState='retained'|'policy-blocked'|'purge-pending'|'evidence-pending'|'completed';
export type DispositionDecision={state:DispositionState;claim:'retained'|'crypto-erased'|'physically-deleted';reason:string;retryable:boolean};

type Common={recordClass:PolicyControlledClass;hold:boolean;exception?:boolean};
export type PatientRecordDisposition=Common&{recordClass:'patient-record';jurisdictionScheduleApproved:boolean;minimumEvidenceSchemaApproved:boolean};
export type ModelOutputDisposition=Common&{recordClass:'model-output';classification:'unclassified'|'patient-record'|'non-authoritative-assistance';provenanceEnvelopeRetained:boolean;humanDecisionRetained:boolean};
export type OfflineDisposition=Common&{recordClass:'field-package'|'local-cache';expired:boolean;unsyncedClinicalWork:boolean;keyInaccessible:boolean;authoritativeDeviceEvidence:boolean;appAcknowledged?:boolean};
export type AuditDisposition=Common&{recordClass:'audit-event';detailErasureDesign:'unapproved'|'cryptographic'|'checkpoint-linked';minimumEnvelopeRetained:boolean;chainVerified:boolean;detailKeyInaccessible?:boolean};
export type ExportDisposition=Common&{recordClass:'export';serverPayloadPersisted:boolean;destinationRegistered:boolean;keyInaccessible:boolean;authoritativeDestinationEvidence:boolean};
export type BackupDisposition=Common&{recordClass:'backup';recoveryWindowApproved:boolean;tombstoneAwareRestoreVerified:boolean;generationKeyInaccessible:boolean;providerGenerationEvidence:boolean};
export type PolicyDispositionInput=PatientRecordDisposition|ModelOutputDisposition|OfflineDisposition|AuditDisposition|ExportDisposition|BackupDisposition;

const retained=(reason:string):DispositionDecision=>({state:'retained',claim:'retained',reason,retryable:false});
const blocked=(reason:string,retryable=false):DispositionDecision=>({state:'policy-blocked',claim:'retained',reason,retryable});
const pending=(reason:string,claim:DispositionDecision['claim']='retained'):DispositionDecision=>({state:'purge-pending',claim,reason,retryable:true});
const evidence=(reason:string,claim:DispositionDecision['claim']):DispositionDecision=>({state:'evidence-pending',claim,reason,retryable:true});
const complete=(reason:string,claim:DispositionDecision['claim']):DispositionDecision=>({state:'completed',claim,reason,retryable:false});

// This is intentionally a decision engine, not a timer. It never invents a
// duration, provider capability, clinical classification or retained schema.
// The caller must bind those facts to separately approved, durable evidence.
export function decidePolicyDisposition(input:PolicyDispositionInput):DispositionDecision{
 if(input.hold||input.exception)return retained('A legal hold, clinical duty or recorded exception requires retention.');
 switch(input.recordClass){
  case 'patient-record':
   if(!input.jurisdictionScheduleApproved)return blocked('No jurisdiction-specific clinical, privacy and legal schedule is approved.');
   if(!input.minimumEvidenceSchemaApproved)return blocked('No minimum retained evidence schema is approved.');
   return pending('Approved patient-record policy exists, but no physical or cryptographic disposal adapter is configured.');
  case 'model-output':
   if(input.classification==='unclassified')return blocked('The model output has no approved clinical classification.');
   if(input.classification==='patient-record')return retained('The model output inherits the patient-record retention duty.');
   if(!input.provenanceEnvelopeRetained||!input.humanDecisionRetained)return blocked('Non-authoritative output disposal requires provenance and the human decision to remain.');
   return pending('Raw non-authoritative output is eligible only through a content-erasure adapter with durable evidence.');
  case 'field-package':case 'local-cache':
   if(!input.expired)return retained('The approved package or cache expiry has not been reached.');
   if(input.unsyncedClinicalWork)return blocked('Unsynced clinical work prevents package or cache disposal.');
   if(!input.keyInaccessible)return pending('The package encryption key is still accessible.');
   if(!input.authoritativeDeviceEvidence)return evidence('Cryptographic erasure is recorded, but physical device erasure is unverified.','crypto-erased');
   return complete('Key inaccessibility and authoritative device evidence are both verified.','physically-deleted');
  case 'audit-event':
   if(input.detailErasureDesign==='unapproved')return retained('The immutable audit chain remains fully retained until a detail-erasure design is approved.');
   if(!input.minimumEnvelopeRetained||!input.chainVerified)return blocked('Audit detail erasure cannot break the minimum envelope or chain verification.');
   if(input.detailErasureDesign==='cryptographic'&&!input.detailKeyInaccessible)return pending('The approved audit-detail key remains accessible.');
   return complete('Sensitive audit detail is unavailable while the verified minimum chain envelope remains.','crypto-erased');
  case 'export':
   if(input.serverPayloadPersisted)return blocked('Server export payloads must be ephemeral; dispose the server copy through its owning store first.',true);
   if(!input.destinationRegistered)return blocked('The export destination and accountable owner are not registered.');
   if(!input.keyInaccessible)return pending('The encrypted export key remains accessible.');
   if(!input.authoritativeDestinationEvidence)return evidence('The export is cryptographically erased, but destination deletion is unverified.','crypto-erased');
   return complete('The export key is inaccessible and the registered destination supplied authoritative deletion evidence.','physically-deleted');
  case 'backup':
   if(!input.recoveryWindowApproved)return blocked('No tested recovery window is approved for this backup generation.');
   if(!input.tombstoneAwareRestoreVerified)return blocked('Restore has not been verified to reapply current holds and tombstones.');
   if(!input.generationKeyInaccessible)return pending('The backup generation key remains accessible.');
   if(!input.providerGenerationEvidence)return evidence('The generation is cryptographically erased, but provider replica/version deletion is unverified.','crypto-erased');
   return complete('The generation key is inaccessible and provider generation deletion is verified.','physically-deleted');
 }
}

export function assertPhysicalDeletionClaim(input:PolicyDispositionInput){const decision=decidePolicyDisposition(input);if(decision.state!=='completed'||decision.claim!=='physically-deleted')fail(409,`Physical deletion is not verified. ${decision.reason}`);return decision;}
