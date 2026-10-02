import assert from 'node:assert/strict';
// Slice 10e: issuer-identifier search, ABHA number format and programme identity crosswalks through the built Worker and
// local D1, in a separate synthetic organisation so its rate limits and throttles touch no other suite. Route authority and
// bounds; exact, complete identifiers only; matches only inside the searcher's care scope with an indistinguishable answer
// for a record outside it; one chained audit event per search before the answer, no identifier value or name in it, no
// revision movement and no receipt; rate limits (hour, no-match hour, no-match day) read from the audit chain; the identifier
// ledger over HTTP (link, correct, withdraw, masking, replay authority); a conflict between two visible records opens an
// identity case and merges nothing; a holder outside scope gets the ordinary refusal, one steward-review event on the holder
// and a bounded oracle.
export async function identifierSearchSmoke({get,post,check,sql,base}){
 const tag=crypto.randomUUID().slice(0,8),mk=label=>({id:`ic-${tag}-${label}`,headers:{'oai-authenticated-user-id':`ic-${tag}-${label}`,'oai-authenticated-user-email':`${label}@example.invalid`},state:null});
 const o=mk('owner'),c=mk('clin'),s=mk('sup'),w=mk('asha'),a=mk('admin'),r1=mk('rl1'),r2=mk('rl2'),r3=mk('rl3'),r4=mk('replay');
 await get(o);const org=o.state.organisation.id;
 for(const x of [c,s,w,a,r1,r2,r3,r4])await get(x);
 await post(o,{type:'createTeam',name:'North team'});const north=o.state.teams.find(t=>t.name==='North team').id;
 const me=o.state.members.find(m=>m.userId===o.id);await post(o,{type:'updateMember',userId:o.id,version:me.version,role:'clinician',teamIds:['default',north],isOwner:true,status:'active',reason:'Cover both care teams'});
 const join=async(x,role,teamIds=['default'])=>{const i=await post(o,{type:'createInvite',accountCode:x.state.user.accountCode,label:role,role,teamIds});await post(x,{type:'joinOrganisation',token:i.result.token});};
 await join(c,'clinician');await join(s,'supervisor');await join(w,'asha');await join(a,'admin',[]);for(const x of [r1,r2,r4])await join(x,'clinician');
 const rnd=n=>String(Math.floor(Math.random()*9*10**(n-1))+10**(n-1)),abhaNo=()=>`${rnd(2)}-${rnd(4)}-${rnd(4)}-${rnd(4)}`;
 const person=id=>o.state.people.find(p=>p.id===id);
 const make=async(label,teamId='default')=>(await post(o,{type:'createPerson',name:`Identifier ${label} ${crypto.randomUUID().slice(0,6)}`,age:38,sex:'Female',village:'Identifier synthetic locality',programme:'General care',teamId})).result.personId;
 const assign=async(pid,x)=>post(o,{type:'assignPatient',personId:pid,version:person(pid).version,teamId:'default',assignedTo:x.id,reason:'Assign for the identifier test'});
 const A=await make('A'),B=await make('B'),B2=await make('B2'),N=await make('N north',north),N2=await make('N2 north',north),N3=await make('N3 north',north);
 await assign(A,w);await assign(B2,w);
 const post_=(who,body,status=200,key)=>post(who,body,status,key,org);
 const link=(pid,over={})=>({type:'identifierLink',personId:pid,version:person(pid).version,issuer:'rch',identifier:rnd(12),origin:'programme-card',verification:'unverified',reason:'Synthetic link for the identifier test',...over});
 const events=(action,extra='')=>sql.prepare(`SELECT * FROM audit_events WHERE org_id=? AND action=?${extra} ORDER BY seq`).all(org,action);
 const count=()=>sql.prepare("SELECT count(*) AS n FROM audit_events WHERE org_id=? AND action IN ('identifierSearch','identifierSearchMiss')").get(org).n;
 const revision=()=>sql.prepare('SELECT revision,patient_revision FROM organisations WHERE id=?').get(org);
 const search=async(who,body,status=200,headers={},orgId=org)=>{const r=await fetch(`${base}/api/identifier-search`,{method:'POST',headers:{...who.headers,'content-type':'application/json','x-saha-organisation':orgId,...headers},body:typeof body==='string'?body:JSON.stringify(body)});const text=await r.text();check(()=>assert.equal(r.status,status,text.slice(0,300)));let json=null;try{json=JSON.parse(text);}catch{}return {r,text,json};};
 // 1. Route authority and bounds. Nothing here is a search, so nothing is recorded.
 { const raw=await fetch(`${base}/api/identifier-search`,{method:'POST',headers:{'content-type':'application/json'},body:'{}'});check(()=>assert.equal(raw.status,401));await raw.text();
   const get405=await fetch(`${base}/api/identifier-search`,{headers:{...c.headers,'x-saha-organisation':org}});check(()=>assert.equal(get405.status,405,'POST only: an identifier never travels in a URL'));await get405.text();
   const good={issuer:'rch',identifier:rnd(12)};
   await search(c,good,415,{'content-type':'text/plain'});await search(c,good,403,{origin:'https://attacker.example'});await search(a,good,403);
   await search(c,{issuer:'rch',identifier:'1'.repeat(3000)},413);
   for(const bad of [{issuer:'local_mrn',identifier:'123456'},{issuer:'abha',identifier:'91-1234-'},{issuer:'abha',identifier:'91-1234-5678-*'},{issuer:'abha',identifier:'91-12345678-9012'},{issuer:'rch',identifier:'1111'},{issuer:'rch',identifier:'1111222233%'},{issuer:'nikshay',identifier:'12345'},{issuer:'rch'},{issuer:'rch',identifier:rnd(12),extra:1},'not json{'])await search(c,bad,typeof bad==='string'?400:422);
   check(()=>assert.equal(count(),0,'refused and malformed requests record nothing')); }
 // 2. ABHA number format on the link command: 14 digits or hyphenated 2-4-4-4 (mixed grouping refused), stored grouped.
 await post_(o,{type:'abdmConfigure',environment:'mock',modules:{abha:true,hip:false,hiu:false},facilityId:'SYN-FACILITY-IDS',approvals:[{module:'abha',reference:'APPROVAL-ABHA-IDS'}],reason:'Synthetic mock configuration for the identifier test'});
 const abhaDigits=`${rnd(2)}${rnd(4)}${rnd(4)}${rnd(4)}`,abhaGrouped=`${abhaDigits.slice(0,2)}-${abhaDigits.slice(2,6)}-${abhaDigits.slice(6,10)}-${abhaDigits.slice(10)}`;
 for(const bad of [`${abhaDigits.slice(0,2)}-${abhaDigits.slice(2,10)}-${abhaDigits.slice(10)}`,abhaDigits.slice(0,13),`${abhaDigits}5`,`${abhaGrouped.slice(0,-1)}x`])await post_(o,{type:'abhaLink',personId:B,version:person(B).version,abhaNumber:bad,otp:'123456'},422);
 const badAbha=await post_(o,{type:'abhaLink',personId:B,version:person(B).version,abhaNumber:`${abhaDigits.slice(0,2)}-${abhaDigits.slice(2,10)}-${abhaDigits.slice(10)}`,otp:'123456'},422);check(()=>assert.match(badAbha.error,/14 digits or grouped 2-4-4-4 with hyphens/));
 await post_(o,{type:'abhaLink',personId:B,version:person(B).version,abhaNumber:abhaDigits,otp:'123456'});
 check(()=>{assert.equal(JSON.parse(sql.prepare('SELECT data FROM patients WHERE org_id=? AND id=?').get(org,B).data).abha.number,abhaGrouped,'stored in the grouped form');});
 // 3. The identifier ledger over HTTP: link with provenance, masked in snapshots and history, stored in full.
 const RA=rnd(12),KA=rnd(7),RN=rnd(12),RN2=rnd(12),RN3=rnd(12);
 const l1=await post_(o,link(A,{identifier:RA,origin:'programme-system'}));
 check(()=>{assert.equal(l1.result.linked,true);assert.equal(JSON.stringify(l1).includes(RA),false,'no unmasked identifier value in the command result or its snapshot');const e=person(A).identifiers[0];assert.deepEqual([e.issuer,e.value,e.kind,e.source,e.origin,e.verification,e.verified,e.recordedBy],['rch','XXXXXXXX'+RA.slice(-4),'link','crosswalk','programme-system','unverified',false,o.id],'masked in the snapshot with provenance');const stored=JSON.parse(sql.prepare('SELECT data FROM patients WHERE org_id=? AND id=?').get(org,A).data).identifiers[0];assert.deepEqual([stored.value,stored.recordedBy,typeof stored.recordedAt],[RA,o.id,'string']);});
 const hist=await get(o,`/api/history?personId=${A}`,200,org);check(()=>{const text=JSON.stringify(hist);assert.equal(text.includes(RA),false,'masked in history');assert.ok(text.includes('XXXXXXXX'+RA.slice(-4)));});
 await get(w,'/api/workspace',200,org);
 const k1=await post_(w,link(A,{issuer:'nikshay',identifier:KA,origin:'person-reported',verification:'document-seen',evidence:'Ni-kshay card sighted at the home visit',version:w.state.people.find(p=>p.id===A).version}));
 check(()=>assert.equal(k1.result.current,2));
 await post_(w,link(A,{issuer:'nikshay',identifier:rnd(7),verification:'issuer-checked',evidence:'Portal lookup',version:person(A).version}),403);
 await post_(w,{type:'identifierWithdraw',personId:A,version:person(A).version,entryId:person(A).identifiers[0].id,reason:'An ASHA may not withdraw'},403);
 await post_(a,link(A),403);
 await get(o,'/api/workspace',200,org);
 await post_(o,link(A,{identifier:rnd(12),version:person(A).version}),409);
 await post_(o,link(A,{issuer:'abha',identifier:abhaGrouped}),422);await post_(o,link(A,{issuer:'rch',identifier:abhaDigits}),422);await post_(o,link(A,{issuer:'local_mrn',identifier:'M-1'}),422);
 await post_(o,link(A,{version:99}),409);
 await post_(o,link(N,{identifier:RN}));await post_(o,link(N2,{identifier:RN2}));await post_(o,link(N3,{identifier:RN3}));
 // 4. Search: a match is a material read, audited before it is returned; a record outside the care scope is invisible.
 const rev0=revision(),receipts0=sql.prepare("SELECT count(*) AS n FROM command_receipts WHERE org_id=?").get(org).n;
 const hit=await search(c,{issuer:'rch',identifier:RA});
 check(()=>{assert.equal(hit.json.matches.length,1);const m=hit.json.matches[0];assert.equal(m.personId,A);assert.match(m.name,/^Identifier A /);assert.deepEqual([m.issuer,m.identifier,m.source,m.verification,m.verified,m.merged],['rch','XXXXXXXX'+RA.slice(-4),'crosswalk','unverified',false,null]);assert.equal(hit.text.includes(RA),false,'the answer does not echo the identifier');assert.equal(hit.json.limits.perHour,30);});
 check(()=>{const e=events('identifierSearch');assert.equal(e.length,1);assert.deepEqual([e[0].person_id,e[0].actor_id,e[0].role],[A,c.id,'clinician']);assert.ok(Number.isInteger(e[0].seq)&&e[0].seq>0&&e[0].hash,'chained');assert.match(e[0].detail,/Searched by RCH ID: 1 record in the searcher's care scope matched/);for(const x of [RA,'Identifier A','Identifier synthetic locality'])assert.equal(JSON.stringify(e[0]).includes(x),false,'no value or name in the event: '+x);assert.deepEqual(revision(),rev0,'a search moves neither the organisation nor the patient revision');assert.equal(sql.prepare("SELECT count(*) AS n FROM command_receipts WHERE org_id=?").get(org).n,receipts0,'no receipt for a read');});
 const byAbha=await search(c,{issuer:'abha',identifier:abhaDigits}),byAbhaGrouped=await search(c,{issuer:'ABHA',identifier:` ${abhaGrouped} `});
 check(()=>{for(const r of [byAbha,byAbhaGrouped]){assert.deepEqual(r.json.matches.map(m=>m.personId),[B]);assert.equal(r.json.matches[0].identifier,`${abhaGrouped.slice(0,2)}-XXXX-XXXX-${abhaGrouped.slice(-4)}`);assert.equal(r.json.matches[0].source,'abha-link');assert.equal(r.json.matches[0].verified,false);assert.match(r.json.matches[0].verification,/not verified with ABDM/);assert.equal(r.text.includes(abhaDigits),false);assert.equal(r.text.includes(abhaGrouped),false);}});
 const byK=await search(w,{issuer:'nikshay',identifier:KA});check(()=>{assert.deepEqual(byK.json.matches.map(m=>m.personId),[A]);assert.equal(byK.json.matches[0].verification,'document-seen');});
 // A record outside the searcher's care scope is neither returned nor distinguishable from an identifier no record carries.
 const ghost=await search(c,{issuer:'rch',identifier:rnd(12)}),northHeld=await search(c,{issuer:'rch',identifier:RN});
 check(()=>{assert.deepEqual(ghost.json.matches,[]);assert.equal(northHeld.text,ghost.text,'an identifier held outside the care scope gets the identical answer');assert.equal(ghost.json.message,'No record in your care scope carries this identifier.');});
 const aschaOther=await search(w,{issuer:'abha',identifier:abhaDigits}),ownerNorth=await search(o,{issuer:'rch',identifier:RN});
 check(()=>{assert.deepEqual(aschaOther.json.matches,[],'an ASHA finds only records assigned to them');assert.deepEqual(ownerNorth.json.matches.map(m=>m.personId),[N],'a member of the team does find it');});
 check(()=>{const misses=events('identifierSearchMiss');assert.ok(misses.length>=3);for(const e of misses){assert.equal(e.person_id,null);assert.match(e.detail,/no record in the searcher's care scope matched/);assert.equal(JSON.stringify(e).includes(RN),false);assert.ok(e.seq>0&&e.hash);}const mine=misses.filter(e=>e.actor_id===c.id);assert.equal(mine.length,2,'a miss is recorded like a hit (both count toward the rate limit)');});
 const log=await get(o,'/api/audit',200,org);check(()=>{const names=log.events.map(e=>e.action);assert.ok(names.includes('identifierSearch'),'the care team sees who looked a patient up');assert.ok(names.includes('identifierSearchMiss'),'an owner sees searches that found nothing');});
 const cLog=await get(c,'/api/audit',200,org);check(()=>assert.equal(cLog.events.some(e=>e.action==='identifierSearchMiss'),false,'a searcher who is not an owner or administrator does not see the person-less miss events'));
 // 5. Corrections append; a withdrawn or superseded identifier no longer matches.
 const RA2=rnd(12),first=person(A).identifiers[0].id;
 await post_(o,link(A,{identifier:RA2,corrects:first,reason:'Corrected a mistyped digit',version:person(A).version}));
 check(()=>{const ids=JSON.parse(sql.prepare('SELECT data FROM patients WHERE org_id=? AND id=?').get(org,A).data).identifiers;assert.equal(ids.length,3);assert.deepEqual([ids[0].value,ids[2].kind,ids[2].corrects,ids[2].value],[RA,'correct',first,RA2],'the earlier entry is kept untouched');});
 check(()=>{const revs=sql.prepare("SELECT count(*) AS n FROM record_revisions WHERE org_id=? AND person_id=? AND action IN ('identifierLink')").get(org,A).n;assert.equal(revs,3,'each link or correction (an RCH ID and a Ni-kshay ID, then the correction) is a revision with its reason');});
 const old=await search(c,{issuer:'rch',identifier:RA}),fresh=await search(c,{issuer:'rch',identifier:RA2});
 check(()=>{assert.deepEqual(old.json.matches,[],'a superseded value no longer matches');assert.deepEqual(fresh.json.matches.map(m=>m.personId),[A]);});
 // 6. A conflict between two records both visible to a steward opens an identity case and merges nothing.
 const conflict=await post_(c,link(B,{identifier:RA2}));
 check(()=>{assert.equal(conflict.result.linked,false);assert.equal(conflict.result.conflict.personId,A);const k=sql.prepare('SELECT state,survivor_id,duplicate_id,data FROM identity_cases WHERE org_id=? AND id=?').get(org,conflict.result.conflict.caseId);assert.deepEqual([k.state,k.survivor_id,k.duplicate_id],['proposed',A,B]);assert.equal(k.data.includes(RA2),false,'the case names the identifier masked only');assert.equal(JSON.parse(sql.prepare('SELECT data FROM patients WHERE org_id=? AND id=?').get(org,B).data).identifiers,undefined,'the identifier is not recorded on the second record');const stored=[A,B].map(id=>JSON.parse(sql.prepare('SELECT data FROM patients WHERE org_id=? AND id=?').get(org,id).data));assert.ok(stored.every(p=>!p.mergedInto&&!p.mergedFrom),'nothing was merged');});
 const cases=await get(c,`/api/identity-cases?personId=${B}`,200,org);check(()=>{assert.equal(cases.cases[0].state,'proposed');assert.equal(cases.cases[0].proposedBySelf,true);assert.equal(cases.cases[0].canDecide,false);});
 await get(s,'/api/workspace',200,org);
 await post_(c,{type:'identityMergeDecide',caseId:conflict.result.conflict.caseId,version:1,decision:'approve',reason:'The proposer may not decide this case'},403);
 await post_(s,{type:'identityMergeDecide',caseId:conflict.result.conflict.caseId,version:1,decision:'reject',reason:'Two different people; the entered value was a typing slip'});
 check(()=>{const k=sql.prepare('SELECT state FROM identity_cases WHERE org_id=? AND id=?').get(org,conflict.result.conflict.caseId);assert.equal(k.state,'rejected');assert.equal(sql.prepare('SELECT count(*) AS n FROM identity_cases WHERE org_id=?').get(org).n,1);});
 // A worker who is not a steward is told to ask one and no case is opened.
 await get(w,'/api/workspace',200,org);
 const asha=await post_(w,link(B2,{identifier:RA2,version:w.state.people.find(p=>p.id===B2).version}),409);check(()=>{assert.match(asha.error,/already recorded on another record you can see\. A clinician or supervisor can open an identity review/);assert.equal(sql.prepare('SELECT count(*) AS n FROM identity_cases WHERE org_id=?').get(org).n,1);});
 // 7. A holder outside the requester's scope: the ordinary refusal, one steward-review event on the holder, a bounded oracle.
 const refuse=async(value)=>post_(w,link(B2,{identifier:value,version:w.state.people.find(p=>p.id===B2).version}),422);
 const r1_=await refuse(RN),r1b=await refuse(RN);
 check(()=>{assert.match(r1_.error,/^This identifier could not be recorded\. Check the number; if it is correct, ask an identity steward to review this record\.$/);assert.equal(r1b.error,r1_.error);for(const x of [RN,N,'North','another record'])assert.equal(JSON.stringify(r1_).includes(x),false,x);});
 check(()=>{const e=events('identifierConflictReview');assert.equal(e.length,1,'a repeat for the same holder adds no second event');assert.deepEqual([e[0].person_id,e[0].actor_id],[N,w.id]);assert.ok(e[0].detail.includes(B2));assert.equal(e[0].detail.includes(RN),false);assert.equal(JSON.stringify(e).includes('Identifier N'),false);assert.equal(JSON.parse(sql.prepare('SELECT data FROM patients WHERE org_id=? AND id=?').get(org,B2).data).identifiers,undefined,'nothing recorded on the requester record');});
 const wLog=await get(w,'/api/workspace',200,org),oLog=await get(o,'/api/workspace',200,org);
 check(()=>{assert.equal(wLog.audit.some(x=>x.action==='identifierConflictReview'),false,'the requester does not see the steward event');assert.ok(oLog.audit.some(x=>x.action==='identifierConflictReview'&&x.personId===N),'a member who may see the holder does');});
 await refuse(RN2);await refuse(RN3);
 check(()=>assert.equal(events('identifierConflictReview').length,3));
 const throttled=await refuse(rnd(12));
 check(()=>{assert.equal(throttled.error,r1_.error,'after three refusals in a day every further link is refused the same way, a free value included');assert.equal(events('identifierConflictReview').length,3,'no further event');assert.equal(JSON.parse(sql.prepare('SELECT data FROM patients WHERE org_id=? AND id=?').get(org,B2).data).identifiers,undefined);});
 // 8. Withdrawal appends: the identifier stops matching and the issuer is open again.
 await get(c,'/api/workspace',200,org);
 const cur=c.state.people.find(p=>p.id===A),curEntry=cur.identifiers.find(i=>i.kind==='correct');
 await post_(c,{type:'identifierWithdraw',personId:A,version:cur.version,entryId:curEntry.id,reason:'Entered on the wrong record'});
 check(()=>{const ids=JSON.parse(sql.prepare('SELECT data FROM patients WHERE org_id=? AND id=?').get(org,A).data).identifiers;assert.equal(ids.length,4);assert.deepEqual([ids[3].kind,ids[3].corrects,ids[3].value],['withdraw',curEntry.id,RA2]);});
 const gone=await search(c,{issuer:'rch',identifier:RA2});check(()=>assert.deepEqual(gone.json.matches,[],'a withdrawn identifier no longer matches'));
 await post_(c,{type:'identifierWithdraw',personId:A,version:c.state.people.find(p=>p.id===A).version,entryId:curEntry.id,reason:'Entered on the wrong record'},404);
 await get(s,'/api/workspace',200,org);
 const freed=await post_(s,link(B,{identifier:RA2,version:s.state.people.find(p=>p.id===B).version}));check(()=>assert.equal(freed.result.linked,true,'a withdrawn value is free for another record'));
 // 9. Replay authority is rechecked.
 await get(r4,'/api/workspace',200,org);
 const key=crypto.randomUUID(),own=await make('Replay'),cmd=link(own,{identifier:rnd(12)});
 const first_=await post_(r4,cmd,200,key);
 sql.prepare("UPDATE memberships SET role='admin' WHERE org_id=? AND user_id=?").run(org,r4.id);
 await post_(r4,cmd,403,key);
 sql.prepare("UPDATE memberships SET role='clinician' WHERE org_id=? AND user_id=?").run(org,r4.id);
 const again=await post_(r4,cmd,200,key);check(()=>{assert.equal(again.replayed,true);assert.equal(again.result.entryId,first_.result.entryId);});
 // 10. Rate limits: no-match searches, then total searches, then the daily no-match limit, each read from the audit chain.
 await get(r1,'/api/workspace',200,org);
 for(let i=0;i<8;i++)await search(r1,{issuer:'rch',identifier:rnd(12)});
 const before=count();
 const limited=await search(r1,{issuer:'rch',identifier:rnd(12)},429);
 check(()=>{assert.match(limited.json.error,/Too many identifier searches/);assert.equal(count(),before,'a refused search records nothing');assert.equal(sql.prepare("SELECT count(*) AS n FROM audit_events WHERE org_id=? AND actor_id=? AND action='identifierSearchMiss'").get(org,r1.id).n,8);});
 await search(r1,{issuer:'rch',identifier:RA},429);
 await get(r2,'/api/workspace',200,org);
 const known=RA2;// withdrawn: held now by B (freed and linked above)
 for(let i=0;i<30;i++){const r=await search(r2,{issuer:'rch',identifier:known});if(i===0)check(()=>assert.deepEqual(r.json.matches.map(m=>m.personId),[B]));}
 await search(r2,{issuer:'rch',identifier:known},429);
 check(()=>{const n=sql.prepare("SELECT count(DISTINCT subject) AS n FROM audit_events WHERE org_id=? AND actor_id=? AND action IN ('identifierSearch','identifierSearchMiss')").get(org,r2.id).n;assert.equal(n,30);});
 // The daily no-match limit, in the account's own organisation, with earlier misses written directly (older than the hour window).
 { const own3=r3.state.organisation.id,at=new Date(Date.now()-2*3600000).toISOString();
   for(let i=0;i<23;i++)sql.prepare('INSERT INTO audit_events (org_id,id,person_id,actor_id,actor_name,role,action,subject,detail,at) VALUES (?,?,?,?,?,?,?,?,?,?)').run(own3,crypto.randomUUID(),null,r3.id,'Synthetic','clinician','identifierSearchMiss',crypto.randomUUID(),'Searched by RCH ID: no record in the searcher\'s care scope matched.',at);
   await search(r3,{issuer:'rch',identifier:rnd(12)},200,{},own3);const day=await search(r3,{issuer:'rch',identifier:rnd(12)},429,{},own3);
   check(()=>assert.match(day.json.error,/24 finding nothing in a day/)); }
}
