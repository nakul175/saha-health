import assert from 'node:assert/strict';
import ts from 'typescript';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';

const dir=mkdtempSync(join(tmpdir(),'saha-language-resource-'));
let passed=0; const check=(name,fn)=>{fn();passed++;};
try{
  writeFileSync(join(dir,'messages.mjs'),ts.transpileModule(readFileSync('lib/saha/messages.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
  const M=await import(pathToFileURL(join(dir,'messages.mjs')));
  check('English source is declared available',()=>assert.deepEqual(M.languageResource('en','clinical.noProtocol'),{requestedLanguage:'en',effectiveLanguage:'en',revision:'source-en-v1',state:'qualified',safetyCritical:true,available:true,fallbackReason:null}));
  check('Hindi critical resource fails closed',()=>assert.deepEqual(M.languageResource('hi','clinical.noProtocol'),{requestedLanguage:'hi',effectiveLanguage:'en',revision:'draft-hi-v1',state:'draft',safetyCritical:true,available:false,fallbackReason:'qualified-language-resource-unavailable'}));
  check('Hindi navigation draft remains visibly labelled',()=>assert.equal(M.languageResource('hi','nav.work').effectiveLanguage,'hi'));
  check('clinical string falls back to preserved English',()=>assert.equal(M.message('hi','clinical.urgentTag'),'Urgent review'));
  check('capture instruction falls back to preserved English',()=>assert.equal(M.message('hi','capture.weeks'),M.message('en','capture.weeks')));
  check('receipt sign-off preserves name, date, digits and UTC',()=>assert.equal(M.signOffLine('hi',{byName:'Meena देवी',at:'2026-10-16T05:30:00.000Z'}),'signed off by Meena देवी, 2026-10-16 05:30 UTC'));
  check('numeric and unit interpolation is unchanged',()=>assert.equal(M.message('hi','clinical.visitRev',{n:57}),'Visit revision 57'));
  check('unknown recorded values are not translated',()=>assert.equal(M.labelFor('hi','capture.measure','Meena 57.25 kg'),'Meena 57.25 kg'));
  check('declared unavailable explanation is bilingual',()=>{assert.match(M.message('hi','common.criticalUnavailable'),/[ऀ-ॿ]/);assert.match(M.message('en','common.criticalUnavailable'),/unavailable/);});
  check('draft resource does not invent review evidence',()=>assert.equal(M.LANGUAGE_RESOURCES.hi.reviewReference,null));
  console.log(JSON.stringify({suite:'SAHA-005 qualified language resource contract',passed,failed:0}));
} finally {rmSync(dir,{recursive:true,force:true});}
