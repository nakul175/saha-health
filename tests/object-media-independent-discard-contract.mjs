// Real elapsed transport-discard budget, independently measured with a blocked body.
import assert from 'node:assert/strict';import ts from 'typescript';
import {readFileSync,writeFileSync,readdirSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';import {pathToFileURL} from 'node:url';
const dir=mkdtempSync(join(process.cwd(),'.cold-media-discard-'));let passed=0;
try{
 for(const file of readdirSync('lib/saha').filter(x=>x.endsWith('.ts')))writeFileSync(join(dir,file.replace('.ts','.js')),ts.transpileModule(readFileSync('lib/saha/'+file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'"));
 const media=await import(pathToFileURL(join(dir,'media.js')));
 let readBytes=0,readCalls=0,cancelled=0,released=0;
 const body={getReader:()=>({read:async()=>{readCalls++;readBytes+=64*1024;return {done:false,value:new Uint8Array(64*1024)};},cancel:async()=>{cancelled++;},releaseLock(){released++;}})};
 await media.discardUnreadMedia({body,bodyUsed:false});
 assert.equal(readBytes,5*1024*1024);passed++;assert.equal(readCalls,80);passed++;assert.equal(cancelled,1);passed++;assert.equal(released,1);passed++;
 let blockedCancelled=0,blockedReleased=0;
 const blocked={getReader:()=>({read:()=>new Promise(()=>{}),cancel:async()=>{blockedCancelled++;},releaseLock(){blockedReleased++;}})};
 const started=performance.now();await media.discardUnreadMedia({body:blocked,bodyUsed:false});const elapsedMs=performance.now()-started;
 assert.ok(elapsedMs>=media.MEDIA_READ_BUDGET_MS&&elapsedMs<media.MEDIA_READ_BUDGET_MS+2000,elapsedMs);passed++;assert.equal(blockedCancelled,1);passed++;assert.equal(blockedReleased,1);passed++;
 // Do not steal an already-consumed body or retain parsed payload/sample chunks.
 let touched=0;await media.discardUnreadMedia({body:{getReader:()=>{touched++;throw Error('body already used');}},bodyUsed:true});assert.equal(touched,0);passed++;
 writeFileSync('tests/evidence/object-media-independent/discard-contract.json',JSON.stringify({passed,readBytes,readCalls,elapsedMs,realTimer:true,blockedReaderInjected:true,networkTransportTest:false},null,2));console.log({passed,elapsedMs});
}finally{rmSync(dir,{recursive:true,force:true});}
