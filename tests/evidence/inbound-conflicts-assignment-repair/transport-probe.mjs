import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {startMiniflare} from '../../lib/miniflare.mjs';
const w=await startMiniflare({port:9023,name:'inbound-conflict-transport-review',bindings:{SAHA_ENVIRONMENT:'synthetic'}}),observations=[];
let passed=0,failed=0;
try{
 for(let round=0;round<64;round++)for(const path of ['/api/inbound-conflicts'])for(const kind of ['malformed','plain','cross-site','oversized','stream']){
  const cross=kind==='cross-site',stream=kind==='stream',size=kind==='oversized'||stream?10000:1;
  const headers={'Content-Type':kind==='plain'?'text/plain':'application/json',...(cross?{Origin:'https://synthetic.invalid','Sec-Fetch-Site':'cross-site'}:{})};
  const body=stream?new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('x'.repeat(size)));c.close()}}):'x'.repeat(size);
  try{const r=await fetch(w.base+path,{method:'POST',headers,body,...(stream?{duplex:'half'}:{})}),v=await r.json(),expected=cross?403:401;
   const ok=r.status===expected&&!JSON.stringify(v).includes('workflow')&&!JSON.stringify(v).includes('too large');if(ok)passed++;else failed++;
   observations.push({round,path,kind,bytes:size,status:r.status,expected,ok});
  }catch(e){failed++;observations.push({round,path,kind,bytes:size,error:String(e),cause:e.cause?.code});}
 }
 const db=await w.mf.getD1Database('DB'),counts={};
 for(const table of ['audit_events','command_receipts','work_burden_samples','work_support_events','request_metrics']){counts[table]=(await db.prepare('SELECT count(*) n FROM '+table).first()).n;assert.equal(counts[table],0);passed++;}
 const out=process.env.SAHA_TRANSPORT_PROBE_OUT??'tests/evidence/inbound-conflicts-assignment-repair/transport-after.json';
 writeFileSync(out,JSON.stringify({passed,failed,normalFetchNoRetry:true,actualWorker:true,actualD1:true,observations,counts},null,2)+'\n');console.log(JSON.stringify({passed,failed,counts}));
}finally{await w.stop();}
