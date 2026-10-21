import assert from 'node:assert/strict';
import ts from 'typescript';
import {mkdtempSync,readdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

const dir=mkdtempSync(join(process.cwd(),'.s3-versioned-delete-'));
try{
 for(const file of readdirSync('lib/saha').filter(x=>x.endsWith('.ts'))){const out=ts.transpileModule(readFileSync(join('lib/saha',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'");writeFileSync(join(dir,file.replace(/\.ts$/,'.js')),out);}
 const a=await import(pathToFileURL(join(dir,'s3-versioned-delete.js'))),d=await import(pathToFileURL(join(dir,'retention-disposal.js')));
 const approved={enabled:true,providerKind:'s3-compatible',versioningVerified:true,ifMatchDeleteVerified:true,capabilityEvidenceRef:'synthetic-contract-evidence'};
 const requests=[];let status=204;const capability=a.s3VersionedDeleteCapability(approved,async request=>{requests.push(request);return {status,requestId:'synthetic-request'};});
 assert.ok(capability);assert.equal(capability.kind,'conditional-version-specific-delete-v1');
 const exact={key:'private/synthetic-object',version:'synthetic-version-7',etag:'"synthetic-etag"'};
 assert.equal(await capability.deleteExact(exact),'deleted');assert.deepEqual(requests.at(-1),{method:'DELETE',key:exact.key,versionId:exact.version,ifMatch:exact.etag});
 status=412;assert.equal(await capability.deleteExact(exact),'mismatch','If-Match failure is never reported as deletion');
 status=409;assert.equal(await capability.deleteExact(exact),'mismatch','version conflict is never reported as deletion');
 status=503;assert.equal(await capability.deleteExact(exact),'unconfirmed','provider failure remains retryable');
 status=404;assert.equal(await capability.deleteExact(exact),'absent','provider-confirmed absence converges safely');
 for(const policy of [
  {...approved,enabled:false},
  {...approved,versioningVerified:false},
  {...approved,ifMatchDeleteVerified:false},
  {...approved,capabilityEvidenceRef:'short'}
 ])assert.equal(a.s3VersionedDeleteCapability(policy,async()=>({status:204})),null,'unapproved or unverified provider policy cannot create a deletion capability');
 let object={version:exact.version,etag:exact.etag},calls=0;const bucket={head:async()=>object,delete:async()=>{throw Error('generic delete forbidden')}};
 const job={org_id:'org',id:'job',tombstone_id:'tomb',record_class:'raw-audio',record_id:'media',person_id:'person',object_key:exact.key,object_version:exact.version,etag:exact.etag,state:'reserved',attempts:1,last_attempt_at:null,last_error:null,reservation_token:'reservation',reserved_at:'2026-10-21T00:00:00.000Z',reserved_by:'owner',request_key:'request-key',request_hash:'hash',outcome:'reserved',created_at:'2026-10-21T00:00:00.000Z',completed_at:null};
 let outcome=await d.purgeReservedPrivateObject(bucket,job,{conditionalDelete:a.s3VersionedDeleteCapability({...approved,enabled:false},async()=>{calls++;return{status:204}})??undefined});assert.equal(outcome.outcome,'provider-conditional-delete-unavailable');assert.equal(calls,0,'policy refusal occurs before the provider transport');
 status=412;outcome=await d.purgeReservedPrivateObject(bucket,job,{conditionalDelete:capability});assert.equal(outcome.outcome,'object-replaced-at-delete');assert.equal(object.version,exact.version);
 status=503;outcome=await d.purgeReservedPrivateObject(bucket,job,{conditionalDelete:capability});assert.equal(outcome.state,'reserved');assert.equal(outcome.outcome,'delete-unconfirmed');
 const success=a.s3VersionedDeleteCapability(approved,async request=>{calls++;assert.equal(request.versionId,exact.version);assert.equal(request.ifMatch,exact.etag);object=null;return{status:204,requestId:'synthetic-success'};});outcome=await d.purgeReservedPrivateObject(bucket,job,{conditionalDelete:success});assert.equal(outcome.state,'completed');assert.equal(outcome.outcome,'delete-confirmed-absent');
 console.log(JSON.stringify({suite:'synthetic S3-compatible version-specific deletion contract',passed:20,networkCalls:0,credentialsUsed:0}));
}finally{rmSync(dir,{recursive:true,force:true});}
