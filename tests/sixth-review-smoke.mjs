import assert from 'node:assert/strict';
// Slice 6z (sixth review, finding 5): through the built Worker and local D1, an ABHA number held by a record outside the
// requester's care scope is refused exactly like a gateway refusal, and the server records the conflict on the holding
// record for an identity steward (nothing on the requester's record, nothing in the response).
export async function sixthReviewSmoke({get,post,check,accounts,org,sql}){
 const {owner:o,worker:w}=accounts;
 const make=async label=>(await post(o,{type:'createPerson',name:`6z ${label} ${crypto.randomUUID().slice(0,6)}`,age:41,sex:'Female',village:'6z synthetic locality',programme:'General care',teamId:'default'})).result.personId;
 const holder=await make('Holder'),mine=await make('Requester record');
 sql.prepare('UPDATE patients SET assigned_to=? WHERE org_id=? AND id=?').run(w.id,org,mine);
 const tail=String(Date.now()).slice(-4),abha=`77-1212-3434-${tail}`,person=id=>o.state.people.find(p=>p.id===id);
 await post(o,{type:'abhaLink',personId:holder,version:person(holder).version,abhaNumber:abha,otp:'123456'});
 await get(w,'/api/workspace',200,org);
 const own=w.state.people.find(p=>p.id===mine);
 check(()=>{assert.ok(own,'the ASHA sees the record assigned to them');assert.equal(w.state.people.some(p=>p.id===holder),false,'the holding record is outside the ASHA scope');});
 const held=await post(w,{type:'abhaLink',personId:mine,version:own.version,abhaNumber:abha,otp:'123456'},422);
 const gateway=await post(w,{type:'abhaLink',personId:mine,version:own.version,abhaNumber:`77-5656-7878-${tail}`,otp:'000000'},422);
 check(()=>{assert.equal(held.error,gateway.error,'same refusal text as a gateway refusal');assert.doesNotMatch(held.error,/another record|linked to/);});
 const events=sql.prepare("SELECT person_id,actor_id,detail FROM audit_events WHERE org_id=? AND action='abhaLinkReview'").all(org);
 check(()=>{const onHolder=events.filter(e=>e.person_id===holder);assert.equal(onHolder.length,1,'one steward review event on the holding record');assert.equal(onHolder[0].actor_id,w.id);assert.ok(onHolder[0].detail.includes(mine));});
 check(()=>assert.equal(events.filter(e=>e.person_id===mine).length,0,'nothing is recorded on the requester record'));
 const activity=await get(w,'/api/workspace',200,org);
 check(()=>assert.equal((activity.audit??[]).some(a=>a.action==='abhaLinkReview'),false,'the requester does not see the steward event'));
}
