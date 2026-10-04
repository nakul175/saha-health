import assert from 'node:assert/strict';
// Slice 14b: proxy authority (R12: BR-ID-07, BR-SEC-04, BR-SEC-02) through the built Worker and local D1. Grants name a typed
// relationship, an authority and a period; consent decisions and rights requests made by a representative are checked on the
// server at the time of the act and name the representative's authority; capacity records; one audit event per use.
export async function proxyAuthoritySmoke({get,post,check,accounts,org,sql,base}){
 const {owner:o,worker:w,supervisor:s,admin:a}=accounts;
 await get(o,'/api/workspace',200,org);
 const person=id=>o.state.people.find(p=>p.id===id),tag=crypto.randomUUID().slice(0,6),day=86400000,iso=ms=>new Date(Date.now()+ms).toISOString();
 const make=async(name,age)=>(await post(o,{type:'createPerson',name:`${name} ${tag}`,age,sex:'Unknown',village:'Proxy synthetic locality',programme:'General care',teamId:'default'})).result.personId;
 const S=await make('Proxy Subject',52),R=await make('Proxy Sibling',48),K=await make('Proxy Child',9),T=await make('Proxy Teen',15),U=await make('Proxy Guardian',40);
 const hh=(await post(o,{type:'householdCreate',personId:S,version:person(S).version,label:'Proxy synthetic household',relationship:'head'})).result.householdId;
 let hv=1;for(const [id,rel] of [[R,'sibling'],[K,'child'],[T,'grandchild']])await post(o,{type:'householdAddMember',householdId:hh,version:hv++,personId:id,personVersion:person(id).version,relationship:rel});
 const grant=(over={})=>({type:'proxyGrant',personId:S,version:person(S).version,proxyPersonId:R,relationship:'sibling',authority:'nominated',purposes:['consent-decisions','rights-requests','appointments'],classes:[],evidence:'SYNTH-NOMINATION-14B',expiresAt:iso(60*day),...over});
 const uses=()=>sql.prepare("SELECT count(*) AS n FROM audit_events WHERE org_id=? AND person_id=? AND action='proxyUse'").get(org,S).n;

 // Grant validation: schema, role, scope, version, dates, authority and representative age.
 const {authority,...noAuthority}=grant();
 await post(o,noAuthority,422);
 await post(o,grant({relationship:'head'}),422);
 await post(o,grant({purposes:['marketing']}),422);
 await post(s,grant(),403);await post(a,grant(),403);await post(w,grant(),403);
 await post(o,grant({version:person(S).version+5}),409);
 await post(o,grant({startsAt:iso(-3*day)}),422);
 await post(o,grant({startsAt:iso(100*day),expiresAt:iso(120*day)}),422);
 await post(o,grant({authority:'parent-of-minor',relationship:'parent'}),422);
 await post(o,grant({authority:'capacity-representative'}),422);
 await post(o,grant({proxyPersonId:T}),422);
 check(()=>assert.equal((person(S).proxies??[]).length,0,'refused grants record nothing'));
 const g1=(await post(o,grant())).result.grantId;
 const gTeen=(await post(o,grant({proxyPersonId:T,relationship:'other-relative',purposes:['appointments']}))).result.grantId;
 await post(o,grant(),409);
 const renewal=(await post(o,grant({startsAt:iso(60*day+60000),expiresAt:iso(200*day)}))).result.grantId;
 check(()=>{const g=person(S).proxies.find(x=>x.id===g1);assert.equal(g.authority,'nominated');assert.equal(g.relationship,'sibling');assert.ok(person(S).proxies.find(x=>x.id===renewal).from>g.expiresAt);});

 // Consent by a representative: checked at the time of the act, recorded on the event, one audit event per use.
 const give=(over={})=>({type:'setConsent',personId:S,purpose:'exchange',active:true,version:person(S).version,...over});
 await post(o,give({representative:{grantId:gTeen,proxyPersonId:T}}),422);
 await post(o,give({representative:{grantId:g1,proxyPersonId:T}}),422);
 await post(o,give({representative:{grantId:renewal,proxyPersonId:R}}),422);
 await post(o,give({representative:{grantId:'not-a-grant',proxyPersonId:R}}),422);
 await post(o,give({representative:{grantId:g1,proxyPersonId:R,extra:1}}),422);
 await post(w,give({representative:{grantId:g1,proxyPersonId:R}}),403);
 await post(a,give({representative:{grantId:g1,proxyPersonId:R}}),403);
 check(()=>assert.equal(uses(),0));
 const key=crypto.randomUUID(),body=give({representative:{grantId:g1,proxyPersonId:R}});
 const given=await post(o,body,200,key);
 check(()=>{const e=person(S).consentHistory.at(-1);assert.equal(person(S).exchangeConsent,true);assert.equal(e.decidedBy,'representative');assert.equal(e.representative.grantId,g1);assert.equal(e.representative.proxyPersonId,R);assert.equal(e.representative.authority,'nominated');assert.equal(given.result.representative.relationship,'sibling');assert.equal(uses(),1);});
 // Replay: the same key and body returns the saved result and records nothing more; a different body is refused.
 const again=await post(o,body,200,key);
 check(()=>{assert.equal(again.replayed,true);assert.equal(again.result.eventId,given.result.eventId);assert.equal(uses(),1);});
 await post(o,{...body,purpose:'ai'},409,key);
 const withdrawn=await post(o,{type:'withdrawConsent',personId:S,version:person(S).version,purpose:'exchange',channel:'in-person',reference:'FORM-14B-1',reason:'Sibling withdraws sharing on her behalf',representative:{grantId:g1,proxyPersonId:R}});
 check(()=>{assert.equal(withdrawn.result.decidedBy,'representative');assert.equal(uses(),2);});
 check(()=>{const rows=sql.prepare("SELECT action,detail FROM audit_events WHERE org_id=? AND person_id=? AND action IN ('setConsent','withdrawConsent','proxyUse') ORDER BY at").all(org,S);assert.equal(rows.length,4);for(const r of rows){assert.match(r.detail,new RegExp(`record ${R}; the person's sibling; nominated by the person`));assert.doesNotMatch(r.detail,/Proxy Sibling/,'no representative name in audit text');}});

 // Capacity: clinician only, adults only, versioned; the person cannot give a permission while recorded as lacking capacity.
 const cap=(over={})=>({type:'capacityRecord',personId:S,version:person(S).version,state:'lacks-capacity',evidence:'CAP-14B-1',note:'Assessed for decisions about sharing records',...over});
 await post(w,cap(),403);await post(s,cap(),403);await post(a,cap(),403);
 await post(o,cap({personId:K,version:person(K).version}),422);
 await post(o,cap({version:person(S).version+5}),409);
 await post(o,cap({note:'short'}),422);
 await post(o,cap());
 check(()=>assert.equal(person(S).capacity.at(-1).state,'lacks-capacity'));
 await post(o,give({purpose:'ai'}),422);
 await post(o,grant({version:person(S).version,proxyPersonId:K,relationship:'child',purposes:['appointments']}),422);
 const gCap=(await post(o,grant({version:person(S).version,proxyPersonId:U,relationship:'other',authority:'capacity-representative',purposes:['consent-decisions'],evidence:'SYNTH-CAP-REP'}))).result.grantId;
 await post(o,give({purpose:'ai',representative:{grantId:gCap,proxyPersonId:U}}));
 check(()=>{assert.equal(person(S).aiConsent,true);assert.equal(person(S).consentHistory.at(-1).representative.authority,'capacity-representative');assert.equal(uses(),3);});
 const regained=await post(o,cap({state:'has-capacity',evidence:'CAP-14B-2',note:'Reassessed after recovery; decides for herself'}));
 check(()=>{assert.deepEqual(regained.result.grantsEnded,[gCap]);assert.equal(person(S).capacity.length,2);});
 const ended=await post(o,{type:'withdrawConsent',personId:S,version:person(S).version,purpose:'ai',channel:'phone',reference:'CALL-14B',reason:'Guardian tries to withdraw after recovery',representative:{grantId:gCap,proxyPersonId:U}},422);
 check(()=>assert.match(ended.error,/has capacity/));
 await post(o,{type:'withdrawConsent',personId:S,version:person(S).version,purpose:'ai',channel:'in-person',reference:'FORM-14B-2',reason:'She withdraws AI use herself'});
 check(()=>{assert.equal(person(S).consentHistory.at(-1).decidedBy,'person');assert.equal(uses(),3);});

 // A parent's authority ends at 18, for consent and for household sharing.
 const gKid=(await post(o,{type:'proxyGrant',personId:K,version:person(K).version,proxyPersonId:R,relationship:'parent',authority:'parent-of-minor',purposes:['consent-decisions','care-coordination'],classes:['child'],evidence:'SYNTH-PARENT',expiresAt:iso(30*day)})).result.grantId;
 await post(o,{type:'setConsent',personId:K,purpose:'exchange',active:true,version:person(K).version,representative:{grantId:gKid,proxyPersonId:R}});
 const preview=async()=>{const r=await fetch(`${base}/api/household?${new URLSearchParams({personId:S,recipient:R,purpose:'care-coordination'})}`,{headers:{...o.headers,'x-saha-organisation':org}});const j=await r.json();check(()=>assert.equal(r.status,200,JSON.stringify(j)));return j;};
 let pv=await preview();check(()=>assert.ok(pv.shareable.members.some(m=>m.personId===K)));
 await post(o,{type:'correctIdentity',personId:K,version:person(K).version,name:person(K).name,age:18,sex:'Unknown',village:'Proxy synthetic locality',reason:'Synthetic age correction for the parent-authority check'});
 const adult=await post(o,{type:'setConsent',personId:K,purpose:'ai',active:true,version:person(K).version,representative:{grantId:gKid,proxyPersonId:R}},422);
 check(()=>assert.match(adult.error,/turns 18/));
 pv=await preview();check(()=>assert.equal(pv.shareable.members.some(m=>m.personId===K),false,'no disclosure under an ended parent authority'));
 check(()=>{const self=pv.members.find(m=>m.personId===S),st=Object.fromEntries(self.proxies.map(g=>[g.id,g.state]));assert.equal(st[g1],'in-force');assert.equal(st[renewal],'not-started');assert.equal(st[gCap],'capacity-regained');assert.equal(self.capacity,'has-capacity');});
 await fetch(`${base}/api/household?${new URLSearchParams({personId:S,recipient:R,purpose:'consent-decisions'})}`,{headers:{...o.headers,'x-saha-organisation':org}}).then(async r=>check(()=>assert.equal(r.status,422)));

 // Rights requests by a representative.
 const rights=(over={})=>({type:'rightsCreate',personId:S,kind:'access',channel:'in-person',requester:'proxy',identityCheck:'Sibling ID card seen',detail:'Asks for a copy of the records on her behalf',...over});
 await post(o,rights({proxyGrantId:gTeen}),422);await post(o,rights({proxyGrantId:gCap}),422);await post(o,rights({proxyGrantId:renewal}),422);
 const made=await post(o,rights({proxyGrantId:g1}));
 check(()=>{assert.equal(made.result.representative.grantId,g1);assert.equal(uses(),4);});
 const rv=await fetch(`${base}/api/rights?personId=${encodeURIComponent(S)}`,{headers:{...o.headers,'x-saha-organisation':org}}).then(r=>r.json());
 check(()=>{const r=rv.requests.find(x=>x.id===made.result.requestId);assert.equal(r.representative.authority,'nominated');assert.deepEqual(rv.proxies.map(x=>x.id),[g1]);});
 check(()=>assert.match(sql.prepare("SELECT detail FROM audit_events WHERE org_id=? AND person_id=? AND action='rightsCreate' ORDER BY at DESC LIMIT 1").get(org,S).detail,/made by a representative \(record .*; the person's sibling; nominated by the person/));
 // Revocation takes effect at the next use.
 await post(o,{type:'proxyRevoke',personId:S,version:person(S).version,grantId:g1,reason:'Sibling authority withdrawn by the patient'});
 await post(o,rights({proxyGrantId:g1}),422);
 check(()=>assert.equal(uses(),4));
}
