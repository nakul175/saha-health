import assert from 'node:assert/strict';
import ts from 'typescript';
import {mkdtempSync,readdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

const dir=mkdtempSync(join(process.cwd(),'.device-deletion-evidence-'));
try{
 for(const file of readdirSync('lib/saha').filter(x=>x.endsWith('.ts'))){const output=ts.transpileModule(readFileSync(join('lib/saha',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'");writeFileSync(join(dir,file.replace(/\.ts$/,'.js')),output);}
 const m=await import(pathToFileURL(join(dir,'device-deletion-evidence.js')));let passed=0,calls=0;const ok=(condition,message)=>{assert.ok(condition,message);passed++;};
 const instructionId='1'.repeat(64),packageHash='2'.repeat(64),acknowledgement={instructionId,leaseId:'lease-1',packageHash,removedDrafts:1,removedMedia:2,localRevision:7,attestation:'browser-transaction-completed'},tombstone={recordClass:'field-package',recordId:'lease-1',disposedAt:'2026-10-21T06:00:00.000Z',instructionId};
 const base={format:'saha-authoritative-device-deletion-v1',authorityKind:'independent-device-lab',authorityReference:'LAB-DEVICE-20261021',deviceKeyId:'device-key-1',instructionId,leaseId:'lease-1',packageHash,vaultRevision:7,deletedAt:'2026-10-21T06:01:00.000Z',nonce:'nonce-123',signature:'synthetic-signature'};
 const statement={...base,statementHash:createHash('sha256').update(JSON.stringify(m.canonicalDeviceDeletionStatement({...base,statementHash:'',signature:base.signature}))).digest('hex')};
 const verify=async ({canonicalStatement,statement:actual})=>{calls++;return {verified:canonicalStatement===m.canonicalDeviceDeletionStatement(actual),evidenceReference:'SYNTHETIC-LAB-RECEIPT-1'};};
 ok(!(await m.authoritativeDeviceDeletionEvidence({acknowledgement:null,tombstone,statement,verify})).verified,'missing browser acknowledgement refuses');
 ok(!(await m.authoritativeDeviceDeletionEvidence({acknowledgement,tombstone:null,statement,verify})).verified,'missing tombstone refuses');
 ok(!(await m.authoritativeDeviceDeletionEvidence({acknowledgement,tombstone:{...tombstone,recordId:'other'},statement,verify})).verified,'tombstone mismatch refuses');
 ok(!(await m.authoritativeDeviceDeletionEvidence({acknowledgement,tombstone,statement:null,verify})).verified,'browser acknowledgement alone is never authoritative');
 ok(!(await m.authoritativeDeviceDeletionEvidence({acknowledgement,tombstone,statement:{...statement,statementHash:'0'.repeat(64)},verify})).verified,'changed statement hash refuses');
 ok(!(await m.authoritativeDeviceDeletionEvidence({acknowledgement,tombstone,statement,verify:null})).verified,'missing external verifier refuses');
 ok(!(await m.authoritativeDeviceDeletionEvidence({acknowledgement,tombstone,statement,verify:async()=>({verified:false})})).verified,'external verifier refusal remains refusal');
 ok(!(await m.authoritativeDeviceDeletionEvidence({acknowledgement:{...acknowledgement,localRevision:8},tombstone,statement,verify})).verified,'vault revision mismatch refuses');
 ok(!(await m.authoritativeDeviceDeletionEvidence({acknowledgement,tombstone,statement:{...statement,deletedAt:'2026-10-21T05:59:59.000Z',statementHash:'0'.repeat(64)},verify})).verified,'statement before tombstone refuses');
 const result=await m.authoritativeDeviceDeletionEvidence({acknowledgement,tombstone,statement,verify});ok(result.verified&&result.claim==='physically-deleted'&&result.evidenceReference==='SYNTHETIC-LAB-RECEIPT-1','exact independently verified statement completes the evidence gate');
 ok(calls===1,'verifier is called only after structural, binding and hash checks');
 console.log(JSON.stringify({suite:'authoritative device deletion evidence gate',passed,failed:0,realDeviceEvidenceUsed:false,externalCalls:0}));
}finally{rmSync(dir,{recursive:true,force:true});}
