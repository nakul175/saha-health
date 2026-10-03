import assert from 'node:assert/strict';
// Slice 10g (BR-DATA-02): enforced disputes on a confirmed fact or answer, per-programme and per-destination sign-off rules,
// and sign-off withdrawal, through the built Worker and local D1. Synthetic people and demonstration destinations only.
export async function sendGateSmoke({get,post,check,accounts,org,sql}){
 const {owner:o,worker:w,clinician:c,supervisor:s,admin:a}=accounts,fresh=async(...xs)=>{for(const x of xs)await get(x,'/api/workspace',200,org);};
 await fresh(o,c,s,w);
 const rows=(table,action,subject)=>sql.prepare(`SELECT count(*) AS n FROM ${table} WHERE org_id=? AND ${table==='audit_events'?'subject':'entity_id'}=? AND action=?`).get(org,subject,action).n;
 const startVersion=o.state.signOffPolicy.version;
 check(()=>{assert.equal(o.state.signOffPolicy.required,false);assert.deepEqual(o.state.signOffPolicy.rules??{programmes:{},destinations:{}},{programmes:{},destinations:{}});});
 // A confirmed synthetic visit with a measurement, notes and one programme answer, recorded by the owner (a clinician).
 const pid=(await post(o,{type:'createPerson',name:`Dispute Synthetic ${crypto.randomUUID().slice(0,6)}`,age:49,sex:'Female',village:'Dispute synthetic locality',programme:'Chronic care',teamId:'default'})).result.personId;
 const per=who=>who.state.people.find(p=>p.id===pid);
 await post(o,{type:'enrolProgramme',personId:pid,version:per(o).version,packId:'hypertension',episodeLabel:'Synthetic dispute episode',startDate:null});
 const vid=(await post(o,{type:'startVisit',personId:pid})).result.visitId,vis=who=>who.state.visits.find(v=>v.id===vid);
 await post(o,{type:'saveVisit',visitId:vid,version:vis(o).version,facts:{date:new Date(Date.now()-3600000).toISOString().slice(0,16),systolic:'148',diastolic:'94',weight:'68',temperature:'',weeks:'',coughDays:'',notes:'Synthetic notes for the dispute test.',source:'measured'}});
 await post(o,{type:'saveProgrammeAnswers',visitId:vid,version:vis(o).version,answers:{medication_access:'Available'},absence:{}});
 await post(o,{type:'confirmVisit',visitId:vid,version:vis(o).version});
 await fresh(c,s,w);
 const reason='The synthetic clinic card shows a different reading.',reference='Synthetic clinic card 14';
 const raise=(who,over={})=>({type:'raiseDispute',visitId:vid,recordVersion:vis(who).recordVersion,target:'fact:bloodPressure',reason,reference,...over});
 const resolve=(who,disputeId,over={})=>({type:'resolveDispute',visitId:vid,recordVersion:vis(who).recordVersion,disputeId,outcome:'stands',evidence:'Checked against the synthetic home reading card.',...over});
 // 1. Raising: a care-team member in scope; refusals for role, scope, target, text and version.
 await post(a,raise(o),403,undefined,org);await post(w,raise(o),403);
 for(const over of [{target:'answer:../x'},{target:'fact:pulse'},{reason:'short'},{reference:'ab'},{unexpected:true},{target:'fact:weeks'}])await post(s,raise(s,over),422);
 await post(s,raise(s,{recordVersion:vis(s).recordVersion+1}),409);
 const rk=crypto.randomUUID(),rb=raise(s),raised=await post(s,rb,200,rk),d1=raised.result.disputeId;
 check(()=>{const d=vis(s).disputes;assert.equal(d.length,1);assert.equal(d[0].id,d1);assert.equal(d[0].by,s.id);assert.equal(d[0].role,'supervisor');assert.equal(d[0].target,'fact:bloodPressure');assert.equal(d[0].valueText,'148/94');assert.ok(d[0].contentHash.length>=32);assert.equal(vis(s).facts.systolic,'148','the disputed value is unchanged');});
 check(()=>{assert.equal(rows('audit_events','raiseDispute',vid),1);assert.equal(rows('record_revisions','raiseDispute',vid),1);});
 await post(s,raise(s),409);
 // Replay rechecks authority under the current membership.
 sql.prepare("UPDATE memberships SET role='admin' WHERE org_id=? AND user_id=?").run(org,s.id);await post(s,rb,403,rk);
 sql.prepare("UPDATE memberships SET role='supervisor' WHERE org_id=? AND user_id=?").run(org,s.id);const replay=await post(s,rb,200,rk);check(()=>{assert.equal(replay.replayed,true);assert.equal(replay.result.disputeId,d1);assert.equal(vis(s).disputes.length,1);});
 // 2. An open dispute stops a programme plan from being prepared, with the reason shown.
 await fresh(o,c);
 const blocked=/Open dispute on Blood pressure: “The synthetic clinic card shows a different reading\.” \(reference Synthetic clinic card 14\), raised by .+ on \d{4}-\d\d-\d\d\. Community health MIS would receive this item, so nothing is prepared or sent there until a clinician resolves it\. Anything already sent is not recalled\./;
 let r=await post(o,{type:'preparePlan',visitId:vid,recipients:['mis_community']},409);check(()=>{assert.match(r.error,blocked);assert.equal(vis(o).plan,undefined);});
 // 3. An EHR publication that would carry the fact is stopped too (the connection is registered, not activated; nothing is sent).
 await post(o,{type:'registerIntegration',name:'Synthetic FHIR dispute test',kind:'ehr',endpoint:'https://ehr.example/fhir',credentialBinding:'SAHA_EHR_TEST',description:'Test-only adapter'});
 const ehr=o.state.integrations.find(x=>x.name==='Synthetic FHIR dispute test');
 await post(o,{type:'configureEhr',integrationId:ehr.id,version:ehr.version,read:true,write:true});
 const link=(await post(o,{type:'linkEhr',personId:pid,version:per(o).version,integrationId:ehr.id,externalId:'external-dispute',externalName:'Dispute Synthetic',confirmed:true,reason:'Verified from synthetic fixture'})).result.linkId;
 await post(o,{type:'setConsent',personId:pid,purpose:'exchange',active:true,version:per(o).version});
 const permissionId=(await post(o,{type:'grantEhrPermission',personId:pid,linkId:link,direction:'write',purpose:'care-coordination',from:'2026-09-01T00:00:00.000Z',to:new Date(Date.now()+600000).toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString()})).result.permissionId;
 const publish=()=>({type:'prepareEhrPublish',personId:pid,linkId:link,permissionId,visitId:vid});
 r=await post(o,publish(),409);check(()=>{assert.match(r.error,/Open dispute on Blood pressure/);assert.match(r.error,/Synthetic FHIR dispute test would receive this item/);assert.equal((per(o).ehr.operations??[]).length,0,'nothing was prepared');});
 // 4. Resolution: a clinician in scope who neither recorded the item nor raised the dispute; evidence is appended, the dispute stays.
 await post(s,resolve(s,d1),403);await post(w,resolve(o,d1),403);await post(a,resolve(o,d1),403,undefined,org);
 await post(o,resolve(o,d1),403);
 await fresh(c);await post(c,resolve(c,d1,{outcome:'corrected'}),409);await post(c,resolve(c,'no-such-dispute'),404);await post(c,resolve(c,d1,{evidence:'short'}),422);await post(c,resolve(c,d1,{recordVersion:vis(c).recordVersion+1}),409);
 const resolved=await post(c,resolve(c,d1),200);
 check(()=>{const v=vis(c),x=v.disputeResolutions;assert.equal(v.disputes.length,1,'the dispute is kept');assert.equal(x.length,1);assert.equal(x[0].disputeId,d1);assert.equal(x[0].outcome,'stands');assert.equal(x[0].by,c.id);assert.equal(x[0].evidence,'Checked against the synthetic home reading card.');assert.equal(resolved.result.resolutionId,x[0].id);});
 check(()=>{assert.equal(rows('audit_events','resolveDispute',vid),1);assert.equal(rows('record_revisions','resolveDispute',vid),1);});
 await post(c,resolve(c,d1),409);
 // 5. After resolution the plan can be prepared and approved. A programme answer disputed after approval stops the run.
 await fresh(o,s);
 await post(o,{type:'preparePlan',visitId:vid,recipients:['mis_community']});const plan=()=>vis(o).plan;
 await post(o,{type:'approvePlan',visitId:vid,planId:plan().id,payloadHash:plan().payloadHash});
 const exec=()=>({type:'executePlan',visitId:vid,planId:plan().id}),mine=()=>o.state.submissions.filter(x=>x.visitId===vid);
 await fresh(s);const d2=(await post(s,raise(s,{target:'answer:medication_access',reason:'The pharmacy log says stock was out that day.',reference:'Synthetic pharmacy log 7'}))).result.disputeId;
 await fresh(o);r=await post(o,exec(),409);await fresh(o);check(()=>{assert.match(r.error,/Open dispute on Programme answer medication_access/);assert.equal(mine().length,0,'nothing was queued or sent');});
 await fresh(c);await post(c,resolve(c,d2));
 // 6. Sign-off rules per programme and per destination: owner only, versioned, validated, audited.
 const rules=(over={})=>({type:'setSignOffRules',version:o.state.signOffPolicy.version,programmes:{'Chronic care':'required'},destinations:{},reason:'Synthetic pilot wants chronic care signed off.',...over});
 await post(c,rules(),403);await post(s,rules(),403);await post(w,rules(),403);await post(a,rules(),403,undefined,org);
 await post(o,rules({version:o.state.signOffPolicy.version+1}),409);await post(o,rules({programmes:{'Dental care':'required'}}),422);await post(o,rules({programmes:{},destinations:{[ehr.id]:'required',nope:'required'}}),422);
 await post(o,rules({programmes:{'Chronic care':'maybe'}}),422);await post(o,rules({reason:'short'}),422);await post(o,rules({programmes:{},destinations:{}}),409);
 const ruled=await post(o,rules());
 check(()=>{assert.equal(ruled.result.version,startVersion+1);assert.deepEqual(o.state.signOffPolicy,{required:false,version:startVersion+1,rules:{programmes:{'Chronic care':'required'},destinations:{}}});assert.equal(rows('audit_events','setSignOffRules',org),1);});
 await fresh(o);r=await post(o,exec(),409);check(()=>assert.match(r.error,/Supervisor sign-off is required before sending\..*It is required for Community health MIS by the sign-off rule for Chronic care\./));
 // 7. A supervisor signs off, then withdraws the sign-off before sending; the withdrawal blocks sending.
 await fresh(s);const sign=who=>({type:'signOffVisit',visitId:vid,recordVersion:vis(who).recordVersion}),signed=await post(s,sign(s));
 const withdraw=(who,over={})=>({type:'withdrawSignOff',visitId:vid,recordVersion:vis(who).recordVersion,reason:'The supervisor found the synthetic home reading doubtful.',...over});
 await fresh(c);await post(c,withdraw(c),403);await post(w,withdraw(o),403);await post(a,withdraw(o),403,undefined,org);
 await post(s,withdraw(s,{reason:'short'}),422);await post(s,withdraw(s,{recordVersion:vis(s).recordVersion+1}),409);
 const wk=crypto.randomUUID(),wb=withdraw(s),withdrawn=await post(s,wb,200,wk);
 check(()=>{const v=vis(s),x=v.signOffWithdrawals;assert.equal(v.signOffs.length,1,'the sign-off record is kept');assert.equal(x.length,1);assert.equal(x[0].signOffId,signed.result.signOffId);assert.equal(x[0].by,s.id);assert.match(x[0].reason,/doubtful/);assert.equal(withdrawn.result.withdrawalId,x[0].id);});
 check(()=>{assert.equal(rows('audit_events','withdrawSignOff',vid),1);assert.equal(rows('record_revisions','withdrawSignOff',vid),1);});
 await post(s,withdraw(s),409);
 sql.prepare("UPDATE memberships SET role='clinician' WHERE org_id=? AND user_id=?").run(org,s.id);await post(s,wb,403,wk);
 sql.prepare("UPDATE memberships SET role='supervisor' WHERE org_id=? AND user_id=?").run(org,s.id);const again=await post(s,wb,200,wk);check(()=>{assert.equal(again.replayed,true);assert.equal(vis(s).signOffWithdrawals.length,1);});
 const held=/Sending is blocked: .+ withdrew the supervisor sign-off on \d{4}-\d\d-\d\d \(“The supervisor found the synthetic home reading doubtful\.”\)\. A supervisor must sign the visit off again before it is sent\. Anything already sent is not recalled\./;
 await fresh(o);r=await post(o,exec(),409);check(()=>assert.match(r.error,held));
 // 8. A destination rule can relax the programme rule, but a withdrawal is a hold whatever the rules say.
 await post(o,rules({programmes:{'Chronic care':'inherit'},destinations:{mis_community:'not-required'},reason:'Synthetic: this destination is signed off elsewhere.'}));
 check(()=>assert.deepEqual(o.state.signOffPolicy.rules,{programmes:{},destinations:{mis_community:'not-required'}}));
 r=await post(o,exec(),409);check(()=>assert.match(r.error,held));
 // 9. Signing off again lifts the hold; the send records the sign-off it relied on.
 await fresh(s);const resigned=await post(s,sign(s));check(()=>{assert.equal(vis(s).signOffs.length,2);assert.notEqual(resigned.result.signOffId,signed.result.signOffId);});
 await fresh(o);await post(o,exec());
 check(()=>{assert.equal(mine().length,1);assert.equal(mine()[0].signOff.id,resigned.result.signOffId);});
 // 10. Nothing already sent is recalled: a dispute and a withdrawal after sending leave the submission as it was.
 const pick=x=>({id:x.id,state:x.state,attempts:x.attempts,receipt:x.receipt,payloadHash:x.payloadHash,updatedAt:x.updatedAt,signOffId:x.signOff?.id,block:x.block,refusal:x.refusal,message:x.message}),before=pick(mine()[0]);
 await fresh(s);const d3=(await post(s,raise(s,{target:'fact:weight',reason:'The scale at the synthetic clinic reads two kilograms high.',reference:'Synthetic scale check 3'}))).result.disputeId;
 await post(s,withdraw(s,{reason:'Withdrawn after sending, for the synthetic record.'}));
 await fresh(o);check(()=>{assert.equal(mine().length,1);assert.deepEqual(pick(mine()[0]),before);});
 await post(o,exec());await fresh(o);check(()=>{assert.equal(mine().length,1,'a completed plan is not sent again');assert.deepEqual(pick(mine()[0]),before);});
 // 11. Correcting the visit does not clear an open dispute: the correction draft carries it and must resolve it.
 await fresh(c);
 const amended=await post(c,{type:'amendVisit',visitId:vid,version:vis(c).recordVersion,reason:'Synthetic correction of the disputed weight'}),nvid=amended.result.visitId,nv=who=>who.state.visits.find(v=>v.id===nvid);
 check(()=>{const x=nv(c).disputes;assert.equal(x.length,1,'only the still-open dispute is carried');assert.equal(x[0].target,'fact:weight');assert.equal(x[0].carriedFrom,d3);assert.notEqual(x[0].id,d3);assert.equal(vis(c).disputes.length,3,'the original visit keeps all its disputes');assert.equal(rows('audit_events','carryDisputes',nvid),1);});
 await post(c,{type:'saveVisit',visitId:nvid,version:nv(c).version,facts:{...nv(c).facts,weight:'66'}});await post(c,{type:'confirmVisit',visitId:nvid,version:nv(c).version});
 r=await post(c,{type:'preparePlan',visitId:nvid,recipients:['mis_community']},409);check(()=>assert.match(r.error,/Open dispute on Weight/));
 const carried=nv(c).disputes[0].id,close=over=>({type:'resolveDispute',visitId:nvid,recordVersion:nv(c).recordVersion,disputeId:carried,outcome:'corrected',evidence:'The weight was re-measured on the synthetic scale.',...over});
 await post(c,close({outcome:'stands'}),409);await post(c,close());
 check(()=>{assert.equal(nv(c).disputeResolutions[0].outcome,'corrected');assert.equal(nv(c).disputes.length,1);});
 // The organisation is left as it was found: no default, no rules.
 await post(o,rules({programmes:{},destinations:{mis_community:'inherit'},reason:'Synthetic cleanup of the sign-off rules.'}));
 check(()=>{assert.equal(o.state.signOffPolicy.required,false);assert.deepEqual(o.state.signOffPolicy.rules,{programmes:{},destinations:{}});});
 await fresh(c);check(()=>assert.deepEqual(c.state.signOffPolicy.rules,{programmes:{},destinations:{}}));
}
