// Real Chromium profile + IndexedDB + local synthetic Worker/D1. No hosted origin or external provider.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startWorker, identity, client } from '../lib/worker.mjs';
const { chromium } = await import(process.env.SAHA_BROWSER_PACKAGE ?? '@playwright/test');
const folder = 'tests/reports/worker-day-offline';
mkdirSync(folder, { recursive: true });
const profile = mkdtempSync(join(tmpdir(), 'saha-offline-profile-'));
const passphrase = 'Synthetic worker private passphrase';
let worker, context, page, passed = 0;
const checks = [];
const check = (name, condition) => { assert.ok(condition, name); passed++; checks.push(name); };
const need = (response, code, name) => assert.equal(response.status, code, `${name}: ${response.text?.slice(0,250)}`);
const idle = () => page.waitForFunction(() => !document.getElementById('save').disabled);
const unlock = async () => {
  await page.locator('#passphrase').fill(passphrase);
  await page.locator('#unlock-form button').click();
  await page.locator('#notebook').waitFor({ state: 'visible' });
  await idle();
};
const readBook = () => page.evaluate(async pass => {
  const vault = await import('/field/vault.js');
  const stored = await vault.readVault();
  return vault.unseal(await vault.derive(pass, stored.salt), stored);
}, passphrase);
const waitSaved = (notes, step) => page.waitForFunction(async ({ pass, notes, step }) => {
  const vault = await import('/field/vault.js'), stored = await vault.readVault();
  if (!stored) return false;
  const book = await vault.unseal(await vault.derive(pass, stored.salt), stored);
  return book.drafts.some(d => d.facts.notes === notes) && (!step || book.workerDay?.step === step);
}, { pass: passphrase, notes, step });
const chooseStep = async step => {
  for (let attempt=0; attempt<18; attempt++) {
    if (await page.locator(`[data-guided-step="${step}"]:visible`).count()) return;
    const next = page.getByRole('button', { name: 'Next', exact:true });
    await next.click();
  }
  throw Error('Guided step not reached: '+step);
};
try {
  worker = await startWorker({ port: '9163', name: 'saha-worker-day-offline' });
  const api = client(worker.base), run = crypto.randomUUID().slice(0,8);
  const owner = identity('owner',run,'Synthetic Owner');
  const asha = identity('asha',run,'Synthetic ASHA');
  const other = identity('other',run,'Other Account');
  const initial = await api.get(owner,'/api/workspace'); need(initial,200,'owner');
  const ashaInitial = await api.get(asha,'/api/workspace'); need(ashaInitial,200,'ASHA');
  const org = initial.json.organisation.id;
  const person = initial.json.people.find(p => p.name === 'Meena Devi');
  const invite = await api.command(owner,{type:'createInvite',accountCode:ashaInitial.json.user.accountCode,
    label:'Synthetic ASHA',role:'asha',teamIds:['default']},org); need(invite,200,'invite');
  need(await api.command(asha,{type:'joinOrganisation',token:invite.json.result.token}),200,'join');
  need(await api.command(owner,{type:'assignPatient',personId:person.id,version:person.version,
    teamId:'default',assignedTo:asha.id,reason:'Synthetic offline continuation test'},org),200,'assign');
  const launch = async offline => {
    context = await chromium.launchPersistentContext(profile,{headless:true,viewport:{width:360,height:640},
      extraHTTPHeaders:asha.headers,...(process.env.SAHA_CHROMIUM?{executablePath:process.env.SAHA_CHROMIUM}:{})});
    await context.setOffline(offline);
    page = context.pages()[0] ?? await context.newPage();
    page.setDefaultTimeout(25000);
  };
  await launch(false);
  await page.goto(worker.base+'/app?experience=worker-day');
  const offlineEntry = page.getByRole('link',{name:'Prepare or continue visits on this phone',exact:true});
  await offlineEntry.waitFor();
  check('Existing Today supplies an in-app offline-work entry',await offlineEntry.isVisible());
  await offlineEntry.click();
  await page.getByRole('heading',{name:'Continue your work',exact:true}).waitFor();
  check('No private record is displayed before unlock',!(await page.locator('body').innerText()).includes('Meena Devi'));
  await unlock();
  await page.locator('#load').click(); await idle();
  await page.waitForFunction(() => document.getElementById('patient').options.length > 0);
  check('Deep link is resolved only in the scoped online list',await page.locator('#patient').inputValue()===person.id);
  await page.locator('#prepare').click();
  await page.locator('#editor').getByRole('heading',{name:'Meena Devi',exact:true}).waitFor(); await idle();
  check('Prepared visit uses the original vault and server packet',(await readBook()).drafts.length===1);
  const issued = (await readBook()).drafts[0].packet.payload;
  check('Three stable navigation destinations',await page.getByRole('navigation',{name:'App navigation'}).getByRole('button').count()===3);
  await chooseStep('weight');
  await page.getByLabel('Weight · kg',{exact:true}).fill('57.5');
  await chooseStep('notes');
  await page.getByLabel('Notes',{exact:true}).fill('PRIVATE SYNTHETIC OFFLINE NOTE');
  await page.locator('#save').click(); await idle(); await waitSaved('PRIVATE SYNTHETIC OFFLINE NOTE','notes');
  check('Active record and step stored in the encrypted book',(await readBook()).workerDay.leaseId===issued.leaseId);
  await page.waitForFunction(async()=>{const registration=await navigator.serviceWorker.ready;return !!registration.active;});
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('heading',{name:'Continue your work',exact:true}).waitFor();
  check('Query-bearing offline entry reloads a public locked shell',await page.locator('#notebook').isHidden());
  await unlock();
  check('Offline reload resumes the current step',await page.locator('[data-guided-step="notes"]:visible').count()===1);
  check('Offline reload retains the acknowledged note',await page.getByLabel('Notes',{exact:true}).inputValue()==='PRIVATE SYNTHETIC OFFLINE NOTE');
  await page.getByLabel('Notes',{exact:true}).fill('PRIVATE SYNTHETIC OFFLINE NOTE AFTER LOSS');
  await page.locator('#save').click(); await idle(); await waitSaved('PRIVATE SYNTHETIC OFFLINE NOTE AFTER LOSS','notes');
  await context.close(); context = null;
  await launch(true);
  await page.goto(worker.base+'/app?experience=worker-day');
  await page.getByRole('heading',{name:'Continue your work',exact:true}).waitFor();
  check('Fresh browser process stays locked offline',!(await page.locator('body').innerText()).includes('Meena Devi'));
  await unlock();
  check('Fresh browser process resumes the exact visit',(await readBook()).workerDay.leaseId===issued.leaseId);
  check('Fresh browser process resumes the exact step',await page.locator('[data-guided-step="notes"]:visible').count()===1);
  check('Actual persisted IndexedDB retains offline edits',await page.getByLabel('Notes',{exact:true}).inputValue()==='PRIVATE SYNTHETIC OFFLINE NOTE AFTER LOSS');
  const stores = await page.evaluate(async()=>{
    const vault = await import('/field/vault.js'), assets=[];
    for (const name of await caches.keys()) { const cache=await caches.open(name);
      for (const request of await cache.keys()) assets.push({url:request.url,text:await(await cache.match(request)).text()}); }
    return {record:await vault.readVault(),local:{...localStorage},session:{...sessionStorage},assets};
  });
  check('No personal content in public caches or plaintext stores',!JSON.stringify(stores).includes('PRIVATE SYNTHETIC OFFLINE NOTE')&&!JSON.stringify(stores).includes('Meena Devi'));
  check('No API or query-bearing response in public cache',stores.assets.every(a=>!new URL(a.url).search&&!new URL(a.url).pathname.startsWith('/api/')));
  check('Phone view has no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:folder+'/offline-resumed.png',fullPage:true});
  const beforeFailure = await readBook();
  await page.evaluate(()=>{window.originalVaultPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(){throw new DOMException('Synthetic quota fault','QuotaExceededError');};});
  await page.getByLabel('Notes',{exact:true}).fill('UNACKNOWLEDGED QUOTA FAILURE');
  await page.locator('#save').click(); await idle();
  check('Failed device write is not acknowledged as saved',/failed|quota|विफल/i.test(await page.locator('#status').innerText()));
  check('Failed transaction keeps the earlier durable value',(await readBook()).drafts[0].facts.notes===beforeFailure.drafts[0].facts.notes);
  await page.evaluate(()=>{IDBObjectStore.prototype.put=window.originalVaultPut;delete window.originalVaultPut;});
  await page.getByLabel('Notes',{exact:true}).fill('PRIVATE SYNTHETIC OFFLINE NOTE AFTER LOSS');
  await page.locator('#save').click(); await idle(); await waitSaved('PRIVATE SYNTHETIC OFFLINE NOTE AFTER LOSS','notes');
  await context.setOffline(false);
  await page.locator('#notebook').waitFor({state:'visible'}); await idle();
  await chooseStep('review');
  let dropped = false, accepted = null;
  const dispatches = [];
  await page.route('**/api/commands',async route=>{
    const body=route.request().postDataJSON();
    if(body?.type!=='syncFieldVisit'){await route.continue();return;}
    dispatches.push({key:route.request().headers()['idempotency-key'],body});
    if(!dropped){accepted=await route.fetch();dropped=true;await route.abort('failed');}
    else await route.continue();
  });
  await page.getByRole('button',{name:'Sync reviewed draft',exact:true}).click(); await idle();
  check('A real accepted server response was deliberately lost',dropped&&accepted.status()===200);
  const pending = (await readBook()).drafts[0];
  check('Lost acknowledgement retains an immutable pending operation',!!pending.pending?.key&&pending.pending.key===dispatches[0].key);
  const acceptedVisit=(await api.get(asha,'/api/workspace',org)).json.visits.find(v=>v.id===issued.visitId);
  check('Server holds the correct unconfirmed draft after lost acknowledgement',acceptedVisit.state==='draft'&&acceptedVisit.facts.weight==='57.5');
  await page.unroute('**/api/commands');
  await page.getByRole('button',{name:'Retry same sync',exact:true}).click(); await idle();
  await page.getByText('Synced as an unconfirmed draft.',{exact:false}).waitFor();
  const reconciled=(await api.get(asha,'/api/workspace',org)).json;
  check('Reconciliation produces no second visit',reconciled.visits.filter(v=>v.personId===person.id).length===1);
  check('Reconciliation does not confirm the visit',reconciled.visits.find(v=>v.id===issued.visitId).state==='draft');
  check('Reconciliation retains the complete observation',reconciled.visits.find(v=>v.id===issued.visitId).facts.notes==='PRIVATE SYNTHETIC OFFLINE NOTE AFTER LOSS');
  await page.screenshot({path:folder+'/synced-draft.png',fullPage:true});
  await api.get(other,'/api/workspace');
  await context.setExtraHTTPHeaders(other.headers);
  await page.evaluate(()=>dispatchEvent(new Event('online')));
  await page.locator('#notebook').waitFor({state:'hidden'});
  check('Account change clears private presentation',!(await page.locator('body').innerText()).includes('Meena Devi'));
  await page.locator('#passphrase').fill(passphrase);await page.locator('#unlock-form button').click();
  await page.waitForFunction(()=>!document.querySelector('#unlock-form button').disabled);
  check('Knowing the passphrase cannot override a connected account refusal',await page.locator('#notebook').isHidden());
  const result={suite:'worker-day-offline-browser',passed,failed:0,skipped:0,checks,
    scope:'Actual Chromium process restart with retained profile/IndexedDB; local synthetic Worker/D1; injected quota failure and lost response. No physical handset, OS power-loss, clinical, programme or production acceptance.'};
  writeFileSync(folder+'/browser.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
} catch(error) {
  if(page) {try {await page.screenshot({path:folder+'/failed.png',fullPage:true});}catch{/* Original failure remains below. */}}
  const result={suite:'worker-day-offline-browser',passed,failed:1,skipped:0,checks,error:String(error)};
  writeFileSync(folder+'/browser.json',JSON.stringify(result,null,2)+'\n');console.error(JSON.stringify(result));throw error;
} finally {await context?.close();await worker?.stop();rmSync(profile,{recursive:true,force:true});}
