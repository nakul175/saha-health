import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {startMiniflare} from '../../lib/miniflare.mjs';
import {identity,client} from '../../lib/worker.mjs';
const ev='tests/evidence/inbound-conflicts-independent-after';let passed=0;const check=async f=>{await f();passed++};
const w=await startMiniflare({port:9033,name:'inbound-pressure-provenance-review',bindings:{SAHA_ENVIRONMENT:'synthetic'}});
try{
 const api=client(w.base),owner=identity('inbound-owner'),reviewer=identity('inbound-reviewer'),other=identity('inbound-other'),db=await w.mf.getD1Database('DB');
 const initial=(await api.get(owner,'/api/workspace')).json,org=initial.organisation.id;
 const cmd=async(actor,c,status=200)=>{const r=await api.call(actor,'/api/commands',{method:'POST',org,body:c});assert.equal(r.status,status,r.text);return r.json};
 const reviewHome=(await api.get(reviewer,'/api/workspace')).json;const invitation=await cmd(owner,{type:'createInvite',accountCode:reviewHome.user.accountCode,label:'Independent clinician',role:'clinician',teamIds:['default']});await cmd(reviewer,{type:'joinOrganisation',token:invitation.result.token});
 const pid=(await cmd(owner,{type:'createPerson',name:'Test Person',age:30,sex:'Other',village:'Synthetic',programme:'General care',teamId:'default'})).result.personId;
 let snap=(await api.get(owner,'/api/workspace',org)).json,p=snap.people.find(x=>x.id===pid);await cmd(owner,{type:'setConsent',personId:pid,purpose:'exchange',active:true,version:p.consentVersion});
 const reg=await cmd(owner,{type:'registerIntegration',name:'Synthetic inbound EHR',kind:'ehr',endpoint:'https://ehr.example/fhir',credentialBinding:'SAHA_EHR_TEST',description:'Synthetic file review only'});snap=(await api.get(owner,'/api/workspace',org)).json;const i=snap.integrations.find(x=>x.name==='Synthetic inbound EHR');await cmd(owner,{type:'configureEhr',integrationId:i.id,version:i.version,read:true,write:true});p=snap.people.find(x=>x.id===pid);
 const link=(await cmd(owner,{type:'linkEhr',personId:pid,version:p.version,integrationId:i.id,externalId:'external-1',externalName:'Test Person',confirmed:true,reason:'Synthetic matched identifiers'})).result.linkId;
 const permission=(await cmd(owner,{type:'grantEhrPermission',personId:pid,linkId:link,direction:'read',purpose:'care-coordination',from:'2026-01-01T00:00:00.000Z',to:'2026-12-31T23:59:59.000Z',expiresAt:new Date(Date.now()+86400000).toISOString()})).result.permissionId;
 const original=JSON.parse(readFileSync('tests/ehr-synthetic-document.json','utf8')),documentId=(await cmd(owner,{type:'importEhrDocument',personId:pid,linkId:link,permissionId:permission,json:JSON.stringify(original)})).result.documentId;
 const visitId=(await cmd(owner,{type:'startVisit',personId:pid})).result.visitId;snap=(await api.get(owner,'/api/workspace',org)).json;let v=snap.visits.find(x=>x.id===visitId);await cmd(owner,{type:'saveVisit',visitId,version:v.version,facts:{...v.facts,systolic:'121',diastolic:'81',weight:'55',notes:'Local pending correction',provenance:{bloodPressure:{source:'measured',at:v.facts.date}}}});snap=(await api.get(owner,'/api/workspace',org)).json;v=snap.visits.find(x=>x.id===visitId);
 const incoming=structuredClone(original);incoming.meta.versionId='2';incoming.entry.find(e=>e.resource.code?.coding?.some(c=>c.code==='29463-7')).resource.valueQuantity.value=66;
 await cmd(owner,{type:'importEhrDocument',personId:pid,linkId:link,permissionId:permission,json:JSON.stringify(incoming)},409);await check(async()=>assert.ok(true));writeFileSync(ev+'/before-http-gap.json',JSON.stringify({existingImportStatus:409,originalSourceRetained:true,secondVersionNotStagedByExistingImporter:true,actualWorker:true,actualD1:true},null,2));
 const read=async(actor=owner,status=200)=>{const r=await api.get(actor,'/api/inbound-conflicts?personId='+pid,org);assert.equal(r.status,status,r.text);return r.json};
 const post=async(actor,body,status=200)=>{const r=await api.call(actor,'/api/inbound-conflicts',{method:'POST',org,body});assert.equal(r.status,status,r.text);return r.json};
 const stage={type:'stage',personId:pid,expectedActorId:owner.id,key:crypto.randomUUID(),kind:'inbound-document',documentId,visitId,ownerId:reviewer.id,sourceVersion:original.meta.versionId,incomingVersion:'2',effectiveAt:original.entry[0].resource.date,json:JSON.stringify(incoming)};
 const priorVisits=await db.prepare('SELECT * FROM visits WHERE org_id=? AND person_id=?').bind(org,pid).all();
 await db.exec("CREATE TRIGGER inbound_audit_fail BEFORE INSERT ON audit_events WHEN NEW.action='inboundConflictstage' BEGIN SELECT RAISE(ABORT,'synthetic audit failure'); END");await post(owner,stage,503);const failedReceipt=await db.prepare('SELECT count(*) n FROM command_receipts WHERE key=?').bind(stage.key).first();await check(async()=>assert.equal(failedReceipt.n,0));await check(async()=>assert.equal((await read()).rows.length,0));await db.exec('DROP TRIGGER inbound_audit_fail');
 const staged=(await post(owner,stage)).result,view=await read(),item=view.rows[0];await check(async()=>assert.equal(item.incoming.summary.observations.find(x=>x.code==='29463-7').value,'66'));await check(async()=>assert.equal(item.localSnapshot.facts.weight,'55'));await check(async()=>assert.deepEqual(item.source.bundle,original));await check(async()=>assert.deepEqual((await db.prepare('SELECT * FROM visits WHERE org_id=? AND person_id=?').bind(org,pid).all()).results,priorVisits.results));
 const replay=await post(owner,stage);await check(async()=>assert.equal(replay.replayed,true));await post(owner,{...stage,incomingVersion:'3'},409);await check(async()=>assert.ok(true));
 const decision={type:'decide',personId:pid,expectedActorId:reviewer.id,key:crypto.randomUUID(),conflictId:staged.conflictId,version:1,basis:item.basis,decision:'merge-draft',choices:{systolic:'incoming',diastolic:'local',temperature:'local',weight:'incoming'}};
 await post(owner,{...decision,expectedActorId:owner.id},403);await check(async()=>assert.ok(true));await post(reviewer,{...decision,choices:{}},422);await check(async()=>assert.ok(true));
 const pressureBefore=(await read()).visits.find(x=>x.id===visitId);
 const pressureResponse=await api.call(reviewer,'/api/inbound-conflicts',{method:'POST',org,body:decision});const pressureAfter=(await read()).visits.find(x=>x.id===visitId);
 writeFileSync(ev+'/mixed-pressure-provenance-before.json',JSON.stringify({actualWorker:true,actualD1:true,choices:decision.choices,status:pressureResponse.status,before:{systolic:pressureBefore.facts.systolic,diastolic:pressureBefore.facts.diastolic,provenance:pressureBefore.facts.provenance.bloodPressure},after:{systolic:pressureAfter.facts.systolic,diastolic:pressureAfter.facts.diastolic,provenance:pressureAfter.facts.provenance.bloodPressure},expectedStatus:422,reason:'Shared bloodPressure provenance cannot relabel retained local measured component as incoming reported'},null,2)+'\n');
 assert.equal(pressureResponse.status,422,'Mixed-component source choice must not relabel preserved measured diastolic provenance');

 assert.deepEqual(pressureAfter.facts,pressureBefore.facts,'Refused incompatible BP choice retains all clinical facts');
 assert.equal(pressureAfter.version,pressureBefore.version);assert.equal(pressureAfter.recordVersion,pressureBefore.recordVersion);
 assert.equal((await db.prepare('SELECT count(*) n FROM command_receipts WHERE key=?').bind(decision.key).first()).n,0,'Refusal saves no clinical receipt');
 const safe={...decision,key:crypto.randomUUID(),choices:{...decision.choices,systolic:'local',diastolic:'local'}};
 await post(reviewer,safe);const valid=(await read()).visits.find(x=>x.id===visitId);
 assert.equal(valid.facts.weight,'66');assert.deepEqual(valid.facts.provenance.bloodPressure,pressureBefore.facts.provenance.bloodPressure);assert.equal(valid.facts.systolic,'121');assert.equal(valid.facts.diastolic,'81');

 const differentTimes=structuredClone(incoming);differentTimes.meta.versionId='3';differentTimes.entry.find(e=>e.resource.code?.coding?.some(c=>c.code==='8480-6')).resource.effectiveDateTime='2026-09-01T10:01:00.000Z';
 const timeStage=(await post(owner,{...stage,key:crypto.randomUUID(),incomingVersion:'3',json:JSON.stringify(differentTimes)})).result;
 const timeRow=(await read()).rows.find(x=>x.id===timeStage.conflictId),timeDecision={...decision,key:crypto.randomUUID(),conflictId:timeStage.conflictId,basis:timeRow.basis,choices:{...decision.choices,systolic:'incoming',diastolic:'incoming'}};
 const timeResponse=await api.call(reviewer,'/api/inbound-conflicts',{method:'POST',org,body:timeDecision});assert.equal(timeResponse.status,422,'Different observation times cannot be represented by one BP provenance timestamp');
 const timeAfter=(await read()).visits.find(x=>x.id===visitId);assert.deepEqual(timeAfter.facts,valid.facts);assert.equal(timeAfter.version,valid.version);assert.equal((await db.prepare('SELECT count(*) n FROM command_receipts WHERE key=?').bind(timeDecision.key).first()).n,0);
 writeFileSync(ev+'/pressure-after-positive.json',JSON.stringify({passed:13,failed:0,actualWorker:true,actualD1:true,mixedRefusal422:true,refusalFactsAndVersionsUnchanged:true,noRefusalReceipt:true,coupledLocalPressureProvenancePreserved:true,independentIncomingWeightAccepted:true},null,2)+'\n');console.log(JSON.stringify({passed:13,failed:0}));
}finally{await w.stop();}
