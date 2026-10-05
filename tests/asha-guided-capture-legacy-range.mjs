// Real pointer/keyboard regression for a content-sized textarea next to the speech microphone.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {startWorker,identity,client} from './lib/worker.mjs';
const {chromium}=await import(process.env.SAHA_BROWSER_PACKAGE??'@playwright/test');
const dir='tests/evidence/asha-guided-capture/legacy-range';mkdirSync(dir,{recursive:true});
let worker,browser,passed=0;const results=[];const check=(v,m)=>{assert.ok(v,m);passed++;};
try{
 worker=await startWorker({port:process.env.SAHA_TEST_PORT??'9057',name:'saha-capture-legacy-tap'});
 const api=client(worker.base),who=identity('first-tap',crypto.randomUUID().slice(0,8),'Synthetic Tap Reviewer');
 const s=(await api.get(who,'/api/workspace')).json,org=s.organisation.id;
 const command=async c=>{const r=await api.command(who,c,org);assert.equal(r.status,200,JSON.stringify(r.json));return r.json;};
 browser=await chromium.launch({headless:true,executablePath:process.env.SAHA_CHROMIUM});
 for(const mode of ['touch','mouse','keyboard']){
  const pid=(await command({type:'createPerson',name:`Synthetic ${mode} Capture`,age:8,sex:'Female',village:'Synthetic Tap Village',programme:'Child health',teamId:'default'})).result.personId;
  const started=await command({type:'startVisit',personId:pid}),vid=started.result.visitId;
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:mode==='touch',hasTouch:mode==='touch',extraHTTPHeaders:who.headers});
  const page=await ctx.newPage();page.setDefaultTimeout(20000);let requests=0;
  page.on('request',r=>{if(r.url().endsWith('/api/commands')&&r.postDataJSON()?.type==='saveVisit')requests++;});
  await page.goto(worker.base+`/app?patient=${pid}&visit=${vid}`);
  await page.getByRole('textbox',{name:'Weight · kg',exact:true}).fill('180');
  const reason=page.getByRole('textbox',{name:'Reason for unusual weight (at least 10 characters)',exact:true});
  const text='Synthetic reported weight checked against original capture';await reason.fill(text);
  check(await reason.evaluate(el=>document.activeElement===el),'Editing keeps textarea focused before save');
  check(await reason.evaluate(el=>getComputedStyle(el).paddingRight==='44px'),'Eligible textarea reserves the microphone gutter while focused');
  await page.evaluate(()=>{window.__tapEvents=[];window.__save=document.querySelector('.form-actions button');for(const t of ['pointerdown','pointerup','touchstart','touchend','focusout','click'])document.addEventListener(t,e=>window.__tapEvents.push({type:t,target:e.target.tagName,save:e.target===window.__save,same:window.__save===document.querySelector('.form-actions button'),connected:window.__save?.isConnected,top:window.__save?.getBoundingClientRect().top,scrollY}),true);});
  const save=page.getByRole('button',{name:'Save draft',exact:true});
  if(mode==='touch')await save.tap();else if(mode==='mouse')await save.click();else{
   // Reach the native button by keyboard, rather than giving it synthetic focus.
   for(let n=0;n<12&&!(await save.evaluate(el=>document.activeElement===el));n++)await page.keyboard.press('Tab');
   check(await save.evaluate(el=>document.activeElement===el),'Keyboard tab reaches the save button');await page.keyboard.press('Enter');
  }
  await page.getByText('Draft saved in the workspace.',{exact:true}).waitFor();
  const events=await page.evaluate(()=>window.__tapEvents),click=events.find(e=>e.type==='click');
  check(click?.save,'First activation clicks the actual save button');check(requests===1,'First activation sends exactly one save request');
  const down=events.find(e=>e.type==='pointerdown');if(down)check(Math.abs(down.top-click.top)<0.1,'Button does not move between pointerdown and click');
  const fresh=(await api.get(who,'/api/workspace',org)).json,visit=fresh.visits.find(v=>v.id===vid);
  check(visit.facts.weight==='180'&&visit.facts.unusual.weight===text,'Save preserves the edited value and reason');
  results.push({mode,requests,events,savedVersion:visit.version});await ctx.close();
 }
 writeFileSync(dir+'/first-activation-regression.json',JSON.stringify({passed,failed:0,scope:'Actual Chromium/Worker/D1 first touch, mouse and keyboard activation immediately after editing content-sized unusual-value reason; no preparatory button focus. Synthetic only; emulated phone, not a physical Android keyboard.',results},null,2)+'\n');console.log(JSON.stringify({suite:'range-first-tap-browser',passed,failed:0}));
}catch(e){writeFileSync(dir+'/first-activation-regression.json',JSON.stringify({passed,failed:1,error:String(e),results},null,2)+'\n');throw e;}finally{await browser?.close();await worker?.stop();}
