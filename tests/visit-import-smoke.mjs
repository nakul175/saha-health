import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readTar } from '../scripts/verify-export.mjs';
// Slice 10i: historical visit import through the built Worker and local D1 (kind `visits` of the slice 2h record import): the dry-run
// route refuses non-owner and non-clinician importers (ASHA, supervisor, administrator), cross-origin, non-JSON and oversize
// bodies and a file with the wrong columns or too many rows; the plan lists accepted rows and rejected rows with neutral reasons
// (unknown or out-of-scope person, unsupported unit, unusual value without a reason, value beyond the confirmation range, duplicate,
// future date), carries the SHA-256 of the file and never returns names, notes, source systems or clinical values; the dry run
// stores nothing; the rejection report is a manifest-bound CSV with an access-audit event; a plan for another file or one made
// stale by a second import is refused; apply creates confirmed visits marked IMPORTED with lineage, one revision per visit
// carrying the reason, one counted audit event, no person change and no enrolment, submission or referral; the result carries
// no ids; replay is rechecked after the importer's role changed; imported visits are read-only history (plans, referrals,
// amendments, sign-off, protocol checks, assistant runs and FHIR download are refused) while marking one wrong-patient still works.
const COLUMNS=['person','visit_date','source_system','systolic','diastolic','bp_unit','bp_source','weight','weight_unit','weight_source','temperature','temperature_unit','temperature_source','gestation','gestation_unit','gestation_source','cough_duration','cough_unit','cough_source','override_reason','notes'];
export async function visitImportSmoke({get,post,check,accounts,org,sql,base}){
 const {owner:o,worker:w,clinician:c,supervisor:s,admin:a}=accounts;
 for(const who of [o,w,c,s,a])await get(who,'/api/workspace',200,org);
 const call=async(path,who,body,status=200,headers={})=>{const r=await fetch(`${base}${path}`,{method:'POST',headers:{...who.headers,'content-type':'application/json','x-saha-organisation':org,...headers},body:typeof body==='string'?body:JSON.stringify(body)});const text=await r.text();check(()=>assert.equal(r.status,status,text.slice(0,300)));return {r,text,json:r.headers.get('content-type')?.includes('json')?JSON.parse(text):null};};
 const dry=async(who,body,status=200,headers={})=>(await call('/api/record-import',who,body,status,headers)).json;
 const sha=x=>createHash('sha256').update(x,'utf8').digest('hex');
 const tag=crypto.randomUUID().slice(0,6),SYS=`Legacy HMIS ${tag}`,REASON='Synthetic historical visit import of a reviewed batch',UNUSUAL='Source record states this value in clinic';
 const quote=x=>/[",\n\r]/.test(x)?`"${x.replace(/"/g,'""')}"`:x,line=r=>COLUMNS.map(k=>quote(r[k]??'')).join(','),file=rows=>[COLUMNS.join(','),...rows.map(line)].join('\n');
 const row=(p,over={})=>({person:p.id,visit_date:'2026-08-01',source_system:SYS,weight:'70',weight_unit:'kg',weight_source:'measured',...over});
 const n=(table,extra='')=>sql.prepare(`SELECT count(*) AS n FROM ${table} WHERE org_id=?${extra}`).get(org).n;
 // People: two in the default team who are in the clinician's scope, and one in another team the clinician cannot reach.
 const people=o.state.people.filter(p=>p.teamId==='default'&&!p.mergedInto&&!(p.restrictions??[]).length&&p.identityReview?.state!=='provisional'&&c.state.people.some(x=>x.id===p.id));
 const A=people[0],B=people[1];
 // A second clinician who belongs to the default team only, and a person in the North team: out of that clinician's scope. (Earlier
 // suites add the shared clinician to the North team, and a paged snapshot does not list every person, so neither is used here.)
 const D={id:`r1-visit-import-${tag}`,headers:{'oai-authenticated-user-id':`r1-visit-import-${tag}`,'oai-authenticated-user-email':`visit-import-${tag}@example.invalid`,'oai-authenticated-user-full-name':'Visit%20Import%20Clinician','oai-authenticated-user-full-name-encoding':'percent-encoded-utf-8'},state:null};
 await get(D);const invite=await post(o,{type:'createInvite',accountCode:D.state.user.accountCode,label:'Visit import clinician',role:'clinician',teamIds:['default']});await post(D,{type:'joinOrganisation',token:invite.result.token});
 const north=o.state.teams.find(t=>t.name==='North team').id,madeN=await post(o,{type:'createPerson',name:`Visit Import North ${tag}`,age:41,sex:'Female',village:'Import locality six',programme:'General care',teamId:north});
 const N={id:madeN.result.personId};
 check(()=>{assert.ok(A&&B&&N.id,'two in-scope people and one person in the North team');assert.deepEqual(D.state.membership.teamIds,['default']);assert.equal(D.state.membership.role,'clinician');});
 const F=file([
  /* 1 */ row(A,{systolic:'120',diastolic:'80',bp_unit:'mmHg',bp_source:'measured',weight:'154',weight_unit:'lb',weight_source:'reported',notes:`Synthetic historical note ${tag}`}),
  /* 2 */ row(B,{visit_date:'2026-08-02T09:30',weight:'',weight_unit:'',weight_source:'',temperature:'98.6',temperature_unit:'degF',temperature_source:'measured'}),
  /* 3 */ row({id:`missing-${tag}`}),
  /* 4 */ row(A,{visit_date:'2026-08-03',weight_unit:'stone'}),
  /* 5 */ row(A,{visit_date:'2026-08-04',weight:'200'}),
  /* 6 */ row(A,{visit_date:'2026-08-05',weight:'400',override_reason:UNUSUAL}),
  /* 7 */ row(A,{visit_date:'2026-08-06',weight:'200',override_reason:UNUSUAL}),
  /* 8 */ row(A,{visit_date:'2026-08-01'}),
  /* 9 */ row(A,{visit_date:'2999-01-01'})]);
 // Authority, format and size bounds. Only an owner or a clinician imports visits; owner authority does not widen patient scope.
 for(const who of [w,a,s])await dry(who,{kind:'visits',csv:F},403);
 await dry(o,{kind:'visits',csv:F},415,{'content-type':'text/plain'});
 await dry(o,{kind:'visits',csv:F},403,{origin:'https://attacker.example'});
 await dry(o,{kind:'visits',csv:'x'.repeat(21000)},413);
 await dry(o,{kind:'enrolments',csv:F},422);
 await dry(o,{kind:'visits',csv:'person,visit_date\nx,2026-08-01'},422);
 await dry(o,{kind:'visits',csv:file(Array.from({length:101},()=>({person:A.id,visit_date:'2026-08-01',source_system:'S1',notes:'n'})))},422);
 // The dry run: rows to create, rows rejected with reasons, the file digest and a plan hash; nothing stored; no values returned.
 const before={visits:n('visits'),audit:n('audit_events'),receipts:n('command_receipts'),revisions:n('record_revisions'),revision:sql.prepare('SELECT revision FROM organisations WHERE id=?').get(org).revision,people:sql.prepare('SELECT id,version,data FROM patients WHERE org_id=? AND id IN (?,?) ORDER BY id').all(org,A.id,B.id),submissions:c.state.submissions.length,referrals:c.state.referrals.length};
 const plan=await dry(o,{kind:'visits',csv:F});
 check(()=>{assert.deepEqual(plan.counts,{rows:9,accepted:3,rejected:6});assert.deepEqual(plan.rows.map(r=>r.status),['accepted','accepted','rejected','rejected','rejected','rejected','accepted','rejected','rejected']);assert.equal(plan.fileDigest,sha(F));assert.match(plan.planHash,/^[0-9a-f]{64}$/);assert.equal(plan.rows[0].personId,A.id);assert.equal(plan.rows[2].personId,undefined);});
 check(()=>{assert.deepEqual(plan.rows[2].reasons,['No record in the teams you may import into matches this person.']);assert.match(plan.rows[3].reasons[0],/unit is not supported/);assert.match(plan.rows[4].reasons[0],/outside the expected range.*no override_reason/);assert.match(plan.rows[5].reasons[0],/beyond the confirmation range/);assert.match(plan.rows[7].reasons[0],/Row 1 in this file already imports a visit for this record, source system and date/);assert.match(plan.rows[8].reasons[0],/cannot be in the future/);});
 check(()=>{const text=JSON.stringify(plan);for(const x of [tag,A.name,B.name,'Synthetic historical note','Legacy HMIS'])assert.equal(text.includes(x),false,`the dry run does not return ${x}`);assert.equal(plan.accepted,undefined,'the parsed rows stay on the server');});
 check(()=>{assert.equal(n('visits'),before.visits,'the dry run stores no visit');assert.equal(n('audit_events'),before.audit,'no audit event');assert.equal(n('command_receipts'),before.receipts);assert.equal(n('record_revisions'),before.revisions);});
 // Care scope is the importer's own: a clinician of the default team only gets the same neutral reason for an unknown and an out-of-scope person.
 const outside=await dry(D,{kind:'visits',csv:file([row(N)])});
 check(()=>{assert.deepEqual(outside.rows[0].reasons,plan.rows[2].reasons);assert.equal(outside.rows[0].personId,undefined);assert.deepEqual(outside.counts,{rows:1,accepted:0,rejected:1});});
 // The rejection report: a CSV export with a manifest, headers and an access-audit event, row numbers and reasons only.
 for(const who of [w,a,s])await call('/api/import-rejections',who,{kind:'visits',csv:F},403);
 const receiptsBefore=n('command_receipts');
 const rep=await call('/api/import-rejections',o,{kind:'visits',csv:F});
 check(()=>{assert.equal(sql.prepare('SELECT revision FROM organisations WHERE id=?').get(org).revision,before.revision,'the report does not move the organisation revision');assert.equal(n('command_receipts'),receiptsBefore,'no command receipt');});
 check(()=>{assert.match(rep.r.headers.get('content-type'),/text\/csv/);const lines=rep.text.split('\r\n');lines.pop();const body=lines.slice(0,-2).map(l=>l+'\r\n').join(''),digest=sha(body);assert.equal(digest,rep.r.headers.get('x-saha-content-sha256'));assert.equal(lines.at(-1),`"Manifest","Content SHA-256","${digest}"`);assert.ok(lines.includes('"Rows not accepted","6","6","Distinct row numbers listed above","yes"'));assert.ok(lines.some(l=>l.startsWith('"3","Rejected","No record in the teams')));});
 check(()=>{assert.equal(rep.text.includes(tag),false);assert.equal(rep.text.includes(A.id),false);const e=sql.prepare("SELECT detail FROM audit_events WHERE org_id=? AND action='importRejectionsExport' AND detail LIKE '%visits dry run%'").all(org);assert.equal(e.length,1);assert.ok(e[0].detail.includes(rep.r.headers.get('x-saha-export-id')));assert.match(e[0].detail,/visits dry run .* 9 rows in file, 6 listed/);});
 // Apply is refused for the same importers, for a plan made for another file, and for a reason that is too short.
 const apply=(csv,planHash,reason=REASON)=>({type:'recordImportApply',kind:'visits',csv,planHash,reason});
 for(const who of [w,a,s])await post(who,apply(F,plan.planHash),403);
 await post(o,apply(F+'\n',plan.planHash),409);
 await post(o,apply(F,plan.planHash,'short'),422);
 check(()=>assert.equal(n('visits'),before.visits,'refused applies create nothing'));
 // A clinician imports a second file that overlaps row 2 of the first: the first plan is then stale (its row is now a duplicate).
 const G=file([row(B,{visit_date:'2026-08-02T09:30',source_system:SYS.toUpperCase(),weight:'61'}),row(B,{visit_date:'2026-08-09',weight:'61.5',notes:`Second synthetic note ${tag}`})]);
 const gplan=await dry(c,{kind:'visits',csv:G});check(()=>{assert.deepEqual(gplan.counts,{rows:2,accepted:2,rejected:0});assert.equal(gplan.fileDigest,sha(G));});
 const gkey=crypto.randomUUID(),gbody=apply(G,gplan.planHash,'Clinician synthetic import of a second batch'),gdone=await post(c,gbody,200,gkey);
 const gbatch=gdone.result.batchId;
 check(()=>{const r=gdone.result;assert.deepEqual(r.counts,{rows:2,accepted:2,rejected:0,applied:2,records:1});assert.deepEqual(r.rows,[1,2]);assert.equal(r.kind,'visits');const text=JSON.stringify(r);assert.equal(text.includes(B.id),false,'no record ids in the result');assert.equal(text.includes(tag),false);});
 check(()=>{const stored=sql.prepare("SELECT id,state,data FROM visits WHERE org_id=? AND json_extract(data,'$.imported.batchId')=? ORDER BY json_extract(data,'$.imported.row')").all(org,gbatch);assert.equal(stored.length,2);const d=stored.map(r=>JSON.parse(r.data));assert.deepEqual(stored.map(r=>r.state),['confirmed','confirmed']);assert.deepEqual(d.map(x=>x.imported.row),[1,2]);assert.ok(d.every(x=>x.imported.by===c.id&&x.imported.role==='clinician'&&x.imported.fileDigest===sha(G)&&x.imported.planHash===gplan.planHash&&x.imported.sourceSystem.toLowerCase()===SYS.toLowerCase()&&x.personId===B.id&&x.state==='confirmed'&&!x.confirmedBy&&!x.signedOff&&!(x.aiResults??[]).length&&!x.plan));assert.equal(d[0].facts.weight,'61');assert.equal(d[0].facts.date,'2026-08-02T09:30');assert.equal(d[1].facts.notes,`Second synthetic note ${tag}`);});
 check(()=>{const revs=sql.prepare("SELECT entity_type,count(*) AS n FROM record_revisions WHERE org_id=? AND action='recordImportApply' AND reason=? GROUP BY entity_type").all(org,'Clinician synthetic import of a second batch');assert.deepEqual(revs.map(r=>[r.entity_type,r.n]),[['visit',2]],'one revision per visit with the reason, none for the person');const e=sql.prepare("SELECT detail FROM audit_events WHERE org_id=? AND action='recordImportApply' AND detail LIKE ?").all(org,`%${gbatch}%`);assert.equal(e.length,1);assert.match(e[0].detail,/\(visits\) batch .* 2 visits created as confirmed IMPORTED records on 1 record \(no clinician sign-off implied; no enrolment, submission, referral or plan created\), 0 rejected/);assert.equal(e[0].detail.includes(tag),false);});
 check(()=>{assert.deepEqual(sql.prepare('SELECT id,version,data FROM patients WHERE org_id=? AND id IN (?,?) ORDER BY id').all(org,A.id,B.id),before.people,'persons unchanged: no version, programme, enrolment, assignment or status');assert.equal(c.state.submissions.length,before.submissions,'no submission');assert.equal(c.state.referrals.length,before.referrals,'no referral');});
 // Replay is rechecked: the importer's role is changed, the same key is refused, then it replays the stored result.
 sql.prepare("UPDATE memberships SET role='asha' WHERE org_id=? AND user_id=?").run(org,c.id);
 await post(c,gbody,403,gkey);
 sql.prepare("UPDATE memberships SET role='clinician' WHERE org_id=? AND user_id=?").run(org,c.id);
 const replay=await post(c,gbody,200,gkey);check(()=>{assert.equal(replay.replayed,true);assert.equal(replay.result.batchId,gbatch);assert.equal(n('visits'),before.visits+2,'a replay creates nothing');});
 // The first plan is stale: row 2 is now a duplicate of an imported visit. A fresh dry run says so and names the existing visit.
 await post(o,apply(F,plan.planHash),409);
 const plan2=await dry(o,{kind:'visits',csv:F});
 const bImported=sql.prepare("SELECT id,json_extract(data,'$.imported.row') AS row FROM visits WHERE org_id=? AND json_extract(data,'$.imported.batchId')=?").all(org,gbatch);
 check(()=>{assert.deepEqual(plan2.counts,{rows:9,accepted:2,rejected:7});assert.notEqual(plan2.planHash,plan.planHash);assert.match(plan2.rows[1].reasons[0],/A visit imported from this source system on this date already exists for this record/);assert.equal(plan2.rows[1].duplicateOf.visitId,bImported.find(v=>v.row===1).id);assert.equal(bImported.length,2);});
 const done=await post(o,apply(F,plan2.planHash));
 check(()=>{const r=done.result;assert.deepEqual(r.counts,{rows:9,accepted:2,rejected:7,applied:2,records:1});assert.deepEqual(r.rows,[1,7]);assert.equal(JSON.stringify(r).includes(A.id),false);});
 await post(o,apply(F,plan2.planHash),409);
 const mine=sql.prepare("SELECT id,data FROM visits WHERE org_id=? AND json_extract(data,'$.imported.batchId')=?").all(org,done.result.batchId).map(r=>({...JSON.parse(r.data),id:r.id})).sort((x,y)=>x.imported.row-y.imported.row);
 check(()=>{assert.equal(mine.length,2);const [v1,v7]=mine;assert.equal(v1.state,'confirmed');assert.equal(v1.imported.by,o.id);assert.equal(v1.imported.fileDigest,sha(F));assert.equal(v1.imported.sourceSystem,SYS);assert.equal(v1.facts.weight,'69.85','154 lb is stored in kg and the entered value is kept');assert.deepEqual(v1.facts.entered.weight,{value:'154',unit:'lb'});assert.equal(v1.facts.provenance.weight.source,'reported');assert.equal(v1.facts.provenance.bloodPressure.source,'measured');assert.equal(v1.facts.systolic,'120');assert.equal(v7.facts.weight,'200');assert.equal(v7.facts.unusual.weight,UNUSUAL,'the override reason is kept with the value');assert.equal(v1.confirmedAt,v1.createdAt);});
 check(()=>{const e=sql.prepare("SELECT detail FROM audit_events WHERE org_id=? AND action='recordImportApply' AND detail LIKE ?").all(org,`%${done.result.batchId}%`);assert.equal(e.length,1,'one counted audit event per batch');assert.match(e[0].detail,/9 rows, 2 visits created .* on 1 record .* 7 rejected/);});
 // Everyone in scope sees the imported visit as such; another clinician's snapshot carries the lineage.
 await get(c,'/api/workspace',200,org);
 check(()=>{const seen=c.state.visits.find(v=>v.id===mine[0].id);assert.ok(seen?.imported,'a clinician in scope sees the imported visit');assert.equal(seen.imported.by,o.id);});
 const hist=await get(o,`/api/history?personId=${A.id}`,200,org);
 check(()=>{const r=hist.revisions.find(x=>x.entityId===mine[0].id);assert.equal(r.entityType,'visit');assert.equal(r.action,'recordImportApply');assert.equal(r.reason,REASON);assert.equal(r.data.imported.fileDigest,sha(F));});
 // An imported visit is read-only history: nothing turns it into a current observation.
 const vid=mine[0].id,refused=async body=>{const r=await post(o,body,409);check(()=>assert.match(JSON.stringify(r),/imported from another system/));};
 await refused({type:'preparePlan',visitId:vid,recipients:['synthetic']});
 await refused({type:'createReferral',visitId:vid,facility:'Synthetic facility',reason:'Synthetic referral reason'});
 await refused({type:'amendVisit',visitId:vid,version:1,reason:'Synthetic amendment of an imported visit'});
 await refused({type:'signOffVisit',visitId:vid,recordVersion:1});
 await refused({type:'checkProtocol',visitId:vid,version:1});
 await refused({type:'runAI',visitId:vid,providerId:'ai_summary',version:1,consentVersion:1,approved:true});
 await post(o,{type:'saveVisit',visitId:vid,version:1,facts:{date:new Date(Date.now()-60000).toISOString().slice(0,16),systolic:'118',diastolic:'76',weight:'57.5',temperature:'',weeks:'',coughDays:'',notes:'Synthetic edit of an imported visit.',source:'measured'}},409);
 await get(o,`/api/fhir/${vid}?organisationId=${org}`,409);
 // Marking it wrong-patient stays possible and a new dry run then accepts the row again (a voided import no longer blocks a re-import).
 await post(o,{type:'voidVisit',visitId:vid,version:1,reason:'Imported for the wrong person in this synthetic test'});
 check(()=>assert.ok(JSON.parse(sql.prepare('SELECT data FROM visits WHERE org_id=? AND id=?').get(org,vid).data).voidedAt,'voided'));
 const plan3=await dry(o,{kind:'visits',csv:F});
 check(()=>{assert.deepEqual(plan3.counts,{rows:9,accepted:1,rejected:8});assert.equal(plan3.rows[0].status,'accepted');assert.equal(plan3.rows[0].duplicateOf,undefined);assert.notEqual(plan3.planHash,plan2.planHash);});
 // The organisation data export (owner only) carries the imported visits and their lineage in the visits table, and writes no FHIR document for them.
 const exported=await fetch(`${base}/api/data-exit?fhir=1`,{headers:{...o.headers,'x-saha-organisation':org}}),archive=Buffer.from(await exported.arrayBuffer());
 check(()=>assert.equal(exported.status,200,archive.toString('utf8').slice(0,200)));
 const files=readTar(archive),visitRows=files.get('tables/visits.jsonl').toString('utf8');
 check(()=>{assert.ok(visitRows.includes(mine[1].id)&&visitRows.includes(sha(F)),'the imported visit and its file digest are in the export');assert.equal([...files.keys()].some(k=>k===`fhir/${mine[1].id}.json`||k===`fhir/${vid}.json`),false,'no FHIR document for an imported visit');assert.ok([...files.keys()].some(k=>k.startsWith('fhir/')),'documents for visits recorded in Saha remain');});
}
