import assert from 'node:assert/strict';
// Slice 9a: demonstration clinical package over HTTP and local D1. The suite runs with SAHA_DEMONSTRATION_PACKAGE=manual
// (tests/run-api-smoke.mjs), so a new home organisation starts without the package and the owner installs it with the
// command; automatic installation through the real store is covered by tests/demonstration-contract.mjs and the
// browser check. Separate synthetic accounts keep the shared test organisation's empty governance register intact.
export async function demonstrationSmoke({get,post,check,sql,base}){
 const run=crypto.randomUUID().slice(0,8),account=label=>({id:`demo-${run}-${label}`,headers:{'oai-authenticated-user-id':`demo-${run}-${label}`,'oai-authenticated-user-email':`${label}@example.invalid`,'oai-authenticated-user-full-name':`Demo%20${label}`,'oai-authenticated-user-full-name-encoding':'percent-encoded-utf-8'},state:null});
 const o=account('owner'),asha=account('asha'),clin=account('clinician');for(const a of [o,asha,clin])await get(a);const org=o.state.organisation.id;
 let g=await get(o,'/api/governance',200,org);check(()=>assert.equal(g.entries.length,0,'manual mode: a new home organisation starts without the package'));
 for(const [who,role] of [[asha,'asha'],[clin,'clinician']]){const inv=(await post(o,{type:'createInvite',accountCode:who.state.user.accountCode,label:`Demo ${role}`,role,teamIds:['default']},200,undefined,org)).result;await post(who,{type:'joinOrganisation',token:inv.token});}
 // Owner only.
 await post(clin,{type:'installDemonstrationPackage'},403,undefined,org);await post(asha,{type:'installDemonstrationPackage'},403,undefined,org);
 await post(o,{type:'installDemonstrationPackage',extra:true},422,undefined,org);
 g=await get(o,'/api/governance',200,org);check(()=>assert.equal(g.entries.length,0,'refused commands install nothing'));
 const key=crypto.randomUUID(),installed=await post(o,{type:'installDemonstrationPackage'},200,key,org);
 check(()=>{assert.equal(installed.result.installed,true);assert.equal(installed.result.entries.protocols.length,2);assert.equal(installed.result.entries.services.length,3);assert.equal(installed.result.entries.sources.length,2);});
 const replay=await post(o,{type:'installDemonstrationPackage'},200,key,org);check(()=>{assert.equal(replay.replayed,true);assert.deepEqual(replay.result,installed.result);});
 await post(o,{type:'installDemonstrationPackage'},409,undefined,org);
 g=await get(o,'/api/governance',200,org);
 const [author,reviewer]=installed.result.fixtures;
 check(()=>{assert.equal(g.entries.length,7);for(const e of g.entries){assert.equal(e.state,'active',e.spec.title);assert.equal(e.usable,true,e.spec.title);assert.deepEqual(e.issues,[],e.spec.title);assert.equal(e.createdBy,author);assert.equal(e.review.by,reviewer);assert.notEqual(e.createdBy,e.review.by);assert.equal(e.spec.ownerId,author);}
  assert.deepEqual(g.entries.filter(e=>e.spec.kind==='protocol').map(e=>e.spec.title),['Antenatal blood pressure (demonstration, not clinically approved)','Presumptive TB: cough duration (demonstration, not clinically approved)']);});
 check(()=>{const fx=o.state.members.filter(m=>m.userId.startsWith('fixture:'));assert.deepEqual(fx.map(m=>m.displayName).sort(),['Demonstration clinician — author (synthetic)','Demonstration clinician — reviewer (synthetic)']);assert.ok(fx.every(m=>m.role==='clinician'&&m.status==='active'&&m.teamIds.includes('default')&&/^[A-F0-9]{24}$/.test(m.accountCode)));});
 check(()=>{const rows=sql.prepare("SELECT user_id,email FROM accounts WHERE user_id LIKE ? ORDER BY user_id").all(`fixture:${org}:%`);assert.equal(rows.length,2);assert.ok(rows.every(r=>r.email.endsWith('@demonstration-fixture.invalid')));assert.equal(sql.prepare('SELECT count(*) AS n FROM team_members WHERE org_id=? AND user_id LIKE ?').get(org,'fixture:%').n,2);assert.deepEqual(sql.prepare('PRAGMA foreign_key_check(memberships)').all(),[]);assert.deepEqual(sql.prepare('PRAGMA foreign_key_check(team_members)').all(),[]);});
 check(()=>{const a=o.state.audit.find(x=>x.action==='installDemonstrationPackage');assert.ok(a);assert.match(a.detail,/Not clinically approved/);});
 // Fixture clinicians cannot sign in and cannot be edited as members.
 await get({headers:{'oai-authenticated-user-id':author,'oai-authenticated-user-email':'author@example.invalid'}},'/api/workspace',401);
 await post(o,{type:'updateMember',userId:author,version:1,role:'clinician',teamIds:['default'],isOwner:true,status:'active',reason:'Attempt to make a fixture an owner'},409,undefined,org);
 // The danger sign as the assigned ASHA sees it, and the referral it routes to.
 const person=(who,id)=>who.state.people.find(p=>p.id===id);
 for(const id of ['p_meena','p_sunita'])await post(o,{type:'assignPatient',personId:id,version:person(o,id).version,teamId:'default',assignedTo:asha.id,reason:'Demonstration assignment to the ASHA'},200,undefined,org);
 await get(asha,'/api/workspace',200,org);
 const facts=extra=>({date:new Date(Date.now()-60000).toISOString().slice(0,16),systolic:'',diastolic:'',weight:'',temperature:'',weeks:'',coughDays:'',notes:'Synthetic demonstration visit.',source:'measured',...extra});
 const visit=async(personId,extra)=>{const vid=(await post(asha,{type:'startVisit',personId},200,undefined,org)).result.visitId;await post(asha,{type:'saveVisit',visitId:vid,version:asha.state.visits.find(v=>v.id===vid).version,facts:facts(extra)},200,undefined,org);return vid;};
 const bpVisit=await visit('p_meena',{systolic:'150',diastolic:'112'});
 const bp=await get(asha,`/api/governance?visitId=${bpVisit}`,200,org);
 check(()=>{assert.equal(bp.preview.protocols.length,1);const urgent=bp.preview.findings.filter(f=>f.urgency==='urgent_review');assert.equal(urgent.length,1);assert.equal(urgent[0].service.title,'Kheda CHC / First Referral Unit (synthetic)');assert.match(urgent[0].action,/danger sign/);assert.equal(bp.preview.findings.length,3);assert.deepEqual(bp.preview.unknowns,[]);});
 const chc=bp.services.find(s=>s.spec.title==='Kheda CHC / First Referral Unit (synthetic)');check(()=>{assert.ok(chc);assert.equal(bp.services.length,3);});
 await post(asha,{type:'checkProtocol',visitId:bpVisit,version:asha.state.visits.find(v=>v.id===bpVisit).version},200,undefined,org);
 await post(asha,{type:'confirmVisit',visitId:bpVisit,version:asha.state.visits.find(v=>v.id===bpVisit).version},200,undefined,org);
 const referral=(await post(asha,{type:'createDirectoryReferral',visitId:bpVisit,version:asha.state.visits.find(v=>v.id===bpVisit).version,serviceId:chc.id,serviceVersion:chc.version,reason:'Diastolic BP 112 mmHg in pregnancy: danger sign, refer to the CHC/FRU.'},200,undefined,org)).result.referralId;
 check(()=>{const r=asha.state.referrals.find(x=>x.id===referral);assert.equal(r.facility,'Kheda CHC / First Referral Unit (synthetic)');assert.equal(r.state,'draft');assert.equal(r.directory.entryId,chc.id);});
 const tbVisit=await visit('p_sunita',{coughDays:'16'}),tb=await get(asha,`/api/governance?visitId=${tbVisit}`,200,org);
 check(()=>{assert.equal(tb.preview.findings.length,1);assert.equal(tb.preview.findings[0].service.title,'Kheda TB testing centre (synthetic)');assert.match(tb.preview.findings[0].action,/presumptive TB/);});
 const normalVisit=await visit('p_meena',{systolic:'120',diastolic:'80'}),normal=await get(asha,`/api/governance?visitId=${normalVisit}`,200,org);
 check(()=>{assert.equal(normal.preview.protocols.length,1);assert.deepEqual(normal.preview.findings,[]);});
 // Roster sync leaves the fixture clinicians alone, even for a complete roster that omits them.
 const roster=await fetch(`${base}/api/roster`,{method:'POST',headers:{...o.headers,'Content-Type':'application/json','x-saha-organisation':org},body:JSON.stringify({rows:[{accountCode:asha.state.user.accountCode,name:'Demo ASHA',role:'asha',teams:['default'],status:'active'},{accountCode:clin.state.user.accountCode,name:'Demo clinician',role:'clinician',teams:['default'],status:'active'}],complete:true})}),diff=await roster.json();
 check(()=>{assert.equal(roster.status,200,JSON.stringify(diff).slice(0,300));assert.equal(diff.actions.some(a=>a.userId?.startsWith('fixture:')),false);assert.equal(diff.counts.suspend,0);});
}
