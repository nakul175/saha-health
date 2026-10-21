import assert from 'node:assert/strict';
import ts from 'typescript';
import {mkdtempSync,readdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

const dir=mkdtempSync(join(process.cwd(),'.retention-cross-class-qa-'));
try {
  for(const file of readdirSync('lib/saha').filter(x=>x.endsWith('.ts'))){
    const output=ts.transpileModule(readFileSync(join('lib/saha',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'");
    writeFileSync(join(dir,file.replace('.ts','.js')),output);
  }
  const policy=await import(pathToFileURL(join(dir,'retention-class-policy.js')));
  const retention=await import(pathToFileURL(join(dir,'retention.js')));
  let checks=0;
  const eq=(actual,expected,message)=>{assert.equal(actual,expected,message);checks++;};
  const decision=value=>policy.decidePolicyDisposition({hold:false,...value});
  const at='2026-01-01T00:00:00.000Z';
  const tombstone=(recordClass,recordId,personId)=>({id:`t-${recordClass}`,recordClass,recordId,...(personId?{personId}:{}),policyVersion:1,triggerAt:at,purpose:'synthetic QA purpose',location:'synthetic QA store',jurisdiction:'synthetic QA jurisdiction',disposedBy:'qa-owner',disposedAt:at,reason:'Synthetic cross-class restore check.'});
  const state=()=>({
    organisation:{id:'org',name:'Synthetic',revision:1,createdAt:at},members:[],teams:[],invitations:[],
    retention:{policies:[],holds:[],artifacts:[],tombstones:[]},
    workspace:{schemaVersion:1,revision:1,role:'clinician',people:[{id:'p1',name:'Synthetic patient',age:40,sex:'Other',village:'Synthetic',programmes:[],task:'',due:'',status:'due',aiConsent:false,exchangeConsent:false,consentVersion:1,assigned:true,createdAt:at,version:1,teamId:'team',assignedTo:null,fieldLeases:[{id:'field1',actorId:'worker',memberVersion:1,visitId:'v1',visitVersion:1,identityHash:'hash',consentVersion:1,expiresAt:at,status:'active',packageHash:'package',createdAt:at},{id:'cache1',actorId:'worker',memberVersion:1,visitId:'v1',visitVersion:1,identityHash:'hash',consentVersion:1,expiresAt:at,status:'active',packageHash:'cache',createdAt:at}]}],visits:[{id:'v1',personId:'p1',version:1,state:'confirmed',facts:{date:at,systolic:'',diastolic:'',weight:'',temperature:'',weeks:'',coughDays:'',notes:'',source:'measured'},createdAt:at,confirmedAt:at,aiResults:[{id:'model1',providerId:'provider',providerName:'Synthetic provider',mode:'demo',status:'succeeded',text:'synthetic output',createdAt:at,inputHash:'hash',reviewed:false}],recordVersion:1}],integrations:[],submissions:[],referrals:[],audit:[],receipts:{}},
  });

  let restored=state();restored.retention.tombstones=[tombstone('patient-record','p1','p1')];
  retention.applyRetentionTombstones(restored);
  eq(restored.workspace.people.length,0,'a restored patient tombstone hides the patient before availability');
  eq(restored.workspace.visits.length,0,'a restored patient tombstone hides dependent visits before availability');

  restored=state();restored.retention.tombstones=[tombstone('model-output','model1','p1')];retention.applyRetentionTombstones(restored);
  eq(restored.workspace.visits[0].aiResults.length,0,'a restored model-output tombstone removes the raw output');
  restored=state();restored.retention.tombstones=[tombstone('field-package','field1','p1'),tombstone('local-cache','cache1','p1')];retention.applyRetentionTombstones(restored);
  eq(restored.workspace.people[0].fieldLeases.length,0,'restored offline tombstones remove field packages and cache leases');
  restored=state();restored.retention.tombstones=[tombstone('audit-event','audit1')];
  assert.throws(()=>retention.applyRetentionTombstones(restored),e=>e.status===503&&/Immutable audit events/.test(e.message));checks++;

  eq(decision({recordClass:'patient-record',jurisdictionScheduleApproved:false,minimumEvidenceSchemaApproved:true}).state,'policy-blocked');
  eq(decision({recordClass:'model-output',classification:'unclassified',provenanceEnvelopeRetained:false,humanDecisionRetained:false}).state,'policy-blocked');
  eq(decision({recordClass:'field-package',expired:true,unsyncedClinicalWork:true,keyInaccessible:true,authoritativeDeviceEvidence:true}).state,'policy-blocked');
  eq(decision({recordClass:'audit-event',detailErasureDesign:'unapproved',minimumEnvelopeRetained:true,chainVerified:true,detailUnavailable:false}).state,'retained');
  eq(decision({recordClass:'export',serverPayloadPersisted:false,destinationRegistered:false,keyInaccessible:true,authoritativeDestinationEvidence:true}).state,'policy-blocked');
  eq(decision({recordClass:'backup',recoveryWindowApproved:true,tombstoneAwareRestoreVerified:false,generationKeyInaccessible:true,providerGenerationEvidence:true}).state,'policy-blocked');

  eq(decision({recordClass:'field-package',expired:true,unsyncedClinicalWork:false,keyInaccessible:true,authoritativeDeviceEvidence:false}).state,'evidence-pending');
  eq(decision({recordClass:'audit-event',detailErasureDesign:'checkpoint-linked',minimumEnvelopeRetained:true,chainVerified:true,detailUnavailable:false}).state,'evidence-pending');
  eq(decision({recordClass:'export',serverPayloadPersisted:false,destinationRegistered:true,keyInaccessible:true,authoritativeDestinationEvidence:false}).state,'evidence-pending');
  eq(decision({recordClass:'backup',recoveryWindowApproved:true,tombstoneAwareRestoreVerified:true,generationKeyInaccessible:true,providerGenerationEvidence:false}).state,'evidence-pending');

  for(const input of [
    {recordClass:'patient-record',jurisdictionScheduleApproved:true,minimumEvidenceSchemaApproved:true},
    {recordClass:'model-output',classification:'non-authoritative-assistance',provenanceEnvelopeRetained:true,humanDecisionRetained:true},
    {recordClass:'field-package',expired:true,unsyncedClinicalWork:false,keyInaccessible:true,authoritativeDeviceEvidence:true},
    {recordClass:'audit-event',detailErasureDesign:'cryptographic',minimumEnvelopeRetained:true,chainVerified:true,detailUnavailable:true,detailKeyInaccessible:true},
    {recordClass:'export',serverPayloadPersisted:false,destinationRegistered:true,keyInaccessible:true,authoritativeDestinationEvidence:true},
    {recordClass:'backup',recoveryWindowApproved:true,tombstoneAwareRestoreVerified:true,generationKeyInaccessible:true,providerGenerationEvidence:true},
  ])eq(decision({...input,hold:true}).state,'retained','a hold overrides every class-specific disposal path');

  console.log(JSON.stringify({suite:'SAHA-130 cross-class QA contract',passed:checks,classes:['patient-record','model-output','field-package/local-cache','audit-event','export','backup'],externalCalls:0}));
} finally {
  rmSync(dir,{recursive:true,force:true});
}
