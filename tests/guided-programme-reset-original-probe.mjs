// Real Chromium against an isolated local D1 Worker. Synthetic dispatcher headers never go to a hosted endpoint.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {startWorker,identity,client} from './lib/worker.mjs';
const {chromium}=await import(process.env.SAHA_BROWSER_PACKAGE??'@playwright/test');
let worker,browser,passed=0;
const check=(value,message)=>{assert.ok(value,message);passed++};
const evidence='tests/evidence/guided-programme-reset/programme-current-read';mkdirSync(evidence,{recursive:true});
try{
 worker=await startWorker({port:process.env.SAHA_GUIDED_HOME_PORT??'9219',name:'guided-programme-reset-programme-read'});
 const api=client(worker.base),run=crypto.randomUUID().slice(0,8),owner=identity('owner',run,'Synthetic Owner'),asha=identity('asha',run,'Synthetic ASHA');
 const wo=await api.get(owner,'/api/workspace'),wa=await api.get(asha,'/api/workspace');
 assert.equal(wo.status,200);assert.equal(wa.status,200);
 const org=wo.json.organisation.id,p=wo.json.people.find(p=>p.name==='Meena Devi');
 const invite=await api.command(owner,{type:'createInvite',accountCode:wa.json.user.accountCode,label:'Synthetic ASHA',role:'asha',teamIds:['default']},org);assert.equal(invite.status,200);
 assert.equal((await api.command(asha,{type:'joinOrganisation',token:invite.json.result.token})).status,200);
 assert.equal((await api.command(owner,{type:'assignPatient',personId:p.id,version:p.version,teamId:'default',assignedTo:wa.json.user.userId,reason:'Synthetic app UI check'},org)).status,200);
 browser=await chromium.launch({headless:true,...(process.env.SAHA_CHROMIUM?{executablePath:process.env.SAHA_CHROMIUM}:{})});
 const context=await browser.newContext({viewport:{width:390,height:844},extraHTTPHeaders:asha.headers});
 const page=await context.newPage(),pageErrors=[],auditedOpens=[];page.on('pageerror',e=>pageErrors.push(String(e)));page.on('response',r=>{if(new URL(r.url()).pathname==='/api/record-opened'&&r.status()===200)auditedOpens.push(r.url());});
 page.setDefaultTimeout(20000);await page.goto(worker.base+'/app');
 const snapshot=async()=> (await api.get(asha,'/api/workspace',org)).json;
 let current=(await snapshot()).people.find(x=>x.id===p.id);
 const enrol=await api.command(asha,{type:'enrolProgramme',personId:p.id,version:current.version,packId:'tb',episodeLabel:'Synthetic guided TB episode',startDate:null},org);assert.equal(enrol.status,200);
 await page.goto(worker.base+'/app?patient='+p.id);
 await page.getByRole('heading',{name:'Meena Devi',exact:true}).waitFor();
 await page.getByRole('button',{name:'Start visit',exact:true}).click();
 const picker=page.getByRole('combobox',{name:'Go to observation or save',exact:true});await picker.waitFor();
 const choose=async id=>{await picker.selectOption(id);await page.locator('.capture-stage[data-capture-step="'+id+'"]:visible').first().waitFor();};
 const readVisit=async()=> (await snapshot()).visits.filter(x=>x.personId===p.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0];
 let v=await readVisit();const original=JSON.stringify(v);

 await choose('programme:cough');await page.getByRole('combobox',{name:'Does the person report a cough?',exact:true}).click();await page.getByRole('option',{name:'Yes',exact:true}).click();
 const writes=[];let blocked=false;await page.route('**/api/commands',async route=>{const request=route.request(),body=request.postDataJSON();if(body.type==='saveProgrammeAnswers'&&!blocked){blocked=true;writes.push({body,key:request.headers()['idempotency-key']});await route.abort('failed');}else await route.continue();});
 await choose('programme-save');await page.getByRole('button',{name:'Save programme evidence',exact:true}).click();await page.getByText('Save response not confirmed.',{exact:true}).waitFor();
 check(await page.getByRole('button',{name:'Save programme evidence',exact:true}).isDisabled(),'Unconfirmed programme outcome blocks blind resend');
 check((await readVisit()).version===v.version,'Synthetic lost request left exact original saved revision');
 await choose('programme:cough');check(await page.getByRole('combobox',{name:'Does the person report a cough?',exact:true}).innerText()==='Yes','Local programme answer retained before explicit saved-record decision');
 await page.getByRole('button',{name:'View current saved record',exact:true}).click();await page.getByRole('dialog').waitFor();
 check(writes.length===1,'Current scoped read does not resend original programme command');
 await page.getByRole('button',{name:'Load saved record',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
 await choose('programme:cough');const observed=await page.getByRole('combobox',{name:'Does the person report a cough?',exact:true}).innerText(),saved=await readVisit();
 await page.screenshot({path:evidence+'/programme-after-load.png',fullPage:true});
 writeFileSync(evidence+'/programme-after-load.json',JSON.stringify({acceptedAssertions:5,priorPositiveAssertions:passed,actualChromium:true,actualWorker:true,originalVersion:v.version,currentVersion:saved.version,savedAnswers:saved.programmeCapture.answers,observedAnswer:observed,writes,scope:'Actual unconfirmed programme request, unchanged revision scoped read, explicit Load saved record.'},null,2)+'\n');
 check(observed==='Not answered','Explicit unchanged-revision Load saved record must reset programme answer to original saved value');
 writeFileSync(evidence+'/original-probe-result.json',JSON.stringify({passed,failed:0},null,2)+'\n');
}finally{await browser?.close();await worker?.stop();}
