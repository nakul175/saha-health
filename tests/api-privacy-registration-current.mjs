// Current reporting composition: unchanged original API groups and one explicitly named CSV metadata adapter.
import assert from 'node:assert/strict';
const base=process.env.SAHA_TEST_ORIGIN??'http://127.0.0.1:8787';
const id=process.env.SAHA_TEST_RUN??crypto.randomUUID();
let total=0;
const accounts=Object.fromEntries(['owner','worker','clinician','supervisor','admin','stranger'].map(label=>[label,{id:`r1-${id}-${label}`,headers:{'oai-authenticated-user-id':`r1-${id}-${label}`,'oai-authenticated-user-email':`${label}@example.invalid`,'oai-authenticated-user-full-name':'Same%20test%20name','oai-authenticated-user-full-name-encoding':'percent-encoded-utf-8'},state:null}]));
async function get(who,path='/api/workspace',status=200,org){const r=await fetch(base+path,{headers:{...(who?.headers??{}),...(org?{'x-saha-organisation':org}:{})}});const j=await r.json();assert.equal(r.status,status,JSON.stringify({path,expected:status,actual:r.status,j}));total++;if(path==='/api/workspace'&&r.ok)who.state=j;return j;}
// Regression fixtures represent an explicit UI patient check. Negative cases pass null or a wrong/stale check.
async function post(who,body,status=200,key=crypto.randomUUID(),org=who.state?.organisation.id,extras={}){if(body.type==='confirmVisit'&&!Object.hasOwn(body,'patientCheck')){const v=who.state?.visits.find(v=>v.id===body.visitId),p=who.state?.people.find(p=>p.id===v?.personId);body={...body,patientCheck:{personId:p?.id??'missing',personVersion:p?.version??1,confirmed:true}};}const r=await fetch(base+'/api/commands',{method:'POST',headers:{...who.headers,'Content-Type':'application/json','Idempotency-Key':key,...(org?{'x-saha-organisation':org}:{}),...extras},body:JSON.stringify(body)});const j=await r.json();assert.equal(r.status,status,JSON.stringify({body,expected:status,actual:r.status,j}));total++;if(r.ok)who.state=j.snapshot;return j;}
const check=(fn)=>{fn();total++};
const legacy=globalThis.sahaLegacyFixture;
const legacyUser={headers:{'oai-authenticated-user-id':legacy.actor,'oai-authenticated-user-email':'legacy@example.invalid'},state:null};
await get(legacyUser);const legacyOrg=legacyUser.state.organisation.id;
check(()=>{const v=legacyUser.state.visits[0];assert.deepEqual(v.facts,legacy.visit.facts);assert.equal(v.plan.state,'blocked');assert.equal(v.aiResults[0].text,'Synthetic legacy output');assert.equal(legacyUser.state.submissions[0].receipt,'SIM-LEGACY');assert.ok(legacyUser.state.audit.some(a=>a.id==='legacy-audit'));});
await get(legacyUser);const {verifyMigration,sql}=await import('./database-fixtures.mjs');total+=verifyMigration(legacy,legacyOrg);
const {fixture}=await import('./database-fixtures.mjs');const broken=fixture(),brokenState=JSON.parse(broken.source);brokenState.visits.push({...brokenState.visits[0]});sql.prepare('UPDATE workspaces SET state=? WHERE owner_id=?').run(JSON.stringify(brokenState),broken.actor);
const brokenUser={headers:{'oai-authenticated-user-id':broken.actor,'oai-authenticated-user-email':'broken@example.invalid'},state:null};await get(brokenUser,'/api/workspace',503);check(()=>{assert.equal(sql.prepare('SELECT count(*) AS n FROM memberships WHERE user_id=?').get(broken.actor).n,0);assert.equal(sql.prepare('SELECT count(*) AS n FROM legacy_migrations WHERE owner_id=?').get(broken.actor).n,0)});
sql.prepare('UPDATE workspaces SET state=? WHERE owner_id=?').run(broken.source,broken.actor);await get(brokenUser);total+=verifyMigration(broken,brokenUser.state.organisation.id);
await get(null,'/api/workspace',401);
for(const a of Object.values(accounts))await get(a);
const {owner:o,worker:w,clinician:c,supervisor:s,admin:a,stranger:x}=accounts,org=o.state.organisation.id;
check(()=>{assert.equal(o.state.people.length,6);assert.equal(o.state.membership.isOwner,true);assert.equal(o.state.role,'clinician');assert.equal(o.state.schemaVersion,1)});
await post(o,{type:'setRole',role:'admin'},422);
const concurrentKey=crypto.randomUUID(),concurrentBody={type:'createPerson',name:'Concurrent synthetic person',age:30,sex:'Unknown',village:'Rampur',programme:'General care',teamId:'default'};
const duplicatePair=await Promise.all([post(o,concurrentBody,200,concurrentKey),post(o,concurrentBody,200,concurrentKey)]);check(()=>{assert.equal(duplicatePair[0].result.personId,duplicatePair[1].result.personId);assert.equal(o.state.people.filter(p=>p.name==='Concurrent synthetic person').length,1)});

await get(x,'/api/workspace',403,org);
await post(x,{type:'startVisit',personId:'p_meena'},403,crypto.randomUUID(),org);
await post(o,{type:'createTeam',name:'North team'},200);const north=o.state.teams.find(t=>t.name==='North team').id;
await post(o,{type:'createTeam',name:'North team'},409);
async function invite(target,role,teamIds=['default']){const r=await post(o,{type:'createInvite',accountCode:target.state.user.accountCode,label:role,role,teamIds});return r.result;}
const iw=await invite(w,'asha');
await post(x,{type:'joinOrganisation',token:iw.token},403);
const joinKey=crypto.randomUUID();await post(w,{type:'joinOrganisation',token:iw.token},200,joinKey);
const joinReplay=await post(w,{type:'joinOrganisation',token:iw.token},200,joinKey);check(()=>assert.equal(joinReplay.replayed,true));
await post(w,{type:'joinOrganisation',token:iw.token},403);
for(const [target,role,teams] of [[c,'clinician',['default']],[s,'supervisor',['default']],[a,'admin',[]]]){const i=await invite(target,role,teams);await post(target,{type:'joinOrganisation',token:i.token});}
check(()=>{assert.equal(w.state.people.length,0);assert.equal(a.state.people.length,0);assert.equal(a.state.visits.length,0);assert.equal(a.state.canManage,false);});
await post(w,{type:'createTeam',name:'Unauthorized team'},403);
await post(a,{type:'createInvite',accountCode:x.state.user.accountCode,label:'Unauthorized',role:'clinician',teamIds:['default']},403);
await get(a,'/api/history?personId=p_meena',403,org);
await post(a,{type:'startVisit',personId:'p_meena'},403);
await get(o);const m=o.state.members.find(m=>m.userId===o.id);
await post(o,{type:'updateMember',userId:o.id,version:m.version,role:'clinician',teamIds:['default'],isOwner:false,status:'active',reason:'Test last owner protection'},409);
await post(o,{type:'updateMember',userId:o.id,version:m.version,role:'clinician',teamIds:['default',north],isOwner:true,status:'active',reason:'Cover both care teams'});
let p=o.state.people.find(p=>p.id==='p_kamla');await post(o,{type:'assignPatient',personId:p.id,version:p.version,teamId:north,assignedTo:o.id,reason:'North team patient assignment'});
await get(c,'/api/workspace',200,org);check(()=>{assert.equal(c.state.people.length,6);assert.ok(!c.state.people.some(p=>p.id==='p_kamla'))});
await post(c,{type:'startVisit',personId:'p_kamla'},403);
await get(c,'/api/history?personId=p_kamla',403,org);
await get(s,'/api/workspace',200,org);await post(s,{type:'startVisit',personId:'p_meena'},403);
p=s.state.people.find(p=>p.id==='p_meena');await post(s,{type:'assignPatient',personId:p.id,version:p.version,teamId:'default',assignedTo:w.id,reason:'Assign scheduled home visit'});
await get(w,'/api/workspace',200,org);check(()=>{assert.equal(w.state.people.length,1);assert.equal(w.state.people[0].id,'p_meena')});
await post(w,{type:'startVisit',personId:'p_rajesh'},403);
const started=await post(w,{type:'startVisit',personId:'p_meena'}),visitId=started.result.visitId;
await post(w,{type:'confirmVisit',visitId,version:1},422);
const facts={date:new Date(Date.now()-60000).toISOString().slice(0,16),systolic:'118',diastolic:'76',weight:'57.5',temperature:'',weeks:'24',coughDays:'',notes:'Synthetic collaborative test visit.',source:'measured'};
const key=crypto.randomUUID();await post(w,{type:'saveVisit',visitId,version:1,facts},200,key);
const replay=await post(w,{type:'saveVisit',visitId,version:1,facts},200,key);check(()=>assert.equal(replay.replayed,true));
await post(w,{type:'saveVisit',visitId,version:1,facts:{...facts,weight:'99'}},409,key);
await post(w,{type:'saveVisit',visitId,version:1,facts},409);
const simultaneous=await Promise.all([fetch(base+'/api/commands',{method:'POST',headers:{...w.headers,'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID(),'x-saha-organisation':org},body:JSON.stringify({type:'saveVisit',visitId,version:2,facts:{...facts,notes:'Worker won'}})}),fetch(base+'/api/commands',{method:'POST',headers:{...c.headers,'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID(),'x-saha-organisation':org},body:JSON.stringify({type:'saveVisit',visitId,version:2,facts:{...facts,notes:'Clinician won'}})})]);
check(()=>assert.deepEqual(simultaneous.map(r=>r.status).sort(),[200,409]));
const writes=await Promise.all(simultaneous.map(r=>r.json()));await get(w,'/api/workspace',200,org);check(()=>{assert.equal(w.state.visits[0].version,3);assert.equal(w.state.visits[0].facts.notes,writes.find(r=>r.snapshot).snapshot.visits[0].facts.notes)});
await post(w,{type:'confirmVisit',visitId,version:3});await post(w,{type:'saveVisit',visitId,version:4,facts},409);
let prepared=await post(w,{type:'preparePlan',visitId,recipients:['mis_maternal','mis_community']}),plan=prepared.snapshot.visits.find(v=>v.id===visitId).plan;
await post(w,{type:'approvePlan',visitId,planId:plan.id,payloadHash:plan.payloadHash});
await post(c,{type:'executePlan',visitId,planId:plan.id},409);
const sent=await post(w,{type:'executePlan',visitId,planId:plan.id});check(()=>assert.deepEqual(sent.snapshot.submissions.map(s=>s.state).sort(),['accepted','uncertain']));
await post(w,{type:'executePlan',visitId,planId:plan.id});check(()=>assert.equal(w.state.submissions.length,2));
const uncertain=w.state.submissions.find(s=>s.state==='uncertain');await post(w,{type:'reconcile',submissionId:uncertain.id});check(()=>assert.equal(w.state.submissions.find(s=>s.id===uncertain.id).attempts,1));
await post(w,{type:'preparePlan',visitId,recipients:['mis_community']},409);
p=w.state.people[0];await post(w,{type:'setConsent',personId:p.id,purpose:'ai',active:false,version:p.version});
await post(w,{type:'runAI',visitId,providerId:'ai_summary',version:4,consentVersion:w.state.people[0].consentVersion,approved:true},409);
p=w.state.people[0];await post(w,{type:'setConsent',personId:p.id,purpose:'ai',active:true,version:p.version});
const ai=await post(w,{type:'runAI',visitId,providerId:'ai_summary',version:4,consentVersion:w.state.people[0].consentVersion,approved:true});await post(w,{type:'reviewAI',visitId,resultId:ai.result.resultId});
const fhir=await get(w,`/api/fhir/${visitId}?organisationId=${org}`);check(()=>assert.equal(fhir.resourceType,'Bundle'));
await get(a,`/api/fhir/${visitId}?organisationId=${org}`,403);await get(x,`/api/fhir/${visitId}?organisationId=${org}`,403);
let hist=await get(w,'/api/history?personId=p_meena',200,org);check(()=>{assert.ok(hist.revisions.some(r=>r.actorId===w.id));assert.ok(hist.revisions.some(r=>r.data.facts?.notes==='Synthetic collaborative test visit.'));assert.ok(hist.revisions.every(r=>r.personId==='p_meena'))});
p=w.state.people[0];const corrected={type:'correctIdentity',personId:p.id,version:p.version,name:'Meena Devi Corrected',age:27,sex:'Female',village:'Rampur',reason:'Correct name and age against synthetic source'};await post(w,corrected);await post(w,{...corrected,name:'Stale overwrite'},409);
hist=await get(w,'/api/history?personId=p_meena',200,org);check(()=>{assert.ok(hist.revisions.some(r=>r.data.name==='Meena Devi'));assert.ok(hist.revisions.some(r=>r.action==='correctIdentity'&&r.changes.some(c=>c.field==='name'&&c.before==='Meena Devi'&&c.after==='Meena Devi Corrected')))});
const original=structuredClone(w.state.visits.find(v=>v.id===visitId));const amendment=await post(w,{type:'amendVisit',visitId,version:original.recordVersion,reason:'Correct a transcription error in the visit'});const amendedId=amendment.result.visitId;
check(()=>{const old=w.state.visits.find(v=>v.id===visitId),am=w.state.visits.find(v=>v.id===amendedId);assert.deepEqual(old.facts,original.facts);assert.equal(old.supersededBy,amendedId);assert.equal(am.amendsVisitId,visitId);assert.equal(am.aiResults.length,0);assert.equal(w.state.submissions.length,2)});
await post(w,{type:'runAI',visitId,providerId:'ai_summary',version:4,consentVersion:w.state.people[0].consentVersion,approved:true},409);await get(w,`/api/fhir/${visitId}?organisationId=${org}`,409);
let am=w.state.visits.find(v=>v.id===amendedId);await post(w,{type:'voidVisit',visitId:amendedId,version:am.recordVersion,reason:'Test visit entered for the wrong synthetic person'});
await post(w,{type:'saveVisit',visitId:amendedId,version:1,facts},409);await post(w,{type:'confirmVisit',visitId:amendedId,version:1},409);await get(w,`/api/fhir/${amendedId}?organisationId=${org}`,409);
await get(o,'/api/workspace',200,org);let worker=o.state.members.find(m=>m.userId===w.id);await post(o,{type:'updateMember',userId:w.id,version:worker.version,role:'asha',teamIds:['default'],isOwner:false,status:'suspended',reason:'Access suspension test'});
await get(w,'/api/workspace',403,org);const recovered=await get(w);check(()=>assert.notEqual(recovered.organisation.id,org));w.state={...w.state,organisation:{...w.state.organisation,id:org}};await post(w,{type:'startVisit',personId:'p_meena'},403);await post(w,{type:'saveVisit',visitId,version:1,facts},403,key);
worker=o.state.members.find(m=>m.userId===w.id);await post(o,{type:'updateMember',userId:w.id,version:worker.version,role:'asha',teamIds:['default'],isOwner:false,status:'active',reason:'Reactivate synthetic test worker'});
p=o.state.people.find(p=>p.id==='p_meena');await post(o,{type:'assignPatient',personId:p.id,version:p.version,teamId:'default',assignedTo:c.id,reason:'Transfer patient responsibility'});await get(w,'/api/workspace',200,org);check(()=>{assert.equal(w.state.people.length,0);assert.equal(w.state.visits.length,0);assert.equal(w.state.submissions.length,0);assert.equal(w.state.audit.length,0)});await post(w,{type:'saveVisit',visitId,version:1,facts},403,key);await get(w,'/api/history?personId=p_meena',403,org);
const ix=await invite(x,'asha');await post(o,{type:'revokeInvite',inviteId:ix.invitationId});await post(x,{type:'joinOrganisation',token:ix.token},403);
const expired=await invite(x,'asha');sql.prepare('UPDATE invitations SET expires_at=? WHERE id=?').run('2020-01-01T00:00:00.000Z',expired.invitationId);await post(x,{type:'joinOrganisation',token:expired.token},403);
await post(o,{type:'createTeam',name:'CSRF test'},403,crypto.randomUUID(),org,{Origin:'https://evil.example'});
// The activation below advances the synthetic connector to release 3. Seed the complete exact-release provider inventory required by the current fail-closed gate without changing the product gate or using a real provider.
const assuranceRow=sql.prepare('SELECT data FROM operations WHERE org_id=?').get(org),assuranceOperations=assuranceRow?JSON.parse(assuranceRow.data):{version:0,maintenance:false,reason:'',updatedAt:'',incidents:[],rates:null},assuranceAt=new Date().toISOString();
assuranceOperations.supplyChain=[...(assuranceOperations.supplyChain??[]),{id:`privacy-registration-mis-maternal-${id}`,kind:'provider',name:'Synthetic maternal register assurance',release:'3',ownerId:o.id,controls:['Signed synthetic provider release'],subprocessors:[{name:'None disclosed',purpose:'Explicit synthetic provider declaration',jurisdiction:'Not applicable'}],incidentContact:'SECURITY-CASE-QUEUE',updateObligation:'Notify the accountable owner before this supported release changes.',supportUntil:'2099-01-01',materialChange:'Exact synthetic release 3 assessed for the privacy-registration activation fixture.',componentId:'mis_maternal',version:1,updatedBy:o.id,updatedAt:assuranceAt,findings:[],history:[]}];
assuranceOperations.supplyChain.push({id:`privacy-registration-mis-community-${id}`,kind:'provider',name:'Synthetic community register assurance',release:'1',ownerId:o.id,controls:['Signed synthetic provider release'],subprocessors:[{name:'None disclosed',purpose:'Explicit synthetic provider declaration',jurisdiction:'Not applicable'}],incidentContact:'SECURITY-CASE-QUEUE',updateObligation:'Notify the accountable owner before this supported release changes.',supportUntil:'2099-01-01',materialChange:'Exact synthetic release 1 assessed for the aggregate receipt-loss fixture.',componentId:'mis_community',version:1,updatedBy:o.id,updatedAt:assuranceAt,findings:[],history:[]});
sql.prepare('INSERT INTO operations (org_id,data) VALUES (?,?) ON CONFLICT(org_id) DO UPDATE SET data=excluded.data').run(org,JSON.stringify(assuranceOperations));
await post(o,{type:'toggleIntegration',integrationId:'mis_maternal',version:o.state.integrations.find(i=>i.id==='mis_maternal').version});await post(o,{type:'toggleIntegration',integrationId:'mis_maternal',version:o.state.integrations.find(i=>i.id==='mis_maternal').version});
const newOrg=await post(o,{type:'createOrganisation',name:'Isolated second organisation'});check(()=>{assert.equal(newOrg.snapshot.people.length,0);assert.equal(newOrg.snapshot.visits.length,0);assert.notEqual(newOrg.snapshot.organisation.id,org)});await get(o,`/api/fhir/${visitId}?organisationId=${newOrg.snapshot.organisation.id}`,404);await post(o,{type:'switchOrganisation',organisationId:org});check(()=>assert.equal(o.state.submissions.length,2));
const template=sql.prepare('SELECT * FROM record_revisions WHERE org_id=? AND entity_type=? LIMIT 1').get(legacyOrg,'person');
for(let n=2;n<=62;n++)sql.prepare('INSERT INTO record_revisions (id,org_id,person_id,entity_type,entity_id,version,actor_id,actor_name,action,reason,data,changes,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run(`page-${id}-${n}`,legacyOrg,template.person_id,template.entity_type,template.entity_id,n,legacy.actor,'Legacy owner','pageFixture','Synthetic pagination fixture',template.data,'[]','2026-09-25T08:00:00.000Z');
const hp=await get(legacyUser,`/api/history?personId=${template.person_id}`,200,legacyOrg);check(()=>{assert.equal(hp.revisions.length,50);assert.ok(hp.nextCursor)});const hp2=await get(legacyUser,`/api/history?personId=${template.person_id}&cursor=${encodeURIComponent(hp.nextCursor)}`,200,legacyOrg);check(()=>{assert.ok(hp2.revisions.length>0);assert.equal(new Set([...hp.revisions,...hp2.revisions].map(r=>r.id)).size,hp.revisions.length+hp2.revisions.length)});
for(let n=0;n<105;n++)sql.prepare('INSERT INTO audit_events (org_id,id,person_id,actor_id,actor_name,role,action,subject,detail,at) VALUES (?,?,?,?,?,?,?,?,?,?)').run(legacyOrg,`audit-page-${id}-${String(n).padStart(3,'0')}`,template.person_id,legacy.actor,'Legacy owner','clinician','pageFixture',template.person_id,'Synthetic pagination fixture','2026-09-25T08:00:00.000Z');
const ap=await get(legacyUser,'/api/audit',200,legacyOrg);check(()=>{assert.equal(ap.events.length,100);assert.ok(ap.nextCursor)});const ap2=await get(legacyUser,`/api/audit?cursor=${encodeURIComponent(ap.nextCursor)}`,200,legacyOrg);check(()=>assert.equal(new Set([...ap.events,...ap2.events].map(r=>r.id)).size,ap.events.length+ap2.events.length));await get(x,'/api/audit',403,legacyOrg);
const {programmeSmoke}=await import('./programme-smoke.mjs');await programmeSmoke({o,w,s,a,post,get,check,org});
const {agentSmoke}=await import('./agent-smoke.mjs');await agentSmoke({o,c,w,a,s,post,get,check,org,sql});
const {misSmoke}=await import('./mis-smoke.mjs');await misSmoke({get,post,check,accounts,org,sql});
const {ehrSmoke}=await import('./ehr-smoke.mjs');await ehrSmoke({get,post,check,accounts,org,sql});
const {fieldSmoke}=await import('./field-smoke.mjs');await fieldSmoke({get,post,check,accounts,org});
const {operationsSmoke}=await import('./operations-privacy-registration-current.mjs');await operationsSmoke({get,post,check,accounts,org,sql});
const {pilotSmoke}=await import('./pilot-smoke.mjs');await pilotSmoke({get,post,check,accounts,org,sql});
const {outreachSmoke}=await import('./outreach-smoke.mjs');await outreachSmoke({get,post,check,accounts,org,sql});
const {continuitySmoke}=await import('./continuity-smoke.mjs');await continuitySmoke({get,post,check,accounts,org,sql,base});
const {governanceSmoke}=await import('./governance-smoke.mjs');await governanceSmoke({get,post,check,accounts,org,sql});
const {expansionSmoke}=await import('./expansion-smoke.mjs');await expansionSmoke({get,post,check,accounts,org,sql});
const {partitionSmoke}=await import('./partition-smoke.mjs');await partitionSmoke({get,post,check,accounts,org,sql,base});
const {deltaSmoke}=await import('./delta-smoke.mjs');await deltaSmoke({get,post,check,accounts,org,base});
const {householdSmoke}=await import('./household-smoke.mjs');await householdSmoke({get,post,check,accounts,org,sql,base});
const {caseloadSmoke}=await import('./caseload-smoke.mjs');await caseloadSmoke({get,post,check,accounts,org,sql,base});
// Slice 1f: scheduled caseload transfers applied at their effective time, and household transfer.
const {caseloadScheduleSmoke}=await import('./caseload-schedule-smoke.mjs');await caseloadScheduleSmoke({get,post,check,accounts,org,sql,base});
const {mergeSmoke}=await import('./merge-smoke.mjs');await mergeSmoke({get,post,check,accounts,org,sql,base});
const {exceptionalSmoke}=await import('./exceptional-smoke.mjs');await exceptionalSmoke({get,post,check,accounts,org,sql,base});
const {rightsSmoke}=await import('./rights-smoke.mjs');await rightsSmoke({get,post,check,accounts,org,sql,base});
await globalThis.sahaRecycleWorker?.(); // slice 10k: fresh Worker isolate, same D1 state (see run-api-smoke.mjs)
const {retentionSmoke}=await import('./retention-smoke.mjs');await retentionSmoke({get,post,check,accounts,org,sql,base});
const {fourthReviewSmoke}=await import('./fourth-review-smoke.mjs');await fourthReviewSmoke({check,org,base});
const {indicatorsSmoke}=await import('./indicators-privacy-registration-current.mjs');await indicatorsSmoke({get,post,check,accounts,org,base});
const {referralSmoke}=await import('./referral-smoke.mjs');await referralSmoke({get,post,check,accounts,org,base});
const {reuseSmoke}=await import('./reuse-privacy-registration-current.mjs');await reuseSmoke({get,post,check,accounts,org,base});
const {rosterSmoke}=await import('./roster-smoke.mjs');await rosterSmoke({get,post,check,accounts,org,base});
const {abdmSmoke}=await import('./abdm-smoke.mjs');await abdmSmoke({get,post,check,accounts,org,base});
// Slice 6z: the out-of-scope ABHA refusal is the ordinary link refusal and is recorded for an identity steward.
const {sixthReviewSmoke}=await import('./sixth-review-smoke.mjs');await sixthReviewSmoke({get,post,check,accounts,org,sql,base});
const {abdmTransferSmoke}=await import('./abdm-transfer-smoke.mjs');await abdmTransferSmoke({get,post,check,accounts,org,base});
const {mediaSmoke}=await import('./media-smoke.mjs');await mediaSmoke({get,post,check,accounts,org,sql,base});
const {fieldRegistrationSmoke}=await import('./field-registration-smoke.mjs');await fieldRegistrationSmoke({get,post,check,accounts,org,sql,base});
const {factProvenanceSmoke}=await import('./fact-provenance-smoke.mjs');await factProvenanceSmoke({get,post,check,accounts,org,base});
const {referralRequestSmoke}=await import('./referral-request-smoke.mjs');await referralRequestSmoke({get,post,check,accounts,org,sql});
const {actionPlanSmoke}=await import('./action-plan-smoke.mjs');await actionPlanSmoke({get,post,check,accounts,org,base});
const {planDependenciesSmoke}=await import('./plan-dependencies-smoke.mjs');await planDependenciesSmoke({get,post,check,accounts,org,base});
// Slice 10f: household visit slots and cross-pack referral consolidation.
const {householdVisitSmoke}=await import('./household-visit-smoke.mjs');await householdVisitSmoke({get,post,check,accounts,org,sql,base});
const {exceptionsSmoke}=await import('./exceptions-smoke.mjs');await exceptionsSmoke({get,post,check,accounts,org,base});
const {reportExportSmoke}=await import('./report-export-privacy-registration-current.mjs');await reportExportSmoke({get,post,check,accounts,org,sql,base});
const {auditChainSmoke}=await import('./audit-chain-smoke.mjs');await auditChainSmoke({get,post,check,accounts,org,sql,base});
const {accessAuditSmoke}=await import('./access-audit-smoke.mjs');await accessAuditSmoke({get,post,check,accounts,org,sql,base});
// Slice 10h: workspace loads, record opens, patient searches and lists, and aggregate views are audited the same way.
const {readAuditCompletionSmoke}=await import('./read-audit-completion-privacy-registration-current.mjs');await readAuditCompletionSmoke({get,post,check,accounts,org,sql,base});
const {aiBudgetSmoke}=await import('./ai-budget-smoke.mjs');await aiBudgetSmoke({get,post,check,accounts,org});
await globalThis.sahaRecycleWorker?.(); // slice 10k: fresh Worker isolate, same D1 state (see run-api-smoke.mjs)
const {aiInvoiceSmoke}=await import('./ai-invoice-smoke.mjs');await aiInvoiceSmoke({get,post,check,accounts,org});
const {safeLogsSmoke}=await import('./safe-logs-smoke.mjs');await safeLogsSmoke({get,post,check,accounts,org,sql,base});
const {providerSandboxSmoke}=await import('./provider-sandbox-smoke.mjs');await providerSandboxSmoke({get,post,check,accounts,org});
const {agentQualitySmoke}=await import('./agent-quality-smoke.mjs');await agentQualitySmoke({get,post,check,accounts,org,base});
const {capabilityLifecycleSmoke}=await import('./capability-lifecycle-smoke.mjs');await capabilityLifecycleSmoke({get,post,check,accounts,org});
const {shadowSmoke}=await import('./shadow-smoke.mjs');await shadowSmoke({get,post,check,accounts,org});
const {dataExitSmoke}=await import('./data-exit-smoke.mjs');await dataExitSmoke({get,post,check,accounts,org,sql,base});
const {environmentSmoke}=await import('./environment-smoke.mjs');await environmentSmoke({get,post,check,accounts,org,base,sql});
const {fixtureMigrationSmoke}=await import('./fixture-migration-smoke.mjs');await fixtureMigrationSmoke({get,post,check,accounts,org,sql,base});
const {programmeMigrationSmoke}=await import('./programme-migration-smoke.mjs');await programmeMigrationSmoke({get,post,check,accounts,org,sql,base});
// Slice 4f: governed installation of a programme pack (stage, independent review, activation, retirement).
const {packInstallationSmoke}=await import('./pack-installation-smoke.mjs');await packInstallationSmoke({get,post,check,accounts,org,sql,base});
const {consentSmoke}=await import('./consent-smoke.mjs');await consentSmoke({get,post,check,accounts,org,sql});
const {delegationSmoke}=await import('./delegation-privacy-registration-current.mjs');await delegationSmoke({get,post,check,accounts,org,sql,base});
const {workerActivitySmoke}=await import('./worker-activity-smoke.mjs');await workerActivitySmoke({get,post,check,accounts,org,base});
// Slice 10c: synthetic worker incentive claims (schedule, claim, verification, approval into a digest chain, correction, CSV).
const {incentiveClaimsSmoke}=await import('./incentive-claims-smoke.mjs');await incentiveClaimsSmoke({get,post,check,accounts,org,sql,base});
await globalThis.sahaRecycleWorker?.(); // slice 10k: fresh Worker isolate, same D1 state (see run-api-smoke.mjs)
const {correctionTasksSmoke}=await import('./correction-tasks-smoke.mjs');await correctionTasksSmoke({get,post,check,accounts,org,sql,base});
const {referralRequestQueueSmoke}=await import('./referral-request-queue-smoke.mjs');await referralRequestQueueSmoke({get,post,check,accounts,org,sql,base});
const {patientDirectorySmoke}=await import('./patient-directory-smoke.mjs');await patientDirectorySmoke({get,post,check,sql,base});
const {worklistsSmoke}=await import('./worklists-smoke.mjs');await worklistsSmoke({get,post,check,sql,base});
const {factVerificationSmoke}=await import('./fact-verification-smoke.mjs');await factVerificationSmoke({get,post,check,accounts,org,sql,base});
const {valueOverrideSmoke}=await import('./value-override-smoke.mjs');await valueOverrideSmoke({get,post,check,accounts,org,sql,base});
const {patientImportSmoke}=await import('./patient-import-smoke.mjs');await patientImportSmoke({get,post,check,accounts,org,sql,base});
const {recordImportSmoke}=await import('./record-import-smoke.mjs');await recordImportSmoke({get,post,check,accounts,org,sql,base});
// Slice 10e: issuer-identifier search, ABHA format and programme identity crosswalks (its own synthetic organisation).
const {identifierSearchSmoke}=await import('./identifier-search-smoke.mjs');await identifierSearchSmoke({get,post,check,sql,base});
// Slice 10d: workforce roster import (dry run, rejection report, apply exactly the plan).
const {workforceImportSmoke}=await import('./workforce-import-smoke.mjs');await workforceImportSmoke({get,post,check,accounts,org,sql,base});
// Slice 10i: controlled import of historical visits with clinical content (kind visits of the record import).
const {visitImportSmoke}=await import('./visit-import-smoke.mjs');await visitImportSmoke({get,post,check,accounts,org,sql,base});
const {indicatorRegistrySmoke}=await import('./indicator-registry-privacy-registration-current.mjs');await indicatorRegistrySmoke({get,post,check,accounts,org,sql,base});
const {indicatorFreshnessSmoke}=await import('./indicator-freshness-privacy-registration-current.mjs');await indicatorFreshnessSmoke({get,post,check,accounts,org,sql,base});
const {alertDeliverySmoke}=await import('./alert-delivery-smoke.mjs');await alertDeliverySmoke({get,post,check,accounts,org,sql});
// Slice 10b: owner-managed out-of-app notification channel (demonstration simulator). Runs right after 6v, which it builds on, and leaves the channel off.
const {notificationChannelSmoke}=await import('./notification-channel-smoke.mjs');await notificationChannelSmoke({get,post,check,accounts,org,sql});
const {noteAnswerSignOffSmoke}=await import('./verification-api-note-answer-signoff-current.mjs');await noteAnswerSignOffSmoke({get,post,check,accounts,org,sql,base});
const {traceSmoke}=await import('./trace-smoke.mjs');await traceSmoke({get,post,check,accounts,org,sql,base});
const {adapterOperationsSmoke}=await import('./adapter-operations-smoke.mjs');await adapterOperationsSmoke({get,post,check,accounts,org,base});
const {aggregateDeliverySmoke}=await import('./aggregate-delivery-smoke.mjs');await aggregateDeliverySmoke({get,post,check,accounts,org,sql});
// Slice 10g: disputes block sending, sign-off rules per programme and destination, sign-off withdrawal (leaves the organisation's sign-off rules cleared).
const {sendGateSmoke}=await import('./send-gate-smoke.mjs');await sendGateSmoke({get,post,check,accounts,org,sql});
// Slice 9a: demonstration clinical package (its own synthetic accounts and home organisation).
const {demonstrationSmoke}=await import('./demonstration-smoke.mjs');await demonstrationSmoke({get,post,check,sql,base});
const {memberNamesSmoke}=await import('./member-names-smoke.mjs');await memberNamesSmoke({get,post,check,accounts,org,sql});
// Slice 10j: the member's language choice (English or draft Hindi) for the workspace.
const {languageSmoke}=await import('./language-smoke.mjs');await languageSmoke({get,post,check,accounts,org,sql});
// Slice 12a: the owner setting for voice input's browser speech service (left off).
const {speechSmoke}=await import('./speech-smoke.mjs');await speechSmoke({get,post,check,accounts,org,sql});
// Slice 13d: review leftovers (indicator refusals recorded and limited), own organisation.
const {reviewLeftoversSmoke}=await import('./review-leftovers-smoke.mjs');await reviewLeftoversSmoke({get,post,check,base,sql});
// Slice 13a: cross-site refusal, facility and programme scope in reads and commands, purpose checkpoints (own organisation).
const {accessScopeSmoke}=await import('./access-scope-smoke.mjs');await accessScopeSmoke({get,post,check,base});
// Slice 6ab: runs last because it leaves the synthetic worker throttled for ABHA links for a day.
const {eighthReviewSmoke}=await import('./eighth-review-smoke.mjs');await eighthReviewSmoke({get,post,check,accounts,org,sql});
await globalThis.sahaRecycleWorker?.();
const {anaemiaHttpSmoke}=await import('./anaemia-http-smoke.mjs');total+=await anaemiaHttpSmoke({base});
const testResult={passed:total,release:'slice-2b (R11 + slices 0a-1d, 2a, 4a, 6a-6d, 7a-7b, 0b-2 + visit media)',run:id,coverage:['server work lists for paged workspaces: My work statistics and visit list, follow-ups, Submissions (all and needs attention) and referrals walked page by page equal the unpaged workspace for a supervisor, the owner, a clinician and an ASHA, also after a command; no team-B record for a team-A owner; admin empty, non-member refused; no name, id or free text in the address','owner-maintained indicator registry: built-ins as version 1, owner-only add/revise/retire with reasons and stale versions refused, results naming definition and version, reproduction by version, definition minimum cohort, differencing refusal across one viewer\'s queries, hashed ledger kept from operators, suppressed indicator CSV','controlled patient import: dry-run authority, size bounds, no names and nothing stored, stale plan refused, exact-plan apply with a revision per person and one counted audit event, repeat refused, replay rechecked after a role change','per-measurement author from the server identity and clinician verification or dispute: role, scope, state, version and self refusals, append-only reviews, revisions, audit, replay rechecked after a role change, FHIR example notes and correction drafts keeping copied authors','capability lifecycle: registered, technically verified, approved for scope and active stages, owner-only activation, replacement recorded on activation of a later revision, use by exact version, in-progress work identified with required actions after replacement or suspension, new requests and application refused','assistant input quality: noisy, unsupported and insufficient input reported as unable to assess with no values; conflicts with recorded facts and between open results flagged on both sides, one action-plan review task with both values, explicit choice with a reason before applying, the competing output retained but stale','provider sandbox: owner declaration of an empty organisation, provider-only invitation, documentation with a credential reference, own-provider proposals and synthetic evaluation, refusals of review, activation, patient work and production access, and owner import into the standard production evaluation, review and activation path','worker activity evidence: performed, claimed, verified and submitted states, corrections with who and why, supervisor scope and no location','time-limited delegation of team supervision and reporting-only access: grant refusals, replay, enforcement, delegated-authority audit, revocation and expiry','consent withdrawal: queued deliveries, unexecuted plans, EHR permissions, ABDM consents, unsent AI requests and reminders stopped, sent items listed, history, audit and revisions','clinician decision on field referral requests: referral created in one step or declined with a reason, role, confirmation and repeat refusals, replay and audit','per-measurement source and time on visit facts: refusals, storage, history, FHIR example times, field sync and field registration','offline field registration synced as one command with an optional first visit draft and referral request, resend under a new key returning the same person, possible-match refusal and reviewed resend, role, team and replay refusals','visit photos and voice notes with type, signature, size and purpose checks, playback and draft removal','care-context linking, encrypted consent-bound transfer and received-record review against the mock gateway','ABDM module approvals, ABHA link/decline/unlink and consent artefacts against a local mock gateway','workforce roster preview and apply with invitations, updates and suspensions','reproducible reuse, blocked reuse, repeated-entry and correction metering','referral lifecycle states, reasoned delays and escalation queue','catalogue indicators with cohort protection, small-cell suppression and governed interpretation','indicator source freshness per team with banded counts, late arrivals since the previous release and a data-still-syncing warning, field sync time stamped on the visit','retention schedules, legal holds and eligibility review without deletion','viewer-scoped workspace reads','rights and grievance requests with representative authority, destinations, due dates and processing restriction','time-limited exceptional access with restricted actions, closure and independent review','two-person identity merge, blocked writes on merged records, impact queue and unmerge','bulk caseload transfer, scheduled effective time, acknowledgement, responsibility gaps and member removal','households, proxy authority and sensitive-class disclosure','partition delta responses equal fresh full snapshots','patient-partitioned loading, per-patient concurrency and unchanged scope','immutable source/service/protocol/capability reviews and independent activation','worker-context clinical decisions, freshness and dependency invalidation','version-bound one-case evaluation, English pass and Hindi failure','capability context eligibility, safety hold and rejected-output retention','verified directory snapshots and scoped safety-case resolution','scoped patient matching and provisional identity review','explicit patient confirmation with stale-context rejection','atomic open-work handover, acknowledgement and unavailable-owner queue','outreach scope, assignment and visit evidence','contact permissions, quiet hours and shared phones','independent message approval, simulation, retry and opt-out','configuration-only expansion packs and six-area review','pilot configuration and reviewer separation','training assessment and personal acknowledgement','baseline and outcome scope','dossier invalidation after evidence and membership changes','rehearsal transitions and hard live gate','pilot export privacy and audit','scoped operational reports and exports','maintenance and receipt recovery','incident responsibility and evidence','privacy-safe metrics and diagnostics','revoked operational access','bounded concurrent report requests','signed field grants and scoped sync','sync replay after lost response','conflicts and identity/permission changes','durable referral ownership and evidence transitions','EHR patient links and duplicate prevention','scoped permissions and revocation','FHIR document export and staged import','document deduplication and version conflicts','EHR publication activation and credential gates','programme mapping ownership and persistence','durable HTTP outbox and duplicate queue prevention','programme credential and sharing gates','unsent cancellation and audit','agent authority and explicit approvals','grounded extraction and reviewed field application','durable invocation checkpoint and duplicate execution','stale input and consent rejection','conflict/negation/history handling','cancellation and interruption recovery','provider configuration gating','programme enrolment and pinned versions','shared facts and conditional questions','absence evidence validation','programme scope and stale edits','episode closure and independent follow-up lifecycle','no historical measurement carry-forward','real account memberships','no role impersonation','organisation isolation','team scope','direct ASHA assignments','administrator PHI denial','supervisor write denial','account-bound invitations and replay','last owner protection','concurrent edits','idempotency and mismatch','immutable confirmed facts','stable account approval','partial dispatch and receipt recovery','AI withdrawal and review','identity corrections and revision provenance','amendment links','wrong-patient quarantine','immediate suspension and reassignment','CSRF','organisation switching','legacy migration preservation and restart','append-only database constraints','invitation expiry','failed migration rollback and recovery','concurrent identical command replay','revoked default organisation recovery','history and audit pagination']};
const {writeFileSync}=await import('node:fs');writeFileSync('tests/evidence/privacy-api-current/api-result.json',JSON.stringify({...testResult,completedAt:new Date().toISOString()},null,2)+'\n');console.log(JSON.stringify(testResult,null,2));
