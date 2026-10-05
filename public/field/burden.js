// Optional metadata lives only inside the encrypted notebook. The caller owns
// its existing serial vault writer; this module never opens storage itself.
const CAPTURE=new Set(['capture-30s','capture-2m','capture-5m','capture-15m','capture-over15m']);
const LIMIT=200;
export function fieldBurdenClock(){let active=0,last=null,recent=-Infinity,foreground=false;return {
 input(now){recent=now;last??=now;},
 tick(now,visible){if(last!==null&&foreground&&visible&&now>=last)active+=Math.max(0,Math.min(now,recent+30000)-last);last=now;foreground=visible;},
 reset(){active=0;last=null;recent=-Infinity;foreground=false;},
 bucket(){return active<=0?null:active<=30000?'capture-30s':active<=120000?'capture-2m':active<=300000?'capture-5m':active<=900000?'capture-15m':'capture-over15m';}
};}
export function fieldBurdenOutbox({book,persist,current,eligible,fetcher=fetch,uuid=()=>crypto.randomUUID()}){
 const policies=new Map();let sending=null,serial=Promise.resolve();
 const same=()=>current()===book;
 const care=s=>s?.members?.some(m=>m.userId===book.userId&&m.status==='active'&&['asha','clinician'].includes(m.role));
 const valid=e=>e&&typeof e.organisationId==='string'&&e.organisationId.length>0&&e.organisationId.length<=200&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(e.key)&&(CAPTURE.has(e.code)||e.code==='client-sync-unknown')&&Object.keys(e).length===3;
 // Only a positively obtained, actor-bound current workspace can opt in. No
 // signed clinical packet/schema changes and no client-derived authority.
 function observe(snapshot){if(!same())return;const org=snapshot?.organisation?.id;if(typeof org!=='string')return;const p=snapshot.burdenMeasurement;policies.set(org,{enabled:snapshot.user?.userId===book.userId&&care(snapshot)&&p?.enabled===true,version:p?.version??0});}
 async function append(draft,code,unknownKey){
  if(!same()||!eligible(draft)||!policies.get(draft?.packet?.payload?.organisationId)?.enabled)return false;
  const organisationId=draft.packet.payload.organisationId;
  if(!CAPTURE.has(code)&&code!=='client-sync-unknown')return false;
  if(unknownKey&&draft.burdenUnknownKey===unknownKey)return false;
  const queue=book.burdenEvents??[];if(queue.length>=LIMIT)return false;
  const value={organisationId,key:uuid(),code};if(!valid(value))return false;
  book.burdenEvents=[...queue,value];if(unknownKey)draft.burdenUnknownKey=unknownKey;
  // Failure must propagate to the measurement caller; it must never claim an
  // encrypted enqueue. Clinical callers catch it independently of their save.
  await persist();return same();
 }
 function enqueue(draft,code,key){const task=serial.catch(()=>{}).then(()=>append(draft,code,key));serial=task;return task;}
 async function readPolicy(org){
  const r=await fetcher('/api/work-burden/policy',{headers:{'x-saha-organisation':org},cache:'no-store',redirect:'manual'});
  if(r.type==='opaqueredirect'||r.status>=300&&r.status<400||[401,403,404].includes(r.status))return {denied:true};
  if(!r.ok)throw new Error('Measurement policy unavailable.');const p=await r.json();
  if(p?.organisationId!==org||p?.userId!==book.userId||typeof p.enabled!=='boolean'||!Number.isInteger(p.version))return {denied:true};return p;
 }
 async function deliver(){
  await serial.catch(()=>{});if(!same()||!book.burdenEvents?.length)return {sent:0};let sent=0;
  // A failed earlier encrypted enqueue is never transmitted from memory alone.
  try{await persist();}catch{return {sent,pending:true};}if(!same())return {sent};
  // Bound every flush. New entries wait for the next explicit flush. Old grants
  // cannot start background sends, including when policy was once enabled.
  const pending=book.burdenEvents.slice(0,LIMIT);
  for(const event of pending){
   if(!same())break;if(!valid(event))return {sent,pending:true};
   const draft=book.drafts?.find(d=>d.packet?.payload?.organisationId===event.organisationId&&eligible(d));if(!draft)return {sent,pending:true};
   let p;try{p=await readPolicy(event.organisationId);}catch{return {sent,pending:true};}if(!same())break;
   if(p.denied)return {sent,denied:true};policies.set(event.organisationId,p);
   // Explicit opt-out discards metadata only. No measurement POST or clinical
   // mutation, and never write a notebook after actor/scope withdrawal.
   if(!p.enabled){book.burdenEvents=book.burdenEvents.filter(e=>e.organisationId!==event.organisationId);await persist();continue;}
   let r,value;try{r=await fetcher('/api/work-burden',{method:'POST',headers:{'Content-Type':'application/json','x-saha-organisation':event.organisationId},body:JSON.stringify({key:event.key,code:event.code}),cache:'no-store',redirect:'manual'});if(r.ok)value=await r.json();}catch{return {sent,pending:true};}
   if(!same())break;if(r.type==='opaqueredirect'||r.status>=300&&r.status<400||[401,403,404].includes(r.status))return {sent,denied:true};
   if(!r.ok||!(value?.recorded===true||value?.disabled===true))return {sent,pending:true};
   book.burdenEvents=book.burdenEvents.filter(e=>e.key!==event.key);await persist();sent++;
  }return {sent,pending:!!book.burdenEvents?.length};
 }
 return {observe,saved:(d,code)=>enqueue(d,code),unknown(d){const key=d?.pending?.key;return typeof key==='string'?enqueue(d,'client-sync-unknown',key):Promise.resolve(false);},flush(){if(!sending)sending=deliver().finally(()=>{sending=null;});return sending;}};
}
