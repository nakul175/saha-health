// Device privacy is injected here; its server/IndexedDB effects are verified in device-work-contract/browser.
import {deviceDigest} from '../public/field/device-work.js';
// Slice 3d: in-app voice-note recording in the field notebook. Runs public/field/app.js in Node with
// real Web Crypto and the real sealing functions, and an injected MediaRecorder, microphone, storage and
// network. Real microphone capture is covered only by the separate browser check.
import vm from 'node:vm';import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';
import {derive,seal,unseal,verifyPacket,packetHash,sealBytes,unsealBytes} from '../public/field/vault.js';
class Element{constructor(tag='div'){this.tag=tag;this.children=[];this.value='';this.hidden=false;this.style={};this.disabled=false;}append(...c){this.children.push(...c)}prepend(...c){this.children.unshift(...c)}replaceChildren(...c){this.children=c}querySelector(tag){return this.children.find(c=>c.tag===tag)||this.children.map(c=>c.querySelector?.(tag)).find(Boolean)||null}}
const elements=new Map();const byId=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id)};
let record=null,calls=[];const media=new Map(),timers=[],tracks=[];let permission=true,supported=['audio/webm;codecs=opus'];
class FakeRecorder{static isTypeSupported(t){return supported.includes(t)}constructor(stream,options){this.stream=stream;this.options=options;this.state='inactive';FakeRecorder.last=this;}start(slice){this.slice=slice;this.state='recording';}stop(){if(this.state!=='recording')return;this.state='inactive';this.stopped=(this.stopped??0)+1;queueMicrotask(()=>this.onstop?.());}emit(bytes){this.ondataavailable?.({data:new Blob([bytes])});}}
const navigator={onLine:true,mediaDevices:{getUserMedia:async()=>{if(!permission)throw Error('NotAllowedError');const t={stopped:false,stop(){this.stopped=true}};tracks.push(t);return {getTracks:()=>[t]};}}};
const window={indexedDB:{},addEventListener:()=>{},MediaRecorder:FakeRecorder};
const context=vm.createContext({deviceDigest,privacyReviewRequired:()=>false,clearPrivacyReviewRequired:()=>true,reconcileDeviceBook:async(book,_key,_salt,revision)=>({book,revision,removed:0}),reportDeviceFailure:async()=>false,console,crypto,TextEncoder,TextDecoder,structuredClone,Date,Map,Array,Promise,Error,JSON,Uint8Array,Blob,Number,Math,queueMicrotask,setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length},clearTimeout:()=>{},derive,seal,unseal,verifyPacket,packetHash,sealBytes,unsealBytes,
 readVault:async()=>structuredClone(record),writeVault:async(value,expected)=>{if((record?.revision??0)!==expected)throw Error('Another tab changed the vault');record={...structuredClone(value),revision:expected+1};return record.revision;},deleteVault:async()=>{record=null;media.clear();},
 writeMedia:async(id,value)=>{media.set(id,structuredClone(value))},readMedia:async id=>structuredClone(media.get(id)??null),deleteMedia:async id=>{media.delete(id)},listMediaIds:async()=>[...media.keys()],
 fetch:async(url,options)=>{calls.push({url,options});throw Error('Network disconnected')},navigator,window,document:{body:{dataset:{}},hidden:false,documentElement:{},getElementById:byId,createElement:tag=>new Element(tag),addEventListener:()=>{}}});
vm.runInContext(readFileSync('public/field/app.js','utf8').replace(/^import[^\n]*\n/gm,''),context);
const run=code=>vm.runInContext(code,context),check=fn=>{fn();passed++};let passed=0;
const idle=async()=>{for(let i=0;i<400&&run('busy');i++)await new Promise(r=>setTimeout(r,5));await new Promise(r=>setTimeout(r,20));for(let i=0;i<400&&run('busy');i++)await new Promise(r=>setTimeout(r,5));};
byId('passphrase').value='synthetic-recording-phrase';await byId('unlock-form').onsubmit({preventDefault(){}});await idle();check(()=>assert.ok(run('book')));
const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
async function draft(lease){const payload={schema:1,leaseId:lease,userId:'worker-1',organisationId:'org-1',personId:'p-1',personName:'Synthetic recording test',identityHash:'id',visitId:'v-1',visitVersion:1,expiresAt:new Date(Date.now()+86400000).toISOString(),issuedAt:new Date().toISOString(),facts:{date:new Date().toISOString().slice(0,16),source:'measured',notes:'',weight:'',systolic:'',diastolic:'',temperature:'',weeks:'',coughDays:''},programmeCapture:null};
 const packet={payload,signature:Array.from(new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},pair.privateKey,new TextEncoder().encode(JSON.stringify(payload))))),publicKey:await crypto.subtle.exportKey('jwk',pair.publicKey)};
 return {packet,packageHash:await packetHash(packet),facts:structuredClone(payload.facts),answers:{},absence:{},state:'draft',pending:null};}
context.fixture=await draft('lease-1');await run("book.userId='worker-1';book.drafts.push(fixture);selected='lease-1';persist()");
const webm=n=>{const b=new Uint8Array(n);for(let i=0;i<n;i++)b[i]=(i*13)&255;b.set([0x1a,0x45,0xdf,0xa3]);return b;},body=n=>{const b=new Uint8Array(n);for(let i=0;i<n;i++)b[i]=(i*7)&255;return b;};
// Recording, then Stop: the result is queued as a voice note with the plain audio type, and the microphone is released.
await run('record(active())');const r1=FakeRecorder.last;
check(()=>assert.equal(r1.state,'recording'));check(()=>assert.equal(r1.options.audioBitsPerSecond,24000));check(()=>assert.equal(r1.options.mimeType,'audio/webm;codecs=opus'));check(()=>assert.equal(r1.slice,1000));
check(()=>assert.match(byId('status').textContent,/Recording/));check(()=>assert.ok(timers.some(t=>t.ms===60000),'60-second stop scheduled'));
r1.emit(webm(1500));r1.emit(body(2000));await run('record(active())');await idle();
check(()=>assert.equal(r1.stopped,1));check(()=>assert.equal(tracks[0].stopped,true));check(()=>assert.equal(run('recording'),null));
check(()=>{const m=run('active().media');assert.equal(m.length,1);assert.equal(m[0].purpose,'voice-note');assert.equal(m[0].mime,'audio/webm');assert.equal(m[0].size,3500);assert.equal(m[0].state,'queued');});
check(()=>assert.equal(media.size,1));check(()=>assert.equal(calls.length,0,'nothing sent while recording or queueing'));
// The 60-second timer stops a recording by itself.
await run('record(active())');const r2=FakeRecorder.last;r2.emit(webm(900));timers.filter(t=>t.ms===60000).at(-1).fn();await idle();
check(()=>assert.equal(r2.stopped,1));check(()=>assert.equal(run('active().media.length'),2));
// Recording stops by itself near the 256 KB limit.
await run('record(active())');const r3=FakeRecorder.last;r3.emit(webm(120*1024));check(()=>assert.equal(r3.state,'recording'));r3.emit(body(125*1024));await idle();
check(()=>assert.equal(r3.stopped,1,'stopped once past 240 KB'));check(()=>assert.equal(run('active().media.length'),3));check(()=>assert.equal(run('active().media[2].size'),245*1024));
// Locking during a recording discards it and releases the microphone.
await run('record(active())');const r4=FakeRecorder.last;r4.emit(webm(800));const t4=tracks.at(-1);run('lock()');await run('chain');await idle();
check(()=>assert.equal(t4.stopped,true));check(()=>assert.equal(run('recording'),null));check(()=>assert.equal(media.size,3,'nothing queued from a discarded recording'));
await run("run(async()=>{const r=await readVault();key=await derive('synthetic-recording-phrase',r.salt);salt=r.salt;revision=r.revision;book=await unseal(key,r);selected='lease-1';})");await idle();
check(()=>assert.equal(run('active().media.length'),3));
// Refusals: no permission, no supported type, synced draft; nothing recorded.
permission=false;const before=FakeRecorder.last;await assert.rejects(()=>run('record(active())'),/Microphone permission was not given/);passed++;check(()=>assert.equal(FakeRecorder.last,before));permission=true;
supported=[];await assert.rejects(()=>run('record(active())'),/Recording is not available/);passed++;supported=['audio/webm;codecs=opus'];
await run("active().state='synced';persist()");await assert.rejects(()=>run('record(active())'),/before syncing/);passed++;check(()=>assert.equal(FakeRecorder.last,before));
writeFileSync('tests/field-recording-client-result.json',JSON.stringify({passed,completedAt:new Date().toISOString(),coverage:'Field notebook in-app voice recording with an injected MediaRecorder and microphone: 24 kbps, 1-second slices, Stop queues a voice note with the plain audio type and releases the microphone, 60-second and size-limit auto-stops, lock discards a recording and releases the microphone, refusals for denied permission, unsupported browser and synced drafts. Real microphone capture is covered by the browser check only.'},null,2)+'\n');
console.log(`${passed} field recording checks passed`);
