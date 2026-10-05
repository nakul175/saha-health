// Device privacy is injected here; its server/IndexedDB effects are verified in device-work-contract/browser.
import {deviceDigest} from '../public/field/device-work.js';
// Slice 3k: field notebook at 200 visit drafts plus 100 queued photos and voice notes. Runs public/field/app.js in
// Node with real Web Crypto and the real vault sealing, injected storage/network and a minimal DOM (harness from
// tests/field-capacity-client.mjs). Covers the device media budget (100 open items, 25 MB), refusal of the 201st draft
// and the 101st item with nothing lost, lock/unlock, and a restart after a lost response in the middle of Sync all
// (drafts and media), checked against an idempotent fake server. Timings are this machine's with an instant network.
import vm from 'node:vm';import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';
import {derive,seal,unseal,verifyPacket,packetHash,sealBytes,unsealBytes} from '../public/field/vault.js';
class Element{constructor(tag='div'){this.tag=tag;this.children=[];this.value='';this.hidden=false;this.style={};this.disabled=false;}append(...c){this.children.push(...c)}prepend(...c){this.children.unshift(...c)}replaceChildren(...c){this.children=c}querySelector(tag){return this.children.find(c=>c.tag===tag)||this.children.map(c=>c.querySelector?.(tag)).find(Boolean)||null}}
const elements=new Map();const byId=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id)};
let record=null,calls=[],network=async()=>{throw Error('Network disconnected')};const media=new Map();
// Injected decoder and canvas (slice 3e harness): the 'encoded' JPEG is a quarter of the source, so a 0.99 MB source
// becomes a ~247 KB photo, close to the 248 KB reduction target.
const encode=src=>{const out=new Uint8Array(Math.max(1200,Math.round(src.length/4)));out.set([0xff,0xd8,0xff,0xe0]);for(let i=4;i<out.length;i++)out[i]=src[i%src.length]^0x5a;return out;};
const isImage=b=>b.length>=512&&[0x89,0x50,0x4e,0x47].every((x,i)=>b[i]===x);
class FakeCanvas{constructor(w,h){this.w=w;this.h=h;}getContext(){return {drawImage:bmp=>{this.src=bmp.src;}};}async convertToBlob({type}){return new Blob([encode(this.src)],{type});}}
const context=vm.createContext({deviceDigest,privacyReviewRequired:()=>false,clearPrivacyReviewRequired:()=>true,reconcileDeviceBook:async(book,_key,_salt,revision)=>({book,revision,removed:0}),reportDeviceFailure:async()=>false,Blob,OffscreenCanvas:FakeCanvas,createImageBitmap:async blob=>{const b=new Uint8Array(await blob.arrayBuffer());if(!isImage(b))throw Error('decode failed');return {width:3000,height:2000,src:b,close(){}};},console,crypto,TextEncoder,TextDecoder,structuredClone,Date,Map,Set,Array,Promise,Error,JSON,Uint8Array,setTimeout:()=>0,clearTimeout:()=>{},derive,seal,unseal,verifyPacket,packetHash,sealBytes,unsealBytes,
 readVault:async()=>structuredClone(record),writeVault:async(value,expected)=>{if((record?.revision??0)!==expected)throw Error('Another tab changed the vault');record={...structuredClone(value),revision:expected+1};return record.revision;},deleteVault:async()=>{record=null;media.clear();},
 writeMedia:async(id,value)=>{media.set(id,structuredClone(value))},readMedia:async id=>structuredClone(media.get(id)??null),deleteMedia:async id=>{media.delete(id)},listMediaIds:async()=>[...media.keys()],
 fetch:async(url,options)=>{calls.push({url,options});return network(url,options)},navigator:{onLine:true},window:{indexedDB:{},addEventListener:()=>{}},document:{body:{dataset:{}},hidden:false,documentElement:{},getElementById:byId,createElement:tag=>new Element(tag),addEventListener:()=>{}}});
vm.runInContext(readFileSync('public/field/app.js','utf8').replace(/^import[^\n]*\n/gm,''),context);
const run=code=>vm.runInContext(code,context),check=(name,fn)=>{fn();passed++;names.push(name);};let passed=0;const names=[];
const settle=async()=>{for(let i=0;i<2000&&run('busy');i++)await new Promise(r=>setTimeout(r,5));};
const PASS='synthetic-media-capacity-phrase';
const unlock=async()=>{byId('passphrase').value=PASS;await byId('unlock-form').onsubmit({preventDefault(){}});await settle();};
await unlock();assert.ok(run('book'));
const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
// Signed fixture questions authorize the pre-existing synthetic capacity answers.
async function draft(i){
 const payload={schema:1,leaseId:'lease-'+String(i).padStart(3,'0'),userId:'worker-1',organisationId:'org-1',personId:'p-'+i,personName:'Synthetic media capacity '+i,identityHash:'id',visitId:'v-'+i,visitVersion:1,expiresAt:new Date(Date.now()+24*3600000).toISOString(),issuedAt:new Date().toISOString(),facts:{date:new Date().toISOString().slice(0,16),source:'measured',notes:'Synthetic media capacity note '+i+' '.padEnd(120,'x'),weight:'61',systolic:'118',diastolic:'76',temperature:'',weeks:'',coughDays:''},programmeCapture:{packs:[{enrolmentId:'synthetic-capacity-episode',pack:{id:'synthetic-capacity-pack',version:1,name:'Synthetic capacity documentary pack',programme:'Synthetic capacity fixture',purpose:'Synthetic capacity fixture only.',questions:[{id:'q-anc-visit',label:'Synthetic visit answer',options:['yes','no'],required:true}]}}],answers:{},absence:{}}};
 const packet={payload,signature:Array.from(new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},pair.privateKey,new TextEncoder().encode(JSON.stringify(payload))))),publicKey:await crypto.subtle.exportKey('jwk',pair.publicKey)};
 return {packet,packageHash:await packetHash(packet),facts:structuredClone(payload.facts),answers:{'q-anc-visit':'yes'},absence:{},state:'draft',pending:null};
}
const ms=t=>Math.round(performance.now()-t),timings={};
const drafts=[];for(let i=0;i<200;i++)drafts.push(await draft(i));
context.fixture=drafts;await run("book.userId='worker-1';book.drafts.push(...fixture);persist()");
check('200 drafts saved',()=>assert.equal(run('book.drafts.length'),200));

// 100 media items on the first 25 drafts (4 each): 75 photos reduced on the device and 25 WebM voice notes.
const photo=n=>{const b=new Uint8Array(990000);b.set([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);for(let i=8;i<b.length;i++)b[i]=(i*31+n*977)&255;return new Blob([b],{type:'image/png'});};
const voice=n=>{const b=new Uint8Array(240000);b.set([0x1a,0x45,0xdf,0xa3]);for(let i=4;i<b.length;i++)b[i]=(i*17+n*131)&255;return new Blob([b],{type:'audio/webm'});};
let t=performance.now(),n=0;
for(let d=0;d<25;d++)for(let k=0;k<4;k++){context.file=k===3?voice(n):photo(n);context.purpose=k===3?'voice-note':'wound-or-skin';context.di=d;await run('attach(book.drafts[di],file,purpose)');n++;}
timings.attach100Ms=ms(t);
const queued=run('book.drafts.flatMap(d=>d.media??[])');
const queuedBytes=queued.reduce((s,x)=>s+x.size,0);
check('100 items queued, sealed per item',()=>{assert.equal(queued.length,100);assert.equal(media.size,100);assert.ok([...media.values()].every(v=>v.cipher instanceof Uint8Array));});
check('photos re-encoded as JPEG near the reduction target; voice notes kept',()=>{assert.equal(queued.filter(x=>x.mime==='image/jpeg').length,75);assert.equal(queued.filter(x=>x.mime==='audio/webm').length,25);assert.ok(queued.filter(x=>x.mime==='image/jpeg').every(x=>x.size===247500));});
check('100 items fit inside the 25 MB budget',()=>assert.ok(queuedBytes>24_000_000&&queuedBytes<=25*1048576,String(queuedBytes)));
check('media bytes stay out of the notebook record',()=>assert.ok(JSON.stringify(record).length<1_500_000));
const notebookChars=JSON.stringify(record).length,sealedMediaBytes=[...media.values()].reduce((s,v)=>s+v.cipher.length,0);

// Exhaustion: the 101st item and the 201st draft are refused before any write or network call; nothing is lost.
const before={revision:record.revision,items:media.size,ids:[...media.keys()].sort().join()};
context.file=photo(500);context.purpose='wound-or-skin';calls=[];
await assert.rejects(()=>run('attach(book.drafts[25],file,purpose)'),/at most 100 photos and voice notes waiting to upload.*Nothing was added/);passed++;names.push('101st media item refused with a clear message');
context.file=voice(501);context.purpose='voice-note';
await assert.rejects(()=>run('attach(book.drafts[199],file,purpose)'),/at most 100 photos and voice notes/);passed++;names.push('101st voice note refused');
check('nothing written or lost by the refusals',()=>{assert.equal(record.revision,before.revision);assert.equal(media.size,100);assert.equal([...media.keys()].sort().join(),before.ids);assert.equal(run('book.drafts[25].media?.length??0'),0);assert.equal(calls.length,0);});
const people=Array.from({length:201},(_,i)=>({id:'p-'+i,name:'Synthetic '+i,assignedTo:'worker-1',version:1}));
context.ws={user:{userId:'worker-1'},role:'asha',organisation:{id:'org-1',name:'Synthetic org'},organisations:[],people,visits:[]};
network=async()=>{throw Error('Prepare network used')};await run('workspace=ws');byId('patient').value='p-200';calls=[];
await assert.rejects(()=>run('prepare()'),/at most 200 visit drafts/);passed++;names.push('201st draft refused');
check('201st draft refused with no network call and nothing written',()=>{assert.equal(calls.length,0);assert.equal(run('book.drafts.length'),200);assert.equal(record.revision,before.revision);});
// Discarding one item frees one place in the budget, then the same file can be queued.
await run('discardMedia(book.drafts[0],book.drafts[0].media[0])');context.file=photo(500);context.purpose='wound-or-skin';
await run('attach(book.drafts[0],file,purpose)');
check('discarding one item frees one place',()=>{assert.equal(run('book.drafts.flatMap(d=>d.media??[]).length'),100);assert.equal(media.size,100);});

// Lock and unlock: all 200 drafts and 100 sealed items return.
run('lock()');await run('chain');check('lock clears the notebook from memory',()=>assert.equal(run('book'),null));
t=performance.now();await unlock();timings.unlockMs=ms(t);
check('unlock returns 200 drafts and 100 queued items',()=>{assert.equal(run('book.drafts.length'),200);assert.equal(run('book.drafts.flatMap(d=>d.media??[]).filter(x=>x.state==="queued").length'),100);assert.equal(media.size,100);});
const one=run('book.drafts[3].media[3]');const opened=await unsealBytes(await derive(PASS,record.salt),media.get(one.id));
const openedHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',opened)),x=>x.toString(16).padStart(2,'0')).join('');
check('a sealed voice note opens to its recorded hash after unlock',()=>{assert.equal(opened.length,one.size);assert.equal(openedHash,one.sha256);});

// Fake idempotent server: a key seen before replays its first result; a lease or media applied twice is a duplicate.
const server={byLease:new Map(),commands:new Map(),applied:[],media:new Map(),mediaApplied:[],duplicates:0,workspaceReads:0};let loseCommandAt=-1,loseMediaAt=-1;
const visits=Array.from({length:200},(_,i)=>({id:'v-'+i,personId:'p-'+i,state:'draft',version:1}));
network=async(url,options)=>{
 if(url==='/api/workspace'){server.workspaceReads++;return {ok:true,json:async()=>({user:{userId:'worker-1'},role:'asha',organisation:{id:'org-1',name:'Synthetic org'},organisations:[],people:people.slice(0,200),visits})};}
 const key=options.headers['Idempotency-Key'];
 if(url==='/api/commands'){const b=JSON.parse(options.body);let result=server.commands.get(key);
  if(!result){if(server.applied.includes(b.leaseId))server.duplicates++;server.applied.push(b.leaseId);result={visitId:'v-'+Number(b.leaseId.slice(6)),version:2,receipt:'r-'+server.applied.length};server.commands.set(key,result);server.byLease.set(b.leaseId,result);if(server.applied.length-1===loseCommandAt){loseCommandAt=-1;throw Error('other side closed');}}
  return {ok:true,json:async()=>({result})};}
 if(url.startsWith('/api/media?')){let stored=server.media.get(key);
  if(!stored){const visitId=new URL('http://x'+url).searchParams.get('visitId'),sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',options.body)),x=>x.toString(16).padStart(2,'0')).join('');if(server.mediaApplied.some(m=>m.sha===sha&&m.visitId===visitId))server.duplicates++;stored={mediaId:'m-'+(server.mediaApplied.length+1)};server.mediaApplied.push({key,visitId,sha});server.media.set(key,stored);if(server.mediaApplied.length-1===loseMediaAt){loseMediaAt=-1;throw Error('other side closed');}}
  return {ok:true,json:async()=>stored};}
 throw Error('Unexpected '+url);};
const notebookOrder=drafts.map(d=>d.packet.payload.leaseId);
// First run: the 120th command reaches the server but its response is lost; the run stops with that key pending.
loseCommandAt=119;t=performance.now();
await assert.rejects(()=>run('syncAll()'),/Sync all: 0 registrations, 119 visit drafts, 0 media items synced\. .*Stopped/);passed++;names.push('lost response stops Sync all after 119 drafts');
timings.firstRunMs=ms(t);
const stuck=run('book.drafts[119]');
check('the 120th draft keeps its pending key; later drafts were not sent',()=>{assert.ok(stuck.pending?.key);assert.equal(stuck.state,'draft');assert.equal(server.applied.length,120);assert.deepEqual(server.applied,notebookOrder.slice(0,120));});
// Restart: the page is closed (lock) and reopened (unlock), as after a reload.
run('lock()');await run('chain');await unlock();
check('after restart 119 drafts are synced with receipts and one is pending',()=>{assert.equal(run('book.drafts.filter(d=>d.state==="synced").length'),119);assert.equal(run('book.drafts[119].pending.key'),stuck.pending.key);});
// Second run: drafts resume in order with the stored key first; the 50th media upload then loses its response.
// The idle lock is re-armed after every confirmed step, so a long run stays open while it progresses (slice 3k).
let armed=0;context.setTimeout=(fn,ms)=>{if(ms===120000)armed++;return 0;};
loseMediaAt=49;const sentBefore=calls.length;
await assert.rejects(()=>run('syncAll()'),/81 visit drafts, 48 media items synced\. .*Stopped: Upload outcome not confirmed/);passed++;names.push('second run syncs the remaining 81 drafts, stops at a lost upload');
// The summary counts media per completed draft, so the item uploaded earlier on the interrupted draft is not in it (known limit).
check('49 uploads confirmed on the device before the lost one',()=>assert.equal(run('book.drafts.flatMap(d=>d.media??[]).filter(x=>x.state==="uploaded").length'),49));
check('idle lock re-armed after each confirmed draft and upload',()=>assert.ok(armed>=81+49,String(armed)));context.setTimeout=()=>0;
const resumed=calls.slice(sentBefore).filter(c=>c.url==='/api/commands').map(c=>({key:c.options.headers['Idempotency-Key'],lease:JSON.parse(c.options.body).leaseId}));
check('resumed drafts start with the stored key, then notebook order',()=>{assert.equal(resumed[0].key,stuck.pending.key);assert.deepEqual(resumed.map(x=>x.lease),notebookOrder.slice(119));});
check('no visit was applied twice',()=>{assert.equal(server.applied.length,200);assert.equal(new Set(server.applied).size,200);assert.equal(server.duplicates,0);});
const pendingItem=run('book.drafts.flatMap(d=>d.media??[]).find(x=>x.pending)');
check('the lost upload keeps its key and its sealed copy',()=>{assert.ok(pendingItem);assert.equal(pendingItem.state,'queued');assert.ok(media.has(pendingItem.id));assert.equal(media.size,51);});
run('lock()');await run('chain');await unlock();
check('restart keeps the pending item and its copy (sweep spares it)',()=>{assert.ok(media.has(pendingItem.id));assert.equal(media.size,51);});
// Third run: the pending upload is resent with the same key and the server replays; the remaining 50 upload once.
const mediaSentBefore=calls.length;t=performance.now();
const done=await run('syncAll()');timings.thirdRunMs=ms(t);
const resent=calls.slice(mediaSentBefore).filter(c=>c.url.startsWith('/api/media?')).map(c=>c.options.headers['Idempotency-Key']);
check('third run: no drafts left, 51 uploads confirmed',()=>{assert.equal(done.drafts,0);assert.equal(done.media,51);assert.equal(done.review,0);});
check('pending upload resent first with the same key',()=>assert.equal(resent[0],pendingItem.id));
check('server holds each media item once',()=>{assert.equal(server.mediaApplied.length,100);assert.equal(new Set(server.mediaApplied.map(m=>m.sha)).size,100);assert.equal(server.duplicates,0);});
check('device copies deleted after confirmed upload',()=>{assert.equal(media.size,0);assert.equal(run('book.drafts.flatMap(d=>d.media??[]).filter(x=>x.state!=="uploaded").length'),0);});
check('receipts on the device match the server',()=>{const r=run('book.drafts.map(d=>[d.packet.payload.leaseId,d.receipt?.receipt])');assert.equal(new Set(r.map(x=>x[1])).size,200);for(const [lease,receipt] of r)assert.equal(receipt,server.byLease.get(lease).receipt);});
check('media ids on the device match the server',()=>{const ids=run('book.drafts.flatMap(d=>d.media??[]).map(x=>x.mediaId)');assert.equal(ids.length,100);assert.deepEqual([...ids].sort(),[...server.media.values()].map(x=>x.mediaId).sort());});
// Measured with the instant network: one full Sync all of 200 drafts and 100 items from a fresh notebook.
writeFileSync('tests/field-media-capacity-client-result.json',JSON.stringify({suite:'field notebook 200 drafts plus 100 media items client (slice 3k)',passed,checks:names,drafts:200,mediaItems:100,mediaBudget:{items:100,bytes:25*1048576},queuedMediaBytes:queuedBytes,sealedMediaCipherBytes:sealedMediaBytes,notebookRecordJsonChars:notebookChars,serverWorkspaceReads:server.workspaceReads,timingsMs:timings,environment:'Node '+process.version+' on the build machine; injected storage and an instant injected network; not a reference device or network',completedAt:new Date().toISOString()},null,2)+'\n');
console.log(`${passed} field notebook media capacity checks passed`,JSON.stringify({queuedBytes,notebookChars,timings,workspaceReads:server.workspaceReads}));
