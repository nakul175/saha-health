import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {startMiniflare} from './lib/miniflare.mjs';
let passed=0,failed=0;const observations=[];
const worker=await startMiniflare({port:8993,name:'offline-open-auth-first',bindings:{SAHA_ENVIRONMENT:'synthetic'}});
try{
 for(const query of ['', '?other=synthetic'])for(const entry of [
  {body:'{',headers:{'Content-Type':'application/json'}},
  {body:'Synthetic malformed body',headers:{'Content-Type':'text/plain'}},
  {body:'x'.repeat(13000),headers:{'Content-Type':'application/json'}},
  {body:'{',headers:{'Content-Type':'application/json',Origin:'https://synthetic.invalid','Sec-Fetch-Site':'cross-site'}}
 ]){
  const response=await fetch(worker.base+'/api/offline-opens'+query,{method:'POST',...entry}),body=await response.json(),expected=entry.headers['Sec-Fetch-Site']==='cross-site'?403:401;
  observations.push({query,media:entry.headers['Content-Type'],crossSite:expected===403,status:response.status,expected});
  if(response.status===expected&&!/fixed offline|query fields|too large/i.test(JSON.stringify(body)))passed++;else failed++;
 }
 const db=await worker.mf.getD1Database('DB');
 for(const table of ['offline_open_reports','offline_open_subjects','audit_events','command_receipts','request_metrics']){
  if((await db.prepare('SELECT count(*) n FROM '+table).first()).n===0)passed++;else failed++;
 }
 mkdirSync('tests/evidence/offline-open-auth-first',{recursive:true});
 writeFileSync('tests/evidence/offline-open-auth-first/http.json',JSON.stringify({passed,failed,actualWorker:true,actualD1:true,observations,scope:'Anonymous malformed/media/oversized/query POSTs refuse before local parsing without report/subject/audit/receipt/metric writes. Global cross-site middleware403 preserved.'},null,2)+'\n');
 console.log(JSON.stringify({passed,failed}));assert.equal(failed,0,'Anonymous offline metadata identity must precede parsing');
}finally{await worker.stop()}
