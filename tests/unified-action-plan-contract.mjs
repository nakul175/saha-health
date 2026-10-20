// SAHA-103 / APL-126 engineering contract. Synthetic only; it is not formal TC-BR-CARE-05 or TC-J11 acceptance.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir=mkdtempSync(join(process.cwd(),'.unified-action-plan-contract-'));let passed=0;
const check=fn=>{fn();passed++;};
const status=(fn,code,label)=>{try{fn();}catch(e){assert.equal(e.status,code,`${label}: ${e.message}`);return;}assert.fail(`${label}: expected ${code}`);};
try{
 for(const f of ['adapter-operations','core','fact-provenance','facility-scope','installed-transition-authority','mis','programme-completion','programmes','purpose-scope','access','referral-needs','referral-rules','types','plan-dependency-state','referral-consolidation'])
  writeFileSync(join(dir,f+'.js'),ts.transpileModule(readFileSync(`lib/saha/${f}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'"));
 const R=await import(pathToFileURL(join(dir,'referral-consolidation.js')));
 const D=await import(pathToFileURL(join(dir,'plan-dependency-state.js')));
 const now='2026-10-20T06:00:00.000Z',actor={userId:'asha',displayName:'Synthetic ASHA'},member={userId:'asha',displayName:'Synthetic ASHA',role:'asha',status:'active',isOwner:false,teamIds:['t1'],version:1,createdAt:now};
 const declaration=(id,compatibilityKey,depends=true)=>({id,need:'blood-pressure-review',compatibilityKey,urgency:'urgent',...(depends?{dependsOnCompletionRules:['review-first']}: {})});
 const pack=(id,name)=>({id,version:1,name,programme:'Chronic care',purpose:'Synthetic declared action plan contract',questions:[],completionRules:[{id:'review-first',label:'Synthetic review first',requiredQuestions:['review_done']}],referralNeeds:[declaration('shared-review','shared-bp'),declaration('separate-review',null,false)],installed:{installationId:'install-'+id,manifestHash:(id==='one'?'a':'b').repeat(64)}});
 const enrol=(id,packId,state='active')=>({id,packId,packVersion:1,state,episodeLabel:'Synthetic '+id,startDate:null,createdAt:'2026-10-01T00:00:00.000Z',createdBy:'doc',registration:'not_submitted'});
 const follow=(id,enrolmentId,packId)=>({id,enrolmentId,packId,title:'Synthetic prerequisite',due:'2026-10-21',ownerId:'asha',state:'open',createdAt:now,createdBy:'doc',completionContract:{rule:{id:'review-first',label:'Synthetic review first',requiredQuestions:['review_done']},packId,packVersion:1,installationId:'install-'+packId,manifestHash:(packId==='one'?'a':'b').repeat(64)}});
 const p={id:'p1',name:'Synthetic Person',age:40,sex:'Unknown',village:'Synthetic',programmes:['Chronic care'],task:'Visit',due:'Today',status:'due',aiConsent:false,exchangeConsent:false,consentVersion:1,assigned:true,assignedTo:'asha',teamId:'t1',createdAt:now,version:4,enrolments:[enrol('e1','one'),enrol('e2','two')],followUps:[follow('f1','e1','one'),follow('f2','e2','two')]};
 const v={id:'v1',personId:'p1',version:2,state:'confirmed',facts:{},aiResults:[],recordVersion:1,createdAt:'2026-10-19T05:00:00.000Z',confirmedAt:'2026-10-19T06:00:00.000Z',programmeCapture:{packs:[{enrolmentId:'e1',pack:pack('one','Pack One')},{enrolmentId:'e2',pack:pack('two','Pack Two')}],answers:{},absence:{}}};
 const s={organisation:{id:'org'},teams:[{id:'t1',name:'Team'}],members:[member],invitations:[],workspace:{role:'asha',people:[p],visits:[v],referrals:[],audit:[],submissions:[],integrations:[]},governance:{entries:[],evaluations:[],safety:[]},outreach:{plans:[],templates:[],messages:[]}};
 const req=(enrolmentId,over={})=>({enrolmentId,declarationId:'shared-review',need:'blood-pressure-review',facility:'Synthetic CHC',reason:'Synthetic programme-specific reason '+enrolmentId,windowStart:'2026-10-20',windowEnd:'2026-10-27',...over});
 const cmd=(requests,over={})=>({type:'createProgrammeReferrals',visitId:'v1',personVersion:p.version,visitVersion:v.version,requests,...over});
 const apply=(requests,over={})=>R.applyProgrammeReferrals(s,cmd(requests,over),actor,member,now);

 // Equivalent person, configured purpose, normalised destination and exact time window: one referral, two sources.
 const first=apply([req('e1'),req('e2',{facility:'  synthetic   chc ',reason:'Distinct reason retained for pack two'})]);
 check(()=>assert.deepEqual([first.created,first.consolidated,first.adopted],[1,0,0]));
 const shared=s.workspace.referrals[0];
 check(()=>assert.equal(s.workspace.referrals.length,1));
 check(()=>assert.equal(shared.packRequests.length,2));
 check(()=>assert.deepEqual(shared.sources.map(x=>x.refId).sort(),['e1','e2']));
 check(()=>assert.deepEqual(shared.packRequests.map(x=>x.reason),['Synthetic programme-specific reason e1','Distinct reason retained for pack two']));
 check(()=>assert.deepEqual(shared.need.equivalence,{personId:'p1',purposeKey:'shared-bp',destinationKey:'synthetic chc',windowStart:'2026-10-20',windowEnd:'2026-10-27'}));
 check(()=>assert.deepEqual(shared.packRequests.map(x=>x.episodeStateAtRequest),['active','active']));
 check(()=>assert.equal(p.planDependencies.length,2));
 check(()=>assert.ok(shared.packRequests.every(x=>x.dependencyIds?.length===1)));
 check(()=>assert.equal(D.planItemWaiting(s,p,{kind:'referral',id:shared.id}),true));
 check(()=>assert.match(s.workspace.audit.at(-1).detail,/No facility was contacted/));

 // Different time, destination or purpose remains independent even when the need label is identical.
 apply([req('e1',{windowStart:'2026-10-28',windowEnd:'2026-11-04'})]);
 apply([req('e1',{facility:'Synthetic District Hospital'})]);
 apply([req('e1',{declarationId:'separate-review'})]);
 check(()=>assert.equal(s.workspace.referrals.length,4));

 // Current versions bind preparation to commitment. Stale input and changed scope write nothing.
 const n=s.workspace.referrals.length,a=s.workspace.audit.length;
 status(()=>R.applyProgrammeReferrals(s,{...cmd([req('e1')]),personVersion:p.version-1},actor,member,now),409,'stale person');
 status(()=>R.applyProgrammeReferrals(s,{...cmd([req('e1')]),visitVersion:v.version+1},actor,member,now),409,'stale visit');
 check(()=>assert.deepEqual([s.workspace.referrals.length,s.workspace.audit.length],[n,a]));
 status(()=>R.applyProgrammeReferrals(s,{type:'createProgrammeReferrals',visitId:'v1',requests:[req('e1',{windowStart:'2027-02-01',windowEnd:'2027-02-02'})]},actor,member,now),422,'missing current versions');
 check(()=>assert.equal(s.workspace.referrals.length,n));
 check(()=>assert.equal(R.applyProgrammeReferrals(s,{...cmd([req('e1')]),requests:[req('e1',{windowStart:'2026-02-30',windowEnd:'2026-03-01'})]},actor,member,now),null));
 p.assignedTo='someone-else';status(()=>R.authorizeProgrammeReferrals(s,member,cmd([req('e1')])),403,'assignment removed');p.assignedTo='asha';
 s.operations={purposeGrants:[{id:'g',memberId:'asha',programme:null,purposes:['reporting'],version:1,setBy:'owner',setAt:now,reason:'Synthetic narrow purpose'}]};
 status(()=>R.authorizeProgrammeReferrals(s,member,cmd([req('e1')])),403,'purpose removed');delete s.operations;

 // A declared unavailable blocker refuses the entire batch before any mutation.
 const f2=p.followUps.find(x=>x.id==='f2');f2.state='completed';const before=JSON.stringify({r:s.workspace.referrals,a:s.workspace.audit,d:p.planDependencies,v:p.version});
 status(()=>apply([req('e1',{windowStart:'2026-12-01',windowEnd:'2026-12-02'}),req('e2',{windowStart:'2026-12-01',windowEnd:'2026-12-02'})]),409,'missing declared blocker');
 check(()=>assert.equal(JSON.stringify({r:s.workspace.referrals,a:s.workspace.audit,d:p.planDependencies,v:p.version}),before));f2.state='open';

 // A pre-boundary referral is adopted only by explicit matching id+version; a stale or wrong destination is refused.
 const legacy={id:'legacy',personId:'p1',visitId:'v1',facility:'Legacy CHC',reason:'Retained older reason',state:'sent',version:3,createdAt:now};s.workspace.referrals.push(legacy);
 status(()=>apply([req('e1',{facility:'Legacy CHC',windowStart:'2026-12-10',windowEnd:'2026-12-11'})],{adoptLegacy:{referralId:'legacy',version:2}}),409,'stale legacy');
 status(()=>apply([req('e1',{facility:'Different CHC',windowStart:'2026-12-10',windowEnd:'2026-12-11'})],{adoptLegacy:{referralId:'legacy',version:3}}),422,'different destination');
 const adopted=apply([req('e1',{facility:'Legacy CHC',windowStart:'2026-12-10',windowEnd:'2026-12-11'})],{adoptLegacy:{referralId:'legacy',version:3}});
 check(()=>assert.equal(adopted.adopted,1));
 check(()=>assert.equal(legacy.need.equivalence.destinationKey,'legacy chc'));
 check(()=>assert.equal(legacy.version,4));

 // Closing one episode after consolidation changes only its independent programme state, never the other episode.
 p.enrolments.find(x=>x.id==='e2').state='closed';
 const joined=apply([req('e1',{windowStart:'2027-01-01',windowEnd:'2027-01-02'}),req('e2',{windowStart:'2027-01-01',windowEnd:'2027-01-02'})]);
 check(()=>assert.deepEqual(joined.referrals[0].programmes.map(x=>x.state),['active','closed']));
 p.followUps.forEach(x=>x.state='completed');
 check(()=>assert.equal(D.planItemWaiting(s,p,{kind:'referral',id:shared.id}),false));

 // The current form sends the complete concurrency/equivalence boundary.
 const ui=readFileSync('app/programme-referral-panel.tsx','utf8');
 check(()=>assert.match(ui,/personVersion:person!\.version,visitVersion:v\.version/));
 check(()=>assert.match(ui,/windowStart,windowEnd/));
 check(()=>assert.match(ui,/adoptLegacy/));
 for(const file of ['lib/saha/referrals.ts','lib/saha/exceptions.ts','lib/saha/indicators.ts','lib/saha/operations.ts'])
  check(()=>assert.match(readFileSync(file,'utf8'),/planItemWaiting/));
 const installation=readFileSync('lib/saha/pack-installation.ts','utf8');
 check(()=>assert.match(installation,/dependsOnCompletionRules/));
 check(()=>assert.match(installation,/depends on unknown completion rule/));

 const result={suite:'SAHA-103 unified action plan engineering contract',passed,formalAcceptance:'not-run',completedAt:new Date().toISOString()};
 writeFileSync('tests/unified-action-plan-contract-result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}catch(e){console.error('CONTRACT FAIL',e);process.exitCode=1;}finally{rmSync(dir,{recursive:true,force:true});}
