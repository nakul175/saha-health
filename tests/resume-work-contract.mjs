import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync,writeFileSync,mkdtempSync,rmSync,mkdirSync } from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const dir=mkdtempSync('.resume-work-contract-'),checks=[];
try{
 writeFileSync(join(dir,'resume-work.mjs'),ts.transpileModule(readFileSync('lib/saha/resume-work.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
 const {routineSelection,currentServerDraft}=await import(pathToFileURL(join(dir,'resume-work.mjs')).href),check=(name,fn)=>{fn();checks.push(name);};
 const value={organisationId:'org-a',person:{id:'person-a'},visit:{id:'visit-a',personId:'person-a',version:3,state:'draft',createdAt:'2026-10-12T00:00:00.000Z'}};
 check('Existing person/org-only Today link remains compatible',()=>assert.deepEqual(routineSelection(new URLSearchParams('personId=person-a&organisationId=org-a')),{personId:'person-a',organisationId:'org-a'}));
 check('Current saved draft binds exact person org visit and observed actor',()=>{const draft=currentServerDraft(value,'person-a','org-a','trusted-actor'),q=new URL(draft.href,'http://local').searchParams;assert.deepEqual(routineSelection(q),{personId:'person-a',organisationId:'org-a',visitId:'visit-a',actorId:'trusted-actor'});assert.equal(draft.version,3);});
 for(const query of ['','personId=person-a','personId=person-a&personId=other&organisationId=org-a','personId=person-a&organisationId=org-a&mode=all','personId=person-a&organisationId=org-a&visitId=visit-a','personId=person-a&organisationId=org-a&actorId=actor','personId=person-a&organisationId=org-a&visitId=visit-a&actorId=actor&actorId=other','personId=person-a&organisationId=org-a&visitId=visit-a&actorId=','personId=%00&organisationId=org-a'])check('Incomplete duplicate extra or invalid navigation refuses: '+query,()=>assert.equal(routineSelection(new URLSearchParams(query)),null));
  check('No server draft is explicit empty, not proof that local work never existed',()=>assert.equal(currentServerDraft({...value,visit:null},'person-a','org-a','actor'),null));
  for(const visit of [undefined,false])check('Malformed absent/non-object source never establishes no server draft',()=>assert.throws(()=>currentServerDraft({...value,visit},'person-a','org-a','actor'),/source is unavailable/));
 check('Pinned disappeared draft never falls back to creating or discovering another visit',()=>assert.throws(()=>currentServerDraft({...value,visit:null},'person-a','org-a','actor','visit-a'),/no longer available/));
 for(const patch of [{id:'different'},{personId:'other'},{state:'confirmed'},{voidedAt:'2026-10-12T00:00:00Z'},{supersededBy:'other'},{version:0},{version:1.2},{version:Infinity}])check('Different non-current or invalid draft refuses exact resume',()=>assert.throws(()=>currentServerDraft({...value,visit:{...value.visit,...patch}},'person-a','org-a','actor','visit-a'),/changed or is unavailable/));
 for(const patch of [{organisationId:'other'},{person:{id:'other'}}])check('Foreign source identity cannot generate a resume link',()=>assert.throws(()=>currentServerDraft({...value,...patch},'person-a','org-a','actor'),/could not be matched/));
 check('Missing trusted actor cannot generate any resume link',()=>assert.throws(()=>currentServerDraft(value,'person-a','org-a',''),/could not be matched/));
 check('Read-only discovery never mutates draft source',()=>{const before=structuredClone(value);currentServerDraft(value,'person-a','org-a','actor');assert.deepEqual(value,before);});
 for(const id of [42,true,['visit-a']])check('Non-string source identity cannot be coerced to a resume URL',()=>assert.throws(()=>currentServerDraft({...value,visit:{...value.visit,id}},'person-a','org-a','actor'),/changed or is unavailable/));
 const output=process.env.SAHA_RESUME_WORK_REPORT??'tests/reports/resume-work-contract-result.json';mkdirSync(join(output,'..'),{recursive:true});writeFileSync(output,JSON.stringify({passed:checks.length,failed:0,skipped:0,checks,completedAt:new Date().toISOString(),limits:'Closed exact-source navigation only; no durable device/offline/interrupted write/clinical/formal acceptance.'},null,2));console.log(`${checks.length} resume source/navigation checks passed`);
}finally{rmSync(dir,{recursive:true,force:true});}
