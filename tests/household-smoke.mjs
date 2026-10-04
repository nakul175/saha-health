import assert from 'node:assert/strict';
// Slice 1: households and proxy authority through the built Worker and local D1.
export async function householdSmoke({get,post,check,accounts,org,sql,base}){
 const {owner:o,worker:w,supervisor:s,admin:a}=accounts;
 const view=async(who,q,status=200)=>{const r=await fetch(`${base}/api/household?${new URLSearchParams(q)}`,{headers:{...who.headers,'x-saha-organisation':org}});const j=await r.json();check(()=>assert.equal(r.status,status,JSON.stringify(j)));return j;};
 const person=id=>o.state.people.find(p=>p.id===id);
 const make=async(name,age,programme)=>(await post(o,{type:'createPerson',name:`${name} ${crypto.randomUUID().slice(0,6)}`,age,sex:'Unknown',village:'Household synthetic locality',programme,teamId:'default'})).result.personId;
 const head=await make('Household Head',45,'General care'),spouse=await make('Household Spouse',29,'Maternal care'),child=await make('Household Child',6,'Child health');
 const created=await post(o,{type:'householdCreate',personId:head,version:person(head).version,label:'Synthetic household one',relationship:'head'});
 const hid=created.result.householdId;check(()=>assert.equal(person(head).householdId,hid));
 let h=await view(o,{personId:head});check(()=>{assert.equal(h.members.length,1);assert.equal(h.household.version,1);});
 await post(o,{type:'householdAddMember',householdId:hid,version:1,personId:spouse,personVersion:person(spouse).version,relationship:'spouse'});
 await post(o,{type:'householdAddMember',householdId:hid,version:2,personId:child,personVersion:person(child).version,relationship:'child'});
 await post(o,{type:'householdAddMember',householdId:hid,version:3,personId:child,personVersion:person(child).version,relationship:'child'},409);
 await post(o,{type:'householdAddMember',householdId:hid,version:1,personId:head,personVersion:person(head).version,relationship:'head'},409);
 h=await view(o,{personId:head});check(()=>{assert.equal(h.members.length,3);assert.equal(h.outsideScope,0);assert.deepEqual(h.members.find(m=>m.personId===child).sensitive,['child']);assert.ok(h.members.find(m=>m.personId===spouse).sensitive.includes('maternal'));});
 // A maternal follow-up for the spouse carries the maternal class.
 const enrolled=await post(o,{type:'enrolProgramme',personId:spouse,version:person(spouse).version,packId:'maternal',episodeLabel:'Synthetic household pregnancy episode',startDate:null});
 const enrolment=person(spouse).enrolments.find(e=>e.state==='active').id;
 await post(o,{type:'scheduleFollowUp',personId:spouse,version:person(spouse).version,enrolmentId:enrolment,title:'Antenatal check',due:'2026-10-15',ownerId:o.id});
 check(()=>assert.ok(enrolled.result));
 // Without grants, nothing about other members is prepared for the household head.
 let share=await view(o,{personId:head,recipient:head,purpose:'appointments'});
 check(()=>assert.deepEqual(share.shareable.members.map(m=>m.personId),[head]));
 const expires=new Date(Date.now()+30*86400000).toISOString();
 const g1=await post(o,{type:'proxyGrant',personId:spouse,version:person(spouse).version,proxyPersonId:head,relationship:'spouse',authority:'nominated',purposes:['appointments'],classes:[],evidence:'SYNTH-CONSENT-1',expiresAt:expires});
 share=await view(o,{personId:head,recipient:head,purpose:'appointments'});
 check(()=>{const m=share.shareable.members.find(m=>m.personId===spouse);assert.ok(m);assert.ok(m.items.every(i=>i.title!=='Antenatal check'),'maternal item withheld without the maternal class');});
 share=await view(o,{personId:head,recipient:head,purpose:'care-coordination'});
 check(()=>assert.equal(share.shareable.members.some(m=>m.personId===spouse),false,'other purposes are not covered'));
 await post(o,{type:'proxyGrant',personId:spouse,version:person(spouse).version,proxyPersonId:head,relationship:'spouse',authority:'nominated',purposes:['care-coordination'],classes:['maternal'],evidence:'SYNTH-CONSENT-2',expiresAt:expires},409);
 await post(o,{type:'proxyRevoke',personId:spouse,version:person(spouse).version,grantId:g1.result.grantId,reason:'Synthetic withdrawal of proxy'});
 await post(o,{type:'proxyGrant',personId:spouse,version:person(spouse).version,proxyPersonId:head,relationship:'spouse',authority:'nominated',purposes:['appointments'],classes:['maternal'],evidence:'SYNTH-CONSENT-3',expiresAt:expires});
 share=await view(o,{personId:head,recipient:head,purpose:'appointments'});
 check(()=>assert.ok(share.shareable.members.find(m=>m.personId===spouse).items.some(i=>i.title==='Antenatal check')));
 await post(o,{type:'proxyGrant',personId:child,version:person(child).version,proxyPersonId:head,relationship:'parent',authority:'parent-of-minor',purposes:['care-coordination'],classes:['child'],evidence:'SYNTH-GUARDIAN-1',expiresAt:expires});
 share=await view(o,{personId:head,recipient:head,purpose:'care-coordination'});
 check(()=>{assert.ok(share.shareable.members.some(m=>m.personId===child));assert.equal(share.shareable.members.some(m=>m.personId===spouse),false);});
 // Validation.
 await post(o,{type:'proxyGrant',personId:child,version:person(child).version,proxyPersonId:child,relationship:'other',authority:'nominated',purposes:['appointments'],classes:[],evidence:'SYNTH-SELF',expiresAt:expires},422);
 await post(o,{type:'proxyGrant',personId:head,version:person(head).version,proxyPersonId:spouse,relationship:'spouse',authority:'nominated',purposes:['appointments'],classes:[],evidence:'SYNTH-LONG',expiresAt:new Date(Date.now()+400*86400000).toISOString()},422);
 await post(o,{type:'proxyGrant',personId:head,version:person(head).version,proxyPersonId:'person-not-registered',relationship:'other',authority:'nominated',purposes:['appointments'],classes:[],evidence:'SYNTH-MISSING',expiresAt:expires},404);
 await post(a,{type:'householdCreate',personId:head,version:person(head).version,label:'Admin attempt',relationship:'head'},403);
 await post(s,{type:'proxyRevoke',personId:child,version:person(child).version,grantId:'any',reason:'Supervisor attempt'},403);
 await view(a,{personId:head},403);
 await view(o,{personId:head,recipient:'not-a-member',purpose:'appointments'},404);
 await view(o,{personId:head,purpose:'marketing'},422);
 // Membership grants no staff access: an ASHA assigned only the head sees the head, and a count.
 await post(o,{type:'assignPatient',personId:head,version:person(head).version,teamId:'default',assignedTo:w.id,reason:'Household scope synthetic assignment'});
 await get(w,'/api/workspace',200,org);
 const wv=await view(w,{personId:head});
 check(()=>{assert.deepEqual(wv.members.map(m=>m.personId),[head]);assert.equal(wv.outsideScope,2);});
 await view(w,{personId:spouse},403);
 await post(w,{type:'householdAddMember',householdId:hid,version:3,personId:spouse,personVersion:person(spouse).version,relationship:'spouse'},403);
 // Ending a membership removes the person from the household view and from sharing.
 await get(o,'/api/workspace',200,org);
 await post(o,{type:'householdEndMember',householdId:hid,version:3,personId:child,personVersion:person(child).version,reason:'Synthetic move to another household'});
 h=await view(o,{personId:spouse});
 check(()=>{assert.equal(h.members.some(m=>m.personId===child),false);assert.equal(person(child).householdId,undefined);});
 check(()=>assert.ok(sql.prepare("SELECT count(*) AS n FROM audit_events WHERE org_id=? AND action IN ('householdCreate','householdAddMember','householdEndMember','proxyGrant','proxyRevoke')").get(org).n>=7));
 check(()=>assert.ok(sql.prepare("SELECT count(*) AS n FROM record_revisions WHERE org_id=? AND entity_id=? AND data LIKE '%proxies%'").get(org,spouse).n>=3));
}
