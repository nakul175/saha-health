#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const sha=value=>createHash('sha256').update(String(value)).digest('hex');
const required=(value,name)=>{if(typeof value!=='string'||value.trim().length<3)throw Error(`${name} is required.`);return value.trim();};
const safeEndpoint=(value,region)=>{const u=new URL(required(value,'SAHA_RETENTION_SPACES_ENDPOINT'));if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||(u.pathname!==''&&u.pathname!=='/')||u.origin!==`https://${region}.digitaloceanspaces.com`)throw Error('The trusted Spaces endpoint must be the regional HTTPS endpoint.');return u.origin;};

export function retentionLiveQaPlan(env,input){
 const region=required(env.SAHA_RETENTION_SPACES_REGION,'SAHA_RETENTION_SPACES_REGION');if(!/^[a-z]{2,8}[0-9]$/.test(region))throw Error('The trusted Spaces region is malformed.');
 if(env.SAHA_ENVIRONMENT!=='production'||env.SAHA_RETENTION_OBJECT_DELETE!=='digitalocean-spaces-versioned-v1')throw Error('The verified production DigitalOcean Spaces exact-version capability is required.');
 const endpoint=safeEndpoint(env.SAHA_RETENTION_SPACES_ENDPOINT,region),accountId=required(env.SAHA_RETENTION_SPACES_ACCOUNT_ID,'SAHA_RETENTION_SPACES_ACCOUNT_ID'),bucket=required(env.SAHA_RETENTION_SPACES_BUCKET,'SAHA_RETENTION_SPACES_BUCKET');
 for(const name of ['SAHA_RETENTION_SPACES_VERSIONING_EVIDENCE','SAHA_RETENTION_SPACES_EXACT_VERSION_DELETE_EVIDENCE','SAHA_RETENTION_SPACES_ACCOUNT_BUCKET_EVIDENCE'])if(required(env[name],name).length<8)throw Error(`${name} is too short.`);
 if(!input||input.syntheticOnly!==true)throw Error('The manifest must explicitly declare syntheticOnly=true.');
 const runId=required(input.runId,'runId'),exportKey=required(input.exportObjectKey,'exportObjectKey'),backupKey=required(input.backupObjectKey,'backupObjectKey');if(exportKey===backupKey)throw Error('Export and backup must use distinct synthetic object keys.');
 if(!Array.isArray(input.tombstones)||input.tombstones.length<1||input.tombstones.some(x=>typeof x!=='string'||x.length<3))throw Error('At least one synthetic tombstone identifier is required.');
 return {schemaVersion:1,story:'SAHA-130',runId,syntheticOnly:true,provider:'digitalocean-spaces',trustedConfiguration:{endpoint,region,accountIdSha256:sha(accountId),bucketSha256:sha(bucket)},objects:{export:{keySha256:sha(exportKey),policy:{destinationOwner:'Saha Health system owner pending named human',requireServerPayloadAbsent:true,requireKeyInaccessible:true}},backup:{keySha256:sha(backupKey),policy:{cadence:'daily',dailyRecoveryDays:35,monthlyCheckpointMonths:12,exactVersionDeletionAfterWindow:true,restoreMustReapplyTombstones:true},tombstoneSetSha256:sha([...input.tombstones].sort().join('\n'))}},steps:['create exact immutable versions','register exact custody','prove export server payload absent and export key inaccessible','restore backup inside the approved 35-day daily recovery window and prove tombstones reapplied','delete each exact version','prove each exact version absent'],liveCallsPlanned:10,secretsRecorded:false};
}

const exactReceipt=(receipt,label)=>{if(!receipt||typeof receipt.versionId!=='string'||receipt.versionId.length<3||typeof receipt.etag!=='string'||receipt.etag.length<3||typeof receipt.requestId!=='string'||receipt.requestId.length<3)throw Error(`${label} did not return exact version, ETag and request receipt evidence.`);return receipt;};
const deletionReceipt=(receipt,versionId,label)=>{if(!receipt||receipt.status!==204||receipt.versionId!==versionId||typeof receipt.requestId!=='string'||receipt.requestId.length<3)throw Error(`${label} exact-version deletion was not confirmed.`);return receipt;};

export async function executeRetentionLiveQa(env,input,adapter){
 const plan=retentionLiveQaPlan(env,input);if(env.SAHA_RETENTION_LIVE_QA_APPROVED!=='execute-synthetic-exact-version-qa')throw Error('Live execution acknowledgement is absent. Dry-run only.');
 for(const method of ['putSyntheticObject','registerExactCustody','verifyExportControls','restoreBackupWithTombstones','deleteExactVersion','headExactVersion'])if(typeof adapter?.[method]!=='function')throw Error(`The trusted live adapter does not implement ${method}.`);
 const payload=kind=>Buffer.from(JSON.stringify({synthetic:true,kind,runId:plan.runId,tombstones:input.tombstones})),created=[];
 let exp,bak;
 try{
 exp=exactReceipt(await adapter.putSyntheticObject({key:input.exportObjectKey,payload:payload('export')}),'Export object');created.push({key:input.exportObjectKey,...exp});
 bak=exactReceipt(await adapter.putSyntheticObject({key:input.backupObjectKey,payload:payload('backup')}),'Backup object');created.push({key:input.backupObjectKey,...bak});
 const expRegistration=await adapter.registerExactCustody({recordClass:'export',recordId:`${plan.runId}-export`,objectKey:input.exportObjectKey,versionId:exp.versionId,etag:exp.etag,custodyEvidenceRef:exp.requestId}),bakRegistration=await adapter.registerExactCustody({recordClass:'backup',recordId:`${plan.runId}-backup`,objectKey:input.backupObjectKey,versionId:bak.versionId,etag:bak.etag,custodyEvidenceRef:bak.requestId});
 if(typeof expRegistration?.artifactId!=='string'||typeof bakRegistration?.artifactId!=='string')throw Error('Exact export and backup custody registration was not confirmed.');
 const exportControls=await adapter.verifyExportControls({key:input.exportObjectKey,versionId:exp.versionId,etag:exp.etag});if(exportControls?.serverPayloadAbsent!==true||exportControls?.keyInaccessible!==true||typeof exportControls.evidenceRef!=='string')throw Error('Export payload/key controls were not proven.');
 const restored=await adapter.restoreBackupWithTombstones({key:input.backupObjectKey,versionId:bak.versionId,etag:bak.etag,tombstones:[...input.tombstones],maximumAgeDays:35,monthlyCheckpointMonths:12});if(restored?.withinRecoveryWindow!==true||restored?.allTombstonesReapplied!==true||typeof restored.evidenceRef!=='string')throw Error('Backup restore did not prove the approved recovery window and tombstone reapplication.');
 const expDelete=deletionReceipt(await adapter.deleteExactVersion({key:input.exportObjectKey,versionId:exp.versionId,etag:exp.etag}),exp.versionId,'Export'),bakDelete=deletionReceipt(await adapter.deleteExactVersion({key:input.backupObjectKey,versionId:bak.versionId,etag:bak.etag}),bak.versionId,'Backup');
 if((await adapter.headExactVersion({key:input.exportObjectKey,versionId:exp.versionId})).exists!==false||(await adapter.headExactVersion({key:input.backupObjectKey,versionId:bak.versionId})).exists!==false)throw Error('One or more deleted exact versions remain retrievable.');
 return {...plan,mode:'live',completedAt:new Date().toISOString(),verdict:'QA_PASS',receipts:{export:{artifactIdSha256:sha(expRegistration.artifactId),versionIdSha256:sha(exp.versionId),etagSha256:sha(exp.etag),custodyRequestIdSha256:sha(exp.requestId),controlEvidenceRefSha256:sha(exportControls.evidenceRef),deleteRequestIdSha256:sha(expDelete.requestId),exactVersionAbsent:true},backup:{artifactIdSha256:sha(bakRegistration.artifactId),versionIdSha256:sha(bak.versionId),etagSha256:sha(bak.etag),custodyRequestIdSha256:sha(bak.requestId),restoreEvidenceRefSha256:sha(restored.evidenceRef),deleteRequestIdSha256:sha(bakDelete.requestId),exactVersionAbsent:true,tombstonesReapplied:true}},secretsRecorded:false};
 }catch(error){
  const cleanup=[];
  for(const item of created){
   try{const before=await adapter.headExactVersion({key:item.key,versionId:item.versionId});if(before?.exists===false){cleanup.push({versionIdSha256:sha(item.versionId),absent:true,alreadyAbsent:true});continue;}const receipt=deletionReceipt(await adapter.deleteExactVersion({key:item.key,versionId:item.versionId,etag:item.etag}),item.versionId,'Cleanup');const after=await adapter.headExactVersion({key:item.key,versionId:item.versionId});cleanup.push({versionIdSha256:sha(item.versionId),deleteRequestIdSha256:sha(receipt.requestId),absent:after?.exists===false});}catch{cleanup.push({versionIdSha256:sha(item.versionId),absent:false});}
  }
  return {...plan,mode:'live',completedAt:new Date().toISOString(),verdict:'QA_HOLD',failure:error instanceof Error?error.message:'Live QA failed.',cleanup,cleanupConfirmed:cleanup.length===created.length&&cleanup.every(x=>x.absent),secretsRecorded:false};
 }
}

export async function retentionLiveQaMain(){
 const args=process.argv.slice(2),manifestPath=args[args.indexOf('--manifest')+1],outputPath=args[args.indexOf('--output')+1];if(!manifestPath)throw Error('Use --manifest <synthetic-manifest.json>.');
 const input=JSON.parse(await readFile(manifestPath,'utf8')),plan=retentionLiveQaPlan(process.env,input),live=args.includes('--execute-live');let result={...plan,mode:'dry-run',verdict:'READY_FOR_LIVE_EXECUTION',completedAt:new Date().toISOString()};
 if(live){const adapterPath=required(process.env.SAHA_RETENTION_LIVE_ADAPTER,'SAHA_RETENTION_LIVE_ADAPTER');const module=await import(pathToFileURL(adapterPath));result=await executeRetentionLiveQa(process.env,input,await module.createAdapter(process.env));}
 const serialized=JSON.stringify(result,null,2)+'\n';if(outputPath)await writeFile(outputPath,serialized,{mode:0o600});else process.stdout.write(serialized);
}
