import assert from 'node:assert/strict';
// Slice 7a: ABDM-shaped workflows against the local mock gateway through the built Worker and local D1.
export async function abdmSmoke({get,post,check,accounts,org,base}){
 const {owner:o,worker:w,admin:a,clinician:c,supervisor:s}=accounts;
 const view=async(who,q,status=200)=>{const r=await fetch(`${base}/api/abdm?${new URLSearchParams(q)}`,{headers:{...who.headers,'x-saha-organisation':org}});const j=await r.json();check(()=>assert.equal(r.status,status,JSON.stringify(j).slice(0,300)));return j;};
 const person=id=>o.state.people.find(p=>p.id===id);
 const pid=(await post(o,{type:'createPerson',name:`ABHA Synthetic ${crypto.randomUUID().slice(0,6)}`,age:36,sex:'Female',village:'ABDM synthetic locality',programme:'General care',teamId:'default'})).result.personId;
 const tail=String(Date.now()).slice(-4),abha=`55-6677-8899-${tail}`;
 const link={type:'abhaLink',personId:pid,version:person(pid).version,abhaNumber:abha,otp:'123456'};
 await post(o,link,409);
 const cfg={type:'abdmConfigure',environment:'mock',modules:{abha:true,hip:false,hiu:true},facilityId:'SYN-FACILITY-API',approvals:[{module:'abha',reference:'APPROVAL-ABHA'},{module:'hiu',reference:'APPROVAL-HIU'}],reason:'Synthetic mock configuration for the test'};
 await post(c,cfg,403);await post(o,{...cfg,environment:'production'},409);await post(o,{...cfg,approvals:[]},422);
 await post(o,cfg);
 await post(s,link,403);await post(o,{...link,otp:'999999'},422);await post(o,{...link,abhaNumber:'12345'},422);
 const linked=await post(o,link);check(()=>assert.equal(linked.result.abha,`55-XXXX-XXXX-${tail}`));
 check(()=>{assert.equal(person(pid).abha.state,'linked');assert.match(person(pid).abha.number,/XXXX/,'snapshots carry masked ABHA numbers');});
 const other=(await post(o,{type:'createPerson',name:`ABHA Other ${crypto.randomUUID().slice(0,6)}`,age:50,sex:'Male',village:'ABDM synthetic locality',programme:'General care',teamId:'default'})).result.personId;
 await post(o,{type:'abhaLink',personId:other,version:person(other).version,abhaNumber:abha,otp:'123456'},409);
 await post(o,{type:'abhaDecline',personId:other,version:person(other).version,reason:'Prefers not to create an ABHA'});
 // Consent artefact: request, mock grant, checks, revoke.
 const today=new Date().toISOString().slice(0,10),exp=new Date(Date.now()+20*86400000).toISOString();
 const req={type:'abdmConsentRequest',personId:pid,version:person(pid).version,purpose:'CAREMGT',hiTypes:['OPConsultation'],from:'2026-01-01',to:today,expiresAt:exp};
 await post(w,req,403);
 const asked=await post(o,req);const cid=asked.result.consentId;
 await post(c,{type:'abdmConsentDecide',personId:pid,consentId:cid,decision:'GRANTED'},403);
 await post(o,{type:'abdmConsentDecide',personId:pid,consentId:cid,decision:'GRANTED'});
 let v=await view(o,{personId:pid,consentId:cid,hiType:'OPConsultation',date:today});
 check(()=>{assert.equal(v.consents[0].status,'GRANTED');assert.equal(v.check.allowed,true);assert.match(v.abha.number,/XXXX/);assert.equal(v.config.environment,'mock');});
 v=await view(o,{personId:pid,consentId:cid,hiType:'Prescription',date:today});check(()=>assert.equal(v.check.allowed,false));
 v=await view(o,{personId:pid,consentId:cid,hiType:'OPConsultation',date:'2025-06-01'});check(()=>assert.equal(v.check.allowed,false));
 await view(a,{personId:pid},403);await view(w,{personId:pid},403);await view(o,{personId:pid,date:'yesterday'},422);
 await post(o,{type:'abdmConsentRevoke',personId:pid,consentId:cid,reason:'Patient withdrew permission in person'});
 v=await view(o,{personId:pid,consentId:cid,hiType:'OPConsultation',date:today});check(()=>{assert.equal(v.consents[0].status,'REVOKED');assert.equal(v.check.allowed,false);});
 // Slice 6r: patient history is redacted on read; revisions and their field changes never serve the full ABHA number.
 const hr=await fetch(`${base}/api/history?personId=${pid}`,{headers:{...o.headers,'x-saha-organisation':org}}),ht=await hr.text();
 check(()=>{assert.equal(hr.status,200,ht.slice(0,200));assert.ok(!ht.includes(`8899-${tail}`)&&!ht.includes(`8899${tail}`),'history must not serve the full ABHA number');assert.match(ht,new RegExp(`XXXX-XXXX-${tail}`));});
 await post(o,{type:'abhaUnlink',personId:pid,version:person(pid).version,reason:'Wrong ABHA recorded at registration'});
 v=await view(o,{personId:pid});check(()=>{assert.equal(v.abha.state,'none');assert.equal(v.abha.history.length,2);});
}
