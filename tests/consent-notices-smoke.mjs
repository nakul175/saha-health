import assert from 'node:assert/strict';
// Slice 14d (R90, BR-SEC-02): notice versions and permission expiry through the built Worker and local D1.
// Notices are published only in an organisation this suite creates, so no other suite's permissions need a notice.
// Expiry is reached by moving one recorded expiry into the past in the local database (synthetic records only); every
// decision after that is the Worker's own, evaluated when the permission is used.
export async function consentNoticesSmoke({get,post,check,accounts,org,sql}){
 const {owner:o,worker:w,supervisor:s,admin:a,clinician:c,stranger:x}=accounts;
 const tag=crypto.randomUUID().slice(0,6),DAY=86400000,days=e=>(Date.parse(e.expiresAt)-Date.parse(e.at))/DAY;
 const en='Saha can use an AI tool to summarise your confirmed visit facts. You can say no and your care continues.';
 const hi='सहा आपकी पुष्टि हुई विज़िट जानकारी का सारांश बनाने के लिए एआई उपकरण का उपयोग कर सकता है। आप मना कर सकते हैं।';
 const notice=(over={})=>({type:'publishConsentNotice',purpose:'ai',version:1,effectiveFrom:new Date().toISOString(),material:false,summary:'First reviewed AI notice (synthetic)',review:'Synthetic review REF-14D',texts:{en,hi},...over});
 // Moves the latest recorded expiry of a purpose one minute into the past (the record is otherwise unchanged).
 const expire=(orgId,pid,purpose)=>{const r=sql.prepare('SELECT data FROM patients WHERE org_id=? AND id=?').get(orgId,pid),d=JSON.parse(r.data),e=d.consentHistory.filter(x=>x.purpose===purpose).at(-1);assert.ok(e.expiresAt,'a grant with a recorded expiry');e.expiresAt=new Date(Date.now()-60000).toISOString();sql.prepare('UPDATE patients SET data=? WHERE org_id=? AND id=?').run(JSON.stringify(d),orgId,pid);};

 // Shared organisation: only an owner publishes, and nothing is published there.
 await get(o,'/api/workspace',200,org);
 for(const who of [w,s,a,c])await post(who,notice(),403,crypto.randomUUID(),org);
 await post(x,notice(),403,crypto.randomUUID(),org);
 await post(o,notice({texts:{}}),422,crypto.randomUUID(),org);await post(o,notice({purpose:'contact'}),422,crypto.randomUUID(),org);
 await get(o,'/api/workspace',200,org);check(()=>assert.deepEqual(o.state.consentNotices,[],'the shared organisation has no notices'));

 // Own organisation, owned by a fresh synthetic account (the shared owner already owns the most organisations allowed).
 const n={id:`notice-${tag}-owner`,headers:{'oai-authenticated-user-id':`notice-${tag}-owner`,'oai-authenticated-user-email':'owner@example.invalid'},state:null};
 await get(n);const mine=(await post(n,{type:'createOrganisation',name:`Notice organisation ${tag}`})).result.organisationId;
 const pid=(await post(n,{type:'createPerson',name:`Notice Synthetic ${tag}`,age:41,sex:'Female',village:'Notice locality',programme:'General care',teamId:'default'},200,undefined,mine)).result.personId;
 const person=()=>n.state.people.find(p=>p.id===pid),last=purpose=>person().consentHistory.filter(e=>e.purpose===purpose).at(-1);
 const audit=action=>sql.prepare('SELECT detail FROM audit_events WHERE org_id=? AND person_id=? AND action=? ORDER BY seq').all(mine,pid,action).map(r=>r.detail);
 // Before any notice: recorded with no notice version and the AI period, and the terms are audited before the decision.
 await post(n,{type:'setConsent',personId:pid,purpose:'ai',active:true,version:person().version},200,undefined,mine);
 check(()=>{const e=last('ai');assert.equal(e.notice,null);assert.equal(days(e),365);assert.equal(e.renews,undefined);});
 check(()=>{const rows=sql.prepare("SELECT action FROM audit_events WHERE org_id=? AND person_id=? AND action IN ('consentTerms','setConsent') ORDER BY seq").all(mine,pid);assert.deepEqual(rows.map(r=>r.action),['consentTerms','setConsent']);assert.match(audit('consentTerms')[0],/no notice is published for this purpose; expires \d{4}-\d\d-\d\d \(365 days\)\./);});
 // Version 1 (not material). A replay returns the same result; stale, skipped and past versions are refused.
 const key=crypto.randomUUID(),body=notice(),first=await post(n,body,200,key,mine),v1=first.result.noticeId;
 const again=await post(n,body,200,key,mine);check(()=>{assert.equal(again.replayed,true);assert.equal(again.result.noticeId,v1);});
 await post(n,notice(),409,undefined,mine);await post(n,notice({version:3}),409,undefined,mine);
 await post(n,notice({version:2,effectiveFrom:new Date(Date.now()-3600000).toISOString()}),422,undefined,mine);
 await get(n,'/api/workspace',200,mine);
 check(()=>{const list=n.state.consentNotices;assert.equal(list.length,1);assert.equal(list[0].version,1);assert.equal(list[0].texts.hi,hi);assert.equal(list[0].material,false);assert.equal(list[0].publishedBy,n.id);});
 check(()=>{const r=sql.prepare("SELECT detail FROM audit_events WHERE org_id=? AND action='publishConsentNotice'").all(mine);assert.equal(r.length,1);assert.match(r[0].detail,/Optional AI assistance notice version 1 published \(English and Hindi\)/);});
 // A version that is not material leaves the earlier permission in force: the record assistant still accepts it.
 const vid=(await post(n,{type:'startVisit',personId:pid},200,undefined,mine)).result.visitId,visit=()=>n.state.visits.find(v=>v.id===vid);
 const prepare=status=>post(n,{type:'prepareAgent',visitId:vid,version:visit().version,providerId:'local',task:'extract',input:'Weight 58 kg'},status,undefined,mine);
 await prepare(200);
 // Giving permission now needs the notice shown and the language it was shown in.
 const give=(over={},status=200)=>post(n,{type:'setConsent',personId:pid,purpose:'ai',active:true,version:person().version,...over},status,undefined,mine);
 const missing=await give({},409);check(()=>assert.match(missing.error,/current optional ai assistance notice \(version 1\)/));
 await give({notice:{id:'unknown',language:'en'}},409);await give({notice:{id:v1,language:'fr'}},422);await give({notice:{id:v1}},422);
 const before=last('ai');await give({notice:{id:v1,language:'hi'}});
 check(()=>{const e=last('ai');assert.deepEqual(e.notice,{id:v1,version:1,language:'hi'});assert.deepEqual(e.renews,{eventId:before.id,state:'in-force'});assert.match(audit('consentTerms').at(-1),/given under notice version 1 \(Hindi\)/);});
 // Version 2 is material and in force at once: the permission given under version 1 stops authorising until renewed.
 const second=await post(n,notice({version:2,material:true,summary:'Adds a second synthetic AI tool (material)',texts:{en:en+' A second synthetic tool may be used.'}}),200,undefined,mine),v2=second.result.noticeId;
 const stale=await prepare(409);check(()=>assert.match(stale.error,/earlier notice, and a material change took effect/));
 await give({notice:{id:v1,language:'en'}},409);await give({notice:{id:v2,language:'hi'}},422);
 await give({notice:{id:v2,language:'en'}});
 check(()=>{const e=last('ai');assert.equal(e.notice.version,2);assert.equal(e.renews.state,'renewal-needed');});
 await prepare(200);
 // Expiry: once the recorded end has passed the permission no longer authorises AI use; renewal records the lapse.
 expire(mine,pid,'ai');await get(n,'/api/workspace',200,mine);
 const lapsed=await prepare(409);check(()=>assert.match(lapsed.error,/AI assistance permission expired on \d{4}-\d\d-\d\d\. Renew it/));
 await give({notice:{id:v2,language:'en'}});
 check(()=>{assert.equal(last('ai').renews.state,'expired');assert.match(audit('consentTerms').at(-1),/which had expired\./);});
 await prepare(200);
 // Sharing: no sharing notice is published, so the permission records none and the sharing period (180 days).
 await post(n,{type:'setConsent',personId:pid,purpose:'exchange',active:true,version:person().version},200,undefined,mine);
 check(()=>{const e=last('exchange');assert.equal(e.notice,null);assert.equal(days(e),180);});
 // An expired sharing permission stops a new EHR permission; renewing it allows it again.
 await post(n,{type:'registerIntegration',name:`Notice FHIR ${tag}`,kind:'ehr',endpoint:'https://ehr.example/fhir-notice',credentialBinding:'SAHA_EHR_TEST',description:'Test-only adapter'},200,undefined,mine);
 const ehr=n.state.integrations.find(i=>i.name===`Notice FHIR ${tag}`);await post(n,{type:'configureEhr',integrationId:ehr.id,version:ehr.version,read:true,write:true},200,undefined,mine);
 const linkId=(await post(n,{type:'linkEhr',personId:pid,version:person().version,integrationId:ehr.id,externalId:`notice-${tag}`,externalName:'Notice Person',confirmed:true,reason:'Verified from synthetic fixture'},200,undefined,mine)).result.linkId;
 const grant=()=>({type:'grantEhrPermission',personId:pid,linkId,direction:'write',purpose:'care-coordination',from:'2026-09-01T00:00:00.000Z',to:new Date().toISOString(),expiresAt:new Date(Date.now()+DAY).toISOString()});
 expire(mine,pid,'exchange');await get(n,'/api/workspace',200,mine);
 const ehrRefused=await post(n,grant(),409,undefined,mine);check(()=>assert.match(ehrRefused.error,/External record sharing permission expired on/));
 await post(n,{type:'setConsent',personId:pid,purpose:'exchange',active:true,version:person().version},200,undefined,mine);
 check(()=>assert.equal(last('exchange').renews.state,'expired'));
 await post(n,grant(),200,undefined,mine);
 // Out of scope: people outside this organisation cannot record permissions or publish here.
 await post(w,{type:'setConsent',personId:pid,purpose:'ai',active:true,version:person().version,notice:{id:v2,language:'en'}},403,crypto.randomUUID(),mine);
 await post(x,notice({version:3}),403,crypto.randomUUID(),mine);
 // Withdrawing an expired permission is always recorded (stopping is the safe direction) and needs no notice.
 expire(mine,pid,'ai');
 await post(n,{type:'withdrawConsent',personId:pid,version:person().version,purpose:'ai',channel:'in-person',reference:'FORM-14D',reason:'Does not want the assistant used any more'},200,undefined,mine);
 check(()=>{assert.equal(person().aiConsent,false);assert.equal(last('ai').action,'withdrawn');});
 await prepare(409);

 // Shared organisation: automated contact expires and is renewed by saving the contact preferences with permission.
 await get(o,'/api/workspace',200,org);
 const cid=(await post(o,{type:'createPerson',name:`Contact Synthetic ${tag}`,age:33,sex:'Female',village:'Contact locality',programme:'General care',teamId:'default'})).result.personId;
 const cp=()=>o.state.people.find(p=>p.id===cid),clast=()=>cp().consentHistory.filter(e=>e.purpose==='contact').at(-1);
 const prefs={method:'sms',destination:'TEST-NOTICE-001',ownership:'personal',language:'hi',timezone:new Date().getUTCHours()===23?'Etc/GMT+12':'UTC',from:'00:00',to:'23:59',permission:true,privateContact:false,reference:'SYN-CONTACT-14D'};
 await post(o,{type:'setContactPreferences',personId:cid,version:cp().version,preferences:prefs});
 check(()=>{const e=clast();assert.equal(e.action,'granted');assert.equal(days(e),365);assert.equal(e.notice,undefined);});
 let report=await get(o,'/api/outreach',200,org);let template=report.templates.find(t=>t.language==='hi');
 if(!template){await post(o,{type:'messageTemplatePropose',language:'hi'});report=await get(o,'/api/outreach',200,org);template=report.templates.find(t=>t.language==='hi');}
 if(template.state!=='approved'){await post(a,{type:'messageTemplateReview',templateId:template.id,version:template.version,state:'approved',reference:'SYNTHETIC-NOTICE',reason:'Neutral Hindi template reviewed for synthetic use'},200,crypto.randomUUID(),org);report=await get(o,'/api/outreach',200,org);template=report.templates.find(t=>t.language==='hi');}
 const date=new Date(Date.now()+DAY).toISOString().slice(0,10);
 const planId=(await post(o,{type:'outreachCreate',title:'Notice synthetic outreach',date,teamId:'default',ownerId:o.id,personIds:[cid],criteria:'Synthetic case for the contact expiry exercise.'})).result.planId;
 await post(o,{type:'outreachTransition',planId,version:1,state:'scheduled',reason:'Schedule the synthetic contact expiry exercise'});
 report=await get(o,'/api/outreach',200,org);const itemId=report.plans.find(p=>p.id===planId).items[0].id;
 const message=()=>({type:'messageCreate',planId,itemId,templateId:template.id,scheduledAt:new Date(Date.now()+DAY).toISOString()});
 expire(org,cid,'contact');await get(o,'/api/workspace',200,org);
 const contactRefused=await post(o,message(),409);check(()=>assert.match(contactRefused.error,/Automated contact permission expired on .*saving the contact preferences with permission/));
 await post(o,{type:'setContactPreferences',personId:cid,version:cp().version,preferences:prefs});
 check(()=>{const e=clast();assert.equal(e.action,'granted');assert.equal(e.renews.state,'expired');assert.equal(days(e),365);});
 const created=(await post(o,message())).result.messageId;
 report=await get(o,'/api/outreach',200,org);const m=report.messages.find(v=>v.id===created);
 await post(o,{type:'messageCancel',messageId:created,version:m.version,reason:'Synthetic contact expiry exercise finished'});
}
