import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ts from 'typescript';
const root=process.cwd(),temp=mkdtempSync(join(tmpdir(),'saha-partial-completion-'));
try{
 const source=join(root,'lib/saha/partial-completion.ts'),js=ts.transpileModule(readFileSync(source,'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;writeFileSync(join(temp,'partial-completion.mjs'),js);
 const {partialCompletion}=await import(`file://${join(temp,'partial-completion.mjs')}`),sub=(id,state,receipt)=>({id,visitId:'v1',personId:'p1',connectorId:id,connectorName:id.toUpperCase(),state,mode:'http',payloadHash:'h',receipt,attempts:1,message:'',createdAt:'',updatedAt:''});let passed=0;const check=fn=>{fn();passed++;};
 const partial=partialCompletion([sub('a','accepted','A-RECEIPT'),sub('b','uncertain')]);
 check(()=>assert.deepEqual({state:partial.state,accepted:partial.accepted,outstanding:partial.outstanding,closed:partial.closed},{state:'partial',accepted:1,outstanding:1,closed:0}));
 check(()=>assert.deepEqual(partial.destinations.map(x=>[x.id,x.state,x.receipt,x.recovery]),[['a','accepted','A-RECEIPT','none'],['b','uncertain',undefined,'lookup']]));
 check(()=>assert.equal(partial.destinations.find(x=>x.id==='a').recovery,'none'));
 const failed=partialCompletion([sub('a','accepted','A-RECEIPT'),sub('b','retryable')]);check(()=>assert.equal(failed.state,'partial'));check(()=>assert.equal(failed.destinations.find(x=>x.id==='b').recovery,'send'));
 const refused=partialCompletion([sub('a','accepted','A-RECEIPT'),sub('b','cancelled')]);check(()=>assert.equal(refused.state,'partial'));check(()=>assert.equal(refused.destinations.find(x=>x.id==='b').recovery,'prepare-new-plan'));check(()=>assert.equal(refused.destinations.find(x=>x.id==='a').receipt,'A-RECEIPT'));
 check(()=>assert.equal(partialCompletion([sub('a','accepted','A'),sub('b','accepted','B')]).state,'complete'));check(()=>assert.equal(partialCompletion([sub('a','queued'),sub('b','uncertain')]).state,'outstanding'));check(()=>assert.equal(partialCompletion([sub('a','rejected'),sub('b','cancelled')]).state,'closed'));check(()=>assert.equal(partialCompletion([]).state,'closed'));
 execFileSync(process.execPath,['tests/mis-delivery.mjs'],{cwd:root,stdio:'inherit'});
 writeFileSync(join(root,'tests/partial-completion-contract-result.json'),JSON.stringify({passed,completedAt:new Date().toISOString(),coverage:'SAHA-076 multi-destination state summary: accepted receipts remain independently visible; accepted destinations have no recovery action; queued/retryable destinations alone can send; sending/uncertain destinations require lookup; rejected/refused destinations require a new plan; partial, outstanding, complete and closed aggregate labels; plus the existing real MIS delivery checkpoint, authorization, race, lost-response, lookup and same-key retry contract.'},null,2)+'\n');console.log(`partial completion contract: ${passed}/${passed}`);
}finally{rmSync(temp,{recursive:true,force:true});}
