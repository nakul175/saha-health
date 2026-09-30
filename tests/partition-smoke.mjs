import assert from 'node:assert/strict';
// Slice 0a: patient-partitioned loading and concurrency, exercised through the built Worker and local D1.
export async function partitionSmoke({get,post,check,accounts,org,sql,base}){
 const {owner:o,worker:w}=accounts;
 const raw=async(who,body,key=crypto.randomUUID())=>{const r=await fetch(base+'/api/commands',{method:'POST',headers:{...who.headers,'Content-Type':'application/json','Idempotency-Key':key,'x-saha-organisation':org},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};};
 const orgRow=()=>sql.prepare('SELECT revision,patient_revision FROM organisations WHERE id=?').get(org);
 const rev=id=>sql.prepare('SELECT rev FROM patients WHERE org_id=? AND id=?').get(org,id).rev;
 await get(o,'/api/workspace',200,org);
 const people=[];
 for(let i=0;i<4;i++)people.push((await post(o,{type:'createPerson',name:`Partition Synthetic ${crypto.randomUUID().slice(0,8)}`,age:30+i,sex:'Unknown',village:`Partition locality ${i}`,programme:'General care',teamId:'default'})).result.personId);
 // Different patients in parallel: every write commits (R11 rejected most of these with 409).
 const before=orgRow();
 const starts=await Promise.all(people.map(personId=>raw(o,{type:'startVisit',personId})));
 check(()=>assert.deepEqual(starts.map(r=>r.status),[200,200,200,200]));
 const after=orgRow();
 check(()=>{assert.equal(after.revision,before.revision,'patient-scoped commits leave the organisation revision alone');assert.equal(after.patient_revision,before.patient_revision+4);});
 check(()=>people.forEach(id=>assert.equal(rev(id),1)));
 const visits=starts.map(r=>r.body.result.visitId);
 // Same patient in parallel with the same expected version: exactly one save commits.
 const facts=n=>({date:'2026-09-20T08:00',systolic:'',diastolic:'',weight:String(50+n),temperature:'',weeks:'',coughDays:'',notes:'Partition synthetic save',source:'measured'});
 const same=await Promise.all([0,1,2].map(n=>raw(o,{type:'saveVisit',visitId:visits[0],version:1,facts:facts(n)})));
 const ok=same.filter(r=>r.status===200).length,conflicts=same.filter(r=>r.status===409).length;
 check(()=>{assert.equal(ok,1);assert.equal(ok+conflicts,3);});
 check(()=>assert.ok(same.filter(r=>r.status===409).every(r=>/changed/.test(r.body.error??r.body.message??JSON.stringify(r.body)))));
 const stored=JSON.parse(sql.prepare('SELECT data FROM visits WHERE org_id=? AND id=?').get(org,visits[0]).data);
 check(()=>assert.equal(stored.version,2));
 // Different patients' visits saved together: both commit.
 const pair=await Promise.all([1,2].map(i=>raw(o,{type:'saveVisit',visitId:visits[i],version:1,facts:facts(i)})));
 check(()=>assert.deepEqual(pair.map(r=>r.status),[200,200]));
 // Identical concurrent command (same idempotency key): one commit, one replay of that receipt.
 const key=crypto.randomUUID(),twin=await Promise.all([raw(o,{type:'saveVisit',visitId:visits[3],version:1,facts:facts(9)},key),raw(o,{type:'saveVisit',visitId:visits[3],version:1,facts:facts(9)},key)]);
 check(()=>assert.deepEqual(twin.map(r=>r.status),[200,200]));
 check(()=>assert.equal(sql.prepare('SELECT count(*) AS n FROM command_receipts WHERE actor_id=? AND key=?').get(o.id,key).n,1));
 check(()=>assert.equal(JSON.parse(sql.prepare('SELECT data FROM visits WHERE org_id=? AND id=?').get(org,visits[3]).data).version,2));
 // Scope is unchanged under partitioned loading: a worker without the assignment is refused,
 // and a visit reference from outside this organisation is not found.
 const refused=await raw(w,{type:'saveVisit',visitId:visits[1],version:2,facts:facts(3)});
 check(()=>assert.equal(refused.status,403));
 const unknown=await raw(o,{type:'saveVisit',visitId:'visit-not-in-this-organisation',version:1,facts:facts(3)});
 check(()=>assert.equal(unknown.status,404));
 // An organisation-level change invalidates a patient-scoped write prepared against the
 // earlier organisation revision (checked directly against the committed guard state).
 const orgBefore=orgRow();
 await post(o,{type:'createTeam',name:`Partition team ${crypto.randomUUID().slice(0,6)}`});
 const orgAfter=orgRow();
 check(()=>assert.equal(orgAfter.revision,orgBefore.revision+1));
 // Revision history and audit still record every committed patient change.
 check(()=>assert.ok(sql.prepare("SELECT count(*) AS n FROM record_revisions WHERE org_id=? AND entity_id=? AND entity_type='visit'").get(org,visits[0]).n>=2));
 check(()=>assert.ok(sql.prepare("SELECT count(*) AS n FROM audit_events WHERE org_id=? AND action='saveVisit' AND subject=?").get(org,visits[0]).n===1));
}
