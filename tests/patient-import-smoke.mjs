import assert from 'node:assert/strict';
// Slice 2f: controlled patient import through the built Worker and local D1: the dry-run route (authority, size
// bounds, no names, nothing stored), a stale plan refused, apply of the exact plan with a revision per person and one
// counted audit event, a repeat refused, and replay rechecked after the importer's role changed.
export async function patientImportSmoke({get,post,check,accounts,org,sql,base}){
 const {owner:o,worker:w,clinician:c,supervisor:s,admin:a}=accounts;await get(o,'/api/workspace',200,org);
 const dry=async(who,body,status=200,headers={})=>{const r=await fetch(`${base}/api/patient-import`,{method:'POST',headers:{...who.headers,'content-type':'application/json','x-saha-organisation':org,...headers},body:typeof body==='string'?body:JSON.stringify(body)});const j=await r.json();check(()=>assert.equal(r.status,status,JSON.stringify(j).slice(0,300)));return j;};
 const tag=crypto.randomUUID().slice(0,6),header='name,age,sex,village,programme,team';
 const existing=o.state.people.find(p=>p.teamId==='default'&&!p.mergedInto);const teamName=o.state.teams.find(t=>t.id==='default').name;
 const file=[header,`Import Synthetic Alpha ${tag},29,Female,Import locality one,Maternal care,default`,`Import Synthetic Beta ${tag},52,Male,Import locality two,Chronic care,${teamName}`,`${existing.name},${existing.age},${existing.sex},${existing.village},General care,default`,`Import Bad Age ${tag},abc,Female,Import locality one,General care,default`].join('\n');
 // Authority, format and size bounds; nothing in the URL.
 for(const who of [w,c,a])await dry(who,{csv:file},403);
 await dry(o,{csv:file},415,{'content-type':'text/plain'});
 await dry(o,{csv:file},403,{origin:'https://attacker.example'});
 await dry(o,{csv:'x'.repeat(21000)},413);
 await dry(o,{csv:header+'\n'+'y'.repeat(16500)},422);
 await dry(o,{csv:'name,age\nA,1'},422);
 const before=sql.prepare('SELECT count(*) AS n FROM patients WHERE org_id=?').get(org).n;
 let plan=await dry(o,{csv:file});
 check(()=>{assert.deepEqual(plan.counts,{rows:4,accepted:2,rejected:1,duplicates:1});assert.equal(plan.rows[2].status,'duplicate');assert.ok(plan.rows[2].candidates.some(x=>x.personId===existing.id));assert.match(plan.rows[3].reasons[0],/Age must be a whole number/);assert.equal(plan.markedSynthetic,true);});
 check(()=>{const text=JSON.stringify(plan);for(const x of [`Alpha ${tag}`,`Beta ${tag}`,existing.name,'Import locality'])assert.equal(text.includes(x),false,x);assert.equal(sql.prepare('SELECT count(*) AS n FROM patients WHERE org_id=?').get(org).n,before,'dry run stores nothing');});
 // A supervisor in the team may run the same dry run.
 await get(s,'/api/workspace',200,org);const supPlan=await dry(s,{csv:file});check(()=>assert.equal(supPlan.counts.accepted,2));
 // A change in the team's records after the dry run makes the plan stale.
 await post(o,{type:'createPerson',name:`Import Interleaved ${tag}`,age:44,sex:'Female',village:'Import locality three',programme:'General care',teamId:'default'});
 const stale={type:'patientImportApply',csv:file,planHash:plan.planHash,reason:'Synthetic import of a reviewed batch'};
 await post(o,stale,409);
 await post(c,{...stale},403);
 plan=await dry(o,{csv:file});
 const done=await post(o,{...stale,planHash:plan.planHash});
 check(()=>{const r=done.result;assert.equal(r.counts.created,2);assert.deepEqual(r.created.map(x=>x.row),[1,2]);assert.equal(r.markedSynthetic,true);const made=o.state.people.filter(p=>p.imported?.batchId===r.batchId);assert.equal(made.length,2);assert.ok(made.every(p=>p.synthetic&&p.assignedTo===null&&p.identityReview.state==='local'));});
 check(()=>{const n=sql.prepare("SELECT count(*) AS n FROM record_revisions WHERE org_id=? AND action='patientImportApply' AND entity_type='person' AND reason='Synthetic import of a reviewed batch'").get(org).n;assert.equal(n,2);const e=sql.prepare("SELECT detail FROM audit_events WHERE org_id=? AND action='patientImportApply'").all(org);assert.equal(e.length,1);assert.match(e[0].detail,/4 rows, 2 people created and marked synthetic, 1 rejected, 1 possible duplicates left for review/);assert.equal(e[0].detail.includes(`Alpha ${tag}`),false);});
 await post(o,{...stale,planHash:plan.planHash},409);
 // Replay rechecks authority: a supervisor's import is not returned again after the role changes.
 const supFile=[header,`Import Supervisor Gamma ${tag},33,Female,Import locality four,General care,default`].join('\n');
 const sp=await dry(s,{csv:supFile}),key=crypto.randomUUID(),body={type:'patientImportApply',csv:supFile,planHash:sp.planHash,reason:'Supervisor synthetic import batch'};
 const first=await post(s,body,200,key);check(()=>assert.equal(first.result.counts.created,1));
 sql.prepare("UPDATE memberships SET role='asha' WHERE org_id=? AND user_id=?").run(org,s.id);
 await post(s,body,403,key);
 sql.prepare("UPDATE memberships SET role='supervisor' WHERE org_id=? AND user_id=?").run(org,s.id);
 const again=await post(s,body,200,key);check(()=>{assert.equal(again.replayed,true);assert.equal(again.result.batchId,first.result.batchId);});
}
