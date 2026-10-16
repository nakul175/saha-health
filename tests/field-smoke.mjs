import assert from 'node:assert/strict';import {verifyPacket} from '../public/field/vault.js';
export async function fieldSmoke({get,post,check,accounts,org}){
 const {owner:o,worker:w,admin:a}=accounts;await get(o,'/api/workspace',200,org);
 let r=await post(o,{type:'createPerson',name:'Field synthetic patient',age:29,sex:'Other',village:'Test village',programme:'General care',teamId:'default'});const pid=r.result.personId;const p=()=>o.state.people.find(x=>x.id===pid);
 await post(a,{type:'prepareFieldVisit',personId:pid,version:p().version},403,crypto.randomUUID(),org);await post(w,{type:'prepareFieldVisit',personId:pid,version:p().version},403,crypto.randomUUID(),org);
 r=await post(o,{type:'prepareFieldVisit',personId:pid,version:p().version});let grant=r.result;assert.ok(await verifyPacket(grant.packet));check(()=>assert.equal(grant.packet.payload.personId,pid));
 const make=()=>({type:'syncFieldVisit',personId:pid,leaseId:grant.packet.payload.leaseId,packageHash:grant.packageHash,facts:{...grant.packet.payload.facts,weight:'61',notes:'Synthetic disconnected capture'},answers:{},absence:{}});
 const vid=grant.packet.payload.visitId,command=make(),key=crypto.randomUUID();
 r=await post(o,command,200,key,org);const version=r.result.version;await post(o,command,200,key,org);check(()=>{assert.equal(o.state.visits.find(x=>x.id===vid).version,version);assert.equal(o.state.visits.find(x=>x.id===vid).state,'draft');assert.equal(p().fieldLeases.find(l=>l.id===command.leaseId).status,'synced')});
 await post(o,{...command,facts:{...command.facts,weight:'99'}},409,key,org);await post(o,command,409);await get(o,'/api/workspace',200,org);check(()=>assert.equal(o.state.visits.find(x=>x.id===vid).facts.weight,'61'));
 r=await post(o,{type:'prepareFieldVisit',personId:pid,version:p().version});grant=r.result;
 await post(o,{type:'saveVisit',visitId:vid,version:grant.packet.payload.visitVersion,facts:{...command.facts,weight:'65'}});await post(o,make(),409);check(()=>assert.equal(o.state.visits.find(x=>x.id===vid).facts.weight,'65'));
 r=await post(o,{type:'prepareFieldVisit',personId:pid,version:p().version});grant=r.result;await post(o,{type:'setConsent',personId:pid,version:p().version,purpose:'exchange',active:true});await post(o,make(),409);
 r=await post(o,{type:'prepareFieldVisit',personId:pid,version:p().version});grant=r.result;await post(o,{type:'revokeFieldLease',personId:pid,leaseId:grant.packet.payload.leaseId});await post(o,make(),409);
 r=await post(o,{type:'prepareFieldVisit',personId:pid,version:p().version});grant=r.result;await post(o,{type:'correctIdentity',personId:pid,version:p().version,name:'Corrected synthetic identity',age:29,sex:'Other',village:'Test village',reason:'Synthetic identity correction'});await post(o,make(),409);
 let v=o.state.visits.find(x=>x.id===vid);await post(o,{type:'confirmVisit',visitId:vid,version:v.version});r=await post(o,{type:'createReferral',visitId:vid,facility:'Synthetic referral facility',reason:'Synthetic testing appointment'});const rid=r.result.referralId,ref=()=>o.state.referrals.find(x=>x.id===rid);
 await post(o,{type:'transitionReferral',referralId:rid,state:'sent'},409);
 await post(o,{type:'assignReferral',referralId:rid,version:1,ownerId:'missing-worker',due:new Date().toISOString().slice(0,10),reason:'Synthetic owner assignment'},422);
 await post(o,{type:'assignReferral',referralId:rid,version:1,ownerId:o.state.user.userId,due:new Date().toISOString().slice(0,10),reason:'Synthetic owner assignment'});
 const event={type:'recordReferralEvent',referralId:rid,version:ref().version,event:'sent',note:'Synthetic evidence recorded',source:'facility-reported',evidenceReference:'TEST-RECEIPT',occurredAt:new Date().toISOString(),confirmed:true};
 await post(o,{...event,event:'completed'},409);await post(o,{...event,evidenceReference:''},422);await post(o,{...event,confirmed:false},422);await post(o,event);
 await post(o,event,409);await post(o,{...event,version:ref().version,event:'received',occurredAt:new Date().toISOString()});await post(o,{...event,version:ref().version,event:'attended',occurredAt:new Date().toISOString()});await post(o,{...event,version:ref().version,event:'completed',outcomeCode:'assessment-completed',occurredAt:new Date().toISOString()});await get(o,'/api/workspace',200,org);
 check(()=>{assert.equal(ref().state,'completed');assert.deepEqual(ref().events.map(event=>event.state),['sent','received','attended','completed']);assert.equal(ref().events.at(-1).source,'facility-reported');assert.ok(ref().ownerId)});
 await post(o,{type:'assignReferral',referralId:rid,version:ref().version,ownerId:o.state.user.userId,due:new Date().toISOString().slice(0,10),reason:'Try to modify completed outcome'},409);
}
