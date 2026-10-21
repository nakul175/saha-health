import assert from 'node:assert/strict';
import ts from 'typescript';
import {mkdtempSync,readdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

const dir=mkdtempSync(join(process.cwd(),'.audit-detail-runtime-'));
try{
 for(const file of readdirSync('lib/saha').filter(x=>x.endsWith('.ts'))){
  const output=ts.transpileModule(readFileSync(join('lib/saha',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'");
  writeFileSync(join(dir,file.replace('.ts','.js')),output);
 }
 const chain=await import(pathToFileURL(join(dir,'audit-chain.js'))),protection=await import(pathToFileURL(join(dir,'audit-detail-protection.js')));
 let passed=0;const check=async f=>{await f();passed++;};
 const emptyDb={prepare(sql){return {bind(){return this;},async first(){return null;},async all(){return {results:[]};}};}};
 const event=()=>({table:'audit_events',keys:['org_id','id'],append:true,values:{org_id:'org',id:'event-1',person_id:'person-1',actor_id:'worker',actor_name:'Synthetic worker',role:'clinician',action:'viewPatientRecord',subject:'person-1',detail:'synthetic sensitive detail',at:'2026-01-01T00:00:00.000Z'}});
 let sealCalls=0;
 const keyService={
  async seal({plaintext,aad}){sealCalls++;return {keyId:'synthetic-key',keyVersion:'v1',algorithm:'synthetic-test-aead',nonce:'synthetic-nonce',ciphertext:Buffer.from(`${plaintext}|${aad}`).toString('base64'),lifecycleToken:'synthetic-lifecycle'};},
  async destroy(){return {state:'inaccessible',receipt:'synthetic-receipt'};}
 };
 const configured=protection.auditDetailProtectionRuntime({SAHA_AUDIT_DETAIL_PROTECTION:'required',SAHA_AUDIT_DETAIL_YEARS:'2',AUDIT_DETAIL_KEY_SERVICE:keyService});
 await check(()=>{assert.equal(configured.mode,'required');assert.equal(configured.provider,keyService);assert.equal(configured.eligibleAt(event().values),'2028-01-01T00:00:00.000Z');});
 await check(()=>assert.throws(()=>protection.auditDetailProtectionRuntime({SAHA_AUDIT_DETAIL_PROTECTION:'required',SAHA_AUDIT_DETAIL_YEARS:'0',AUDIT_DETAIL_KEY_SERVICE:keyService}),e=>e.status===503));
 chain.bindAuditDetailProtectionRuntime(()=>configured);
 const rows=[event()];
 await chain.linkRows(emptyDb,'org',rows,'2026-01-01T00:00:01.000Z');
 await check(()=>{assert.equal(rows.length,3);assert.equal(rows.filter(x=>x.table==='audit_detail_protections').length,1);assert.equal(rows.filter(x=>x.table==='audit_detail_key_events').length,1);assert.equal(rows[0].values.detail.includes('synthetic sensitive detail'),false);assert.equal(protection.parseAuditDetailToken(String(rows[0].values.detail)).keyId,'synthetic-key');assert.equal(sealCalls,1);});
 const metadata=rows.find(x=>x.table==='audit_detail_protections').values;
 await check(()=>{assert.equal(metadata.org_id,'org');assert.equal(metadata.event_id,'event-1');assert.equal(metadata.eligible_at,'2028-01-01T00:00:00.000Z');assert.equal(String(metadata.token_digest).length,64);assert.equal(String(metadata.lifecycle_token_digest).length,64);});
 await chain.linkRows(emptyDb,'org',rows,'2026-01-01T00:00:02.000Z');
 await check(()=>{assert.equal(rows.filter(x=>x.table==='audit_detail_protections').length,1);assert.equal(rows.filter(x=>x.table==='audit_detail_key_events').length,1);assert.equal(sealCalls,1);});
 const unavailable=protection.auditDetailProtectionRuntime({SAHA_AUDIT_DETAIL_PROTECTION:'required'});chain.bindAuditDetailProtectionRuntime(()=>unavailable);const refused=[event()];
 await check(async()=>{await assert.rejects(()=>chain.linkRows(emptyDb,'org',refused,'2026-01-01T00:00:01.000Z'),e=>e.status===503);assert.equal(refused.length,1);assert.equal(refused[0].values.detail,'synthetic sensitive detail');});
 chain.bindAuditDetailProtectionRuntime(()=>protection.auditDetailProtectionRuntime({}));const disabled=[event()];await chain.linkRows(emptyDb,'org',disabled,'2026-01-01T00:00:01.000Z');
 await check(()=>{assert.equal(disabled[0].values.detail,'synthetic sensitive detail');assert.equal(disabled.some(x=>x.table==='audit_detail_protections'),false);});
 console.log(JSON.stringify({suite:'audit detail runtime integration',passed}));
}finally{rmSync(dir,{recursive:true,force:true});}
