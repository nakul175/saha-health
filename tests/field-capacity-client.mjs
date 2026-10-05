// Device privacy is injected here; its server/IndexedDB effects are verified in device-work-contract/browser.
import {deviceDigest} from '../public/field/device-work.js';
// Slice 3j: field notebook capacity of 200 visit drafts. Runs public/field/app.js in Node with real
// Web Crypto and the real vault sealing, injected storage/network and a minimal DOM (harness from
// tests/field-media-client.mjs). Timings are this machine's, not a reference device's; real IndexedDB,
// browser quota and eviction are not tested here.
import vm from 'node:vm';import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';
import {derive,seal,unseal,verifyPacket,packetHash,sealBytes,unsealBytes} from '../public/field/vault.js';
class Element{constructor(tag='div'){this.tag=tag;this.children=[];this.value='';this.hidden=false;this.style={};this.disabled=false;}append(...c){this.children.push(...c)}prepend(...c){this.children.unshift(...c)}replaceChildren(...c){this.children=c}querySelector(tag){return this.children.find(c=>c.tag===tag)||this.children.map(c=>c.querySelector?.(tag)).find(Boolean)||null}}
const elements=new Map();const byId=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id)};
let record=null,calls=[],network=async()=>{throw Error('Network disconnected')},failDelete=false;const media=new Map();
// Slice 3e: an injected image decoder and canvas. Decoding accepts PNG or JPEG signatures of at least 512 bytes;
// the canvas 'encodes' a deterministic JPEG derived from the source, so distinct photos stay distinct.
const encode=src=>{const out=new Uint8Array(Math.max(1200,Math.round(src.length/4)));out.set([0xff,0xd8,0xff,0xe0]);for(let i=4;i<out.length;i++)out[i]=src[i%src.length]^0x5a;return out;};
const isImage=b=>b.length>=512&&([0x89,0x50,0x4e,0x47].every((x,i)=>b[i]===x)||[0xff,0xd8,0xff].every((x,i)=>b[i]===x));
class FakeCanvas{constructor(w,h){this.w=w;this.h=h;}getContext(){return {drawImage:bmp=>{this.src=bmp.src;}};}async convertToBlob({type}){return new Blob([encode(this.src)],{type});}}
const context=vm.createContext({deviceDigest,reconcileDeviceBook:async(book,_key,_salt,revision)=>({book,revision,removed:0}),reportDeviceFailure:async()=>false,Blob,OffscreenCanvas:FakeCanvas,createImageBitmap:async blob=>{const b=new Uint8Array(await blob.arrayBuffer());if(!isImage(b))throw Error('decode failed');return {width:3000,height:2000,src:b,close(){}};},console,crypto,TextEncoder,TextDecoder,structuredClone,Date,Map,Array,Promise,Error,JSON,Uint8Array,setTimeout:()=>0,clearTimeout:()=>{},derive,seal,unseal,verifyPacket,packetHash,sealBytes,unsealBytes,
 readVault:async()=>structuredClone(record),writeVault:async(value,expected)=>{if((record?.revision??0)!==expected)throw Error('Another tab changed the vault');record={...structuredClone(value),revision:expected+1};return record.revision;},deleteVault:async()=>{record=null;media.clear();},
 writeMedia:async(id,value)=>{media.set(id,structuredClone(value))},readMedia:async id=>structuredClone(media.get(id)??null),deleteMedia:async id=>{if(failDelete)throw Error('Delete failed');media.delete(id)},listMediaIds:async()=>[...media.keys()],
 fetch:async(url,options)=>{calls.push({url,options});return network(url,options)},navigator:{onLine:true},window:{indexedDB:{},addEventListener:()=>{}},document:{body:{dataset:{}},hidden:false,documentElement:{},getElementById:byId,createElement:tag=>new Element(tag),addEventListener:()=>{}}});
vm.runInContext(readFileSync('public/field/app.js','utf8').replace(/^import[^\n]*\n/gm,''),context);
const run=code=>vm.runInContext(code,context),check=fn=>{fn();passed++};let passed=0;
const rejects=async(code,pattern)=>{await assert.rejects(()=>run(code),pattern);passed++;};
byId('passphrase').value='synthetic-capacity-test-phrase';await byId('unlock-form').onsubmit({preventDefault(){}});
for(let i=0;i<200&&run('busy');i++)await new Promise(r=>setTimeout(r,5));check(()=>assert.ok(run('book')));
const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
// Signed fixture questions authorize the pre-existing synthetic capacity answers.
async function draft(lease,visitId,hours=24,personId='p-1'){
 const payload={schema:1,leaseId:lease,userId:'worker-1',organisationId:'org-1',personId,personName:'Synthetic capacity test '+personId,identityHash:'id',visitId,visitVersion:1,expiresAt:new Date(Date.now()+hours*3600000).toISOString(),issuedAt:new Date().toISOString(),facts:{date:new Date().toISOString().slice(0,16),source:'measured',notes:'',weight:'70',systolic:'',diastolic:'',temperature:'',weeks:'',coughDays:''},programmeCapture:{packs:[{enrolmentId:'synthetic-capacity-episode',pack:{id:'synthetic-capacity-pack',version:1,name:'Synthetic capacity documentary pack',programme:'Synthetic capacity fixture',purpose:'Exercise signed documentary answers at notebook capacity; no clinical policy.',questions:[{id:'q-anc-visit',label:'Synthetic visit answer',options:['yes','no'],required:true},{id:'q-danger-signs',label:'Synthetic second answer',options:['none','reported'],required:false}]}}],answers:{},absence:{}}};
 const packet={payload,signature:Array.from(new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},pair.privateKey,new TextEncoder().encode(JSON.stringify(payload))))),publicKey:await crypto.subtle.exportKey('jwk',pair.publicKey)};
 return {packet,packageHash:await packetHash(packet),facts:structuredClone(payload.facts),answers:{},absence:{},state:'draft',pending:null};
}

const ms=t=>Math.round(performance.now()-t),timings={};
// Fill the notebook to 200 visit drafts, each for a different synthetic patient, with typical facts.
const drafts=[];for(let i=0;i<200;i++){const d=await draft('lease-'+i,'v-'+i,24,'p-'+i);d.facts.notes='Synthetic capacity visit note '+i+' '.padEnd(120,'x');d.answers={'q-anc-visit':'yes','q-danger-signs':'none'};drafts.push(d);}
context.fixture=drafts;await run("book.userId='worker-1';book.drafts.push(...fixture);");
let t=performance.now();await run('persist()');timings.persist200Ms=ms(t);
const sealedBytes=record.cipher.length,storedChars=JSON.stringify(record).length;
check(()=>assert.equal(run('book.drafts.length'),200));
check(()=>assert.equal(JSON.stringify(record).includes('Synthetic capacity visit note'),false,'drafts are sealed'));
// Restart: lock, unlock with the passphrase, all 200 drafts return.
run('lock()');await run('chain');check(()=>assert.equal(run('book'),null));
t=performance.now();await run("run(async()=>{const r=await readVault();key=await derive('synthetic-capacity-test-phrase',r.salt);salt=r.salt;revision=r.revision;book=await unseal(key,r);})");for(let i=0;i<400&&run('busy');i++)await new Promise(r=>setTimeout(r,5));timings.unlock200Ms=ms(t);
check(()=>{assert.equal(run('book.drafts.length'),200);assert.equal(run('book.drafts[199].packet.payload.personId'),'p-199');assert.equal(run('book.drafts[57].facts.notes').startsWith('Synthetic capacity visit note 57'),true);});
// The 201st visit is refused before any network call; with 199 drafts the capacity check passes.
const people=Array.from({length:201},(_,i)=>({id:'p-'+i,name:'Synthetic '+i,assignedTo:'worker-1'}));
context.ws={user:{userId:'worker-1'},role:'asha',organisation:{id:'org-1'},organisations:[],people,visits:[]};
network=async url=>{throw Error('Prepare network used')};
await run("workspace=ws");byId('patient').value='p-200';calls=[];
await rejects('prepare()',/at most 200 visit drafts/);check(()=>assert.equal(calls.length,0));
await run('book.drafts.pop()');await rejects('prepare()',/Prepare network used/);check(()=>assert.equal(calls.length,1));
await run('book.drafts.push(fixture[199])');
// Sync all: 200 drafts sent in notebook order, each with its own stable key, all marked synced.
const visits=Array.from({length:200},(_,i)=>({id:'v-'+i,personId:'p-'+i,state:'draft',version:1}));
let sent=[],workspaceReads=0;
network=async(url,options)=>{
 if(url==='/api/workspace'){workspaceReads++;return {ok:true,json:async()=>({user:{userId:'worker-1'},role:'asha',organisation:{id:'org-1'},organisations:[],people:people.slice(0,200),visits})};}
 if(url==='/api/commands'){const b=JSON.parse(options.body);sent.push({key:options.headers['Idempotency-Key'],lease:b.leaseId,type:b.type});return {ok:true,json:async()=>({result:{visitId:'v-'+b.leaseId.slice(6),version:2}})};}
 throw Error('Unexpected '+url);};
t=performance.now();const done=await run('syncAll()');timings.syncAll200Ms=ms(t);
check(()=>{assert.equal(done.drafts,200);assert.equal(done.review,0);assert.equal(sent.length,200);assert.ok(sent.every(x=>x.type==='syncFieldVisit'));});
check(()=>assert.equal(workspaceReads,1,'one workspace read per Sync all run, not one per draft'));const readsFirstRun=workspaceReads;
check(()=>assert.deepEqual(sent.map(x=>x.lease),drafts.map(d=>d.packet.payload.leaseId)));
check(()=>assert.equal(new Set(sent.map(x=>x.key)).size,200));
check(()=>assert.equal(run('book.drafts.filter(d=>d.state==="synced"&&!d.pending).length'),200));
// A resend after a lost response reuses the same key (stable-key replay at capacity).
const lost=drafts[10].packet.payload.leaseId;await run(`(()=>{const d=book.drafts.find(x=>x.packet.payload.leaseId==='${lost}');d.state='draft';d.pending={key:'kept-key-10',body:{type:'syncFieldVisit',personId:d.packet.payload.personId,leaseId:d.packet.payload.leaseId,packageHash:d.packageHash,facts:d.facts,answers:{},absence:{}}};})()`);
sent=[];await run('syncAll()');check(()=>{assert.equal(sent.length,1);assert.equal(sent[0].key,'kept-key-10');});
writeFileSync('tests/field-capacity-client-result.json',JSON.stringify({suite:'field notebook capacity client (slice 3j)',passed,drafts:200,sealedCipherBytes:sealedBytes,storedRecordJsonChars:storedChars,workspaceReadsDuringFirstSyncAll:readsFirstRun,timingsMs:timings,environment:'Node '+process.version+' on the build machine; injected storage and network; not a reference device',completedAt:new Date().toISOString()},null,2)+'\n');
console.log(JSON.stringify({passed,sealedBytes,storedChars,readsFirstRun,timings}));
