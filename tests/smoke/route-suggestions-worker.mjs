import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readdirSync,rmSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {client,identity,startWorker} from '../lib/worker.mjs';

const state=resolve('.wrangler/route-suggestions-worker'),evidence='tests/evidence/saha-159-route-suggestions',checks=[];
const worker=await startWorker({port:'8994',name:'route-suggestions-worker',state,vars:{SAHA_ENVIRONMENT:'synthetic'}}),api=client(worker.base),owner=identity('owner'),asha=identity('asha');
let db;
const check=async(label,fn)=>{await fn();checks.push(label);};
const ok=r=>{assert.equal(r.status,200,r.text);return r.json;};
try{
 const home=ok(await api.get(owner,'/api/workspace')),org=home.organisation.id,ashaHome=ok(await api.get(asha,'/api/workspace'));
 const invite=ok(await api.command(owner,{type:'createInvite',accountCode:ashaHome.user.accountCode,label:'Synthetic route worker',role:'asha',teamIds:['default']},org));
 ok(await api.command(asha,{type:'joinOrganisation',token:invite.result.token}));
 const personId=ok(await api.command(asha,{type:'createPerson',name:'Synthetic assigned route person',age:30,sex:'Female',village:'Synthetic locality',programme:'General care',teamId:'default'},org)).result.personId;
 const path='/api/route-suggestions',command=(body,key=crypto.randomUUID())=>api.call(asha,'/api/commands',{method:'POST',body,org,headers:{'Idempotency-Key':key}});
 await check('actual ASHA read returns only assigned local work and disabled provider boundaries',async()=>{const view=ok(await api.get(asha,path,org));assert.equal(view.work.length,1);assert.equal(view.work[0].personId,personId);assert.deepEqual([view.capability.externalMappingProvider,view.capability.navigation,view.capability.continuousTracking],['disabled',false,false]);});
 const create={type:'routeSuggestionCreate',personIds:[personId]},createKey=crypto.randomUUID(),accepted=ok(await command(create,createKey));
 await check('actual command persists one suggestion without assignment completion or provider side effects',async()=>{assert.deepEqual({assignmentChanged:accepted.result.assignmentChanged,completionChanged:accepted.result.completionChanged,externalProviderCalled:accepted.result.externalProviderCalled},{assignmentChanged:false,completionChanged:false,externalProviderCalled:false});const view=ok(await api.get(asha,path,org));assert.equal(view.suggestions.length,1);assert.equal(view.suggestions[0].tasks[0].personId,personId);});
 await check('exact command replay returns the durable result without duplicate mutation or audit',async()=>{const replay=ok(await command(create,createKey));assert.equal(replay.replayed,true);assert.deepEqual(replay.result,accepted.result);const view=ok(await api.get(asha,path,org));assert.equal(view.suggestions.length,1);});
 await worker.restart();
 await check('suggestion remains readable after Worker restart on the same D1 state',async()=>{const view=ok(await api.get(asha,path,org));assert.equal(view.suggestions[0].id,accepted.result.suggestionId);});
 const dir=join(state,'v3/d1/miniflare-D1DatabaseObject');db=new DatabaseSync(join(dir,readdirSync(dir).find(x=>x.endsWith('.sqlite')&&!x.includes('metadata'))));db.exec('PRAGMA busy_timeout=5000');
 await check('create mutation and access reads are durably audited once',async()=>{assert.equal(db.prepare("SELECT count(*) AS n FROM audit_events WHERE org_id=? AND action='routeSuggestionCreate'").get(org).n,1);assert.ok(db.prepare("SELECT count(*) AS n FROM audit_events WHERE org_id=? AND action='listPatients'").get(org).n>=1);});
 await check('post-audit assignment withdrawal recomputes current scope and reveals only an unavailable placeholder',async()=>{db.exec(`CREATE TRIGGER route_suggestion_scope_race AFTER INSERT ON audit_events WHEN NEW.action='listPatients' BEGIN UPDATE patients SET assigned_to='withdrawn-worker' WHERE org_id=NEW.org_id AND id='${personId}'; END;`);try{const response=await api.get(asha,path,org),body=ok(response),serialized=JSON.stringify(body);assert.equal(body.work.some(x=>x.personId===personId),false);assert.equal(body.suggestions[0].available,false);assert.deepEqual(Object.keys(body.suggestions[0].tasks[0]).sort(),['availability','position','reason']);assert.equal(serialized.includes('Synthetic assigned route person'),false);assert.equal(serialized.includes('Synthetic locality'),false);}finally{db.exec('DROP TRIGGER route_suggestion_scope_race');db.prepare('UPDATE patients SET assigned_to=? WHERE org_id=? AND id=?').run(asha.id,org,personId);}});
 const reorder={type:'routeSuggestionReorder',suggestionId:accepted.result.suggestionId,expectedVersion:1,personIds:[personId]},reorderKey=crypto.randomUUID();
 await check('actual current-version reorder succeeds and stale version is refused',async()=>{const changed=ok(await command(reorder,reorderKey));assert.equal(changed.result.version,2);assert.equal((await command(reorder)).status,409);});
 await check('changed membership authority refuses replay of a formerly accepted mutation',async()=>{db.prepare('UPDATE memberships SET version=version+1 WHERE org_id=? AND user_id=?').run(org,asha.id);assert.equal((await command(reorder,reorderKey)).status,409);});
 mkdirSync(evidence,{recursive:true});writeFileSync(join(evidence,'worker-d1-result.json'),JSON.stringify({story:'SAHA-159',passed:checks.length,failed:0,checks,completedAt:new Date().toISOString(),scope:'Actual built local Worker and D1: ASHA-only read, command persistence, access and mutation audit, exact replay, restart durability, post-audit assignment withdrawal, stale version and current-authority replay refusal. Synthetic only; independent review, CI, formal domain acceptance, merge and deployment remain separate.'},null,2)+'\n');
 console.log(JSON.stringify({story:'SAHA-159',passed:checks.length,failed:0}));
}finally{db?.close();await worker.stop();rmSync(state,{recursive:true,force:true});}
