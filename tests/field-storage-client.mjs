import {offlineOpenHarness} from './lib/offline-open-harness.mjs';
// Device privacy is injected here; its server/IndexedDB effects are verified in device-work-contract/browser.
import {deviceDigest} from '../public/field/device-work.js';
// Slice 3b: device storage warnings in the field notebook. Runs public/field/app.js in Node with
// real Web Crypto, injected storage/network, an injected StorageManager and a minimal DOM. Real
// browser quota, persistence grants and eviction are not tested here.
import vm from 'node:vm';import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';
import {derive,seal,unseal,verifyPacket,packetHash,sealBytes,unsealBytes} from '../public/field/vault.js';
class Element{constructor(tag='div'){this.tag=tag;this.children=[];this.value='';this.hidden=false;this.style={};this.disabled=false;this.className='';}append(...c){this.children.push(...c)}prepend(...c){this.children.unshift(...c)}replaceChildren(...c){this.children=c}querySelector(tag){return this.children.find(c=>c.tag===tag)||this.children.map(c=>c.querySelector?.(tag)).find(Boolean)||null}}
const elements=new Map();const byId=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id)};
let record=null,calls=[];const media=new Map(),MB=1048576;
const storage={persistedValue:false,persistResult:true,persistCalls:0,estimateValue:{usage:10*MB,quota:1000*MB},estimateThrows:false,
 persisted:async()=>storage.persistedValue,persist:async()=>{storage.persistCalls++;storage.persistedValue=storage.persistResult;return storage.persistResult;},
 estimate:async()=>{if(storage.estimateThrows)throw Error('Unavailable');return {...storage.estimateValue};}};
const navigator={onLine:true,storage};
// Slice 3e: photos are decoded and re-encoded before queueing; an injected decoder and canvas stand in for the browser's.
const encode=src=>{const out=new Uint8Array(Math.max(1200,Math.round(src.length/4)));out.set([0xff,0xd8,0xff,0xe0]);for(let i=4;i<out.length;i++)out[i]=src[i%src.length]^0x5a;return out;};
class FakeCanvas{getContext(){return {drawImage:bmp=>{this.src=bmp.src;}};}async convertToBlob({type}){return new Blob([encode(this.src)],{type});}}
const context=vm.createContext({...offlineOpenHarness(()=>context.writeVault),deviceDigest,privacyReviewRequired:()=>false,clearPrivacyReviewRequired:()=>true,discardCachedRegistrationMatches:async(value,key,salt,revision)=>({book:value,revision}),reconcileRegistrationBook:async(value,key,salt,revision)=>({book:value,revision}),reconcileDeviceBook:async(book,_key,_salt,revision)=>({book,revision,removed:0}),reportDeviceFailure:async()=>false,Blob,OffscreenCanvas:FakeCanvas,createImageBitmap:async blob=>({width:2000,height:1500,src:new Uint8Array(await blob.arrayBuffer()),close(){}}),console,crypto,TextEncoder,TextDecoder,structuredClone,Date,Map,Array,Promise,Error,JSON,Uint8Array,Number,Math,setTimeout:()=>0,clearTimeout:()=>{},derive,seal,unseal,verifyPacket,packetHash,sealBytes,unsealBytes,
 readVault:async()=>structuredClone(record),writeVault:async(value,expected)=>{if((record?.revision??0)!==expected)throw Error('Another tab changed the vault');record={...structuredClone(value),revision:expected+1};return record.revision;},deleteVault:async()=>{record=null;media.clear();},
 writeMedia:async(id,value)=>{media.set(id,structuredClone(value))},readMedia:async id=>structuredClone(media.get(id)??null),deleteMedia:async id=>{media.delete(id)},
 fetch:async(url,options)=>{calls.push({url,options});throw Error('Network disconnected')},navigator,window:{indexedDB:{},addEventListener:()=>{}},document:{body:{dataset:{}},hidden:false,documentElement:{},getElementById:byId,createElement:tag=>new Element(tag),addEventListener:()=>{}}});
vm.runInContext(readFileSync('public/field/app.js','utf8').replace(/^import[^\n]*\n/gm,''),context);
const run=code=>vm.runInContext(code,context),check=fn=>{fn();passed++};let passed=0;
const settle=async()=>{for(let i=0;i<200&&run('busy');i++)await new Promise(r=>setTimeout(r,5));await run('checkSpace()');run('render()');};
byId('passphrase').value='synthetic-storage-test-phrase';await byId('unlock-form').onsubmit({preventDefault(){}});await settle();
check(()=>assert.ok(run('book')));
// Unlock asks the browser once to keep the notebook, and reports usage.
check(()=>assert.equal(storage.persistCalls,1));check(()=>assert.equal(run('space.state'),'ok'));check(()=>assert.equal(run('space.persisted'),true));
check(()=>assert.match(byId('space').textContent,/: 10 MB used of 1000 MB/));check(()=>assert.match(byId('space').textContent,/Protected from automatic clearing/));check(()=>assert.equal(byId('space').className,'muted'));
await run('checkSpace()');await run('checkSpace()');check(()=>assert.equal(storage.persistCalls,1));
// A draft to attach to.
const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
const payload={schema:1,leaseId:'lease-1',userId:'worker-1',organisationId:'org-1',personId:'p-1',personName:'Synthetic storage test',identityHash:'id',visitId:'v-1',visitVersion:1,expiresAt:new Date(Date.now()+86400000).toISOString(),issuedAt:new Date().toISOString(),facts:{date:new Date().toISOString().slice(0,16),source:'measured',notes:'',weight:'',systolic:'',diastolic:'',temperature:'',weeks:'',coughDays:''},programmeCapture:null};
const packet={payload,signature:Array.from(new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},pair.privateKey,new TextEncoder().encode(JSON.stringify(payload))))),publicKey:await crypto.subtle.exportKey('jwk',pair.publicKey)};
context.fixture={packet,packageHash:await packetHash(packet),facts:structuredClone(payload.facts),answers:{},absence:{},state:'draft',pending:null};
await run("book.userId='worker-1';book.drafts.push(fixture);selected='lease-1';workspace={user:{userId:'worker-1'},organisation:{id:'org-1'},organisations:[],people:[{id:'p-2',name:'Other synthetic',village:'X',version:1}],visits:[]};persist()");
const png=size=>{const b=new Uint8Array(size);for(let i=0;i<size;i++)b[i]=(i*31+size)&255;b.set([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);return {type:'image/png',arrayBuffer:async()=>b.slice().buffer};};
// Low free space (under 50 MB): preparing and queueing stop before any network call or device write.
storage.estimateValue={usage:980*MB,quota:1000*MB};await run('checkSpace()');run('render()');
check(()=>assert.equal(run('space.state'),'low'));check(()=>assert.equal(byId('space').className,'notice'));check(()=>assert.match(byId('space').textContent,/Device storage is low: 20 MB free/));
const before=calls.length;byId('patient').value='p-2';await assert.rejects(()=>run('prepare()'),/storage is low/);passed++;check(()=>assert.equal(calls.length,before));
context.f=png(2000);await assert.rejects(()=>run("attach(active(),f,'wound-or-skin')"),/storage is low/);passed++;check(()=>assert.equal(media.size,0));check(()=>assert.equal(run('active().media?.length??0'),0));
// High use (over 80%) is also low, even with more than 50 MB free.
storage.estimateValue={usage:850*MB,quota:1000*MB};await run('checkSpace()');check(()=>assert.equal(run('space.state'),'low'));
// Space freed: queueing resumes.
storage.estimateValue={usage:100*MB,quota:1000*MB};await run('checkSpace()');check(()=>assert.equal(run('space.state'),'ok'));
await run("attach(active(),f,'wound-or-skin')");check(()=>assert.equal(media.size,1));check(()=>assert.equal(run('active().media.length'),1));
// Estimate unavailable or failing: unknown, shown, and not treated as low.
storage.estimateThrows=true;await run('checkSpace()');run('render()');check(()=>assert.equal(run('space.state'),'unknown'));check(()=>assert.match(byId('space').textContent,/does not report storage space/));
context.f=png(2100);await run("attach(active(),f,'document-or-card')");check(()=>assert.equal(media.size,2));
storage.estimateThrows=false;
const saved=navigator.storage;navigator.storage=undefined;await run('checkSpace()');check(()=>assert.equal(run('space.state'),'unknown'));check(()=>assert.equal(run('space.persisted'),null));navigator.storage=saved;
// Persistence refused: the page says the browser may clear drafts.
storage.persistedValue=false;storage.persistResult=false;await run('askedPersist=false;checkSpace()');run('render()');
check(()=>assert.equal(run('space.persisted'),false));check(()=>assert.match(byId('space').textContent,/may clear saved drafts/));check(()=>assert.equal(storage.persistCalls,2));
// A late storage estimate updates only the storage line; it does not rebuild the editor (which would move focus).
storage.persistResult=true;storage.estimateValue={usage:990*MB,quota:1000*MB};await run('run(async()=>{})');const first=byId('editor').children[0];
for(let i=0;i<20;i++)await new Promise(r=>setTimeout(r,2));check(()=>assert.equal(byId('editor').children[0],first));check(()=>assert.equal(byId('space').className,'notice'));
writeFileSync('tests/field-storage-client-result.json',JSON.stringify({passed,completedAt:new Date().toISOString(),coverage:'Field notebook storage warnings with an injected StorageManager: one persistence request per session, usage display, low-space states by free bytes and by share of quota, preparing and queueing refused before any network call or device write while low, resumption when space frees, unknown or failing estimates shown and not treated as low, and refused persistence reported. Real browser quota, persistence grants and eviction are not tested.'},null,2)+'\n');
console.log(`${passed} field storage warning checks passed`);
