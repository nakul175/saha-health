import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {startMiniflare} from './lib/miniflare.mjs';
import {identity,client} from './lib/worker.mjs';
const w=await startMiniflare({port:20931,name:'governed-report-export'});let passed=0;const check=(v,msg)=>{assert.ok(v,msg);passed++;};
try{
 const api=client(w.base),owner=identity('governed-export-owner'),reviewer=identity('governed-export-reviewer'),outsider=identity('governed-export-outsider'),home=(await api.get(owner,'/api/workspace')).json,other=(await api.get(reviewer,'/api/workspace')).json,org=home.organisation.id,reason='Independent exact reconciled export review for synthetic evidence';
 const cmd=async(who,body,status=200)=>{const r=await api.command(who,body,org);check(r.status===status,r.text);return r.json;};
 const invite=(await cmd(owner,{type:'createInvite',accountCode:other.user.accountCode,label:'Synthetic export reviewer',role:'supervisor',teamIds:['default']})).result;await cmd(reviewer,{type:'joinOrganisation',token:invite.token});
 const post=(who,body,status=200,key=crypto.randomUUID())=>api.call(who,'/api/report-exports',{method:'POST',org,headers:{'Idempotency-Key':key},body:{...body,expectedActorId:who.id}}).then(r=>{check(r.status===status,r.text);return r;});
 let list=await api.get(owner,'/api/report-exports',org);check(list.status===200&&list.json.records.length===0,'Authorised empty governed export history');
 const original={type:'prepare',days:30},key=crypto.randomUUID(),prepared=await post(owner,original,200,key);check(prepared.json.state==='prepared'&&prepared.json.rows>0,'Exact governed export prepared');
 const replay=await post(owner,original,200,key);check(replay.json.replayed&&replay.json.exportId===prepared.json.exportId,'Exact idempotent prepare replays saved outcome');
 const originalBody=JSON.stringify({...original,expectedActorId:owner.id}),originalHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(originalBody))),b=>b.toString(16).padStart(2,'0')).join(''),recovered=await api.call(owner,`/api/report-exports?receiptKey=${key}`,{org,headers:{'x-saha-original-body-sha256':originalHash}});check(recovered.status===200&&recovered.json.recovered&&recovered.json.result.exportId===prepared.json.exportId,'Read-only exact saved outcome recovery');
 let download=await api.get(owner,`/api/report-exports?id=${prepared.json.exportId}&days=30`,org);check(download.status===409,'Download blocked before independent review');
 await post(owner,{type:'review',exportId:prepared.json.exportId,decision:'approve',reason},403);
 const approved=await post(reviewer,{type:'review',exportId:prepared.json.exportId,decision:'approve',reason});check(approved.json.state==='approved'&&approved.json.expiresAt,'Different current reviewer approves exact package with expiry');
 download=await api.get(owner,`/api/report-exports?id=${prepared.json.exportId}&days=30`,org);check(download.status===200&&download.headers.get('x-saha-submission-state')==='not-submitted'&&download.text.includes('Manifest'),download.text.slice(0,200));
 const altered=await api.get(owner,`/api/report-exports?id=${prepared.json.exportId}&days=7`,org);check(altered.status===409&&/filters changed/i.test(altered.json.error),'Changed filter blocks old approved download');
 const denied=await api.get(outsider,`/api/report-exports?id=${prepared.json.exportId}&days=30`,org);check([403,404].includes(denied.status),'Unrelated identity cannot download');
 const created=await cmd(owner,{type:'createPerson',name:'Synthetic source change',age:40,sex:'Unknown',village:'Synthetic only',programme:'General care',teamId:'default'});check(!!created.result.personId,'Synthetic report source changed');
 const stale=await api.get(owner,`/api/report-exports?id=${prepared.json.exportId}&days=30`,org);check(stale.status===409&&/report changed/i.test(stale.json.error),'Changed report source blocks old approved download');
 list=await api.get(reviewer,'/api/report-exports',org);const item=list.json.records.find(x=>x.id===prepared.json.exportId);check(item.submissionState==='not-submitted'&&!('payload' in item),'History discloses metadata only and never fabricates submission');
 const result={passed,failed:0,exportId:prepared.json.exportId,scope:'Actual Worker/D1 prepare, replay, separate review, expiring protected download, filter/source race refusal, unauthorised refusal and not-submitted state.'};mkdirSync('tests/evidence/saha111-local-coding-completion',{recursive:true});writeFileSync('tests/evidence/saha111-local-coding-completion/http.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{await w.stop();}
