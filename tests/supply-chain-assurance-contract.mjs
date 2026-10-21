import assert from 'node:assert/strict';
import ts from 'typescript';
import {mkdtempSync,readdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

const dir=mkdtempSync(join(process.cwd(),'.supply-chain-contract-'));let passed=0;
const check=(condition,message)=>{assert.ok(condition,message);passed++};
const refusal=(fn,status,pattern)=>{try{fn()}catch(error){assert.equal(error.status,status);if(pattern)assert.match(error.message,pattern);passed++;return error}assert.fail(`Expected ${status}`)};
try{
 for(const file of readdirSync('lib/saha').filter(x=>x.endsWith('.ts'))){const source=readFileSync(join('lib/saha',file),'utf8'),compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'");writeFileSync(join(dir,file.replace(/\.ts$/,'.js')),compiled)}
 const {applyOperations,configurationSupplyComponent,currentProviderRelease,defaultOperations,ensureOperating,ensureProviderSupply,operationsSchema,unresolvedSupplyFindings}=await import(pathToFileURL(join(dir,'operations.js')));
 const {apply}=await import(pathToFileURL(join(dir,'core.js')));
 const owner={userId:'owner-a',displayName:'Owner A',role:'admin',status:'active',teamIds:[],version:1,isOwner:true},ownerB={...owner,userId:'owner-b',displayName:'Owner B'},worker={...owner,userId:'worker',displayName:'Worker',role:'asha',isOwner:false};
 const state={organisation:{id:'org',name:'Synthetic organisation',createdAt:'2026-01-01T00:00:00.000Z'},teams:[],members:[owner,ownerB,worker],invitations:[],workspace:{people:[],visits:[],referrals:[],integrations:[],audit:[]},operations:defaultOperations()};
 const actor=m=>({userId:m.userId,displayName:m.displayName});
 const base=(extra={})=>({type:'opsSupplyItem',version:state.operations.version,recordVersion:0,id:'dependency-runtime',kind:'dependency',name:'Synthetic runtime',release:'1.0.0',ownerId:owner.userId,controls:['Signed release provenance','Pinned exact dependency digest'],subprocessors:[],incidentContact:'SECURITY-CASE-QUEUE',updateObligation:'Notify the accountable owner before a supported release changes.',materialChange:'No material change disclosed for this synthetic fixture.',componentId:null,reason:'Establish the synthetic dependency assurance record.',...extra});
 const provider=(id,componentId,release='1',extra={})=>base({id,kind:'provider',name:`Synthetic provider ${id}`,release,subprocessors:[{name:'None disclosed',purpose:'Explicit provider declaration',jurisdiction:'Not applicable'}],componentId,...extra});

 check(operationsSchema.safeParse(base()).success,'complete dependency inventory command parses');
 check(!operationsSchema.safeParse(base({controls:[]})).success,'at least one security control is required');
 refusal(()=>applyOperations(structuredClone(state),base(),actor(worker),worker),403,/Operations access/);
 const created=applyOperations(state,base(),actor(owner),owner);
 check(created.recordVersion===1&&state.operations.supplyChain[0].history.length===0,'owner records versioned dependency inventory with an empty immutable history');
 check(state.workspace.audit.at(-1).detail.includes('controls, subprocessors, incident contact, update obligation and material change'),'inventory audit identifies retained assurance disclosures');
 refusal(()=>applyOperations(state,base({version:0}),actor(owner),owner),409,/Operations changed/);
 refusal(()=>applyOperations(state,base({version:state.operations.version,recordVersion:0,release:'1.0.1'}),actor(owner),owner),409,/Supplier record changed/);

 const first=structuredClone(state.operations.supplyChain[0]);
 const revised=applyOperations(state,base({version:state.operations.version,recordVersion:first.version,release:'1.0.1',materialChange:'Runtime patch release changes the signed digest; reviewed as security material.',reason:'Retain a new reviewed runtime inventory revision.'}),actor(owner),owner);
 const revisedItem=state.operations.supplyChain[0];
 check(revised.recordVersion===2&&revisedItem.history.length===1,'editing creates a new current inventory revision and retains prior history');
 check(revisedItem.history[0].release==='1.0.0'&&revisedItem.history[0].controls[0]===first.controls[0],'prior inventory content remains immutable and usable');
 refusal(()=>applyOperations(state,base({version:state.operations.version,recordVersion:2,release:'1.0.2',materialChange:'No material change disclosed.',reason:'A revision must include an explicit assessment.'}),actor(owner),owner),422,/material-change assessment/);

 const providerWithoutSubprocessors=provider('provider-incomplete','provider-one','1',{version:state.operations.version,subprocessors:[]});
 refusal(()=>applyOperations(state,providerWithoutSubprocessors,actor(owner),owner),422,/subprocessor disclosure/);
 state.workspace.integrations.push({id:'provider-one',name:'Synthetic provider',kind:'ai',mode:'http',status:'suspended',version:1},{id:'different-provider',name:'Different provider',kind:'ai',mode:'http',status:'suspended',version:1});
 refusal(()=>ensureOperating(state,{type:'toggleIntegration',integrationId:'provider-one',version:1},'2026-10-21T00:00:00.000Z'),423,/no current complete provider assurance inventory/);
 const providerCreated=applyOperations(state,provider('provider-one-assurance','provider-one','2',{version:state.operations.version}),actor(owner),owner);
 check(providerCreated.recordVersion===1&&ensureOperating(state,{type:'toggleIntegration',integrationId:'provider-one',version:1},'2026-10-21T00:00:00.000Z')===undefined,'generic provider activation requires the exact post-activation release inventory');
 const activated=structuredClone(state);activated.workspace.role='admin';await apply(activated.workspace,{type:'toggleIntegration',integrationId:'provider-one',version:1},owner.userId);
 check(activated.workspace.integrations[0].status==='active'&&activated.workspace.integrations[0].version===2&&currentProviderRelease(activated,'provider-one')==='2'&&ensureProviderSupply(activated,'provider-one','2026-10-21T00:00:00.000Z')===undefined,'actual activation stores the same exact release shown by operations and enforced at dispatch');
 refusal(()=>applyOperations(state,provider('provider-one-duplicate','provider-one','2',{version:state.operations.version}),actor(owner),owner),409,/exact component release already has/);
 refusal(()=>ensureOperating(state,{type:'toggleIntegration',integrationId:'provider-one',version:2},'2026-10-21T00:00:00.000Z'),409,/version changed/);
 refusal(()=>ensureOperating(state,{type:'frontlineAgreement',active:true,providerId:'frontline:oral-saathi',version:1},'2026-10-21T00:00:00.000Z'),423,/no current complete provider assurance inventory/);
 applyOperations(state,provider('frontline-assurance','frontline:oral-saathi','2',{version:state.operations.version}),actor(owner),owner);
 check(ensureOperating(state,{type:'frontlineAgreement',active:true,providerId:'frontline:oral-saathi',version:1},'2026-10-21T00:00:00.000Z')===undefined,'frontline activation uses exact post-activation agreement version inventory');
 refusal(()=>ensureOperating(state,{type:'anaemiaProvider',active:true,providerId:'independent:anaemia',version:1},'2026-10-21T00:00:00.000Z'),423,/no current complete provider assurance inventory/);
 applyOperations(state,provider('anaemia-assurance','independent:anaemia','2',{version:state.operations.version}),actor(owner),owner);
 check(ensureOperating(state,{type:'anaemiaProvider',active:true,providerId:'independent:anaemia',version:1},'2026-10-21T00:00:00.000Z')===undefined,'anaemia activation uses exact post-activation agreement version inventory');

 const item=state.operations.supplyChain.find(x=>x.id==='dependency-runtime');
 const finding=applyOperations(state,{type:'opsSupplyFinding',version:state.operations.version,itemId:item.id,recordVersion:item.version,severity:'critical',exploitable:true,scope:'deployment',componentId:null,remedy:'Upgrade to the reviewed fixed release and verify its signed digest.',reason:'Synthetic exploitable dependency remains unresolved.'},actor(owner),owner);
 check(finding.releaseBlocked===true&&unresolvedSupplyFindings(state,'2026-10-21T00:00:00.000Z').length===1,'critical exploitable deployment finding creates a release hold');
 refusal(()=>ensureOperating(state,{type:'deploymentConfigurationActivate',revisionId:'reviewed',reviewId:'review',version:1},'2026-10-21T00:00:00.000Z'),423,/Release blocked/);
 refusal(()=>ensureOperating(state,{type:'deploymentConfigurationRollback',revisionId:'prior',version:1},'2026-10-21T00:00:00.000Z'),423,/Release blocked/);
 check(ensureOperating(state,{type:'transitionGovernance',state:'suspended',entryId:'capability'},'2026-10-21T00:00:00.000Z')===undefined,'suspension remains available while release is blocked');
 check(ensureOperating(state,{type:'opsSupplyResolve'},'2026-10-21T00:00:00.000Z')===undefined,'remedy workflow remains available while release is blocked');
 const versionAfterFinding=item.version,opsVersionAfterFinding=state.operations.version;
 refusal(()=>applyOperations(state,{type:'opsSupplyResolve',version:opsVersionAfterFinding,itemId:item.id,findingId:finding.findingId,recordVersion:versionAfterFinding,resolution:'Installed and verified the fixed synthetic runtime release.',evidence:'SYNTHETIC-VERIFY-001'},actor(owner),owner),403,/different organisation owner/);
 check(item.version===versionAfterFinding&&item.findings[0].state==='open','self-approval refusal leaves the finding unchanged');
 const resolved=applyOperations(state,{type:'opsSupplyResolve',version:opsVersionAfterFinding,itemId:item.id,findingId:finding.findingId,recordVersion:versionAfterFinding,resolution:'Installed and independently verified the fixed synthetic runtime release.',evidence:'SYNTHETIC-VERIFY-001'},actor(ownerB),ownerB);
 check(resolved.state==='remediated'&&item.findings[0].resolvedBy===ownerB.userId,'different owner verifies implemented remedy');
 check(unresolvedSupplyFindings(state,'2026-10-21T00:00:00.000Z').length===0&&ensureOperating(state,{type:'deploymentConfigurationActivate'},'2026-10-21T00:00:00.000Z')===undefined,'deployment activation hold clears only after independent remedy verification');
 refusal(()=>applyOperations(state,{type:'opsSupplyResolve',version:state.operations.version,itemId:item.id,findingId:finding.findingId,recordVersion:item.version,resolution:'Attempt duplicate resolution of immutable record.',evidence:'SYNTHETIC-VERIFY-002'},actor(ownerB),ownerB),409,/already remediated/);

 const releaseA={id:'release-a',manifest:{kind:'language-content',key:'frontline-hi',version:1},manifestHash:'a'.repeat(64),state:'approved'},releaseB={id:'release-b',manifest:{kind:'language-content',key:'frontline-hi',version:2},manifestHash:'b'.repeat(64),state:'approved'};
 state.operations.configurationReleases=[releaseA,releaseB];
 const componentA=configurationSupplyComponent(releaseA.manifest.kind,releaseA.manifest.key,releaseA.manifestHash),componentB=configurationSupplyComponent(releaseB.manifest.kind,releaseB.manifest.key,releaseB.manifestHash);
 const configRecord=applyOperations(state,base({version:state.operations.version,id:'config-a',name:'Language configuration A',release:'1',componentId:componentA}),actor(owner),owner),configItem=state.operations.supplyChain.find(x=>x.id==='config-a');
 const configFinding=applyOperations(state,{type:'opsSupplyFinding',version:state.operations.version,itemId:configItem.id,recordVersion:configRecord.recordVersion,severity:'critical',exploitable:true,scope:'component',componentId:componentA,remedy:'Replace the exact affected manifest.',reason:'Exact configuration manifest has a critical finding.'},actor(owner),owner);
 refusal(()=>ensureOperating(state,{type:'configurationPublish',releaseId:'release-a',manifestHash:releaseA.manifestHash},'2026-10-21T00:00:00.000Z'),423,/Component configuration:language-content:frontline-hi/);
 check(ensureOperating(state,{type:'configurationPublish',releaseId:'release-b',manifestHash:releaseB.manifestHash},'2026-10-21T00:00:00.000Z')===undefined&&componentA!==componentB,'configuration publication finding binds exact release manifest key and does not disable another manifest');
 configItem.findings.find(x=>x.id===configFinding.findingId).state='remediated';

 const expiring=applyOperations(state,base({version:state.operations.version,id:'unsupported-dependency',name:'Unsupported runtime',release:'9',supportUntil:'2026-10-21',materialChange:'Support date declared for exact current release.',reason:'Exercise inclusive UTC support-date enforcement.'}),actor(owner),owner),unsupported=state.operations.supplyChain.find(x=>x.id==='unsupported-dependency');
 check(ensureOperating(state,{type:'deploymentConfigurationActivate'},'2026-10-21T23:59:59.999Z')===undefined,'supportUntil remains supported through the declared UTC calendar date');
 refusal(()=>ensureOperating(state,{type:'deploymentConfigurationActivate'},'2026-10-22T00:00:00.000Z'),423,/became unsupported after 2026-10-21; current UTC date 2026-10-22/);
 check(expiring.recordVersion===1&&unresolvedSupplyFindings(state,'2026-10-22T00:00:00.000Z').some(x=>x.source==='unsupported'&&x.item.id===unsupported.id),'unsupported release creates an explicit fail-closed synthetic hold');

 const providerItem=state.operations.supplyChain.find(x=>x.id==='provider-one-assurance');
 const componentFinding=applyOperations(state,{type:'opsSupplyFinding',version:state.operations.version,itemId:providerItem.id,recordVersion:providerItem.version,severity:'critical',exploitable:true,scope:'component',componentId:'provider-one',remedy:'Suspend the affected provider until its fixed release is reviewed.',reason:'Synthetic component vulnerability remains unresolved.'},actor(owner),owner);
 check(componentFinding.releaseBlocked===false,'component finding reports a scoped rather than deployment hold');
 refusal(()=>ensureOperating(state,{type:'toggleIntegration',integrationId:'provider-one',version:1},'2026-10-21T00:00:00.000Z'),423,/Component provider-one is disabled/);
 applyOperations(state,provider('different-provider-assurance','different-provider','2',{version:state.operations.version}),actor(owner),owner);
 check(ensureOperating(state,{type:'toggleIntegration',integrationId:'different-provider',version:1},'2026-10-21T00:00:00.000Z')===undefined,'unaffected component with its own current inventory can activate');
 const before=structuredClone(state.operations.supplyChain);
 refusal(()=>applyOperations(state,{type:'opsSupplyFinding',version:state.operations.version-1,itemId:providerItem.id,recordVersion:providerItem.version,severity:'high',exploitable:true,scope:'component',componentId:'provider-one',remedy:'This stale command must not be stored.',reason:'Exercise stale command refusal.'},actor(owner),owner),409,/Operations changed/);
 check(JSON.stringify(state.operations.supplyChain)===JSON.stringify(before),'stale concurrent write has zero inventory side effect');

 const frontlineSource=readFileSync('lib/saha/frontline-server.ts','utf8'),anaemiaSource=readFileSync('lib/saha/anaemia-server.ts','utf8'),operationsSource=readFileSync('lib/saha/operations-server.ts','utf8'),commandServerSource=readFileSync('lib/saha/server.ts','utf8');
 check(/frontlineAgreement',active:x\.active,providerId:'frontline:'\+x\.appId,version:x\.version/.test(frontlineSource),'actual frontline provider write supplies exact agreement version to the shared activation gate');
 check(/anaemiaProvider',active:input\.active,providerId:'independent:anaemia',version:input\.version/.test(anaemiaSource),'actual anaemia provider write supplies exact agreement version to the shared activation gate');
 check(operationsSource.includes("'supplyChain'")&&operationsSource.includes('supplyComponents'),'operations response exposes current inventory and exact selectable component bindings');
 check(operationsSource.includes("i.status==='active'?i.version:i.version+1")&&operationsSource.includes("agreement.active?agreement.version:agreement.version+1"),'operations API displays the exact current active release or post-activation release required for a suspended provider');
 check(commandServerSource.indexOf('ensureOperating(state,c)')<commandServerSource.indexOf('applyDeploymentConfiguration(state,c,u,m)'),'actual command server runs the activation hold before deployment configuration activate or rollback is applied');
 writeFileSync('tests/supply-chain-assurance-result.json',JSON.stringify({passed,suite:'supply-chain-assurance-contract',completedAt:new Date().toISOString()},null,2)+'\n');
 console.log(JSON.stringify({passed}));
}finally{rmSync(dir,{recursive:true,force:true})}
