import assert from 'node:assert/strict';
// Slice 6c: retention schedules, holds and eligibility review through the built Worker and local D1.
export async function retentionSmoke({get,post,check,accounts,org,sql,base}){
 const {owner:o,worker:w,supervisor:s,admin:a}=accounts;
 const view=async(who,status=200)=>{const r=await fetch(`${base}/api/retention`,{headers:{...who.headers,'x-saha-organisation':org}});const j=await r.json();check(()=>assert.equal(r.status,status,JSON.stringify(j)));return j;};
 const counts=()=>['patients','visits','submissions','record_revisions'].map(t=>sql.prepare(`SELECT count(*) AS n FROM ${t} WHERE org_id=?`).get(org).n);
 await view(s,403);await view(w,403);await view(a,403);
 let v=await view(o);
 check(()=>{assert.equal(v.policy,null);assert.equal(v.review.length,6);assert.match(v.disposal,/never deletes/);});
 const rules=v.classes.map(c=>({recordClass:c.recordClass,years:7}));
 await post(s,{type:'retentionPolicySet',rules,basis:'Synthetic records policy for the test'},403);
 await post(o,{type:'retentionPolicySet',rules:[{recordClass:'audit-event',years:60}],basis:'Synthetic records policy for the test'},422);
 await post(o,{type:'retentionPolicySet',rules,basis:'short'},422);
 const set=await post(o,{type:'retentionPolicySet',rules,basis:'Synthetic records policy for the test'});
 check(()=>assert.ok(set.result.version>=1));
 // A dated synthetic audit event far in the past becomes eligible under a seven-year schedule.
 sql.prepare('INSERT INTO audit_events (org_id,id,person_id,actor_id,actor_name,role,action,subject,detail,at) VALUES (?,?,?,?,?,?,?,?,?,?)').run(org,`retention-old-${crypto.randomUUID()}`,null,o.id,'Owner','clinician','fixture',org,'Synthetic old event for retention review','2001-01-01T00:00:00.000Z');
 const before=counts();
 v=await view(o);const row=c=>v.review.find(r=>r.recordClass===c);
 check(()=>{assert.equal(v.policy.version,set.result.version);assert.ok(row('audit-event').pastSchedule>=1);assert.equal(row('audit-event').eligible,row('audit-event').pastSchedule);assert.equal(row('patient-record').eligible,row('patient-record').pastSchedule);});
 await get(o,'/api/workspace',200,org);const p=o.state.people[0];
 await post(a,{type:'retentionHoldPlace',scope:'organisation',reason:'Admin attempt at a hold',reference:'ADM-1'},403);
 await post(o,{type:'retentionHoldPlace',scope:'person',reason:'Missing patient reference',reference:'CASE-0'},422);
 const hold=await post(o,{type:'retentionHoldPlace',scope:'person',personId:p.id,reason:'Synthetic legal matter for this patient',reference:'CASE-1'});
 await post(o,{type:'retentionHoldPlace',scope:'person',personId:p.id,reason:'Second hold on the same patient',reference:'CASE-2'},409);
 const orgHold=await post(o,{type:'retentionHoldPlace',scope:'organisation',reason:'Synthetic regulator inquiry',reference:'REG-1'});
 v=await view(o);check(()=>{assert.ok(v.review.every(r=>r.eligible===0));assert.equal(v.holds.filter(h=>!h.released).length,2);assert.equal(v.holds.find(h=>h.id===hold.result.holdId).personName,p.name);});
 await post(s,{type:'retentionHoldRelease',holdId:orgHold.result.holdId,reason:'Supervisor release attempt'},403);
 await post(o,{type:'retentionHoldRelease',holdId:orgHold.result.holdId,reason:'Inquiry closed in synthetic test'});
 await post(o,{type:'retentionHoldRelease',holdId:orgHold.result.holdId,reason:'Inquiry closed in synthetic test'},409);
 v=await view(o);check(()=>assert.ok(row('audit-event').eligible>=1));
 check(()=>{const after=counts();assert.deepEqual(after.slice(0,3),before.slice(0,3),'no record was deleted');assert.ok(after[3]>=before[3]);});
 check(()=>assert.equal(sql.prepare("SELECT count(*) AS n FROM audit_events WHERE org_id=? AND action LIKE 'retention%'").get(org).n,4));
}
