import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir=mkdtempSync('.handover-contract-'),checks=[];
try{
 writeFileSync(join(dir,'handover.mjs'),ts.transpileModule(readFileSync('lib/saha/handover.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
 const {acknowledgementAttempt,acknowledgementMatches}=await import(pathToFileURL(join(dir,'handover.mjs')).href);
 const value={organisationId:'org',actorId:'worker',person:{id:'person',name:'Synthetic',village:'Synthetic',version:7,teamId:'team'},handover:{id:'handover',ownerId:'worker',teamId:'team'},work:[]};
 const check=(name,fn)=>{fn();checks.push(name);};
 check('Original exact account org person event and version bind reviewed attempt',()=>assert.deepEqual(acknowledgementAttempt(value,'  Reviewed reference  ','original-key'),{key:'original-key',organisationId:'org',actorId:'worker',personId:'person',command:{type:'acknowledgeAssignment',personId:'person',version:7,assignmentId:'handover',reference:'Reviewed reference'}}));
 check('Creating acknowledgement never mutates source or marks tasks complete',()=>{const before=structuredClone(value);acknowledgementAttempt(value,'reference','key');assert.deepEqual(value,before);});
 for(const version of [0,-1,1.1,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])check('Invalid version refuses '+String(version),()=>assert.throws(()=>acknowledgementAttempt({...value,person:{...value.person,version}},'reference','key'),/source is unavailable/));
 for(const reference of ['', '  ', 'x'.repeat(201)])check('Invalid reference refuses length'+reference.length,()=>assert.throws(()=>acknowledgementAttempt(value,reference,'key'),/Enter a reference/));
 for(const handover of [null,{...value.handover,ownerId:'other'},{...value.handover,teamId:'other'},{...value.handover,acknowledgement:{by:'worker',reference:'old'}}])check('Missing stale or acknowledged source never builds another attempt',()=>assert.throws(()=>acknowledgementAttempt({...value,handover},'reference','key'),/Refresh and review/));
 const attempt=acknowledgementAttempt(value,'reference','key'),recorded={...value,handover:{...value.handover,acknowledgement:{by:'worker',reference:'reference'}}};
 check('Exact observed acknowledgement matches its source context',()=>assert.equal(acknowledgementMatches(attempt,recorded),true));
 for(const patch of [{organisationId:'other'},{actorId:'other'},{person:{...value.person,id:'other'}},{handover:{...recorded.handover,id:'other'}},{handover:{...recorded.handover,acknowledgement:{by:'other',reference:'reference'}}},{handover:{...recorded.handover,acknowledgement:{by:'worker',reference:'other'}}}])check('Other actor org person event or reference never confirms original attempt',()=>assert.equal(acknowledgementMatches(attempt,{...recorded,...patch}),false));
 const output=process.env.SAHA_HANDOVER_REPORT??'tests/reports/handover-contract-result.json';mkdirSync(join(output,'..'),{recursive:true});writeFileSync(output,JSON.stringify({passed:checks.length,failed:0,skipped:0,checks,completedAt:new Date().toISOString(),limits:'Pure original-intent bindings only; observed history is not proof of an exact command receipt or fullstory acceptance.'},null,2));console.log(`${checks.length} handover intent checks passed`);
}finally{rmSync(dir,{recursive:true,force:true});}
