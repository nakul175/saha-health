import assert from 'node:assert/strict';
// Slice 7b: care contexts, encrypted consent-bound transfer and received-record review, mock gateway.
export async function abdmTransferSmoke({get,post,check,accounts,org,base}){
 const {owner:o,worker:w,admin:a}=accounts;
 const view=async q=>{const r=await fetch(`${base}/api/abdm?${new URLSearchParams(q)}`,{headers:{...o.headers,'x-saha-organisation':org}});const j=await r.json();check(()=>assert.equal(r.status,200,JSON.stringify(j).slice(0,300)));return j;};
 const person=id=>o.state.people.find(p=>p.id===id);
 await post(o,{type:'abdmConfigure',environment:'mock',modules:{abha:true,hip:true,hiu:true},facilityId:'SYN-FACILITY-API',approvals:[{module:'abha',reference:'APPROVAL-ABHA'},{module:'hip',reference:'APPROVAL-HIP'},{module:'hiu',reference:'APPROVAL-HIU'}],reason:'Synthetic mock configuration with HIP'});
 const pid=(await post(o,{type:'createPerson',name:`Transfer Synthetic ${crypto.randomUUID().slice(0,6)}`,age:44,sex:'Female',village:'ABDM transfer locality',programme:'General care',teamId:'default'})).result.personId;
 const vid=(await post(o,{type:'startVisit',personId:pid})).result.visitId;
 const facts={date:new Date(Date.now()-60000).toISOString().slice(0,16),systolic:'128',diastolic:'82',weight:'61',temperature:'',weeks:'',coughDays:'',notes:'Synthetic visit for the mock transfer.',source:'measured'};
 await post(o,{type:'saveVisit',visitId:vid,version:1,facts});await get(o,'/api/workspace',200,org);
 await post(o,{type:'confirmVisit',visitId:vid,version:o.state.visits.find(v=>v.id===vid).version});await get(o,'/api/workspace',200,org);
 await post(o,{type:'abdmCareContextLink',personId:pid,version:person(pid).version,visitIds:[vid]},409);
 await post(o,{type:'abhaLink', demographicMatch:'matched', confirmed:true,personId:pid,version:person(pid).version,abhaNumber:`66-7788-9900-${String(Date.now()).slice(-4)}`,demographicMatch:'matched',confirmed:true,otp:'123456'});
 await post(w,{type:'abdmCareContextLink',personId:pid,version:person(pid).version,visitIds:[vid]},403);
 const linked=await post(o,{type:'abdmCareContextLink',personId:pid,version:person(pid).version,visitIds:[vid]});check(()=>assert.equal(linked.result.linked,1));
 await post(o,{type:'abdmCareContextLink',personId:pid,version:person(pid).version,visitIds:[vid]},409);
 const today=new Date().toISOString().slice(0,10);
 const cid=(await post(o,{type:'abdmConsentRequest',personId:pid,version:person(pid).version,purpose:'CAREMGT',hiTypes:['OPConsultation'],from:'2026-01-01',to:today,expiresAt:new Date(Date.now()+10*86400000).toISOString()})).result.consentId;
 await post(o,{type:'abdmFetch',personId:pid,version:person(pid).version,consentId:cid},409);
 await post(o,{type:'abdmConsentDecide',personId:pid,consentId:cid,decision:'GRANTED'});
 await post(w,{type:'abdmFetch',personId:pid,version:person(pid).version,consentId:cid},403);
 const got=await post(o,{type:'abdmFetch',personId:pid,version:person(pid).version,consentId:cid});
 check(()=>assert.equal(got.result.entries,1));
 check(()=>{const p=person(pid);assert.equal(p.abdmReceived.length,1);assert.equal(p.abdmReceived[0].bundle,undefined,'snapshots carry no decrypted bundle');assert.match(p.careContexts[0].abhaNumber,/XXXX/);});
 let v=await view({personId:pid});
 check(()=>{assert.equal(v.received[0].state,'review');assert.match(v.received[0].summary,/Patient/);assert.equal(v.transfers[0].state,'delivered');assert.equal(v.careContexts[0].current,true);});
 check(()=>{assert.match(v.received[0].summary,/^Composition, /,'slice 7c: received entries are FHIR documents');assert.equal(v.received[0].validation,'saha-fhir-r4-document-structure 1.1.0');});
 await post(o,{type:'abdmReceivedReview',personId:pid,version:person(pid).version,recordId:v.received[0].id,decision:'accepted',note:'Matches the patient and visit date'});
 await post(o,{type:'abdmReceivedReview',personId:pid,version:person(pid).version,recordId:v.received[0].id,decision:'rejected',note:'Second review attempt'},409);
 await post(a,{type:'abdmConsentRevoke',personId:pid,consentId:cid,reason:'Patient withdrew permission in person'},403);
 await post(o,{type:'abdmConsentRevoke',personId:pid,consentId:cid,reason:'Patient withdrew permission in person'});
 await post(o,{type:'abdmFetch',personId:pid,version:person(pid).version,consentId:cid},409);
 v=await view({personId:pid});check(()=>{assert.equal(v.received[0].state,'accepted');assert.equal(v.transfers.length,1);});
}
