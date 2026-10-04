// Slice 5b contract: provider self-service in a provider sandbox (BR-AI-11). Provider accounts exist only
// in a sandbox that holds no patient records, keep their documentation and a credential reference, propose
// capability versions and run the synthetic corpus; an owner of both organisations imports a proposal as a
// production draft that must pass the production evaluation, independent review and owner activation.
import assert from 'node:assert/strict';import ts from 'typescript';import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';import {join} from 'node:path';import {pathToFileURL} from 'node:url';
const dir=mkdtempSync(join(process.cwd(),'.provider-sandbox-contract-'));let passed=0;const check=fn=>{fn();passed++};
const status=async(fn,code,pattern)=>{try{await fn();}catch(e){assert.equal(e.status,code,e.message);if(pattern)assert.match(e.message,pattern);passed++;return e;}assert.fail(`expected ${code}`);};
try{
 for(const file of ['abdm', 'abdm-transfer', 'access', 'action-plan', 'adapter-operations', 'agent', 'agent-minimisation', 'ai-budget', 'alerts', 'anaemia', 'audit-chain', 'capability-lifecycle', 'caseload', 'consent', 'continuity', 'core', 'delegation', 'ehr', 'environment', 'evaluation', 'exceptional', 'expansion', 'facility-scope', 'fact-provenance', 'fhir-document', 'fhir-validate', 'field', 'field-device', 'field-registration', 'governance', 'household', 'household-constants', 'household-visit', 'household-visit-constants', 'identity', 'imported-visits', 'media', 'merge', 'mis', 'operations', 'outreach', 'pack-installation', 'partition', 'pilot', 'programme-commands', 'programmes', 'provider-sandbox', 'purpose-scope', 'referral-needs', 'referral-request', 'referral-rules', 'retention', 'rights', 'seed', 'send-gate', 'service-identity', 'shadow', 'store', 'task-limits', 'types', 'withdrawal-notices'])writeFileSync(join(dir,file+'.js'),ts.transpileModule(readFileSync(`lib/saha/${file}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'"));
 const sandboxModule=await import(pathToFileURL(join(dir,'provider-sandbox.js'))),{applySandbox,authorizeSandbox,sandboxSchema,PROVIDER_COMMANDS}=sandboxModule;
 const {applyGovernance,authorizeGovernance,activeEntry,entryIssues}=await import(pathToFileURL(join(dir,'governance.js'))),{applyEvaluation,authorizeEvaluation,EVALUATION_CASES,scoreEvaluation}=await import(pathToFileURL(join(dir,'evaluation.js')));
 const {providers,AGENT_VERSION,localExtract,validateOutput}=await import(pathToFileURL(join(dir,'agent.js'))),{allowed,normallyAllowed}=await import(pathToFileURL(join(dir,'access.js')));
 const now=new Date().toISOString(),today=now.slice(0,10),later=new Date(Date.now()+60*86400000).toISOString().slice(0,10);
 const ps=providers([],{}),actor=id=>({userId:id,displayName:'Synthetic '+id});
 const owner={userId:'owner',displayName:'Synthetic owner',accountCode:'A'.repeat(24),role:'clinician',status:'active',teamIds:['team'],version:1,isOwner:true};
 const vendor={userId:'vendor',displayName:'Synthetic vendor',accountCode:'B'.repeat(24),role:'provider',status:'active',teamIds:['team'],version:1,isOwner:false};
 const helper={...owner,userId:'helper',accountCode:'C'.repeat(24),isOwner:false},reviewer={...owner,userId:'reviewer',isOwner:false},owner2={...owner,userId:'owner2'};
 const org=(id,members,people=[])=>({organisation:{id,name:id+' organisation'},teams:[{id:'team',name:'Care team'}],members,invitations:[],workspace:{people,visits:[],referrals:[],audit:[],integrations:[],role:'clinician'}});
 const patient={id:'patient',name:'Synthetic Subject',village:'Test village',version:1,consentVersion:1,aiConsent:true,teamId:'team',assignedTo:'owner',age:32,programmes:['General care']};
 const box=org('sandbox',[owner]),prod=org('prod',[owner,reviewer,owner2],[patient]);
 const sandbox=(s,c,m=owner,source)=>applySandbox(s,c,actor(m.userId),m,ps,source,now);
 const spec=(extra={})=>({kind:'capability',key:'vendor-extractor',title:'Vendor extraction proposal',ownerId:'owner',teamIds:['team'],effectiveFrom:today,reviewBy:later,changeSummary:'Provider proposal for synthetic testing.',providerId:'local',model:ps.find(p=>p.id==='local').model,agentVersion:AGENT_VERSION,purpose:'documentary-evidence',ageMin:18,ageMax:80,roles:['asha','clinician'],languages:['en'],settings:['community'],devices:['browser'],tasks:['extract'],excludedUses:'No diagnosis, prescribing or autonomous clinical action.',supportContact:'SYNTHETIC-VENDOR',hostingRegion:'Not activated',retentionTerms:'Synthetic test input only; nothing retained.',trainingUse:'not-authorised',agreementReference:'SYNTHETIC-AGREEMENT',dailyCallLimit:20,dailyTokenBudget:60000,...extra});
 const docs=(extra={})=>({type:'saveProviderDocs',version:0,summary:'Synthetic extraction service for documentary evidence.',intendedUse:'Extract current measurements with exact source quotations.',limitations:'English only; no clinical interpretation.',knownFailureModes:'Withholds conflicting or unit-less values.',supportContact:'SYNTHETIC-VENDOR-SUPPORT',testEndpoint:'https://vendor.example/v1/extract',credentialReference:'VENDOR_SANDBOX_KEY',...extra});
 // Runs every corpus case through the local parser, as the evaluation runner would, and scores it.
 const complete=(s,evaluationId)=>{const ev=s.governance.evaluations.find(e=>e.id===evaluationId),cases=ev.caseIds.map(id=>EVALUATION_CASES.find(c=>c.id===id));ev.results=cases.map(c=>({caseId:c.id,state:'completed',startedAt:now,finishedAt:now,output:validateOutput(localExtract(c.input),c.input,'extract').output}));ev.state='completed';ev.metrics=scoreEvaluation(cases,ev.results);return ev;};

 // A provider account outside a sandbox can do nothing, and never has patient scope.
 check(()=>assert.equal(normallyAllowed({...vendor},patient),false,'a provider in the patient team still has no care scope'));
 check(()=>assert.equal(allowed({...vendor},patient,now),false));
 await status(()=>authorizeSandbox(prod,vendor,{type:'createGovernance',spec:spec()}),403,/only in a provider sandbox/);

 // Declaring a sandbox: owner only, empty organisations only, a registered provider.
 await status(()=>sandbox(box,{type:'declareProviderSandbox',providerId:'local',reason:'Vendor sandbox for synthetic testing.'},helper),403,/owner/);
 await status(()=>sandbox(prod,{type:'declareProviderSandbox',providerId:'local',reason:'Vendor sandbox for synthetic testing.'}),409,/no patient records/);
 await status(()=>sandbox(box,{type:'declareProviderSandbox',providerId:'missing-provider',reason:'Vendor sandbox for synthetic testing.'}),404);
 box.members.push(helper);await status(()=>sandbox(box,{type:'declareProviderSandbox',providerId:'local',reason:'Vendor sandbox for synthetic testing.'}),409,/before inviting/);box.members.pop();
 check(()=>assert.equal(sandboxSchema.safeParse({type:'declareProviderSandbox',providerId:'local',reason:'short'}).success,false,'a reason is required'));
 const declared=await sandbox(box,{type:'declareProviderSandbox',providerId:'local',reason:'Vendor sandbox for synthetic testing.'});
 check(()=>{assert.equal(declared.providerId,'local');assert.equal(box.governance.sandbox.providerId,'local');assert.equal(box.governance.sandbox.declaredBy,'owner');assert.match(box.workspace.audit.at(-1).detail,/provider sandbox for Local record assistant.*unavailable here/)});
 await status(()=>sandbox(box,{type:'declareProviderSandbox',providerId:'local',reason:'Vendor sandbox for synthetic testing.'}),409,/already a provider sandbox/);

 // Provider invitations: owner only, sandbox only, one pending per account.
 const invite={type:'inviteProvider',accountCode:vendor.accountCode,label:'Synthetic vendor engineer',teamIds:['team']};
 await status(()=>sandbox(prod,invite),409,/only be invited to a provider sandbox/);
 box.members.push(helper);await status(()=>sandbox(box,invite,helper),403,/owner/);
 const invited=await sandbox(box,invite);
 check(()=>{const i=box.invitations.at(-1);assert.equal(i.role,'provider');assert.match(invited.token,/^[a-f0-9]{64}$/);assert.notEqual(i.tokenHash,invited.token);assert.deepEqual(i.teamIds,['team'])});
 await status(()=>sandbox(box,invite),409,/current invitation/);
 box.members.push(vendor);

 // A provider may use only its own commands, and the sandbox refuses patient work for everyone.
 for(const type of ['createPerson','startVisit','reviewGovernance','importCapabilityProposal','opsBudget','prepareAgent','createInvite','inviteProvider','rosterApply'])await status(()=>authorizeSandbox(box,vendor,{type}),403,/own documentation/);
 for(const type of ['createPerson','reviewGovernance','prepareAgent','rosterApply','sendSubmission','opsBudget'])await status(()=>authorizeSandbox(box,owner,{type}),409,/holds no patient records/);
 await status(()=>authorizeSandbox(box,owner,{type:'transitionGovernance',state:'active'}),409,/cannot activate/);
 check(()=>assert.doesNotThrow(()=>authorizeSandbox(box,owner,{type:'transitionGovernance',state:'retired'}),'withdrawing a proposal is allowed'));
 check(()=>assert.ok(PROVIDER_COMMANDS.every(t=>!['reviewGovernance','transitionGovernance','importCapabilityProposal'].includes(t))));
 await status(()=>authorizeSandbox(box,owner,{type:'updateMember',userId:'vendor',role:'clinician'}),409,/keep the provider role/);
 await status(()=>authorizeSandbox(box,owner,{type:'updateMember',userId:'helper',role:'provider'}),409,/keep the provider role/);
 await status(()=>authorizeSandbox(prod,owner,{type:'updateMember',userId:'nobody',role:'provider'}),409,/only in a provider sandbox/);
 check(()=>assert.doesNotThrow(()=>authorizeSandbox(box,owner,{type:'updateMember',userId:'vendor',role:'provider'}),'suspending a provider keeps its role'));

 // Capability proposals: only for the sandbox's provider and only of kind capability.
 await status(()=>authorizeSandbox(box,vendor,{type:'createGovernance',spec:spec({providerId:'openai'})}),403,/Local record assistant only/);
 await status(()=>authorizeSandbox(box,vendor,{type:'createGovernance',spec:{kind:'source'}}),403,/capability proposals/);
 const propose=async(extra={},replacesId)=>{const c={type:'createGovernance',spec:spec(extra),...(replacesId?{replacesId}:{})};authorizeSandbox(box,vendor,c);return applyGovernance(box,c,actor('vendor'),vendor,now);};
 const first=await propose();const proposal=()=>box.governance.entries.find(e=>e.id===first.entryId);
 check(()=>{assert.equal(proposal().state,'draft');assert.equal(proposal().createdBy,'vendor')});
 await status(()=>authorizeGovernance(box,vendor,{type:'reviewGovernance',entryId:first.entryId}),403,/clinician/);

 // Documentation and a credential reference, never a credential value.
 for(const bad of [{credentialReference:'sk-live-51Habc'},{credentialReference:'SK_ABCDEFGHIJKLMNOPQRSTUV'},{credentialReference:'vendor key'},{testEndpoint:'https://user:pw@vendor.example/v1'},{testEndpoint:'http://vendor.example/v1'},{testEndpoint:'https://vendor.example/v1?key=abc'},{summary:'short'}])check(()=>assert.equal(sandboxSchema.safeParse(docs(bad)).success,false,JSON.stringify(bad)));
 await status(()=>sandbox(prod,docs()),409,/kept in a provider sandbox/);
 await status(()=>sandbox(box,docs(),helper),403,/provider or a sandbox owner/);
 const saved=await sandbox(box,docs(),vendor);
 check(()=>{const d=box.governance.sandbox.documentation;assert.equal(saved.version,1);assert.equal(d.version,1);assert.equal(d.credentialReference,'VENDOR_SANDBOX_KEY');assert.equal(d.updatedBy,'vendor');assert.match(d.hash,/^[a-f0-9]{64}$/);assert.match(box.workspace.audit.at(-1).detail,/no credential value is stored/)});
 await status(()=>sandbox(box,docs(),vendor),409,/changed/);
 await status(()=>sandbox(box,docs({version:1}),vendor),422,/No documentation change/);

 // Synthetic evaluation of the provider's own proposal inside the sandbox.
 check(()=>assert.doesNotThrow(()=>authorizeEvaluation(box,vendor,{type:'prepareEvaluation',entryId:first.entryId,version:1})));
 const boxEval=await applyEvaluation(box,{type:'prepareEvaluation',entryId:first.entryId,version:1},actor('vendor'),vendor,ps,now);
 check(()=>assert.ok(boxEval.caseIds.length>=10));

 // Import into production: owner of both, documentation and a passing sandbox evaluation required.
 const imp=(extra={})=>({type:'importCapabilityProposal',sandboxOrganisationId:'sandbox',entryId:first.entryId,entryVersion:1,ownerId:'owner',teamIds:['team'],changeSummary:'Imported provider proposal for production review.',...extra});
 await status(()=>sandbox(prod,imp(),owner,box),409,/passing synthetic evaluation/);
 const sandboxRun=complete(box,boxEval.evaluationId);check(()=>assert.equal(sandboxRun.metrics.passed,true,'the local parser passes the English corpus'));
 await status(()=>sandbox(prod,imp(),reviewer,box),403,/owner must import/);
 // Slice 6p (independent review): not the importer's own and not a sandbox answer the same 404 as not found.
 await status(()=>sandbox(prod,imp(),owner2,box),404,/Provider sandbox not found or unavailable/);
 await status(()=>sandbox(box,imp(),owner,box),409,/into a production organisation/);
 await status(()=>sandbox(prod,imp(),owner,prod),404,/Provider sandbox not found or unavailable/);
 await status(()=>sandbox(prod,imp(),owner,null),404);
 await status(()=>sandbox(prod,imp({entryVersion:2}),owner,box),409,/proposal changed/);
 await status(()=>sandbox(prod,imp({entryId:'missing'}),owner,box),404);
 const noDocs=structuredClone(box);delete noDocs.governance.sandbox.documentation;await status(()=>sandbox(prod,imp(),owner,noDocs),409,/documentation/);
 const before=prod.workspace.audit.length;const imported=await sandbox(prod,imp(),owner,box);const entry=()=>prod.governance.entries.find(e=>e.id===imported.entryId);
 check(()=>{const e=entry();assert.equal(e.state,'draft');assert.equal(e.createdBy,'owner');assert.equal(e.spec.providerId,'local');assert.equal(e.spec.changeSummary,'Imported provider proposal for production review.');assert.notEqual(e.manifestHash,proposal().manifestHash,'the production manifest is its own');assert.equal(e.origin.sandboxEntryId,first.entryId);assert.equal(e.origin.sandboxManifestHash,proposal().manifestHash);assert.equal(e.origin.evaluation.id,boxEval.evaluationId);assert.equal(e.origin.documentation.version,1);assert.equal('credentialReference' in e.origin.documentation,false,'sandbox credential references stay in the sandbox');assert.equal('testEndpoint' in e.origin.documentation,false)});
 check(()=>{const events=prod.workspace.audit.slice(before);assert.equal(events.length,2);assert.match(events[1].detail,/sandbox evaluation does not count/)});
 check(()=>{assert.equal(proposal().state,'draft','the sandbox proposal is unchanged');assert.equal(box.governance.entries.some(e=>e.state==='active'),false)});
 await status(()=>sandbox(prod,imp(),owner,box),409,/already imported/);

 // Production follows the standard path: its own evaluation, independent review, owner activation.
 await status(()=>applyGovernance(prod,{type:'reviewGovernance',entryId:imported.entryId,version:1,reference:'SYNTH-REVIEW',findings:'Reviewed with the sandbox evaluation only.',evaluationId:boxEval.evaluationId},actor('reviewer'),reviewer,now),409,/passing synthetic evaluation for this exact manifest/);
 await status(()=>applyGovernance(prod,{type:'transitionGovernance',entryId:imported.entryId,version:1,state:'active',reason:'Activate without an independent review.'},actor('owner'),owner,now),409,/Independent review must precede activation/);
 const prodEval=await applyEvaluation(prod,{type:'prepareEvaluation',entryId:imported.entryId,version:1},actor('owner'),owner,ps,now);complete(prod,prodEval.evaluationId);
 await status(()=>applyGovernance(prod,{type:'reviewGovernance',entryId:imported.entryId,version:1,reference:'SYNTH-REVIEW',findings:'Importer cannot review own import.',evaluationId:prodEval.evaluationId},actor('owner'),owner,now),403,/different clinician/);
 await applyGovernance(prod,{type:'reviewGovernance',entryId:imported.entryId,version:1,reference:'SYNTH-REVIEW',findings:'Production evaluation passed; documentation read.',evaluationId:prodEval.evaluationId},actor('reviewer'),reviewer,now);
 check(()=>{assert.equal(entry().state,'reviewed');assert.deepEqual(entryIssues(prod,entry(),now),[])});
 await applyGovernance(prod,{type:'transitionGovernance',entryId:imported.entryId,version:2,state:'active',reason:'Owner activation after independent review.'},actor('owner'),owner,now);
 check(()=>assert.equal(activeEntry(prod,entry(),now),true));

 // A later sandbox revision supersedes the imported one; the superseded draft cannot be imported again.
 const second=await propose({changeSummary:'Second provider proposal revision.'},first.entryId);
 await status(()=>sandbox(prod,imp(),owner,box),409,/later proposal revision/);
 check(()=>assert.equal(box.governance.entries.find(e=>e.id===second.entryId).revision,2));
 writeFileSync('tests/provider-sandbox-result.json',JSON.stringify({passed,suite:'provider-sandbox-contract',completedAt:new Date().toISOString()},null,2)+'\n');console.log(JSON.stringify({passed}));
}finally{rmSync(dir,{recursive:true,force:true});}
