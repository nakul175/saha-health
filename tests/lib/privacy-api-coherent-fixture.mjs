import assert from 'node:assert/strict';
// Independent supported organisation/cohort, not a ledger reset or fresh-viewer bypass.
export async function coherentReportingFixture({get,post,check},label,{defaultTeam=false}={}){
 const token=crypto.randomUUID();
 const accounts=Object.fromEntries(['owner','worker','clinician','supervisor','admin','stranger'].map(role=>[role,{id:`privacy-${label}-${token}-${role}`,headers:{'oai-authenticated-user-id':`privacy-${label}-${token}-${role}`,'oai-authenticated-user-email':`${role}@example.invalid`},state:null}]));
 for(const a of Object.values(accounts))await get(a);
 const o=accounts.owner;
 await post(o,{type:'createOrganisation',name:`Coherent ${label} synthetic qualification`});
 const org=o.state.organisation.id;
 check(()=>{assert.equal(o.state.people.length,0);assert.equal(o.state.visits.length,0);});
 await post(o,{type:'createTeam',name:'Coherent reporting team'});
 const teamId=defaultTeam?'default':o.state.teams.find(t=>t.name==='Coherent reporting team').id;
 await post(o,{type:'createTeam',name:'North team'});
 const ownerMember=o.state.members.find(m=>m.userId===o.id);
 await post(o,{type:'updateMember',userId:o.id,version:ownerMember.version,role:'clinician',teamIds:[...new Set(['default',teamId,o.state.teams.find(t=>t.name==='North team').id])],isOwner:true,status:'active',reason:'Explicit synthetic coherent reporting scope'});
 for(let i=0;i<10;i++)await post(o,{type:'createPerson',name:`Synthetic ${crypto.randomUUID()}`,age:30,sex:'Male',village:'Coherent synthetic locality',programme:'General care',teamId});
 for(const role of ['worker','clinician','supervisor','admin']){
  const target=accounts[role],invite=await post(o,{type:'createInvite',accountCode:target.state.user.accountCode,label:`Coherent ${role}`,role:role==='worker'?'asha':role,teamIds:role==='admin'?[]:[teamId]});
  await post(target,{type:'joinOrganisation',token:invite.result.token});
 }
 check(()=>{assert.equal(accounts.supervisor.state.people.length,10);assert.equal(new Set(accounts.supervisor.state.people.map(p=>p.teamId)).size,1);assert.equal(accounts.worker.state.people.length,0);});
 return {accounts,org};
}
