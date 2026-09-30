import assert from 'node:assert/strict';
// Slice 1d: roster preview and apply through the built Worker and local D1.
export async function rosterSmoke({get,post,check,accounts,org,base}){
 const {owner:o,worker:w,supervisor:s,clinician:c}=accounts;
 const synthetic=label=>{const id=`r1-${crypto.randomUUID()}-${label}`;return {id,headers:{'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${label}@example.invalid`},state:null};};
 const joiner=synthetic('roster-new'),leaver=synthetic('roster-leaver');
 await get(joiner);await get(leaver);
 const inv=await post(o,{type:'createInvite',accountCode:leaver.state.user.accountCode,label:'Roster leaver',role:'asha',teamIds:['default']});await post(leaver,{type:'joinOrganisation',token:inv.result.token});
 await get(o,'/api/workspace',200,org);
 const north=o.state.teams.find(t=>t.name==='North team').id;
 const preview=async(who,body,status=200)=>{const r=await fetch(`${base}/api/roster`,{method:'POST',headers:{...who.headers,'Content-Type':'application/json','x-saha-organisation':org},body:JSON.stringify(body)});const j=await r.json();check(()=>assert.equal(r.status,status,JSON.stringify(j).slice(0,300)));return j;};
 const code=who=>o.state.members.find(m=>m.userId===who.id)?.accountCode??who.state.user.accountCode;
 const rows=[{accountCode:code(w),name:'Worker',role:'asha',teams:['default'],status:'active'},{accountCode:code(c),name:'Clinician',role:'clinician',teams:['default','North team'],status:'active'},{accountCode:joiner.state.user.accountCode,name:'Roster joiner',role:'asha',teams:['default'],status:'active'},{accountCode:code(leaver),name:'Roster leaver',role:'asha',teams:['default'],status:'left'}];
 await preview(s,{rows,complete:false},403);
 await preview(o,{rows:[{...rows[0],role:'nurse'}],complete:false},422);
 await preview(o,{rows:Array.from({length:101},()=>rows[0]),complete:false},422);
 const bad=await preview(o,{rows:[{...rows[0],teams:['Nowhere team']}],complete:false});check(()=>assert.equal(bad.errors.length,1));
 const p=await preview(o,{rows,complete:false});
 check(()=>{assert.deepEqual(p.errors,[]);assert.deepEqual([p.counts.invite,p.counts.update,p.counts.suspend],[1,1,1]);assert.equal(p.actions.find(a=>a.accountCode===code(w)).action,'none');});
 const cmd={type:'rosterApply',rows,complete:false,previewHash:p.hash,reason:'Synthetic district roster for the test'};
 await post(s,cmd,403);
 await post(o,{...cmd,previewHash:'0'.repeat(64)},409);
 const applied=await post(o,cmd);
 check(()=>{assert.equal(applied.result.invitations.length,1);assert.equal(applied.result.counts.suspend,1);});
 await post(joiner,{type:'joinOrganisation',token:applied.result.invitations[0].token});
 await get(joiner,'/api/workspace',200,org);check(()=>assert.equal(joiner.state.membership.role,'asha'));
 await get(leaver,'/api/workspace',403,org);
 await get(o,'/api/workspace',200,org);
 check(()=>{const m=o.state.members.find(x=>x.userId===c.id);assert.deepEqual([...m.teamIds].sort(),['default',north].sort());assert.equal(o.state.members.find(x=>x.userId===leaver.id).status,'suspended');});
 await post(o,cmd,409);
 const again=await preview(o,{rows,complete:false});check(()=>assert.deepEqual([again.counts.invite,again.counts.update,again.counts.suspend],[0,0,0]));
}
