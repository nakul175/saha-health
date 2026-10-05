import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {startWorker,identity,client} from './lib/worker.mjs';
const {chromium}=await import(process.env.SAHA_BROWSER_PACKAGE??'playwright-core');
let worker,browser;const evidence='tests/evidence/app-offline-scope';mkdirSync(evidence,{recursive:true});
try{
 worker=await startWorker({port:'8863',name:'saha-app-offline-scope'});const api=client(worker.base),run=crypto.randomUUID().slice(0,8),owner=identity('owner',run),asha=identity('asha',run);
 const own=(await api.get(owner,'/api/workspace')).json,home=(await api.get(asha,'/api/workspace')).json,org=own.organisation.id,p=own.people.find(p=>p.name==='Meena Devi');
 const cmd=async(w,c)=>{const r=await api.command(w,c,org);assert.equal(r.status,200,r.text);return r.json};
 const invite=await cmd(owner,{type:'createInvite',accountCode:home.user.accountCode,label:'Synthetic scope ASHA',role:'asha',teamIds:['default']});assert.equal((await api.command(asha,{type:'joinOrganisation',token:invite.result.token})).status,200);
 const assign=async(to)=>{const s=(await api.get(owner,'/api/workspace',org)).json;await cmd(owner,{type:'assignPatient',personId:p.id,version:s.people.find(x=>x.id===p.id).version,teamId:'default',assignedTo:to,reason:'Synthetic prepared packet scope review'})};await assign(asha.id);
 const s=(await api.get(asha,'/api/workspace',org)).json,packet=(await cmd(asha,{type:'prepareFieldVisit',personId:p.id,version:s.people.find(x=>x.id===p.id).version})).result;
 browser=await chromium.launch({headless:true,executablePath:process.env.SAHA_CHROMIUM});const context=await browser.newContext({extraHTTPHeaders:asha.headers}),page=await context.newPage();page.setDefaultTimeout(12000);const pass='Synthetic scope passphrase';
 await page.goto(worker.base+'/field/index.html');await page.evaluate(async({packet,pass})=>{const v=await import('/field/vault.js'),salt=Array.from(crypto.getRandomValues(new Uint8Array(16))),key=await v.derive(pass,salt);await v.writeVault({...await v.seal(key,{schema:1,userId:packet.packet.payload.userId,drafts:[{...packet,facts:structuredClone(packet.packet.payload.facts),answers:{},absence:{},state:'draft',pending:null}],registrations:[]}),salt},0)},{packet,pass});
 await page.goto(worker.base+'/app/offline/');const unlock=async()=>{await page.locator('#passphrase').fill(pass);await page.locator('#unlock-form button').click()};await unlock();await page.locator('#notebook').waitFor({state:'visible'});assert.ok(await page.locator('#drafts').getByText('Meena Devi',{exact:false}).isVisible());await page.locator('#lock').click();
 await assign(owner.id);const denied=await api.get(asha,'/api/patients/detail?personId='+p.id,org);assert.equal(denied.status,404);await unlock();await page.waitForTimeout(500);const leak=await page.locator('#notebook').isVisible()&&(await page.locator('body').innerText()).includes('Meena Devi');
 assert.equal(leak,false,'Online unlock disclosed patient despite actual current D1 scope denial');
 // A signed bounded grant remains usable when disconnected, then a positive
 // reconnect refusal must immediately redact without waiting for a sync attempt.
 await context.setOffline(true);await unlock();await page.locator('#notebook').waitFor({state:'visible'});assert.ok((await page.locator('body').innerText()).includes('Meena Devi'));
 await context.setOffline(false);await page.locator('#notebook').waitFor({state:'hidden'});await page.getByText('Device visit access changed.',{exact:false}).waitFor();assert.ok(!(await page.locator('body').innerText()).includes('Meena Devi'));
 await assign(asha.id);await unlock();await page.locator('#notebook').waitFor({state:'visible'});await page.locator('#lock').click();
 const membership=(await api.get(owner,'/api/workspace',org)).json.members.find(m=>m.userId===asha.id);await cmd(owner,{type:'updateMember',userId:asha.id,version:membership.version,role:'asha',teamIds:['default'],isOwner:false,status:'suspended',reason:'Synthetic old organisation access withdrawn'});
 const fallback=await api.get(asha,'/api/workspace');assert.equal(fallback.status,200);assert.equal(fallback.json.user.userId,asha.id);assert.equal(fallback.json.role,'clinician');assert.notEqual(fallback.json.organisation.id,org);
 await unlock();await page.getByText('Device visit access changed.',{exact:false}).waitFor();assert.ok(await page.locator('#notebook').isHidden());assert.ok(!(await page.locator('body').innerText()).includes('Meena Devi'));
 await page.screenshot({path:evidence+'/withdrawn-membership.png',fullPage:true});
 // Reported online with unreachable transport still follows the bounded grant;
 // an actual positive scope response, above, never takes this fallback.
 await page.route('**/api/workspace',route=>route.abort('failed'));await unlock();await page.locator('#notebook').waitFor({state:'visible'});assert.ok((await page.locator('body').innerText()).includes('Meena Devi'));await page.locator('#lock').click();await page.unroute('**/api/workspace');

 writeFileSync(evidence+'/result.json',JSON.stringify({passed:8,failed:0,serverReassignedPatientStatus:denied.status,onlineUnlockWithdrawnPatientDenied:true,offlineSignedGrantRetained:true,reconnectRedactsWithdrawnPatient:true,sameAccountHomeCareRoleCannotBypassPacketOrganisation:true},null,2)+'\n');
 console.log('Online withdrawn scope denied');
}finally{await browser?.close();await worker?.stop()}
