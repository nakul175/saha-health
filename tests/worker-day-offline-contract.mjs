import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { workerDayRequest, workerDayCheckpoint, restoreWorkerDay } from '../public/field/worker-day.js';
import { derive, seal, unseal } from '../public/field/vault.js';
import vm from 'node:vm';
const now = Date.now();
const draft = (id, userId = 'worker') => ({ packet: { payload: {
  leaseId: id, userId, personName: 'Synthetic private name', issuedAt: new Date(now).toISOString(),
  expiresAt: new Date(now + 86400000).toISOString(),
} }, facts: { notes: 'PRIVATE SYNTHETIC NOTE' }, state: 'draft' });
const book = { userId: 'worker', drafts: [draft('first'), draft('second')] };
let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('PASS '+name); };
check('Only explicit worker-day opt-in', () => assert.equal(workerDayRequest('?x=worker-day').enabled, false));
check('Worker-day opt-in', () => assert.equal(workerDayRequest('?experience=worker-day').enabled, true));
check('Oversized deep links refused', () => assert.equal(workerDayRequest('?personId='+ 'x'.repeat(201)).personId, null));
const state = { tab: 'patient', selected: 'second', step: 'notes', lang: 'hi' };
const checkpoint = workerDayCheckpoint(book, state, now);
check('Selected second visit preserved, not first in book', () => assert.equal(checkpoint.leaseId, 'second'));
check('Current step preserved', () => assert.equal(checkpoint.step, 'notes'));
check('Language preserved', () => assert.equal(checkpoint.language, 'hi'));
check('Metadata has no clinical payload', () => assert.deepEqual(Object.keys(checkpoint), ['version','tab','leaseId','step','language']));
check('Inputs unchanged', () => assert.equal(book.workerDay, undefined));
check('Missing lease falls back safely', () => assert.equal(workerDayCheckpoint(book, {...state,selected:'missing'},now).tab, 'today'));
check('Wrong-account lease is not resumable', () => assert.equal(workerDayCheckpoint({...book,userId:'other'},state,now).leaseId, null));
check('Expired lease not resumable', () => assert.equal(workerDayCheckpoint(book,state,now+86400000).leaseId, null));
check('Removed lease does not reappear', () => assert.equal(restoreWorkerDay({...book,drafts:[],workerDay:checkpoint},now).leaseId, null));
check('Unknown schema cannot restore arbitrary UI state', () => assert.equal(restoreWorkerDay({...book,workerDay:{...checkpoint,version:99}},now).tab, 'today'));
check('Unsupported tab falls back', () => assert.equal(workerDayCheckpoint(book,{...state,tab:'admin'},now).tab,'today'));
check('Absent metadata keeps old notebooks readable', () => assert.equal(restoreWorkerDay(book,now).tab,'today'));
check('Round-trip restores active record and step', () => assert.deepEqual(restoreWorkerDay({...book,workerDay:checkpoint},now),checkpoint));
const salt = crypto.getRandomValues(new Uint8Array(16));
const key = await derive('Synthetic private test passphrase',salt);
const encrypted = await seal(key,{...book,workerDay:checkpoint});
check('No names or facts in ciphertext JSON', () => assert.ok(!JSON.stringify(encrypted).includes('PRIVATE')));
check('Existing vault crypto preserves continuation', () => assert.equal(typeof encrypted.cipher[0],'number'));
const recovered = await unseal(key,encrypted);
check('Encrypted continuation survives decode', () => assert.deepEqual(restoreWorkerDay(recovered,now),checkpoint));
const handlers = {};
const origin = 'https://synthetic.example';
const ctx = vm.createContext({ URL, Response, Error, Promise, self:{location:{origin},navigator:{onLine:false},
  addEventListener:(type,fn)=>handlers[type]=fn}, caches:{open:async()=>({match:async path=>new Response(path)})},
  fetch:async()=>{throw Error('No network');} });
vm.runInContext(readFileSync('public/app-sw.js','utf8'),ctx);
for (const path of ['/app?experience=worker-day','/app/offline/?experience=worker-day','/app/offline/index.html?experience=worker-day']) {
  let response; handlers.fetch({request:{url:origin+path,method:'GET',mode:'navigate'},respondWith:p=>response=p});
  const body = response ? await (await response).text() : null;
  check('Offline public-shell fallback '+path,()=>assert.equal(body,'/app/offline/'));
}
for (const path of ['/api/workspace','/api/commands','/signin-with-chatgpt','/field/app.js?patient=secret']) {
  let intercepted=false; handlers.fetch({request:{url:origin+path,method:'GET',mode:'cors'},respondWith:()=>{intercepted=true;}});
  check('Never cache private/auth/query payload '+path,()=>assert.equal(intercepted,false));
}
const result={suite:'worker-day-offline-contract',passed,failed:0,skipped:0,scope:'Pure metadata, real Web Crypto and injected service-worker events; not browser durability.'};
mkdirSync('tests/reports/worker-day-offline',{recursive:true});
writeFileSync('tests/reports/worker-day-offline/contract.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
