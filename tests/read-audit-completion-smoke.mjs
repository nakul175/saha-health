import assert from 'node:assert/strict';
// Slice 10h: the remaining read paths over HTTP and local D1. Workspace snapshot loads, browser-reported record opens,
// patient searches and lists, and aggregate views each record one chained access event before anything is returned;
// events carry the acting membership's role, version and delegated authority; the search text is never recorded; with
// the audit store failing every one of them is refused. A separate synthetic account and organisation, so the injected
// fault touches no other suite (the trigger is always removed).
export async function readAuditCompletionSmoke({get,post,check,accounts,org,sql,base}){
 const {owner:outsider}=accounts;
 const mk=label=>({headers:{'oai-authenticated-user-id':`read-audit-${label}-${crypto.randomUUID().slice(0,8)}`,'oai-authenticated-user-email':`${label}@example.invalid`},state:null});
 const o=mk('owner'),a2=mk('asha');
 await get(o);const mine=o.state.organisation.id;
 const tag=crypto.randomUUID().slice(0,6),names=[`Readaudit Alpha ${tag}`,`Readaudit Bravo ${tag}`,`Readaudit Charlie ${tag}`];
 const pids=[];for(const name of names)pids.push((await post(o,{type:'createPerson',name,age:40,sex:'Female',village:'Readaudit locality',programme:'General care',teamId:'default'},200,undefined,mine)).result.personId);
 const events=action=>sql.prepare('SELECT * FROM audit_events WHERE org_id=? AND action=? ORDER BY seq').all(mine,action);
 const revision=()=>sql.prepare('SELECT revision,patient_revision FROM organisations WHERE id=?').get(mine);
 const receipts=()=>sql.prepare("SELECT count(*) AS n FROM command_receipts WHERE org_id=? AND key LIKE 'access_%'").get(mine).n;
 const auditCount=()=>sql.prepare('SELECT count(*) AS n FROM audit_events WHERE org_id=?').get(mine).n;
 const raw=async(who,path,status,init={})=>{const r=await fetch(base+path,{...init,headers:{...(who?.headers??{}),...(init.headers??{}),'x-saha-organisation':mine}});const text=await r.text();check(()=>assert.equal(r.status,status,path+' '+text.slice(0,300)));let json=null;try{json=JSON.parse(text)}catch{}return {r,text,json};};
 const send=async(who,path,body,status,headers={})=>raw(who,path,status,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
 const authority=/ Authority: role clinician \(organisation owner\), membership version \d+; delegated authority in force: none\.$/;

 // 1. A workspace load is one summarised event, however many patients; it moves no revision and writes no receipt.
 const rev0=revision(),r0=receipts(),viewed0=events('viewPatientRecord').length;
 let n=events('viewWorkspace').length;
 for(let i=1;i<=3;i++){await get(o,'/api/workspace',200,mine);check(()=>assert.equal(events('viewWorkspace').length,n+i,`load ${i} adds exactly one event`));}
 const loads=events('viewWorkspace').slice(-3);
 check(()=>{for(const e of loads){assert.equal(e.person_id,null);assert.equal(e.actor_id,o.headers['oai-authenticated-user-id']);assert.equal(e.subject,mine);assert.equal(e.role,'clinician');assert.ok(Number.isInteger(e.seq)&&e.seq>0);assert.match(e.detail,new RegExp(`Workspace snapshot returned \\(workspace load\\): ${o.state.people.length} patients in care scope; ${o.state.people.length} records returned in full;`));assert.match(e.detail,authority);for(const name of names)assert.equal(e.detail.includes(name),false,'no patient name');for(const id of pids)assert.equal(e.detail.includes(id),false,'no patient id');}});
 check(()=>{assert.equal(events('viewPatientRecord').length,viewed0,'a load is not one row per patient');assert.deepEqual(revision(),rev0,'loads move neither revision');assert.equal(receipts(),r0,'no receipt for a read');});
 // A whole-caseload snapshot returned with a command, and the replay of a saved command, are loads too.
 n=events('viewWorkspace').length;const key=crypto.randomUUID();
 await post(o,{type:'createPerson',name:`Readaudit Delta ${tag}`,age:33,sex:'Male',village:'Readaudit locality',programme:'General care',teamId:'default'},200,key,mine);
 check(()=>{const e=events('viewWorkspace');assert.equal(e.length,n+1);assert.match(e.at(-1).detail,/\(response to a command\)/);});
 const replay=await post(o,{type:'createPerson',name:`Readaudit Delta ${tag}`,age:33,sex:'Male',village:'Readaudit locality',programme:'General care',teamId:'default'},200,key,mine);
 check(()=>{assert.equal(replay.replayed,true);const e=events('viewWorkspace');assert.equal(e.length,n+2);assert.match(e.at(-1).detail,/\(replay of a saved command\)/);});
 // A partition delta records its actual material disclosure, independently of the whole care scope.
 n=events('viewWorkspace').length;const beforeDeltaViews=events('viewPatientRecord').length;
 const started=await fetch(base+'/api/commands',{method:'POST',headers:{...o.headers,'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID(),'x-saha-organisation':mine,'x-saha-response':'delta'},body:JSON.stringify({type:'startVisit',personId:pids[2]})}).then(r=>r.json());
 check(()=>{assert.ok(started.delta,'a delta response');assert.deepEqual(started.delta.people.map(p=>p.id),[pids[2]]);const summaries=events('viewWorkspace');assert.equal(summaries.length,n+1);assert.match(summaries.at(-1).detail,/Partition snapshot returned \(response to a command\): 1 patient records returned in full/);const records=events('viewPatientRecord');assert.equal(records.length,beforeDeltaViews+1);assert.equal(records.at(-1).person_id,pids[2]);assert.match(records.at(-1).detail,/Full patient record returned through a command partition/);});

 // 2. The Activity log leaves summary events out unless asked; the owner can ask; a care-role member never sees them.
 const log=await get(o,'/api/audit',200,mine),logAll=await get(o,'/api/audit?summaries=1',200,mine);
 check(()=>{assert.equal(log.events.some(e=>e.action==='viewWorkspace'),false);assert.equal(logAll.events.some(e=>e.action==='viewWorkspace'),true);});
 await get(o,'/api/workspace',200,mine);check(()=>assert.equal(o.state.audit.some(e=>['viewWorkspace','searchPatients','listPatients','viewAggregate'].includes(e.action)),false,'the snapshot activity page leaves summaries out'));
 await get(a2);
 const invite=(await post(o,{type:'createInvite',accountCode:a2.state.user.accountCode,label:'Read audit ASHA',role:'asha',teamIds:['default']},200,undefined,mine)).result;
 await post(a2,{type:'joinOrganisation',token:invite.token},200);
 const ashaLog=await get(a2,'/api/audit?summaries=1',200,mine);
 check(()=>assert.equal(ashaLog.events.some(e=>['viewWorkspace','searchPatients','listPatients','viewAggregate'].includes(e.action)),false,'a care-role member never sees summary events'));
 const ashaLoad=events('viewWorkspace').at(-1);
 check(()=>{assert.equal(ashaLoad.actor_id,a2.headers['oai-authenticated-user-id']);assert.equal(ashaLoad.role,'asha');assert.match(ashaLoad.detail,/0 patients in care scope; 0 records returned in full;/);assert.match(ashaLoad.detail,/Authority: role asha, membership version \d+; delegated authority in force: none\.$/);});

 // 3. A browser-reported record open: in scope only, one event, a repeat within a minute is not recorded again.
 const rev1=revision();n=events('openRecord').length;
 let ok=await send(o,'/api/record-opened',{personId:pids[0],source:'work list'},200);
 check(()=>{assert.equal(ok.json.recorded,true);const e=events('openRecord');assert.equal(e.length,n+1);assert.equal(e.at(-1).person_id,pids[0]);assert.equal(e.at(-1).subject,pids[0]);assert.match(e.at(-1).detail,/^Record opened on screen from work list \(the record was already loaded in the browser; reported by the browser\)\./);assert.match(e.at(-1).detail,authority);assert.equal(e.at(-1).detail.includes(names[0]),false);});
 ok=await send(o,'/api/record-opened',{personId:pids[0],source:'patient list'},200);
 check(()=>{assert.equal(ok.json.recorded,false);assert.equal(ok.json.coalesced,true);assert.equal(events('openRecord').length,n+1);});
 ok=await send(o,'/api/record-opened',{personId:pids[1]},200);
 check(()=>{assert.equal(ok.json.recorded,true);assert.match(events('openRecord').at(-1).detail,/from other \(/);});
 const afterOpens=auditCount();
 await send(o,'/api/record-opened',{personId:pids[2],source:'somewhere else'},422);
 await send(o,'/api/record-opened',{personId:pids[2],source:'link',note:'extra'},422);
 await send(o,'/api/record-opened',{source:'link'},422);
 await send(o,'/api/record-opened',{personId:'../etc',source:'link'},400);
 await send(o,'/api/record-opened',{personId:'p_does_not_exist',source:'link'},404);
 await send(a2,'/api/record-opened',{personId:pids[0],source:'link'},404);
 await send(outsider,'/api/record-opened',{personId:pids[0],source:'link'},403);
 await raw(o,'/api/record-opened',415,{method:'POST',headers:{'Content-Type':'text/plain'},body:'x'});
 await raw(o,'/api/record-opened',403,{method:'POST',headers:{'Content-Type':'application/json',origin:'https://elsewhere.example'},body:JSON.stringify({personId:pids[2],source:'link'})});
 const noAuth=await fetch(base+'/api/record-opened',{method:'POST',headers:{'Content-Type':'application/json','x-saha-organisation':mine},body:JSON.stringify({personId:pids[2],source:'link'})});check(()=>assert.equal(noAuth.status,401));
 check(()=>{assert.equal(auditCount(),afterOpens,'a refused open writes nothing');assert.deepEqual(revision(),rev1,'opens move neither revision');});
 // The detail route still records its own event; no second open event is written for it.
 const opened=events('openRecord').length,detail0=events('viewPatientRecord').length;
 await raw(o,`/api/patients/detail?personId=${encodeURIComponent(pids[2])}`,200);
 check(()=>{assert.equal(events('viewPatientRecord').length,detail0+1);assert.equal(events('openRecord').length,opened);assert.match(events('viewPatientRecord').at(-1).detail,authority);});

 // 4. Patient lists and searches: kind and result count; never the search text.
 const secret=`zzsecret${tag}`;
 n=events('listPatients').length;let s0=events('searchPatients').length;
 const browse=await raw(o,'/api/patients',200);
 check(()=>{const e=events('listPatients');assert.equal(e.length,n+1);assert.equal(e.at(-1).person_id,null);assert.match(e.at(-1).detail,new RegExp(`^Patient list: browse; first page; ${browse.json.rows.length} rows returned of ${browse.json.total} matching\\.`));assert.match(e.at(-1).detail,/delegated authority: not consulted for this view/);assert.match(e.at(-1).detail,/Authority: role clinician \(organisation owner\), membership version \d+;/);});
 const found=await send(o,'/api/patients',{q:`readaudit alpha ${tag}`},200),none=await send(o,'/api/patients',{q:secret},200);
 check(()=>{const e=events('searchPatients');assert.equal(e.length,s0+2);assert.match(e.at(-2).detail,new RegExp(`^Patient search: text search \\(name, village or id\\); first page; ${found.json.rows.length} rows? returned of ${found.json.total} matching\\.`));assert.match(e.at(-1).detail,/^Patient search: text search \(name, village or id\); first page; 0 rows returned of 0 matching\./);assert.equal(found.json.rows.length,1);for(const x of e.slice(-2)){assert.equal(JSON.stringify(x).includes(secret),false,'the search text is not recorded');assert.equal(JSON.stringify(x).toLowerCase().includes('readaudit alpha'),false);assert.equal(x.person_id,null);}});
 await send(o,'/api/patients',{programme:'General care'},200);
 check(()=>assert.match(events('listPatients').at(-1).detail,/^Patient list: programme filter; first page;/));
 const before400=auditCount();
 await raw(o,`/api/patients?q=${secret}`,400);
 check(()=>assert.equal(auditCount(),before400,'a refused search writes nothing'));
 await raw(outsider,'/api/patients',403);
 const wl=await raw(o,'/api/worklists?view=work',200);
 check(()=>assert.match(events('listPatients').at(-1).detail,new RegExp(`^Work list: work; first page; ${wl.json.rows.length} rows? returned of ${wl.json.total}\\.`)));
 s0=events('searchPatients').length;
 const match=await send(o,'/api/patient-matches',{name:`Readaudit Alpha ${tag}`,age:40,sex:'Female',village:'Readaudit locality',teamId:'default'},200);
 check(()=>{const e=events('searchPatients');assert.equal(e.length,s0+1);assert.match(e.at(-1).detail,new RegExp(`^Patient search: duplicate check on registration \\(name, age, sex, village and team entered; not recorded\\); ${match.json.candidates.length} candidates? returned\\.`));assert.equal(e.at(-1).detail.includes('Readaudit'),false,'the entered name is not recorded');assert.ok(match.json.candidates.length>=1);});

 // 5. Aggregate views: indicators, the scoped care report, aggregate report history. Counts and which filters were set only.
 const cat=await raw(o,'/api/indicators',200),ids=cat.json.catalogue.slice(0,2).map(d=>d.id);
 let v0=events('viewAggregate').length;
 const ind=await send(o,'/api/indicators',{ids:ids.join(','),days:'30',group:'none',team:'default'},200);
 check(()=>{const e=events('viewAggregate');assert.equal(e.length,v0+1);assert.equal(e.at(-1).subject,'indicator results');assert.equal(e.at(-1).person_id,null);assert.match(e.at(-1).detail,/^Indicator results viewed: /);assert.match(e.at(-1).detail,/filters set: team\./);assert.equal(/\bdefault\b/.test(e.at(-1).detail),false,'a filter value is not recorded');for(const id of ids)assert.ok(e.at(-1).detail.includes(id));assert.match(e.at(-1).detail,authority);assert.equal(ind.json.results.length,ids.length);});
 v0=events('viewAggregate').length;await get(o,'/api/indicators',200,mine);await get(o,'/api/indicators?question=how%20many%20people',200,mine);
 check(()=>assert.equal(events('viewAggregate').length,v0,'the catalogue and question interpretation hold no results and are not recorded'));
 const exp0=events('indicatorExport').length;
 await send(o,'/api/indicators',{ids:ids.join(','),days:'30',group:'none',format:'csv'},200);
 check(()=>{assert.equal(events('indicatorExport').length,exp0+1);assert.equal(events('viewAggregate').length,v0,'a CSV export is recorded as indicatorExport only');});
 await get(o,'/api/operations?days=30',200,mine);
 check(()=>{const e=events('viewAggregate').at(-1);assert.equal(e.subject,'operations and care report');assert.match(e.detail,/^Operations view read \(JSON\): 30-day window; scoped care report included \(\d+ teams?, own reporting authority; \d+ patients counted\);/);assert.match(e.detail,authority);});
 v0=events('viewAggregate').length;await raw(o,'/api/operations?days=30&format=csv',200);
 check(()=>assert.equal(events('viewAggregate').length,v0,'the CSV export is recorded as opsExport, not as a view'));
 await get(o,'/api/aggregate-reports',200,mine);
 check(()=>{const e=events('viewAggregate').at(-1);assert.equal(e.subject,'aggregate report history');assert.match(e.detail,/^Aggregate report history viewed: \d+ reports? in the viewer's reporting scope, \d+ aggregate destinations?; manifests only \(no cell values\)\./);});
 const before403=auditCount();await get(a2,'/api/aggregate-reports',403,mine);check(()=>assert.equal(auditCount(),before403,'a refused aggregate view writes nothing'));

 // 6. The chain holds every new event, intact, and each event's detail (with its authority clause) is under the hash.
 let chain=(await raw(o,'/api/audit/chain',200)).json;
 check(()=>assert.equal(chain.status,'intact'));

 // 7. Fault injection: with the audit store refusing inserts, none of these reads returns anything.
 const n0=auditCount(),revF=revision();
 sql.exec(`CREATE TRIGGER IF NOT EXISTS read_audit_fault_smoke BEFORE INSERT ON audit_events WHEN NEW.org_id='${mine}' BEGIN SELECT RAISE(ABORT, 'Synthetic audit store failure'); END;`);
 try{
  const msg=/could not record this access in the audit log/;
  const refused=async(who,path,init,pattern=msg)=>{const {text,json}=await raw(who,path,503,init);check(()=>{assert.match(json.error,pattern);for(const name of names)assert.equal(text.includes(name),false,path+' returned no patient name');});};
  await refused(o,'/api/workspace');
  await refused(o,'/api/patients');
  await refused(o,'/api/patients',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({q:'x'})});
  await refused(o,'/api/worklists?view=work');
  await refused(o,'/api/patient-matches',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Any Name',age:40,sex:'Female',village:'Anywhere',teamId:'default'})});
  // (a patient not opened in the last minute: a coalesced repeat writes nothing and is answered without an audit write)
  await refused(o,'/api/record-opened',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({personId:pids[2],source:'link'})});
  await refused(o,'/api/aggregate-reports');
  await refused(o,'/api/operations?days=30');
  await refused(o,'/api/indicators',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids:ids.join(','),days:'30',group:'none'})});
  check(()=>{assert.equal(auditCount(),n0);assert.deepEqual(revision(),revF);});
 }finally{sql.exec('DROP TRIGGER IF EXISTS read_audit_fault_smoke;');}
 // After recovery the same reads work again and the chain is intact.
 await get(o,'/api/workspace',200,mine);await raw(o,'/api/patients',200);
 chain=(await raw(o,'/api/audit/chain',200)).json;
 check(()=>assert.equal(chain.status,'intact'));
}
