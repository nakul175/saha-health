import assert from 'node:assert/strict';
// Slice 12a: the owner setting for voice input's browser speech service, through the built Worker and local D1.
// Only an active owner may change it; it is version-checked, needs a reason, is audited, and every member's workspace
// carries it (the microphone needs it on every screen). The local Worker runs the synthetic environment, so allowing it is
// accepted here; the refusal outside the synthetic and training environments is covered by tests/speech-contract.mjs.
export async function speechSmoke({get,post,check,accounts,org,sql}){
 const {owner:o,worker:w,supervisor:s,admin:a}=accounts,reason='Practice sessions on phones need voice input';
 await get(o,'/api/workspace',200,org);
 check(()=>{assert.equal(o.state.environment,'synthetic');assert.deepEqual(o.state.speechPolicy,{cloudAllowed:false,version:0});});
 await get(w,'/api/workspace',200,org);
 check(()=>assert.deepEqual(w.state.speechPolicy,{cloudAllowed:false,version:0},'every member sees the setting, off by default'));
 // Only an owner; the schema is strict and the reason has at least 10 characters.
 for(const who of [s,a])await get(who,'/api/workspace',200,org);
 for(const who of [w,s,a])await post(who,{type:'setSpeechPolicy',cloudAllowed:true,version:0,reason},403);
 await post(o,{type:'setSpeechPolicy',cloudAllowed:true,version:0,reason:'too short'},422);
 await post(o,{type:'setSpeechPolicy',cloudAllowed:true,reason},422);
 await post(o,{type:'setSpeechPolicy',cloudAllowed:'true',version:0,reason},422);
 await post(o,{type:'setSpeechPolicy',cloudAllowed:true,version:0,reason,organisationId:'another'},422);
 await post(o,{type:'setSpeechPolicy',cloudAllowed:true,version:3,reason},409);
 await post(o,{type:'setSpeechPolicy',cloudAllowed:false,version:0,reason},409);
 await get(w,'/api/workspace',200,org);
 check(()=>assert.deepEqual(w.state.speechPolicy,{cloudAllowed:false,version:0},'refusals change nothing'));
 // Allow, then turn off: each change is a new version, audited with its reason, and seen by the ASHA.
 const on=await post(o,{type:'setSpeechPolicy',cloudAllowed:true,version:0,reason});
 check(()=>assert.deepEqual(on.result,{cloudAllowed:true,version:1}));
 await get(w,'/api/workspace',200,org);
 check(()=>assert.deepEqual(w.state.speechPolicy,{cloudAllowed:true,version:1}));
 await get(o,'/api/workspace',200,org);
 check(()=>{const e=o.state.audit.find(x=>x.action==='setSpeechPolicy');assert.ok(e,'audited');assert.match(e.detail,/browser speech service is allowed.*setting version 1.*Practice sessions on phones/);});
 const off=await post(o,{type:'setSpeechPolicy',cloudAllowed:false,version:1,reason:'Back to on-device speech after the session'});
 check(()=>assert.deepEqual(off.result,{cloudAllowed:false,version:2}));
 check(()=>{const rows=sql.prepare("SELECT actor_id,subject,detail FROM audit_events WHERE org_id=? AND action='setSpeechPolicy' ORDER BY at").all(org);assert.equal(rows.length,2);assert.deepEqual(rows.map(r=>[r.actor_id,r.subject]),[[o.id,org],[o.id,org]]);assert.match(rows[1].detail,/off \(on-device speech only\).*setting version 2/);});
 await get(w,'/api/workspace',200,org);
 check(()=>assert.deepEqual(w.state.speechPolicy,{cloudAllowed:false,version:2},'left off for the suites that follow'));
}
