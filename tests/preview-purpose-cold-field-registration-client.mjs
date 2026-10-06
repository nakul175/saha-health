import {offlineOpenHarness} from './lib/offline-open-harness.mjs';
// Device privacy is injected here; its server/IndexedDB effects are verified in device-work-contract/browser.
import {deviceDigest} from '../public/field/device-work.js';
// Slice 3g: offline registration queue in the field notebook. Runs public/field/app.js in Node with real Web Crypto,
// the real sealing functions, injected storage/network and a minimal DOM (the tests/field-media-client.mjs harness).
// Every registration body the notebook sends is checked against the server's own command schema, transpiled from
// lib/saha/field-registration.ts. Real IndexedDB and browser offline behaviour are covered only by the browser check.
import vm from 'node:vm';import assert from 'node:assert/strict';import ts from 'typescript';import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';import {join} from 'node:path';import {pathToFileURL} from 'node:url';
import {derive,seal,unseal,verifyPacket,packetHash,sealBytes,unsealBytes} from '../public/field/vault.js';
const dir=mkdtempSync(join(process.cwd(),'.field-registration-client-'));let schema;
try{for(const f of ['abdm', 'abdm-transfer', 'access', 'action-plan', 'adapter-operations', 'agent', 'agent-minimisation', 'ai-budget', 'alerts', 'anaemia', 'audit-chain', 'capability-lifecycle', 'caseload', 'consent', 'continuity', 'core', 'delegation', 'ehr', 'environment', 'evaluation', 'exceptional', 'expansion', 'facility-scope', 'fact-provenance', 'fhir-document', 'fhir-validate', 'field', 'field-registration', 'governance', 'household', 'household-constants', 'household-visit', 'household-visit-constants', 'identity', 'imported-visits', 'media', 'merge', 'mis', 'operations', 'outreach', 'pack-installation', 'partition', 'pilot', 'programme-commands', 'programmes', 'provider-sandbox', 'purpose-scope', 'referral-needs', 'referral-request', 'referral-rules', 'retention', 'rights', 'seed', 'send-gate', 'service-identity', 'shadow', 'store', 'task-limits', 'types'])writeFileSync(join(dir,f+'.js'),ts.transpileModule(readFileSync(`lib/saha/${f}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'"));
 schema=(await import(pathToFileURL(join(dir,'field-registration.js')))).fieldRegistrationSchema;}finally{rmSync(dir,{recursive:true,force:true});}
class Element{constructor(tag='div'){this.tag=tag;this.children=[];this.value='';this.hidden=false;this.style={};this.disabled=false;}append(...c){this.children.push(...c)}prepend(...c){this.children.unshift(...c)}replaceChildren(...c){this.children=c}querySelector(tag){return this.children.find(c=>c.tag===tag)||this.children.map(c=>c.querySelector?.(tag)).find(Boolean)||null}}
const elements=new Map();const byId=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id)};
let record=null,calls=[],network=async()=>{throw Error('Network disconnected')};const media=new Map();
const context=vm.createContext({...offlineOpenHarness(()=>context.writeVault),deviceDigest,privacyReviewRequired:()=>false,clearPrivacyReviewRequired:()=>true,discardCachedRegistrationMatches:async(value,key,salt,revision)=>({book:value,revision}),reconcileRegistrationBook:async(value,key,salt,revision)=>({book:value,revision}),reconcileDeviceBook:async(book,_key,_salt,revision)=>({book,revision,removed:0}),reportDeviceFailure:async()=>false,Blob,OffscreenCanvas:class{},createImageBitmap:async()=>{throw Error('no images here')},console,crypto,TextEncoder,TextDecoder,structuredClone,Date,Map,Array,Promise,Error,JSON,Uint8Array,Object,Number,String,isNaN,setTimeout:()=>0,clearTimeout:()=>{},derive,seal,unseal,verifyPacket,packetHash,sealBytes,unsealBytes,
 readVault:async()=>structuredClone(record),writeVault:async(value,expected)=>{if((record?.revision??0)!==expected)throw Error('Another tab changed the vault');record={...structuredClone(value),revision:expected+1};return record.revision;},deleteVault:async()=>{record=null;media.clear();},
 writeMedia:async(id,value)=>{media.set(id,structuredClone(value))},readMedia:async id=>structuredClone(media.get(id)??null),deleteMedia:async id=>{media.delete(id)},listMediaIds:async()=>[...media.keys()],
 fetch:async(url,options)=>{calls.push({url,options});return network(url,options)},navigator:{onLine:true},window:{indexedDB:{},addEventListener:()=>{}},document:{body:{dataset:{}},hidden:false,documentElement:{},getElementById:byId,createElement:tag=>new Element(tag),addEventListener:()=>{}}});
vm.runInContext(readFileSync('public/field/app.js','utf8').replace(/^import[^\n]*\n/gm,''),context);
const run=code=>vm.runInContext(code,context),val=code=>JSON.parse(run('JSON.stringify('+code+')')),check=fn=>{fn();passed++};let passed=0;
const rejects=async(code,pattern)=>{await assert.rejects(()=>run(code),pattern);passed++;};
const idle=async()=>{for(let i=0;i<200&&run('busy');i++)await new Promise(r=>setTimeout(r,5));};
// An existing notebook without the registrations field (saved before this slice) opens with an empty queue.
const legacyKey=await derive('synthetic-registration-phrase',[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16]);record={...await seal(legacyKey,{schema:1,userId:null,drafts:[]}),salt:[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],revision:1};
byId('passphrase').value='synthetic-registration-phrase';await byId('unlock-form').onsubmit({preventDefault(){}});await idle();
check(()=>assert.deepEqual(val('book.registrations'),[]));
run(`globalThis.fill=(x={})=>{book.form=blankForm();const f=book.form;Object.assign(f,{name:'Synthetic Registration Alpha',age:'34',sex:'Female',village:'Synthetic village',programme:'Maternal care',teamId:'team-a'});for(const [k,v] of Object.entries(x)){if(k==='facts'||k==='referral')Object.assign(f[k],v);else f[k]=v;}}`);
// Before any online workspace the notebook does not know the organisation or teams.
run('fill()');await rejects('queueRegistration()',/Load the online workspace/);
const workspace={user:{userId:'worker-1'},role:'asha',organisation:{id:'org-1',name:'Synthetic organisation'},organisations:[{id:'org-1',name:'Synthetic organisation'}],membership:{teamIds:['team-a']},teams:[{id:'team-a',name:'Synthetic team A'},{id:'team-b',name:'Synthetic team B'}],people:[{id:'p-1'}],visits:[{id:'v-1',personId:'p-1',state:'draft',version:2}]};
const ok=j=>({ok:true,status:200,json:async()=>j}),refuse=(status,error)=>({ok:false,status,json:async()=>({error})});
network=async url=>{if(url==='/api/workspace')return ok(workspace);throw Error('Unexpected '+url);};
await run('loadWorkspace()');check(()=>assert.deepEqual(val('book.context.teams'),[{id:'team-a',name:'Synthetic team A'}],'only the worker’s own teams are offered'));check(()=>assert.equal(run('book.context.organisationId'),'org-1'));
// Offline from here: every local refusal, with nothing queued and nothing sent.
network=async()=>{throw Error('Network disconnected')};const offlineCalls=calls.length;
const future=new Date(Date.now()+3600000).toISOString().slice(0,16),past=new Date(Date.now()-3600000).toISOString().slice(0,16);
for(const [x,pattern] of [[{name:'  '},/Enter the person/],[{age:'130'},/whole years/],[{age:'3.5'},/whole years/],[{sex:''},/Choose the sex/],[{village:' '},/village or locality/],[{teamId:'team-b'},/one of your care teams/],
 [{withReferral:true},/needs the first visit/],[{withVisit:true,facts:{systolic:'120'}},/both blood pressure/],[{withVisit:true,facts:{weight:'abc'}},/positive number/],[{withVisit:true,facts:{date:future}},/future/],
 [{withVisit:true,withReferral:true,referral:{facility:'ab',reason:'Synthetic reason'}},/Name the facility/],[{withVisit:true,withReferral:true,referral:{facility:'Synthetic hospital',reason:'bad'}},/reason for the referral/]]){context.x=x;run('fill(x)');await rejects('queueRegistration()',pattern);}
check(()=>assert.equal(run('book.registrations.length'),0));
// Three registrations queued offline: plain, with a first visit and referral request, and one the server will find a match for.
run("fill()");const firstFormId=run("book.form.id");await run('queueRegistration()');check(()=>assert.equal(run("book.registrations[0].id"),firstFormId));check(()=>assert.notEqual(run("book.form.id"),firstFormId));
context.x={name:'Synthetic Registration Beta',withVisit:true,withReferral:true,facts:{date:past,systolic:'150',diastolic:'96',weight:'61',notes:'Synthetic first visit.'},referral:{facility:'Synthetic block hospital',reason:'Synthetic high reading.'}};run('fill(x)');await run('queueRegistration()');
context.x={name:'Synthetic Registration Gamma'};run('fill(x)');await run('queueRegistration()');
check(()=>assert.equal(calls.length,offlineCalls,'queueing sends nothing'));
check(()=>assert.deepEqual(val('book.registrations.map(r=>r.state)'),['queued','queued','queued']));check(()=>assert.equal(run('book.form.name'),'','form cleared after queueing'));
check(()=>assert.equal(JSON.stringify(record).includes('Synthetic Registration'),false,'the notebook holds only ciphertext'));
check(()=>{const b=run('book.registrations[1]');assert.equal(b.facts.systolic,'150');assert.equal(b.referralRequest.facility,'Synthetic block hospital');assert.equal(b.person.age,34);assert.equal(b.organisationId,'org-1');assert.equal(b.userId,'worker-1');});
check(()=>assert.equal(run("book.registrations.filter(r=>r.facts===null).length"),2,'no visit unless recorded'));
// Lock and unlock: the queue survives.
run('lock()');await run('chain');check(()=>assert.equal(run('book'),null));
byId('passphrase').value='synthetic-registration-phrase';await byId('unlock-form').onsubmit({preventDefault(){}});await idle();check(()=>assert.equal(run('book.registrations.length'),3));
// A prepared visit draft with a queued photo, to check the order of Sync all.
const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
const payload={schema:1,leaseId:'lease-1',userId:'worker-1',organisationId:'org-1',personId:'p-1',personName:'Synthetic existing person',identityHash:'id',visitId:'v-1',visitVersion:1,expiresAt:new Date(Date.now()+86400000).toISOString(),issuedAt:new Date().toISOString(),facts:{date:past,source:'measured',notes:'',weight:'70',systolic:'',diastolic:'',temperature:'',weeks:'',coughDays:''},programmeCapture:null};
const packet={payload,signature:Array.from(new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},pair.privateKey,new TextEncoder().encode(JSON.stringify(payload))))),publicKey:await crypto.subtle.exportKey('jwk',pair.publicKey)};
context.fixture={packet,packageHash:await packetHash(packet),facts:structuredClone(payload.facts),answers:{},absence:{},state:'draft',pending:null};await run("book.drafts.push(fixture);persist()");
const png=new Uint8Array(2048);png.set([0xff,0xd8,0xff,0xe0]);for(let i=4;i<png.length;i++)png[i]=(i*7)%251;
await run(`(async()=>{const d=book.drafts[0],bytes=new Uint8Array(${JSON.stringify(Array.from(png))});const id=crypto.randomUUID();await writeMedia(id,await sealBytes(key,bytes));(d.media??=[]).push({id,purpose:'wound-or-skin',mime:'image/jpeg',size:bytes.byteLength,sha256:await hex(bytes),capturedAt:new Date().toISOString(),state:'queued'});await persist();})()`);
// A simulated server: receipts by key, registrations by registration id, possible matches for chosen names.
const receipts=new Map(),registered=new Map(),bodies=[];let lose=new Set(),refuseOnce=new Map(),matchNames=new Set(['Synthetic Registration Gamma']),overflowNames=new Set(),noCandidateNames=new Set(),emptyOk=false,people=0;
network=async(url,options)=>{
 if(url==='/api/workspace')return ok(workspace);
 if(url==='/api/patient-matches'){const b=JSON.parse(options.body);assert.equal(options.headers['x-saha-organisation'],'org-1');if(noCandidateNames.has(b.name))return ok({hash:'c'.repeat(64),candidates:[],overflow:false});return ok({copyId:'b'.repeat(64),hash:'a'.repeat(64),candidates:[{id:'p-existing',name:b.name,age:b.age,sex:b.sex,village:b.village,version:1,match:'Same normalised name'}],overflow:overflowNames.has(b.name)});}
 if(url.startsWith('/api/media'))return ok({mediaId:'m-1'});
 if(url==='/api/commands'){const b=JSON.parse(options.body),key=options.headers['Idempotency-Key'];
  if(b.type==='syncFieldVisit')return ok({result:{visitId:'v-1',version:2,leaseId:'lease-1'}});
  assert.equal(b.type,'registerFieldPerson');bodies.push({key,body:b});
  if(receipts.has(key))return ok({result:receipts.get(key),replayed:true});
  if(emptyOk){emptyOk=false;return ok({});}
  if(refuseOnce.has(b.name)){const [status,error]=refuseOnce.get(b.name);refuseOnce.delete(b.name);return refuse(status,error);}
  if(matchNames.has(b.name)&&!b.registrationReview)return refuse(409,'Possible patient matches need review before a new record is created.');
  const prior=registered.get(b.registrationId);const result=prior?{...prior,alreadyRegistered:true}:{personId:'person-'+(++people),visitId:b.facts?'visit-'+people:null,referralRequested:!!b.referralRequest,identity:b.registrationReview?.decision==='provisional'?'provisional':'local',alreadyRegistered:false};
  if(!prior)registered.set(b.registrationId,result);receipts.set(key,result);if(lose.has(b.registrationId)){lose.delete(b.registrationId);throw Error('Response lost');}return ok({result});}
 throw Error('Unexpected '+url);};
const order=from=>calls.slice(from).filter(c=>c.url!=='/api/workspace').map(c=>c.url==='/api/commands'?JSON.parse(c.options.body).type+':'+(JSON.parse(c.options.body).name??'draft'):c.url.split('?')[0]);
const A=run('book.registrations[0].id'),B=run('book.registrations[1].id'),C=run('book.registrations[2].id');
// 1. A lost response on the first registration stops the run: nothing after it is sent, and the key is kept.
lose.add(A);let from=calls.length;await rejects('syncAll()',/Stopped: .*outcome not confirmed/);
check(()=>assert.deepEqual(order(from),['registerFieldPerson:Synthetic Registration Alpha'],'drafts and media wait for the registration'));
const lostKey=run('book.registrations[0].pending.key');check(()=>assert.equal(lostKey,bodies.at(-1).key));check(()=>assert.equal(run('book.registrations[0].state'),'queued'));
await rejects("discardRegistration(book.registrations[0])",/pending sync first/);
// 2. Sync all again: registrations first (the lost one with the same key and body), then the visit draft, then its media.
from=calls.length;await run('syncAll()');
check(()=>assert.deepEqual(order(from),['registerFieldPerson:Synthetic Registration Alpha','registerFieldPerson:Synthetic Registration Beta','registerFieldPerson:Synthetic Registration Gamma','/api/patient-matches','syncFieldVisit:draft','/api/media']));
check(()=>{const [first,retry]=bodies.filter(b=>b.body.registrationId===A);assert.equal(retry.key,lostKey);assert.deepEqual(retry.body,first.body);});
check(()=>assert.deepEqual(val('book.registrations.map(r=>r.state)'),['synced','synced','identity']));
check(()=>{const r=run('book.registrations[1]');assert.equal(r.result.visitId,'visit-2');assert.equal(r.pending,null);assert.ok(r.syncedAt);});
check(()=>assert.equal(run('book.drafts[0].state'),'synced'));check(()=>assert.equal(run('book.drafts[0].media[0].state'),'uploaded'));
check(()=>assert.match(byId('status').textContent,/2 registrations, 1 visit draft, 1 media item synced; 1 needs review/));
check(()=>{const b=bodies.find(b=>b.body.registrationId===B).body;assert.deepEqual(Object.keys(b).sort(),['age','capturedAt','facts','name','programme','referralRequest','registrationId','sex','teamId','type','village']);assert.equal(b.referralRequest.reason,'Synthetic high reading.');});
// 3. Possible matches: candidates are shown on the device; Sync all does not resend until the worker reviews.
check(()=>{const r=run('book.registrations[2]');assert.equal(r.matches.hash,'a'.repeat(64));assert.equal(r.matches.candidates[0].id,'p-existing');assert.equal(r.pending,null);assert.match(r.reason,/Possible patient matches/);});
from=calls.length;await run('syncAll()');check(()=>assert.equal(order(from).length,0,'nothing retried blindly'));
run("selected='reg:"+C+"';render()");const text=n=>[n.textContent??'',...(n.children??[]).map(text)].join(' ');check(()=>assert.match(text(byId('editor')),/Possible matches.*Synthetic Registration Gamma · 34 · Female · Synthetic village · Same normalised name/s));
await rejects("decideRegistration(book.registrations[2],'','Synthetic reason given')",/different person, or not sure/);
await rejects("decideRegistration(book.registrations[2],'distinct','short')",/at least 10 characters/);
const firstKey=bodies.filter(b=>b.body.registrationId===C)[0].key;
check(()=>assert.equal(run('book.registrations[2].state'),'identity'));
await run("decideRegistration(book.registrations[2],'distinct','Synthetic: different household and father name.')");
check(()=>{const last=bodies.at(-1);assert.equal(last.body.registrationId,C);assert.notEqual(last.key,firstKey,'a reviewed resend is a new request');assert.deepEqual(last.body.registrationReview,{hash:'a'.repeat(64),decision:'distinct',reason:'Synthetic: different household and father name.'});});
check(()=>{const r=run('book.registrations[2]');assert.equal(r.state,'synced');assert.equal(r.matches,null);assert.equal(r.decision,null);});
// 4. A refusal routes to review; only the worker's explicit resend sends it again, with a new key and the same registration id.
context.x={name:'Synthetic Registration Delta'};run('fill(x)');await run('queueRegistration()');refuseOnce.set('Synthetic Registration Delta',[403,'Choose a care team you belong to.']);
let locks=0;context.setTimeout=(fn,ms)=>{if(ms===120000)locks++;return 0;};
await run('syncAll()');const D=run('book.registrations[3]');check(()=>{assert.equal(D.state,'review');assert.match(D.reason,/care team.*Nothing was created/);});
// Slice 13d (tenth review): a refused step does not reset the notebook's idle lock timer; only a step that synced does.
check(()=>assert.equal(locks,0,'the refused registration did not extend the unlock'));context.setTimeout=()=>0;
from=calls.length;await run('syncAll()');check(()=>assert.equal(order(from).length,0));
await run('requeueRegistration(book.registrations[3])');await run('syncAll()');
check(()=>{const sent=bodies.filter(b=>b.body.registrationId===D.id);assert.equal(sent.length,2);assert.notEqual(sent[0].key,sent[1].key);assert.equal(run('book.registrations[3].state'),'synced');});
// 5. A resend under a new key after an unseen success returns the same person (the server decides by registration id).
context.x={name:'Synthetic Registration Epsilon'};run('fill(x)');await run('queueRegistration()');const E=run('book.registrations[4].id');lose.add(E);await rejects('syncAll()',/not confirmed/);
await run("book.registrations[4].pending=null;persist()");await run('syncAll()');
check(()=>{const sent=bodies.filter(b=>b.body.registrationId===E);assert.equal(sent.length,2);assert.notEqual(sent[0].key,sent[1].key);const r=run('book.registrations[4]');assert.equal(r.result.alreadyRegistered,true);assert.equal(r.result.personId,registered.get(E).personId);});
check(()=>assert.match(byId('status').textContent,/1 registration, 0 visit drafts, 0 media items synced/));
// 6. Temporary failure and a 2xx without a person keep the item pending with the same key.
context.x={name:'Synthetic Registration Zeta'};run('fill(x)');await run('queueRegistration()');refuseOnce.set('Synthetic Registration Zeta',[503,'Service unavailable.']);
await rejects('syncAll()',/Service unavailable.*same key/);const zetaKey=run('book.registrations[5].pending.key');check(()=>assert.equal(run('book.registrations[5].state'),'queued'));
emptyOk=true;await rejects('syncAll()',/did not name the person/);check(()=>assert.equal(run('book.registrations[5].pending.key'),zetaKey));
await run('syncAll()');check(()=>{const sent=bodies.filter(b=>b.body.name==='Synthetic Registration Zeta');assert.ok(sent.length===3&&sent.every(b=>b.key===zetaKey));assert.equal(run('book.registrations[5].state'),'synced');});
// 7. Too many matches, or a conflict with no visible candidate, route to review without a resend option for identity.
context.x={name:'Synthetic Registration Eta'};run('fill(x)');await run('queueRegistration()');matchNames.add('Synthetic Registration Eta');overflowNames.add('Synthetic Registration Eta');
context.x={name:'Synthetic Registration Theta'};run('fill(x)');await run('queueRegistration()');refuseOnce.set('Synthetic Registration Theta',[409,'A teammate changed this organisation. Refresh to load their changes, then review and retry.']);noCandidateNames.add('Synthetic Registration Theta');
await run('syncAll()');check(()=>{assert.equal(run('book.registrations[6].state'),'review');assert.match(run('book.registrations[6].reason'),/Too many possible matches/);assert.equal(run('book.registrations[7].state'),'review');assert.match(run('book.registrations[7].reason'),/teammate changed/);assert.equal(run('book.registrations[7].matches'),undefined);});
// 8. Every body sent is valid for the server's own command schema.
check(()=>assert.ok(bodies.every(b=>schema.safeParse(b.body).success),'bodies match fieldRegistrationSchema'));
check(()=>assert.equal(schema.safeParse({...bodies[0].body,registrationId:'x'}).success,false));
// 9. Discard and removal; the device limit.
await rejects('discardRegistration(book.registrations[6])',/outcome is unknown/);await run('discardRegistration(book.registrations[5])');await run("discardRegistration(book.registrations.find(r=>r.id==='"+A+"'))");check(()=>assert.equal(run('book.registrations.length'),6));
for(let i=0;i<7;i++){context.x={name:'Synthetic Limit '+i};run('fill(x)');await run('queueRegistration()');}
check(()=>assert.equal(run("book.registrations.filter(r=>r.state!=='synced').length"),9));context.x={name:'Synthetic Limit over'};run('fill(x)');await run('queueRegistration()');await rejects('queueRegistration()',/At most 10 registrations/);
// 10. A notebook for another account refuses to sync its registrations.
workspace.user.userId='worker-2';from=calls.length;await rejects('syncAll()',/belongs to another account/);check(()=>assert.equal(order(from).length,0));
writeFileSync('tests/evidence/preview-purpose-cold/repeat/compatibility/field-registration-client-result.json',JSON.stringify({passed,completedAt:new Date().toISOString(),coverage:'Field notebook offline registration queue with real Web Crypto and injected storage/network: older notebooks open with an empty queue; teams come from the last online workspace; every local refusal (name, age, sex, locality, team, referral without visit, blood pressure pair, numbers, future time, facility, reason) with nothing queued or sent; sealed storage without names in the notebook; lock/unlock survival; Sync all in dependency order (registrations, then visit drafts, then media) with a lost registration response stopping the run and retried with the same key and body; possible matches fetched and shown on the device, not resent until reviewed, then resent with the review under a new key; refusal routed to review and resent only on request with a new key and the same registration id; a new-key resend after an unseen success returning the same person; temporary failure and a 2xx without a person kept pending with the same key; overflow and candidate-free conflicts routed to review; bodies valid for the server schema; discard, removal and the 10-item limit; another account refused. Real IndexedDB and browser offline behaviour are not tested here.'},null,2)+'\n');
console.log(`${passed} field registration queue checks passed`);
