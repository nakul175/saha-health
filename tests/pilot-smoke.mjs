import assert from 'node:assert/strict';
export async function pilotSmoke({get,post,check,accounts,org,sql}){
 const {owner:o,supervisor:s,admin:a,worker:w,clinician:c,stranger:x}=accounts;
 await get(o,'/api/workspace',200,org);let admin=o.state.members.find(m=>m.userId===a.id);
 await post(o,{type:'updateMember',userId:a.id,version:admin.version,role:'admin',teamIds:[],isOwner:false,status:'active',reason:'Restore synthetic pilot security reviewer'});
 await get(null,'/api/pilot',401,org);await get(x,'/api/pilot',403,org);await get(w,'/api/pilot?format=export',403,org);await get(o,'/api/pilot?format=unknown',422,org);
 let report=await get(o,'/api/pilot',200,org);check(()=>{assert.equal(report.pilot.version,0);assert.equal(report.readiness.liveReady,false);assert.equal(report.canConfigure,true)});
 const today=new Date().toISOString().slice(0,10),modules=['privacy','matching','capture','continuity','model-limits','escalation','submission-status'];const cfg={name:'Synthetic bounded pilot',location:'Synthetic test clinic',teamIds:['default'],participantIds:[w.id],packIds:['maternal'],connectionIds:[],reviewers:{programme:s.id,clinical:c.id,security:a.id,deployment:o.id},start:today,end:today,recordLimit:100,stopRule:'Pause for identity mismatch or unresolved destination receipt; contact the owner.'};
 const made=await post(o,{type:'createPerson',name:'Pilot synthetic cohort',age:28,sex:'Female',village:'Synthetic site',programme:'Maternal care',teamId:'default'});const patient=o.state.people.find(p=>p.id===made.result.personId);await post(o,{type:'enrolProgramme',personId:patient.id,version:patient.version,packId:'maternal',episodeLabel:'Synthetic rehearsal episode',startDate:null});
 let version=0;
 const cmd=async(who,input,status=200,key)=>{const out=await post(who,{...input,version},status,key);if(status===200&&!out.replayed)version++;return out;};
 await cmd(a,{type:'pilotConfigure',configuration:cfg},403);
 await cmd(o,{type:'pilotConfigure',configuration:{...cfg,reviewers:{...cfg.reviewers,security:o.id}}},422);
 await cmd(o,{type:'pilotConfigure',configuration:{...cfg,end:'2026-02-30'}},422);
 await cmd(o,{type:'pilotConfigure',configuration:{...cfg,teamIds:['foreign-team']}},422);
 await cmd(o,{type:'pilotConfigure',configuration:{...cfg,connectionIds:['missing']}},422);
 await cmd(o,{type:'pilotConfigure',configuration:cfg});
 await post(o,{type:'pilotConfigure',version:0,configuration:cfg},409);
 await cmd(o,{type:'pilotTransition',stage:'live',reason:'Attempt to bypass live rollout gate'},409);
 await cmd(o,{type:'pilotReviewActivation',userId:w.id,decision:'eligible',reference:'SYNTHETIC-INCOMPLETE',note:'Incomplete competency must keep live activation restricted.'},409);
 await cmd(o,{type:'pilotReviewActivation',userId:w.id,decision:'restricted',reference:'SYNTHETIC-RESTRICTED',note:'Owner retains a restriction while required competencies are incomplete.'});
 await cmd(o,{type:'pilotTransition',stage:'rehearsal',reason:'Try starting before required evidence'},409);
 await cmd(o,{type:'pilotDecision',role:'clinical',decision:'accept',reference:'FAKE-1',note:'Owner cannot sign on behalf of clinician'},403);
 await cmd(c,{type:'pilotDecision',role:'clinical',decision:'accept',reference:'SYNTHETIC-1',note:'Incomplete training must prevent acceptance'},409);
 await cmd(a,{type:'pilotMeasure',kind:'baseline',days:7},403);
 await cmd(s,{type:'pilotMeasure',kind:'baseline',days:7});
 await cmd(s,{type:'pilotMeasure',kind:'outcome',days:7},409);
 const self={type:'pilotAssessTraining',userId:o.id,module:'privacy',result:'passed',reference:'SYNTHETIC-SELF',note:'Self assessment should be rejected'};await cmd(o,self,422);
 let latestPrivacy;
 for(const module of modules){
  const result=await cmd(o,{type:'pilotAssessTraining',userId:w.id,module,result:'passed',reference:'SYNTHETIC-'+module,note:'Synthetic test harness assessed the exercise.'});const id=result.result.trainingId;if(module==='privacy')latestPrivacy=id;
  await cmd(o,{type:'pilotAcknowledgeTraining',id},403);
  await cmd(w,{type:'pilotAcknowledgeTraining',id});
 }
 await cmd(o,{type:'pilotReviewActivation',userId:w.id,decision:'eligible',reference:'SYNTHETIC-COMPETENT',note:'All role-specific competency exercises are passed and acknowledged.'});
 const own=await get(w,'/api/pilot',200,org);check(()=>{assert.equal(own.canManage,false);assert.equal(own.members.length,0);assert.equal(own.pilot.configuration,null);assert.ok(own.pilot.training.every(t=>t.userId===w.id));assert.ok(own.readiness.matrix.every(t=>t.ready))});
 const adminView=await get(a,'/api/pilot',200,org);check(()=>{assert.equal(adminView.pilot.measurements.length,0);assert.equal(adminView.readiness.baseline,null);assert.ok(!JSON.stringify(adminView).includes('metrics'));assert.equal(adminView.canManage,true)});
 await cmd(w,{type:'pilotAcknowledgeTraining',id:latestPrivacy},409);
 const accept=async()=>{for(const [who,role] of [[s,'programme'],[c,'clinical'],[a,'security'],[o,'deployment']])await cmd(who,{type:'pilotDecision',role,decision:'accept',reference:'SYNTHETIC-REVIEW-'+role,note:'Synthetic acceptance by the named reviewer account.'});};
 await accept();report=await get(o,'/api/pilot',200,org);check(()=>{assert.equal(report.readiness.canStart,true,report.readiness.blockers.join(' '));assert.equal(report.readiness.liveReady,false);assert.equal(report.readiness.liveCompetencyReady,true);assert.equal(report.readiness.activationMatrix[0].status,'eligible');assert.ok(report.readiness.baseline.metrics.patients>0)});
 // A new baseline invalidates approvals while retaining decision history.
 await cmd(s,{type:'pilotMeasure',kind:'baseline',days:7});report=await get(o,'/api/pilot',200,org);check(()=>{assert.equal(report.readiness.canStart,false);assert.equal(report.pilot.decisions.length,4);assert.ok(report.readiness.reviews.every(x=>x.decision===null))});
 await accept();
 // Evidence references require new dossier acceptance; never clear live gates.
 await cmd(c,{type:'pilotEvidence',gate:'clinical',reference:'SYNTHETIC-REVIEW-NOTE',note:'This is synthetic test evidence, not a clinical approval.'});await cmd(w,{type:'pilotEvidence',gate:'clinical',reference:'NO-ACCESS',note:'A care worker cannot edit the evidence register.'},403);
 report=await get(o,'/api/pilot',200,org);check(()=>{assert.equal(report.readiness.canStart,false);assert.equal(report.readiness.gates.length,8);assert.ok(report.readiness.gates.every(g=>g.state!=='accepted'))});await accept();
 // High incident blocks startup independently of saved sign-offs.
 let ops=(await get(o,'/api/operations',200,org)).operations;
 const incident=await post(o,{type:'opsIncident',version:ops.version,title:'Synthetic pilot blocking defect',severity:'high',ownerId:o.id});
 await cmd(o,{type:'pilotTransition',stage:'rehearsal',reason:'Unresolved incident must block startup'},409);
 await post(o,{type:'opsUpdateIncident',version:ops.version+1,id:incident.result.incidentId,state:'resolved',ownerId:o.id,resolution:'Synthetic defect corrected and independently retested',evidence:'SYNTHETIC-FIX-1'});
 const startVersion=version,key=crypto.randomUUID(),startInput={type:'pilotTransition',stage:'rehearsal',reason:'Begin the approved synthetic workflow rehearsal.'};await cmd(o,startInput,200,key);
 const replay=await post(o,{...startInput,version:startVersion},200,key);check(()=>assert.equal(replay.replayed,true));
 await cmd(o,{type:'pilotConfigure',configuration:cfg},409);await cmd(o,{type:'pilotTransition',stage:'completed',reason:'Completion needs a recorded outcome first.'},409);
 // Changed membership invalidates the active rehearsal dynamically.
 await get(o,'/api/workspace',200,org);const worker=o.state.members.find(m=>m.userId===w.id);await post(o,{type:'updateMember',userId:w.id,version:worker.version,role:'asha',teamIds:worker.teamIds,isOwner:false,status:'suspended',reason:'Synthetic access revocation during rehearsal'});
 report=await get(o,'/api/pilot',200,org);check(()=>{assert.equal(report.readiness.effectiveStage,'paused');assert.equal(report.readiness.runStale,true)});await get(w,'/api/pilot',403,org);await cmd(o,{type:'pilotMeasure',kind:'outcome',days:7},409);
 await cmd(o,{type:'pilotTransition',stage:'paused',reason:'Participant access changed; halt the rehearsal.'});
 await get(o,'/api/workspace',200,org);const suspended=o.state.members.find(m=>m.userId===w.id);await post(o,{type:'updateMember',userId:w.id,version:suspended.version,role:'asha',teamIds:suspended.teamIds,isOwner:false,status:'active',reason:'Restore synthetic participant after permission review'});
 report=await get(o,'/api/pilot',200,org);check(()=>assert.ok(report.readiness.matrix.every(t=>!t.ready)));
 for(const module of modules){const assessment=await cmd(o,{type:'pilotAssessTraining',userId:w.id,module,result:'passed',reference:'SYNTHETIC-RETEST',note:'Repeated exercise after the membership scope changed.'});await cmd(w,{type:'pilotAcknowledgeTraining',id:assessment.result.trainingId});}await cmd(o,{type:'pilotReviewActivation',userId:w.id,decision:'eligible',reference:'SYNTHETIC-REVIEW-RETEST',note:'Current role-specific competency was reviewed after the membership change.'});
 await cmd(s,{type:'pilotMeasure',kind:'baseline',days:7});await accept();await cmd(o,startInput);await cmd(s,{type:'pilotMeasure',kind:'outcome',days:7});
 await cmd(o,{type:'pilotTransition',stage:'completed',reason:'Synthetic exercise and measured outcome reviewed.'});
 await cmd(o,{type:'pilotEvidence',gate:'security',reference:'LATE-EDIT',note:'Completed cycle should remain immutable.'},409);
 const exported=await get(o,'/api/pilot?format=export',200,org);check(()=>{assert.equal(exported.pilot.stage,'completed');assert.equal(exported.readiness.liveReady,false);assert.ok(exported.notice.includes('Synthetic'));assert.ok(exported.pilot.measurements.some(x=>x.kind==='outcome'));assert.ok(!JSON.stringify(exported).includes('Meena'));assert.ok(!JSON.stringify(exported).includes('credentialBinding'))});
 const adminExport=await get(a,'/api/pilot?format=export',200,org);check(()=>{assert.equal(adminExport.pilot.measurements.length,0);assert.equal(adminExport.readiness.baseline,null)});
 check(()=>{assert.ok(sql.prepare('SELECT count(*) AS n FROM audit_events WHERE org_id=? AND action=?').get(org,'pilotExport').n>=2);const persisted=JSON.parse(sql.prepare('SELECT data FROM pilot WHERE org_id=?').get(org).data);assert.equal(persisted.stage,'completed');assert.equal(persisted.version,version)});
 // A new scope revision retains historical training but requires fresh work.
 await cmd(o,{type:'pilotConfigure',configuration:{...cfg,name:'Synthetic second cycle'}});report=await get(o,'/api/pilot',200,org);check(()=>{assert.equal(report.pilot.configRevision,2);assert.equal(report.pilot.stage,'planning');assert.equal(report.pilot.measurements.length,0);assert.ok(report.pilot.training.length>=14);assert.ok(report.readiness.matrix.every(t=>!t.ready));assert.ok(report.readiness.activationMatrix.every(t=>t.status==='training-incomplete'));assert.equal(report.readiness.baseline,null)});
}
