import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const dir=mkdtempSync('.amendments-contract-'),checks=[];
try{
 writeFileSync(join(dir,'amendments.mjs'),ts.transpileModule(readFileSync('lib/saha/amendments.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
 const {amendmentAttempt,amendmentMatches}=await import(pathToFileURL(join(dir,'amendments.mjs')).href),check=(name,fn)=>{fn();checks.push(name);};
 const source={id:'original',personId:'person',recordVersion:5,state:'confirmed',imported:false},value={organisationId:'org',actorId:'worker',person:{id:'person'},visits:[source],truncated:false};
 const attempt=amendmentAttempt(value,'original','  Correcting a transcription  ','original-key');
 check('Original actor organisation person confirmed source version reason and key bind exact attempt',()=>assert.deepEqual(attempt,{key:'original-key',organisationId:'org',actorId:'worker',personId:'person',command:{type:'amendVisit',visitId:'original',version:5,reason:'Correcting a transcription'}}));
 check('Preparing explicit intent never creates draft or mutates source',()=>{const before=structuredClone(value);amendmentAttempt(value,'original','Reason','key-valid');assert.deepEqual(value,before);});
 for(const patch of [{state:'draft'},{personId:'other'},{voidedAt:'now'},{supersededBy:'other'},{imported:true},{recordVersion:0},{recordVersion:1.5},{recordVersion:Infinity},{recordVersion:Number.MAX_SAFE_INTEGER+1},{id:42},{id:true},{id:['original']}])check('Noncurrent malformed or foreign source refuses '+JSON.stringify(patch),()=>assert.throws(()=>amendmentAttempt({...value,visits:[{...source,...patch}]},patch.id??'original','Reason','key-valid')));
 for(const reason of ['', 'abcd', '   ', 'x'.repeat(1001)])check('Original reason constraint refuses length'+reason.length,()=>assert.throws(()=>amendmentAttempt(value,'original',reason,'key-valid'),/correction reason/));
 for(const key of ['', 'tiny','contains space',true,123456789])check('Malformed original key refuses '+String(key),()=>assert.throws(()=>amendmentAttempt(value,'original','Reason',key),/correction reason/));
 for(const patch of [{actorId:''},{organisationId:''},{person:{id:'other'}},{visits:[]}])check('Missing actor org person or source cannot produce intent',()=>assert.throws(()=>amendmentAttempt({...value,...patch},'original','Reason','key-valid')));
 const recorded={...value,visits:[{...source,supersededBy:'correction'},{id:'correction',personId:'person',amendsVisitId:'original',state:'draft'}]};
 check('Exact linked unconfirmed correction matches original intent',()=>assert.equal(amendmentMatches(attempt,recorded,'correction'),true));
 for(const patch of [{actorId:'other'},{organisationId:'other'},{person:{id:'other'}},{visits:[source]},{visits:[recorded.visits[0],{...recorded.visits[1],amendsVisitId:'other'}]},{visits:[recorded.visits[0],{...recorded.visits[1],state:'confirmed'}]},{visits:[recorded.visits[0],{...recorded.visits[1],voidedAt:'now'}]}])check('Foreign missing or noncurrent correction never confirms original attempt',()=>assert.equal(amendmentMatches(attempt,{...recorded,...patch},'correction'),false));
 const output=process.env.SAHA_AMENDMENTS_REPORT??'tests/reports/amendments-contract-result.json';mkdirSync(join(output,'..'),{recursive:true});writeFileSync(output,JSON.stringify({passed:checks.length,failed:0,skipped:0,checks,completedAt:new Date().toISOString(),limits:'Pure exact correction intent/source binding; no full clinical/downstream/external/formal acceptance.'},null,2));console.log(`${checks.length} amendment intent checks passed`);
}finally{rmSync(dir,{recursive:true,force:true});}
