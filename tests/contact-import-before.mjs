// Historical baseline witness; direct/manual only, never a current-source negative suite.
import assert from 'node:assert/strict';
import ts from 'typescript';
import {execFileSync} from 'node:child_process';
import {readdirSync,readFileSync,writeFileSync,mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const dir=mkdtempSync(join(process.cwd(),'.contact-import-before-'));
try{for(const f of readdirSync('lib/saha').filter(f=>f.endsWith('.ts'))){const src=f==='record-import.ts'?execFileSync('git',['show','1d388bd2:lib/saha/record-import.ts'],{encoding:'utf8'}):readFileSync('lib/saha/'+f,'utf8');writeFileSync(join(dir,f.replace(/\.ts$/,'.js')),ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'"));}const old=await import(pathToFileURL(join(dir,'record-import.js')));assert.equal(old.recordImportInput.safeParse({kind:'contacts',csv:'person,method\nsynthetic,in_person'}).success,false);assert.equal(old.recordImportSchema.safeParse({type:'recordImportContactsReverse',batchId:'synthetic',planHash:'a'.repeat(64),reason:'Synthetic reversal'}).success,false);mkdirSync('tests/evidence/contact-import',{recursive:true});const r={baseline:'1d388bd2',passed:2,limits:'Actual historical input and command schemas evaluated; contacts and batch reversal absent. Not a current-source failure.'};writeFileSync('tests/evidence/contact-import/before.json',JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify(r));}finally{rmSync(dir,{recursive:true,force:true});}
