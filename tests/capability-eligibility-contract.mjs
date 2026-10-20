import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const dir=mkdtempSync(join(process.cwd(),'.capability-eligibility-'));let passed=0;
const check=(label,fn)=>{fn();passed++;};
try{
  for(const name of (await import('node:fs')).readdirSync('lib/saha').filter(x=>x.endsWith('.ts'))){const file=name.slice(0,-3);writeFileSync(join(dir,file+'.js'),ts.transpileModule(readFileSync(`lib/saha/${name}`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'"));}
  const {capabilityEligibility,rankEligibleCapabilities,governanceSpec}=await import(pathToFileURL(join(dir,'governance.js')));
  const {agentApply,AGENT_VERSION}=await import(pathToFileURL(join(dir,'agent.js')));
  const now=new Date().toISOString(),today=now.slice(0,10),later=new Date(Date.now()+86400000).toISOString().slice(0,10);
  const owner={userId:'owner',displayName:'Owner',accountCode:'OWN',role:'clinician',status:'active',teamIds:['team'],version:1,isOwner:true};
  const reviewer={...owner,userId:'reviewer',displayName:'Reviewer',accountCode:'REV',isOwner:false};
  const worker={...owner,userId:'worker',displayName:'Worker',accountCode:'WRK',role:'asha',isOwner:false};
  const person={id:'person',name:'Synthetic Person',village:'Synthetic Village',version:1,consentVersion:1,aiConsent:true,teamId:'team',assignedTo:'worker',assigned:true,age:32,programmes:['General care']};
  const visit={id:'visit',personId:'person',version:1,recordVersion:1,state:'draft',facts:{date:now.slice(0,16),notes:'',weight:''},agentRuns:[]};
  const provider=(id,model)=>({id,name:id,mode:'http',model,version:1,available:true,reason:'Synthetic configured provider'});
  const approved=provider('approved','approved-model'),cheap=provider('cheap','cheap-model');
  const spec=(p,languages=['en'])=>({kind:'capability',key:`${p.id}-cap`,title:`${p.id} capability`,ownerId:'owner',teamIds:['team'],effectiveFrom:today,reviewBy:later,changeSummary:'Synthetic routing eligibility contract.',providerId:p.id,model:p.model,agentVersion:AGENT_VERSION,purpose:'documentary-evidence',ageMin:18,ageMax:60,roles:['asha'],populations:['General care'],languages,settings:['community'],devices:['browser'],tasks:['extract'],inputQuality:'validated-text',jurisdictions:['IN'],connectivity:['online'],minimumInputQuality:'adequate',excludedUses:'No diagnosis or autonomous clinical action.',supportContact:'Synthetic owner',hostingRegion:'Synthetic local fixture',retentionTerms:'Synthetic data retained for this test only.',trainingUse:'not-authorised',agreementReference:'SYNTHETIC',dailyCallLimit:10,dailyTokenBudget:60000});
  const entry=(id,p,languages)=>({id,revision:1,version:1,spec:spec(p,languages),manifestHash:`hash-${id}`,createdBy:'owner',createdAt:now,state:'active',history:[],review:{by:'reviewer',memberVersion:1,ownerVersion:1,authorVersion:1,at:now,reference:'SYNTHETIC',findings:'Synthetic pass.',dependencyStamp:'[]',evaluationId:`evaluation-${id}`}});
  const a=entry('approved-entry',approved,['en']),c=entry('cheap-entry',cheap,['hi']);
  check('legacy capability declarations receive explicit current routing defaults',()=>{const parsed=governanceSpec.parse({...a.spec,jurisdictions:undefined,connectivity:undefined,minimumInputQuality:undefined});assert.deepEqual(parsed.jurisdictions,['IN']);assert.deepEqual(parsed.connectivity,['online']);assert.equal(parsed.minimumInputQuality,'adequate');});
  const state={organisation:{id:'org',name:'Synthetic',revision:1,createdAt:now},members:[owner,reviewer,worker],teams:[{id:'team',name:'Team',createdAt:now}],invitations:[],workspace:{people:[person],visits:[visit],referrals:[],audit:[],role:'asha',integrations:[],submissions:[],receipts:{}},governance:{entries:[a,c],evaluations:[a,c].map(e=>({id:e.review.evaluationId,entryId:e.id,corpusVersion:'fixture-v1',corpusHash:'fixture-corpus-'+e.id,manifestHash:e.manifestHash,state:'completed',metrics:{passed:true}})),safety:[]}};
  const context={language:'en',setting:'community',device:'browser',jurisdiction:'IN',connectivity:'online',inputQuality:'adequate',intendedUse:'documentary-evidence'};
  check('approved candidate eligible',()=>assert.equal(capabilityEligibility(state,worker,person,approved,'extract',context,AGENT_VERSION).eligible,true));
  check('cheaper incompatible language excluded with reason',()=>assert.deepEqual(capabilityEligibility(state,worker,person,cheap,'extract',context,AGENT_VERSION).exclusions.map(x=>x.code),['language']));
  const ranked=rankEligibleCapabilities(state,worker,person,'extract',context,AGENT_VERSION,[{provider:cheap,cost:0,latencyMs:1},{provider:approved,cost:10,latencyMs:500}]);
  check('eligibility precedes price and speed',()=>{assert.equal(ranked.eligible.length,1);assert.equal(ranked.eligible[0].candidate.provider.id,'approved');assert.equal(ranked.excluded[0].candidate.provider.id,'cheap');});
  for(const [label,change,code] of [
    ['jurisdiction',{jurisdiction:'XX'},'jurisdiction'],['connectivity',{connectivity:'offline'},'connectivity'],['input quality',{inputQuality:'insufficient'},'input-quality'],['intended use',{intendedUse:'diagnosis'},'intended-use']
  ]) check(`${label} fails closed`,()=>assert.ok(capabilityEligibility(state,worker,person,approved,'extract',{...context,...change},AGENT_VERSION).exclusions.some(x=>x.code===code)));
  check('role fails closed',()=>assert.ok(capabilityEligibility(state,{...worker,role:'supervisor'},person,approved,'extract',context,AGENT_VERSION).exclusions.some(x=>x.code==='role')));
  check('population fails closed',()=>assert.ok(capabilityEligibility(state,worker,{...person,age:12},approved,'extract',context,AGENT_VERSION).exclusions.some(x=>x.code==='population')));
  check('permission fails closed',()=>assert.ok(capabilityEligibility(state,worker,{...person,aiConsent:false},approved,'extract',context,AGENT_VERSION).exclusions.some(x=>x.code==='permission')));
  const actor={userId:'worker',displayName:'Worker'};
  await agentApply(state,{type:'prepareAgent',visitId:'visit',version:1,providerId:'approved',task:'extract',input:'Weight 58 kg',context:{language:'en',setting:'community',device:'browser',jurisdiction:'IN',connectivity:'online',intendedUse:'documentary-evidence'}},actor,worker,[approved]);
  check('prepared run retains eligibility receipt',()=>{const r=visit.agentRuns[0];assert.equal(r.eligibility.eligible,true);assert.deepEqual(r.eligibility.exclusions,[]);assert.equal(r.context.inputQuality,'adequate');});
  await assert.rejects(()=>agentApply(state,{type:'prepareAgent',visitId:'visit',version:1,providerId:'approved',task:'extract',input:'Weight 5? kg',context:{language:'en',setting:'community',device:'browser',jurisdiction:'IN',connectivity:'online',intendedUse:'documentary-evidence'}},actor,worker,[approved]),/input-quality/);passed++;
  writeFileSync('tests/capability-eligibility-contract-result.json',JSON.stringify({passed,suite:'SAHA-042 eligibility before tool selection',formalAcceptance:false,liveProviderTested:false,completedAt:new Date().toISOString()},null,2)+'\n');
  console.log(`${passed} capability eligibility checks passed`);
}finally{rmSync(dir,{recursive:true,force:true});}
