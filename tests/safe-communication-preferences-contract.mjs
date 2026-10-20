import assert from 'node:assert/strict';
import ts from 'typescript';
import {mkdtempSync,readFileSync,readdirSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

const dir=mkdtempSync(join(process.cwd(),'.safe-contact-contract-'));let passed=0;
const check=fn=>{fn();passed++};
const rejects=async(fn,pattern)=>{await assert.rejects(fn,pattern);passed++;};
try{
 for(const file of readdirSync('lib/saha').filter(file=>file.endsWith('.ts'))){const f=file.slice(0,-3);writeFileSync(join(dir,f+'.js'),ts.transpileModule(readFileSync(`lib/saha/${file}`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'"));}
 const {applyOutreach,authorizeOutreach,contactPreferencesFor,contactSchema,messageReview,MESSAGE_COPY}=await import(pathToFileURL(join(dir,'outreach.js')));
 const {bindAccessPolicy}=await import(pathToFileURL(join(dir,'access.js')));
 const now='2026-10-20T06:00:00.000Z',actor={userId:'worker',displayName:'Synthetic worker'},worker={userId:'worker',displayName:'Synthetic worker',role:'asha',isOwner:false,status:'active',version:1,teamIds:['team']},reviewer={userId:'reviewer',displayName:'Synthetic reviewer',role:'clinician',isOwner:false,status:'active',version:1,teamIds:['team']},operator={userId:'operator',displayName:'Synthetic operator',role:'admin',isOwner:true,status:'active',version:1,teamIds:[]};
 const patient={id:'person',name:'Synthetic person',age:30,sex:'Unknown',village:'Synthetic village',programmes:['General care'],task:'Follow up',due:'Today',status:'due',aiConsent:false,exchangeConsent:false,consentVersion:1,assigned:true,createdAt:now,version:1,teamId:'team',assignedTo:'worker'};
 const state=()=>({organisation:{id:'org'},members:[structuredClone(worker),structuredClone(reviewer),structuredClone(operator)],operations:{purposeGrants:[]},workspace:{role:'asha',people:[structuredClone(patient)],visits:[],audit:[]},outreach:{plans:[{id:'plan',version:1,state:'scheduled',createdBy:'worker',items:[{id:'item',personId:'person',ownerId:'worker',state:'planned',events:[]}],history:[]}],templates:[{id:'template',version:1,language:'en',body:MESSAGE_COPY.en,state:'approved',createdBy:'worker',reviewedBy:'operator',reviewerVersion:1}],messages:[]}});
 const preference=(over={})=>({purpose:'care-follow-up',method:'sms',destination:'TEST-SHARED-001',ownership:'shared',disclosure:'none',language:'en',timezone:'UTC',from:'00:00',to:'23:59',permission:true,privateContact:true,reference:'SYNTHETIC-SAFE-CONTACT',...over});

 const legacy=contactSchema.parse(Object.fromEntries(Object.entries(preference({ownership:'personal',privateContact:false})).filter(([key])=>!['purpose','disclosure'].includes(key))));
 check(()=>assert.deepEqual({purpose:legacy.purpose,disclosure:legacy.disclosure},{purpose:'care-follow-up',disclosure:'neutral-only'}));

 const migrated=state(),mp=migrated.workspace.people[0],mm=migrated.members[0];bindAccessPolicy(migrated);mp.contactPreferences={...legacy,version:3,updatedAt:now,by:'worker'};
 await applyOutreach(migrated,{type:'setContactPreferences',personId:mp.id,version:mp.version,preferences:preference({purpose:'appointment-reminder',ownership:'personal',disclosure:'neutral-only',privateContact:false,destination:'TEST-PERSONAL-099'})},actor,mm,now);
 check(()=>assert.equal(mp.contactPreferenceRecords.length,2));
 check(()=>assert.equal(contactPreferencesFor(mp,'care-follow-up').destination,'TEST-SHARED-001'));
 check(()=>assert.equal(contactPreferencesFor(mp,'appointment-reminder').destination,'TEST-PERSONAL-099'));

 const s=state(),p=s.workspace.people[0],m=s.members[0];bindAccessPolicy(s);
 await applyOutreach(s,{type:'setContactPreferences',personId:p.id,version:p.version,preferences:preference()},actor,m,now);
 check(()=>assert.equal(p.contactPreferenceRecords.length,1));
 check(()=>assert.deepEqual({purpose:p.contactPreferenceRecords[0].purpose,channel:p.contactPreferenceRecords[0].method,ownership:p.contactPreferenceRecords[0].ownership,disclosure:p.contactPreferenceRecords[0].disclosure,privateContact:p.contactPreferenceRecords[0].privateContact},{purpose:'care-follow-up',channel:'sms',ownership:'shared',disclosure:'none',privateContact:true}));
 check(()=>assert.equal(p.contactPreferenceHistory.length,1));
 check(()=>assert.equal(p.contactPreferenceHistory[0].before,null));

 await applyOutreach(s,{type:'setContactPreferences',personId:p.id,version:p.version,preferences:preference({purpose:'appointment-reminder',ownership:'personal',disclosure:'neutral-only',privateContact:false,destination:'TEST-PERSONAL-002'})},actor,m,'2026-10-20T06:01:00.000Z');
 check(()=>assert.equal(p.contactPreferenceRecords.length,2));
 check(()=>assert.equal(contactPreferencesFor(p,'appointment-reminder').destination,'TEST-PERSONAL-002'));
 check(()=>assert.equal(contactPreferencesFor(p,'care-follow-up').destination,'TEST-SHARED-001'));

 const appointment={id:'appointment',version:1,planId:'plan',itemId:'item',personId:p.id,contactPurpose:'appointment-reminder',templateId:'template',templateVersion:1,body:MESSAGE_COPY.en,scheduledAt:now,createdAt:now,createdBy:'worker',authorVersion:1,state:'draft',attempts:[]};
 const privateFollowup={...structuredClone(appointment),id:'private',contactPurpose:'care-follow-up'};
 s.outreach.messages.push(appointment,privateFollowup);
 const appointmentPreview=await messageReview(s,appointment,now);check(()=>assert.equal(appointmentPreview.destination,'TEST-PERSONAL-002'));
 await rejects(()=>messageReview(s,privateFollowup,now),/not permitted for this purpose and channel/);
 check(()=>assert.equal(privateFollowup.attempts.length,0));

 await applyOutreach(s,{type:'setContactPreferences',personId:p.id,version:p.version,preferences:preference({reference:'SYNTHETIC-PRIVATE-RECONFIRM'})},actor,m,'2026-10-20T06:02:00.000Z');
 check(()=>assert.equal(privateFollowup.state,'cancelled'));
 check(()=>assert.equal(appointment.state,'draft'));
 check(()=>assert.equal(p.contactPreferenceHistory.at(-1).before.reference,'SYNTHETIC-SAFE-CONTACT'));

 await applyOutreach(s,{type:'setContactPreferences',personId:p.id,version:p.version,preferences:preference({privateContact:false,disclosure:'neutral-only',reference:'SYNTHETIC-SHARED-NEUTRAL'})},actor,m,'2026-10-20T06:03:00.000Z');
 const sharedNeutral={...structuredClone(appointment),id:'shared',contactPurpose:'care-follow-up'};s.outreach.messages.push(sharedNeutral);const preview=await messageReview(s,sharedNeutral,now);
 check(()=>assert.equal(preview.body,MESSAGE_COPY.en));
 check(()=>assert.ok(!/Synthetic person|Follow up|care-follow-up/i.test(preview.body)));

 const invalid=state(),ip=invalid.workspace.people[0],im=invalid.members[0];bindAccessPolicy(invalid);
 await rejects(()=>applyOutreach(invalid,{type:'setContactPreferences',personId:ip.id,version:ip.version,preferences:preference({privateContact:true,disclosure:'neutral-only'})},actor,im,now),/Private contact requires no notification disclosure/);
 check(()=>assert.equal(ip.contactPreferenceRecords,undefined));
 await rejects(()=>applyOutreach(invalid,{type:'setContactPreferences',personId:ip.id,version:ip.version,preferences:preference({ownership:'unknown',privateContact:false,disclosure:'neutral-only'})},actor,im,now),/Unknown phone ownership/);

 const stale=state(),sp=stale.workspace.people[0],sm=stale.members[0];bindAccessPolicy(stale);const prepared={type:'setContactPreferences',personId:sp.id,version:sp.version,preferences:preference()};sp.version++;
 await rejects(()=>applyOutreach(stale,prepared,actor,sm,now),/changed/);
 check(()=>assert.equal(sp.contactPreferenceRecords,undefined));
 const reassigned=state(),rp=reassigned.workspace.people[0],rm=reassigned.members[0];bindAccessPolicy(reassigned);rp.assigned=false;
 assert.throws(()=>authorizeOutreach(reassigned,rm,{type:'setContactPreferences',personId:rp.id,preferences:preference()}),/not assigned/);passed++;
 const purposeLimited=state(),pm=purposeLimited.members[0];purposeLimited.operations.purposeGrants=[{id:'grant',memberId:pm.userId,programme:null,purposes:['programme-delivery'],version:1,setBy:'operator',setAt:now,reason:'Synthetic restriction'}];bindAccessPolicy(purposeLimited);
 assert.throws(()=>authorizeOutreach(purposeLimited,pm,{type:'setContactPreferences',personId:'person',preferences:preference()}),/named purposes/);passed++;
 check(()=>assert.equal(purposeLimited.workspace.people[0].contactPreferenceRecords,undefined));

 writeFileSync('tests/safe-communication-preferences-contract-result.json',JSON.stringify({passed,failed:0,story:'SAHA-104',requirement:'BR-CARE-06',externalProviderCalls:0,scope:'Per-person, purpose and channel preferences; shared-phone disclosure and private-contact refusal; purpose/assignment/version authority; append-only preference history; purpose-isolated cancellation.'},null,2)+'\n');
 console.log(`${passed} safe communication preference checks passed`);
}finally{rmSync(dir,{recursive:true,force:true});}
