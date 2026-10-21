import assert from 'node:assert/strict';
import {executeRetentionLiveQa,retentionLiveQaPlan} from '../scripts/saha-retention-live-qa.mjs';

let calls=0;
const env={SAHA_ENVIRONMENT:'production',SAHA_RETENTION_OBJECT_DELETE:'digitalocean-spaces-versioned-v1',SAHA_RETENTION_SPACES_ENDPOINT:'https://blr1.digitaloceanspaces.com',SAHA_RETENTION_SPACES_REGION:'blr1',SAHA_RETENTION_SPACES_ACCOUNT_ID:'synthetic-account',SAHA_RETENTION_SPACES_BUCKET:'synthetic-private-bucket',SAHA_RETENTION_SPACES_VERSIONING_EVIDENCE:'VERSIONING-EVIDENCE',SAHA_RETENTION_SPACES_EXACT_VERSION_DELETE_EVIDENCE:'EXACT-DELETE-EVIDENCE',SAHA_RETENTION_SPACES_ACCOUNT_BUCKET_EVIDENCE:'ACCOUNT-BUCKET-EVIDENCE'};
const input={runId:'synthetic-run-1',syntheticOnly:true,exportObjectKey:'qa/export-1',backupObjectKey:'qa/backup-1',tombstones:['tombstone-1']};
assert.throws(()=>retentionLiveQaPlan({},input),/required|capability/);
assert.throws(()=>retentionLiveQaPlan(env,{...input,syntheticOnly:false}),/syntheticOnly/);
assert.throws(()=>retentionLiveQaPlan(env,{...input,backupObjectKey:input.exportObjectKey}),/distinct/);
const plan=retentionLiveQaPlan(env,input);
assert.equal(plan.objects.backup.policy.cadence,'weekly');assert.equal(plan.objects.backup.policy.recoveryWindowDays,7);assert.equal(plan.secretsRecorded,false);assert.equal(JSON.stringify(plan).includes('synthetic-account'),false);assert.equal(JSON.stringify(plan).includes('synthetic-private-bucket'),false);assert.equal(calls,0);
await assert.rejects(()=>executeRetentionLiveQa(env,input,{}),/acknowledgement/);assert.equal(calls,0);
const liveEnv={...env,SAHA_RETENTION_LIVE_QA_APPROVED:'execute-synthetic-exact-version-qa'},versions=new Map();
const adapter={putSyntheticObject:async({key})=>{calls++;const r={versionId:`version-${calls}`,etag:`etag-${calls}`,requestId:`put-${calls}`};versions.set(`${key}:${r.versionId}`,true);return r;},registerExactCustody:async({recordId})=>{calls++;return{artifactId:`artifact-${recordId}`};},verifyExportControls:async()=>{calls++;return{serverPayloadAbsent:true,keyInaccessible:true,evidenceRef:'export-controls-1'};},restoreBackupWithTombstones:async()=>{calls++;return{withinRecoveryWindow:true,allTombstonesReapplied:true,evidenceRef:'restore-proof-1'};},deleteExactVersion:async({key,versionId})=>{calls++;versions.set(`${key}:${versionId}`,false);return{status:204,versionId,requestId:`delete-${calls}`};},headExactVersion:async({key,versionId})=>{calls++;return{exists:versions.get(`${key}:${versionId}`)===true};}};
const result=await executeRetentionLiveQa(liveEnv,input,adapter);
assert.equal(result.verdict,'QA_PASS');assert.equal(result.receipts.backup.tombstonesReapplied,true);assert.equal(result.receipts.export.exactVersionAbsent,true);assert.equal(result.secretsRecorded,false);assert.equal(calls,10);assert.equal(JSON.stringify(result).includes('synthetic-account'),false);
const refusalAdapter={...adapter,verifyExportControls:async()=>({serverPayloadAbsent:true,keyInaccessible:false,evidenceRef:'failed-control'})};
await assert.rejects(()=>executeRetentionLiveQa(liveEnv,input,refusalAdapter),/not proven/);
console.log(JSON.stringify({suite:'SAHA-130 live QA harness',passed:18,providerCalls:0,syntheticAdapterCalls:calls}));
