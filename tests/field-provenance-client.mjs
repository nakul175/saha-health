// Device privacy is injected here; its server/IndexedDB effects are verified in device-work-contract/browser.
import {deviceDigest} from '../public/field/device-work.js';
// Slice 2c: per-measurement source and time in the field notebook. Runs public/field/app.js in Node with real Web
// Crypto, injected storage/network and a minimal DOM (the tests/field-media-client.mjs harness): editing, tidying
// before sync, the sync body, and a refusal routed to review. Real browser rendering is not tested here.
import vm from 'node:vm';import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';
import {derive,seal,unseal,verifyPacket,packetHash,sealBytes,unsealBytes} from '../public/field/vault.js';
class Element{constructor(tag='div'){this.tag=tag;this.children=[];this.value='';this.hidden=false;this.style={};this.disabled=false;}append(...c){this.children.push(...c)}prepend(...c){this.children.unshift(...c)}replaceChildren(...c){this.children=c}querySelector(tag){return this.children.find(c=>c.tag===tag)||this.children.map(c=>c.querySelector?.(tag)).find(Boolean)||null}}
const elements=new Map();const byId=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id)};
let record=null,calls=[],network=async()=>{throw Error('Network disconnected')};
const context=vm.createContext({deviceDigest,privacyReviewRequired:()=>false,clearPrivacyReviewRequired:()=>true,discardCachedRegistrationMatches:async(value,key,salt,revision)=>({book:value,revision}),reconcileRegistrationBook:async(value,key,salt,revision)=>({book:value,revision}),reconcileDeviceBook:async(book,_key,_salt,revision)=>({book,revision,removed:0}),reportDeviceFailure:async()=>false,Blob,OffscreenCanvas:class{},createImageBitmap:async()=>{throw Error('no images')},console,crypto,TextEncoder,TextDecoder,structuredClone,Date,Map,Array,Promise,Error,JSON,Uint8Array,Object,Number,String,isNaN,setTimeout:()=>0,clearTimeout:()=>{},derive,seal,unseal,verifyPacket,packetHash,sealBytes,unsealBytes,
 readVault:async()=>structuredClone(record),writeVault:async(value,expected)=>{if((record?.revision??0)!==expected)throw Error('Another tab changed the vault');record={...structuredClone(value),revision:expected+1};return record.revision;},deleteVault:async()=>{record=null;},
 writeMedia:async()=>{},readMedia:async()=>null,deleteMedia:async()=>{},listMediaIds:async()=>[],
 fetch:async(url,options)=>{calls.push({url,options});return network(url,options)},navigator:{onLine:true},window:{indexedDB:{},addEventListener:()=>{}},document:{body:{dataset:{}},hidden:false,documentElement:{},getElementById:byId,createElement:tag=>new Element(tag),addEventListener:()=>{}}});
vm.runInContext(readFileSync('public/field/app.js','utf8').replace(/^import[^\n]*\n/gm,''),context);
const run=code=>vm.runInContext(code,context),val=code=>JSON.parse(run('JSON.stringify('+code+')')),check=fn=>{fn();passed++};let passed=0;
const idle=async()=>{for(let i=0;i<200&&run('busy');i++)await new Promise(r=>setTimeout(r,5));};
byId('passphrase').value='synthetic-provenance-phrase';await byId('unlock-form').onsubmit({preventDefault(){}});await idle();
const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
const visitAt=new Date(Date.now()-2*3600000).toISOString().slice(0,16),earlier=new Date(Date.now()-26*3600000).toISOString().slice(0,16);
const payload={schema:1,leaseId:'lease-1',userId:'worker-1',organisationId:'org-1',personId:'p-1',personName:'Synthetic provenance person',identityHash:'id',visitId:'v-1',visitVersion:1,expiresAt:new Date(Date.now()+86400000).toISOString(),issuedAt:new Date().toISOString(),facts:{date:visitAt,source:'measured',notes:'',weight:'',systolic:'',diastolic:'',temperature:'',weeks:'',coughDays:''},programmeCapture:null};
const packet={payload,signature:Array.from(new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},pair.privateKey,new TextEncoder().encode(JSON.stringify(payload))))),publicKey:await crypto.subtle.exportKey('jwk',pair.publicKey)};
context.fixture={packet,packageHash:await packetHash(packet),facts:structuredClone(payload.facts),answers:{},absence:{},state:'draft',pending:null};await run("book.userId='worker-1';book.drafts.push(fixture);selected='lease-1';persist()");
// The editor shows one source and one time control per measurement; a time is available only with an entry and a value.
run('render()');const find=(n,pred)=>pred(n)?n:(n.children??[]).map(c=>find(c,pred)).find(Boolean);const all=(n,pred,out=[])=>{if(pred(n))out.push(n);for(const c of n.children??[])all(c,pred,out);return out;};
const details=find(byId('editor'),n=>n.tag==='details');check(()=>assert.ok(details,'provenance section rendered'));
const labels=all(details,n=>n.tag==='label').map(n=>n.textContent);check(()=>assert.equal(labels.length,10));check(()=>assert.ok(labels.includes('Weight / वज़न · source / स्रोत')));
check(()=>assert.equal(all(details,n=>n.tag==='input').every(i=>i.disabled),true,'no time without an entry'));
check(()=>assert.equal(all(details,n=>n.tag==='select').length,5));
// Editing through the controls: a reported weight with its own time, a declined temperature.
const select=label=>find(details,n=>n.tag==='label'&&n.textContent===label).children.find(c=>c.tag==='select');
await run("active().facts.weight='61'");let s=select('Weight / वज़न · source / स्रोत');s.value='reported';s.onchange();await run('chain');
run('render()');const d2=find(byId('editor'),n=>n.tag==='details');check(()=>assert.equal(d2.open,true,'open once an entry exists'));
const time=find(d2,n=>n.tag==='label'&&n.textContent==='Weight / वज़न · time (UTC) / समय').children.find(c=>c.tag==='input');check(()=>assert.equal(time.disabled,false));
time.value=earlier;time.oninput();await run('chain');
s=find(d2,n=>n.tag==='label'&&n.textContent==='Temperature / तापमान · source / स्रोत').children.find(c=>c.tag==='select');s.value='declined';s.onchange();await run('chain');
check(()=>assert.deepEqual(val('active().facts.provenance'),{weight:{source:'reported',at:earlier},temperature:{source:'declined'}}));
// A contradiction is shown before syncing.
await run("setProvenance(active().facts,'bloodPressure',{source:'measured'});active().facts.systolic='120';active().facts.diastolic='80';setProvenance(active().facts,'bloodPressure',{source:'unknown'})");run('render()');
check(()=>assert.ok(all(byId('editor'),n=>n.className==='conflict').some(n=>/must be measured or reported/.test(n.textContent))));
// Tidying: a recorded source or a time on a blank value is dropped; clearing the source removes the entry.
await run("setProvenance(active().facts,'bloodPressure',{source:''});active().facts.systolic='';active().facts.diastolic='';setProvenance(active().facts,'weeks',{source:'reported',at:'"+earlier+"'});setProvenance(active().facts,'coughDays',{source:'not-asked',at:'"+earlier+"'})");
check(()=>assert.deepEqual(val('tidyFacts(active().facts).provenance'),{weight:{source:'reported',at:earlier},temperature:{source:'declined'},coughDays:{source:'not-asked'}}));
check(()=>assert.equal(run("'provenance' in tidyFacts({...active().facts,provenance:{weeks:{source:'measured'}}})"),false));
check(()=>assert.ok(val('active().facts.provenance').weeks,'the device copy keeps what the worker entered'));
// Sync sends the tidied facts; a server refusal routes the draft to review with the reason.
const bodies=[];network=async(url,options)=>{if(url==='/api/workspace')return {ok:true,json:async()=>({user:{userId:'worker-1'},role:'asha',organisation:{id:'org-1',name:'Synthetic'},organisations:[],membership:{teamIds:[]},teams:[],people:[{id:'p-1'}],visits:[{id:'v-1',personId:'p-1',state:'draft',version:1}]})};
 if(url==='/api/commands'){const b=JSON.parse(options.body);bodies.push(b);if(b.facts.provenance?.weight?.source==='declined')return {ok:false,status:422,json:async()=>({error:'Weight: a recorded value must be measured or reported. Clear the value to record why it is missing.'})};return {ok:true,json:async()=>({result:{visitId:'v-1',version:2}})};}throw Error('Unexpected '+url);};
await run("setProvenance(active().facts,'weight',{source:'declined'})");await assert.rejects(()=>run('sync(active())'),/Weight: a recorded value/);passed++;
check(()=>assert.match(run('active().conflict'),/Weight: a recorded value/));check(()=>assert.equal(run('active().state'),'draft'));
await run("setProvenance(active().facts,'weight',{source:'reported'})");await run('sync(active())');
check(()=>assert.deepEqual(bodies.at(-1).facts.provenance,{weight:{source:'reported',at:earlier},temperature:{source:'declined'},coughDays:{source:'not-asked'}}));
check(()=>assert.equal(run('active().state'),'synced'));
writeFileSync('tests/field-provenance-client-result.json',JSON.stringify({passed,completedAt:new Date().toISOString(),coverage:'Field notebook per-measurement source and time with real Web Crypto and injected storage/network: one source and one time control for each of five measurements; time only with an entry and a value; editing through the controls; contradiction shown before sync; tidying of a recorded source or a time on a blank value; device copy kept as entered; the sync body carrying the tidied entries; a server refusal routed to review with its reason, then a corrected sync. Real browser rendering is not tested here.'},null,2)+'\n');
console.log(`${passed} field provenance checks passed`);
