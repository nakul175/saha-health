import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workspace=readFileSync('app/workspace.tsx','utf8');
const messages=readFileSync('lib/saha/messages.ts','utf8');
const css=readFileSync('app/globals.css','utf8');
let passed=0;
const check=(name,fn)=>{fn();passed++;console.log('PASS',name)};

check('all interactive person opens defer through the unsaved-work decision',()=>{
  assert.match(workspace,/const openPerson=\(p:Person,source='other'\)=>navigate\(\(\)=>\{void openPersonNow\(p,source\)\}\)/);
  assert.match(workspace,/const openById=\(pid:string,vid\?:string\|null\)=>navigate\(\(\)=>\{void openByIdNow\(pid,vid\)\}\)/);
  assert.doesNotMatch(workspace,/onClick=\{\(\)=>openPersonNow\(/);
  assert.doesNotMatch(workspace,/open=\{pid=>openByIdNow\(/);
});
check('the open audit happens only inside the post-decision transition',()=>{
  assert.match(workspace,/const openPersonNow=async\(p:Person,source='other'\)=>\{if\(!await markOpened\(p\.id,source\)\)return;/);
  assert.match(workspace,/const openByIdNow=async\(pid:string,vid\?:string\|null\)=>\{const known=/);
});
check('discard explicitly clears the editor before the queued context switch',()=>{
  assert.match(workspace,/setUnsaved\(false\);setEditorKey\(k=>k\+1\);pendingNav\?\.\(\);setPendingNav\(null\)/);
  assert.match(messages,/patient\.unsavedBody.*not been saved.*discard these edits/);
});
check('active person and visit are continuously visible and accessible',()=>{
  assert.match(workspace,/className="patient-context" role="status"/);
  assert.match(workspace,/patient\.activeContextAria/);
  assert.match(workspace,/patient\.activePerson/);
  assert.match(workspace,/patient\.activeVisit/);
  assert.match(messages,/patient\.noActiveVisit/);
  assert.match(css,/\.patient-context\{/);
});
check('visit selection remains constrained to the selected person',()=>{
  assert.match(workspace,/d\.visits\.some\(v=>v\.id===vid&&v\.personId===pid\)\?vid:latestOwnVisitId\(d\.visits,pid\)/);
});
console.log(`${passed} patient-context contract checks passed`);
