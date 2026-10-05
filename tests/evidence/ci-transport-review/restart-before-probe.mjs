import {startWorker,client,identity} from '../../lib/worker.mjs';
import {writeFileSync} from 'node:fs';
const vars={SAHA_ENVIRONMENT:'synthetic',SAHA_REMINDER_MOCK_CALLBACK_ENABLED:'true',SAHA_REMINDER_MOCK_CALLBACK_GRANTS:'[]'};
const w=await startWorker({port:9007,name:'restart-readiness-before',vars}),api=client(w.base),who=identity('restart-peer'),observations=[];
try{
 for(let round=0;round<12;round++){
  vars.SAHA_REMINDER_MOCK_CALLBACK_GRANTS=JSON.stringify([{organisationId:'synthetic-round-'+round,provider:'mock-reminder',secretBinding:'SYNTHETIC_UNUSED'}]);
  const begin=performance.now();await w.restart();const readyAt=performance.now();
  for(const kind of ['metadata','anonymous-post','foreign-post']){
   try{const r=kind==='metadata'?await api.get(who,'/api/workspace'):await api.call(null,'/api/reminder-optout',{method:'POST',body:{synthetic:true},headers:kind==='foreign-post'?{Origin:'https://untrusted.invalid'}:{}});
    observations.push({round,kind,status:r.status,readyMs:Math.round(readyAt-begin),elapsedFromReadyMs:Math.round(performance.now()-readyAt),expected:kind==='metadata'?200:kind==='anonymous-post'?401:403});
   }catch(e){observations.push({round,kind,error:String(e),cause:e.cause?.code});}
  }
 }
 writeFileSync('tests/evidence/ci-transport-review/restart-before.json',JSON.stringify({observations,normalFetchNoRetry:true},null,2)+'\n');
 writeFileSync('tests/evidence/ci-transport-review/restart-before-worker.log',w.output());
 console.log(JSON.stringify({passed:observations.filter(x=>x.status===x.expected).length,failed:observations.filter(x=>x.status!==x.expected).length}));
}finally{await w.stop();}
