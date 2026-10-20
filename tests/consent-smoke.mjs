import assert from 'node:assert/strict';
// Slice 6o: consent withdrawal and its downstream effects through the built Worker and local D1.
export async function consentSmoke({get,post,check,accounts,org,sql}){
 const {owner:o,worker:w,supervisor:s,admin:a,clinician:c,stranger:x}=accounts;
 await get(o,'/api/workspace',200,org);
 const tag=crypto.randomUUID().slice(0,6),person=id=>o.state.people.find(p=>p.id===id),visit=id=>o.state.visits.find(v=>v.id===id);
 // An HTTP programme connection onboarded in local D1 only, as in the MIS smoke. Transport stays disabled.
 const known=new Set(o.state.integrations.map(i=>i.id));
 await post(o,{type:'registerIntegration',name:`Consent programme ${tag}`,kind:'mis',endpoint:'https://programme.example/v1/consent',credentialBinding:'SAHA_MIS_TEST',description:'Contract fixture; no live destination'});
 let mis=o.state.integrations.find(i=>!known.has(i.id));
 await post(o,{type:'configureMis',integrationId:mis.id,version:mis.version,programmes:['Maternal care'],mapping:[{source:'personId',target:'person_ref',required:true},{source:'notes',target:'notes',required:false}],corrections:false});
 mis=o.state.integrations.find(i=>i.id===mis.id);mis.status='active';mis.mis.test={at:new Date().toISOString(),version:mis.version,ok:true,message:'Fixture only'};
 sql.prepare('UPDATE integrations SET status=?,data=? WHERE org_id=? AND id=?').run(mis.status,JSON.stringify(mis),org,mis.id);
 const pid=(await post(o,{type:'createPerson',name:`Consent Synthetic ${tag}`,age:29,sex:'Female',village:'Consent synthetic locality',programme:'Maternal care',teamId:'default'})).result.personId;
 await post(o,{type:'setConsent',personId:pid,purpose:'exchange',active:true,version:person(pid).version});
 await post(o,{type:'setConsent',personId:pid,purpose:'ai',active:true,version:person(pid).version});
 check(()=>{const h=person(pid).consentHistory;assert.equal(h.length,2);assert.deepEqual(h.map(e=>[e.purpose,e.action,e.channel]),[['exchange','granted','switch'],['ai','granted','switch']]);assert.equal(h[1].fromVersion,2);assert.equal(h[1].toVersion,3);});
 const facts=n=>({date:new Date(Date.now()-60000).toISOString().slice(0,16),systolic:'',diastolic:'',weight:'58',temperature:'',weeks:'20',coughDays:'',notes:`Synthetic consent visit ${n}`,source:'measured'});
 const confirmed=async n=>{const id=(await post(o,{type:'startVisit',personId:pid})).result.visitId;await post(o,{type:'saveVisit',visitId:id,version:visit(id).version,facts:facts(n)});await post(o,{type:'confirmVisit',visitId:id,version:visit(id).version});return id;};
 // Visit 1: one approved plan to three destinations: queued (HTTP), accepted (demo) and uncertain (demo).
 const v1=await confirmed(1);
 await post(o,{type:'preparePlan',visitId:v1,recipients:[mis.id,'mis_maternal']});let plan=visit(v1).plan;
 await post(o,{type:'approvePlan',visitId:v1,planId:plan.id,payloadHash:plan.payloadHash});await post(o,{type:'executePlan',visitId:v1,planId:plan.id});
 const sub=kind=>o.state.submissions.find(x=>x.personId===pid&&x.connectorId===kind);
 check(()=>{assert.equal(sub(mis.id).state,'queued');assert.equal(sub('mis_maternal').state,'accepted');});
 // Visit 2: a prepared, unexecuted plan.
 const v2=await confirmed(2);await post(o,{type:'preparePlan',visitId:v2,recipients:['mis_maternal']});check(()=>assert.equal(visit(v2).plan.state,'proposed'));
 // EHR link and an active local permission.
 await post(o,{type:'registerIntegration',name:`Consent FHIR ${tag}`,kind:'ehr',endpoint:'https://ehr.example/fhir-consent',credentialBinding:'SAHA_EHR_TEST',description:'Test-only adapter'});
 const ehr=o.state.integrations.find(i=>i.name===`Consent FHIR ${tag}`);await post(o,{type:'configureEhr',integrationId:ehr.id,version:ehr.version,read:true,write:true});
 const linkId=(await post(o,{type:'linkEhr',personId:pid,version:person(pid).version,integrationId:ehr.id,externalId:`consent-${tag}`,externalName:'Consent Person',confirmed:true,reason:'Verified from synthetic fixture'})).result.linkId;
 const grant={type:'grantEhrPermission',personId:pid,linkId,direction:'write',purpose:'care-coordination',from:'2026-09-01T00:00:00.000Z',to:new Date().toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString()};
 const permissionId=(await post(o,grant)).result.permissionId;
 // ABDM (mock): ABHA, a linked care context, one granted consent with a completed fetch and one still requested.
 await post(o,{type:'abhaLink', demographicMatch:'matched', confirmed:true,personId:pid,version:person(pid).version,abhaNumber:`55-1122-${String(Math.floor(Math.random()*9000)+1000)}-${String(Date.now()).slice(-4)}`,demographicMatch:'matched',confirmed:true,otp:'123456'});
 await post(o,{type:'abdmCareContextLink',personId:pid,version:person(pid).version,visitIds:[v1]});
 const today=new Date().toISOString().slice(0,10),request=()=>({type:'abdmConsentRequest',personId:pid,version:person(pid).version,purpose:'CAREMGT',hiTypes:['OPConsultation'],from:'2026-01-01',to:today,expiresAt:new Date(Date.now()+10*86400000).toISOString()});
 const granted=(await post(o,request())).result.consentId;await post(o,{type:'abdmConsentDecide',personId:pid,consentId:granted,decision:'GRANTED'});
 await post(o,{type:'abdmFetch',personId:pid,version:person(pid).version,consentId:granted});
 const requested=(await post(o,request())).result.consentId;
 // Contact: permission recorded through contact preferences, a scheduled outreach item and a draft reminder.
 let report=await get(o,'/api/outreach',200,org);let hi=report.templates.find(t=>t.language==='hi');
 if(!hi){await post(o,{type:'messageTemplatePropose',language:'hi'});report=await get(o,'/api/outreach',200,org);hi=report.templates.find(t=>t.language==='hi');}
 if(hi.state!=='approved'){await post(a,{type:'messageTemplateReview',templateId:hi.id,version:hi.version,state:'approved',reference:'SYNTHETIC-CONSENT',reason:'Neutral Hindi template reviewed for synthetic use'},200,crypto.randomUUID(),org);}
 report=await get(o,'/api/outreach',200,org);for(const existing of report.channels.filter(c=>c.kind==='sms'&&c.state!=='suspended'))await post(o,{type:'externalChannelReview',channelId:existing.id,version:existing.version,state:'suspended',reference:'SYNTHETIC-CONSENT-REPLACE',reason:'Replace prior readiness after fixture authority changes; preserve its history.'});const channelId=(await post(o,{type:'externalChannelPropose',kind:'sms',capabilities:{deliveryEvidence:true,optOutHandling:true,recoveryWork:true},reason:'Synthetic consent fixture requires independently reviewed channel readiness.'})).result.channelId;await post(a,{type:'externalChannelReview',channelId,version:1,state:'ready',reference:'SYNTHETIC-CONSENT-CHANNEL',reason:'Independent synthetic readiness review; no provider or credential configured.'});report=await get(o,'/api/outreach',200,org);const smsChannel=report.channels.find(c=>c.id===channelId);
 const prefs={method:'sms',destination:'TEST-CONSENT-001',ownership:'personal',language:'hi',timezone:new Date().getUTCHours()===23?'Etc/GMT+12':'UTC',from:'00:00',to:'23:59',permission:true,privateContact:false,reference:'SYNTHETIC-CONTACT'};
 await post(o,{type:'setContactPreferences',personId:pid,version:person(pid).version,preferences:prefs});
 check(()=>{const e=person(pid).consentHistory.at(-1);assert.equal(e.purpose,'contact');assert.equal(e.action,'granted');assert.equal(e.channel,'contact-preferences');assert.equal(e.reference,'SYNTHETIC-CONTACT');});
 const date=new Date(Date.now()+86400000).toISOString().slice(0,10);
 const planId=(await post(o,{type:'outreachCreate',title:'Consent synthetic outreach',date,teamId:'default',ownerId:o.id,personIds:[pid],criteria:'Synthetic case for the consent withdrawal exercise.'})).result.planId;
 await post(o,{type:'outreachTransition',planId,version:1,state:'scheduled',reason:'Schedule the synthetic consent exercise'});
 report=await get(o,'/api/outreach',200,org);const itemId=report.plans.find(p=>p.id===planId).items[0].id;
 const messageId=(await post(o,{type:'messageCreate',planId,itemId,templateId:hi.id,channelId:smsChannel.id,scheduledAt:new Date(Date.now()+86400000).toISOString()})).result.messageId;

 // Refusals: role, scope, schema, version and replay.
 const withdraw=(over={})=>({type:'withdrawConsent',personId:pid,version:person(pid).version,purpose:'exchange',channel:'in-person',reference:'FORM-CONSENT-1',reason:'Patient no longer wants records shared outside',...over});
 await get(o,'/api/workspace',200,org);
 for(const who of [a,s,w])await post(who,withdraw(),403,crypto.randomUUID(),org);
 await post(x,withdraw(),403,crypto.randomUUID(),org);
 await post(o,withdraw({reason:'short'}),422);await post(o,withdraw({channel:'email'}),422);await post(o,withdraw({version:1}),409);
 check(()=>assert.equal(person(pid).consentHistory.filter(e=>e.action==='withdrawn').length,0,'refused requests record nothing'));

 // Sharing withdrawal: each downstream item is stopped, awaiting a receipt, already sent or kept.
 const key=crypto.randomUUID(),body=withdraw();
 const done=await post(o,body,200,key);
 check(()=>{const r=done.result;assert.equal(r.purpose,'exchange');assert.equal(r.action,'withdrawn');assert.equal(r.stopped,5);assert.equal(r.alreadySent,1);assert.equal(r.inFlight,0);});
 const again=await post(o,body,200,key);check(()=>{assert.equal(again.replayed,true);assert.equal(again.result.eventId,done.result.eventId);});
 await post(o,withdraw(),409);
 const p=person(pid),e=p.consentHistory.at(-1),by=kind=>Object.fromEntries(e.items.filter(i=>i.kind===kind).map(i=>[i.ref,i.disposition]));
 check(()=>{assert.equal(p.exchangeConsent,false);assert.equal(e.by,o.id);assert.equal(e.channel,'in-person');assert.equal(e.reference,'FORM-CONSENT-1');assert.equal(e.toVersion,e.fromVersion+1);assert.equal(e.toVersion,p.consentVersion);});
 check(()=>{assert.deepEqual(by('programme-submission'),{[sub(mis.id).id]:'stopped',[sub('mis_maternal').id]:'already-sent'});assert.equal(sub(mis.id).state,'cancelled');assert.equal(sub('mis_maternal').state,'accepted');assert.equal(visit(v2).plan.state,'blocked');assert.deepEqual(by('programme-plan'),{[visit(v2).plan.id]:'stopped'});});
 check(()=>{assert.deepEqual(by('ehr-permission'),{[permissionId]:'stopped'});assert.equal(p.ehr.permissions.find(g=>g.id===permissionId).status,'revoked');assert.equal(p.ehr.links.find(l=>l.id===linkId).status,'active');});
 check(()=>{assert.deepEqual(by('abdm-consent'),{[granted]:'stopped',[requested]:'stopped'});assert.ok(p.abdmConsents.every(x=>x.status==='REVOKED'));assert.equal(Object.values(by('abdm-care-context'))[0],'kept');assert.equal(Object.values(by('abdm-received'))[0],'kept');});
 check(()=>assert.equal(e.items.some(i=>i.kind.startsWith('ai-')),false,'AI work is not part of a sharing withdrawal'));
 // Stopped work stays stopped.
 const held=await post(o,{type:'sendSubmission',submissionId:sub(mis.id).id});check(()=>assert.equal(held.result.state,'cancelled'));
 await post(o,{type:'abdmFetch',personId:pid,version:person(pid).version,consentId:granted},409);
 await post(o,grant,409);
 await post(o,{type:'preparePlan',visitId:v1,recipients:[mis.id]},409);

 // AI withdrawal by another care-team clinician; nothing was waiting on it here.
 await get(c,'/api/workspace',200,org);
 const aiDone=await post(c,withdraw({version:c.state.people.find(q=>q.id===pid).version,purpose:'ai',channel:'phone',reference:'CALL-CONSENT-2',reason:'Does not want the assistant used on her records'}),200,crypto.randomUUID(),org);
 await get(o,'/api/workspace',200,org);
 check(()=>{const e=person(pid).consentHistory.at(-1);assert.equal(aiDone.result.items,0);assert.equal(e.by,c.id);assert.equal(e.byName,c.state.user.displayName);assert.equal(e.role,'clinician');assert.equal(person(pid).aiConsent,false);});

 // Contact withdrawal: the draft reminder is cancelled and the preference is versioned.
 await post(o,withdraw({version:person(pid).version,purpose:'contact',channel:'written',reference:'LETTER-CONSENT-3',reason:'No more text reminders, please'}));
 report=await get(o,'/api/outreach',200,org);
 check(()=>{const e=person(pid).consentHistory.at(-1),m=report.messages.find(v=>v.id===messageId);assert.equal(m.state,'cancelled');assert.deepEqual(e.items.map(i=>[i.kind,i.ref,i.disposition]),[['outreach-message',messageId,'stopped']]);assert.equal(person(pid).contactPreferences.permission,false);assert.equal(e.toVersion,person(pid).contactPreferences.version);});
 await post(c,{type:'messageApprove',messageId,version:report.messages.find(v=>v.id===messageId).version,hash:'0'.repeat(64)},409,crypto.randomUUID(),org);

 // Traceability: history on the patient, audit rows and record revisions.
 check(()=>{const h=person(pid).consentHistory;assert.deepEqual(h.map(e=>`${e.purpose}:${e.action}`),['exchange:granted','ai:granted','contact:granted','exchange:withdrawn','ai:withdrawn','contact:withdrawn']);});
 check(()=>{const rows=sql.prepare("SELECT action,detail,actor_id FROM audit_events WHERE org_id=? AND person_id=? AND action='withdrawConsent' ORDER BY at").all(org,pid);assert.equal(rows.length,3);assert.match(rows[0].detail,/External record sharing permission withdrawn .*reference FORM-CONSENT-1\). 5 stopped, 0 awaiting a receipt, 1 already sent/);assert.equal(rows[1].actor_id,c.id);});
 check(()=>{const rev=sql.prepare("SELECT data FROM record_revisions WHERE org_id=? AND person_id=? AND entity_type='person' AND action='withdrawConsent' ORDER BY created_at").all(org,pid);assert.equal(rev.length,3);assert.equal(sql.prepare("SELECT count(*) AS n FROM record_revisions WHERE org_id=? AND person_id=? AND entity_type='visit' AND action='withdrawConsent'").get(org,pid).n,1,'the visit whose plan was blocked');assert.equal(JSON.parse(rev[0].data).consentHistory.at(-1).purpose,'exchange');});

 // An unsent assistant request, in a new organisation whose local assistant needs no capability review
 // (the shared test organisation's capabilities are changed by the governance suite).
 const mine=(await post(o,{type:'createOrganisation',name:`Consent AI organisation ${tag}`})).result.organisationId;
 const aid=(await post(o,{type:'createPerson',name:`Consent AI Synthetic ${tag}`,age:36,sex:'Female',village:'Consent locality',programme:'General care',teamId:'default'},200,undefined,mine)).result.personId;
 const mp=()=>o.state.people.find(q=>q.id===aid),mv=id=>o.state.visits.find(v=>v.id===id);
 await post(o,{type:'setConsent',personId:aid,purpose:'ai',active:true,version:mp().version},200,undefined,mine);
 const av=(await post(o,{type:'startVisit',personId:aid},200,undefined,mine)).result.visitId;
 const runId=(await post(o,{type:'prepareAgent',visitId:av,version:mv(av).version,providerId:'local',task:'extract',input:'Weight 58 kg'},200,undefined,mine)).result.runId;
 const stop=await post(o,{type:'withdrawConsent',personId:aid,version:mp().version,purpose:'ai',channel:'in-person',reference:'FORM-CONSENT-4',reason:'Does not want the assistant used'},200,undefined,mine);
 check(()=>{const e=mp().consentHistory.at(-1);assert.equal(stop.result.stopped,1);assert.deepEqual(e.items.map(i=>[i.kind,i.ref,i.disposition]),[['ai-request',runId,'stopped']]);assert.equal(mv(av).agentRuns[0].status,'cancelled');assert.match(mv(av).agentRuns[0].message,/Nothing was sent/);});
 const ran=await post(o,{type:'executeAgent',visitId:av,runId,inputHash:mv(av).agentRuns[0].inputHash},200,undefined,mine);check(()=>{assert.equal(ran.result.status,'cancelled');assert.equal(mv(av).agentRuns[0].callCount,0);});
 await post(o,{type:'switchOrganisation',organisationId:org},200,undefined,org);await get(o,'/api/workspace',200,org);
}
