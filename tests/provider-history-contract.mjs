// Slice 5g contract: provider and model history per capability key, derived from governance revisions.
import assert from 'node:assert/strict';import ts from 'typescript';import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';import {join} from 'node:path';import {pathToFileURL} from 'node:url';
const dir=mkdtempSync(join(process.cwd(),'.provider-history-contract-'));let passed=0;const check=fn=>{fn();passed++};
try{
 for(const file of (await import('node:fs')).readdirSync('lib/saha').filter(x=>x.endsWith('.ts')).map(x=>x.slice(0,-3)))writeFileSync(join(dir,file+'.js'),ts.transpileModule(readFileSync(`lib/saha/${file}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'"));
 const L=await import(pathToFileURL(join(dir,'capability-lifecycle.js')));
 const T=n=>`2026-09-0${n}T10:00:00.000Z`;
 const spec=(x={})=>({kind:'capability',key:'cap',title:'Synthetic capability',teamIds:['team'],providerId:'local',model:'structured-parser-v2',agentVersion:'saha-agent-1.2.0',...x});
 const h=(...xs)=>xs.map(([state,n])=>({at:T(n),by:'owner',state,reason:'Synthetic history entry.'}));
 const r1={id:'r1',revision:1,version:5,spec:spec(),state:'retired',replacedBy:'r2',review:{by:'reviewer',at:T(1)},history:h(['draft',1],['reviewed',1],['active',2],['retired',4])};
 const r2={id:'r2',revision:2,version:5,spec:spec({providerId:'openai',model:'gpt-fixture-1'}),state:'suspended',review:{by:'reviewer',at:T(3)},history:h(['draft',3],['reviewed',3],['active',4],['suspended',6])};
 const r3={id:'r3',revision:3,version:1,spec:spec({providerId:'openai',model:'gpt-fixture-2'}),state:'draft',history:h(['draft',7])};
 const o1={id:'o1',revision:1,version:7,spec:spec({key:'other',title:'Other capability',providerId:'vendor'}),state:'active',review:{by:'reviewer',at:T(1)},history:h(['draft',1],['reviewed',1],['active',2],['suspended',3],['reviewed',4],['active',5])};
 const src={id:'src',revision:1,version:1,spec:{kind:'source',key:'src',title:'Source'},state:'active',history:[]};
 const run=(id,gov,createdAt,status='applied')=>({id,status,createdAt,governance:{id:gov}});
 const s={governance:{entries:[r3,r1,o1,src,r2],evaluations:[]},workspace:{integrations:[],visits:[{id:'visit-a',personId:'person-a',state:'confirmed',agentRuns:[run('a1','r1',T(2)),run('a2','r1',T(3),'cancelled')]},{id:'visit-b',personId:'person-b',state:'draft',agentRuns:[run('b1','r2',T(5),'review')]}]}};
 const rows=L.providerHistory(s,'cap');
 check(()=>assert.deepEqual(rows.map(r=>[r.revision,r.providerId,r.model]),[[1,'local','structured-parser-v2'],[2,'openai','gpt-fixture-1'],[3,'openai','gpt-fixture-2']],'revision order, each with its pinned provider and model'));
 check(()=>assert.deepEqual(rows.map(r=>r.changes),[[],['provider','model'],['model']]));
 check(()=>assert.deepEqual(rows.map(r=>[r.activatedAt,r.endedAt]),[[T(2),T(4)],[T(4),T(6)],[null,null]]));
 check(()=>assert.deepEqual(rows.map(r=>r.stage),['replaced','suspended','registered']));
 check(()=>assert.deepEqual(rows.map(r=>[r.requests,r.lastUsedAt]),[[2,T(3)],[1,T(5)],[0,null]],'requests of every status on that exact revision'));
 check(()=>assert.deepEqual(rows.map(r=>r.reviewedAt),[T(1),T(3),null]));
 const other=L.providerHistory(s,'other')[0];
 check(()=>assert.deepEqual([other.activatedAt,other.endedAt,other.stage],[T(2),null,'active'],'reactivated after a suspension: current, first activation kept'));
 check(()=>assert.deepEqual(L.providerHistory(s,'agentless').length,0));
 check(()=>assert.equal(L.providerHistory(s,'cap').find(r=>r.revision===3).changes.includes('agent-version'),false));
 check(()=>{const all=L.capabilityHistories(s);assert.deepEqual(all.map(x=>[x.key,x.title,x.providers,x.revisions.length]),[['cap','Synthetic capability',2,3],['other','Other capability',1,1]],'capabilities only, providers counted');});
 check(()=>assert.deepEqual(L.capabilityHistories(s,new Set(['other'])).map(x=>x.key),['other'],'restricted to the keys in scope'));
 check(()=>{const text=JSON.stringify(L.capabilityHistories(s));for(const leak of ['person-a','visit-a','a1','b1'])assert.ok(!text.includes(leak),leak);});
 r2.spec.agentVersion='saha-agent-1.3.0';check(()=>assert.deepEqual(L.providerHistory(s,'cap')[1].changes,['provider','model','agent-version']));
 const result={suite:'Provider history contract (slice 5g)',passed,completedAt:new Date().toISOString()};
 writeFileSync('tests/provider-history-contract-result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{rmSync(dir,{recursive:true,force:true});}
