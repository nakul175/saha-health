import assert from 'node:assert/strict';import ts from 'typescript';import {readdirSync,readFileSync,writeFileSync,mkdtempSync,rmSync,mkdirSync} from 'node:fs';import {join} from 'node:path';import {pathToFileURL} from 'node:url';
const dir=mkdtempSync(join(process.cwd(),'.figure-impact-'));let passed=0;const check=f=>{f();passed++};try{
 for(const f of readdirSync('lib/saha').filter(f=>f.endsWith('.ts')))writeFileSync(join(dir,f.replace(/\.ts$/,'.js')),ts.transpileModule(readFileSync('lib/saha/'+f,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'"));
 const {discoverFigureImpact:run}=await import(pathToFileURL(join(dir,'indicator-figure-impact.js'))),{operandRef}=await import(pathToFileURL(join(dir,'indicators.js')));
 const at='2026-10-05T12:00:00.000Z',u={personId:'protected-person',personVersion:1,sourceHashVersion:3,sourceHash:'original-source',sourceVersions:{visits:[]},f:{programme:['programme-A'],sex:['female']},g:{none:['all'],village:['village-A']},x:[],visits:[{at:'2026-10-02T12:00:00.000Z',signature:'s',reuse:[2,1,1]}],corrections:[],referrals:[],followupDue:[],maternal:0,unowned:0,unresolved:0,provisional:0};
 const material=unit=>({version:1,capturedAt:at,units:unit?[unit]:[]}),release=(n='visits-confirmed',over={})=>({v:'private',at,k:'key',f:{},c:{all:6},n,gd:'none',w:'2026-10-01T00:00:00.000Z',u:at,...over});
 const compare=(next,releases=[release()],old=u,valid=true,basis='same')=>run(material(old),material(next),releases,at,'original-figure',valid,basis);
 check(()=>assert.equal(typeof run,'function'));check(()=>assert.equal((Object.keys(u).includes('facts')),false));
 const unchanged=await compare(u);check(()=>assert.equal(unchanged.status,'unchanged'));const revised=await compare({...u,sourceHash:'notes-only'});check(()=>assert.equal(revised.status,'source-revised'));check(()=>assert.notEqual(revised.basisHash,unchanged.basisHash));
 const voided=await compare({...u,sourceHash:'void',visits:[]});check(()=>assert.equal(voided.status,'counting-affected'));const future=await compare({...u,visits:[...u.visits,{...u.visits[0],at:'2026-11-01T00:00:00.000Z'}]});check(()=>assert.equal(future.status,'unchanged'));

 const absent=await compare(null);check(()=>assert.equal(absent.status,'counting-affected'));const added=await compare(u,[release()],null);check(()=>assert.equal(added.status,'counting-affected'));
 for(const [name,next,r] of [
 ['filter',{...u,f:{programme:['B']}},release('patients',{f:{programme:'programme-A'}})],
 ['group',{...u,g:{...u.g,village:['village-B']}},release('patients',{gd:'village'})],
 ['exclusion',{...u,x:['identity-provisional']},release('patients',{x:['identity-provisional']})],
 ['denominator',{...u,maternal:1},release('visits-confirmed',{d:'maternal-episodes-active'})],
 ['patients-seen',{...u,visits:[]},release('patients-seen')],
 ['identity',{...u,provisional:1},release('identity-provisional')],
 ['maternal',{...u,maternal:1},release('maternal-episodes-active')],
 ['followups-open',{...u,followupDue:['2026-12-01']},release('followups-open')],
 ['referral-created',{...u,referrals:[{at:'2026-10-02T00:00:00Z',completed:false}]},release('referrals-created')],
 ['reuse-opportunities',{...u,visits:[{...u.visits[0],reuse:[3,1,2]}]},release('reuse-opportunities')],
 ['reuse-served',{...u,visits:[{...u.visits[0],reuse:[2,2,0]}]},release('reuse-served')],
 ['repeat',{...u,visits:[...u.visits,{...u.visits[0],at:'2026-10-03T00:00:00Z'}]},release('repeat-entries')],
 ['follow-up',{...u,followupDue:['2026-10-01']},release('followups-overdue')],
 ['referral',{...u,referrals:[{at:'2026-10-02T00:00:00Z',completed:true}]},release('referrals-completed')],
 ['submissions',{...u,unresolved:1},release('submissions-unresolved')],
 ['household-reopened',{...u,unowned:1},release('open-work-unowned')],
 ['reuse',{...u,visits:[{...u.visits[0],reuse:[3,1,2]}]},release('reuse-blocked')],
 ['correction',{...u,corrections:[{amendedAt:at,voidedAt:null}]},release('corrections')]
 ]){const x=await compare(next,[r]);check(()=>assert.equal(x.status,'counting-affected',name));}
 const expr=operandRef({version:1,expression:{op:'all',terms:[{measure:'maternal-episodes-active'},{measure:'submissions-unresolved'}]},fixtures:[]});const joint=await compare({...u,maternal:1},[release(expr)]);check(()=>assert.equal(joint.status,'counting-affected','All-zero output must retain changed primitive dependency'));
 const outside={...u,f:{programme:['outside']}};const irrelevant=await compare({...outside,sourceHash:'irrelevant',maternal:1},[release('maternal-episodes-active',{f:{programme:'programme-A'}})],outside);check(()=>assert.equal(irrelevant.status,'unchanged'));
 const oldLegacy=await compare(u,[release()],{...u,sourceHashVersion:undefined});check(()=>assert.equal(oldLegacy.status,'coverage-unknown'));const oldV2=await compare(u,[release()],{...u,sourceHashVersion:2});check(()=>assert.equal(oldV2.status,'coverage-unknown'));
 const definition=await compare(u,[release()],u,false,'retired-v1');check(()=>assert.equal(definition.status,'coverage-unknown'));const changedDefinition=await compare(u,[release()],u,false,'other-retired');check(()=>assert.notEqual(definition.basisHash,changedDefinition.basisHash));
 check(()=>assert.ok(!JSON.stringify(voided).includes(u.personId)));check(()=>assert.deepEqual(Object.keys(voided).sort(),['version','status','basisHash','checkedAt','notice'].sort()));check(()=>assert.equal(u.visits.length,1));check(()=>assert.equal(u.sourceHash,'original-source'));
 mkdirSync('tests/evidence/figure-impact',{recursive:true});writeFileSync('tests/evidence/figure-impact/contract.json',JSON.stringify({passed,actualProductionImpact:true,originalV3CountingUnchanged:true,noPatientDataInOutput:true},null,2));console.log({passed});
}finally{rmSync(dir,{recursive:true,force:true});}
