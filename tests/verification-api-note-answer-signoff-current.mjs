import assert from 'node:assert/strict';
// Slice 2g: authors of visit notes and programme answers from the server identity, clinician verification of them,
// the owner's sign-off policy and supervisor sign-off before sending, through the built Worker and local D1.
export async function noteAnswerSignOffSmoke({get,post,check,accounts,org,sql}){
 const {owner:o,worker:w,clinician:c,supervisor:s,admin:a}=accounts;for(const x of [o,c,s,w])await get(x,'/api/workspace',200,org);
 check(()=>{assert.equal(o.state.signOffPolicy.required,false);assert.equal(s.state.membership.role,'supervisor');assert.ok(s.state.membership.teamIds.includes('default'));});
 const pid=(await post(o,{type:'createPerson',name:`Sign-off Synthetic ${crypto.randomUUID().slice(0,6)}`,age:52,sex:'Male',village:'Sign-off synthetic locality',programme:'Chronic care',teamId:'default'})).result.personId;
 const per=who=>who.state.people.find(p=>p.id===pid);
 await post(o,{type:'enrolProgramme',personId:pid,version:per(o).version,packId:'hypertension',episodeLabel:'Synthetic sign-off episode',startDate:null});
 const vid=(await post(o,{type:'startVisit',personId:pid})).result.visitId,vis=who=>who.state.visits.find(v=>v.id===vid);
 // Authors come from the server identity; command-level author fields are dropped.
 await post(o,{type:'saveVisit',visitId:vid,version:vis(o).version,facts:{date:new Date(Date.now()-3600000).toISOString().slice(0,16),systolic:'134',diastolic:'86',weight:'71',temperature:'',weeks:'',coughDays:'',notes:'Synthetic notes for supervisor sign-off.',source:'measured'},noteAuthor:{userId:'someone-else'}});
 await post(o,{type:'saveProgrammeAnswers',visitId:vid,version:vis(o).version,answers:{medication_access:'Available'},absence:{},answerAuthors:{medication_access:{userId:'someone-else'}}});
 check(()=>{const v=vis(o);assert.equal(v.noteAuthor.userId,o.id);assert.equal(v.noteAuthor.role,'clinician');assert.equal(v.noteAuthor.accountCode,o.state.user.accountCode);assert.equal(v.answerAuthors.medication_access.userId,o.id);});
 const ver=(over={})=>({type:'verifyEntry',visitId:vid,recordVersion:vis(c).recordVersion,entry:'notes',decision:'verified',...over});
 await get(c,'/api/workspace',200,org);await post(c,ver(),409);
 await post(o,{type:'confirmVisit',visitId:vid,version:vis(o).version});for(const x of [c,s])await get(x,'/api/workspace',200,org);
 // Role, self, entry, reason and version refusals.
 await post(s,ver(),403);await post(w,ver(),403);await post(a,ver(),403,undefined,org);await post(o,{...ver(),recordVersion:vis(o).recordVersion},403);
 await post(c,ver({entry:'answer:testing'}),422);await post(c,ver({decision:'disputed'}),422);await post(c,ver({recordVersion:vis(c).recordVersion+1}),409);await post(c,ver({entry:'answer:../x'}),422);
 const key=crypto.randomUUID(),body=ver(),done=await post(c,body,200,key);
 await post(c,ver({entry:'answer:medication_access',decision:'disputed',reason:'Medicine stock was not checked at this synthetic visit.'}));
 check(()=>{const r=vis(c).entryReviews;assert.deepEqual(r.map(x=>[x.entry,x.state,x.by]),[['notes','verified',c.id],['answer:medication_access','disputed',c.id]]);assert.equal(done.result.state,'verified');assert.equal(vis(c).facts.notes,'Synthetic notes for supervisor sign-off.');});
 await post(c,ver(),409);
 check(()=>{assert.equal(sql.prepare("SELECT count(*) AS n FROM record_revisions WHERE org_id=? AND entity_id=? AND action='verifyEntry'").get(org,vid).n,2);assert.equal(sql.prepare("SELECT count(*) AS n FROM audit_events WHERE org_id=? AND subject=? AND action='verifyEntry' AND person_id=?").get(org,vid,pid).n,2);});
 sql.prepare("UPDATE memberships SET role='supervisor' WHERE org_id=? AND user_id=?").run(org,c.id);await post(c,body,403,key);
 sql.prepare("UPDATE memberships SET role='clinician' WHERE org_id=? AND user_id=?").run(org,c.id);const again=await post(c,body,200,key);check(()=>{assert.equal(again.replayed,true);assert.equal(again.result.reviewId,done.result.reviewId);});
 // Current B05 contract: retained disputed answer blocks the carrying destination before genuine resolution.
 await get(o,'/api/workspace',200,org);await post(o,{type:'preparePlan',visitId:vid,recipients:['mis_community']},409);
 const held=vis(o).disputes.find(d=>d.verification&&d.target==='answer:medication_access');
 check(()=>{assert.ok(held);assert.equal(held.by,c.id);assert.equal(vis(o).entryReviews.at(-1).state,'disputed');});
 for(const self of [o,c]){await get(self,'/api/workspace',200,org);await post(self,{type:'resolveDispute',visitId:vid,recordVersion:vis(self).recordVersion,disputeId:held.id,outcome:'stands',evidence:'Synthetic self-resolution must remain refused'},403);}
 // Current B05 contract: the original later sign-off assertions run after supported independent resolution.
 const rid='verification-smoke-'+crypto.randomUUID(),independent={id:rid,headers:{'oai-authenticated-user-id':rid,'oai-authenticated-user-email':'verification-independent@example.invalid'},state:null};await get(independent);const inv=(await post(o,{type:'createInvite',accountCode:independent.state.user.accountCode,label:'Synthetic independent dispute resolver',role:'clinician',teamIds:['default']})).result;await post(independent,{type:'joinOrganisation',token:inv.token},200,undefined,org);await get(independent,'/api/workspace',200,org);
 for(const d of independent.state.visits.find(v=>v.id===vid).disputes??[]){if(!d.verification)continue;await post(independent,{type:'resolveDispute',visitId:vid,recordVersion:independent.state.visits.find(v=>v.id===vid).recordVersion,disputeId:d.id,outcome:'stands',evidence:'Synthetic independent current-content attestation before sign-off regression'},200,undefined,org);}await get(o,'/api/workspace',200,org);await get(c,'/api/workspace',200,org);
 check(()=>{const v=vis(o),resolution=v.disputeResolutions.find(x=>x.disputeId===held.id);assert.ok(resolution);assert.equal(resolution.by,independent.id);assert.equal(v.entryReviews.at(-1).state,'disputed');assert.equal(v.disputes.find(x=>x.id===held.id).id,held.id);assert.equal(resolution.currentContentHash,held.contentHash);});
 // The owner's policy; non-owners refused; versioned.
 const policy=(required,version)=>({type:'setSignOffPolicy',required,version,reason:'Synthetic pilot asks for supervisor review.'});
 await post(c,policy(true,0),403);await post(s,policy(true,0),403);await post(o,policy(true,0));await post(o,policy(true,1),409);await post(o,policy(false,0),409);
 check(()=>{assert.deepEqual(o.state.signOffPolicy,{required:true,version:1});});
 // With the policy on, executing an approved plan is refused until a supervisor signs off.
 await post(o,{type:'preparePlan',visitId:vid,recipients:['mis_community']});await post(o,{type:'approvePlan',visitId:vid,planId:vis(o).plan.id,payloadHash:vis(o).plan.payloadHash});
 const exec=()=>({type:'executePlan',visitId:vid,planId:vis(o).plan.id});await post(o,exec(),409);check(()=>assert.equal(o.state.submissions.filter(x=>x.visitId===vid).length,0));
 await get(s,'/api/workspace',200,org);const sign=(over={})=>({type:'signOffVisit',visitId:vid,recordVersion:vis(s).recordVersion,...over});
 await post(c,sign(),403);await post(w,sign(),403);await post(a,sign(),403,undefined,org);await post(o,{...sign(),recordVersion:vis(o).recordVersion},403);await post(s,sign({recordVersion:vis(s).recordVersion+1}),409);
 const sk=crypto.randomUUID(),sb=sign({note:'Reviewed with the synthetic worker.'}),signed=await post(s,sb,200,sk);
 check(()=>{const x=vis(s).signOffs;assert.equal(x.length,1);assert.equal(x[0].by,s.id);assert.equal(x[0].role,'supervisor');assert.equal(x[0].visitVersion,vis(s).version);assert.equal(signed.result.signOffId,x[0].id);});
 await post(s,sign(),409);
 check(()=>{assert.equal(sql.prepare("SELECT count(*) AS n FROM audit_events WHERE org_id=? AND subject=? AND action='signOffVisit' AND person_id=?").get(org,vid,pid).n,1);assert.equal(sql.prepare("SELECT count(*) AS n FROM record_revisions WHERE org_id=? AND entity_id=? AND action='signOffVisit'").get(org,vid).n,1);});
 // Replay rechecks supervision under the current membership.
 sql.prepare("UPDATE memberships SET role='clinician' WHERE org_id=? AND user_id=?").run(org,s.id);await post(s,sb,403,sk);
 sql.prepare("UPDATE memberships SET role='supervisor' WHERE org_id=? AND user_id=?").run(org,s.id);const replay=await post(s,sb,200,sk);check(()=>assert.equal(replay.replayed,true));
 await get(o,'/api/workspace',200,org);await post(o,exec());
 check(()=>{const subs=o.state.submissions.filter(x=>x.visitId===vid);assert.equal(subs.length,1);assert.equal(subs[0].signOff.by,s.id);assert.equal(subs[0].signOff.id,signed.result.signOffId);});
 // A correction draft copies the authors of unchanged entries, never the sign-off; the old visit can no longer be signed off.
 await get(c,'/api/workspace',200,org);const amended=await post(c,{type:'amendVisit',visitId:vid,version:vis(c).recordVersion,reason:'Synthetic correction after sign-off'}),nv=who=>who.state.visits.find(v=>v.id===amended.result.visitId);
 check(()=>{assert.equal(nv(c).noteAuthor.userId,o.id);assert.equal(nv(c).answerAuthors.medication_access.userId,o.id);assert.equal(nv(c).signOffs,undefined);assert.equal(nv(c).entryReviews,undefined);});
 await post(c,{type:'saveVisit',visitId:nv(c).id,version:nv(c).version,facts:{...nv(c).facts,notes:'Corrected synthetic notes.'}});
 check(()=>{assert.equal(nv(c).noteAuthor.userId,c.id);assert.equal(nv(c).answerAuthors.medication_access.userId,o.id);});
 await get(s,'/api/workspace',200,org);await post(s,sign(),409);
 await post(o,policy(false,1));check(()=>assert.equal(o.state.signOffPolicy.required,false));
}
