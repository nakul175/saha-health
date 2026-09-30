import assert from 'node:assert/strict';
// Slice 5b: provider self-service in a provider sandbox, and import into production for the standard review path, over HTTP and local D1.
export async function providerSandboxSmoke({get,post,check,accounts,org}){
 const {owner:o,clinician:c}=accounts,vendorId=o.id.replace(/owner$/,'vendor');
 const vendor={id:vendorId,headers:{...o.headers,'oai-authenticated-user-id':vendorId,'oai-authenticated-user-email':'vendor@example.invalid'},state:null};
 await get(vendor,'/api/workspace');
 const reason='Provider sandbox for synthetic evaluation only.';
 // Only an owner can declare, and only an organisation without patient records.
 await post(c,{type:'declareProviderSandbox',providerId:'local',reason},403,undefined,org);
 await post(o,{type:'declareProviderSandbox',providerId:'local',reason},409,undefined,org);
 const box=(await post(o,{type:'createOrganisation',name:'Synthetic provider sandbox'})).result.organisationId;
 let view=await get(o,'/api/provider-sandbox',200,box);
 check(()=>{assert.equal(view.sandbox,null);assert.equal(view.canDeclare,true);assert.ok(view.providers.some(p=>p.id==='local'));assert.match(view.notice,/no credential value is stored/)});
 await post(o,{type:'declareProviderSandbox',providerId:'missing-provider',reason},404,undefined,box);
 await post(o,{type:'declareProviderSandbox',providerId:'local',reason:'short'},422,undefined,box);
 const key=crypto.randomUUID(),declare={type:'declareProviderSandbox',providerId:'local',reason};await post(o,declare,200,key,box);
 const replay=await post(o,declare,200,key,box);check(()=>assert.equal(replay.replayed,true));
 await post(o,declare,409,undefined,box);
 view=await get(o,'/api/provider-sandbox',200,box);check(()=>{assert.equal(view.sandbox.providerId,'local');assert.equal(view.canInvite,true);assert.equal(view.sandbox.documentation,null)});
 // The sandbox refuses patient records and care work, even for its owner.
 await post(o,{type:'createPerson',name:'Sandbox Synthetic Person',age:30,sex:'Female',village:'Sandbox locality',programme:'General care',teamId:'default'},409,undefined,box);
 // Provider accounts are invited only through the sandbox invitation.
 await post(o,{type:'createInvite',accountCode:vendor.state.user.accountCode,label:'Vendor engineer',role:'provider',teamIds:['default']},422,undefined,box);
 await post(o,{type:'inviteProvider',accountCode:c.state.user.accountCode,label:'Not a sandbox',teamIds:['default']},409,undefined,org);
 const inv=(await post(o,{type:'inviteProvider',accountCode:vendor.state.user.accountCode,label:'Vendor engineer',teamIds:['default']},200,undefined,box)).result;
 await post(vendor,{type:'joinOrganisation',token:inv.token});
 check(()=>{assert.equal(vendor.state.organisation.id,box);assert.equal(vendor.state.role,'provider');assert.equal(vendor.state.people.length,0)});
 const vendorWorkspace=await get(vendor,'/api/workspace',200,box);check(()=>{assert.equal(vendorWorkspace.role,'provider');assert.deepEqual(vendorWorkspace.people,[]);assert.deepEqual(vendorWorkspace.audit,[],'no organisation-level audit for a provider')});
 // Documentation with a credential reference, never a credential value.
 const docs=(extra={})=>({type:'saveProviderDocs',version:0,summary:'Synthetic extraction service for documentary evidence.',intendedUse:'Extract current measurements with exact source quotations.',limitations:'English only; no clinical interpretation.',knownFailureModes:'Withholds conflicting or unit-less values.',supportContact:'SYNTHETIC-VENDOR-SUPPORT',testEndpoint:'https://vendor.example/v1/extract',credentialReference:'VENDOR_SANDBOX_KEY',...extra});
 await post(vendor,docs({credentialReference:'sk-live-51Habcdefghijk'}),422,undefined,box);
 await post(vendor,docs({testEndpoint:'https://user:secret@vendor.example/v1'}),422,undefined,box);
 await post(vendor,docs(),200,undefined,box);
 await post(vendor,docs(),409,undefined,box);
 // Capability proposals for the sandbox's own provider only.
 const g=await get(vendor,'/api/governance',200,box),local=g.providers.find(p=>p.id==='local'),openai=g.providers.find(p=>p.id==='openai'),today=new Date().toISOString().slice(0,10),later=new Date(Date.now()+60*86400000).toISOString().slice(0,10);
 check(()=>{assert.equal(g.canAuthor,true);assert.equal(g.canReview,false);assert.equal(g.canActivate,false)});
 const spec={kind:'capability',key:'vendor-extractor',title:'Vendor extraction proposal',ownerId:o.id,teamIds:['default'],effectiveFrom:today,reviewBy:later,changeSummary:'Provider proposal for synthetic testing.',providerId:'local',model:local.model,agentVersion:g.agentVersion,purpose:'documentary-evidence',ageMin:18,ageMax:80,roles:['asha','clinician'],languages:['en'],settings:['community'],devices:['browser'],tasks:['extract'],excludedUses:'No diagnosis, prescribing or autonomous clinical action.',supportContact:'SYNTHETIC-VENDOR',hostingRegion:'Not activated',retentionTerms:'Synthetic test input only; nothing retained.',trainingUse:'not-authorised',agreementReference:'SYNTHETIC-AGREEMENT',dailyCallLimit:20,dailyTokenBudget:60000};
 await post(vendor,{type:'createGovernance',spec:{...spec,key:'other-provider',providerId:'openai',model:openai.model}},403,undefined,box);
 const entryId=(await post(vendor,{type:'createGovernance',spec},200,undefined,box)).result.entryId;
 await post(vendor,{type:'reviewGovernance',entryId,version:1,reference:'SELF-REVIEW',findings:'A provider reviewing its own proposal.'},403,undefined,box);
 await post(vendor,{type:'transitionGovernance',entryId,version:1,state:'active',reason:'A provider activating its own proposal.'},403,undefined,box);
 await post(o,{type:'transitionGovernance',entryId,version:1,state:'active',reason:'Activating inside the sandbox.'},409,undefined,box);
 await post(vendor,{type:'createPerson',name:'Vendor Synthetic Person',age:30,sex:'Female',village:'Sandbox locality',programme:'General care',teamId:'default'},403,undefined,box);
 await post(vendor,{type:'opsRates',version:0,input:1,output:1},403,undefined,box);
 // Synthetic evaluation of the provider's proposal, run by the provider.
 const prepared=(await post(vendor,{type:'prepareEvaluation',entryId,version:1},200,undefined,box)).result;
 for(const caseId of prepared.caseIds)await post(vendor,{type:'runEvaluationCase',evaluationId:prepared.evaluationId,caseId},200,undefined,box);
 view=await get(vendor,'/api/provider-sandbox',200,box);
 check(()=>{const p=view.proposals.find(x=>x.entryId===entryId);assert.equal(p.state,'draft');assert.equal(p.evaluation.state,'completed');assert.equal(p.evaluation.passed,true);assert.equal(view.sandbox.documentation.version,1);assert.equal(view.sandbox.documentation.credentialReference,'VENDOR_SANDBOX_KEY');assert.equal(view.canInvite,false)});
 // The provider cannot reach a production organisation or import anything.
 await get(vendor,'/api/governance',403,org);
 await get(vendor,'/api/provider-sandbox',403,org);
 const imp={type:'importCapabilityProposal',sandboxOrganisationId:box,entryId,entryVersion:1,ownerId:o.id,teamIds:['default'],changeSummary:'Imported provider proposal for production review.'};
 await post(vendor,imp,403,undefined,box);
 // Production: an owner of both organisations imports; the standard evaluation, review and activation follow.
 const prod=(await post(o,{type:'createOrganisation',name:'Synthetic import production'})).result.organisationId;
 const clinInv=(await post(o,{type:'createInvite',accountCode:c.state.user.accountCode,label:'Production reviewer',role:'clinician',teamIds:['default']},200,undefined,prod)).result;await post(c,{type:'joinOrganisation',token:clinInv.token});
 view=await get(o,'/api/provider-sandbox',200,prod);
 check(()=>{const s=view.sandboxes.find(x=>x.organisationId===box);assert.ok(s);assert.equal(s.documentation.version,1);assert.equal(s.proposals[0].entryId,entryId);assert.equal(s.proposals[0].evaluation.passed,true);assert.equal(s.proposals[0].imported,false);assert.equal('credentialReference' in s.documentation,false)});
 const cview=await get(c,'/api/provider-sandbox',200,prod);check(()=>assert.deepEqual(cview.sandboxes,[],'non-owners see no sandboxes'));
 await post(c,imp,403,undefined,prod);
 await post(vendor,imp,403,undefined,prod);
 // Slice 6p (independent review): not a sandbox, not the importer's own and not found give one 404
 // with one message, checked before the named organisation is read (no existence or sandbox oracle).
 const notSandbox=await post(o,{...imp,sandboxOrganisationId:org},404,undefined,prod);
 const missing=await post(o,{...imp,sandboxOrganisationId:'org_missing_sandbox'},404,undefined,prod);
 const outsider={id:o.id.replace(/owner$/,'outsider6p'),headers:{...o.headers,'oai-authenticated-user-id':o.id.replace(/owner$/,'outsider6p'),'oai-authenticated-user-email':'outsider6p@example.invalid'},state:null};
 await get(outsider,'/api/workspace');
 const outsiderProd=(await post(outsider,{type:'createOrganisation',name:'Synthetic outsider production'})).result.organisationId;
 const notYours=await post(outsider,{...imp,ownerId:outsider.id},404,undefined,outsiderProd);
 const outsiderMissing=await post(outsider,{...imp,ownerId:outsider.id,sandboxOrganisationId:'org_missing_sandbox'},404,undefined,outsiderProd);
 check(()=>{for(const x of [notSandbox,missing,notYours,outsiderMissing])assert.equal(x.error,missing.error,'one message for every unavailable source');assert.match(missing.error,/Provider sandbox not found or unavailable/)});
 const imported=(await post(o,imp,200,undefined,prod)).result.entryId;
 await post(o,imp,409,undefined,prod);
 let pg=await get(o,'/api/governance',200,prod);const entry=()=>pg.entries.find(e=>e.id===imported);
 check(()=>{assert.equal(entry().state,'draft');assert.equal(entry().origin.sandboxEntryId,entryId);assert.equal(entry().origin.evaluation.id,prepared.evaluationId);assert.equal(entry().usable,false);assert.ok(entry().issues.includes('Independent clinical review required'))});
 await post(c,{type:'reviewGovernance',entryId:imported,version:1,reference:'SYNTH-REVIEW',findings:'Reviewed against the sandbox evaluation only.',evaluationId:prepared.evaluationId},409,undefined,prod);
 await post(o,{type:'transitionGovernance',entryId:imported,version:1,state:'active',reason:'Activating without independent review.'},409,undefined,prod);
 const prodEval=(await post(o,{type:'prepareEvaluation',entryId:imported,version:1},200,undefined,prod)).result;
 for(const caseId of prodEval.caseIds)await post(o,{type:'runEvaluationCase',evaluationId:prodEval.evaluationId,caseId},200,undefined,prod);
 await post(c,{type:'reviewGovernance',entryId:imported,version:1,reference:'SYNTH-REVIEW',findings:'Production evaluation passed; provider documentation read.',evaluationId:prodEval.evaluationId},200,undefined,prod);
 await post(o,{type:'transitionGovernance',entryId:imported,version:2,state:'active',reason:'Owner activation after independent review.'},200,undefined,prod);
 pg=await get(o,'/api/governance',200,prod);check(()=>{assert.equal(entry().state,'active');assert.equal(entry().usable,true)});
 view=await get(o,'/api/provider-sandbox',200,prod);check(()=>{assert.equal(view.sandboxes.find(x=>x.organisationId===box).proposals[0].imported,true);assert.equal(view.imported[0].entryId,imported)});
 // Nothing in the sandbox became active.
 view=await get(vendor,'/api/provider-sandbox',200,box);check(()=>assert.ok(view.proposals.every(p=>p.state==='draft')));
 await post(o,{type:'switchOrganisation',organisationId:org});await post(c,{type:'switchOrganisation',organisationId:org});
}
