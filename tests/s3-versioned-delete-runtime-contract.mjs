import assert from 'node:assert/strict';
import ts from 'typescript';
import {mkdtempSync,readdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

const dir=mkdtempSync(join(process.cwd(),'.s3-versioned-runtime-'));
try{
 for(const file of readdirSync('lib/saha').filter(x=>x.endsWith('.ts'))){const out=ts.transpileModule(readFileSync(join('lib/saha',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'");writeFileSync(join(dir,file.replace(/\.ts$/,'.js')),out);}
 const a=await import(pathToFileURL(join(dir,'s3-versioned-delete-runtime.js'))),d=await import(pathToFileURL(join(dir,'retention-disposal.js')));
 let status=204,calls=0,seen=null;const signer={signedDelete:async request=>{calls++;seen=request;return{status,requestId:'synthetic-signer-receipt'}}};
 const valid={SAHA_ENVIRONMENT:'production',SAHA_RETENTION_OBJECT_DELETE:'s3-versioned-v1',SAHA_RETENTION_S3_ENDPOINT:'https://objects.example.invalid',SAHA_RETENTION_S3_ACCOUNT_ID:'synthetic-account',SAHA_RETENTION_S3_BUCKET:'synthetic-private-bucket',SAHA_RETENTION_S3_VERSIONING_EVIDENCE:'VERSIONING-EVIDENCE-1',SAHA_RETENTION_S3_IF_MATCH_EVIDENCE:'IF-MATCH-EVIDENCE-1',RETENTION_DELETE_SIGNER:signer};
 assert.equal(a.productionS3ConditionalDelete({}),null);assert.equal(a.productionS3ConditionalDelete({SAHA_RETENTION_OBJECT_DELETE:'disabled'}),null);assert.equal(calls,0,'default and disabled runtimes never invoke a signer');
 for(const runtime of [
  {...valid,SAHA_ENVIRONMENT:'staging'},
  {...valid,SAHA_RETENTION_OBJECT_DELETE:'typo'},
  {...valid,SAHA_RETENTION_S3_ENDPOINT:'http://objects.example.invalid'},
  {...valid,SAHA_RETENTION_S3_ENDPOINT:'https://user:password@objects.example.invalid'},
  {...valid,SAHA_RETENTION_S3_ENDPOINT:'https://objects.example.invalid/path'},
  {...valid,SAHA_RETENTION_S3_ACCOUNT_ID:'bad account'},
  {...valid,SAHA_RETENTION_S3_BUCKET:'BAD_BUCKET'},
  {...valid,SAHA_RETENTION_S3_VERSIONING_EVIDENCE:''},
  {...valid,SAHA_RETENTION_S3_IF_MATCH_EVIDENCE:''},
  {...valid,RETENTION_DELETE_SIGNER:{}},
 ])assert.equal(a.productionS3ConditionalDelete(runtime),null,'partial or malformed trusted configuration refuses capability creation');
 assert.equal(calls,0,'malformed configuration is refused before signing or transport');
 const capability=a.productionS3ConditionalDelete(valid);assert.ok(capability);
 const exact={key:'private/synthetic-object',version:'version-9',etag:'"etag-9"'};status=412;assert.equal(await capability.deleteExact(exact),'mismatch');assert.deepEqual(seen,{method:'DELETE',key:exact.key,versionId:exact.version,ifMatch:exact.etag,endpoint:'https://objects.example.invalid',accountId:'synthetic-account',bucket:'synthetic-private-bucket'});
 status=503;assert.equal(await capability.deleteExact(exact),'unconfirmed');
 let object={version:exact.version,etag:exact.etag};const bucket={head:async()=>object,delete:async()=>{throw Error('generic delete forbidden')}},job={org_id:'org',id:'job',tombstone_id:'tomb',record_class:'raw-audio',record_id:'media',person_id:'person',object_key:exact.key,object_version:exact.version,etag:exact.etag,state:'reserved',attempts:1,last_attempt_at:null,last_error:null,reservation_token:'reservation',reserved_at:'2026-10-21T00:00:00.000Z',reserved_by:'owner',request_key:'request-key',request_hash:'hash',outcome:'reserved',created_at:'2026-10-21T00:00:00.000Z',completed_at:null};
 let outcome=await d.purgeReservedPrivateObject(bucket,job,{conditionalDelete:a.productionS3ConditionalDelete({})??undefined});assert.equal(outcome.outcome,'provider-conditional-delete-unavailable');
 status=412;outcome=await d.purgeReservedPrivateObject(bucket,job,{conditionalDelete:capability});assert.equal(outcome.outcome,'object-replaced-at-delete');
 status=503;outcome=await d.purgeReservedPrivateObject(bucket,job,{conditionalDelete:capability});assert.equal(outcome.outcome,'delete-unconfirmed');
 const success=a.productionS3ConditionalDelete({...valid,RETENTION_DELETE_SIGNER:{signedDelete:async request=>{calls++;assert.equal(request.versionId,exact.version);assert.equal(request.ifMatch,exact.etag);object=null;return{status:204}}}});outcome=await d.purgeReservedPrivateObject(bucket,job,{conditionalDelete:success});assert.equal(outcome.state,'completed');assert.equal(outcome.outcome,'delete-confirmed-absent');
 const server=readFileSync('lib/saha/retention-server.ts','utf8');assert.match(server,/productionObjectDeleteCapability\(providerRuntime\)/);assert.match(server,/conditionalDelete:conditionalDelete\?\?undefined/);
 console.log(JSON.stringify({suite:'production S3 conditional-delete runtime wiring contract',passed:25,networkCalls:0,credentialsUsed:0}));
}finally{rmSync(dir,{recursive:true,force:true});}
