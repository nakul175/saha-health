import {offlineOpenHarness} from './lib/offline-open-harness.mjs';
// Device privacy is injected here; its server/IndexedDB effects are verified in device-work-contract/browser.
import {deviceDigest} from '../public/field/device-work.js';
// Slice 2i: alternative units and unusual-value reasons in the field notebook. Runs public/field/app.js in Node with real
// Web Crypto, injected storage/network and a minimal DOM (the tests/field-provenance-client.mjs harness): unit controls,
// tidying before sync, the local hold without a reason, the sync body, and a server refusal routed to review.
import vm from 'node:vm';import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';
import {derive,seal,unseal,verifyPacket,packetHash,sealBytes,unsealBytes} from '../public/field/vault.js';
class Element{constructor(tag='div'){this.tag=tag;this.children=[];this.value='';this.hidden=false;this.style={};this.disabled=false;}append(...c){this.children.push(...c)}prepend(...c){this.children.unshift(...c)}replaceChildren(...c){this.children=c}querySelector(tag){return this.children.find(c=>c.tag===tag)||this.children.map(c=>c.querySelector?.(tag)).find(Boolean)||null}}
const elements=new Map();const byId=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id)};
let record=null,calls=[],network=async()=>{throw Error('Network disconnected')};
const context=vm.createContext({...offlineOpenHarness(()=>context.writeVault),deviceDigest,checkpointGuidedStep:()=>{},restoredGuidedStep:()=>null,restoredPreparedTask:()=>null,rememberPreparedTask:()=>{},clearPreparedTask:()=>{},privacyReviewRequired:()=>false,clearPrivacyReviewRequired:()=>true,discardCachedRegistrationMatches:async(value,key,salt,revision)=>({book:value,revision}),reconcileRegistrationBook:async(value,key,salt,revision)=>({book:value,revision}),reconcileDeviceBook:async(book,_key,_salt,revision)=>({book,revision,removed:0}),reportDeviceFailure:async()=>false,Blob,OffscreenCanvas:class{},createImageBitmap:async()=>{throw Error('no images')},console,crypto,TextEncoder,TextDecoder,structuredClone,Date,Map,Array,Promise,Error,JSON,Uint8Array,Object,Number,String,isNaN,setTimeout:()=>0,clearTimeout:()=>{},derive,seal,unseal,verifyPacket,packetHash,sealBytes,unsealBytes,
 readVault:async()=>structuredClone(record),writeVault:async(value,expected)=>{if((record?.revision??0)!==expected)throw Error('Another tab changed the vault');record={...structuredClone(value),revision:expected+1};return record.revision;},deleteVault:async()=>{record=null;},
 writeMedia:async()=>{},readMedia:async()=>null,deleteMedia:async()=>{},listMediaIds:async()=>[],
 fetch:async(url,options)=>{calls.push({url,options});return network(url,options)},navigator:{onLine:true},window:{indexedDB:{},addEventListener:()=>{}},document:{body:{dataset:{}},hidden:false,documentElement:{},getElementById:byId,createElement:tag=>new Element(tag),addEventListener:()=>{}}});
vm.runInContext(readFileSync('public/field/app.js','utf8').replace(/^import[^\n]*\n/gm,''),context);
const run=code=>vm.runInContext(code,context),val=code=>JSON.parse(run('JSON.stringify('+code+')')),check=fn=>{fn();passed++};let passed=0;
const idle=async()=>{for(let i=0;i<200&&run('busy');i++)await new Promise(r=>setTimeout(r,5));};
byId('passphrase').value='synthetic-units-phrase';await byId('unlock-form').onsubmit({preventDefault(){}});await idle();
const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
const visitAt=new Date(Date.now()-2*3600000).toISOString().slice(0,16),earlier=new Date(Date.now()-26*3600000).toISOString().slice(0,16);
const payload={schema:1,leaseId:'lease-1',userId:'worker-1',organisationId:'org-1',personId:'p-1',personName:'Synthetic units person',identityHash:'id',visitId:'v-1',visitVersion:1,expiresAt:new Date(Date.now()+86400000).toISOString(),issuedAt:new Date().toISOString(),facts:{date:visitAt,source:'measured',notes:'',weight:'',systolic:'',diastolic:'',temperature:'',weeks:'',coughDays:''},programmeCapture:null};
const packet={payload,signature:Array.from(new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},pair.privateKey,new TextEncoder().encode(JSON.stringify(payload))))),publicKey:await crypto.subtle.exportKey('jwk',pair.publicKey)};
context.fixture={packet,packageHash:await packetHash(packet),facts:structuredClone(payload.facts),answers:{},absence:{},state:'draft',pending:null};await run("book.userId='worker-1';book.drafts.push(fixture);selected='lease-1';persist()");
run('render()');const find=(n,pred)=>pred(n)?n:(n.children??[]).map(c=>find(c,pred)).find(Boolean);const all=(n,pred,out=[])=>{if(pred(n))out.push(n);for(const c of n.children??[])all(c,pred,out);return out;};
const section=()=>all(byId('editor'),n=>n.tag==='details').find(d=>d.children.some(c=>c.tag==='summary'&&/Other units and unusual values/.test(c.textContent)));
const label=(box,text)=>find(box,n=>n.tag==='label'&&n.textContent===text);
check(()=>{const box=section();assert.ok(box,'units section rendered');assert.equal(box.open,false,'closed without entries');assert.equal(all(box,n=>n.tag==='select').length,6);});
check(()=>assert.ok(label(section(),'Weight · value in lb (pounds) / पाउंड').children.find(c=>c.tag==='input').disabled,'no value until a unit is chosen'));
// Choosing pounds and entering a value: the device copy keeps what was entered; tidying fills the converted kg value.
let s=label(section(),'Weight · unit / इकाई').children.find(c=>c.tag==='select');s.value='lb';s.onchange();await run('chain');run('render()');
check(()=>{assert.deepEqual(val('active().facts.entered'),{weight:{value:'',unit:'lb'}});assert.equal(section().open,true);});
let input=label(section(),'Weight · value in lb (pounds) / पाउंड').children.find(c=>c.tag==='input');check(()=>assert.equal(input.disabled,false));input.value='154';input.oninput();await run('chain');
check(()=>{const t=val('tidyFacts(active().facts)');assert.equal(t.weight,'69.85');assert.deepEqual(t.entered,{weight:{value:'154',unit:'lb'}});assert.equal(val('active().facts.weight'),'69.85');});
check(()=>assert.equal(run("valueProblem(tidyFacts(active().facts))"),null));
// An unusual converted value is shown with a reason field, and sync is held on the device until a reason is given.
input.value='882';input.oninput();await run('chain');run('render()');
check(()=>{assert.ok(all(byId('editor'),n=>n.className==='conflict').some(n=>/Weight 400.07 kg is outside the expected range 2–150 kg\. Check the value and its unit\. Outside 0.5–300 kg, a clinician who did not record it must confirm it/.test(n.textContent)));});
const bodies=[];let refuse=true;network=async(url,options)=>{if(url==='/api/workspace')return {ok:true,json:async()=>({user:{userId:'worker-1'},role:'asha',organisation:{id:'org-1',name:'Synthetic'},organisations:[],membership:{teamIds:[]},teams:[],people:[{id:'p-1'}],visits:[{id:'v-1',personId:'p-1',state:'draft',version:1}]})};
 if(url==='/api/commands'){const b=JSON.parse(options.body);bodies.push(b);if(refuse)return {ok:false,status:422,json:async()=>({error:'Temperature 30 °C is outside the expected range 34–41 °C (engineering placeholder — not clinically approved).'})};return {ok:true,json:async()=>({result:{visitId:'v-1',version:2}})};}throw Error('Unexpected '+url);};
await assert.rejects(()=>run('sync(active())'),/Weight 400.07 kg is outside the expected range/);passed++;
check(()=>{assert.equal(bodies.length,0,'nothing sent');assert.equal(run('active().pending'),null);assert.equal(run('active().state'),'draft');});
const reason=label(section(),'Reason for unusual weight (at least 10 characters) / कारण').children.find(c=>c.tag==='textarea');reason.value='Synthetic scale reading repeated twice.';reason.oninput();await run('chain');
// The server decides: a refusal it returns (here a stub) routes the draft to review with the reason.
await assert.rejects(()=>run('sync(active())'),/Temperature 30 °C/);passed++;
check(()=>{assert.match(run('active().conflict'),/Temperature 30 °C/);assert.equal(run('active().state'),'draft');assert.equal(bodies.length,1);});
refuse=false;await run('sync(active())');
check(()=>{const f=bodies.at(-1).facts;assert.equal(f.weight,'400.07');assert.deepEqual(f.entered,{weight:{value:'882',unit:'lb'}});assert.deepEqual(f.unusual,{weight:'Synthetic scale reading repeated twice.'});});
check(()=>assert.equal(run('active().state'),'synced'));
// A reason left on a value that is no longer unusual is dropped before sync; switching back to kg removes the entry.
check(()=>{const t=val("tidyFacts({...active().facts,entered:undefined,weight:'60',unusual:{weight:'Stale synthetic reason'}})");assert.equal(t.unusual,undefined);assert.equal(t.entered,undefined);});
writeFileSync('tests/field-units-client-result.json',JSON.stringify({passed,completedAt:new Date().toISOString(),coverage:'Field notebook units and unusual values with real Web Crypto and injected storage/network: unit controls for weight, temperature and cough duration; value input only after a unit is chosen; the device copy keeping the entered value and tidying filling the converted base value; an unusual converted value shown with the confirmation note and a reason field; sync held on the device without a reason (nothing sent); a server refusal routed to review with its reason; the sync body carrying the entered unit, converted value and reason; stale reasons dropped. Real browser rendering is not tested here.'},null,2));
console.log(`${passed} field units checks passed`);
