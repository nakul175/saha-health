// SAHA037/APL220: real native synthetic D1/HTTP/read-only mobile status.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, rmSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { connect } from 'node:net';
import { chromium } from '@playwright/test';
import { startMiniflare } from '../lib/miniflare.mjs';
import { identity, client } from '../lib/worker.mjs';
const folder = process.env.SAHA_PROGRAMME_STATUS_OUTPUT ?? 'tests/reports/programme-status-browser';
mkdirSync(folder, { recursive: true });
const state = resolve(join(tmpdir(), 'saha-programme-status-' + randomUUID()));
const checks = [], requests = [], external = [], errors = [], races = [];
const check = (value, name) => { assert.ok(value, name); checks.push(name); console.log('PASS', name); };
const ok = r => { assert.equal(r.status, 200, r.text); return r.json; };
const hash = s => createHash('sha256').update(s).digest('hex');
const literal = value => "'" + String(value).replaceAll("'", "''") + "'";
let worker, browser, database, page, failure, disposed = false, activeTrigger, beforeTables, afterTables;
const custody=()=>{const files=[];const walk=p=>{for(const name of readdirSync(p)){const f=join(p,name);if(statSync(f).isDirectory())walk(f);else files.push(f);}};for(const p of ['app','lib','dist'])walk(p);files.push('tests/programme-status-contract.mjs','tests/smoke/programme-status-browser.mjs');return Object.fromEntries(files.sort().map(f=>[f,hash(readFileSync(f))]));};
const beforeCustody=custody();let afterCustody,portFree;
try {
  worker = await startMiniflare({ port: process.env.SAHA_TEST_PORT ?? 21743, name: 'programme-status-browser', state, assetsFirst: true });
  database = await worker.mf.getD1Database('DB');
  const api = client(worker.base), run = randomUUID().slice(0,8), owner = identity('owner',run), asha = identity('asha',run), outsider = identity('outsider',run);
  const org = ok(await api.get(owner,'/api/workspace')).organisation.id;
  const account = ok(await api.get(asha,'/api/workspace'));
  const foreignOrg = ok(await api.get(outsider,'/api/workspace')).organisation.id;
  const invitation = ok(await api.command(owner,{type:'createInvite',accountCode:account.user.accountCode,label:'Synthetic programme status worker',role:'asha',teamIds:['default']},org));
  ok(await api.command(asha,{type:'joinOrganisation',token:invitation.result.token}));
  const person = () => api.get(owner,'/api/workspace',org).then(ok).then(w=>w.people.find(p=>p.id==='p_meena'));
  const assign = async () => { const p=await person();ok(await api.command(owner,{type:'assignPatient',personId:p.id,version:p.version,teamId:'default',assignedTo:asha.id,reason:'Synthetic programme status selection'},org)); };
  await assign();
  const episodes={};
  for(const packId of ['maternal','tb','hypertension']){const p=await person();episodes[packId]=ok(await api.command(asha,{type:'enrolProgramme',personId:p.id,version:p.version,packId,episodeLabel:'Synthetic '+packId+' episode',startDate:null},org)).result.enrolmentId;}
  // Existing seeded demonstration adapter only; no new provider or network.
  const checkpointTrigger='qa_programme_checkpoint_before_adapter';activeTrigger=checkpointTrigger;
  await database.prepare(`CREATE TRIGGER ${checkpointTrigger} BEFORE INSERT ON audit_events WHEN NEW.org_id=${literal(org)} AND NEW.action='requestDestinationEnrolment' BEGIN SELECT CASE WHEN EXISTS(SELECT 1 FROM patients p,json_each(p.data,'$.enrolments') e WHERE p.org_id=NEW.org_id AND p.id=NEW.person_id AND json_extract(e.value,'$.id')=NEW.subject AND json_extract(e.value,'$.destinationEnrolment.state')='requested' AND json_extract(e.value,'$.destinationEnrolment.delivery.key')=NEW.subject AND length(json_extract(e.value,'$.destinationEnrolment.payloadHash'))=64 AND length(json_extract(e.value,'$.destinationEnrolment.delivery.operationId'))>0) THEN 1 ELSE RAISE(ABORT,'native requested checkpoint missing') END; END`).run();
  let acceptedBody,acceptedKey;
  const request = async (packId,destinationId) => {const p=await person(),body={type:'requestDestinationEnrolment',personId:p.id,version:p.version,enrolmentId:episodes[packId],destinationId,enrolmentVersion:0},key=randomUUID();if(packId==='maternal'){acceptedBody=body;acceptedKey=key;}return api.call(asha,'/api/commands',{method:'POST',body,org,headers:{'Idempotency-Key':key}});};
  const accepted=ok(await request('maternal','mis_maternal'));writeFileSync(folder+'/actual-first-destination-result.json',JSON.stringify({result:accepted.result,person:accepted.snapshot?.people?.find(p=>p.id==='p_meena')},null,2));check(accepted.result.state==='accepted','Existing real backend simulator produces a recorded acceptance');
  const uncertain=ok(await request('tb','mis_community'));check(uncertain.result.state==='uncertain','Existing real backend simulator retains unresolved outcome');
  // Change only the existing disposable simulator fixture behavior for a real business rejection.
  const integration=await database.prepare('SELECT data FROM integrations WHERE org_id=? AND id=?').bind(org,'mis_community').first();
  const integrationData=JSON.parse(integration.data);integrationData.behavior='reject';
  await database.prepare('UPDATE integrations SET data=? WHERE org_id=? AND id=?').bind(JSON.stringify(integrationData),org,'mis_community').run();
  const rejected=ok(await request('hypertension','mis_community'));check(rejected.result.state==='rejected','Actual simulator business rejection leaves episode locally available');
  await database.prepare('DROP TRIGGER '+checkpointTrigger).run();activeTrigger=null;
  const requestsRecorded=(await database.prepare("SELECT id FROM audit_events WHERE org_id=? AND action='requestDestinationEnrolment'").bind(org).all()).results;
  check(requestsRecorded.length===3,'Three native requested checkpoints with key digest and operation exist during request audit before simulator transport');
  const replayRows=async()=>({patient:await database.prepare('SELECT * FROM patients WHERE org_id=? AND id=?').bind(org,'p_meena').first(),events:(await database.prepare("SELECT * FROM audit_events WHERE org_id=? AND action LIKE '%DestinationEnrolment%' ORDER BY id").bind(org).all()).results,receipts:(await database.prepare('SELECT * FROM command_receipts WHERE org_id=? ORDER BY actor_id,key').bind(org).all()).results});
  const replayBefore=await replayRows(),replayed=ok(await api.call(asha,'/api/commands',{method:'POST',body:acceptedBody,org,headers:{'Idempotency-Key':acceptedKey}})),replayAfter=await replayRows();
  check(replayed.replayed===true&&replayed.result.state==='requested'&&replayed.snapshot.people.find(p=>p.id==='p_meena').enrolments.find(e=>e.id===episodes.maternal).destinationEnrolment.state==='accepted'&&JSON.stringify(replayBefore)===JSON.stringify(replayAfter),'Exact-key replay preserves original requested receipt and current accepted episode without another event receipt or patient mutation');
  writeFileSync(folder+'/native-checkpoint-and-replay.json',JSON.stringify({trigger:checkpointTrigger,validatedRequestedCheckpointBeforeTransport:true,acceptedKey,acceptedBody,replayBefore,replayAfter,replayedResult:replayed.result},null,2));
  // Separate fresh organisations exercise the execution repair; the UI fixtures
  // above are never replayed, repaired or relabelled by these tests.
  const execution=[];
  for(const mode of ['activation','lookup','accepted-person','person','connector','membership','assignment']){
    const steward=identity('steward-'+mode,run),raceOrg=ok(await api.get(steward,'/api/workspace')).organisation.id;
    const raceInvite=ok(await api.command(steward,{type:'createInvite',accountCode:account.user.accountCode,label:'Synthetic checkpoint '+mode,role:'asha',teamIds:['default']},raceOrg));
    ok(await api.command(asha,{type:'joinOrganisation',token:raceInvite.result.token}));
    const racePerson=()=>api.get(steward,'/api/workspace',raceOrg).then(ok).then(w=>w.people.find(p=>p.id==='p_meena'));
    let rp=await racePerson();ok(await api.command(steward,{type:'assignPatient',personId:rp.id,version:rp.version,teamId:'default',assignedTo:asha.id,reason:'Synthetic checkpoint '+mode},raceOrg));
    rp=await racePerson();const episode=ok(await api.command(asha,{type:'enrolProgramme',personId:rp.id,version:rp.version,packId:mode==='lookup'?'tb':'maternal',episodeLabel:'Synthetic checkpoint '+mode,startDate:null},raceOrg)).result.enrolmentId;
    if(['person','connector','membership','assignment'].includes(mode)){
      const change=mode==='person'?`UPDATE patients SET version=version+1,data=json_set(data,'$.version',version+1,'$.consentVersion',json_extract(data,'$.consentVersion')+1) WHERE org_id=${literal(raceOrg)} AND id='p_meena';`:mode==='connector'?`UPDATE integrations SET version=version+1,data=json_set(data,'$.version',version+1) WHERE org_id=${literal(raceOrg)} AND id='mis_maternal';`:mode==='membership'?`UPDATE memberships SET status='suspended',version=version+1 WHERE org_id=${literal(raceOrg)} AND user_id=${literal(asha.id)};`:`UPDATE patients SET assigned_to=${literal(steward.id)},version=version+1,data=json_set(data,'$.assignedTo',${literal(steward.id)},'$.version',version+1) WHERE org_id=${literal(raceOrg)} AND id='p_meena';`;
      activeTrigger='qa_checkpoint_'+mode;await database.prepare(`CREATE TRIGGER ${activeTrigger} AFTER INSERT ON audit_events WHEN NEW.org_id=${literal(raceOrg)} AND NEW.action='requestDestinationEnrolment' BEGIN ${change} END`).run();
    }
    rp=await racePerson();const body={type:'requestDestinationEnrolment',personId:rp.id,version:rp.version,enrolmentId:episode,destinationId:mode==='lookup'?'mis_community':'mis_maternal',enrolmentVersion:0};
    if(mode==='activation'){
      const witness=async()=>({patient:await database.prepare('SELECT * FROM patients WHERE org_id=? AND id=?').bind(raceOrg,'p_meena').first(),requests:(await database.prepare("SELECT * FROM audit_events WHERE org_id=? AND action LIKE '%DestinationEnrolment%' ORDER BY id").bind(raceOrg).all()).results,receipts:(await database.prepare('SELECT * FROM command_receipts WHERE org_id=? ORDER BY actor_id,key').bind(raceOrg).all()).results});
      const beforeDenied=await witness(),foreign=await api.command(outsider,body,raceOrg),wrongDestination=await api.command(asha,{...body,destinationId:'mis_community'},raceOrg);
      check([403,404].includes(foreign.status)&&wrongDestination.status===422&&JSON.stringify(beforeDenied)===JSON.stringify(await witness()),'Wrong actor scope and wrong programme destination refuse before checkpoint with no person event or receipt change');
    }
    const response=await api.command(asha,body,raceOrg);
    if(activeTrigger){await database.prepare('DROP TRIGGER '+activeTrigger).run();activeTrigger=null;}
    let current=await racePerson(),de=current.enrolments.find(e=>e.id===episode).destinationEnrolment;
    writeFileSync(folder+'/execution-'+mode+'.json',JSON.stringify({response,current,de},null,2));
    if(mode==='activation'){
      check(response.status===200&&de.state==='accepted'&&de.delivery.personVersion===current.version,'Actual accepted outcome advances only its own committed person-version pin');
      const denied=await api.command(asha,{type:'activateDestinationEnrolment',personId:current.id,version:current.version,enrolmentId:episode,enrolmentVersion:de.version,reason:'Synthetic reviewed acceptance'},raceOrg);
      check(denied.status===403,'ASHA cannot activate a genuinely recorded simulation acceptance');
      const active=ok(await api.command(steward,{type:'activateDestinationEnrolment',personId:current.id,version:current.version,enrolmentId:episode,enrolmentVersion:de.version,reason:'Synthetic reviewed acceptance; no official provider'},raceOrg));
      current=await racePerson();check(active.result.state==='active'&&current.enrolments.find(e=>e.id===episode).registration==='submitted','Existing owner activation works only after recorded accepted receipt and current source pin');
    }else if(mode==='lookup'){
      check(response.status===200&&de.state==='uncertain'&&de.delivery.personVersion===current.version,'Unresolved outcome pins only its own persisted increment');
      const requestedBefore=(await database.prepare("SELECT id FROM audit_events WHERE org_id=? AND action='requestDestinationEnrolment'").bind(raceOrg).all()).results;
      const found=ok(await api.command(asha,{type:'lookupDestinationEnrolment',personId:current.id,version:current.version,enrolmentId:episode},raceOrg));
      current=await racePerson();de=current.enrolments.find(e=>e.id===episode).destinationEnrolment;
      const requestedAfter=(await database.prepare("SELECT id FROM audit_events WHERE org_id=? AND action='requestDestinationEnrolment'").bind(raceOrg).all()).results;
      check(found.result.state==='accepted'&&de.state==='accepted'&&de.delivery.personVersion===current.version&&JSON.stringify(requestedBefore)===JSON.stringify(requestedAfter),'Actual receipt lookup persists accepted outcome without resending request or reusing original receipt');
    }else if(mode==='accepted-person'){
      check(response.status===200&&de.state==='accepted'&&de.destinationReceipt,'Separate fresh fixture has genuine accepted simulator receipt before intervening change');
      const originalPin=de.delivery.personVersion,originalReceipt=de.destinationReceipt;
      await database.prepare("UPDATE patients SET version=version+1,data=json_set(data,'$.version',version+1,'$.consentVersion',json_extract(data,'$.consentVersion')+1) WHERE org_id=? AND id='p_meena'").bind(raceOrg).run();
      current=await racePerson();de=current.enrolments.find(e=>e.id===episode).destinationEnrolment;
      const refused=await api.command(steward,{type:'activateDestinationEnrolment',personId:current.id,version:current.version,enrolmentId:episode,enrolmentVersion:de.version,reason:'Synthetic stale acceptance must refuse'},raceOrg);
      check(refused.status===409&&de.delivery.personVersion===originalPin&&de.delivery.personVersion<current.version&&de.destinationReceipt===originalReceipt&&current.enrolments.find(e=>e.id===episode).registration==='not_submitted','Intervening change after accepted receipt blocks activation while preserving historical receipt and stale pin');
      execution.push({mode,refusedStatus:refused.status,storedPersonVersion:current.version,deliveryPin:de.delivery.personVersion,receipt:de.destinationReceipt,state:de.state});
    }else{
      check(!['accepted','active'].includes(de.state)&&!de.destinationReceipt,'Native postcheckpoint '+mode+' change blocks the simulator acceptance');
      const resultEvents=(await database.prepare("SELECT * FROM audit_events WHERE org_id=? AND action='requestDestinationEnrolmentResult'").bind(raceOrg).all()).results;
      if(['person','assignment'].includes(mode))check(de.delivery.personVersion<current.version,'Intervening '+mode+' change retains stale pin rather than reauthorising latest record');
      if(mode==='person'||mode==='connector'){
        const lookup=await api.command(asha,{type:'lookupDestinationEnrolment',personId:current.id,version:current.version,enrolmentId:episode},raceOrg);
        const activate=await api.command(steward,{type:'activateDestinationEnrolment',personId:current.id,version:current.version,enrolmentId:episode,enrolmentVersion:de.version,reason:'Synthetic invalid stale activation'},raceOrg);
        check(lookup.status===409&&activate.status===409,'Stale '+mode+' source cannot authorise lookup or activation');
      }
      execution.push({mode,responseStatus:response.status,responseResult:response.json?.result,storedPersonVersion:current.version,deliveryPin:de.delivery.personVersion,state:de.state,resultEvents});
    }
  }
  ok(await api.command(asha,{type:'switchOrganisation',organisationId:org}));
  writeFileSync(folder+'/execution-races.json',JSON.stringify(execution,null,2));
  const statusPath='/api/programme-status?personId=p_meena';
  const detail=ok(await api.get(asha,statusPath,org));
  check(detail.person.id==='p_meena'&&detail.organisationId===org&&detail.actorId===asha.id&&detail.episodes.length===3,'Minimal actual response pins person org actor and all three local episodes');
  check(detail.episodes.every(e=>e.packVersion===1)&&detail.episodes.some(e=>e.id===episodes.hypertension&&e.destination.state==='rejected'&&e.destination.rejectionReason),'Response preserves pinned pack/episode IDs and actual rejection reason');
  check(!/(?:payloadHash|delivery|visits|referrals|integrations|clinicalRules)/.test(JSON.stringify(detail)),'Minimal response excludes full partition private payload delivery and unrelated records');
  for(const [who,path,useOrg] of [[owner,statusPath,org],[outsider,statusPath,org],[asha,statusPath,foreignOrg],[asha,'/api/programme-status?personId=p_james',org]]){const r=await api.get(who,path,useOrg);check([403,404].includes(r.status)&&!r.text.includes('Synthetic hypertension'),'Role owner foreign tenant and unassigned selection refuse without episode disclosure');}
  for(const path of ['/api/programme-status','/api/programme-status?personId=','/api/programme-status?personId=p_meena&personId=p_james','/api/programme-status?personId=p_meena&mode=all','/api/programme-status?personId=%00']){const r=await api.get(asha,path,org);check(r.status===400&&!r.text.includes('Synthetic hypertension'),'Malformed or expanded query is refused: '+path);}
  const noOrg=await api.get(asha,statusPath);check(noOrg.status===400,'Explicit original organisation is required for the single-person read');
  const anonymous=await fetch(worker.base+statusPath,{headers:{'x-saha-organisation':org}});check(anonymous.status===401,'Anonymous request cannot read programme status');
  const snapshot=async()=>{const names=(await database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT GLOB '_*' ORDER BY name").all()).results.map(r=>r.name),tables={};for(const name of names){const rows=(await database.prepare(`SELECT * FROM "${name.replaceAll('"','""')}"`).all()).results;tables[name]={rows:rows.length,sha256:hash(JSON.stringify(rows.map(r=>JSON.stringify(r)).sort()))};}return tables;};
  beforeTables=await snapshot();
  browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:390,height:844},extraHTTPHeaders:asha.headers});
  await context.route('**/*',route=>{if(!route.request().url().startsWith(worker.base+'/')){external.push(route.request().url());return route.abort();}return route.continue();});
  page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))requests.push({method:r.method(),path:new URL(r.url()).pathname});});
  await page.goto(worker.base+'/programme-status');await page.getByRole('heading',{name:'Choose an assigned record',exact:true}).waitFor();
  check(await page.getByRole('button',{name:'Open programme status p_meena',exact:true}).count()===1&&await page.getByRole('button',{name:'Open programme status p_james',exact:true}).count()===0,'Actual mobile selection shows only assigned records');
  await page.getByRole('button',{name:'Open programme status p_meena',exact:true}).click();await page.getByRole('region',{name:'Selected programme record',exact:true}).waitFor();
  const text=await page.locator('main').innerText();check(text.includes('Simulation accepted. Programme activation still required.')&&text.includes('Simulation outcome unresolved.')&&text.includes('Simulation rejected. Local episode retained; not externally enrolled.'),'Mobile view keeps accepted rejected and uncertain states distinct');
  check(text.includes(rejected.result.rejectionReason)&&text.includes('Synthetic hypertension episode')&&text.includes('Real eligibility and official registration are not established'),'Actual rejection reason and local identity remain visible with simulator limits');
  check(!text.includes('private')&&requests.every(r=>r.method==='GET')&&external.length===0,'Page performs GET-only reads and no provider or command call');
  const geometry=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,controls:[...document.querySelectorAll('main button,main a')].map(e=>e.getBoundingClientRect().height)}));
  check(geometry.scroll<=geometry.width&&geometry.controls.every(h=>h>=44),'Actual mobile layout avoids overflow and has44px controls');await page.screenshot({path:folder+'/programme-status-phone.png',fullPage:true});
  afterTables=await snapshot();const clinicalDiff=Object.keys(beforeTables).filter(k=>!['audit_events','request_metrics'].includes(k)&&JSON.stringify(beforeTables[k])!==JSON.stringify(afterTables[k]));
  check(Object.keys(beforeTables).length===60&&clinicalDiff.length===0,'All60 native tables compared; only expected read audit/metric tables change, with no clinical/episode/receipt mutation');
  const membership=()=>database.prepare('SELECT role,status,version,is_owner FROM memberships WHERE org_id=? AND user_id=?').bind(org,asha.id).first();
  for(const timing of ['BEFORE','AFTER'])for(const mutation of ['membership','assignment','role-owner']){
    const m=await membership(),p=await person(),trigger='qa_programme_'+timing.toLowerCase()+'_'+mutation.replaceAll('-','_');
    const change=mutation==='membership'?`UPDATE memberships SET status='suspended',version=version+1 WHERE org_id=${literal(org)} AND user_id=${literal(asha.id)};`:mutation==='role-owner'?`UPDATE memberships SET role='clinician',is_owner=1,version=version+1 WHERE org_id=${literal(org)} AND user_id=${literal(asha.id)};`:`UPDATE patients SET assigned_to=${literal(owner.id)},version=version+1,data=json_set(data,'$.assignedTo',${literal(owner.id)},'$.version',version+1) WHERE org_id=${literal(org)} AND id='p_meena';`;
    activeTrigger=trigger;await database.prepare(`CREATE TRIGGER ${trigger} ${timing} INSERT ON audit_events WHEN NEW.org_id=${literal(org)} AND NEW.actor_id=${literal(asha.id)} AND NEW.action='viewPatientRecord' BEGIN ${change} END`).run();
    const r=await api.get(asha,statusPath,org),changed=await membership();
    await database.prepare('DROP TRIGGER '+trigger).run();activeTrigger=null;
    check([403,404].includes(r.status)&&Object.keys(r.json).join(',')==='error'&&!r.text.includes('Synthetic hypertension'),'Actual '+timing+'-audit '+mutation+' change refuses before protected response');
    races.push({timing,mutation,status:r.status,body:r.json,memberBefore:m,memberAfter:changed});
    if(mutation==='assignment')await assign();else ok(await api.command(owner,{type:'updateMember',userId:asha.id,version:changed.version,role:'asha',isOwner:false,status:'active',teamIds:['default'],reason:'Synthetic restore after native read race'},org));
  }
  // Actual native audit failure returns503; UI must remove previously shown protected status.
  activeTrigger='qa_programme_read_fail';await database.prepare(`CREATE TRIGGER ${activeTrigger} BEFORE INSERT ON audit_events WHEN NEW.org_id=${literal(org)} AND NEW.actor_id=${literal(asha.id)} AND NEW.action='viewPatientRecord' BEGIN SELECT RAISE(ABORT,'synthetic owned audit refusal'); END`).run();
  await page.getByRole('button',{name:'Refresh selected status',exact:true}).click();await page.getByText('Status unavailable. Refresh after checking your connection.',{exact:true}).waitFor();
  check(await page.getByRole('region',{name:'Selected programme record',exact:true}).count()===0&&!/Meena Devi|Synthetic hypertension/.test(await page.locator('main').innerText()),'Actual backend audit failure clears protected UI instead of showing stale episode status');
  await database.prepare('DROP TRIGGER '+activeTrigger).run();activeTrigger=null;
  await page.getByRole('button',{name:'Refresh assigned records',exact:true}).click();await page.getByRole('button',{name:'Open programme status p_meena',exact:true}).click();await page.getByRole('region',{name:'Selected programme record',exact:true}).waitFor();
  check((await page.locator('main').innerText()).includes('Simulation rejected.'),'Recovery uses a fresh authorised read and retains actual rejection');
  await context.setOffline(true);await page.getByText('Status cleared. Reconnect and refresh assigned records.',{exact:true}).waitFor();
  check(await page.getByRole('region',{name:'Selected programme record',exact:true}).count()===0&&!/Meena Devi|Synthetic hypertension/.test(await page.locator('main').innerText()),'Real browser offline transition clears protected record content');
  await context.setOffline(false);check(errors.length===0&&external.length===0,'No runtime error or external provider request across the real journey');
}catch(error){failure=String(error.stack??error);if(page){writeFileSync(folder+'/failure.html',await page.content());await page.screenshot({path:folder+'/failure.png',fullPage:true});}throw error;}
finally{if(activeTrigger&&database)await database.prepare('DROP TRIGGER IF EXISTS '+activeTrigger).run();await browser?.close();if(worker){await worker.stop();disposed=true;portFree=await new Promise(r=>{const s=connect(+new URL(worker.base).port,'127.0.0.1');s.once('connect',()=>{s.destroy();r(false);});s.once('error',e=>r(e.code==='ECONNREFUSED'));});}rmSync(state,{recursive:true,force:true});afterCustody=custody();if(!failure){check(JSON.stringify(beforeCustody)===JSON.stringify(afterCustody),'Every actual app lib compiled asset and owned test source hash stays unchanged throughout native execution');check(disposed&&portFree,'Owned native backend is disposed and its loopback port is free');}writeFileSync(folder+'/source-build-custody.json',JSON.stringify({before:beforeCustody,after:afterCustody,unchanged:JSON.stringify(beforeCustody)===JSON.stringify(afterCustody)},null,2));writeFileSync(folder+'/result.json',JSON.stringify({passed:checks.length,failed:failure?1:0,skipped:0,checks,requests,external,errors,races,beforeTables,afterTables,failure,disposed,portFree,completedAt:new Date().toISOString(),limits:'Actual current native local synthetic backend and mobile Chromium; existing simulator lifecycle and disposable native race fixtures only. No real provider/clinical/partner/official registration approval, fullstory/UAT/physical/p95/staging qualification. Clinical-table equality applies to read-only browser segment before deliberate race/recovery setup.'},null,2));console.log(JSON.stringify({passed:checks.length,failed:failure?1:0,skipped:0,disposed}));}
