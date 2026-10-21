import assert from 'node:assert/strict';
import ts from 'typescript';
import {mkdtempSync,readdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

const dir=mkdtempSync(join(process.cwd(),'.retention-custody-registration-'));
const status=(fn,code)=>{try{fn();}catch(error){assert.equal(error.status,code,error.message);return;}assert.fail(`expected ${code}`);};
try{
 for(const file of readdirSync('lib/saha').filter(x=>x.endsWith('.ts'))){const out=ts.transpileModule(readFileSync(join('lib/saha',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'");writeFileSync(join(dir,file.replace(/\.ts$/,'.js')),out);}
 const retention=await import(pathToFileURL(join(dir,'retention.js'))),gate=await import(pathToFileURL(join(dir,'retention-external-object-gate.js')));let signerCalls=0;
 const runtime={SAHA_ENVIRONMENT:'production',SAHA_RETENTION_OBJECT_DELETE:'digitalocean-spaces-versioned-v1',SAHA_RETENTION_SPACES_ENDPOINT:'https://blr1.digitaloceanspaces.com',SAHA_RETENTION_SPACES_REGION:'blr1',SAHA_RETENTION_SPACES_ACCOUNT_ID:'saha-system-account',SAHA_RETENTION_SPACES_BUCKET:'saha-private-retention',SAHA_RETENTION_SPACES_VERSIONING_EVIDENCE:'VERSIONING-EVIDENCE',SAHA_RETENTION_SPACES_EXACT_VERSION_DELETE_EVIDENCE:'EXACT-DELETE-EVIDENCE',SAHA_RETENTION_SPACES_ACCOUNT_BUCKET_EVIDENCE:'ACCOUNT-BUCKET-EVIDENCE',RETENTION_DELETE_SIGNER:{signedVersionDelete:async()=>{signerCalls++;return{status:500}}}};
 const now='2026-10-21T00:00:00.000Z',owner={userId:'owner',displayName:'Owner',role:'admin',isOwner:true},actor={userId:'owner',displayName:'Owner',email:'owner@example.invalid'};
 const state=()=>({organisation:{id:'org',name:'Synthetic'},members:[owner],workspace:{people:[],visits:[],submissions:[],audit:[],referrals:[],integrations:[],receipts:{}},retention:{policies:[],holds:[],artifacts:[],tombstones:[]}});
 const base={type:'retentionArtifactRegister',createdAt:'2026-10-20T00:00:00.000Z',purpose:'controlled synthetic retention',location:'DigitalOcean Spaces',jurisdiction:'India',externalObject:{objectKey:'retention/object.json',versionId:'version-001',etag:'etag-001',custodyEvidenceRef:'CUSTODY-RECEIPT-001'}};
 let s=state();status(()=>retention.applyRetention(s,{...base,recordClass:'export',recordId:'export-disabled'},actor,owner,now,{}),409);assert.equal(s.retention.artifacts.length,0);
 status(()=>retention.applyRetention(s,{...base,recordClass:'patient-record',recordId:'patient-object'},actor,owner,now,runtime),422);
 status(()=>retention.applyRetention(s,{...base,recordClass:'export',recordId:'export-public-coordinates',externalObject:{...base.externalObject,endpoint:'https://evil.invalid'}},actor,owner,now,runtime),422);
 retention.applyRetention(s,{...base,recordClass:'export',recordId:'export-001'},actor,owner,now,runtime);
 const exp=s.retention.artifacts.at(-1).externalDeletion;assert.deepEqual([exp.endpoint,exp.region,exp.accountId,exp.bucket],[runtime.SAHA_RETENTION_SPACES_ENDPOINT,runtime.SAHA_RETENTION_SPACES_REGION,runtime.SAHA_RETENTION_SPACES_ACCOUNT_ID,runtime.SAHA_RETENTION_SPACES_BUCKET]);assert.equal(exp.accountableOwnerRef,'Saha Health system owner pending named human');assert.equal(exp.destinationRegistered,false);assert.equal(exp.serverPayloadPersisted,true);assert.equal(exp.keyInaccessible,false);assert.equal(gate.externalObjectDeletionGate(s.retention.artifacts.at(-1),runtime).state,'policy-refused');
 retention.applyRetention(s,{...base,recordClass:'backup',recordId:'backup-001',externalObject:{...base.externalObject,objectKey:'backups/generation.json',versionId:'version-002'}},actor,owner,now,runtime);
 const backup=s.retention.artifacts.at(-1).externalDeletion;assert.equal(backup.cadence,'weekly');assert.equal(backup.recoveryWindowDays,7);assert.equal(backup.exactVersionDeletionAfterWindow,true);assert.equal(backup.tombstoneAwareRestoreRequired,true);assert.equal(backup.recoveryWindowApproved,false);assert.equal(backup.tombstoneAwareRestoreVerified,false);assert.equal(backup.generationKeyInaccessible,false);assert.equal(gate.externalObjectDeletionGate(s.retention.artifacts.at(-1),runtime).state,'policy-refused');
 assert.equal(signerCalls,0,'registration and gate evaluation never sign or call the provider');
 console.log(JSON.stringify({suite:'external custody registration',passed:18,networkCalls:0,signerCalls,destructiveActions:0}));
}finally{rmSync(dir,{recursive:true,force:true});}
