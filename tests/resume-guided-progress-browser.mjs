import assert from 'node:assert/strict';
import {startWorker} from './lib/worker.mjs';
const {chromium}=await import(process.env.SAHA_BROWSER_PACKAGE??'@playwright/test');
let worker,browser,passed=0;const check=(value,message)=>{assert.ok(value,message);passed++;};
try{
 worker=await startWorker({port:process.env.SAHA_RESUME_PORT??'9187',name:'saha-resume-guided'});
 browser=await chromium.launch({headless:true,...(process.env.SAHA_CHROMIUM?{executablePath:process.env.SAHA_CHROMIUM}:{})});
 const page=await browser.newPage();await page.goto(worker.base+'/field/');
 const result=await page.evaluate(async()=>{
  const progress=await import('/field/guided-progress.js'),vault=await import('/field/vault.js');await vault.deleteVault();
  const salt=Array.from(crypto.getRandomValues(new Uint8Array(16))),key=await vault.derive('synthetic-passphrase',salt);
  const one={packet:{payload:{userId:'worker-a',organisationId:'org-a',leaseId:'lease-one'}},packageHash:'a'.repeat(64),facts:{weight:'57.5',notes:'saved before interruption'},answers:{question:'Yes'},absence:{},state:'draft',pending:{key:'same-operation-key',body:{type:'syncFieldVisit',facts:{weight:'57.5'}}}},two={packet:{payload:{userId:'worker-a',organisationId:'org-a',leaseId:'lease-two'}},packageHash:'b'.repeat(64),facts:{weight:'61'},answers:{},absence:{},state:'draft',pending:null};
  const book={schema:1,userId:'worker-a',drafts:[one,two],registrations:[]};progress.checkpointGuidedStep(book,two,'notes');
  const sealed=await vault.seal(key,book),revision=await vault.writeVault({...sealed,salt},0),record=await vault.readVault(),restored=await vault.unseal(key,record),selected=progress.restoredPreparedTask(restored),step=progress.restoredGuidedStep(restored,restored.drafts[1],['start','notes','review']);
  const before=structuredClone(restored);progress.checkpointGuidedStep(restored,restored.drafts[1],'review');const winner=await vault.seal(key,restored);const loser=await vault.seal(key,{...before,activePreparedTask:{...before.activePreparedTask,leaseId:'lease-one'}});const settled=await Promise.allSettled([vault.writeVault({...winner,salt},revision),vault.writeVault({...loser,salt},revision)]),after=await vault.unseal(key,await vault.readVault());await vault.deleteVault();
  return {selected,step,fields:restored.drafts[0].facts,answer:restored.drafts[0].answers.question,pending:restored.drafts[0].pending,revision:record.revision,settled:settled.map(x=>x.status),afterStep:after.drafts[1].guidedProgress.stepKey,afterTask:after.activePreparedTask.leaseId};
 });
 check(result.selected==='lease-two','encrypted reload restores current prepared task');check(result.step.key==='notes','encrypted reload restores durable workflow step');check(result.fields.weight==='57.5'&&result.fields.notes==='saved before interruption'&&result.answer==='Yes','encrypted reload retains captured data and outstanding answer');check(result.pending.key==='same-operation-key'&&result.pending.body.type==='syncFieldVisit','encrypted reload retains the exact pending receipt identity');check(result.revision===1,'checkpoint is stored in the existing revisioned vault');check(result.settled.filter(x=>x==='fulfilled').length===1&&result.settled.filter(x=>x==='rejected').length===1,'concurrent writers cannot silently overwrite progress');check(result.afterTask==='lease-two'&&result.afterStep==='review','winning atomic checkpoint restores consistently');
 console.log(JSON.stringify({passed,failed:0,scope:'Real Chromium IndexedDB and WebCrypto; restart/reload, encrypted fields, pending operation identity and concurrent-write refusal. No network sync invoked.'}));
}finally{await browser?.close();await worker?.stop();}
