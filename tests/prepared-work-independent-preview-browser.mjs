import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {startWorker,identity,client} from './lib/worker.mjs';
const out='tests/evidence/prepared-work-list-independent/preview-withdrawal';mkdirSync(out,{recursive:true});
const {chromium}=await import(process.env.SAHA_BROWSER_PACKAGE??'@playwright/test');let worker,browser,passed=0;
const check=(v,m)=>{assert.ok(v,m);passed++};
try{
 worker=await startWorker({port:'21144',name:'saha-review-prepared-stale-phone'});const api=client(worker.base),run=crypto.randomUUID().slice(0,8),owner=identity('caseload-owner',run,'Synthetic Owner'),asha=identity('caseload-asha',run,'Synthetic ASHA');
 let s=(await api.get(owner,'/api/workspace')).json;const org=s.organisation.id,home=(await api.get(asha,'/api/workspace')).json;
 const command=async(who,c)=>{const r=await api.command(who,c,org);assert.equal(r.status,200,JSON.stringify(r.json));passed++;return r.json.result;};
 const inv=await command(owner,{type:'createInvite',accountCode:home.user.accountCode,label:'Synthetic ASHA',role:'asha',teamIds:['default']});assert.equal((await api.command(asha,{type:'joinOrganisation',token:inv.token})).status,200);passed++;
 const ids=[],names=['Synthetic Offline Alder','Synthetic Offline Birch','Synthetic Offline Cedar'];
 for(let i=0;i<3;i++){
  const r=await command(owner,{type:'createPerson',name:names[i],age:30+i*10,sex:i===1?'Male':'Female',village:'Synthetic Village '+i,programme:'TB screening',teamId:'default'});ids.push(r.personId);
  s=(await api.get(owner,'/api/workspace',org)).json;await command(owner,{type:'assignPatient',personId:r.personId,version:s.people.find(x=>x.id===r.personId).version,teamId:'default',assignedTo:home.user.userId,reason:'Synthetic scoped caseload discovery'});
  s=(await api.get(owner,'/api/workspace',org)).json;const e=await command(owner,{type:'enrolProgramme',personId:r.personId,version:s.people.find(x=>x.id===r.personId).version,packId:'tb',episodeLabel:'Synthetic documentary episode',startDate:null});
  s=(await api.get(owner,'/api/workspace',org)).json;await command(owner,{type:'scheduleFollowUp',personId:r.personId,version:s.people.find(x=>x.id===r.personId).version,enrolmentId:e.enrolmentId,title:'Synthetic existing reviewed contact '+i,due:new Date().toISOString().slice(0,10),ownerId:home.user.userId});
 }
 s=(await api.get(asha,'/api/workspace',org)).json;check(ids.every(id=>s.people.some(p=>p.id===id&&p.assignedTo===home.user.userId)),'All three assigned patients visible to current ASHA online');const tasks=ids.flatMap(id=>s.people.find(p=>p.id===id).followUps.filter(t=>t.state==='open'&&t.ownerId===home.user.userId));check(tasks.length===3,'Three supported explicitly scheduled due tasks exist; no inferred clinical tasks');

 browser=await chromium.launch({headless:true,executablePath:process.env.SAHA_CHROMIUM});const ctx=await browser.newContext({viewport:{width:390,height:844},extraHTTPHeaders:asha.headers}),page=await ctx.newPage();page.setDefaultTimeout(25000);const errors=[];page.on('pageerror',e=>errors.push(e.message));const sent=[];page.on('request',r=>{if(r.url().endsWith('/api/prepared-work-list')&&r.method()==='POST')sent.push({body:r.postData(),key:r.headers()['idempotency-key']});});
 await page.goto(worker.base+'/app/offline/');await page.evaluate(async userId=>{const v=await import('/field/vault.js'),salt=Array(16).fill(12),key=await v.derive('Synthetic Caseload Vault',salt);await v.writeVault({...await v.seal(key,{schema:1,userId,drafts:[],registrations:[]}),salt},0);},home.user.userId);await page.locator('#passphrase').fill('Synthetic Caseload Vault');await page.getByRole('button',{name:'Create or unlock / खोलें',exact:true}).click();await page.locator('#notebook').waitFor({state:'visible'});await page.getByRole('button',{name:'Prepare while connected',exact:true}).click();await page.locator('#load').click();await page.getByRole('button',{name:'Review assigned and due work',exact:true}).waitFor();await page.getByRole('button',{name:'Review assigned and due work',exact:true}).click();await page.getByRole('button',{name:'Prepare selected visit: '+names[0],exact:true}).waitFor();check(await page.locator('#prepared-work-list').innerText().then(t=>names.every(n=>t.includes(n))),'Phone reviews three assigned source-backed work rows');s=(await api.get(owner,'/api/workspace',org)).json;
await command(owner,{type:'assignPatient',personId:ids[0],version:s.people.find(x=>x.id===ids[0]).version,teamId:'default',assignedTo:owner.id,reason:'Synthetic current preview authority withdrawal'});
const fresh=await api.call(asha,'/api/prepared-work-list?offset=0',{org,headers:{'x-saha-expected-actor':home.user.userId}});
check(fresh.status===200&&!fresh.json.rows.some(x=>x.personId===ids[0]),'Fresh server excludes withdrawn preview row');
await page.locator('#load').click();
await page.waitForFunction(()=>!document.querySelector('#load').disabled);
const current=await api.get(asha,'/api/workspace',org),preview=await page.locator('#prepared-work-list').innerText();
await page.screenshot({path:out+'/after-current-reload.png',fullPage:true});
writeFileSync(out+'/observed.json',JSON.stringify({passed,afterWorkspace:current.json.people.map(x=>({id:x.id,name:x.name,assignedTo:x.assignedTo})),freshRows:fresh.json.rows,preview,withdrawn:ids[0],sent},null,2));
check(!preview.includes(names[0]),'Explicit current workspace reload removes withdrawn unprepared work preview');
console.log(JSON.stringify({passed}));
}catch(e){writeFileSync(out+'/failure.txt',e.stack??String(e));throw e;}finally{await browser?.close();await worker?.stop();}
