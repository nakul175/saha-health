import assert from 'node:assert/strict';
// Slice 6ab (eighth review, finding 2): through the built Worker and local D1, the identity steward event for an ABHA held
// outside the requester's scope is written once per requester and holding record a day, and once a requester has
// ABHA_REVIEW_LIMIT (3) such refusals in a day every further link by them is refused the same way, even for a number no
// record holds and with the mock code. Runs last: it leaves the synthetic worker throttled for ABHA links.
export async function eighthReviewSmoke({get,post,check,accounts,org,sql}){
 const {owner:o,worker:w}=accounts;
 const make=async label=>(await post(o,{type:'createPerson',name:`6ab ${label} ${crypto.randomUUID().slice(0,6)}`,age:39,sex:'Female',village:'6ab synthetic locality',programme:'General care',teamId:'default'})).result.personId;
 const person=id=>o.state.people.find(p=>p.id===id),tail=String(Date.now()).slice(-4),numbers=[1,2,3,4].map(k=>`8${k}-2424-3535-${tail}`);
 const holders=[];for(const k of [0,1,2]){const h=await make('Holder '+k);await post(o,{type:'abhaLink',personId:h,version:person(h).version,abhaNumber:numbers[k],otp:'123456'});holders.push(h);}
 const mine=await make('Requester record');sql.prepare('UPDATE patients SET assigned_to=? WHERE org_id=? AND id=?').run(w.id,org,mine);
 await get(w,'/api/workspace',200,org);const own=()=>w.state.people.find(p=>p.id===mine);
 const link=(n)=>post(w,{type:'abhaLink',personId:mine,version:own().version,abhaNumber:n,otp:'123456'},422);
 const events=()=>sql.prepare("SELECT person_id FROM audit_events WHERE org_id=? AND action='abhaLinkReview' AND actor_id=?").all(org,w.id);
 const first=await link(numbers[0]),again=await link(numbers[0]);
 check(()=>{assert.equal(first.error,again.error);assert.equal(events().filter(e=>e.person_id===holders[0]).length,1,'a repeated refusal is not recorded again');});
 await link(numbers[1]);await link(numbers[2]);
 check(()=>assert.ok(new Set(events().map(e=>e.person_id)).size>=3,'three holding records reviewed for this requester'));
 const before=events().length,throttled=await link(numbers[3]);await get(w,'/api/workspace',200,org);
 check(()=>{assert.equal(throttled.error,first.error,'a number no record holds is refused the same way once the limit is reached');assert.notEqual(own().abha?.state,'linked','nothing was linked');assert.equal(events().length,before,'a throttled refusal writes no review event');});
 // Control: the owner (whose scope includes the record) can still link that number.
 await get(o,'/api/workspace',200,org);await post(o,{type:'abhaLink',personId:mine,version:person(mine).version,abhaNumber:numbers[3],otp:'123456'});
 check(()=>assert.equal(person(mine).abha?.state,'linked','control: the same number links for a requester who is not throttled'));
}
