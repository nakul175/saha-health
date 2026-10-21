import assert from 'node:assert/strict';
import ts from 'typescript';
import {mkdtempSync,readFileSync,readdirSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

const dir=mkdtempSync(join(process.cwd(),'.retention-class-policy-'));
try{
 for(const file of readdirSync('lib/saha').filter(x=>x.endsWith('.ts'))){const output=ts.transpileModule(readFileSync(join('lib/saha',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'");writeFileSync(join(dir,file.replace('.ts','.js')),output);}
 const {decidePolicyDisposition,assertPhysicalDeletionClaim,retentionMilestones,validateRetentionProductDefaults,RETENTION_PRODUCT_DEFAULTS}=await import(pathToFileURL(join(dir,'retention-class-policy.js')));
 const decide=(value)=>decidePolicyDisposition({hold:false,...value});
 let checks=0,eq=(actual,expected)=>{assert.equal(actual,expected);checks++;};

 eq(decide({recordClass:'patient-record',jurisdictionScheduleApproved:false,minimumEvidenceSchemaApproved:false}).state,'policy-blocked');
 eq(decide({recordClass:'patient-record',jurisdictionScheduleApproved:true,minimumEvidenceSchemaApproved:false}).state,'policy-blocked');
 eq(decide({recordClass:'patient-record',jurisdictionScheduleApproved:true,minimumEvidenceSchemaApproved:true}).state,'purge-pending');
 eq(decide({recordClass:'patient-record',hold:true,jurisdictionScheduleApproved:true,minimumEvidenceSchemaApproved:true}).state,'retained');

 eq(decide({recordClass:'model-output',classification:'unclassified',provenanceEnvelopeRetained:false,humanDecisionRetained:false}).state,'policy-blocked');
 eq(decide({recordClass:'model-output',classification:'patient-record',provenanceEnvelopeRetained:false,humanDecisionRetained:false}).state,'retained');
 eq(decide({recordClass:'model-output',classification:'non-authoritative-assistance',provenanceEnvelopeRetained:false,humanDecisionRetained:true}).state,'policy-blocked');
 eq(decide({recordClass:'model-output',classification:'non-authoritative-assistance',provenanceEnvelopeRetained:true,humanDecisionRetained:true}).state,'purge-pending');

 const offline={recordClass:'field-package',expired:true,unsyncedClinicalWork:false,keyInaccessible:true,authoritativeDeviceEvidence:false,appAcknowledged:true};
 eq(decide(offline).state,'evidence-pending');eq(decide(offline).claim,'crypto-erased');
 eq(decide({...offline,unsyncedClinicalWork:true}).state,'policy-blocked');
 eq(decide({...offline,authoritativeDeviceEvidence:true}).state,'completed');
 eq(decide({...offline,authoritativeDeviceEvidence:true}).claim,'physically-deleted');
 eq(decide({...offline,recordClass:'local-cache',expired:false}).state,'retained');

 eq(decide({recordClass:'audit-event',detailErasureDesign:'unapproved',minimumEnvelopeRetained:true,chainVerified:true,detailUnavailable:false}).state,'retained');
 eq(decide({recordClass:'audit-event',detailErasureDesign:'checkpoint-linked',minimumEnvelopeRetained:false,chainVerified:true,detailUnavailable:false}).state,'policy-blocked');
 eq(decide({recordClass:'audit-event',detailErasureDesign:'checkpoint-linked',minimumEnvelopeRetained:true,chainVerified:true,detailUnavailable:false}).state,'evidence-pending');
 eq(decide({recordClass:'audit-event',detailErasureDesign:'cryptographic',minimumEnvelopeRetained:true,chainVerified:true,detailUnavailable:false,detailKeyInaccessible:false}).state,'purge-pending');
 eq(decide({recordClass:'audit-event',detailErasureDesign:'cryptographic',minimumEnvelopeRetained:true,chainVerified:true,detailUnavailable:true,detailKeyInaccessible:true}).claim,'crypto-erased');

 const exported={recordClass:'export',serverPayloadPersisted:false,destinationRegistered:true,keyInaccessible:true,authoritativeDestinationEvidence:false};
 eq(decide({...exported,serverPayloadPersisted:true}).state,'policy-blocked');
 eq(decide({...exported,destinationRegistered:false}).state,'policy-blocked');
 eq(decide(exported).state,'evidence-pending');
 eq(decide({...exported,authoritativeDestinationEvidence:true}).state,'completed');

 const backup={recordClass:'backup',recoveryWindowApproved:true,tombstoneAwareRestoreVerified:true,generationKeyInaccessible:true,providerGenerationEvidence:false};
 eq(decide({...backup,recoveryWindowApproved:false}).state,'policy-blocked');
 eq(decide({...backup,tombstoneAwareRestoreVerified:false}).state,'policy-blocked');
 eq(decide(backup).state,'evidence-pending');
 eq(decide({...backup,providerGenerationEvidence:true}).state,'completed');
 eq(decide({...backup,providerGenerationEvidence:true,exception:true}).state,'retained');

 assert.throws(()=>assertPhysicalDeletionClaim(exported),e=>e.status===409&&/Physical deletion is not verified/.test(e.message));checks++;
 assert.doesNotThrow(()=>assertPhysicalDeletionClaim({...exported,authoritativeDestinationEvidence:true}));checks++;
 const trigger='2024-02-29T00:00:00.000Z';
 eq(retentionMilestones('patient-record',trigger).recommendedAt,'2027-02-28T00:00:00.000Z');
 eq(retentionMilestones('patient-record',trigger).policyApprovalRequired,true);
 eq(retentionMilestones('model-output','2026-01-01T00:00:00.000Z').recommendedAt,'2026-01-31T00:00:00.000Z');
 let milestone=retentionMilestones('field-package','2026-01-01T00:00:00.000Z');eq(milestone.recommendedAt,'2026-01-08T00:00:00.000Z');eq(milestone.hardMaxAt,'2026-01-31T00:00:00.000Z');
 milestone=retentionMilestones('audit-event',trigger);eq(milestone.recommendedAt,'2025-02-28T00:00:00.000Z');eq(milestone.hardMaxAt,'2031-02-28T00:00:00.000Z');
 milestone=retentionMilestones('export','2026-01-01T00:00:00.000Z');eq(milestone.recommendedAt,'2026-01-02T00:00:00.000Z');eq(milestone.hardMaxAt,'2026-01-08T00:00:00.000Z');
 eq(retentionMilestones('backup','2026-01-01T00:00:00.000Z',{backupCadence:'daily'}).recommendedAt,'2026-02-05T00:00:00.000Z');
 eq(retentionMilestones('backup',trigger,{backupCadence:'monthly'}).recommendedAt,'2025-02-28T00:00:00.000Z');
 assert.throws(()=>retentionMilestones('backup',trigger),e=>e.status===422);checks++;
 assert.throws(()=>retentionMilestones('patient-record','2026-01-01'),e=>e.status===422);checks++;
 assert.throws(()=>validateRetentionProductDefaults({...RETENTION_PRODUCT_DEFAULTS,offlineLeaseDays:31,offlineHardMaxDays:30}),e=>e.status===422);checks++;
 assert.throws(()=>validateRetentionProductDefaults({...RETENTION_PRODUCT_DEFAULTS,auditSensitiveDetailYears:8,auditEnvelopeYears:7}),e=>e.status===422);checks++;
 assert.throws(()=>validateRetentionProductDefaults({...RETENTION_PRODUCT_DEFAULTS,exportServerHours:200,exportKeyDays:7}),e=>e.status===422);checks++;
 const custom=retentionMilestones('model-output','2026-01-01T00:00:00.000Z',{config:{...RETENTION_PRODUCT_DEFAULTS,externalModelRawDays:14}});eq(custom.recommendedAt,'2026-01-15T00:00:00.000Z');
 eq(decide({recordClass:'patient-record',jurisdictionScheduleApproved:false,minimumEvidenceSchemaApproved:true}).state,'policy-blocked');
 console.log(JSON.stringify({suite:'retention class policy contract',passed:checks}));
}finally{rmSync(dir,{recursive:true,force:true});}
