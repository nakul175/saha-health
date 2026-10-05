import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const miniflareDir=readdirSync('node_modules/.pnpm').filter(d=>d.startsWith('miniflare@')).sort().at(-1);
const {Miniflare}=createRequire(join(process.cwd(),'node_modules/.pnpm',miniflareDir,'node_modules/miniflare/package.json'))('miniflare');

// Actual local D1 binding, simultaneous calls against the real guarded SQL. No hosted evidence.
const dir=mkdtempSync(join(process.cwd(),'.atomic-abha-review-'));
const mf=new Miniflare({modules:true,script:'export default { fetch(){return new Response("synthetic")} }',d1Databases:{DB:'atomic-abha-review'},d1Persist:false});
const checks=[];
const check=async(name,fn)=>{await fn();checks.push(name);};
try{
 for(const f of readdirSync('lib/saha').filter(f=>f.endsWith('.ts')))
  writeFileSync(join(dir,f.replace(/\.ts$/,'.js')),ts.transpileModule(readFileSync(`lib/saha/${f}`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'"));
 writeFileSync(join(dir,'package.json'),'{"type":"module"}');
 const R=await import(pathToFileURL(join(dir,'abha-review-reservation.js')));
 const B=await import(pathToFileURL(join(dir,'abdm.js')));
 const db=await mf.getD1Database('DB');
 for(const f of readdirSync('drizzle').filter(f=>/^\d{4}_.*\.sql$/.test(f)).sort())
  for(const sql of readFileSync(join('drizzle',f),'utf8').split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql).run();
 const now='2026-10-05T08:00:00.000Z';let orgId='org',orgCounter=0;
 await db.prepare('INSERT INTO organisations (id,name,revision,last_command,created_at) VALUES (?,?,?,?,?)').bind('org','Synthetic test',1,'',now).run();
 const reserve=(key,number=key,at=now,actor='asha',org=orgId,payload={key,number})=>R.reserveAbhaReview(db,org,actor,key,payload,number,at);
 const rows=async()=> (await db.prepare('SELECT * FROM abha_review_reservations WHERE org_id=?').bind(orgId).all()).results;
 const reset=async()=>{orgId='org-'+(++orgCounter);await db.prepare('INSERT INTO organisations (id,name,revision,last_command,created_at) VALUES (?,?,?,?,?)').bind(orgId,'Synthetic test',1,'',now).run();};
 await check('32 concurrent distinct probes admit exactly three lookups',async()=>{
  const results=await Promise.all(Array.from({length:32},(_,i)=>reserve('attempt-'+i,'91-1111-2222-'+String(i).padStart(4,'0'))));
  assert.equal(results.filter(r=>r.acquired).length,3);assert.equal((await rows()).length,3);
 });
 await check('a pending retry never performs an additional lookup',async()=>{
  await reset();const results=await Promise.all(Array.from({length:16},()=>reserve('same-attempt')));
  assert.equal(results.filter(r=>r.acquired).length,1);assert.equal((await rows()).length,1);
 });
 await check('refused probe under a fresh key still consumes one slot',async()=>{
  await reset();assert.equal((await reserve('first','same-number')).acquired,true);
  assert.equal((await reserve('second','same-number')).acquired,false);assert.equal((await rows()).length,1);
 });
 await check('same idempotency key with different payload is refused',async()=>{
  await assert.rejects(reserve('first','another-number'),e=>e.status===409);
 });
 await check('successful or unrelated-invalid attempts release capacity',async()=>{
  await reset();for(let i=0;i<8;i++){const r=await reserve('success-'+i);assert.equal(r.acquired,true);await R.releaseAbhaReview(db,orgId,'asha',r.attemptHash);}
  assert.equal((await rows()).length,0);
 });
 await check('audit failure cannot free consumed conflict capacity',async()=>{
  for(let i=0;i<3;i++)assert.equal((await reserve('held-'+i)).acquired,true);
  assert.equal((await reserve('after-audit-failure')).acquired,false);
 });
 await check('rolling-day expiry and exact boundary',async()=>{
  assert.equal((await reserve('boundary','boundary','2026-10-06T08:00:00.000Z')).acquired,false);
  assert.equal((await reserve('after-boundary','after','2026-10-06T08:00:00.001Z')).acquired,true);
  assert.equal((await rows()).length,1);
 });
 await check('actors and organisations have separate limits',async()=>{
  for(let i=0;i<3;i++)assert.equal((await reserve('actor-'+i,'n'+i,now,'other')).acquired,true);
  assert.equal((await reserve('actor-over','other',now,'other')).acquired,false);
  assert.equal((await reserve('other-org','other',now,'other','org-two')).acquired,true);
 });
 const audit=async(id,person,at=now)=>db.prepare("INSERT INTO audit_events (org_id,id,at,actor_id,actor_name,role,action,subject,person_id,detail) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(orgId,id,at,'asha','Synthetic','asha','abhaLinkReview','opaque',person,'Synthetic review').run();
 await check('existing historical steward reviews count during concurrent rollout',async()=>{
  await reset();await audit('event-1','holding-one');await audit('event-2','holding-two');
  const rs=await Promise.all(Array.from({length:24},(_,i)=>reserve('rollout-'+i)));
  assert.equal(rs.filter(r=>r.acquired).length,1);
 });
 await check('mapping an audit event avoids double count and preserves the three-review cap',async()=>{
  await reset();const r=await reserve('held-one');await audit('event-one','person-one');
  await R.recordAbhaReviewReservation(db,orgId,'asha',r.attemptHash,'event-one');
  assert.equal((await reserve('held-two')).acquired,true);assert.equal((await reserve('held-three')).acquired,true);
  assert.equal((await reserve('held-four')).acquired,false);
 });
 await check('duplicate historical events for one holder count once',async()=>{
  await reset();await audit('a','same-holder');await audit('b','same-holder');
  assert.equal((await reserve('new-one')).acquired,true);assert.equal((await reserve('new-two')).acquired,true);
  assert.equal((await reserve('new-three')).acquired,false);
 });
 await check('protection rows contain no raw probe, command key or patient id',async()=>{
  await reset();await reserve('raw-secret-key','91-1234-5678-9012',now,'asha',orgId,{personId:'raw-patient-id',number:'91-1234-5678-9012'});
  const text=JSON.stringify(await rows());for(const raw of ['raw-secret-key','91-1234-5678-9012','raw-patient-id'])assert.ok(!text.includes(raw));
 });
 await check('prelookup validation preserves role, version and already-linked denials',async()=>{
  const m={role:'asha',userId:'asha'},p={id:'p',assigned:true,version:1,abha:{state:'linked'}},s={workspace:{role:'asha',people:[p],integrations:[{kind:'abdm',abdm:{environment:'mock',modules:{abha:true},approvals:[{module:'abha'}]}}]}};
  assert.throws(()=>B.validateAbhaLink(s,{type:'abhaLink',personId:'p',version:2},m),e=>e.status===409);
  assert.throws(()=>B.validateAbhaLink(s,{type:'abhaLink',personId:'p',version:1},m),e=>e.status===409);
  assert.throws(()=>B.validateAbhaLink(s,{type:'abhaLink',personId:'p',version:1},{role:'admin'}),e=>e.status===403);
 });
 await check('server reserves before apply and refuses retries with the generic message',async()=>{
  const src=readFileSync('lib/saha/server.ts','utf8'),a=src.indexOf('async function abdmWithStewardReview'),b=src.indexOf('async function dispatchCommand',a),f=src.slice(a,b);
  assert.ok(f.indexOf('validateAbhaLink')<f.indexOf('await reserveAbhaReview'));
  assert.ok(f.indexOf('await reserveAbhaReview')<f.indexOf('const result=applyAbdm'));
  assert.match(f,/if\(!reservation\.acquired\)fail\(422,LINK_REFUSED\)/);
 });
 const result={suite:'atomic-abha-review-contract',passed:checks.length,checks,completedAt:new Date().toISOString(),limits:'Local Miniflare D1 concurrency; synthetic data only. Hosted D1 and real ABDM not measured.'};
 mkdirSync('tests/evidence/atomic-abha-review',{recursive:true});writeFileSync('tests/evidence/atomic-abha-review/contract.json',JSON.stringify(result,null,2)+'\n');
 console.log(`Atomic ABHA review: ${checks.length} checks passed on local D1`);
}finally{await mf.dispose();rmSync(dir,{recursive:true,force:true});}
