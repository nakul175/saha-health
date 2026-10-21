import {startMiniflare} from './lib/miniflare.mjs';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {identity,client} from './lib/worker.mjs';
let worker,browser,passed=0,browserPassed=0;const evidence='tests/reports/reminder-optout-current';mkdirSync(evidence,{recursive:true});
const check=f=>{f();passed++},secret='synthetic-only-mock-callback-secret-at-least-32-characters',vars={SAHA_ENVIRONMENT:'synthetic',SAHA_EXTERNAL_APIS_ENABLED:'false',SAHA_REMINDER_MOCK_CALLBACK_ENABLED:'true',SAHA_REMINDER_MOCK_CALLBACK_GRANTS:'[]',SAHA_REMINDER_MOCK_HTTP_KEY:secret};
try{
 worker=await startMiniflare({port:process.env.SAHA_OPTOUT_PORT??8848,name:'saha-reminder-optout',bindings:vars,assetsFirst:true});const api=client(worker.base,{connectionClose:true}),run=crypto.randomUUID().slice(0,8),owner=identity('owner',run,'Synthetic Owner'),asha=identity('asha',run,'Synthetic ASHA'),admin=identity('admin',run,'Synthetic Admin'),reviewer=identity('reviewer',run,'Synthetic Supervisor'),other=identity('other',run,'Synthetic Other');
 const own=(await api.get(owner,'/api/workspace')).json,org=own.organisation.id;
 const command=async(who,c,status=200)=>{const r=await api.command(who,c,org);assert.equal(r.status,status,r.text);passed++;return r.json};
 const joinMember=async(who,role)=>{const w=(await api.get(who,'/api/workspace')).json,invite=await command(owner,{type:'createInvite',accountCode:w.user.accountCode,label:'Synthetic '+role,role,teamIds:['default']});assert.equal((await api.command(who,{type:'joinOrganisation',token:invite.result.token})).status,200);return w.user.userId;};
 const ashaId=await joinMember(asha,'asha');await joinMember(admin,'admin');await joinMember(reviewer,'supervisor');await joinMember(other,'asha');
 const p=own.people.find(p=>p.name==='Meena Devi');await command(owner,{type:'assignPatient',personId:p.id,version:p.version,teamId:'default',assignedTo:ashaId,reason:'Synthetic opt-out callback scope test'});
 const preferences={method:'sms',destination:'TEST-OPTOUT-001',ownership:'personal',language:'en',timezone:new Date().getUTCHours()===23?'Etc/GMT+12':'UTC',from:'00:00',to:'23:59',permission:true,privateContact:false,reference:'SYNTHETIC-OPTOUT'};
 const setPrefs=async(prefs=preferences)=>{const w=(await api.get(owner,'/api/workspace',org)).json,person=w.people.find(x=>x.id===p.id);await command(owner,{type:'setContactPreferences',personId:p.id,version:person.version,preferences:prefs});};
 await setPrefs();const template=(await command(owner,{type:'messageTemplatePropose',language:'en'})).result.templateId;
 await command(admin,{type:'messageTemplateReview',templateId:template,version:1,state:'approved',reference:'SYNTHETIC-TEMPLATE',reason:'Independent synthetic template review'});
 const channel=(await command(owner,{type:'externalChannelPropose',kind:'sms',capabilities:{deliveryEvidence:true,optOutHandling:true,recoveryWork:true},reason:'Synthetic opt-out fixture requires reviewed channel readiness.'})).result.channelId;await command(admin,{type:'externalChannelReview',channelId:channel,version:1,state:'ready',reference:'SYNTHETIC-OPTOUT-CHANNEL',reason:'Independent synthetic readiness review; no provider or credential configured.'});
 const plan=(await command(owner,{type:'outreachCreate',title:'Synthetic callback plan',date:new Date().toISOString().slice(0,10),teamId:'default',ownerId:ashaId,personIds:[p.id],criteria:'Synthetic callback reminder lifecycle checks'})).result.planId;
 await command(owner,{type:'outreachTransition',planId:plan,version:1,state:'scheduled',reason:'Schedule synthetic callback lifecycle'});
 const outreach=async()=>{const r=await api.get(owner,'/api/outreach',org);assert.equal(r.status,200,r.text);return r.json};let out=await outreach();const item=out.plans.find(x=>x.id===plan).items[0].id;
 const sent=(await command(owner,{type:'messageCreate',planId:plan,itemId:item,templateId:template,channelId:channel,scheduledAt:new Date(Date.now()-1000).toISOString()})).result.messageId;
 out=await outreach();const draft=out.messages.find(x=>x.id===sent);await command(reviewer,{type:'messageApprove',messageId:sent,version:1,hash:draft.preview.hash});
 const sentResult=(await command(owner,{type:'messageSimulate',messageId:sent,version:2,outcome:'simulated'})).result;
 const pending=(await command(owner,{type:'messageCreate',planId:plan,itemId:item,templateId:template,channelId:channel,scheduledAt:new Date(Date.now()+86400000).toISOString()})).result.messageId;
 out=await outreach();const terminal=structuredClone(out.messages.find(x=>x.id===sent));
 vars.SAHA_REMINDER_MOCK_CALLBACK_GRANTS=JSON.stringify([{organisationId:org,provider:'mock-reminder',secretBinding:'SAHA_REMINDER_MOCK_HTTP_KEY'}]);await worker.stop();worker=await startMiniflare({port:process.env.SAHA_OPTOUT_PORT??8848,name:'saha-reminder-optout',fresh:false,bindings:vars,assetsFirst:true});
 const pref=(await api.get(owner,'/api/workspace',org)).json.people.find(x=>x.id===p.id).contactPreferences,event={provider:'mock-reminder',organisationId:org,eventId:'http_'+crypto.randomUUID().replaceAll('-',''),destination:preferences.destination,preferenceVersion:pref.version,occurredAt:new Date().toISOString(),action:'STOP'};
 const call=async(who,body,path='/api/reminder-optout',headers={},status=200)=>{const r=await api.call(who,path,{method:'POST',body,org,headers});assert.equal(r.status,status,r.text);passed++;return r.json};
 const signature=async(body,timestamp)=>{const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(timestamp+'.'+JSON.stringify(body)))).toString('hex');};
 const signed=async(body,status=200,ts=String(Date.now()))=>call(null,body,'/api/reminder-optout/callback',{'x-saha-timestamp':ts,'x-saha-signature':await signature(body,ts)},status);
 await call(null,event,'/api/reminder-optout',{},401);await call(other,event,'/api/reminder-optout',{},403);await call(admin,event,'/api/reminder-optout',{},403);
 await call(asha,event,'/api/reminder-optout',{Origin:'https://untrusted.example.invalid'},403);await call(asha,event,'/api/reminder-optout',{'sec-fetch-site':'cross-site'},403);
 await call(owner,event,'/api/reminder-optout/callback',{},401);await call(null,event,'/api/reminder-optout/callback',{'x-saha-timestamp':String(Date.now()),'x-saha-signature':'0'.repeat(64)},401);
 await signed({...event,organisationId:'org_unknown'},401);await signed(event,401,String(Date.now()-600000));
 await signed({...event,eventId:'old_event_001',occurredAt:new Date(Date.now()-2*86400000).toISOString()},409);
 await signed({...event,eventId:'wrong_pref_001',preferenceVersion:pref.version+1},409);
 const result=await signed(event);check(()=>{assert.equal(result.cancelled,1);assert.equal(result.realMessageSent,false);assert.match(result.receipt,/^SIM-OPTOUT-/)});
 const replay=await signed(event);check(()=>{assert.equal(replay.replayed,true);assert.equal(replay.receipt,result.receipt)});
 await signed({...event,destination:'TEST-OTHER-001'},409);
 out=await outreach();const terminalAfter=out.messages.find(x=>x.id===sent),pendingAfter=out.messages.find(x=>x.id===pending);
 check(()=>assert.equal(pendingAfter.state,'cancelled'));check(()=>assert.equal(terminalAfter.state,'simulated'));check(()=>assert.deepEqual(terminalAfter.attempts,terminal.attempts));check(()=>assert.equal(terminalAfter.attempts[0].receipt,sentResult.receipt));
 let patient=(await api.get(owner,'/api/workspace',org)).json.people.find(x=>x.id===p.id);
 check(()=>assert.equal(patient.contactPreferences.permission,false));check(()=>assert.equal(patient.reminderOptouts.length,1));check(()=>assert.equal(patient.reminderOptouts[0].before.permission,true));check(()=>assert.equal(patient.reminderOptouts[0].after.permission,false));check(()=>assert.equal(patient.consentHistory.at(-1).reference,result.receipt));
 // Saved provider receipts remain replayable after the contact changes; a new stale event cannot withdraw the replacement contact.
 await setPrefs({...preferences,destination:'TEST-REPLACEMENT-001'});const lateReplay=await signed(event);check(()=>assert.equal(lateReplay.receipt,result.receipt));await signed({...event,eventId:'late_old_contact'},409);
 {
  const {chromium}=await import(process.env.SAHA_BROWSER_PACKAGE??'@playwright/test');browser=await chromium.launch({headless:true,...(process.env.SAHA_CHROMIUM?{executablePath:process.env.SAHA_CHROMIUM}:{})});
  const context=await browser.newContext({viewport:{width:1280,height:900},extraHTTPHeaders:asha.headers}),page=await context.newPage();
  await page.goto(worker.base+'/');await page.getByRole('button',{name:'Outreach',exact:true}).click();await page.getByRole('tab',{name:'Contact preferences',exact:true}).click();
  await page.getByRole('combobox',{name:'Opt-out simulation patient'}).selectOption(p.id);await page.getByRole('button',{name:'Simulate incoming STOP'}).click();
  await page.getByText(/Mock opt-out recorded · SIM-OPTOUT-/).waitFor();browserPassed++;passed++;
  await page.screenshot({path:evidence+'/outreach-optout.png',fullPage:true});
  const afterUi=(await api.get(owner,'/api/workspace',org)).json.people.find(x=>x.id===p.id);check(()=>assert.equal(afterUi.contactPreferences.permission,false));browserPassed++;
  await browser.close();browser=null;
 }
 patient=(await api.get(owner,'/api/workspace',org)).json.people.find(x=>x.id===p.id);const staffEvent={...event,eventId:'staff_'+crypto.randomUUID().replaceAll('-',''),destination:'TEST-REPLACEMENT-001',preferenceVersion:patient.contactPreferences.version,occurredAt:new Date().toISOString()};
 const staffResult=await call(asha,staffEvent);check(()=>assert.equal(staffResult.realMessageSent,false));const staffReplay=await call(asha,staffEvent);check(()=>assert.equal(staffReplay.receipt,staffResult.receipt));
 // Revocation rechecks patient scope even for a saved event receipt.
 patient=(await api.get(owner,'/api/workspace',org)).json.people.find(x=>x.id===p.id);await command(owner,{type:'assignPatient',personId:p.id,version:patient.version,teamId:'default',assignedTo:own.user.userId,reason:'Synthetic callback receipt replay scope revoked'});await call(asha,staffEvent,'/api/reminder-optout',{},403);
 const files=readdirSync('.wrangler/saha-reminder-optout-state',{recursive:true}).filter(f=>f.endsWith('.sqlite')&&!f.includes('cache')&&!f.endsWith('metadata.sqlite'));assert.equal(files.length,1);const sql=new DatabaseSync(join('.wrangler/saha-reminder-optout-state',files[0]),{readOnly:true});
 const saved=JSON.parse(sql.prepare('SELECT data FROM patients WHERE org_id=? AND id=?').get(org,p.id).data);
 check(()=>assert.equal(saved.reminderOptouts.length,2+(browserPassed?1:0)));check(()=>assert.equal(sql.prepare("SELECT count(*) AS n FROM command_receipts WHERE org_id=? AND actor_id=?").get(org,'mock_reminder_optout_'+org).n,2+(browserPassed?1:0)));check(()=>assert.equal(sql.prepare("SELECT count(*) AS n FROM audit_events WHERE org_id=? AND action='reminderOptout'").get(org).n,2+(browserPassed?1:0)));
 const savedMessages=JSON.parse(sql.prepare('SELECT data FROM outreach WHERE org_id=?').get(org).data);check(()=>assert.equal(savedMessages.messages.find(x=>x.id===sent).attempts[0].receipt,sentResult.receipt));sql.close();
 const report={date:'2026-10-11',passed,failed:0,browserPassed,scope:'Actual local Worker/D1 routes; HMAC, forged/expired/stale/replayed events, care scope, durable receipts, preference/consent history and immutable simulated delivery attempts; no real messages'};writeFileSync(evidence+'/http-result.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}catch(e){writeFileSync(evidence+'/http-result.json',JSON.stringify({date:'2026-10-11',passed,failed:1,error:String(e)},null,2)+'\n');throw e;}finally{await browser?.close();await worker?.stop();}
