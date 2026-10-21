import assert from 'node:assert/strict';
import ts from 'typescript';
import {mkdtempSync,readFileSync,readdirSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

const dir=mkdtempSync(join(process.cwd(),'.audit-detail-erasure-'));
try{
 for(const file of readdirSync('lib/saha').filter(x=>x.endsWith('.ts'))){const output=ts.transpileModule(readFileSync(join('lib/saha',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'");writeFileSync(join(dir,file.replace('.ts','.js')),output);}
 const gate=await import(pathToFileURL(join(dir,'audit-detail-erasure.js'))),chain=await import(pathToFileURL(join(dir,'audit-chain.js')));
 let passed=0;const check=async fn=>{await fn();passed++;};
 const base={org_id:'org',id:'event-1',person_id:'p1',actor_id:'worker-1',actor_name:'Synthetic Worker',role:'clinician',action:'viewPatientRecord',subject:'p1',detail:'ciphertext:v1:synthetic',at:'2024-01-01T00:00:00.000Z',seq:4,prev_hash:'a'.repeat(64)};base.hash=await chain.linkHash(base.seq,base.prev_hash,await chain.contentDigest(base));
 const verification={chainVersion:chain.CHAIN_VERSION,status:'intact',events:5,priorEvents:0,head:{seq:4,hash:base.hash,at:base.at},genesisAt:base.at,firstBreak:null,clockRegressions:{count:0,largestMs:0,firstSeq:null},checkedAt:'2026-01-02T00:00:00.000Z'};
 const authority={approved:true,approvalReference:'SYNTHETIC-APPROVAL',design:'cryptographic',detailProtection:'encrypted-v1',detailEligibleAt:'2025-01-01T00:00:00.000Z',hold:false};
 const plan=await gate.prepareAuditDetailErasure(base,authority,verification,'2026-01-01T00:00:00.000Z');
 await check(()=>{assert.equal(plan.envelope.actorId,'worker-1');assert.equal(plan.envelope.authorityClass,'clinician');assert.equal(plan.envelope.action,'viewPatientRecord');assert.equal(plan.envelope.subjectToken.length,64);assert.equal(JSON.stringify(plan.envelope).includes('Synthetic Worker'),false);assert.equal(JSON.stringify(plan.envelope).includes('ciphertext'),false);});
 await check(async()=>assert.rejects(()=>gate.prepareAuditDetailErasure(base,{...authority,approved:false},verification,'2026-01-01T00:00:00.000Z'),e=>e.status===409));
 await check(async()=>assert.rejects(()=>gate.prepareAuditDetailErasure(base,{...authority,hold:true},verification,'2026-01-01T00:00:00.000Z'),e=>e.status===409));
 await check(async()=>assert.rejects(()=>gate.prepareAuditDetailErasure(base,{...authority,detailProtection:'plaintext'},verification,'2026-01-01T00:00:00.000Z'),e=>e.status===409));
 await check(async()=>assert.rejects(()=>gate.prepareAuditDetailErasure(base,{...authority,detailEligibleAt:'2027-01-01T00:00:00.000Z'},verification,'2026-01-01T00:00:00.000Z'),e=>e.status===409));
 await check(async()=>assert.rejects(()=>gate.prepareAuditDetailErasure(base,authority,{...verification,status:'broken',firstBreak:{seq:3,id:'x',reason:'synthetic'}},'2026-01-01T00:00:00.000Z'),e=>e.status===409));
 await check(async()=>{const decision=await gate.confirmAuditDetailErasure(plan,base,{design:'cryptographic',detailUnavailable:false,keyInaccessible:true},verification);assert.equal(decision.state,'evidence-pending');});
 await check(async()=>{const decision=await gate.confirmAuditDetailErasure(plan,base,{design:'cryptographic',detailUnavailable:true,keyInaccessible:false},verification);assert.equal(decision.state,'purge-pending');});
 await check(async()=>{const decision=await gate.confirmAuditDetailErasure(plan,base,{design:'cryptographic',detailUnavailable:true,keyInaccessible:true},verification);assert.equal(decision.state,'completed');assert.equal(decision.claim,'crypto-erased');});
 await check(async()=>assert.rejects(()=>gate.confirmAuditDetailErasure(plan,{...base,detail:'ciphertext:v1:raced'}, {design:'cryptographic',detailUnavailable:true,keyInaccessible:true},verification),e=>e.status===409));
 await check(async()=>assert.rejects(()=>gate.confirmAuditDetailErasure(plan,base,{design:'checkpoint-linked',detailUnavailable:true,checkpoint:{seq:4,hash:base.hash}},verification),e=>e.status===409));
  const tokenEvent={...base,id:'event-token',detail:'checkpoint-token:v1:synthetic'};tokenEvent.hash=await chain.linkHash(tokenEvent.seq,tokenEvent.prev_hash,await chain.contentDigest(tokenEvent));const tokenVerification={...verification,head:{...verification.head,hash:tokenEvent.hash}};const tokenPlan=await gate.prepareAuditDetailErasure(tokenEvent,{...authority,design:'checkpoint-linked',detailProtection:'checkpoint-token-v1'},tokenVerification,'2026-01-01T00:00:00.000Z');
  await check(async()=>{const decision=await gate.confirmAuditDetailErasure(tokenPlan,tokenEvent,{design:'checkpoint-linked',detailUnavailable:true,checkpoint:{seq:4,hash:tokenEvent.hash}},tokenVerification);assert.equal(decision.state,'completed');});
  await check(async()=>assert.rejects(()=>gate.confirmAuditDetailErasure(tokenPlan,tokenEvent,{design:'checkpoint-linked',detailUnavailable:true,checkpoint:{seq:3,hash:tokenEvent.hash}},tokenVerification),e=>e.status===409));
 console.log(JSON.stringify({suite:'audit detail erasure gate',passed}));
}finally{rmSync(dir,{recursive:true,force:true});}
