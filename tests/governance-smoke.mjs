import assert from 'node:assert/strict';
export async function governanceSmoke({get,post,check,accounts,org,sql}){
 const {owner:o,clinician:c,worker:w,admin:a,supervisor:s,stranger:x}=accounts;const today=new Date().toISOString().slice(0,10),later=new Date(Date.now()+60*86400000).toISOString().slice(0,10);
 const read=who=>get(who,'/api/governance',200,org);let g=await read(o);check(()=>{assert.equal(g.clinicalDeployment,false);assert.equal(g.entries.length,0)});await get(x,'/api/governance',403,org);
 const base={ownerId:o.id,teamIds:['default'],effectiveFrom:today,reviewBy:later,changeSummary:'Synthetic governance workflow exercise only.'};
 const source={...base,key:'test-source',kind:'source',title:'Synthetic source',publisher:'Test publisher',edition:'fixture-1',url:'https://example.invalid/synthetic-source',applicability:'Synthetic example without clinical guidance.',summary:'Worker concern review fixture; not a clinical protocol.'};
 await post(w,{type:'createGovernance',spec:source},403);await post(s,{type:'createGovernance',spec:source},403);
 await post(o,{type:'createGovernance',spec:{...source,url:'http://example.invalid'}},422);
 const sourceId=(await post(o,{type:'createGovernance',spec:source})).result.entryId;
 await post(o,{type:'reviewGovernance',entryId:sourceId,version:1,reference:'TEST',findings:'Author cannot self-review this source.'},403);
 await post(o,{type:'transitionGovernance',entryId:sourceId,version:1,state:'active',reason:'Unreviewed package must not activate.'},409);
 async function reviewActivate(id,evaluationId){let e=(await read(o)).entries.find(e=>e.id===id);await post(c,{type:'reviewGovernance',entryId:id,version:e.version,reference:'SYNTHETIC-INDEPENDENT-REVIEW',findings:'Synthetic engineering review, not clinical acceptance.',...(evaluationId?{evaluationId}:{})});e=(await read(o)).entries.find(e=>e.id===id);await post(o,{type:'transitionGovernance',entryId:id,version:e.version,state:'active',reason:'Allow synthetic workflow rehearsal only.'});return (await read(o)).entries.find(e=>e.id===id);}
 await reviewActivate(sourceId);
 const service={...base,key:'test-service',kind:'service',title:'Synthetic review service',location:'Test site',services:'Synthetic clinician review routing only.',contactRoute:'SIMULATED-DESK',constraints:'No real service or facility contact is authorised.',verifiedOn:today,verificationReference:'SYNTHETIC-VERIFICATION'};
 const serviceId=(await post(o,{type:'createGovernance',spec:service})).result.entryId;await reviewActivate(serviceId);
 const protocol={...base,key:'test-protocol',kind:'protocol',title:'Synthetic concern protocol',programme:'General care',ageMin:18,ageMax:80,roles:['asha'],sourceIds:[sourceId],maxObservationAgeHours:24,transition:'new-reviews-only',rules:[{id:'worker-concern',label:'Reported concern',condition:{field:'workerConcern',operator:'eq',value:'yes'},urgency:'urgent_review',action:'Request human review from the synthetic service.',serviceId},{id:'unknown-concern',label:'Concern not assessed',condition:{field:'workerConcern',operator:'missing',value:''},urgency:'review',action:'Record the worker observation; unknown is not normal.',serviceId}]};
 const protocolId=(await post(o,{type:'createGovernance',spec:protocol})).result.entryId;await reviewActivate(protocolId);
 await get(o,'/api/workspace',200,org);const personId=(await post(o,{type:'createPerson',name:'Synthetic Governance Subject',age:32,sex:'Unknown',village:'Fixture village',programme:'General care',teamId:'default'})).result.personId;
 let p=o.state.people.find(p=>p.id===personId);await post(o,{type:'assignPatient',personId,version:p.version,teamId:'default',assignedTo:w.id,reason:'Assign synthetic governance test worker.'});
 await get(w,'/api/workspace',200,org);const visitId=(await post(w,{type:'startVisit',personId})).result.visitId;
 const v=()=>w.state.visits.find(v=>v.id===visitId);const view=()=>get(w,'/api/governance?visitId='+visitId,200,org);
 let preview=await view();check(()=>{assert.equal(preview.preview.findings[0].ruleId,'unknown-concern');assert.equal(preview.preview.unknowns.length,2)});
 await get(a,'/api/governance?visitId='+visitId,403,org);await get(x,'/api/governance?visitId='+visitId,403,org);
 await post(w,{type:'saveClinicalConcern',visitId,version:v().version,concern:'yes',reference:'SYNTHETIC-WORKER-OBSERVATION'});
 preview=await view();check(()=>{assert.equal(preview.preview.findings.length,1);assert.equal(preview.preview.findings[0].urgency,'urgent_review');assert.equal(preview.preview.findings[0].sources[0].edition,'fixture-1');assert.equal(preview.preview.findings[0].service.contactRoute,'SIMULATED-DESK')});
 const checkId=(await post(w,{type:'checkProtocol',visitId,version:v().version})).result.checkId;
 await post(w,{type:'reviewProtocol',visitId,version:v().version,checkId,decision:'accepted',reason:'A worker cannot make the clinical review decision.',reference:'TEST'},403);
 const clinicianView=await get(c,'/api/governance?visitId='+visitId,200,org);check(()=>{assert.equal(clinicianView.preview.protocols.length,0);assert.equal(clinicianView.checks.find(r=>r.id===checkId).reviewable,true)});
 await post(c,{type:'reviewProtocol',visitId,version:v().version,checkId,decision:'accepted',reason:'Synthetic finding and cited service reviewed.',reference:'SYNTHETIC-CLINICIAN'});
 await post(c,{type:'reviewProtocol',visitId,version:v().version,checkId,decision:'override',reason:'A reviewed decision cannot be overwritten.',reference:'TEST'},409);
 const staleId=(await post(w,{type:'checkProtocol',visitId,version:v().version})).result.checkId;
 await post(w,{type:'saveClinicalConcern',visitId,version:v().version,concern:'no',reference:'UPDATED-SYNTHETIC-OBSERVATION'});
 await post(c,{type:'reviewProtocol',visitId,version:v().version,checkId:staleId,decision:'accepted',reason:'Changed clinical context must reject stale review.',reference:'TEST'},409);
 // The English fallback passes the tiny known corpus; Hindi capability must fail.
 g=await read(o);const local=g.providers.find(p=>p.id==='local');const capability={...base,key:'test-capability',kind:'capability',title:'Synthetic local capability',providerId:'local',model:local.model,agentVersion:g.agentVersion,purpose:'documentary-evidence',ageMin:18,ageMax:80,roles:['asha','clinician'],populations:['General care'],languages:['en'],settings:['community'],devices:['browser'],tasks:['extract','summary'],inputQuality:'validated-text',excludedUses:'No diagnosis, prescribing or autonomous clinical action.',supportContact:'SYNTHETIC-OWNER',hostingRegion:'Local workspace',retentionTerms:'Synthetic workspace evidence retained for this test only.',trainingUse:'not-authorised',agreementReference:'SYNTHETIC-NO-EXTERNAL-DATA',dailyCallLimit:100,dailyTokenBudget:600000};
 const capId=(await post(o,{type:'createGovernance',spec:capability})).result.entryId;
 await post(o,{type:'createGovernance',spec:{...capability,key:'second-provider-key'}},409);
 await post(c,{type:'reviewGovernance',entryId:capId,version:1,reference:'TEST',findings:'Missing evaluation must prevent review.'},409);
 const prepared=(await post(o,{type:'prepareEvaluation',entryId:capId,version:1})).result;
 await post(w,{type:'runEvaluationCase',evaluationId:prepared.evaluationId,caseId:prepared.caseIds[0]},403);
 await post(o,{type:'runEvaluationCase',evaluationId:prepared.evaluationId,caseId:prepared.caseIds[1]},409);
 const first={type:'runEvaluationCase',evaluationId:prepared.evaluationId,caseId:prepared.caseIds[0]},key=crypto.randomUUID();await post(o,first,200,key);await post(o,first,200,key);await post(o,first);
 for(const caseId of prepared.caseIds.slice(1))await post(o,{type:'runEvaluationCase',evaluationId:prepared.evaluationId,caseId});
 g=await read(o);const ev=g.evaluations.find(e=>e.id===prepared.evaluationId);check(()=>{assert.equal(prepared.caseIds.length,18);assert.equal(ev.state,'completed');assert.equal(ev.results.length,prepared.caseIds.length);assert.equal(ev.metrics.passed,true);assert.equal(ev.metrics.precision,1);assert.equal(ev.metrics.recall,1);assert.equal(ev.metrics.criticalFailures,0)});
 await reviewActivate(capId,prepared.evaluationId);
 await get(w,'/api/workspace',200,org);p=w.state.people.find(p=>p.id===personId);if(!p.aiConsent)await post(w,{type:'setConsent',personId,version:p.version,purpose:'ai',active:true});
 const prepare={type:'prepareAgent',visitId,version:v().version,providerId:'local',task:'extract',input:'weight 58 kg',context:{language:'en',setting:'community',device:'browser'}};
 await post(w,{...prepare,context:{...prepare.context,language:'hi'}},409);await post(w,{...prepare,context:{...prepare.context,setting:'facility'}},409);
 const runId=(await post(w,prepare)).result.runId;const run=v().agentRuns.find(r=>r.id===runId);await post(w,{type:'executeAgent',visitId,runId,inputHash:run.inputHash});
 await post(w,{type:'reviewAgentResult',visitId,version:v().version,runId,decision:'override',reason:'Only a clinician may override an output.',reference:'TEST'},403);
 await post(w,{type:'reviewAgentResult',visitId,version:v().version,runId,decision:'rejected',reason:'Synthetic reject-path check; source retained.',reference:'SYNTHETIC-REJECTION'});check(()=>{const r=v().agentRuns.find(r=>r.id===runId);assert.equal(r.status,'cancelled');assert.equal(r.output.proposals[0].value,'58');assert.equal(r.reviewDecision.decision,'rejected')});
 await post(w,{type:'applyAgent',visitId,version:v().version,runId,fields:['weight'],date:new Date().toISOString().slice(0,16),source:'measured',includeNote:false},409);
 const pendingId=(await post(w,prepare)).result.runId;
 const safetyBody={type:'reportSafety',visitId,version:v().version,ownerId:c.id,kind:'misleading-output',summary:'Synthetic safety scenario; no person was harmed.',entryId:capId,hold:true};
 await post(w,safetyBody,403);const safetyId=(await post(c,safetyBody)).result.caseId;g=await read(o);check(()=>{assert.equal(g.entries.find(e=>e.id===capId).state,'suspended');assert.ok(g.safety.find(e=>e.id===safetyId).evidence.agentRuns.some(r=>r.id===runId))});
 await post(w,{type:'executeAgent',visitId,runId:pendingId,inputHash:v().agentRuns.find(r=>r.id===pendingId).inputHash},409);
 const adminView=await read(a);check(()=>{assert.equal(adminView.safety.length,0);assert.equal(adminView.affected.length,0);assert.ok(!JSON.stringify(adminView).includes('Synthetic Governance Subject'))});
 await post(o,{type:'resolveSafety',caseId:safetyId,version:1,reason:'Only the named owner can resolve this concern.',reference:'TEST'},403);
 await post(c,{type:'resolveSafety',caseId:safetyId,version:1,reason:'Synthetic output retained and capability held for reassessment.',reference:'SYNTHETIC-RESOLUTION'});
 await post(c,{type:'resolveSafety',caseId:safetyId,version:2,reason:'Closed cases cannot be overwritten.',reference:'TEST'},409);
 // New immutable capability revision broadens language; current Hindi fixtures may pass, but the revision must not inherit approval.
 const hiId=(await post(o,{type:'createGovernance',spec:{...capability,languages:['en','hi'],changeSummary:'Test Hindi scope without claiming Hindi support.'},replacesId:capId})).result.entryId;
 const hi=(await post(o,{type:'prepareEvaluation',entryId:hiId,version:1})).result;for(const caseId of hi.caseIds)await post(o,{type:'runEvaluationCase',evaluationId:hi.evaluationId,caseId});
 g=await read(o);check(()=>{const entry=g.entries.find(e=>e.id===hiId),ev=g.evaluations.find(e=>e.id===hi.evaluationId);assert.equal(hi.caseIds.length,21);assert.equal(ev.metrics.passed,true);assert.equal(ev.metrics.byLanguage.find(l=>l.language==='hi').recall,1);assert.equal(entry.state,'draft');assert.equal(entry.review,undefined)});
 await reviewActivate(hiId,hi.evaluationId);
 const currentHi=(await read(o)).entries.find(e=>e.id===hiId),cancelled=(await post(o,{type:'prepareEvaluation',entryId:hiId,version:currentHi.version})).result;await post(o,{type:'cancelEvaluation',evaluationId:cancelled.evaluationId,reason:'Stop before any synthetic provider invocation.'});await post(o,{type:'runEvaluationCase',evaluationId:cancelled.evaluationId,caseId:cancelled.caseIds[0]},409);
 await get(w,'/api/workspace',200,org);await post(w,{type:'saveVisit',visitId,version:v().version,facts:{...v().facts,notes:'Synthetic visit supporting directory referral testing.'}});await post(w,{type:'confirmVisit',visitId,version:v().version});
 const serviceEntry=(await read(o)).entries.find(e=>e.id===serviceId);const referralId=(await post(w,{type:'createDirectoryReferral',visitId,version:v().version,serviceId,serviceVersion:serviceEntry.version,reason:'Synthetic source-backed referral rehearsal.'})).result.referralId;
 check(()=>{const r=w.state.referrals.find(r=>r.id===referralId);assert.equal(r.directory.revision,1);assert.equal(r.directory.contactRoute,'SIMULATED-DESK');assert.equal(r.state,'draft')});
 // Source/service suspension invalidates dependent protocols immediately without rewriting history.
 await post(o,{type:'transitionGovernance',entryId:serviceId,version:serviceEntry.version,state:'suspended',reason:'Synthetic directory verification is no longer current.'});
 await post(w,{type:'createDirectoryReferral',visitId,version:v().version,serviceId,serviceVersion:serviceEntry.version,reason:'Stale service must reject this attempted referral.'},409);
 preview=await view();check(()=>{assert.equal(preview.services.length,1);assert.equal(preview.services[0].id,serviceId);assert.equal(preview.services[0].usable,false);assert.ok(preview.services[0].issues.includes('Service availability suspended'));assert.equal(preview.preview.protocols.length,0);assert.equal(preview.checks.find(c=>c.id===checkId).findings[0].sources[0].edition,'fixture-1')});
 // Immutable replacement retains the original edition and review history.
 const newer=(await post(o,{type:'createGovernance',spec:{...source,edition:'fixture-2',changeSummary:'Synthetic source edition replacement exercise.'},replacesId:sourceId})).result.entryId;await reviewActivate(newer);g=await read(o);check(()=>{assert.equal(g.entries.find(e=>e.id===sourceId).state,'retired');assert.equal(g.entries.find(e=>e.id===sourceId).spec.edition,'fixture-1');assert.equal(g.entries.find(e=>e.id===newer).revision,2)});
 await post(o,{type:'transitionGovernance',entryId:sourceId,version:g.entries.find(e=>e.id===sourceId).version,state:'active',reason:'Retired editions must never reactivate.'},409);
 check(()=>{const stored=JSON.parse(sql.prepare('SELECT data FROM governance WHERE org_id=?').get(org).data);assert.equal(stored.evaluations.length,3);assert.equal(stored.safety[0].state,'closed');assert.ok(stored.entries.every(e=>e.manifestHash.length===64))});
}
