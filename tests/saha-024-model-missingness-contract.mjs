import assert from 'node:assert/strict';
import ts from 'typescript';
import {mkdirSync,mkdtempSync,readFileSync,readdirSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

const dir=mkdtempSync(join(process.cwd(),'.saha-024-model-missingness-'));
const checks=[];
const check=(name,fn)=>{fn();checks.push(name);};
try{
 for(const name of readdirSync('lib/saha').filter(name=>name.endsWith('.ts'))){const source=readFileSync('lib/saha/'+name,'utf8');writeFileSync(join(dir,name.replace(/\.ts$/,'.mjs')),ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.mjs'"));}
 const R=await import(pathToFileURL(join(dir,'reason-codes.mjs')).href);
 const inputFacts={provenance:{temperature:{source:'declined'},weeks:{source:'unknown'},weight:{source:'reported'}}};
 const absence={cough:'Not measured',consent:'Unable to obtain'};
 const before=JSON.stringify({inputFacts,absence});
 const lines=R.modelReasonContext(inputFacts,absence);
 check('Explicit missing refused and uncertain states stay distinct for model context',()=>assert.deepEqual(lines,[
  'measurement temperature: declined [refused]',
  'measurement weeks: unknown [uncertain]',
  'programme consent: unable-to-obtain [uncertain]',
  'programme cough: not-asked [missing]',
 ]));
 check('Recorded values do not become missingness claims',()=>assert.ok(lines.every(x=>!x.includes('weight'))));
 check('Preparation is pure and does not coerce source records',()=>assert.equal(JSON.stringify({inputFacts,absence}),before));
 check('No answer value patient identity or fabricated normal finding enters context',()=>assert.ok(lines.every(x=>!/=|normal|patient|name/i.test(x))));
 check('Unknown unapproved absence labels are omitted rather than guessed',()=>assert.deepEqual(R.modelReasonContext(undefined,{x:'Other'}),[]));
 const A=await import(pathToFileURL(join(dir,'agent.mjs')).href);
 const summary=A.agentSummarySource({facts:{date:'2026-10-16T04:00',source:'measured',systolic:'',diastolic:'',weight:'',temperature:'',weeks:'',coughDays:'',notes:'',provenance:inputFacts.provenance},programmeCapture:{packs:[],answers:{confirmed:'yes'},absence}});
 check('Actual summary preparation consumes the deterministic reason context',()=>assert.match(summary,/confirmed: yes[\s\S]*temperature: declined \[refused\][\s\S]*weeks: unknown \[uncertain\][\s\S]*consent: unable-to-obtain \[uncertain\][\s\S]*cough: not-asked \[missing\]/));
 check('Actual summary preparation does not flatten provenance into an ambiguous object string',()=>assert.doesNotMatch(summary,/\[object Object\]/));
 const output=process.env.SAHA_024_REPORT??'tests/reports/saha-024-model-missingness-result.json';
 mkdirSync(join(output,'..'),{recursive:true});
 writeFileSync(output,JSON.stringify({passed:checks.length,failed:0,skipped:0,checks,limits:'Local application/model-source coding only; no provider call, clinical policy, formal acceptance, CI, merge or deployment.'},null,2)+'\n');
 console.log(`${checks.length} SAHA-024 model missingness checks passed`);
}finally{rmSync(dir,{recursive:true,force:true});}
