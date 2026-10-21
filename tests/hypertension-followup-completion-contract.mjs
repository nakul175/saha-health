import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,readdirSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';

const out='tests/evidence/hypertension-followup-completion-local';
rmSync(out,{recursive:true,force:true});mkdirSync(out,{recursive:true});
const build=join(out,'compiled');
mkdirSync(build,{recursive:true});
for(const file of readdirSync('lib/saha').filter(x=>x.endsWith('.ts'))){
 const js=ts.transpileModule(readFileSync(join('lib/saha',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'");
 writeFileSync(join(build,file.replace(/\.ts$/,'.js')),js);
}
const p=await import(pathToFileURL(join(process.cwd(),build,'programmes.js')));
let passed=0;const check=(name,fn)=>{fn();passed++;};
const v1=p.PACKS.find(x=>x.id==='hypertension'&&x.version===1);
const v2=p.PACKS.find(x=>x.id==='hypertension'&&x.version===2);
check('historical version remains byte-stable in meaning',()=>assert.deepEqual(v1.questions.map(x=>x.id),['weight','systolic','diastolic','medication_access']));
check('version 2 is an explicit reviewed migration',()=>assert.deepEqual(v2.migratesFrom,[1]));
check('measurements retain declared units',()=>assert.deepEqual(v2.questions.filter(x=>x.fact).map(x=>[x.id,x.unit]),[['weight','kg'],['systolic','mmHg'],['diastolic','mmHg']]));
check('reported medicines are visibly not a prescription',()=>assert.match(v2.questions.find(x=>x.id==='reported_medicines').label,/not a prescription/i));
check('adherence discussion is captured without an order change',()=>assert.match(v2.questions.find(x=>x.id==='adherence_discussed').label,/without changing an order/i));
check('review date is conditional on the reviewed next step',()=>assert.deepEqual(v2.questions.find(x=>x.id==='review_date').when,{id:'review_plan',value:'Review date recorded'}));
check('qualified review reason is conditional on a review request',()=>assert.deepEqual(v2.questions.find(x=>x.id==='escalation_reason').when,{id:'review_plan',value:'Qualified review requested'}));
check('no prescription or clinical-order field exists',()=>assert.equal(v2.questions.some(x=>/prescri(be|ption)|clinical[_ -]?order|dose change/i.test(x.id)),false));
check('schedule is manual and policy-neutral',()=>{assert.match(v2.schedule,/worker records/i);assert.match(v2.schedule,/nothing is scheduled automatically/i);assert.doesNotMatch(v2.schedule,/\b\d+\s*(day|week|month)/i);});
check('escalation preserves qualified-user review and has no automatic clinical threshold',()=>{assert.match(v2.escalation,/qualified user/i);assert.match(v2.escalation,/does not infer a threshold/i);assert.match(v2.escalation,/or escalate automatically/i);});
const capture=p.captureFor([{id:'e1',packId:'hypertension',packVersion:2,state:'active',episodeLabel:'Synthetic follow-up',startDate:null,createdAt:'2026-10-15T00:00:00Z',createdBy:'worker',registration:'not_submitted'}]);
check('version 2 is available to the existing capture engine',()=>assert.deepEqual(capture.packs.map(x=>[x.pack.id,x.pack.version]),[['hypertension',2]]));
capture.answers={reported_medicines:'Reported medicine history',medication_access:'Available',adherence_discussed:'Discussed',review_plan:'Qualified review requested',escalation_reason:'Worker requested qualified review'};
check('inactive review date is not required',()=>assert.equal(p.questions(capture).some(x=>x.id==='review_date'),false));
check('qualified-review reason is required and can be resolved',()=>assert.equal(p.unresolved({facts:{},programmeCapture:capture}).some(x=>x.id==='escalation_reason'),false));
const result={story:'SAHA-035',passed,failed:0,scope:'Local application-code contract only; no clinical/domain/formal/CI/merge/deployment acceptance.'};
writeFileSync(join(out,'result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
