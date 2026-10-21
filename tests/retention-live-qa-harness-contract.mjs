import assert from 'node:assert/strict';
import {executeRetentionLiveQa,retentionLiveQaPlan} from '../scripts/saha-retention-live-qa.mjs';

let calls=0;
const runId='synthetic-run-00000000-0000-4000-8000-000000000001',tombstone='synthetic-tombstone-00000000-0000-4000-8000-000000000002',prefix='saha-retention-live-qa';
const env={SAHA_ENVIRONMENT:'production',SAHA_RETENTION_OBJECT_DELETE:'digitalocean-spaces-versioned-v1',SAHA_RETENTION_SPACES_ENDPOINT:'https://blr1.digitaloceanspaces.com',SAHA_RETENTION_SPACES_REGION:'blr1',SAHA_RETENTION_SPACES_ACCOUNT_ID:'synthetic-account',SAHA_RETENTION_SPACES_BUCKET:'synthetic-private-bucket',SAHA_RETENTION_SPACES_VERSIONING_EVIDENCE:'VERSIONING-EVIDENCE',SAHA_RETENTION_SPACES_EXACT_VERSION_DELETE_EVIDENCE:'EXACT-DELETE-EVIDENCE',SAHA_RETENTION_SPACES_ACCOUNT_BUCKET_EVIDENCE:'ACCOUNT-BUCKET-EVIDENCE',SAHA_RETENTION_LIVE_QA_PREFIX:prefix};
const input={runId,syntheticOnly:true,exportObjectKey:`${prefix}/${runId}/export.json`,backupObjectKey:`${prefix}/${runId}/backup.json`,tombstones:[tombstone]};
assert.throws(()=>retentionLiveQaPlan({},input),/required|capability/);
assert.throws(()=>retentionLiveQaPlan(env,{...input,syntheticOnly:false}),/syntheticOnly/);
assert.throws(()=>retentionLiveQaPlan(env,{...input,backupObjectKey:'real/backup.json'}),/derived/);assert.throws(()=>retentionLiveQaPlan({...env,SAHA_RETENTION_LIVE_QA_PREFIX:'../real'},input),/unsafe/);
const plan=retentionLiveQaPlan(env,input);
assert.equal(plan.objects.backup.policy.cadence,'daily');assert.equal(plan.objects.backup.policy.dailyRecoveryDays,35);assert.equal(plan.objects.backup.policy.monthlyCheckpointMonths,12);assert.equal(plan.secretsRecorded,false);assert.equal(JSON.stringify(plan).includes('synthetic-account'),false);assert.equal(JSON.stringify(plan).includes('synthetic-private-bucket'),false);assert.equal(calls,0);
await assert.rejects(()=>executeRetentionLiveQa(env,input,{}),/acknowledgement/);assert.equal(calls,0);
let namespaceCalls=0;const noCallAdapter={putSyntheticObject:async()=>{namespaceCalls++;}};
for(const [badEnv,badInput,pattern] of [
 [{...env,SAHA_RETENTION_LIVE_QA_PREFIX:'backups'},{...input,exportObjectKey:`backups/${runId}/export.json`,backupObjectKey:`backups/${runId}/backup.json`},/namespace/],
 [env,{...input,runId:'customer-123',exportObjectKey:`${prefix}/customer-123/export.json`,backupObjectKey:`${prefix}/customer-123/backup.json`},/synthetic run/],
 [env,{...input,tombstones:['patient-123']},/synthetic tombstone/],
 [{...env,SAHA_RETENTION_LIVE_QA_PREFIX:`${prefix}/../backups`},input,/namespace/],
 [env,{...input,exportObjectKey:'customer/export.json'},/derived/]
])await assert.rejects(()=>executeRetentionLiveQa({...badEnv,SAHA_RETENTION_LIVE_QA_APPROVED:'execute-synthetic-exact-version-qa'},badInput,noCallAdapter),pattern);
assert.equal(namespaceCalls,0);
const liveEnv={...env,SAHA_RETENTION_LIVE_QA_APPROVED:'execute-synthetic-exact-version-qa'},versions=new Map();
const adapter={putSyntheticObject:async({key})=>{calls++;const r={versionId:`version-${calls}`,etag:`etag-${calls}`,requestId:`put-${calls}`};versions.set(`${key}:${r.versionId}`,true);return r;},registerExactCustody:async({recordId})=>{calls++;return{artifactId:`artifact-${recordId}`};},verifyExportControls:async()=>{calls++;return{serverPayloadAbsent:true,keyInaccessible:true,evidenceRef:'export-controls-1'};},restoreBackupWithTombstones:async()=>{calls++;return{withinRecoveryWindow:true,allTombstonesReapplied:true,evidenceRef:'restore-proof-1'};},deleteExactVersion:async({key,versionId})=>{calls++;versions.set(`${key}:${versionId}`,false);return{status:204,versionId,requestId:`delete-${calls}`};},headExactVersion:async({key,versionId})=>{calls++;return{exists:versions.get(`${key}:${versionId}`)===true};}};
const result=await executeRetentionLiveQa(liveEnv,input,adapter);
assert.equal(result.verdict,'QA_PASS');assert.equal(result.receipts.backup.tombstonesReapplied,true);assert.equal(result.receipts.export.exactVersionAbsent,true);assert.equal(result.secretsRecorded,false);assert.equal(calls,10);assert.equal(JSON.stringify(result).includes('synthetic-account'),false);
let refusedVersions=new Map(),cleanupCalls=0;const refusalAdapter={...adapter,putSyntheticObject:async({key})=>{const r={versionId:`refused-${key}`,etag:`etag-${key}`,requestId:`put-${key}`};refusedVersions.set(`${key}:${r.versionId}`,true);return r;},verifyExportControls:async()=>({serverPayloadAbsent:true,keyInaccessible:false,evidenceRef:'failed-control'}),deleteExactVersion:async({key,versionId})=>{cleanupCalls++;refusedVersions.set(`${key}:${versionId}`,false);return{status:204,versionId,requestId:`cleanup-${cleanupCalls}`};},headExactVersion:async({key,versionId})=>({exists:refusedVersions.get(`${key}:${versionId}`)===true})};
const refused=await executeRetentionLiveQa(liveEnv,input,refusalAdapter);assert.equal(refused.verdict,'QA_HOLD');assert.match(refused.failure,/not proven/);assert.equal(refused.cleanupConfirmed,true);assert.equal(cleanupCalls,2);assert.equal([...refusedVersions.values()].every(x=>x===false),true);
const failedCleanupAdapter={...refusalAdapter,deleteExactVersion:async({versionId})=>{throw Error(`cannot delete ${versionId}`);}};const held=await executeRetentionLiveQa(liveEnv,input,failedCleanupAdapter);assert.equal(held.verdict,'QA_HOLD');assert.equal(held.cleanupConfirmed,false);assert.equal(held.cleanup.some(x=>!x.absent),true);
console.log(JSON.stringify({suite:'SAHA-130 live QA harness',passed:35,providerCalls:0,syntheticAdapterCalls:calls}));
