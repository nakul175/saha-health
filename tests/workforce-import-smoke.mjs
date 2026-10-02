import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
// Slice 10d: workforce roster import through the built Worker and local D1: dry-run route authority and bounds, nothing
// stored by a dry run, no names, account codes or staff ids in responses, the rejection report download (manifest, headers,
// access-audit event, no revision moved), a stale plan refused, apply of exactly the previewed plan (account-bound
// invitations that the invited accounts can join, an update, a suspension, a recorded staff id, a counted audit with no
// names), the owner's own membership untouched, a repeat refused, and replay rechecked after the importer lost ownership.
export async function workforceImportSmoke({get,post,check,accounts,org,sql,base}){
 const {owner:o,worker:w,clinician:c,admin:a,supervisor:sv}=accounts;await get(o,'/api/workspace',200,org);
 const call=async(path,who,body,status=200,headers={})=>{const r=await fetch(`${base}${path}`,{method:'POST',headers:{...who.headers,'content-type':'application/json','x-saha-organisation':org,...headers},body:typeof body==='string'?body:JSON.stringify(body)});const text=await r.text();check(()=>assert.equal(r.status,status,text.slice(0,300)));return {r,text,json:r.headers.get('content-type')?.includes('json')?JSON.parse(text):null};};
 const dry=async(who,csv,status=200,headers={})=>(await call('/api/workforce-import',who,typeof csv==='string'?{csv}:csv,status,headers)).json;
 const synthetic=label=>{const id=`r1-${crypto.randomUUID()}-${label}`;return {id,headers:{'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.invalid`},state:null};};
 const tag=crypto.randomUUID().slice(0,6),HEAD='name,account_code,role,team,status,external_staff_id';
 const fresh=await Promise.all(['wf-new','wf-admin','wf-update','wf-leave','wf-hold','wf-late','wf-coowner','wf-small'].map(async l=>{const x=synthetic(l);await get(x);return x;}));
 const [n1,n2,m1,m2,m3,n3,ow,n4]=fresh,code=x=>x.state.user.accountCode,refresh=()=>get(o,'/api/workspace',200,org);
 // Three accounts join the organisation the ordinary way first; the import then acts on them.
 for(const [x,role] of [[m1,'asha'],[m2,'asha'],[m3,'asha'],[ow,'clinician']]){const i=await post(o,{type:'createInvite',accountCode:code(x),label:`Member ${role}`,role,teamIds:['default']});await post(x,{type:'joinOrganisation',token:i.result.token});}
 await refresh();
 await post(o,{type:'updateMember',userId:m3.id,version:o.state.members.find(m=>m.userId===m3.id).version,role:'asha',teamIds:['default'],isOwner:false,status:'suspended',reason:'Suspended before the roster import'});
 await refresh();
 const north=o.state.teams.find(t=>t.name==='North team').id,ownerMember=()=>o.state.members.find(m=>m.userId===o.id),member=x=>o.state.members.find(m=>m.userId===x.id);
 const dflt=o.state.teams.find(t=>t.id==='default').name,staff=`KGP-${tag}`,staff2=`KGP-${tag}-2`,ownCode=ownerMember().accountCode;
 const file=[HEAD,
  `Wf New ${tag},${code(n1)},asha,${dflt},active,${staff}`,
  `Wf Admin ${tag},${code(n2)},admin,,active,`,
  `Wf Update ${tag},${code(m1)},clinician,${dflt};North team,active,${staff2}`,
  `Wf Leaver ${tag},${code(m2)},asha,${dflt},left,`,
  `Wf Held ${tag},${code(m3)},asha,${dflt},active,`,
  `Wf Owner ${tag},${ownCode},asha,${dflt},active,KGP-${tag}-own`,
  `Wf Unknown Team ${tag},${code(n3)},asha,Nowhere team,active,`].join('\n');
 // Authority, format and size bounds.
 for(const who of [w,c,a])await dry(who,file,403);
 await dry(o,file,415,{'content-type':'text/plain'});
 await dry(o,file,403,{origin:'https://attacker.example'});
 await dry(o,'x'.repeat(21000),413);
 await dry(o,'x'.repeat(16001),422);
 await dry(o,'name,account_code\nA,B',422);
 await dry(o,HEAD,422);
 await dry(o,{csv:file,extra:1},422);
 const before=()=>JSON.stringify({inv:sql.prepare('SELECT id,status FROM invitations WHERE org_id=? ORDER BY id').all(org),mem:sql.prepare('SELECT user_id,version,status,role FROM memberships WHERE org_id=? ORDER BY user_id').all(org),ops:sql.prepare('SELECT data FROM operations WHERE org_id=?').get(org)??null,audit:sql.prepare("SELECT count(*) AS n FROM audit_events WHERE org_id=? AND action='workforceImportApply'").get(org).n});
 const stored=before();
 let plan=await dry(o,file);
 check(()=>{assert.deepEqual(plan.counts,{rows:7,invite:2,update:1,suspend:1,unchanged:1,conflict:1,rejected:1,staffIds:2});assert.deepEqual(plan.rows.map(r=>r.action),['invite','invite','update','suspend','conflict','none','rejected']);assert.equal(plan.rows[2].role,'clinician');assert.deepEqual([...plan.rows[2].teams].sort(),[dflt,'North team'].sort());assert.match(plan.rows[4].reasons[0],/Suspended here but active/);assert.match(plan.rows[5].detail,/own membership is not changed/);assert.match(plan.rows[6].reasons[0],/does not match a team/);assert.match(plan.planHash,/^[0-9a-f]{64}$/);assert.equal(plan.environment,'synthetic');});
 check(()=>{const text=JSON.stringify(plan);for(const x of [tag,code(n1),code(m1),staff,staff2])assert.equal(text.includes(x),false,`${x} is not returned by the dry run`);assert.equal(before(),stored,'a dry run stores nothing');});
 // The rejection report: a CSV export with a manifest, headers and an access-audit event, listing row numbers and reasons only.
 await call('/api/import-rejections',w,{kind:'workforce',csv:file},403);
 await call('/api/import-rejections',a,{kind:'workforce',csv:file},403);
 const revBefore=sql.prepare('SELECT revision FROM organisations WHERE id=?').get(org).revision,receiptsBefore=sql.prepare('SELECT count(*) AS n FROM command_receipts WHERE org_id=?').get(org).n;
 const rep=await call('/api/import-rejections',o,{kind:'workforce',csv:file});
 check(()=>{assert.equal(sql.prepare('SELECT revision FROM organisations WHERE id=?').get(org).revision,revBefore,'the report does not move the organisation revision');assert.equal(sql.prepare('SELECT count(*) AS n FROM command_receipts WHERE org_id=?').get(org).n,receiptsBefore,'no command receipt');assert.equal(before(),stored);});
 check(()=>{assert.match(rep.r.headers.get('content-type'),/text\/csv/);assert.match(rep.r.headers.get('content-disposition'),/attachment; filename="saha-import-rejections.csv"/);const lines=rep.text.split('\r\n');lines.pop();const body=lines.slice(0,-2).map(l=>l+'\r\n').join('');const sha=createHash('sha256').update(body).digest('hex');assert.equal(sha,rep.r.headers.get('x-saha-content-sha256'));assert.equal(lines.at(-1),`"Manifest","Content SHA-256","${sha}"`);assert.equal(lines.at(-2),`"Manifest","Data rows","${lines.length-2}"`);assert.ok(lines.includes('"Import","workforce-import-v1","workforce"'));assert.ok(lines.includes('"Rows in file","7"'));assert.ok(lines.includes('"Control total","Displayed measure","Sum of detail rows","Detail rows","Reconciled"'));assert.ok(lines.includes('"Rows not accepted","2","2","Distinct row numbers listed above","yes"'));assert.ok(lines.some(l=>l.startsWith('"5","Conflict","Suspended here but active')));assert.ok(lines.some(l=>l.startsWith('"7","Rejected","1 team name on this row')));assert.equal(lines.some(l=>l.startsWith('"1",')),false,'accepted rows are not listed');});
 check(()=>{for(const x of [tag,code(n1),code(m3),staff])assert.equal(rep.text.includes(x),false,x);const e=sql.prepare("SELECT detail FROM audit_events WHERE org_id=? AND action='importRejectionsExport' AND detail LIKE '%workforce dry run%'").all(org);assert.equal(e.length,1);assert.ok(e[0].detail.includes(rep.r.headers.get('x-saha-export-id')));assert.ok(e[0].detail.includes(rep.r.headers.get('x-saha-content-sha256')));assert.match(e[0].detail,/workforce dry run .* 7 rows in file, 2 listed/);assert.equal(e[0].detail.includes(tag),false);});
 // A change in the pending invitations after the dry run makes the plan stale.
 const apply={type:'workforceImportApply',csv:file,planHash:plan.planHash,reason:'Synthetic district roster of 2 October 2026'};
 await post(o,{type:'createInvite',accountCode:code(n3),label:`Interleaved ${tag}`,role:'asha',teamIds:['default']});
 await post(o,apply,409);
 await post(w,apply,403);await post(c,apply,403);await post(a,apply,403);
 await post(o,{...apply,reason:'short'},422);
 check(()=>assert.equal(sql.prepare("SELECT count(*) AS n FROM audit_events WHERE org_id=? AND action='workforceImportApply'").get(org).n,0,'refused applies write nothing'));
 const stalePlan=plan;plan=await dry(o,file);
 check(()=>{assert.notEqual(plan.planHash,stalePlan.planHash,'the pending invitation is part of the plan');assert.deepEqual(plan.counts,stalePlan.counts);});
 const ownerBefore=sql.prepare('SELECT version,role,status,is_owner FROM memberships WHERE org_id=? AND user_id=?').get(org,o.id),outsiders=[w,c,a].map(x=>sql.prepare('SELECT version,role,status FROM memberships WHERE org_id=? AND user_id=?').get(org,x.id));
 const key=crypto.randomUUID(),good={...apply,planHash:plan.planHash},done=await post(o,good,200,key);
 const r=done.result,tokens=r.invitations.map(i=>i.token);
 check(()=>{assert.deepEqual(r.counts,plan.counts);assert.deepEqual(r.invitations.map(i=>[i.row,i.accountCode]),[[1,code(n1)],[2,code(n2)]]);assert.ok(tokens.every(t=>/^[a-f0-9]{64}$/.test(t)));assert.deepEqual(r.rows,[1,2,3,4]);assert.equal(JSON.stringify(r).includes(tag),false,'no names in the result');assert.match(r.batchId,/^[0-9a-f-]{36}$/);});
 const replay=await post(o,good,200,key);check(()=>{assert.equal(replay.replayed,true);assert.deepEqual(replay.result.invitations.map(i=>i.token),tokens,'a retry with the same key returns the same codes');});
 // Ordinary, account-bound, expiring invitations; only token hashes are stored.
 check(()=>{const rows=sql.prepare('SELECT * FROM invitations WHERE org_id=? AND account_code IN (?,?) ORDER BY account_code').all(org,code(n1),code(n2));assert.equal(rows.length,2);for(const i of rows){assert.equal(i.status,'pending');assert.equal(i.created_by,o.id);assert.match(i.token_hash,/^[0-9a-f]{64}$/);assert.equal(tokens.includes(i.token_hash),false);const hours=(Date.parse(i.expires_at)-Date.parse(i.created_at))/3600000;assert.ok(Math.abs(hours-72)<0.01,`expires in 72 hours: ${hours}`);}
  const byCode=Object.fromEntries(rows.map(i=>[i.account_code,i]));assert.deepEqual([byCode[code(n1)].role,JSON.parse(byCode[code(n1)].team_ids),byCode[code(n1)].label],['asha',['default'],`Wf New ${tag}`]);assert.deepEqual([byCode[code(n2)].role,JSON.parse(byCode[code(n2)].team_ids)],['admin',[]]);assert.equal(JSON.stringify(rows).includes(tokens[0]),false);});
 await refresh();
 check(()=>{const m=x=>sql.prepare('SELECT version,role,status FROM memberships WHERE org_id=? AND user_id=?').get(org,x.id);assert.deepEqual([m(m1).role,m(m1).status,m(m1).version],['clinician','active',member(m1).version]);assert.deepEqual(sql.prepare('SELECT team_id FROM team_members WHERE org_id=? AND user_id=? ORDER BY team_id').all(org,m1.id).map(t=>t.team_id),['default',north].sort());assert.equal(m(m2).status,'suspended');assert.equal(m(m3).status,'suspended','a local suspension is not touched');
  assert.deepEqual(sql.prepare('SELECT version,role,status,is_owner FROM memberships WHERE org_id=? AND user_id=?').get(org,o.id),ownerBefore,'the importer\'s own membership is unchanged');assert.deepEqual([w,c,a].map(x=>sql.prepare('SELECT version,role,status FROM memberships WHERE org_id=? AND user_id=?').get(org,x.id)),outsiders,'people not in the file are untouched');});
 await get(m2,'/api/workspace',403,org);
 await get(m1,'/api/workspace',200,org);check(()=>assert.equal(m1.state.membership.role,'clinician'));
 // The invited accounts join with the codes the import returned; a code is bound to its account.
 await post(n2,{type:'joinOrganisation',token:tokens[0]},403);
 await post(n1,{type:'joinOrganisation',token:tokens[0]});await post(n2,{type:'joinOrganisation',token:tokens[1]});
 await get(n1,'/api/workspace',200,org);await get(n2,'/api/workspace',200,org);check(()=>{assert.deepEqual([n1.state.membership.role,n1.state.membership.teamIds],['asha',['default']]);assert.deepEqual([n2.state.membership.role,n2.state.membership.teamIds],['admin',[]]);});
 // External staff ids: recorded with lineage, shown to operators only, never for the importer's own row, never in the audit.
 const ops=await get(o,'/api/operations',200,org),ids=ops.operations.staffIds;
 check(()=>{assert.equal(ids[code(n1)].id,staff);assert.equal(ids[code(m1)].id,staff2);assert.equal(ids[ownCode],undefined);assert.equal(ids[code(m2)],undefined);assert.equal(ids[code(n1)].batchId,r.batchId);assert.equal(Object.keys(ids).length,2);});
 check(()=>assert.equal(JSON.stringify(ops.operations).includes(staff2),true));
 await get(w,'/api/operations',403,org);const sops=await get(sv,'/api/operations',200,org);check(()=>assert.equal(sops.operations,null,'staff ids are not shown to non-operators'));
 check(()=>{const ev=sql.prepare("SELECT subject,detail FROM audit_events WHERE org_id=? AND action='workforceImportApply' ORDER BY rowid").all(org);assert.equal(ev.length,5,'four applied rows and one summary');const text=JSON.stringify(ev);for(const x of [tag,staff,staff2,...tokens])assert.equal(text.includes(x),false,'no names, staff ids or codes in the audit');assert.match(ev.at(-1).detail,new RegExp(`batch ${r.batchId} applied from dry run ${plan.planHash}: 7 rows, 2 invited, 1 updated, 1 suspended, 1 unchanged, 1 conflicts and 1 rejected rows not applied, 2 external staff ids recorded\\. Reason: Synthetic district roster`));assert.equal(ev.at(-1).subject,org);});
 // The same plan cannot be applied twice, and a new dry run of the same file finds nothing left to do.
 await post(o,{...good},409);
 const after=await dry(o,file);
 check(()=>{assert.deepEqual([after.counts.invite,after.counts.update,after.counts.suspend,after.counts.staffIds],[0,0,0,0]);assert.deepEqual(after.rows.map(x=>x.action),['none','none','none','none','conflict','none','rejected']);});
 await post(o,{...apply,planHash:after.planHash},409);
 // Replay is rechecked under the current membership: a second owner applies, loses ownership, and the same key is refused.
 await refresh();
 await post(o,{type:'updateMember',userId:ow.id,version:member(ow).version,role:'clinician',teamIds:['default'],isOwner:true,status:'active',reason:'Second owner for the roster import test'});
 await get(ow,'/api/workspace',200,org);
 const small=[HEAD,`Wf Small ${tag},${code(n4)},asha,${dflt},active,`].join('\n'),sp=await dry(ow,small);
 check(()=>assert.deepEqual([sp.counts.invite,sp.counts.rows],[1,1]));
 const k2=crypto.randomUUID(),sc={type:'workforceImportApply',csv:small,planHash:sp.planHash,reason:'Synthetic roster applied by a second owner'};
 await post(ow,sc,200,k2);
 await refresh();await post(o,{type:'updateMember',userId:ow.id,version:member(ow).version,role:'clinician',teamIds:['default'],isOwner:false,status:'active',reason:'Second owner removed after the roster import test'});
 await post(ow,sc,403,k2);
}
