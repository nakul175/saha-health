import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {checkpointGuidedStep,restoredGuidedStep,restoredPreparedTask,rememberPreparedTask,clearPreparedTask} from '../public/field/guided-progress.js';

let passed=0;const check=(value,message)=>{assert.ok(value,message);passed++;};
const draft=(user='worker-a',lease='lease-a',hash='a'.repeat(64))=>({packet:{payload:{userId:user,organisationId:'org-a',leaseId:lease}},packageHash:hash,facts:{weight:'57.5',notes:'captured'},answers:{q:'Yes'},absence:{},state:'draft',pending:{key:'receipt-stable',body:{type:'syncFieldVisit'}}});
const first=draft(),second=draft('worker-a','lease-b','b'.repeat(64)),book={userId:'worker-a',drafts:[first,second]};

checkpointGuidedStep(book,second,'notes');
check(restoredPreparedTask(book)==='lease-b','restores the exact prepared task rather than the first draft');
check(restoredGuidedStep(book,second,['start','notes','review']).key==='notes','restores the last durable guided step');
check(second.facts.weight==='57.5'&&second.answers.q==='Yes','checkpoint preserves captured fields and answers');
check(second.pending.key==='receipt-stable','checkpoint preserves uncertain receipt identity');
rememberPreparedTask(book,first);check(restoredPreparedTask(book)==='lease-a','explicit task selection is durable metadata');
const before=structuredClone(book.activePreparedTask);book.activePreparedTask.packageHash='c'.repeat(64);check(restoredPreparedTask(book)===null,'changed grant package cannot restore stale task');book.activePreparedTask=before;
second.guidedProgress.packageHash='c'.repeat(64);check(restoredGuidedStep(book,second,['notes'])===null,'changed grant package cannot restore stale step');second.guidedProgress.packageHash=second.packageHash;
check(restoredGuidedStep(book,second,['review'])===null,'removed workflow step is not restored');
const foreign={...book,userId:'worker-b'};check(restoredPreparedTask(foreign)===null,'another account cannot restore the task');
assert.throws(()=>checkpointGuidedStep(foreign,second,'notes'),/does not belong/);passed++;
clearPreparedTask(book,first);check(restoredPreparedTask(book)===null,'removing the selected prepared task clears its pointer');
const source=readFileSync(new URL('../public/field/app.js',import.meta.url),'utf8');
check(source.includes('restoredPreparedTask(book)??book.drafts[0]'),'unlock prefers the validated durable task');
check(source.includes('selected=restoredPreparedTask(book)??book.drafts[0]?.packet.payload.leaseId??null;await persist();appScopePending=false'),'restored task selection is committed before the notebook is presented');
check(!readFileSync(new URL('../public/field/guided-progress.js',import.meta.url),'utf8').match(/fetch\s*\(/),'restoration cannot transmit or retry an uncertain operation');
console.log(JSON.stringify({passed,failed:0,scope:'SAHA-007 durable guided task/step identity, field and pending-receipt preservation, stale grant and cross-account refusal'}));
