import assert from 'node:assert/strict';
import { readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { startWorker, identity, client } from './lib/worker.mjs';

const state=resolve('.wrangler/auxiliary-read-http-state');
const worker=await startWorker({port:'8958',name:'auxiliary-read-http',state,vars:{SAHA_ENVIRONMENT:'synthetic'}});
const C=client(worker.base),owner=identity('owner'),asha=identity('asha'),admin=identity('admin'),checks=[];
let org,sql;
const check=async(name,fn)=>{await fn();checks.push(name);};
const command=async(who,body)=>{const r=await C.command(who,body,org);assert.equal(r.status,200,r.text);return r.json;};
try {
 const home=await C.get(owner,'/api/workspace');assert.equal(home.status,200);org=home.json.organisation.id;
 for(const [who,role] of [[asha,'asha'],[admin,'admin']]){
  const h=await C.get(who,'/api/workspace');assert.equal(h.status,200);
  const invite=await command(owner,{type:'createInvite',accountCode:h.json.user.accountCode,label:role,role,teamIds:['default']});
  await command(who,{type:'joinOrganisation',token:invite.result.token});
 }
 const p=(await command(owner,{type:'createPerson',name:'Synthetic private patient',age:30,sex:'Female',village:'Synthetic private locality',programme:'General care',teamId:'default'})).result.personId;
 const dir=join(state,'v3/d1/miniflare-D1DatabaseObject');sql=new DatabaseSync(join(dir,readdirSync(dir).find(f=>f.endsWith('.sqlite')&&f!=='metadata.sqlite')));sql.exec('PRAGMA busy_timeout=5000');
 // Seed historical-shaped synthetic work in this isolated database, without modifying audits/receipts.
 sql.prepare("UPDATE patients SET data=json_set(data,'$.identityReview',json(?)) WHERE org_id=? AND id=?").run(JSON.stringify({state:'provisional',reason:'Synthetic identity review'}),org,p);
 sql.prepare('INSERT INTO referrals(org_id,id,person_id,data) VALUES(?,?,?,?)').run(org,'synthetic-referral',p,JSON.stringify({id:'synthetic-referral',personId:p,version:1,state:'open',facility:'Synthetic private facility',reason:'Synthetic private reason',ownerId:null,urgency:'urgent',due:'2020-01-01',createdAt:'2020-01-01T00:00:00.000Z'}));
 const views=[['/api/continuity','care continuity','people'],['/api/referral-escalations','referral escalations','items'],[`/api/action-plan?personId=${p}`,'action plan',null]];
 const events=label=>sql.prepare("SELECT * FROM audit_events WHERE org_id=? AND detail LIKE ? ORDER BY seq").all(org,`Patient work view: ${label};%`);
 for(const [path,label,key] of views){
  await check(`${label}: success appends exactly one count-only chained event`,async()=>{
   const before=events(label).length,revision=sql.prepare('SELECT revision FROM organisations WHERE id=?').get(org).revision;
   const r=await C.get(owner,path,org);assert.equal(r.status,200,r.text);const rows=events(label);assert.equal(rows.length,before+1);
   const e=rows.at(-1);assert.equal(e.action,key?'listPatients':'viewActionPlan');assert.equal(e.person_id,key?null:p);
   assert.ok(e.seq>0);assert.ok(e.hash);assert.ok(!e.detail.includes('Synthetic private'));assert.equal(sql.prepare('SELECT revision FROM organisations WHERE id=?').get(org).revision,revision);
   if(key){assert.equal(r.json[key].length,1);assert.equal(r.json[key][0].name,'Synthetic private patient');assert.ok(e.detail.includes('1 row returned'));}
  });
  await check(`${label}: administrator is refused before patient audit`,async()=>{const before=events(label).length;assert.equal((await C.get(admin,path,org)).status,403);assert.equal(events(label).length,before);});
  await check(`${label}: failed durable audit returns no patient view`,async()=>{
   const before=events(label).length;sql.exec("CREATE TRIGGER auxiliary_read_refusal BEFORE INSERT ON audit_events WHEN NEW.detail LIKE 'Patient work view:%' BEGIN SELECT RAISE(ABORT,'Synthetic auxiliary audit failure'); END;");
   try {const r=await C.get(owner,path,org);assert.equal(r.status,503,r.text);assert.equal(r.json?.[key??'person'],undefined);assert.ok(!r.text.includes('Synthetic private'));assert.equal(events(label).length,before);}
   finally {sql.exec('DROP TRIGGER auxiliary_read_refusal');}
  });
  await check(`${label}: restored audit resumes read`,async()=>{assert.equal((await C.get(owner,path,org)).status,200);});
 }
 await check('unassigned ASHA cannot read an action plan',async()=>{const before=events('action plan').length;assert.ok([403,404].includes((await C.get(asha,views[2][0],org)).status));assert.equal(events('action plan').length,before);});
 await check('empty ASHA queues disclose no patient details but still audit access',async()=>{for(const [path,label,key] of views.slice(0,2)){const before=events(label).length,r=await C.get(asha,path,org);assert.equal(r.status,200);assert.equal(r.json[key].length,0);assert.equal(events(label).length,before+1);assert.ok(!r.text.includes('Synthetic private'));}});
 await check('removed current team immediately revokes owner patient access',async()=>{sql.prepare('DELETE FROM team_members WHERE org_id=? AND user_id=?').run(org,owner.id);const before=events('action plan').length;assert.ok([403,404].includes((await C.get(owner,views[2][0],org)).status));assert.equal(events('action plan').length,before);});
 const result={suite:'auxiliary-read-http',passed:checks.length,failed:0,checks,completedAt:new Date().toISOString(),limits:'Synthetic built local Worker/D1; no hosted or clinical acceptance.'};
 mkdirSync('tests/evidence/auxiliary-read-audit',{recursive:true});writeFileSync('tests/evidence/auxiliary-read-audit/http.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
} finally {sql?.close();await worker.stop();}
