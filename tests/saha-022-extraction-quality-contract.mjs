import assert from 'node:assert/strict';
import ts from 'typescript';
import {mkdtempSync,readdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

const dir=mkdtempSync(join(process.cwd(),'.saha-022-quality-'));let passed=0;
const check=(value,message)=>{assert.ok(value,message);passed++};
try{
 for(const file of readdirSync('lib/saha').filter(x=>x.endsWith('.ts'))){
  const source=readFileSync(join('lib/saha',file),'utf8');
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'");
  writeFileSync(join(dir,file.replace(/\.ts$/,'.js')),js);
 }
 const A=await import(pathToFileURL(join(dir,'agent.js'))),E=await import(pathToFileURL(join(dir,'evaluation.js')));
 const output=input=>{const assessment=A.localAssess(input);return assessment?{proposals:[],highlights:[],assessment}:A.validateOutput(A.localExtract(input),input,'extract').output};

 const mixed=output('वजन 58 किलोग्राम; BP 120/80 mmHg');
 check(mixed.proposals.some(x=>x.field==='weight'&&x.value==='58'),'mixed-language weight is extracted as a draft');
 check(mixed.proposals.some(x=>x.field==='systolic'&&x.value==='120'),'mixed-language BP is extracted as a draft');
 const adverseInput='No cough for 4 days; medicine dose about 2 or 3 tablets; Background speaker said weight 70 kg; weight 58 kg',adverse=output(adverseInput);
 check(adverse.proposals.length===1&&adverse.proposals[0].value==='58','negated, ambiguous and other-speaker values are withheld');
 check(adverse.reviewFlags.some(x=>x.reason==='negation'),'negation is visibly flagged');
 check(adverse.reviewFlags.some(x=>x.reason==='uncertainty'),'ambiguous medicine quantity is visibly flagged');
 check(adverse.reviewFlags.some(x=>x.reason==='other_speaker'),'background speaker is visibly flagged');
 check(adverse.reviewFlags.every(x=>adverseInput.slice(x.start,x.end)===x.quote),'every uncertainty retains an exact source segment');

 const results=E.EVALUATION_CASES.map(c=>({caseId:c.id,state:'completed',output:output(c.input)}));
 const metrics=E.scoreEvaluation(E.EVALUATION_CASES,results);
 check(E.CORPUS_VERSION==='saha-synthetic-evidence-2','quality evidence is versioned');
 check(metrics.passed&&metrics.precision===1&&metrics.recall===1,'versioned synthetic corpus meets the preserved 95 percent engineering target');
 check(metrics.missingness===0&&metrics.correctionBurden===0,'missingness and correction burden are reported');
 check(metrics.byField.every(x=>'missingness' in x&&'correctionBurden' in x),'field-level quality includes missingness and correction burden');
 check(metrics.byLanguage.some(x=>x.language==='hi')&&metrics.byGroup.some(x=>x.group==='noise'),'language and noise subgroups are reported');
 check(/representative-population/.test(metrics.scope),'synthetic results do not claim representative or clinical acceptance');

 const ui=readFileSync('app/agent-panel.tsx','utf8');
 check(ui.includes('Draft · extracted from the cited source · not a direct measurement'),'derived values are labelled as draft, not direct measurements');
 check(ui.includes('confirming the visit remains a separate action'),'authoritative confirmation remains separate');
 check(ui.includes('Nothing in this list is written as a confirmed fact.'),'uncertain source text cannot silently become confirmed');
 writeFileSync('tests/saha-022-extraction-quality-contract-result.json',JSON.stringify({suite:'saha-022-extraction-quality-contract',passed,corpusVersion:E.CORPUS_VERSION,metrics,completedAt:new Date().toISOString()},null,2)+'\n');
 console.log(JSON.stringify({passed,precision:metrics.precision,recall:metrics.recall}));
}finally{rmSync(dir,{recursive:true,force:true});}
