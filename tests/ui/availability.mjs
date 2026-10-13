import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readdirSync,mkdirSync,writeFileSync} from 'node:fs';import {join,resolve} from 'node:path';import {DatabaseSync} from 'node:sqlite';
import {startWorker,identity,client} from '../lib/worker.mjs';
const {chromium}=await import(process.env.SAHA_BROWSER_PACKAGE??'@playwright/test'),evidence='tests/evidence/availability',state=resolve('.wrangler/availability-state');mkdirSync(evidence,{recursive:true});
let worker,browser,sql;const checks=[];const check=async(name,fn)=>{journal.currentGroup=name;writeJournal();await fn();checks.push(name);journal.completedGroups=[...checks];writeJournal()};
// Only operational metadata from this test's synthetic owned page is retained.
const diagnosticDirectory='tests/reports/availability-fixture';mkdirSync(diagnosticDirectory,{recursive:true});
const journal={completedGroups:checks,currentGroup:null,status:'prepared',finalDisable:null};
const hashText=value=>createHash('sha256').update(value).digest('hex');
const writeJournal=()=>writeFileSync(diagnosticDirectory+'/disable-refresh-journal.json',JSON.stringify(journal,null,2)+'\n');
const finalDisable=async(page,panel,org)=>{
 const started=performance.now(),deadline=started+30000,reason='Synthetic monitoring demonstration complete';
 const details=journal.finalDisable={timeoutMs:30000,events:[],overflow:false,renderedReportVersion:null,reasonSHA256:hashText(reason),reasonLength:reason.length};
 const remaining=()=>{const left=Math.floor(deadline-performance.now());if(left<=0)throw Error('Final availability refresh/disable exceeded the original30s bound');return left;};
 const bounded=async(createPromise)=>{const left=remaining();let timer;try{return await Promise.race([createPromise(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Availability response body exceeded original30s final-phase bound')),left);})]);}finally{clearTimeout(timer);}};
 const metadata=request=>{
  const url=new URL(request.url()),path=url.pathname;if(url.origin!==new URL(page.url()).origin)return null;if(!['/api/operations','/api/availability','/api/commands'].includes(path))return null;
  const selected=request.headers()['x-saha-organisation'];if(selected!==org)return null;
  let command=null;if(path==='/api/commands'){try{const body=request.postDataJSON();if(body?.type!=='opsAvailability')return null;command={type:body.type,version:body.version,enabled:body.enabled,reasonLength:typeof body.reason==='string'?body.reason.length:null,reasonSHA256:typeof body.reason==='string'?hashText(body.reason):null};}catch{return null;}}
  return {path,method:request.method(),selectedOrganisationMatches:true,command};
 };
 const record=event=>{if(details.events.length<64)details.events.push(event);else details.overflow=true;writeJournal();};
 const onRequest=request=>{const value=metadata(request);if(value)record({phase:'request',...value});};
 const onResponse=response=>{const value=metadata(response.request());if(value)record({phase:'response',...value,status:response.status(),requestId:response.headers()['x-saha-request-id']??null});};
 const onFailed=request=>{const value=metadata(request);if(value)record({phase:'transport-failure',...value});};
 page.on('request',onRequest);page.on('response',onResponse);page.on('requestfailed',onFailed);
 const stop=()=>{page.off('request',onRequest);page.off('response',onResponse);page.off('requestfailed',onFailed);};
 try{
  details.phase='one parent refresh armed';writeJournal();
  const operationResponse=page.waitForResponse(response=>{const value=metadata(response.request());return value?.path==='/api/operations'&&value.method==='GET';},{timeout:remaining()});
  const availabilityResponse=page.waitForResponse(response=>{const value=metadata(response.request());return value?.path==='/api/availability'&&value.method==='GET';},{timeout:remaining()});
  // Install both waiters before the original ONE Refresh; no retries or delays.
  const pending=Promise.all([operationResponse,availabilityResponse]);void pending.catch(()=>{});
  await page.locator('.operations-page > .page-heading').getByRole('button',{name:'Refresh',exact:true}).click({timeout:remaining()});
  const [operation,availability]=await pending;
  const report=await bounded(()=>operation.json()),availabilityReport=await bounded(()=>availability.json());
  details.renderedReportVersion=report.operations?.version??null;details.refreshStatus=operation.status();details.refreshRequestId=operation.headers()['x-saha-request-id']??null;details.availabilityStatus=availability.status();details.availabilityRequestId=availability.headers()['x-saha-request-id']??null;details.availabilityEnabled=availabilityReport.enabled;details.canConfigure=availabilityReport.canConfigure;details.phase='actual refresh bodies captured';writeJournal();
  assert.equal(operation.status(),200);assert.equal(availability.status(),200);assert.ok(Number.isSafeInteger(details.renderedReportVersion));assert.equal(availabilityReport.enabled,true);assert.equal(availabilityReport.canConfigure,true);
  await panel.getByLabel('Availability configuration reason').waitFor({state:'visible',timeout:remaining()});
  await panel.getByRole('button',{name:'Disable synthetic checks',exact:true}).waitFor({state:'visible',timeout:remaining()});
  await panel.getByLabel('Availability configuration reason').fill(reason,{timeout:remaining()});
  const filled=await panel.getByLabel('Availability configuration reason').inputValue({timeout:remaining()});details.filledReasonSHA256=hashText(filled);details.filledReasonLength=filled.length;details.phase='reason captured before single disable';writeJournal();assert.equal(filled,reason);
  const commandResponse=page.waitForResponse(response=>{const value=metadata(response.request());return value?.path==='/api/commands'&&value.method==='POST'&&value.command?.enabled===false;},{timeout:remaining()});
  const pendingCommand=Promise.all([commandResponse]);void pendingCommand.catch(()=>{});
  await panel.getByRole('button',{name:'Disable synthetic checks',exact:true}).click({timeout:remaining()});
  const [response]=await pendingCommand,submitted=metadata(response.request());
  details.submitted=submitted;details.disableStatus=response.status();details.disableRequestId=response.headers()['x-saha-request-id']??null;details.phase='actual single disable response captured before assertions';writeJournal();
  assert.equal(response.status(),200);assert.equal(submitted.command.version,details.renderedReportVersion);assert.equal(submitted.command.reasonSHA256,details.reasonSHA256);assert.equal(submitted.command.reasonLength,details.reasonLength);assert.ok(details.disableRequestId);assert.equal(details.overflow,false);
  // The command response proves persistence, but the form's automatic refresh
  // can have been armed before that response and legitimately return the old
  // enabled snapshot. Perform one explicit post-response refresh and bind the
  // UI assertion to those exact response bodies; this is not a retry loop.
  const disabledOperationResponse=page.waitForResponse(response=>{const value=metadata(response.request());return value?.path==='/api/operations'&&value.method==='GET';},{timeout:remaining()});
  const disabledAvailabilityResponse=page.waitForResponse(response=>{const value=metadata(response.request());return value?.path==='/api/availability'&&value.method==='GET';},{timeout:remaining()});
  const disabledPending=Promise.all([disabledOperationResponse,disabledAvailabilityResponse]);void disabledPending.catch(()=>{});
  await page.locator('.operations-page > .page-heading').getByRole('button',{name:'Refresh',exact:true}).click({timeout:remaining()});
  const [disabledOperation,disabledAvailability]=await disabledPending;
  const disabledReport=await bounded(()=>disabledAvailability.json());
  details.disabledRefreshStatus=disabledOperation.status();details.disabledAvailabilityStatus=disabledAvailability.status();details.disabledAvailabilityEnabled=disabledReport.enabled;details.phase='single post-response disabled refresh captured';writeJournal();
  assert.equal(disabledOperation.status(),200);assert.equal(disabledAvailability.status(),200);assert.equal(disabledReport.enabled,false);
  return {remaining,stop,assertNoOverflow:()=>assert.equal(details.overflow,false)};
 }catch(error){details.phase='failed';details.errorName=error?.name??'Error';details.errorSHA256=hashText(String(error));writeJournal();stop();throw error;}
};

try{
 journal.status='running';writeJournal();
 worker=await startWorker({port:process.env.SAHA_AVAILABILITY_PORT??'8963',name:'availability',state,vars:{SAHA_ENVIRONMENT:'synthetic',SAHA_EXTERNAL_APIS_ENABLED:'false'}});
 const api=client(worker.base),run=crypto.randomUUID().slice(0,8),owner=identity('owner',run,'Synthetic Availability Owner'),admin=identity('admin',run,'Synthetic Administrator'),clinician=identity('clinician',run),other=identity('other',run);
 const home=await api.get(owner,'/api/workspace'),org=home.json.organisation.id,adminHome=await api.get(admin,'/api/workspace'),clinicalHome=await api.get(clinician,'/api/workspace');await api.get(other,'/api/workspace');
 const cmd=async(who,body,status=200,key)=>{const r=await api.call(who,'/api/commands',{method:'POST',body,org,headers:key?{'Idempotency-Key':key}:{}});assert.equal(r.status,status,r.text.slice(0,500));return r.json};
 for(const [who,account,role]of[[admin,adminHome.json.user.accountCode,'admin'],[clinician,clinicalHome.json.user.accountCode,'clinician']]){const invite=await cmd(owner,{type:'createInvite',accountCode:account,label:'Synthetic member',role,teamIds:role==='admin'?[]:['default']});await cmd(who,{type:'joinOrganisation',token:invite.result.token});}
 const report=async(who=owner,path='/api/availability',status=200)=>{const r=await api.get(who,path,org);assert.equal(r.status,status,r.text.slice(0,500));return r.json};
 const dbdir=join(state,'v3/d1/miniflare-D1DatabaseObject'),filename=readdirSync(dbdir).find(f=>f.endsWith('.sqlite')&&f!=='metadata.sqlite');sql=new DatabaseSync(join(dbdir,filename));sql.exec('PRAGMA busy_timeout=5000');
 await check('Actual anonymous, nonoperator and other-organisation reports refuse',async()=>{assert.equal((await api.get(null,'/api/availability',org)).status,401);await report(clinician,'/api/availability',403);await report(other,'/api/availability',403);assert.equal((await report(admin)).canConfigure,false);});
 await check('Report rejects unsupported, duplicate, malformed and future query filters',async()=>{for(const path of['/api/availability?format=support','/api/availability?month=2026-10&month=2026-10','/api/availability?month=bad','/api/availability?month=2099-01'])await report(owner,path,422);});
 await check('Unconfigured report remains disabled and audited without patient facts',async()=>{const r=await report();assert.equal(r.enabled,false);assert.equal(r.scheduler.expected,0);assert.equal(r.hostedTargetAssessment,'unmeasured');assert.ok(!JSON.stringify(r).includes('Meena'));assert.ok(sql.prepare("SELECT count(*) n FROM audit_events WHERE org_id=? AND action='viewAggregate' AND subject='synthetic availability report'").get(org).n>0);});
 const version=async()=>(await api.get(owner,'/api/operations',org)).json.operations.version;
 await check('Nonowner cannot enable availability through actual command route',async()=>{await cmd(admin,{type:'opsAvailability',version:await version(),enabled:true,dependencyId:null,reason:'Synthetic activation denied'},403);});
 browser=await chromium.launch({executablePath:process.env.SAHA_CHROMIUM,headless:true});const context=await browser.newContext({viewport:{width:1280,height:950},extraHTTPHeaders:owner.headers}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(worker.base+'/');await page.getByRole('button',{name:'Operations',exact:true}).click();await page.getByRole('heading',{name:'Keep work moving',exact:true}).waitFor();await page.getByRole('tab',{name:'Service & incidents',exact:true}).click();const panel=page.locator('section').filter({has:page.getByRole('heading',{name:'Synthetic availability checks',exact:true})});
 await check('Chromium owner enables fixed synthetic checks in reachable Operations form',async()=>{await panel.getByLabel('Availability synthetic destination').waitFor();const options=await panel.locator('select option').allTextContents();assert.ok(options.length>1);await panel.getByLabel('Availability synthetic destination').selectOption({index:1});await panel.getByLabel('Availability configuration reason').fill('Synthetic local monitoring demonstration');await panel.getByRole('button',{name:'Enable synthetic checks',exact:true}).click();await panel.getByRole('button',{name:'Disable synthetic checks',exact:true}).waitFor();assert.equal((await report()).enabled,true);});
 // Advance the synthetic fixture's activation window into completed UTC slots
 // without waiting five real minutes. The browser sample itself uses the real route.
 const slot=Math.floor(Date.now()/300000)*300000,from=new Date(slot-900000).toISOString();sql.prepare("UPDATE operations SET data=json_set(data,'$.availability.periods[0].from',?) WHERE org_id=?").run(from,org);
 await check('Chromium manual check records immutable D1 evidence and honest missing scheduler coverage',async()=>{await panel.getByRole('button',{name:'Refresh availability',exact:true}).click();await panel.getByRole('button',{name:'Run fixed synthetic check',exact:true}).click();await panel.getByText(/Manual HTTP observations: 0/).waitFor();const r=await report();assert.equal(r.scheduler.expected,3);assert.equal(r.scheduler.observed,0);assert.equal(r.scheduler.missing,3);const rows=sql.prepare('SELECT * FROM availability_samples WHERE org_id=?').all(org);assert.equal(rows.length,1);assert.equal(rows[0].source,'manual-http');assert.equal(rows[0].core,'healthy');assert.equal(rows[0].workflow,'healthy');assert.equal(r.hostedTargetAssessment,'unmeasured');await page.screenshot({path:evidence+'/availability-owner.png',fullPage:true});});
 await check('Real POST duplicate is idempotent, fixed payload only and query URL refused',async()=>{const r=await api.call(owner,'/api/availability',{method:'POST',org,body:{}});assert.equal(r.status,200,r.text);assert.equal(r.json.reason,'duplicate');for(const [path,body]of[['/api/availability',{url:'https://example.invalid'}],['/api/availability?url=https://example.invalid',{}]]){const denied=await api.call(owner,path,{method:'POST',org,body});assert.equal(denied.status,422);}assert.equal(sql.prepare('SELECT count(*) n FROM availability_samples WHERE org_id=?').get(org).n,1);});
 await check('Maintenance permits core diagnosis and refuses no support/query semantics',async()=>{await cmd(owner,{type:'opsMaintenance',version:await version(),active:true,reason:'Synthetic maintenance check'});assert.equal((await report()).enabled,true);const support=await api.get(owner,'/api/operations?format=support',org);assert.equal(support.status,200);assert.equal(support.json.maintenance,true);assert.ok(!('availability' in support.json));assert.ok(!JSON.stringify(support.json).includes('Meena'));await cmd(owner,{type:'opsMaintenance',version:await version(),active:false,reason:'Synthetic maintenance completed'});});
 await check('Chromium owner disables checks and prior evidence stays immutable',async()=>{const phase=await finalDisable(page,panel,org);try{await panel.getByRole('button',{name:'Enable synthetic checks',exact:true}).waitFor({timeout:phase.remaining()});phase.remaining();const r=await report();assert.equal(r.enabled,false);assert.ok(r.activationWindows.every(p=>p.until!==null));assert.equal(sql.prepare('SELECT count(*) n FROM availability_samples WHERE org_id=?').get(org).n,1);phase.assertNoOverflow();}finally{phase.stop();}});
 await check('Actual current revocation refuses report and probe',async()=>{sql.prepare("UPDATE memberships SET status='suspended' WHERE org_id=? AND user_id=?").run(org,admin.id);await report(admin,'/api/availability',403);assert.equal((await api.call(admin,'/api/availability',{method:'POST',org,body:{}})).status,403);});
 await check('Reachable Chromium panel has zero page errors',async()=>assert.deepEqual(errors,[]));
 journal.status='completed';writeJournal();const result={passed:checks.length,failed:0,checks,completedAt:new Date().toISOString(),coverage:'Isolated actual built Worker/D1 and real Chromium, synthetic identities and fixtures; all providers disabled. Fixture activation backdated for deterministic completed-slot coverage. No live or hosted acceptance.'};writeFileSync(evidence+'/http-browser.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}catch(e){journal.status='failed';journal.errorName=e?.name??'Error';journal.errorSHA256=hashText(String(e));writeJournal();writeFileSync(evidence+'/http-browser.json',JSON.stringify({passed:checks.length,checks,error:String(e)},null,2)+'\n');throw e;}finally{sql?.close();await browser?.close();await worker?.stop();}
