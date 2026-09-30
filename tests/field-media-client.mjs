// Slice 3a: offline media queue in the field notebook. Runs public/field/app.js in Node with real
// Web Crypto, the real media sealing functions, injected storage/network and a minimal DOM.
// Real IndexedDB, camera/microphone capture and service-worker behaviour are covered only by the
// separate browser check, not here.
import vm from 'node:vm';import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';
import {derive,seal,unseal,verifyPacket,packetHash,sealBytes,unsealBytes} from '../public/field/vault.js';
class Element{constructor(tag='div'){this.tag=tag;this.children=[];this.value='';this.hidden=false;this.style={};this.disabled=false;}append(...c){this.children.push(...c)}prepend(...c){this.children.unshift(...c)}replaceChildren(...c){this.children=c}querySelector(tag){return this.children.find(c=>c.tag===tag)||this.children.map(c=>c.querySelector?.(tag)).find(Boolean)||null}}
const elements=new Map();const byId=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id)};
let record=null,calls=[],network=async()=>{throw Error('Network disconnected')},failDelete=false;const media=new Map();
const context=vm.createContext({console,crypto,TextEncoder,TextDecoder,structuredClone,Date,Map,Array,Promise,Error,JSON,Uint8Array,setTimeout:()=>0,clearTimeout:()=>{},derive,seal,unseal,verifyPacket,packetHash,sealBytes,unsealBytes,
 readVault:async()=>structuredClone(record),writeVault:async(value,expected)=>{if((record?.revision??0)!==expected)throw Error('Another tab changed the vault');record={...structuredClone(value),revision:expected+1};return record.revision;},deleteVault:async()=>{record=null;media.clear();},
 writeMedia:async(id,value)=>{media.set(id,structuredClone(value))},readMedia:async id=>structuredClone(media.get(id)??null),deleteMedia:async id=>{if(failDelete)throw Error('Delete failed');media.delete(id)},listMediaIds:async()=>[...media.keys()],
 fetch:async(url,options)=>{calls.push({url,options});return network(url,options)},navigator:{onLine:true},window:{indexedDB:{},addEventListener:()=>{}},document:{hidden:false,documentElement:{},getElementById:byId,createElement:tag=>new Element(tag),addEventListener:()=>{}}});
vm.runInContext(readFileSync('public/field/app.js','utf8').replace(/^import[^\n]*\n/,''),context);
const run=code=>vm.runInContext(code,context),check=fn=>{fn();passed++};let passed=0;
const rejects=async(code,pattern)=>{await assert.rejects(()=>run(code),pattern);passed++;};
byId('passphrase').value='synthetic-media-test-phrase';await byId('unlock-form').onsubmit({preventDefault(){}});
for(let i=0;i<200&&run('busy');i++)await new Promise(r=>setTimeout(r,5));check(()=>assert.ok(run('book')));
const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
async function draft(lease,visitId,hours=24){
 const payload={schema:1,leaseId:lease,userId:'worker-1',organisationId:'org-1',personId:'p-1',personName:'Synthetic media test',identityHash:'id',visitId,visitVersion:1,expiresAt:new Date(Date.now()+hours*3600000).toISOString(),issuedAt:new Date().toISOString(),facts:{date:new Date().toISOString().slice(0,16),source:'measured',notes:'',weight:'70',systolic:'',diastolic:'',temperature:'',weeks:'',coughDays:''},programmeCapture:null};
 const packet={payload,signature:Array.from(new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},pair.privateKey,new TextEncoder().encode(JSON.stringify(payload))))),publicKey:await crypto.subtle.exportKey('jwk',pair.publicKey)};
 return {packet,packageHash:await packetHash(packet),facts:structuredClone(payload.facts),answers:{},absence:{},state:'draft',pending:null};
}
// Synthetic files: a PNG and an Ogg recording with valid signatures and random bodies.
const file=(mime,head,size)=>{const b=new Uint8Array(size);for(let i=0;i<size;i+=65536)crypto.getRandomValues(b.subarray(i,Math.min(size,i+65536)));b.set(head);return {type:mime,bytes:b,arrayBuffer:async()=>b.slice().buffer};};
const PNG=[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a],OGG=[0x4f,0x67,0x67,0x53];
context.fixture=await draft('lease-1','v-1');await run("book.userId='worker-1';book.drafts.push(fixture);selected='lease-1';persist()");
const photo=file('image/png',PNG,4096);context.f=photo;
await rejects("attach(active(),f,'')",/Choose why/);
context.f={...file('text/plain',[0x3c,0x68],4096)};await rejects("attach(active(),f,'other-clinical')",/JPEG, PNG or WebP/);
context.f={...file('image/jpeg',PNG,4096)};await rejects("attach(active(),f,'wound-or-skin')",/does not match/);
context.f=file('image/png',PNG,100);await rejects("attach(active(),f,'wound-or-skin')",/too small/);
context.f=file('image/png',PNG,256*1024+1);await rejects("attach(active(),f,'wound-or-skin')",/256 KB or smaller/);
context.f=photo;await rejects("attach(active(),f,'voice-note')",/voice note must be audio/);
check(()=>assert.equal(media.size,0));
await run("attach(active(),f,'wound-or-skin')");
check(()=>assert.equal(run('active().media.length'),1));check(()=>assert.equal(run('active().media[0].state'),'queued'));check(()=>assert.equal(media.size,1));
const item=run('active().media[0]'),stored=media.get(item.id);
check(()=>assert.notDeepEqual(Array.from(stored.cipher.slice(0,8)),PNG));
check(()=>assert.equal(JSON.stringify(record).includes(Buffer.from(photo.bytes.slice(8,40)).toString('base64')),false));
const opened=await unsealBytes(run('key'),stored);check(()=>assert.deepEqual(Array.from(opened),Array.from(photo.bytes)));
await rejects("attach(active(),f,'wound-or-skin')",/already attached/);
for(let i=0;i<3;i++){context.f=file('audio/ogg',OGG,2048);await run("attach(active(),f,'voice-note')");}
context.f=file('audio/ogg',OGG,2048);await rejects("attach(active(),f,'voice-note')",/At most 4/);
check(()=>assert.equal(calls.length,0));
// Lock and unlock: queued metadata survives, bytes stay sealed on the device.
run('lock()');await run('chain');check(()=>assert.equal(run('book'),null));
await run("run(async()=>{const r=await readVault();key=await derive('synthetic-media-test-phrase',r.salt);salt=r.salt;revision=r.revision;book=await unseal(key,r);selected='lease-1';})");for(let i=0;i<200&&run('busy');i++)await new Promise(r=>setTimeout(r,5));
check(()=>assert.equal(run('active().media.length'),4));
// Discard one queued voice note: its sealed bytes are deleted.
const dropped=run('active().media[3].id');await run('discardMedia(active(),active().media[3])');check(()=>assert.equal(media.has(dropped),false));check(()=>assert.equal(run('active().media.length'),3));
// Sync with a current grant, patient and draft visit: the draft syncs, then each item uploads with its own id as the key.
const workspace=(visitState='draft',people=[{id:'p-1'}])=>({user:{userId:'worker-1'},role:'asha',organisation:{id:'org-1'},organisations:[],people,visits:[{id:'v-1',personId:'p-1',state:visitState,version:2}]});
let uploads=[],failMediaOnce=false;
network=async(url,options)=>{
 if(url==='/api/workspace')return {ok:true,json:async()=>workspace()};
 if(url==='/api/commands')return {ok:true,json:async()=>({result:{visitId:'v-1',version:2}})};
 if(url.startsWith('/api/media')){if(failMediaOnce){failMediaOnce=false;throw Error('Response lost');}uploads.push({url,key:options.headers['Idempotency-Key'],type:options.headers['Content-Type'],body:options.body});return {ok:true,json:async()=>({mediaId:'m-'+uploads.length,size:options.body.byteLength})};}
 throw Error('Unexpected '+url);};
failMediaOnce=true;await rejects('sync(active())',/Upload outcome not confirmed/);
check(()=>assert.equal(run('active().state'),'synced'));check(()=>assert.equal(run('active().media[0].pending'),true));check(()=>assert.equal(uploads.length,0));
await rejects('discardMedia(active(),active().media[0])',/pending upload/);
const lostKey=calls.filter(c=>c.url.startsWith('/api/media')).at(-1).options.headers['Idempotency-Key'];check(()=>assert.equal(lostKey,item.id));
check(()=>assert.equal(run('active().media.filter(x=>x.state==="queued").length'),3));
const sent=await run('uploadMedia(active())');check(()=>assert.equal(sent,3));
check(()=>assert.equal(uploads[0].key,item.id));check(()=>assert.equal(uploads[0].type,'image/png'));check(()=>assert.deepEqual(Array.from(uploads[0].body),Array.from(photo.bytes)));
check(()=>assert.ok(uploads[0].url.includes('visitId=v-1')&&uploads[0].url.includes('purpose=wound-or-skin')));
check(()=>assert.equal(run('active().media.every(x=>x.state==="uploaded"&&!x.pending&&x.mediaId)'),true));check(()=>assert.equal(media.size,0));
check(()=>assert.equal(new Set(uploads.map(u=>u.key)).size,3));
// Each routing-to-review case sends nothing and keeps the sealed copy until the worker discards it.
async function reviewCase(name,setup,pattern){
 const lease='lease-'+name;context.fixture=await draft(lease,'v-1',setup.hours??24);await run(`book.drafts.push(fixture);selected='${lease}';persist()`);
 context.f=file('image/png',PNG,1024+Math.floor(Math.random()*500));await run("attach(active(),f,'document-or-card')");
 await run("active().state='synced';persist()");if(setup.expire)await run("active().packet.payload.expiresAt=new Date(Date.now()-1000).toISOString()");if(setup.damage){const id=run('active().media[0].id'),r=media.get(id);r.cipher[0]^=1;}
 const before=uploads.length,beforeCalls=calls.filter(c=>c.url.startsWith('/api/media')).length;
 network=async(url,options)=>{if(url==='/api/workspace')return {ok:true,json:async()=>setup.workspace??workspace()};if(url.startsWith('/api/media')){if(setup.status)return {ok:false,status:setup.status,json:async()=>({error:setup.error})};uploads.push(url);return {ok:true,json:async()=>({mediaId:'x'})};}throw Error('Unexpected '+url);};
 if(setup.throws)await rejects('uploadMedia(active())',setup.throws);else await run('uploadMedia(active())');
 const it=run('active().media[0]');
 if(!setup.throws){check(()=>assert.equal(it.state,'review'));check(()=>assert.match(it.reason,pattern));check(()=>assert.equal(media.has(it.id),true));}
 check(()=>assert.equal(uploads.length,before));
 if(!setup.status&&!setup.throws)check(()=>assert.equal(calls.filter(c=>c.url.startsWith('/api/media')).length,beforeCalls));
 return it;
}
await reviewCase('expired',{expire:true},/grant expired/);
await reviewCase('confirmed',{workspace:workspace('confirmed')},/no longer a draft/);
await reviewCase('noaccess',{workspace:workspace('draft',[])},/no longer have access/);
await reviewCase('damaged',{damage:true},/missing or damaged/);
const refused=await reviewCase('refused',{status:403,error:'You do not have access to this patient.'},/do not have access/);
await run('discardMedia(active(),active().media[0])');check(()=>assert.equal(media.has(refused.id),false));
const retry=await reviewCase('server',{status:503,error:'Service unavailable.',throws:/Service unavailable/},null);
check(()=>assert.equal(retry.state,'queued'));check(()=>assert.equal(retry.pending,true));check(()=>assert.equal(media.has(retry.id),true));
// A synced copy cannot be removed while any media item is pending, queued or in review; after an explicit discard it can.
const removeButton=()=>{run('render()');const find=n=>n.tag==='button'&&String(n.textContent??'').startsWith('Remove synced copy')?n:(n.children??[]).map(find).find(Boolean);return find(byId('editor'));};
const click=async()=>{removeButton().onclick();for(let i=0;i<200&&run('busy');i++)await new Promise(r=>setTimeout(r,5));};
await click();check(()=>assert.ok(run("book.drafts.some(d=>d.packet.payload.leaseId==='lease-server')")));check(()=>assert.match(byId('status').textContent,/pending upload/));
await run("active().media[0].pending=false;persist()");await click();
check(()=>assert.ok(run("book.drafts.some(d=>d.packet.payload.leaseId==='lease-server')"),'queued media blocks removal'));check(()=>assert.match(byId('status').textContent,/Upload or discard each photo/));check(()=>assert.equal(media.has(retry.id),true));
await run('discardMedia(active(),active().media[0])');await click();
check(()=>assert.equal(run("book.drafts.some(d=>d.packet.payload.leaseId==='lease-server')"),false));check(()=>assert.equal(media.has(retry.id),false));
// Review hardening (slice 3c).
async function queuedDraft(name){context.fixture=await draft('lease-'+name,'v-1');await run(`book.drafts.push(fixture);selected='lease-${name}';persist()`);context.f=file('image/png',PNG,1500+Math.floor(Math.random()*400));await run("attach(active(),f,'other-clinical')");await run("active().state='synced';persist()");return run('active().media[0].id');}
const okWorkspace=async url=>url==='/api/workspace'?{ok:true,json:async()=>workspace()}:null;
// 1. A 2xx response that does not name the stored media (for example a sign-in page) keeps the item pending and the device copy.
let id=await queuedDraft('html');
network=async(url,options)=>(await okWorkspace(url))??{ok:true,status:200,json:async()=>{throw SyntaxError('Unexpected token <')}};
await rejects('uploadMedia(active())',/did not name the stored file/);
check(()=>assert.equal(run('active().media[0].pending'),true));check(()=>assert.equal(run('active().media[0].state'),'queued'));check(()=>assert.equal(media.has(id),true));
check(()=>assert.equal(calls.filter(c=>c.url.startsWith('/api/media')).at(-1).options.redirect,'error','redirects are refused, not followed'));
network=async(url,options)=>(await okWorkspace(url))??{ok:true,json:async()=>({mediaId:'m-html'})};await run('uploadMedia(active())');
check(()=>assert.equal(calls.filter(c=>c.url.startsWith('/api/media')).at(-1).options.headers['Idempotency-Key'],id,'retry uses the same key'));check(()=>assert.equal(media.has(id),false));
// 2. Locking while the device copy is being opened sends nothing and leaves the item queued.
id=await queuedDraft('lock');const before=calls.filter(c=>c.url.startsWith('/api/media')).length;
const realUnseal=context.unsealBytes;context.unsealBytes=async(...a)=>{const out=await realUnseal(...a);run('epoch++');return out;};
await run('uploadMedia(active())');context.unsealBytes=realUnseal;await run('epoch++');
check(()=>assert.equal(calls.filter(c=>c.url.startsWith('/api/media')).length,before,'nothing sent after the lock'));check(()=>assert.equal(run('active().media[0].state'),'queued'));check(()=>assert.equal(!!run('active().media[0].pending'),false));
await run(`active().media=[];persist()`);
// 3. Sealed copies left behind are swept: after a failed device delete, and after a failed notebook save.
id=await queuedDraft('sweep');failDelete=true;await run('uploadMedia(active())');failDelete=false;
check(()=>assert.equal(run('active().media[0].state'),'uploaded'));check(()=>assert.equal(media.has(id),true,'device delete failed'));
media.set('orphan-from-failed-save',{iv:[1],cipher:new Uint8Array(4)});
await run('sweepMedia()');check(()=>assert.equal(media.has(id),false));check(()=>assert.equal(media.has('orphan-from-failed-save'),false));
context.fixture=await draft('lease-savefail','v-1');await run("book.drafts.push(fixture);selected='lease-savefail';persist()");
const rev=record.revision;record.revision++;context.f=file('image/png',PNG,1700);const size=media.size;
await rejects("attach(active(),f,'other-clinical')",/Another tab/);record.revision=rev;
check(()=>assert.equal(media.size,size,'bytes removed when the notebook save fails'));check(()=>assert.equal(run('active().media.length'),0));
writeFileSync('tests/field-media-client-result.json',JSON.stringify({passed,completedAt:new Date().toISOString(),coverage:'Field notebook offline media queue with real Web Crypto and injected storage/network: local type, signature, size and purpose checks; sealed per-item storage without bytes in the notebook; per-draft limit; lock/unlock survival; discard; upload only after sync with the item id as idempotency key and an identical body; lost response kept pending and retried with the same key; expired grant, confirmed visit, lost access, damaged copy and server refusal routed to review with nothing sent; temporary server failure kept pending; removal blocked while any item is pending, queued or in review, then allowed after discard; a 2xx without a media id kept pending with redirects refused; lock during upload sends nothing; orphaned sealed copies swept; failed notebook save removes the new copy. Real IndexedDB, camera/microphone and service-worker behaviour are not tested here.'},null,2)+'\n');
console.log(`${passed} field media queue checks passed`);
