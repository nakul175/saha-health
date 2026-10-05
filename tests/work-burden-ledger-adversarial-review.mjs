import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {startMiniflare} from './lib/miniflare.mjs';
import {identity,client} from './lib/worker.mjs';
const owner=identity('ledger-independent-owner'),worker=identity('ledger-independent-worker'),w=await startMiniflare({port:8987,name:'ledger-independent-review',bindings:{SAHA_ENVIRONMENT:'synthetic'}}),evidence='tests/evidence/work-ledger-independent-review';
try{const api=client(w.base),db=await w.mf.getD1Database('DB'),root=(await api.get(owner,'/api/workspace')).json,org=root.organisation.id;
const cmd=async(who,body)=>{const r=await api.command(who,body,org);assert.equal(r.status,200,r.text);return r.json;};
const post=async(who,body,status=200)=>{const r=await api.call(who,'/api/work-burden/support',{method:'POST',org,body:{expectedActorId:who.id,...body}});assert.equal(r.status,status,r.text);return r.json;};
const account=(await api.get(worker,'/api/workspace')).json.user.accountCode,invite=await cmd(owner,{type:'createInvite',accountCode:account,label:'Synthetic review worker',role:'clinician',teamIds:['default']});assert.equal((await api.command(worker,{type:'joinOrganisation',token:invite.result.token})).status,200);
const p=(await cmd(owner,{type:'createPerson',name:'Synthetic support review person',age:35,sex:'Other',village:'Synthetic review',programme:'General care',teamId:'default'})).result.personId,visit=(await cmd(owner,{type:'startVisit',personId:p})).result.visitId;
await cmd(owner,{type:'opsWorkBurden',version:0,enabled:true,reason:'Synthetic independent metadata review'});
const own=await post(worker,{type:'request',key:crypto.randomUUID(),visitId:visit,category:'capture'}),before=await api.get(worker,'/api/work-burden/support?visitId='+visit,org);assert.equal(before.status,200,before.text);assert.ok(before.json.rows.some(x=>x.requestId===own.requestId));
for(let i=0;i<51;i++)await post(owner,{type:'request',key:crypto.randomUUID(),visitId:visit,category:'capture'});
const after=await api.get(worker,'/api/work-burden/support?visitId='+visit,org),stored=await db.prepare('SELECT count(*) n FROM work_support_events WHERE org_id=? AND requester_id=?').bind(org,worker.id).first();assert.equal(after.status,200,after.text);assert.equal(stored.n,1);assert.equal(after.json.rows.length,0);assert.equal(after.json.overflow,true);
mkdirSync(evidence,{recursive:true});writeFileSync(evidence+'/support-visibility-before-limit.json',JSON.stringify({actualWorker:true,actualD1:true,observedDefect:true,baseline:'237497f6',beforeOwnVisible:before.json.rows.length,afterOwnVisible:after.json.rows.length,storedOwnRequestCount:stored.n,unrelatedNewerRequests:51,overflow:after.json.overflow,scope:'An original non-operator requester loses their own pending support item because unrelated rows are limited before requester/helper filtering. No clinical or ticket content recorded.'},null,2)+'\n');console.log('Actual own-support visibility defect reproduced');
}finally{await w.stop();}
