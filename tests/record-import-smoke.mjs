import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
// Slice 2h: enrolment and identifier import through the built Worker and local D1: dry-run route authority and bounds,
// a neutral reason for unknown records, no labels or identifier values in responses, nothing stored by the dry run, the
// rejection report download (manifest, headers, export audit, no labels), a stale plan refused, apply of the exact plan
// with a revision per record and one counted audit event, an imported identifier matching its record, and replay
// rechecked after the importer's role changed.
export async function recordImportSmoke({get,post,check,accounts,org,sql,base}){
 const {owner:o,worker:w,clinician:c,supervisor:s,admin:a}=accounts;await get(o,'/api/workspace',200,org);
 const call=async(path,who,body,status=200,headers={})=>{const r=await fetch(`${base}${path}`,{method:'POST',headers:{...who.headers,'content-type':'application/json','x-saha-organisation':org,...headers},body:typeof body==='string'?body:JSON.stringify(body)});const text=await r.text();check(()=>assert.equal(r.status,status,text.slice(0,300)));return {r,text,json:r.headers.get('content-type')?.includes('json')?JSON.parse(text):null};};
 const dry=async(who,body,status=200,headers={})=>(await call('/api/record-import',who,body,status,headers)).json;
 const tag=crypto.randomUUID().slice(0,6),EH='person,pack,version,episode_label,start_date',IH='person,issuer,identifier';
 const open=p=>(p.enrolments??[]).filter(e=>e.state==='active').map(e=>e.packId);
 const people=o.state.people.filter(p=>p.teamId==='default'&&!p.mergedInto&&['tb','hypertension'].some(k=>!open(p).includes(k)));
 const A=people[0],B=people[1],packA=['tb','hypertension'].find(k=>!open(A).includes(k)),packB=['tb','hypertension'].find(k=>!open(B).includes(k));
 const efile=[EH,`${A.id},${packA},,Imported episode ${tag},`,`${B.id},${packB},1,Imported episode ${tag},2026-09-01`,`missing-${tag},tb,,Imported episode ${tag},`,`${A.id},${packA},,Imported again ${tag},`].join('\n');
 // Authority, format and size bounds.
 for(const who of [w,c,a])await dry(who,{kind:'enrolments',csv:efile},403);
 await dry(o,{kind:'enrolments',csv:efile},415,{'content-type':'text/plain'});
 await dry(o,{kind:'enrolments',csv:efile},403,{origin:'https://attacker.example'});
 await dry(o,{kind:'enrolments',csv:'x'.repeat(21000)},413);
 await dry(o,{kind:'visits',csv:efile},422);
 await dry(o,{kind:'identifiers',csv:efile},422);
 const versions=()=>sql.prepare('SELECT id,version FROM patients WHERE org_id=? AND id IN (?,?) ORDER BY id').all(org,A.id,B.id);const before=versions();
 let plan=await dry(o,{kind:'enrolments',csv:efile});
 check(()=>{assert.deepEqual(plan.counts,{rows:4,accepted:2,rejected:2});assert.equal(plan.rows[0].personId,A.id);assert.equal(plan.rows[2].personId,undefined);assert.deepEqual(plan.rows[2].reasons,['No record in the teams you may import into matches this person.']);assert.match(plan.rows[3].reasons[0],/Row 1 in this file already opens this pack/);});
 check(()=>{const text=JSON.stringify(plan);assert.equal(text.includes(tag),false,'no episode labels in the dry run');assert.equal(text.includes(A.name),false);assert.deepEqual(versions(),before,'the dry run stores nothing');});
 // The rejection report: a CSV export with a manifest, headers and an audit event, listing row numbers and reasons only.
 await call('/api/import-rejections',w,{kind:'enrolments',csv:efile},403);
 await call('/api/import-rejections',a,{kind:'people',csv:'name,age,sex,village,programme,team\nX,1,Female,V,General care,default'},403);
 // Slice 6aa (seventh review, finding 6): the report's audit event is an access-audit commit: the organisation revision
 // does not move (a concurrent save is not made to conflict) and no command receipt is written for it.
 const revBefore=sql.prepare('SELECT revision FROM organisations WHERE id=?').get(org).revision,receiptsBefore=sql.prepare('SELECT count(*) AS n FROM command_receipts WHERE org_id=?').get(org).n;
 const rep=await call('/api/import-rejections',o,{kind:'enrolments',csv:efile});
 check(()=>{assert.equal(sql.prepare('SELECT revision FROM organisations WHERE id=?').get(org).revision,revBefore,'the rejection report does not move the organisation revision');assert.equal(sql.prepare('SELECT count(*) AS n FROM command_receipts WHERE org_id=?').get(org).n,receiptsBefore,'no command receipt');});
 check(()=>{assert.match(rep.r.headers.get('content-type'),/text\/csv/);assert.match(rep.r.headers.get('content-disposition'),/attachment; filename="saha-import-rejections.csv"/);const lines=rep.text.split('\r\n');lines.pop();const body=lines.slice(0,-2).map(l=>l+'\r\n').join('');const sha=createHash('sha256').update(body).digest('hex');assert.equal(sha,rep.r.headers.get('x-saha-content-sha256'));assert.equal(lines.at(-1),`"Manifest","Content SHA-256","${sha}"`);assert.equal(lines.at(-2),`"Manifest","Data rows","${lines.length-2}"`);assert.ok(lines.includes('"Rows not accepted","2","2","Distinct row numbers listed above","yes"'));assert.ok(lines.some(l=>l.startsWith('"3","Rejected","No record in the teams')));});
 check(()=>{assert.equal(rep.text.includes(tag),false);assert.equal(rep.text.includes(A.id),false);const e=sql.prepare("SELECT detail FROM audit_events WHERE org_id=? AND action='importRejectionsExport'").all(org);assert.equal(e.length,1);assert.ok(e[0].detail.includes(rep.r.headers.get('x-saha-export-id')));assert.ok(e[0].detail.includes(rep.r.headers.get('x-saha-content-sha256')));assert.match(e[0].detail,/enrolments dry run .* 4 rows in file, 2 listed/);});
 // A change in the team's records after the dry run makes the plan stale.
 await post(o,{type:'createPerson',name:`Record Import Interleaved ${tag}`,age:44,sex:'Female',village:'Import locality five',programme:'General care',teamId:'default'});
 const stale={type:'recordImportApply',kind:'enrolments',csv:efile,planHash:plan.planHash,reason:'Synthetic enrolment import of a reviewed batch'};
 await post(o,stale,409);
 await post(c,stale,403);
 plan=await dry(o,{kind:'enrolments',csv:efile});
 const done=await post(o,{...stale,planHash:plan.planHash});
 check(()=>{const r=done.result;assert.deepEqual(r.counts,{rows:4,accepted:2,rejected:2,applied:2,records:2});assert.deepEqual(r.rows,[1,2]);assert.equal(JSON.stringify(r).includes(A.id),false,'no record ids in the result');const a1=o.state.people.find(p=>p.id===A.id).enrolments.find(e=>e.imported?.batchId===r.batchId);assert.equal(a1.packId,packA);assert.equal(a1.state,'active');assert.equal(a1.imported.row,1);});
 check(()=>{const n=sql.prepare("SELECT count(*) AS n FROM record_revisions WHERE org_id=? AND action='recordImportApply' AND entity_type='person' AND reason='Synthetic enrolment import of a reviewed batch'").get(org).n;assert.equal(n,2);const e=sql.prepare("SELECT detail FROM audit_events WHERE org_id=? AND action='recordImportApply'").all(org);assert.equal(e.length,1);assert.match(e[0].detail,/4 rows, 2 episodes opened \(official registration not submitted\) on 2 records, 2 rejected/);assert.equal(e[0].detail.includes(tag),false);});
 await post(o,{...stale,planHash:plan.planHash},409);
 // Identifiers: a supervisor imports; the same value twice in a file is refused; replay is rechecked.
 await get(s,'/api/workspace',200,org);
 const value=String(Date.now()).slice(-12).padStart(12,'7'),ifile=[IH,`${A.id},rch,${value}`,`${B.id},rch,${value}`,`${A.id},abha,12345678901234`].join('\n');
 const ip=await dry(s,{kind:'identifiers',csv:ifile});
 check(()=>{assert.deepEqual(ip.counts,{rows:3,accepted:1,rejected:2});assert.match(ip.rows[1].reasons[0],/Row 1 in this file already carries this identifier/);assert.match(ip.rows[2].reasons[0],/linked through ABHA verification/);assert.equal(JSON.stringify(ip).includes(value),false);});
 const key=crypto.randomUUID(),body={type:'recordImportApply',kind:'identifiers',csv:ifile,planHash:ip.planHash,reason:'Supervisor synthetic identifier import'};
 const first=await post(s,body,200,key);check(()=>{assert.equal(first.result.counts.applied,1);const ids=s.state.people.find(p=>p.id===A.id).identifiers;assert.deepEqual(ids.map(i=>[i.issuer,i.value,i.verified]),[['rch','XXXXXXXX'+value.slice(-4),false]],'masked in the snapshot');const stored=JSON.parse(sql.prepare('SELECT data FROM patients WHERE org_id=? AND id=?').get(org,A.id).data);assert.equal(stored.identifiers[0].value,value,'stored in full');});
 const hist=await get(o,`/api/history?personId=${A.id}`,200,org);check(()=>{const text=JSON.stringify(hist);assert.equal(text.includes(value),false,'masked in history');assert.ok(text.includes('XXXXXXXX'+value.slice(-4)));});
 sql.prepare("UPDATE memberships SET role='asha' WHERE org_id=? AND user_id=?").run(org,s.id);
 await post(s,body,403,key);
 sql.prepare("UPDATE memberships SET role='supervisor' WHERE org_id=? AND user_id=?").run(org,s.id);
 const again=await post(s,body,200,key);check(()=>{assert.equal(again.replayed,true);assert.equal(again.result.batchId,first.result.batchId);});
 // The imported identifier now finds its record; the same value on another record is refused.
 const later=await dry(o,{kind:'identifiers',csv:[IH,`${B.id},rch,${value}`].join('\n')});
 check(()=>{assert.match(later.rows[0].reasons[0],/already recorded on another record you can see/);assert.equal(later.rows[0].conflict.personId,A.id);});
 const byId=await dry(o,{kind:'enrolments',csv:[EH,`rch:${value},maternal,,Matched by identifier ${tag},`].join('\n')});
 check(()=>assert.equal(byId.rows[0].personId,A.id));
}
