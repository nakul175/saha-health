import assert from 'node:assert/strict';
// Slice 10j: the language a member chooses for the workspace (English or draft Hindi), through the built Worker and local D1.
// setMyLanguage applies only to the signed-in account: version-checked, audited, per organisation, never another member's
// choice, and it never changes the sign-in identity, the membership version, role, teams or display name.
export async function languageSmoke({get,post,check,accounts,org,sql}){
 const {owner:o}=accounts;
 const synthetic=label=>{const id=`r1-${crypto.randomUUID()}-${label}`;return {id,headers:{'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.invalid`},state:null};};
 const asha=synthetic('hindi-asha');
 await get(asha);const home=asha.state.organisation.id;
 const inv=await post(o,{type:'createInvite',accountCode:asha.state.user.accountCode,label:'Meera Devi',role:'asha',teamIds:['default']});
 await post(asha,{type:'joinOrganisation',token:inv.result.token});
 await get(asha,'/api/workspace',200,org);
 // Default: English, version 0, in this organisation and in the ASHA's home organisation.
 const before=asha.state.membership;
 check(()=>{assert.equal(before.language,'en');assert.equal(before.languageVersion,0);assert.equal(before.role,'asha');});
 // Refusals: an unknown language, another member's field, a missing or malformed version, a wrong version, no change.
 await post(asha,{type:'setMyLanguage',language:'fr',version:0},422);
 await post(asha,{type:'setMyLanguage',language:'HI',version:0},422);
 await post(asha,{type:'setMyLanguage',language:'hi'},422);
 await post(asha,{type:'setMyLanguage',language:'hi',version:-1},422);
 await post(asha,{type:'setMyLanguage',language:'hi',version:0.5},422);
 await post(asha,{type:'setMyLanguage',language:'hi',version:'0'},422);
 await post(asha,{type:'setMyLanguage',language:'hi',version:0,userId:o.id},422);
 await post(asha,{type:'setMyLanguage',language:'hi',version:0,memberId:o.id},422);
 await post(asha,{type:'setMyLanguage',language:'hi',version:1},409);
 await post(asha,{type:'setMyLanguage',language:'en',version:0},422);
 await get(asha,'/api/workspace',200,org);
 check(()=>{assert.equal(asha.state.membership.language,'en');assert.equal(asha.state.membership.languageVersion,0);});
 // Set Hindi, with an idempotency key; a replay returns the same result and does not bump the version again.
 const key=crypto.randomUUID();
 const set=await post(asha,{type:'setMyLanguage',language:'hi',version:0},200,key);
 check(()=>assert.deepEqual(set.result,{language:'hi',version:1}));
 const replay=await post(asha,{type:'setMyLanguage',language:'hi',version:0},200,key);
 check(()=>assert.deepEqual(replay.result,set.result));
 await post(asha,{type:'setMyLanguage',language:'hi',version:1},422);
 await post(asha,{type:'setMyLanguage',language:'en',version:0},409);
 await get(asha,'/api/workspace',200,org);
 check(()=>{const m=asha.state.membership;assert.equal(m.language,'hi');assert.equal(m.languageVersion,1);assert.equal(m.role,'asha');assert.equal(m.version,before.version,'the membership version is unchanged');assert.deepEqual(m.teamIds,before.teamIds);assert.equal(m.displayName,before.displayName);assert.equal(m.accountName,before.accountName);});
 // The choice is this member's own: the owner sees no language for the ASHA and keeps English.
 await get(o,'/api/workspace',200,org);
 check(()=>{const m=o.state.members.find(x=>x.userId===asha.id);assert.ok(m,'the ASHA is listed');assert.equal(Object.hasOwn(m,'language'),false,'the members list does not carry a language');assert.equal(Object.hasOwn(m,'languageVersion'),false);assert.equal(m.version,before.version);assert.equal(o.state.membership.language,'en');assert.equal(o.state.membership.languageVersion,0);});
 check(()=>assert.equal(JSON.stringify(o.state).includes('memberLanguages'),false,'the stored map is not sent to the browser'));
 // It belongs to this organisation only: the ASHA's home organisation still shows English.
 await get(asha,'/api/workspace',200,home);
 check(()=>{assert.equal(asha.state.membership.language,'en');assert.equal(asha.state.membership.languageVersion,0);});
 await get(asha,'/api/workspace',200,org);
 check(()=>assert.equal(asha.state.membership.language,'hi'));
 // The owner chooses independently, at their own version, and the ASHA is untouched.
 const ownerSet=await post(o,{type:'setMyLanguage',language:'hi',version:0},200,crypto.randomUUID(),org);
 check(()=>assert.deepEqual(ownerSet.result,{language:'hi',version:1}));
 await get(asha,'/api/workspace',200,org);
 check(()=>assert.equal(asha.state.membership.languageVersion,1));
 const ownerBack=await post(o,{type:'setMyLanguage',language:'en',version:1},200,crypto.randomUUID(),org);
 check(()=>assert.deepEqual(ownerBack.result,{language:'en',version:2}));
 // Back to English: version 2.
 const back=await post(asha,{type:'setMyLanguage',language:'en',version:1});
 check(()=>assert.deepEqual(back.result,{language:'en',version:2}));
 await get(asha,'/api/workspace',200,org);
 check(()=>{assert.equal(asha.state.membership.language,'en');assert.equal(asha.state.membership.languageVersion,2);});
 // Audit: one organisation-level event per change, under the sign-in identity, naming the draft status of the Hindi text.
 check(()=>{const rows=sql.prepare("SELECT actor_id,subject,person_id,detail FROM audit_events WHERE org_id=? AND action='setMyLanguage' AND actor_id=? ORDER BY at").all(org,asha.id);assert.equal(rows.length,2);assert.equal(rows[0].subject,asha.id);assert.equal(rows[0].person_id,null);assert.match(rows[0].detail,/changed from English to Hindi \(draft translation, not reviewed by a qualified translator\)\. Sign-in identity and access unchanged\./);assert.match(rows[1].detail,/changed from Hindi to English\. Sign-in identity and access unchanged\./);});
 check(()=>assert.ok(o.state.audit.some(a=>a.action==='setMyLanguage'&&a.actorId===asha.id)));
 check(()=>assert.equal(sql.prepare("SELECT COUNT(*) AS n FROM audit_events WHERE org_id=? AND action='setMyLanguage' AND actor_id=?").get(org,o.id).n,2,'the owner has their own two events'));
 // The refused attempts left no event: two events for the ASHA and two for the owner.
 check(()=>assert.equal(sql.prepare("SELECT COUNT(*) AS n FROM audit_events WHERE org_id=? AND action='setMyLanguage'").get(org).n,4));
}
