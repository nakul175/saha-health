import assert from 'node:assert/strict';
// Slice 9b: the name an organisation shows for a member, through the built Worker and local D1. An email-only sign-in shows
// the invitation label; a sign-in with a real name keeps it. setMyDisplayName applies only to the signed-in account: 1 to 80
// characters after trimming, no control characters, version-checked, audited, per organisation, and it never changes
// another member, the sign-in identity, the membership version, role or teams.
export async function memberNamesSmoke({get,post,check,accounts,org,sql}){
 const {owner:o,worker:w}=accounts;
 const synthetic=label=>{const id=`r1-${crypto.randomUUID()}-${label}`;return {id,headers:{'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.invalid`},state:null};};
 const asha=synthetic('named-asha'),email=`${asha.id}@example.invalid`;
 await get(asha);const home=asha.state.organisation.id;
 check(()=>assert.equal(asha.state.user.displayName,email));
 const inv=await post(o,{type:'createInvite',accountCode:asha.state.user.accountCode,label:'Sunita Yadav',role:'asha',teamIds:['default']});
 await post(asha,{type:'joinOrganisation',token:inv.result.token});
 await get(asha,'/api/workspace',200,org);
 check(()=>{const m=asha.state.membership;assert.equal(m.displayName,'Sunita Yadav');assert.equal(m.accountName,email);assert.equal(m.nameSource,'invitation');assert.equal(m.nameVersion,0);assert.equal(asha.state.user.displayName,email);});
 await get(o,'/api/workspace',200,org);
 const before=o.state.members.find(x=>x.userId===asha.id);
 check(()=>{assert.equal(before.displayName,'Sunita Yadav');assert.equal(before.accountName,email);const wm=o.state.members.find(x=>x.userId===w.id);assert.equal(wm.displayName,'Same test name');assert.equal(wm.nameSource,'account');});
 // Refusals: blank, too long, control characters, a member field, a wrong version.
 await post(asha,{type:'setMyDisplayName',name:'   ',version:0},422);
 await post(asha,{type:'setMyDisplayName',name:'x'.repeat(81),version:0},422);
 await post(asha,{type:'setMyDisplayName',name:'Sunita\u0007Yadav',version:0},422);
 await post(asha,{type:'setMyDisplayName',name:'Sunita‮Yadav',version:0},422);
 await post(asha,{type:'setMyDisplayName',name:'Owner renamed',version:0,userId:o.id},422);
 await post(asha,{type:'setMyDisplayName',name:'Sunita Y.',version:1},409);
 const key=crypto.randomUUID();
 const set=await post(asha,{type:'setMyDisplayName',name:'  Sunita Y.  ',version:0},200,key);
 check(()=>assert.deepEqual(set.result,{name:'Sunita Y.',version:1}));
 const replay=await post(asha,{type:'setMyDisplayName',name:'  Sunita Y.  ',version:0},200,key);
 check(()=>assert.deepEqual(replay.result,set.result));
 await post(asha,{type:'setMyDisplayName',name:'Sunita Y.',version:1},422);
 await post(asha,{type:'setMyDisplayName',name:'Sunita Again',version:0},409);
 await get(asha,'/api/workspace',200,org);
 check(()=>{const m=asha.state.membership;assert.equal(m.displayName,'Sunita Y.');assert.equal(m.nameSource,'self');assert.equal(m.nameVersion,1);assert.equal(m.accountName,email);assert.equal(m.version,before.version);assert.equal(m.role,'asha');assert.deepEqual(m.teamIds,before.teamIds);});
 const eighty='S'.repeat(80);
 await post(asha,{type:'setMyDisplayName',name:eighty,version:1});
 await get(o,'/api/workspace',200,org);
 check(()=>{assert.equal(o.state.members.find(x=>x.userId===asha.id).displayName,eighty);assert.equal(o.state.membership.displayName,'Same test name');assert.equal(o.state.members.find(x=>x.userId===w.id).displayName,'Same test name');});
 // Audit: one organisation-level event per change, recorded under the sign-in identity; the account name is unchanged.
 check(()=>{const rows=sql.prepare("SELECT actor_id,actor_name,subject,person_id,detail FROM audit_events WHERE org_id=? AND action='setMyDisplayName' AND actor_id=? ORDER BY at").all(org,asha.id);assert.equal(rows.length,2);assert.equal(rows[0].actor_name,email);assert.equal(rows[0].subject,asha.id);assert.equal(rows[0].person_id,null);assert.match(rows[0].detail,/from "Sunita Yadav" to "Sunita Y\."\. Sign-in identity and access unchanged\./);});
 check(()=>assert.equal(sql.prepare('SELECT display_name FROM accounts WHERE user_id=?').get(asha.id).display_name,email));
 check(()=>assert.ok(o.state.audit.some(a=>a.action==='setMyDisplayName'&&a.actorId===asha.id)));
 // The name belongs to this organisation only: the ASHA's home organisation still shows the sign-in name.
 await get(asha,'/api/workspace',200,home);
 check(()=>{assert.equal(asha.state.membership.displayName,email);assert.equal(asha.state.membership.nameSource,'account');});
 // Another member has an independent version; the owner's change does not touch the ASHA.
 const ownerSet=await post(o,{type:'setMyDisplayName',name:'Dr Test Owner',version:0},200,crypto.randomUUID(),org);
 check(()=>assert.equal(ownerSet.result.version,1));
 await get(o,'/api/workspace',200,org);
 check(()=>{assert.equal(o.state.membership.displayName,'Dr Test Owner');assert.equal(o.state.members.find(x=>x.userId===asha.id).displayName,eighty);});
 // Restore the owner's sign-in name for later suites that compare names.
 await post(o,{type:'setMyDisplayName',name:'Same test name',version:1},200,crypto.randomUUID(),org);
 await get(o,'/api/workspace',200,org);
}
