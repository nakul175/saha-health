// Slice 14a: the differencing ledger records an aggregate alert projection only when it is actually shown or sent.
// Evaluation after every command used to write 24 disclosure profiles per recipient even when nobody saw an alert, so a
// first ordinary owner indicator query was refused in any organisation of five or more people with recent activity.
// Real Worker + local D1 in Miniflare, synthetic data only, no external delivery.
import assert from 'node:assert/strict';import {mkdirSync,writeFileSync} from 'node:fs';import {createHash} from 'node:crypto';import {identity,client} from './lib/worker.mjs';import {startMiniflare} from './lib/miniflare.mjs';
const out=process.env.SAHA_ALERT_OUT??'tests/evidence/alert-capture-ledger/http';mkdirSync(out,{recursive:true});
const w=await startMiniflare({port:20731,name:'alert-capture-ledger',bindings:{SAHA_EXTERNAL_APIS_ENABLED:'false'}});let passed=0;const check=(v,msg)=>{assert.ok(v,msg);passed++;};
try{const api=client(w.base),db=await w.mf.getD1Database('DB');
 const family=org=>createHash('sha256').update(JSON.stringify('saha-indicator-release:'+org+':human-live-aggregate-family:v1')).digest('hex').slice(0,20);
 const ledger=async org=>{const r=await db.prepare("SELECT json_extract(data,'$.indicatorReleases') AS v FROM operations WHERE org_id=?").bind(org).first();return r?.v?JSON.parse(r.v):[];};
 const live=async org=>(await ledger(org)).filter(r=>r.v===family(org));
 // An organisation whose owner reports on `reach` teams; `sizes` people per team, each with a confirmed visit and an undated referral.
 const fixture=async(label,sizes,reach=null)=>{
  const o=identity('capture-ledger-'+label),org=(await api.get(o,'/api/workspace')).json.organisation.id;
  const cmd=async(body,status=200)=>{const r=await api.command(o,body,org);check(r.status===status,r.text);return r.json;},snap=async()=>(await api.get(o,'/api/workspace',org)).json;
  const teams=[];for(let i=0;i<sizes.length;i++)teams.push((await cmd({type:'createTeam',name:`Synthetic capture ${label} ${i}`})).result.teamId);
  const scopeTo=async ids=>{const s=await snap(),m=s.members.find(x=>x.userId===o.id);await cmd({type:'updateMember',userId:o.id,version:m.version,role:'clinician',teamIds:ids,isOwner:true,status:'active',reason:'Synthetic capture ledger scope'});};
  await scopeTo(teams);let n=0;const names=['Amber Lynx','Blue Panda','Copper Finch','Dune Wolf','Elm Heron','Forest Otter','Garnet Ibis'];
  for(let t=0;t<sizes.length;t++)for(let i=0;i<sizes[t];i++){
   const pid=(await cmd({type:'createPerson',name:names[n],age:22+n*3,sex:'Unknown',village:'Synthetic locality '+n,programme:'General care',teamId:teams[t]})).result.personId,vid=(await cmd({type:'startVisit',personId:pid})).result.visitId;
   let s=await snap(),v=s.visits.find(x=>x.id===vid);await cmd({type:'saveVisit',visitId:vid,version:v.version,facts:{date:new Date().toISOString().slice(0,16),weight:'55',systolic:'',diastolic:'',temperature:'',weeks:'',coughDays:'',notes:'Synthetic capture ledger source',source:'reported'}});
   s=await snap();v=s.visits.find(x=>x.id===vid);await cmd({type:'confirmVisit',visitId:vid,version:v.version,patientCheck:{personId:pid,personVersion:s.people.find(x=>x.id===pid).version,confirmed:true}});
   await cmd({type:'createReferral',visitId:vid,facility:'Synthetic capture facility',reason:'Synthetic undated referral'});n++;}
  // The last command is organisation-wide, so the command evaluation sees every referral (patient-scoped commands wait for the next read).
  await scopeTo((reach??teams.map((_,i)=>i)).map(i=>teams[i]));
  return {o,org,teams,cmd,snap,scopeTo};};
 const indicator=(f,days=30)=>api.call(f.o,'/api/indicators',{method:'POST',org:f.org,body:{ids:'visits-confirmed',days,group:'none'}});

 // (1) Commands evaluate alerts, open occurrences and write durable notifications, but nothing was shown, so nothing is recorded.
 const a=await fixture('unseen',[6]);
 check((await db.prepare("SELECT count(*) n FROM alert_occurrences WHERE org_id=? AND alert_id='referrals-undated'").bind(a.org).first()).n===1,'Command evaluation still opens the clinical occurrence');
 check((await db.prepare("SELECT count(*) n FROM alert_notifications WHERE org_id=? AND alert_id='referrals-undated'").bind(a.org).first()).n>=1,'Command evaluation still creates the (never displayed) clinical notification');
 check((await live(a.org)).length===0,'An alert computed but shown to nobody records no disclosure profile');
 const first=await indicator(a);check(first.status===200,'First ordinary owner 30-day indicator query succeeds after commands: '+first.text);

 // (2) The same sequence where the owner really sees the alert: the recorded view still blocks a query that differences to one person.
 const seen=await fixture('seen',[1,5]);
 check((await live(seen.org)).length===0,'No profile before the alert is viewed');
 const view=await api.get(seen.o,'/api/alerts',seen.org);
 check(view.status===200&&view.json.currentAggregateAlerts.some(x=>x.id==='referrals-undated'&&x.count===6),'Owner is shown the six-person clinical alert count');
 // (3) What was shown is recorded.
 const rows=await live(seen.org);check(rows.length>0&&rows.every(r=>r.b&&Object.keys(r.b.units).length===6),'The shown alert is recorded as hashed six-person disclosure profiles');
 await seen.scopeTo([seen.teams[1]]);
 const blocked=await indicator(seen,7);check(blocked.status===422&&/fewer than 5/.test(blocked.text),'After a shown alert, narrowing to five people would reveal a one-person remainder: still refused');
 const control=await fixture('control',[1,5],[1]);check((await live(control.org)).length===0,'Control: same history without a view records nothing');
 const ok=await indicator(control,7);check(ok.status===200,'Control: the same narrowed owner query is allowed when no alert was ever shown: '+ok.text);

 // The owner channel read is the other display surface and records in the same way.
 const ch=await fixture('channel',[6]);const chBefore=(await live(ch.org)).length;const chRead=await api.get(ch.o,'/api/notification-channel',ch.org);
 check(chRead.status===200&&chRead.json.currentAggregateAlerts.some(x=>x.id==='referrals-undated'),'Owner channel read shows the current clinical alert');
 check(chBefore===0&&(await live(ch.org)).length>0,'The channel read records what it showed');

 // A simulator message that carries a clinical alert is a disclosure to its recipient and is recorded when it is committed.
 const msg=await fixture('message',[6]);
 await msg.cmd({type:'setNotificationChannel',version:0,enabled:true,escalateAfterMinutes:5,reason:'Synthetic local simulator capture ledger',recipients:[{userId:msg.o.id,tier:1,channel:'email',kinds:['referrals-undated']}]});
 const sent=(await db.prepare("SELECT count(*) n FROM notification_messages WHERE org_id=? AND alert_id='referrals-undated'").bind(msg.org).first()).n;
 check(sent===1,'Simulator message carrying the clinical alert is sent once');check((await live(msg.org)).length>0,'A sent clinical alert message is recorded as a disclosure');

 // F1: the simulator audit event carries no clinical count, so an admin or a narrower-scope member reading the audit log sees none.
 const sideTeam=(await msg.cmd({type:'createTeam',name:'Synthetic capture side team'})).result.teamId;
 const join=async(label,role,teamIds)=>{const who=identity('capture-ledger-'+label),h=(await api.get(who,'/api/workspace')).json,inv=(await msg.cmd({type:'createInvite',accountCode:h.user.accountCode,label:'Synthetic '+label,role,teamIds})).result;await api.command(who,{type:'joinOrganisation',token:inv.token},msg.org);return who;};
 const adminWho=await join('audit-admin','admin',[]),narrow=await join('audit-narrow','supervisor',[sideTeam]);
 const ownerAudit=await api.get(msg.o,'/api/audit',msg.org);check(ownerAudit.status===200&&/notificationSent/.test(ownerAudit.text)&&/referrals-undated/.test(ownerAudit.text),'The simulator audit event for the clinical alert exists');
 for(const who of [msg.o,adminWho,narrow]){const r=await api.get(who,'/api/audit',msg.org);check(r.status===200&&!/referrals-undated[^"]{0,40}count \d/.test(r.text)&&!/, count \d+\. Receipt/.test(r.text),'No audit reader sees a clinical count in the notificationSent detail');}
 // (4) Compare-and-swap behaviour is unchanged: concurrent views both succeed and leave a valid ledger; a ledger write fault shows nothing.
 const race=await fixture('race',[6]);const pair=await Promise.all([api.get(race.o,'/api/alerts',race.org),api.get(race.o,'/api/alerts',race.org)]);
 check(pair.every(r=>r.status===200)&&pair.every(r=>r.json.currentAggregateAlerts.some(x=>x.count===6)),'Concurrent identical views both show the alert');
 const rl=await ledger(race.org);check(rl.length>0&&rl.every(r=>/^[a-f0-9]{20}$/.test(r.k))&&(await live(race.org)).length===rl.length,'Concurrent views leave a well-formed ledger');
 const fault=await fixture('fault',[6]);await fault.cmd({type:'opsIncident',version:0,title:'Synthetic nonclinical critical alert',severity:'critical',ownerId:fault.o.id});check((await db.prepare('SELECT count(*) n FROM operations WHERE org_id=?').bind(fault.org).first()).n===1,'The operations row exists, so the ledger write is an update');await db.prepare(`CREATE TRIGGER capture_ledger_fault BEFORE UPDATE ON operations WHEN NEW.org_id='${fault.org}' BEGIN SELECT RAISE(ABORT,'synthetic ledger unavailable'); END`).run();
 const f1=await api.get(fault.o,'/api/alerts',fault.org);check(f1.status===200&&f1.json.currentAggregateAlerts.length===0&&!f1.json.aggregatePrivacy.currentAvailable,'A ledger write fault yields unavailable and shows no count');
 await db.prepare('DROP TRIGGER capture_ledger_fault').run();const f2=await api.get(fault.o,'/api/alerts',fault.org);check(f2.status===200&&f2.json.currentAggregateAlerts.some(x=>x.count===6),'Recovers once the ledger is writable');
 writeFileSync(out+'/result.json',JSON.stringify({passed,failed:0,actualWorker:true,noExternalDelivery:true},null,2)+'\n');console.log(JSON.stringify({passed,failed:0}));
}finally{await w.stop();}
