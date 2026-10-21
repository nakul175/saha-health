import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {startMiniflare} from './lib/miniflare.mjs';
import {identity,client} from './lib/worker.mjs';

let passed=0;
const check=(condition,message)=>{assert.ok(condition,message);passed++;};
const m=await startMiniflare({port:8987,name:'support-case',bindings:{SAHA_ENVIRONMENT:'synthetic'}});
try{
 const api=client(m.base),owner=identity('support-case-owner'),worker=identity('support-case-worker'),support=identity('support-case-admin'),outsider=identity('support-case-out-of-scope-owner');
 const home=await api.get(owner,'/api/workspace');assert.equal(home.status,200,home.text);const org=home.json.organisation.id;
 const command=async(who,body,status=200,key=crypto.randomUUID())=>{const r=await api.call(who,'/api/commands',{method:'POST',org,body,headers:{'Idempotency-Key':key}});assert.equal(r.status,status,r.text);return r;};
 const snapshot=async who=>{const r=await api.get(who,'/api/workspace',org);assert.equal(r.status,200,r.text);return r.json;};
 let state=await snapshot(owner),self=state.members.find(x=>x.userId===owner.id);
 await command(owner,{type:'updateMember',userId:owner.id,version:self.version,role:'clinician',teamIds:['default'],isOwner:true,status:'active',reason:'Synthetic scoped owner for bounded support approval'});
 const otherTeam=(await command(owner,{type:'createTeam',name:'Synthetic unrelated support approval team'})).json.result.teamId;
 for(const [who,role,label,teamIds] of [[worker,'asha','Synthetic field worker',['default']],[support,'admin','Synthetic routine support agent',[]],[outsider,'clinician','Synthetic out-of-scope owner',[otherTeam]]]){
  const profile=await api.get(who,'/api/workspace'),invite=await command(owner,{type:'createInvite',accountCode:profile.json.user.accountCode,label,role,teamIds});
  await command(who,{type:'joinOrganisation',token:invite.json.result.token});
 }
 state=await snapshot(owner);const outsiderMember=state.members.find(x=>x.userId===outsider.id);await command(owner,{type:'updateMember',userId:outsider.id,version:outsiderMember.version,role:'clinician',teamIds:[otherTeam],isOwner:true,status:'active',reason:'Synthetic owner deliberately outside this patient team'});
 const personId=(await command(owner,{type:'createPerson',name:'Synthetic Support Person',age:31,sex:'Unknown',village:'Synthetic Support Locality',programme:'General care',teamId:'default'})).json.result.personId;
 state=await snapshot(owner);let person=state.people.find(x=>x.id===personId);
 await command(owner,{type:'assignPatient',personId,version:person.version,teamId:'default',assignedTo:worker.id,reason:'Synthetic assigned care scope for task failure'});
 const visitId=(await command(worker,{type:'startVisit',personId})).json.result.visitId;
 const baseline=await snapshot(owner),baselinePerson=structuredClone(baseline.people.find(x=>x.id===personId)),baselineVisit=structuredClone(baseline.visits.find(x=>x.id===visitId));

 const opened=await command(worker,{type:'supportCaseOpen',visitId,task:'field-sync',failure:'offline-timeout'}),caseId=opened.json.result.caseId;
 check(opened.json.result.version===1,'Task-linked support case opens at version one');
 const supportWorkspace=await snapshot(support);check(supportWorkspace.people.length===0&&supportWorkspace.visits.length===0,'Routine support workspace contains no patient records');
 const queue=await api.get(support,'/api/support-cases',org);assert.equal(queue.status,200,queue.text);const serialized=JSON.stringify(queue.json),row=queue.json.rows.find(x=>x.id===caseId);
 check(!!row&&row.diagnostics.containsPatientContent===false,'Routine queue returns fixed redacted diagnostics');
 check(!serialized.includes(personId)&&!serialized.includes(visitId)&&!serialized.includes('Synthetic Support Person')&&!serialized.includes('Synthetic Support Locality'),'Routine queue omits patient identity and visit identifiers');
 const deniedBefore=await api.get(support,`/api/support-cases?caseId=${caseId}&content=1`,org);check(deniedBefore.status===403,'Patient content is refused before approval');
 const malformed=await command(support,{type:'supportGrantRequest',caseId,expectedVersion:1,purpose:'Synthetic bounded investigation for failed field sync only',scopes:['all-patient-content'],minutes:30},422);check(malformed.status===422,'Unbounded support scope is refused');
 const requestKey=crypto.randomUUID(),requested=await command(support,{type:'supportGrantRequest',caseId,expectedVersion:1,purpose:'Synthetic bounded investigation for failed field sync only',scopes:['visit-status'],minutes:30},200,requestKey),grantId=requested.json.result.grantId;
 const replay=await command(support,{type:'supportGrantRequest',caseId,expectedVersion:1,purpose:'Synthetic bounded investigation for failed field sync only',scopes:['visit-status'],minutes:30},200,requestKey);check(replay.json.replayed===true&&replay.json.result.grantId===grantId,'Grant request replay is idempotent');
 const selfApprove=await command(support,{type:'supportGrantDecision',caseId,expectedVersion:2,grantId,decision:'approve',note:'Synthetic support agent cannot self approve access.'},403);check(selfApprove.status===403,'Support agent cannot approve their own request');
 const outsideQueue=await api.get(outsider,'/api/support-cases',org);check(outsideQueue.status===200&&outsideQueue.json.rows.length===0,'Owner outside the patient team cannot list the case');
 const outsideApprove=await command(outsider,{type:'supportGrantDecision',caseId,expectedVersion:2,grantId,decision:'approve',note:'Synthetic out-of-scope owner must not approve this access.'},403);check(outsideApprove.status===403,'Owner outside the patient team cannot approve exceptional access');
 const approved=await command(owner,{type:'supportGrantDecision',caseId,expectedVersion:2,grantId,decision:'approve',note:'Approved for this bounded synthetic support diagnosis.'});check(approved.json.result.state==='approved'&&!!approved.json.result.expiresAt,'Scoped owner approval creates an expiring grant');

 const db=await m.mf.getD1Database('DB');
 await db.prepare("CREATE TRIGGER support_case_audit_failure BEFORE INSERT ON audit_events WHEN NEW.action='viewPatientRecord' BEGIN SELECT RAISE(ABORT,'synthetic support read audit failure'); END").run();
 const auditFailure=await api.get(support,`/api/support-cases?caseId=${caseId}&content=1`,org);check(auditFailure.status>=500,'Access-audit storage failure refuses the content read');
 await db.prepare('DROP TRIGGER support_case_audit_failure').run();
 const content=await api.get(support,`/api/support-cases?caseId=${caseId}&content=1`,org);assert.equal(content.status,200,content.text);const contentText=JSON.stringify(content.json);
 check(content.json.content.visitStatus&&Object.keys(content.json.content).length===1,'Approved read discloses only the granted visit-status field group');
 check(!contentText.includes(personId)&&!contentText.includes('Synthetic Support Person')&&!contentText.includes('Synthetic Support Locality'),'Approved status read still omits patient identity');
 const accessEvent=await db.prepare("SELECT * FROM audit_events WHERE org_id=? AND actor_id=? AND action='viewPatientRecord' AND subject=? ORDER BY seq DESC LIMIT 1").bind(org,support.id,caseId).first();check(!!accessEvent&&accessEvent.person_id===personId&&accessEvent.detail.includes(grantId),'Exceptional read is patient-linked and names its grant in immutable audit');
 const operationsRow=await db.prepare('SELECT data FROM operations WHERE org_id=?').bind(org).first(),expired=JSON.parse(operationsRow.data),expiryCase=expired.supportCases.find(x=>x.id===caseId),expiryGrant=expiryCase.grants.find(x=>x.id===grantId);expiryGrant.expiresAt='2000-01-01T00:00:00.000Z';await db.prepare('UPDATE operations SET data=? WHERE org_id=?').bind(JSON.stringify(expired),org).run();
 const deniedExpired=await api.get(support,`/api/support-cases?caseId=${caseId}&content=1`,org);check(deniedExpired.status===403,'Expired grant automatically refuses patient content');
 await db.prepare('UPDATE operations SET data=? WHERE org_id=?').bind(operationsRow.data,org).run();
 state=await snapshot(owner);self=state.members.find(x=>x.userId===owner.id);await command(owner,{type:'updateMember',userId:owner.id,version:self.version,role:'clinician',teamIds:[otherTeam],isOwner:true,status:'active',reason:'Synthetic approving-owner scope withdrawn after grant approval'});
 const authorityDenied=await api.get(support,`/api/support-cases?caseId=${caseId}&content=1`,org);check(authorityDenied.status===403,'Changed approving-owner patient scope invalidates exceptional access');
 const revoked=await command(support,{type:'supportGrantRevoke',caseId,expectedVersion:3,grantId,reason:'Synthetic diagnosis complete; withdraw exceptional support access.'});check(revoked.json.result.version===4,'Current support agent can revoke exceptional support access');
 const deniedAfter=await api.get(support,`/api/support-cases?caseId=${caseId}&content=1`,org);check(deniedAfter.status===403,'Revoked grant immediately refuses patient content');
 const stale=await command(support,{type:'supportCaseResolve',caseId,expectedVersion:3,outcome:'configuration-guidance',note:'Synthetic redacted diagnostics resolved the reported failure.'},409);check(stale.status===409,'Changed case version refuses a stale support action');

 const second=(await command(worker,{type:'supportCaseOpen',visitId,task:'visit-save',failure:'conflict'})).json.result.caseId;
 const competing={type:'supportGrantRequest',caseId:second,expectedVersion:1,purpose:'Synthetic concurrent support request for changed-version diagnosis',scopes:['visit-status'],minutes:30};
 const race=await Promise.all([api.call(support,'/api/commands',{method:'POST',org,body:competing,headers:{'Idempotency-Key':crypto.randomUUID()}}),api.call(support,'/api/commands',{method:'POST',org,body:{...competing,purpose:'Synthetic competing request for changed-version diagnosis only'},headers:{'Idempotency-Key':crypto.randomUUID()}})]);
 check(race.map(x=>x.status).sort().join(',')==='200,409','Concurrent grant requests have one winner and one conflict');
 const resolved=await command(support,{type:'supportCaseResolve',caseId,expectedVersion:4,outcome:'configuration-guidance',note:'Fixed redacted diagnostics were sufficient for support guidance.'});check(resolved.json.result.state==='resolved','Routine support resolves a case from redacted diagnostics');
 state=await snapshot(owner);self=state.members.find(x=>x.userId===owner.id);await command(owner,{type:'updateMember',userId:owner.id,version:self.version,role:'clinician',teamIds:['default'],isOwner:true,status:'active',reason:'Synthetic owner scope restored after authority-refusal proof'});
 const finalState=await snapshot(owner);check(JSON.stringify(finalState.people.find(x=>x.id===personId))===JSON.stringify(baselinePerson)&&JSON.stringify(finalState.visits.find(x=>x.id===visitId))===JSON.stringify(baselineVisit),'Support workflow leaves patient and visit records unchanged');
 const chain=await api.get(owner,'/api/audit/chain',org);check(chain.status===200&&chain.json.status==='intact','Audit chain remains intact');
 mkdirSync('tests/evidence/saha-118-support-case',{recursive:true});writeFileSync('tests/evidence/saha-118-support-case/http.json',JSON.stringify({passed,failed:0,actualWorker:true,actualLocalD1:true,syntheticOnly:true,hosted:false,scope:'Task-linked redacted case, default refusal, fixed scopes, distinct scoped-owner approval, expiry metadata, idempotency, audit failure, bounded disclosure, revoke, stale-write and concurrent-request race, clinical unchanged, audit chain'},null,2)+'\n');
 console.log(JSON.stringify({passed,failed:0,suite:'support-case-http'}));
}finally{await m.stop();}
