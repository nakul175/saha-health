import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import ts from 'typescript';
const source=readFileSync('app/programmes.tsx','utf8');
const begin=source.indexOf('  const previous=baseline.current,token=');
const end=source.indexOf('  setAnswers(nextAnswers);setAbsence(nextAbsence);',begin);
assert.ok(begin>=0&&end>begin);
const ownLine=readFileSync('lib/saha/programmes.ts','utf8').split('\n').find(x=>x.startsWith('export const own='));
const module={exports:{}};new Function('exports',ts.transpileModule(ownLine,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(module.exports);
const own=module.exports.own;
const wrapped=ts.transpileModule('function effect(baseline,savedReadChoice,c,v,answers,absence,own,questions){'+source.slice(begin,end)+'return {answers:nextAnswers,absence:nextAbsence};}',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;const run=new Function(wrapped+'return effect;')();
let passed=0;const check=(a,b)=>{assert.deepEqual(a,b);passed++};
const q=()=>[{id:'cough'},{id:'testing'}];
const v={id:'visit',facts:{}};
const baseline=(answers,absence)=>({current:{visitId:v.id,answers,absence,readToken:0}});
const merge=(prevA,prevM,localA,localM,current)=>run(baseline(prevA,prevM),{token:1,kind:'merge'},current,v,localA,localM,own,q);
for(const reserved of ['constructor','toString','__proto__']){
 const prev=Object.create({cough:'prototype previous',testing:'inherited test'});prev[reserved]='previous own bad';
 const local=Object.create({cough:'prototype local',testing:'other inherited test'});local[reserved]='local own bad';
 const out=merge(prev,prev,local,local,{answers:{cough:'No',testing:'No'},absence:{}});
 check(out.answers,{cough:'No',testing:'No'});check(out.absence,{});
 check(Object.getPrototypeOf(out.answers),Object.prototype);check(Object.keys(out.answers).includes(reserved),false);
}
check(merge({cough:'No'},{},{cough:'Yes'},{},{answers:{cough:'No',testing:'No'},absence:{}}).answers,{cough:'Yes',testing:'No'});
check(merge({cough:'Yes'},{},{},{cough:'declined'},{answers:{cough:'Yes',testing:'No'},absence:{}}),{answers:{testing:'No'},absence:{cough:'declined'}});
check(merge({},{cough:'declined'},{cough:'Yes'},{},{answers:{testing:'No'},absence:{cough:'declined'}}),{answers:{testing:'No',cough:'Yes'},absence:{}});
const na=Object.create(null);na.cough='Yes';check(merge({},{},na,Object.create(null),{answers:{testing:'No'},absence:{}}).answers,{testing:'No',cough:'Yes'});
check(run(baseline({cough:'No'},{}),{token:1,kind:'load'},{answers:{testing:'No'},absence:{}},v,{cough:'Yes'},{},own,q),{answers:{testing:'No'},absence:{}});
writeFileSync('tests/evidence/programme-raw-key-independent/legacy/effect-result.json',JSON.stringify({passed,failed:0,productionEffectExtracted:true,productionOwnHelper:true,limits:'Mounted-state effect production body with controlled eligible-question list; actual eligibility/explicit handlers independently exercised by Worker/phone drivers.'},null,2)+'\n');console.log({passed,failed:0});
