// Slice 14e: the field notebook's device contact (R73; BR-REP-01, BR-SEC-03, BR-OFF-07). Runs public/field/app.js in Node with
// real Web Crypto, the real sealing functions, injected storage and network and a minimal DOM (the harness of
// tests/field-registration-client.mjs). Checks the failure tally (step, class, grant, counts; no patient details), the report
// sent on contact with its kept key, removal of the drafts, photos, voice notes and registration copies an order names, the
// receipts, and that every report and receipt body is valid for the server's own schema (transpiled from
// lib/saha/field-device.ts). Real IndexedDB and browser behaviour are covered only by the browser check.
import vm from 'node:vm';import assert from 'node:assert/strict';import ts from 'typescript';import {readFileSync,writeFileSync,mkdtempSync,rmSync,readdirSync} from 'node:fs';import {join} from 'node:path';import {pathToFileURL} from 'node:url';
import {derive,seal,unseal,verifyPacket,packetHash,sealBytes,unsealBytes} from '../public/field/vault.js';
const dir=mkdtempSync(join(process.cwd(),'.field-device-client-'));let D;
try{for(const f of readdirSync('lib/saha').filter(f=>f.endsWith('.ts')))writeFileSync(join(dir,f.replace(/\.ts$/,'')+'.js'),ts.transpileModule(readFileSync(`lib/saha/${f}`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'"));
 writeFileSync(join(dir,'package.json'),'{"type":"module"}');D=await import(pathToFileURL(join(dir,'field-device.js')));}finally{rmSync(dir,{recursive:true,force:true});}
class Element{constructor(tag='div'){this.tag=tag;this.children=[];this.value='';this.hidden=false;this.style={};this.disabled=false;this.textContent='';}append(...c){this.children.push(...c)}prepend(...c){this.children.unshift(...c)}replaceChildren(...c){this.children=c}querySelector(tag){return this.children.find(c=>c.tag===tag)||this.children.map(c=>c.querySelector?.(tag)).find(Boolean)||null}}
const elements=new Map();const byId=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id)};
let record=null,calls=[],network=async()=>{throw Error('Network disconnected')};const media=new Map();
const context=vm.createContext({Blob,OffscreenCanvas:class{},createImageBitmap:async()=>{throw Error('no images here')},console,crypto,TextEncoder,TextDecoder,structuredClone,Date,Map,Set,Array,Promise,Error,JSON,Uint8Array,Object,Number,String,Math,isNaN,setTimeout:()=>0,clearTimeout:()=>{},derive,seal,unseal,verifyPacket,packetHash,sealBytes,unsealBytes,
 readVault:async()=>structuredClone(record),writeVault:async(value,expected)=>{if((record?.revision??0)!==expected)throw Error('Another tab changed the vault');record={...structuredClone(value),revision:expected+1};return record.revision;},deleteVault:async()=>{record=null;media.clear();},
 writeMedia:async(id,value)=>{media.set(id,structuredClone(value))},readMedia:async id=>structuredClone(media.get(id)??null),deleteMedia:async id=>{media.delete(id)},listMediaIds:async()=>[...media.keys()],
 fetch:async(url,options)=>{calls.push({url,options});return network(url,options)},navigator:{onLine:true},window:{indexedDB:{},addEventListener:()=>{}},document:{hidden:false,documentElement:{},getElementById:byId,createElement:tag=>new Element(tag),addEventListener:()=>{}}});
vm.runInContext(readFileSync('public/field/app.js','utf8').replace(/^import[^\n]*\n/,''),context);
const run=code=>vm.runInContext(code,context),val=code=>JSON.parse(run('JSON.stringify('+code+')')),check=fn=>{fn();passed++};let passed=0;
const idle=async()=>{for(let i=0;i<200&&run('busy');i++)await new Promise(r=>setTimeout(r,5));};
const ok=j=>({ok:true,status:200,json:async()=>j}),refuse=(status,error='Refused')=>({ok:false,status,json:async()=>({error})});
const L=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
// An unlocked notebook with three drafts (two patients in org-1, one in org-2), a queued photo on the first, and a synced
// registration copy of patient p-1.
byId('passphrase').value='synthetic-device-phrase';await byId('unlock-form').onsubmit({preventDefault(){}});await idle();
const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
async function draft(leaseId,personId,org,state='draft'){const payload={schema:1,leaseId,userId:'worker-1',organisationId:org,personId,personName:'Synthetic Person '+personId,identityHash:'id',visitId:'v-'+leaseId,visitVersion:1,expiresAt:new Date(Date.now()+86400000).toISOString(),issuedAt:new Date().toISOString(),facts:{date:'2026-10-01T10:00',source:'measured',notes:'',weight:'60',systolic:'',diastolic:'',temperature:'',weeks:'',coughDays:''},programmeCapture:null};
 const packet={payload,signature:Array.from(new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},pair.privateKey,new TextEncoder().encode(JSON.stringify(payload))))),publicKey:await crypto.subtle.exportKey('jwk',pair.publicKey)};
 return {packet,packageHash:await packetHash(packet),facts:structuredClone(payload.facts),answers:{},absence:{},state,pending:null,...(state==='synced'?{receipt:{visitId:'v-'+leaseId}}:{})};}
context.fixtures=[await draft(L(1),'p-1','org-1'),await draft(L(2),'p-2','org-1','synced'),await draft(L(3),'p-1','org-2')];
await run("book.userId='worker-1';book.context={organisationId:'org-1',organisationName:'Synthetic',userId:'worker-1',teams:[{id:'t',name:'Team'}],savedAt:new Date().toISOString()};book.drafts.push(...fixtures);book.registrations.push({id:'reg-1',organisationId:'org-1',userId:'worker-1',capturedAt:new Date().toISOString(),person:{name:'Synthetic Registered',age:30,sex:'Female',village:'V',programme:'General care',teamId:'t'},facts:null,referralRequest:null,state:'synced',pending:null,result:{personId:'p-1',visitId:null,identity:'local',alreadyRegistered:false}});persist()");
const png=new Uint8Array(2048);png.set([0xff,0xd8,0xff,0xe0]);for(let i=4;i<png.length;i++)png[i]=(i*7)%251;
await run(`(async()=>{const d=book.drafts[0],bytes=new Uint8Array(${JSON.stringify(Array.from(png))});const id=crypto.randomUUID();await writeMedia(id,await sealBytes(key,bytes));(d.media??=[]).push({id,purpose:'wound-or-skin',mime:'image/jpeg',size:bytes.byteLength,sha256:await hex(bytes),capturedAt:new Date().toISOString(),state:'queued'});await persist();})()`);
check(()=>assert.equal(media.size,1));

// 1. The failure tally: refusals and lost connections are counted by step, class and grant, with no patient details.
const workspace={user:{userId:'worker-1'},role:'asha',organisation:{id:'org-1',name:'Synthetic'},organisations:[{id:'org-1',name:'Synthetic'}],membership:{teamIds:['t']},teams:[{id:'t',name:'Team'}],people:[{id:'p-1'},{id:'p-2'}],visits:[{id:'v-'+L(1),personId:'p-1',state:'draft',version:1}]};
let syncStatus=409;network=async url=>{if(url==='/api/workspace')return ok(workspace);if(url==='/api/commands')return refuse(syncStatus,'The server visit changed.');throw Error('Network disconnected');};
await assert.rejects(()=>run('sync(book.drafts[0],false)'),/server visit changed/);passed++;
await assert.rejects(()=>run('sync(book.drafts[0],false)'),/server visit changed/).catch(()=>{});await run('book.drafts[0].conflict=null');
network=async url=>{if(url==='/api/workspace')return ok(workspace);throw TypeError('Failed to fetch');};
await assert.rejects(()=>run('sync(book.drafts[0],false)'),/Failed to fetch/);passed++;
network=async()=>{throw TypeError('Failed to fetch');};await assert.rejects(()=>run("loadWorkspace('org-1')"),/Failed to fetch/);passed++;
check(()=>{const f=val('book.failures');assert.deepEqual(f.map(x=>[x.step,x.errorClass,x.grantId,x.org]).sort(),[['draft','conflict',L(1),'org-1'],['draft','network',L(1),'org-1'],['workspace','network',null,'org-1']]);assert.equal(f.find(x=>x.errorClass==='conflict').count,2,'the same step, class and grant is counted, not repeated');assert.ok(!JSON.stringify(f).includes('Synthetic'),'no names in the tally');});
await run('book.drafts[0].pending=null');

// 2. Contact: the report is sent once with its key, cleared when Saha answers, kept (same key) when it does not.
const sent=[],receipts=new Map();let reportStatus=503,orders=[],receiptStatus=200;
network=async(url,options)=>{
 if(url==='/api/workspace')return ok(workspace);
 if(url==='/api/field-device'&&options?.method==='POST'){const b=JSON.parse(options.body);sent.push({key:options.headers['Idempotency-Key'],org:options.headers['x-saha-organisation'],body:b});
  if(b.kind==='sync-failures')return reportStatus===200?ok({recorded:b.reports.length}):refuse(reportStatus);
  if(receiptStatus!==200)return refuse(receiptStatus);receipts.set(options.headers['Idempotency-Key'],b);return ok({confirmed:b.leaseIds});}
 if(url==='/api/field-device')return ok({removals:options?.headers?.['x-saha-organisation']==='org-1'?orders:[]});
 if(url==='/api/commands')return ok({result:{visitId:'v',version:2,leaseId:JSON.parse(options.body).leaseId}});
 throw Error('Unexpected '+url);};
await run("deviceContact('org-1')");
const firstKey=sent[0]?.key;check(()=>{assert.equal(sent.length,1);assert.equal(sent[0].body.kind,'sync-failures');assert.equal(sent[0].body.appVersion,'field-14e');assert.equal(sent[0].org,'org-1');assert.equal(sent[0].body.reports.length,3);assert.ok(val('book.failureReport'),'kept after a 503');});
reportStatus=200;await run("deviceContact('org-1')");
check(()=>{assert.equal(sent.length,2);assert.equal(sent[1].key,firstKey,'the same key on retry');assert.deepEqual(sent[1].body,sent[0].body,'the same body on retry');assert.equal(run('book.failureReport'),null);assert.deepEqual(val('book.failures'),[]);});
check(()=>assert.ok(sent.every(x=>D.syncReportSchema.safeParse(x.body).success),'report bodies match the server schema'));
check(()=>assert.ok(!JSON.stringify(sent).includes('Synthetic'),'no names in reports'));
// A refused report (for example, a grant Saha does not recognise) is dropped so it never blocks the notebook.
await run(`noteFailure('media','invalid','${L(9)}','org-1')`);reportStatus=422;await run("deviceContact('org-1')");check(()=>{assert.equal(run('book.failureReport'),null);assert.deepEqual(val('book.failures'),[]);});
// Counts for another organisation wait for that organisation's contact.
await run(`noteFailure('draft','conflict','${L(3)}','org-2')`);reportStatus=200;const before2=sent.length;await run("deviceContact('org-1')");check(()=>{assert.equal(sent.length,before2,'nothing for org-2 sent to org-1');assert.equal(val('book.failures').length,1);});
await run("deviceContact('org-2')");check(()=>{assert.equal(sent.at(-1).org,'org-2');assert.deepEqual(val('book.failures'),[]);});

// 3. A grant order: that draft, its sealed photo, and nothing else, is removed; the receipt counts it.
orders=[{personId:'p-1',scope:'grant',reason:'grant-revoked',leaseIds:[L(1)],registration:false,since:new Date().toISOString(),confirmed:false}];
let from=sent.length;await run("deviceContact('org-1')");
check(()=>{assert.deepEqual(val('book.drafts.map(d=>d.packet.payload.leaseId)'),[L(2),L(3)],'only the ordered grant\'s draft is removed');assert.equal(media.size,0,'its sealed photo is deleted from the device');assert.equal(val('book.registrations').length,1,'a grant order leaves the registration copy');});
check(()=>{const r=sent.slice(from).filter(x=>x.body.kind==='removal-receipt');assert.equal(r.length,1);assert.deepEqual(r[0].body.removed,{drafts:1,unsynced:1,media:1,registrations:0});assert.deepEqual([r[0].body.personId,r[0].body.leaseIds,r[0].body.registration,r[0].body.appVersion],['p-1',[L(1)],false,'field-14e']);assert.equal(run('book.receipts.length'),0);});
check(()=>{const log=val('book.removalLog');assert.equal(log.length,1);assert.deepEqual([log[0].reason,log[0].drafts,log[0].unsynced],['grant-revoked',1,1]);assert.ok(!JSON.stringify(log).includes('Synthetic'));});
check(()=>assert.ok(!JSON.stringify(record).includes('Synthetic Person p-1')&&!JSON.stringify(record).includes(L(2)),'the stored notebook holds only ciphertext'));
// The same order again, now confirmed and with nothing left on this device: no second receipt.
orders[0].confirmed=true;from=sent.length;await run("deviceContact('org-1')");check(()=>assert.equal(sent.slice(from).filter(x=>x.body.kind==='removal-receipt').length,0));

// 4. A person-wide order removes every copy of that patient in that organisation (including the registration copy), not the
// same patient id in another organisation; an unanswered receipt is kept and resent with its key.
await run(`{const d=fixtures.find(d=>d.packet.payload.leaseId==='${L(1)}');d.media=[];book.drafts.push(d);}persist()`);
orders=[{personId:'p-1',scope:'person',reason:'access-ended',leaseIds:[L(7)],registration:true,since:new Date().toISOString(),confirmed:false}];receiptStatus=503;from=sent.length;
const text=await run("(async()=>removalText(await deviceContact('org-1')))()");
check(()=>{assert.deepEqual(val('book.drafts.map(d=>d.packet.payload.leaseId)'),[L(2),L(3)],'p-1 in org-1 removed (also under a grant the order did not name); org-2 kept');assert.equal(val('book.registrations').length,0,'the registration copy is removed');});
check(()=>{assert.match(text,/Removed from this device at Saha's instruction \(you no longer have access to this patient/);assert.match(text,/1 visit draft \(1 not synced\)/);assert.match(text,/Tell your supervisor/);});
const kept=val('book.receipts');check(()=>{assert.equal(kept.length,1);assert.deepEqual(kept[0].body.removed,{drafts:1,unsynced:1,media:0,registrations:1});assert.equal(kept[0].body.registration,true);});
receiptStatus=200;orders=[];from=sent.length;await run("deviceContact('org-1')");
check(()=>{const r=sent.slice(from).filter(x=>x.body.kind==='removal-receipt');assert.equal(r.length,1);assert.equal(r[0].key,kept[0].key,'resent with its key');assert.deepEqual(r[0].body,kept[0].body);assert.equal(run('book.receipts.length'),0);});
check(()=>assert.ok([...receipts.values()].every(b=>D.removalReceiptSchema.safeParse(b).success),'receipt bodies match the server schema'));
check(()=>assert.ok(![...receipts.values()].some(b=>JSON.stringify(b).includes('Synthetic')),'no names in receipts'));

// 5. Sync all ends with a contact for each organisation the notebook holds, and says what was removed.
orders=[{personId:'p-2',scope:'grant',reason:'processing-restricted',leaseIds:[L(2)],registration:false,since:new Date().toISOString(),confirmed:false}];from=calls.length;
await run('syncAll()');
check(()=>{const urls=calls.slice(from).map(c=>(c.options?.method??'GET')+' '+c.url+' '+(c.options?.headers?.['x-saha-organisation']??''));assert.ok(urls.includes('GET /api/field-device org-1'));assert.ok(urls.includes('GET /api/field-device org-2'));});
check(()=>{assert.deepEqual(val('book.drafts.map(d=>d.packet.payload.leaseId)'),[L(3)]);assert.match(byId('status').textContent,/Sync all: .* Removed from this device .*processing is restricted/);assert.doesNotMatch(byId('status').textContent,/Tell your supervisor/,'a synced copy discards nothing unsynced');});
// 6. A contact that fails does not stop anything and leaves the notebook unchanged.
network=async url=>{if(url==='/api/workspace')return ok(workspace);throw TypeError('Failed to fetch');};const snapshot=JSON.stringify(record);
const out=await run("deviceContact('org-1')");check(()=>{assert.deepEqual([out.drafts,out.registrations],[0,0]);assert.equal(JSON.stringify(record),snapshot);});
writeFileSync('tests/field-device-client-result.json',JSON.stringify({passed,completedAt:new Date().toISOString(),coverage:'Field notebook device contact (slice 14e) with real Web Crypto and injected storage and network: failure tally by step, class and grant with no names; the report sent on contact with its kept key and body, cleared on success, kept on 503, dropped on refusal, held for its own organisation; grant and person-wide removal orders removing drafts, sealed media and registration copies; receipts with counts, kept and resent with their key; Sync all contacting each organisation and reporting removals; bodies valid for the server schemas. Not covered: real IndexedDB, service worker or a real browser.'},null,2)+'\n');
console.log(`${passed} field device client checks passed`);
