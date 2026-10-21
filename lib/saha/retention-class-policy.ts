import {fail} from './core';

export const POLICY_CONTROLLED_CLASSES=['patient-record','model-output','field-package','local-cache','audit-event','export','backup'] as const;
export type PolicyControlledClass=typeof POLICY_CONTROLLED_CLASSES[number];
export type DispositionState='retained'|'policy-blocked'|'purge-pending'|'evidence-pending'|'completed';
export type DispositionDecision={state:DispositionState;claim:'retained'|'crypto-erased'|'physically-deleted';reason:string;retryable:boolean};

type Common={recordClass:PolicyControlledClass;hold:boolean;exception?:boolean};
export type PatientRecordDisposition=Common&{recordClass:'patient-record';jurisdictionScheduleApproved:boolean;minimumEvidenceSchemaApproved:boolean};
export type ModelOutputDisposition=Common&{recordClass:'model-output';classification:'unclassified'|'patient-record'|'non-authoritative-assistance';provenanceEnvelopeRetained:boolean;humanDecisionRetained:boolean};
export type OfflineDisposition=Common&{recordClass:'field-package'|'local-cache';expired:boolean;unsyncedClinicalWork:boolean;keyInaccessible:boolean;authoritativeDeviceEvidence:boolean;appAcknowledged?:boolean};
export type AuditDisposition=Common&{recordClass:'audit-event';detailErasureDesign:'unapproved'|'cryptographic'|'checkpoint-linked';minimumEnvelopeRetained:boolean;chainVerified:boolean;detailUnavailable:boolean;detailKeyInaccessible?:boolean};
export type ExportDisposition=Common&{recordClass:'export';serverPayloadPersisted:boolean;destinationRegistered:boolean;keyInaccessible:boolean;authoritativeDestinationEvidence:boolean};
export type BackupDisposition=Common&{recordClass:'backup';recoveryWindowApproved:boolean;tombstoneAwareRestoreVerified:boolean;generationKeyInaccessible:boolean;providerGenerationEvidence:boolean};
export type PolicyDispositionInput=PatientRecordDisposition|ModelOutputDisposition|OfflineDisposition|AuditDisposition|ExportDisposition|BackupDisposition;

export type RetentionProductDefaults={
 patientRecordYears:number;externalModelRawDays:number;offlineLeaseDays:number;offlineHardMaxDays:number;
 auditEnvelopeYears:number;auditSensitiveDetailYears:number;exportServerHours:number;exportKeyDays:number;
 backupDailyDays:number;backupMonthlyMonths:number;
};
// Product defaults are configuration proposals, not legal, privacy, clinical or
// audit approval. Eligibility calculations never bypass decidePolicyDisposition.
export const RETENTION_PRODUCT_DEFAULTS:Readonly<RetentionProductDefaults>=Object.freeze({patientRecordYears:3,externalModelRawDays:30,offlineLeaseDays:7,offlineHardMaxDays:30,auditEnvelopeYears:7,auditSensitiveDetailYears:1,exportServerHours:24,exportKeyDays:7,backupDailyDays:35,backupMonthlyMonths:12});
export type RetentionMilestones={recommendedAt:string;hardMaxAt?:string;policyApprovalRequired:true;basis:'product-default'};
const positive=(value:number,name:string)=>{if(!Number.isInteger(value)||value<=0)fail(422,`${name} must be a positive whole number.`);return value;};
export function validateRetentionProductDefaults(value:RetentionProductDefaults){for(const [name,v] of Object.entries(value))positive(v,name);if(value.offlineHardMaxDays<value.offlineLeaseDays)fail(422,'offlineHardMaxDays cannot be shorter than offlineLeaseDays.');if(value.auditEnvelopeYears<value.auditSensitiveDetailYears)fail(422,'auditEnvelopeYears cannot be shorter than auditSensitiveDetailYears.');if(value.exportKeyDays*24<value.exportServerHours)fail(422,'exportKeyDays cannot expire before the server payload window.');return Object.freeze({...value});}
const instant=(value:string)=>{const d=new Date(value);if(!Number.isFinite(d.valueOf())||d.toISOString()!==value)fail(422,'A canonical UTC instant is required.');return d;};
const days=(at:string,count:number)=>new Date(instant(at).valueOf()+positive(count,'days')*86400000).toISOString();
const hours=(at:string,count:number)=>new Date(instant(at).valueOf()+positive(count,'hours')*3600000).toISOString();
const calendar=(at:string,count:number,unit:'years'|'months')=>{const d=instant(at),day=d.getUTCDate();if(unit==='years')d.setUTCFullYear(d.getUTCFullYear()+positive(count,unit));else d.setUTCMonth(d.getUTCMonth()+positive(count,unit));if(d.getUTCDate()!==day)d.setUTCDate(0);return d.toISOString();};
export function retentionMilestones(recordClass:PolicyControlledClass,triggerAt:string,options:{config?:RetentionProductDefaults;backupCadence?:'daily'|'monthly'}={}):RetentionMilestones{
 const c=validateRetentionProductDefaults(options.config??RETENTION_PRODUCT_DEFAULTS),base={policyApprovalRequired:true as const,basis:'product-default' as const};
 switch(recordClass){
  case 'patient-record':return {...base,recommendedAt:calendar(triggerAt,c.patientRecordYears,'years')};
  case 'model-output':return {...base,recommendedAt:days(triggerAt,c.externalModelRawDays)};
  case 'field-package':case 'local-cache':return {...base,recommendedAt:days(triggerAt,c.offlineLeaseDays),hardMaxAt:days(triggerAt,c.offlineHardMaxDays)};
  case 'audit-event':return {...base,recommendedAt:calendar(triggerAt,c.auditSensitiveDetailYears,'years'),hardMaxAt:calendar(triggerAt,c.auditEnvelopeYears,'years')};
  case 'export':return {...base,recommendedAt:hours(triggerAt,c.exportServerHours),hardMaxAt:days(triggerAt,c.exportKeyDays)};
  case 'backup':if(!options.backupCadence)fail(422,'Backup cadence is required.');return {...base,recommendedAt:options.backupCadence==='daily'?days(triggerAt,c.backupDailyDays):calendar(triggerAt,c.backupMonthlyMonths,'months')};
 }
}

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
   if(!input.detailUnavailable)return evidence('The approved audit-detail design exists, but unavailability of the sensitive detail is not verified.','retained');
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
