import assert from 'node:assert/strict';
import {coherentReportingFixture} from './lib/privacy-api-coherent-fixture.mjs';
// Slice 1e: time-limited delegation of team supervision and reporting-only access through the built Worker and local D1.
export async function delegationSmoke({get,post,check,accounts,org,sql,base}){
 const positive=await coherentReportingFixture({get,post,check},'delegated-report');
 const po=positive.accounts.owner,pc=positive.accounts.clinician,pt=positive.accounts.supervisor.state.people[0].teamId;
 await post(po,{type:'delegationGrant',kind:'reporting',delegateId:pc.id,teamIds:[pt],until:new Date(Date.now()+86400000).toISOString(),reason:'Explicit synthetic safe aggregate delegation'});
 const safe=await get(pc,'/api/operations?days=30',200,positive.org);
 check(()=>{assert.equal(safe.report.patients,10);assert.equal(safe.report.privacy.withheld,false);assert.equal(safe.operations,null);assert.equal(safe.telemetry,null);assert.deepEqual(safe.operators,[]);assert.equal(safe.budgets,null);});
 const {owner:o,worker:w,supervisor:s,admin:a,clinician:c,stranger:x}=accounts;
 const read=async(who,path,status=200)=>{const r=await fetch(base+path,{headers:{...who.headers,'x-saha-organisation':org}});const body=(r.headers.get('content-type')??'').includes('json')?await r.json():await r.text();check(()=>assert.equal(r.status,status,typeof body==='string'?body.slice(0,200):JSON.stringify(body)));return body;};
 const as=(who,body,status=200,key=crypto.randomUUID())=>post(who,body,status,key,org);
 await get(o,'/api/workspace',200,org);
 const tag=crypto.randomUUID().slice(0,6),north=o.state.teams.find(t=>t.name==='North team').id;
 const pid=(await post(o,{type:'createPerson',name:`Delegation Synthetic ${tag}`,age:47,sex:'Male',village:'Delegation locality',programme:'General care',teamId:'default'})).result.personId;
 const person=async()=>{await get(o,'/api/workspace',200,org);return o.state.people.find(p=>p.id===pid);};
 const assign=async(who,status,teamId='default')=>as(who,{type:'assignPatient',personId:pid,version:(await person()).version,teamId,assignedTo:teamId==='default'?w.id:null,reason:'Weekly home-visit assignment'},status);
 // Before any delegation: a clinician cannot assign patients or read reports.
 await get(c,'/api/workspace',200,org);check(()=>{assert.equal(c.state.canAssign,false);assert.deepEqual(c.state.delegatedAuthority,[]);});
 await assign(c,403);await read(c,'/api/operations',403);
 // Refusals: who may delegate, to whom, for how long and why.
 const until=new Date(Date.now()+7*86400000).toISOString();
 const grant=(over={})=>({type:'delegationGrant',kind:'team-supervision',delegateId:c.id,teamIds:['default'],until,reason:'Supervisor away at training this week',...over});
 await as(c,grant({delegateId:o.id}),403);await as(w,grant(),403);await as(a,grant(),403);await as(x,grant(),403);
 await as(s,grant({kind:'reporting'}),403);await as(s,grant({teamIds:[north]}),403);
 await as(s,grant({delegateId:w.id}),422);await as(s,grant({delegateId:o.id}),422);await as(s,grant({until:new Date(Date.now()+40*86400000).toISOString()}),422);await as(s,grant({until:new Date(Date.now()-60000).toISOString()}),422);await as(s,grant({reason:'short'}),422);
 await read(x,'/api/delegations',403);
 // Supervision delegated by the team supervisor.
 const key=crypto.randomUUID(),g=await as(s,grant(),200,key),again=await as(s,grant(),200,key);
 const id=g.result.delegationId;check(()=>{assert.ok(id);assert.equal(again.replayed,true);assert.equal(again.result.delegationId,id);});
 await as(s,grant(),409);
 let v=await read(c,'/api/delegations');check(()=>{const d=v.delegations.find(d=>d.id===id);assert.equal(d.state,'in force');assert.equal(d.kind,'team-supervision');assert.equal(d.canRevoke,true);assert.deepEqual(d.teams,[o.state.teams.find(t=>t.id==='default').name]);assert.equal(v.grantable.length,0);});
 v=await read(w,'/api/delegations');check(()=>{assert.equal(v.delegations.length,0);assert.equal(v.grantable.length,0);});
 v=await read(o,'/api/delegations');check(()=>{assert.ok(v.delegations.some(d=>d.id===id));assert.deepEqual(v.grantable.map(g=>g.kind),['team-supervision','reporting']);});
 await get(c,'/api/workspace',200,org);check(()=>{assert.equal(c.state.canAssign,true);assert.deepEqual(c.state.delegatedAuthority.map(d=>[d.id,d.kind]),[[id,'team-supervision']]);});
 await assign(c,200);await assign(c,403,north);
 check(()=>{const rows=sql.prepare("SELECT actor_id,subject,detail FROM audit_events WHERE org_id=? AND person_id=? AND action='delegatedAuthority'").all(org,pid);assert.equal(rows.length,1);assert.equal(rows[0].actor_id,c.id);assert.equal(rows[0].subject,id);assert.match(rows[0].detail,/^assignPatient carried out under team supervision delegated by /);});
 check(()=>assert.equal(sql.prepare("SELECT count(*) AS n FROM audit_events WHERE org_id=? AND subject=? AND action='delegationGrant'").get(org,id).n,1));
 // Revocation: not by an unrelated member; by the grantor it ends the authority at once.
 await as(w,{type:'delegationRevoke',delegationId:id,version:1,reason:'Worker attempts to revoke'},403);
 await as(s,{type:'delegationRevoke',delegationId:id,version:2,reason:'Stale version of the delegation'},409);
 await as(s,{type:'delegationRevoke',delegationId:id,version:1,reason:'Supervisor returned from training'});
 await as(s,{type:'delegationRevoke',delegationId:id,version:2,reason:'Revoking a second time'},409);
 await assign(c,403);await get(c,'/api/workspace',200,org);check(()=>{assert.equal(c.state.canAssign,false);assert.deepEqual(c.state.delegatedAuthority,[]);});
 // Reporting-only access delegated by an owner: aggregates for the team, nothing else.
 const rg=await as(o,grant({kind:'reporting',reason:'Programme review needs the team figures'}));const rid=rg.result.delegationId;
 await as(s,{type:'delegationRevoke',delegationId:rid,version:1,reason:'Supervisor did not grant this one'},403);
 const report=await read(c,'/api/operations?days=30');check(()=>{assert.equal(report.report.patients,null);assert.equal(report.report.privacy.withheld,true);assert.equal(report.operations,null);assert.equal(report.telemetry,null);assert.deepEqual(report.operators,[]);assert.equal(report.budgets,null);});
 await read(c,'/api/operations?format=support',403);await read(c,'/api/exceptions',403);await assign(c,403);
 const csv=await read(c,'/api/operations?format=csv&days=30');check(()=>assert.match(csv,/saha-operational-report/));
 check(()=>{const row=sql.prepare("SELECT detail FROM audit_events WHERE org_id=? AND actor_id=? AND action='opsExport' ORDER BY at DESC LIMIT 1").get(org,c.id);assert.match(row.detail,new RegExp(`reporting delegation ${rid}`));});
 await get(c,'/api/workspace',200,org);check(()=>assert.deepEqual(c.state.delegatedAuthority.map(d=>d.kind),['reporting']));
 // Expiry is enforced on the server: the end time is moved into the past in local D1 only.
 const row=sql.prepare('SELECT data FROM operations WHERE org_id=?').get(org),ops=JSON.parse(row.data);ops.delegations.find(d=>d.id===rid).until=new Date(Date.now()-1000).toISOString();sql.prepare('UPDATE operations SET data=? WHERE org_id=?').run(JSON.stringify(ops),org);
 await read(c,'/api/operations',403);
 v=await read(c,'/api/delegations');check(()=>{const d=v.delegations.find(d=>d.id===rid);assert.equal(d.state,'ended');assert.equal(d.canRevoke,false);});
 await as(o,{type:'delegationRevoke',delegationId:rid,version:1,reason:'Revoking an ended delegation'},409);
 await get(o,'/api/workspace',200,org);
}
