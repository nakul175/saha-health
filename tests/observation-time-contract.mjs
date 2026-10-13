import assert from 'node:assert/strict';import ts from 'typescript';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,mkdirSync,readdirSync} from 'node:fs';import {join} from 'node:path';import {pathToFileURL} from 'node:url';
const dir=mkdtempSync('.observation-time-'),checks=[],failures=[],before=process.env.SAHA_OBSERVATION_TIME_BEFORE==='1';
try{
 for(const name of readdirSync('lib/saha').filter(n=>n.endsWith('.ts'))){const code=ts.transpileModule(readFileSync('lib/saha/'+name,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'");writeFileSync(join(dir,name.replace(/\.ts$/,'.js')),code);}
 const P=await import(pathToFileURL(join(dir,'fact-provenance.js'))),C=await import(pathToFileURL(join(dir,'core.js')));
 const source=readFileSync('app/guided-capture.tsx','utf8'),capture=source.slice(source.indexOf('export function captureProblems('),source.indexOf('\nconst Context='));
 writeFileSync(join(dir,'capture.mjs'),ts.transpileModule("import {MEASURES,VALUE_FIELDS,factProvenance,measureValue,normaliseUnits,rangeProblem,selectionForVisit,validObservationMinute} from './fact-provenance.js';\n"+capture+"\nconst factStep=field=>'fact:'+(['systolic','diastolic'].includes(field)?'bloodPressure':field);",{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(', validObservationMinute',''));
 // Before source has no helper, so extract the actual current function against
 // its original imports; after source uses the actual shared helper export.
 if(!before){const emitted=ts.transpileModule("import {MEASURES,VALUE_FIELDS,factProvenance,measureValue,normaliseUnits,rangeProblem,selectionForVisit,validObservationMinute} from './fact-provenance.js';\n"+capture+"\nconst factStep=field=>'fact:'+(['systolic','diastolic'].includes(field)?'bloodPressure':field);",{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;writeFileSync(join(dir,'capture.mjs'),emitted);}
 const G=await import(pathToFileURL(join(dir,'capture.mjs'))),now=Date.parse('2026-10-12T12:00Z'),base={date:'2026-10-12T12:00',weight:'61',systolic:'',diastolic:'',temperature:'',weeks:'',coughDays:'',notes:'Synthetic time validation',source:'measured'};
 const check=(name,fn)=>{try{fn();checks.push(name);}catch(e){failures.push({name,error:String(e.stack??e)});if(!before)throw e;}};
 for(const time of ['2026-02-30T10:00','1900-02-29T10:00','2026-09-30T24:00']){
  check('Schema refuses impossible UTC minute '+time,()=>assert.equal(C.factsSchema.safeParse({...base,date:time}).success,false));
  check('Direct facts check refuses impossible UTC minute '+time,()=>assert.throws(()=>C.checkFacts({...base,date:time},now),e=>e.status===422));
  check('Guided source identifies impossible UTC minute '+time,()=>assert.ok(G.captureProblems({...base,date:time},{facts:base}).some(p=>p.step==='time')));
 }
 for(const time of ['not-a-date','',null])check('Direct own measurement time cannot bypass finite/calendar validation '+String(time),()=>assert.throws(()=>C.checkFacts({...base,provenance:{weight:{source:'measured',at:time}}},now),e=>e.status===422));
 for(const time of ['not-a-date',''])check('Guided own invalid time identifies weight field '+time,()=>assert.ok(G.captureProblems({...base,provenance:{weight:{source:'measured',at:time}}},{facts:base}).some(p=>p.step==='fact:weight')));
 if(!before){
  for(const time of ['2024-02-29T00:00','2000-02-29T23:59','0000-02-29T12:00','2026-04-30T23:59','2026-12-31T23:59'])check('Strict helper preserves real UTC minute '+time,()=>assert.equal(P.validObservationMinute(time),true));
  for(const time of ['2026-13-01T12:00','2026-00-01T12:00','2026-01-00T12:00','2026-04-31T12:00','2026-01-01T12:60','2026-01-01T12:00:00','2026-01-01T12:00Z','2026-01-01T12:00+05:30',' 2026-01-01T12:00',42,NaN,Infinity,{},undefined])check('Strict helper never coerces invalid format/calendar '+String(time),()=>assert.equal(P.validObservationMinute(time),false));
  check('Exactly5minute existing tolerance remains valid',()=>assert.equal(C.checkFacts({...base,date:'2026-10-12T12:05'},now).date,'2026-10-12T12:05'));
  check('Beyond existing5minute tolerance still refuses',()=>assert.throws(()=>C.checkFacts({...base,date:'2026-10-12T12:06'},now),/cannot be in the future/));
  check('Own valid time and visit fallback remain unchanged',()=>assert.equal(C.checkFacts({...base,provenance:{weight:{source:'reported',at:'2000-02-29T12:00'}}},now).provenance.weight.at,'2000-02-29T12:00'));
  check('Distinct missing reasons remain unchanged without invented time/value',()=>{const f={...base,weight:'',provenance:{weight:{source:'declined'},temperature:{source:'not-asked'},weeks:{source:'unknown'},coughDays:{source:'not-applicable'}}};assert.deepEqual(C.checkFacts(f,now),f);});
  check('Mandatory source/value contradiction still refuses',()=>assert.throws(()=>C.checkFacts({...base,provenance:{weight:{source:'declined'}}},now),/recorded value must be measured or reported/));
  check('Direct rejection leaves caller data byte unchanged',()=>{const f={...base,date:'2026-02-30T10:00'},s=JSON.stringify(f);assert.throws(()=>C.checkFacts(f,now));assert.equal(JSON.stringify(f),s);});
 }
 const output=process.env.SAHA_OBSERVATION_TIME_REPORT??'tests/reports/observation-time-contract-result.json';mkdirSync(join(output,'..'),{recursive:true});writeFileSync(output,JSON.stringify({passed:checks.length,failed:failures.length,skipped:0,checks,failures,before,completedAt:new Date().toISOString(),limits:'Actual schema/shareddirectcheck and extracted unchanged source presentation function; no clinical thresholds/formal approval.'},null,2));console.log(JSON.stringify({passed:checks.length,failed:failures.length,skipped:0}));if(failures.length)process.exitCode=1;
}finally{rmSync(dir,{recursive:true,force:true});}
