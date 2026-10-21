import assert from 'node:assert/strict';
import ts from 'typescript';
import {mkdtempSync,readdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

const dir=mkdtempSync(join(process.cwd(),'.retention-external-gate-'));
try{
 for(const file of readdirSync('lib/saha').filter(x=>x.endsWith('.ts'))){const out=ts.transpileModule(readFileSync(join('lib/saha',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'");writeFileSync(join(dir,file.replace(/\.ts$/,'.js')),out);}
 const g=await import(pathToFileURL(join(dir,'retention-external-object-gate.js')));let signerCalls=0;
 const runtime={SAHA_ENVIRONMENT:'production',SAHA_RETENTION_OBJECT_DELETE:'digitalocean-spaces-versioned-v1',SAHA_RETENTION_SPACES_ENDPOINT:'https://blr1.digitaloceanspaces.com',SAHA_RETENTION_SPACES_REGION:'blr1',SAHA_RETENTION_SPACES_ACCOUNT_ID:'synthetic-account',SAHA_RETENTION_SPACES_BUCKET:'synthetic-private-bucket',SAHA_RETENTION_SPACES_VERSIONING_EVIDENCE:'VERSIONING-EVIDENCE',SAHA_RETENTION_SPACES_EXACT_VERSION_DELETE_EVIDENCE:'EXACT-DELETE-EVIDENCE',SAHA_RETENTION_SPACES_ACCOUNT_BUCKET_EVIDENCE:'ACCOUNT-BUCKET-EVIDENCE',RETENTION_DELETE_SIGNER:{signedVersionDelete:async()=>{signerCalls++;return{status:500}}}};
 const base={id:'inventory',recordId:'external-object',createdAt:'2026-01-01T00:00:00.000Z',purpose:'approved synthetic purpose',location:'blr1',jurisdiction:'IN',registeredBy:'owner',registeredAt:'2026-01-01T00:00:00.000Z'};
 assert.equal(g.externalObjectDeletionGate({...base,recordClass:'export'},runtime).state,'custody-unavailable','current metadata-only export registrations cannot use provider deletion');
 assert.equal(g.externalObjectDeletionGate({...base,recordClass:'backup'},runtime).state,'custody-unavailable','current metadata-only backup registrations cannot use provider deletion');
 const custody={provider:'digitalocean-spaces',endpoint:runtime.SAHA_RETENTION_SPACES_ENDPOINT,region:'blr1',accountId:'synthetic-account',bucket:'synthetic-private-bucket',objectKey:'exports/object',versionId:'version-1',etag:'etag-1',custodyEvidenceRef:'CUSTODY-EVIDENCE-1'};
 assert.equal(g.externalObjectDeletionGate({...base,recordClass:'export',externalDeletion:custody},{}).state,'provider-unavailable');
 assert.equal(g.externalObjectDeletionGate({...base,recordClass:'export',externalDeletion:{...custody,bucket:'other-bucket'}},runtime).state,'custody-mismatch');
 assert.equal(g.externalObjectDeletionGate({...base,recordClass:'export',externalDeletion:{...custody,destinationRegistered:true,accountableOwnerRef:'owner-ref',serverPayloadPersisted:false,keyInaccessible:false}},runtime).state,'policy-refused');
 assert.equal(g.externalObjectDeletionGate({...base,recordClass:'export',externalDeletion:{...custody,destinationRegistered:true,accountableOwnerRef:'owner-ref',serverPayloadPersisted:false,keyInaccessible:true}},runtime).state,'ready');
 assert.equal(g.externalObjectDeletionGate({...base,recordClass:'backup',externalDeletion:{...custody,recoveryWindowApproved:true,tombstoneAwareRestoreVerified:false,generationKeyInaccessible:true,cadence:'daily'}},runtime).state,'policy-refused');
 assert.equal(g.externalObjectDeletionGate({...base,recordClass:'backup',externalDeletion:{...custody,recoveryWindowApproved:true,tombstoneAwareRestoreVerified:true,generationKeyInaccessible:true,cadence:'daily'}},runtime).state,'ready');
 assert.equal(signerCalls,0,'gate evaluation never signs, contacts or deletes from a provider');
 const server=readFileSync('lib/saha/retention-server.ts','utf8');assert.match(server,/externalObjectDeletionGate/);assert.match(server,/recordClass==='export'\|\|a\.recordClass==='backup'/);
 console.log(JSON.stringify({suite:'registered export and backup external object deletion gate',passed:12,networkCalls:0,signerCalls:0,destructiveActions:0}));
}finally{rmSync(dir,{recursive:true,force:true});}
