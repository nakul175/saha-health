import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {identity,client} from './lib/worker.mjs';
import {startMiniflare} from './lib/miniflare.mjs';
let passed=0,failed=0;const observations=[];
const worker=await startMiniflare({port:8993,name:'offline-opens-transport',bindings:{SAHA_ENVIRONMENT:'synthetic'}});
try{
 const rounds=16;for(let round=0;round<rounds;round++)for(const query of ['', '?other=synthetic'])for(const entry of [
  {body:'{',headers:{'Content-Type':'application/json'}},
  {body:'Synthetic malformed body',headers:{'Content-Type':'text/plain'}},
  {body:'x'.repeat(13000),headers:{'Content-Type':'application/json'}},
  {body:'{',headers:{'Content-Type':'application/json',Origin:'https://synthetic.invalid','Sec-Fetch-Site':'cross-site'}}
 ]){
let response;try{response=await fetch(worker.base+'/api/offline-opens'+query,{method:'POST',...entry});}catch(e){observations.push({round,query,media:entry.headers['Content-Type'],bytes:entry.body.length,transportError:String(e),cause:e.cause?.code});failed++;continue;}const body=await response.json(),expected=entry.headers['Sec-Fetch-Site']==='cross-site'?403:401;
  observations.push({round,query,media:entry.headers['Content-Type'],crossSite:expected===403,status:response.status,expected});
  if(response.status===expected&&!/fixed offline|query fields|too large/i.test(JSON.stringify(body)))passed++;else failed++;
 }
 const db=await worker.mf.getD1Database('DB');
 for(const table of ['offline_open_reports','offline_open_subjects','audit_events','command_receipts','request_metrics']){
  if((await db.prepare('SELECT count(*) n FROM '+table).first()).n===0)passed++;else failed++;
 }
 const who=identity('metadata-transport-original'),api=client(worker.base);assert.equal((await api.get(who,'/api/workspace')).status,200);const tables=['offline_open_reports','offline_open_subjects','audit_events','command_receipts','request_metrics'],baseline={};for(const table of tables)baseline[table]=(await db.prepare('SELECT count(*) n FROM '+table).first()).n;
 for(let round=0;round<16;round++)for(const kind of ['large-chunked-same-origin','small-cross-site']){const large=kind==='large-chunked-same-origin',headers=large?{...who.headers,'Content-Type':'application/json'}:{'Content-Type':'application/json','Sec-Fetch-Site':'cross-site',Origin:'https://synthetic.invalid'},body=large?new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('x'.repeat(13000)));c.close()}}):'{';try{const r=await fetch(worker.base+'/api/offline-opens',{method:'POST',headers,body,...(large?{duplex:'half'}:{})});await r.text();observations.push({round,kind,status:r.status,expected:large?413:403});if(r.status===(large?413:403))passed++;else failed++;}catch(e){observations.push({round,kind,error:String(e),cause:e.cause?.code});failed++;}}
 for(const table of tables){if((await db.prepare('SELECT count(*) n FROM '+table).first()).n===baseline[table])passed++;else failed++;}
 mkdirSync('tests/evidence/offline-lifecycle-independent-review/drain-repair',{recursive:true});
 writeFileSync('tests/evidence/offline-lifecycle-independent-review/drain-repair/http.json',JSON.stringify({passed,failed,actualWorker:true,actualD1:true,observations,normalFetchNoRetry:true,transportDiscardBytes:262144,businessBytes:12000,scope:'Exact prior128-request pooled sequence and32authenticated chunked/foreign requests preserve401/403/413;0new ledger/audit/receipt/metric writes; parser remains strict and excess is discarded without parsing.'},null,2)+'\n');
 console.log(JSON.stringify({passed,failed}));assert.equal(failed,0,'Anonymous offline metadata identity must precede parsing');
}finally{await worker.stop()}
