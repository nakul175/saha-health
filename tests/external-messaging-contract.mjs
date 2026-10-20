import assert from 'node:assert/strict';
import ts from 'typescript';
import {mkdirSync,mkdtempSync,readdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

const temporary=mkdtempSync(join(process.cwd(),'.external-messaging-contract-'));
const evidence='tests/evidence/saha-105-external-messaging';
const checks=[];
const check=(name,fn)=>{fn();checks.push(name)};
const rejects=async(name,fn,pattern)=>{await assert.rejects(fn,pattern);checks.push(name)};

try{
 for(const name of readdirSync('lib/saha').filter(name=>name.endsWith('.ts'))){
  const file=name.slice(0,-3),source=readFileSync(`lib/saha/${name}`,'utf8');
  writeFileSync(join(temporary,file+'.js'),ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'"));
 }
 const {applyOutreach,messageReview,MESSAGE_COPY}=await import(pathToFileURL(join(temporary,'outreach.js')));
 const now='2026-10-20T04:00:00.000Z';
 const members=[
  {userId:'author',displayName:'Author clinician',role:'clinician',isOwner:true,status:'active',version:1,teamIds:['team']},
  {userId:'reviewer',displayName:'Review clinician',role:'clinician',isOwner:false,status:'active',version:1,teamIds:['team']},
  {userId:'ops-a',displayName:'Operations proposer',role:'admin',isOwner:true,status:'active',version:1,teamIds:['team']},
  {userId:'ops-b',displayName:'Operations reviewer',role:'admin',isOwner:true,status:'active',version:1,teamIds:['team']},
  {userId:'worker',displayName:'Assigned worker',role:'asha',isOwner:false,status:'active',version:1,teamIds:['team']},
  {userId:'other-worker',displayName:'Other worker',role:'asha',isOwner:false,status:'active',version:1,teamIds:['other']},
 ];
 const actor=id=>({userId:id,displayName:members.find(m=>m.userId===id)?.displayName??id});
 const member=id=>members.find(m=>m.userId===id);
 const contact={version:1,method:'sms',destination:'TEST-SAHA-105',ownership:'personal',language:'en',timezone:'UTC',from:'00:00',to:'23:59',permission:true,privateContact:false,reference:'SYNTHETIC-CONTACT',updatedAt:'2026-10-20T00:00:00.000Z',by:'author'};
 const state={organisation:{id:'org'},members:structuredClone(members),workspace:{role:'clinician',people:[{id:'person',version:1,assigned:true,name:'Synthetic person',age:35,sex:'Unknown',village:'Synthetic service area',teamId:'team',assignedTo:'worker',contactPreferences:contact}],visits:[],referrals:[],audit:[]},outreach:{plans:[{id:'plan',version:1,title:'Synthetic appointment reminder',date:'2026-10-20',teamId:'team',criteria:'Synthetic appointment reminder with separate delivery and acknowledgement evidence.',createdAt:'2026-10-20T00:00:00.000Z',createdBy:'author',state:'scheduled',items:[{id:'item',personId:'person',ownerId:'worker',reason:'Synthetic reminder',state:'planned',events:[]}],history:[]}],templates:[{id:'template',version:2,language:'en',body:MESSAGE_COPY.en,state:'approved',createdBy:'author',createdAt:'2026-10-20T00:00:00.000Z',reviewedBy:'ops-b',reviewerVersion:1}],messages:[],channels:[]}};

 const incomplete=await applyOutreach(state,{type:'externalChannelPropose',kind:'sms',capabilities:{deliveryEvidence:true,optOutHandling:false,recoveryWork:true},reason:'Stage the incomplete adapter to verify readiness refusal.'},actor('ops-a'),member('ops-a'),now);
 check('staged channel records no live provider or credential',()=>{assert.equal(incomplete.liveProviderConfigured,false);assert.equal(incomplete.credentialsStored,false);assert.equal(/credential|endpoint|secret/i.test(JSON.stringify(state.outreach.channels[0])),false)});
 await rejects('channel proposer cannot self-approve',()=>applyOutreach(state,{type:'externalChannelReview',channelId:incomplete.channelId,version:1,state:'ready',reference:'SYNTHETIC-SELF',reason:'Self approval must not make the channel ready.'},actor('ops-a'),member('ops-a'),now),/different operations member/);
 await rejects('incomplete channel cannot become ready',()=>applyOutreach(state,{type:'externalChannelReview',channelId:incomplete.channelId,version:1,state:'ready',reference:'SYNTHETIC-INCOMPLETE',reason:'Missing opt-out readiness must hold the channel.'},actor('ops-b'),member('ops-b'),now),/all be ready/);
 await applyOutreach(state,{type:'externalChannelReview',channelId:incomplete.channelId,version:1,state:'suspended',reference:'SYNTHETIC-HOLD',reason:'Suspend the incomplete readiness record without deleting it.'},actor('ops-b'),member('ops-b'),now);
 const staged=await applyOutreach(state,{type:'externalChannelPropose',kind:'sms',capabilities:{deliveryEvidence:true,optOutHandling:true,recoveryWork:true},reason:'Stage a synthetic-only SMS adapter with all required evidence paths.'},actor('ops-a'),member('ops-a'),now);
 const readiness=await applyOutreach(state,{type:'externalChannelReview',channelId:staged.channelId,version:1,state:'ready',reference:'SYNTHETIC-READY-105',reason:'Independent synthetic readiness review covers receipts, opt-out and recovery.'},actor('ops-b'),member('ops-b'),now);
 check('independent readiness stays synthetic only',()=>{assert.equal(readiness.state,'ready');assert.equal(readiness.syntheticOnly,true);assert.equal(readiness.liveProviderConfigured,false);assert.equal(readiness.credentialsStored,false)});
 await rejects('application API refuses an unreviewed implicit channel',()=>applyOutreach(state,{type:'messageCreate',planId:'plan',itemId:'item',templateId:'template',scheduledAt:now},actor('author'),member('author'),now,'synthetic'),/independently ready synthetic channel/);
 const authorityChanged=structuredClone(state);authorityChanged.members.find(m=>m.userId==='ops-a').version++;
 await rejects('channel proposer authority change invalidates readiness',()=>applyOutreach(authorityChanged,{type:'messageCreate',planId:'plan',itemId:'item',templateId:'template',channelId:staged.channelId,scheduledAt:now},actor('author'),authorityChanged.members.find(m=>m.userId==='author'),now),/current independent synthetic readiness/);

 const prepared=await applyOutreach(state,{type:'messageCreate',planId:'plan',itemId:'item',templateId:'template',channelId:staged.channelId,scheduledAt:now},actor('author'),member('author'),now);
 let message=state.outreach.messages.find(v=>v.id===prepared.messageId);
 const preview=await messageReview(state,message,now);
 check('preview binds exact independently ready channel',()=>{assert.equal(preview.channel.id,staged.channelId);assert.equal(preview.channel.kind,'sms');assert.equal(preview.channel.adapter,'synthetic-receipt-simulator')});
 await applyOutreach(state,{type:'messageApprove',messageId:message.id,version:1,hash:preview.hash},actor('reviewer'),member('reviewer'),now);

 const production=structuredClone(state),productionMessage=production.outreach.messages[0];
 await rejects('synthetic adapter refuses production execution',()=>applyOutreach(production,{type:'messageSimulate',messageId:productionMessage.id,version:2,outcome:'simulated'},actor('worker'),production.members.find(m=>m.userId==='worker'),now,'production'),/only in synthetic or training/);
 check('environment refusal has no attempt',()=>assert.equal(productionMessage.attempts.length,0));
 const reassigned=structuredClone(state);reassigned.workspace.people[0].assignedTo='other-worker';
 await rejects('assignment race refuses before delivery evidence',()=>applyOutreach(reassigned,{type:'messageSimulate',messageId:message.id,version:2,outcome:'simulated'},actor('worker'),reassigned.members.find(m=>m.userId==='worker'),now,'synthetic'),/author no longer|active care worker|access/i);
 check('assignment race preserves prior history',()=>assert.equal(reassigned.outreach.messages[0].attempts.length,0));
 const channelChanged=structuredClone(state);channelChanged.outreach.channels.find(c=>c.id===staged.channelId).version++;
 await rejects('channel review change invalidates exact approval',()=>applyOutreach(channelChanged,{type:'messageSimulate',messageId:message.id,version:2,outcome:'simulated'},actor('worker'),channelChanged.members.find(m=>m.userId==='worker'),now,'synthetic'),/context changed/);
 check('channel race preserves prior history',()=>assert.equal(channelChanged.outreach.messages[0].attempts.length,0));

 const delivered=await applyOutreach(state,{type:'messageSimulate',messageId:message.id,version:2,outcome:'simulated'},actor('worker'),member('worker'),now,'synthetic');
 message=state.outreach.messages.find(v=>v.id===message.id);
 check('delivery receipt cannot imply acknowledgement or care completion',()=>{assert.equal(delivered.delivery,'delivered');assert.equal(delivered.patientAcknowledgement,'unconfirmed');assert.equal(delivered.realMessageSent,false);assert.equal(message.patientAcknowledgement,undefined);assert.equal(state.outreach.plans[0].items[0].state,'planned')});
 await rejects('out-of-scope worker cannot record acknowledgement',()=>applyOutreach(state,{type:'messageAcknowledge',messageId:message.id,version:3,note:'Direct acknowledgement was obtained outside this worker scope.',reference:'SYNTHETIC-ACK-REFUSED'},actor('other-worker'),member('other-worker'),now),/access|responsible worker/);
 const acknowledged=await applyOutreach(state,{type:'messageAcknowledge',messageId:message.id,version:3,note:'Assigned worker directly confirmed receipt with the synthetic person.',reference:'SYNTHETIC-DIRECT-ACK'},actor('worker'),member('worker'),now);
 check('direct acknowledgement is separately evidenced and does not complete care',()=>{assert.equal(acknowledged.patientAcknowledgement,'confirmed');assert.equal(acknowledged.delivery,'delivered');assert.equal(acknowledged.careCompleted,false);assert.equal(message.patientAcknowledgement.source,'direct-worker-confirmation');assert.equal(state.outreach.plans[0].items[0].state,'planned')});
 await rejects('duplicate acknowledgement preserves first accepted history',()=>applyOutreach(state,{type:'messageAcknowledge',messageId:message.id,version:4,note:'A duplicate acknowledgement must not overwrite history.',reference:'SYNTHETIC-DUPLICATE'},actor('worker'),member('worker'),now),/already recorded/);

 const failedState=structuredClone(state);const failedMessage=failedState.outreach.messages[0];failedMessage.version=2;failedMessage.state='approved';failedMessage.attempts=[];failedMessage.patientAcknowledgement=undefined;
 const failed=await applyOutreach(failedState,{type:'messageSimulate',messageId:failedMessage.id,version:2,outcome:'failed'},actor('worker'),failedState.members.find(m=>m.userId==='worker'),now,'synthetic');
 check('provider failure opens accountable recovery without acknowledgement',()=>{assert.equal(failed.delivery,'failed');assert.equal(failed.patientAcknowledgement,'unconfirmed');assert.equal(failedMessage.recovery.state,'open');assert.equal(failedMessage.recovery.ownerId,'worker');assert.equal(failedMessage.patientAcknowledgement,undefined);assert.equal(failedState.outreach.plans[0].items[0].state,'planned')});
 const staleVersion=3;
 await applyOutreach(failedState,{type:'messageRetry',messageId:failedMessage.id,version:staleVersion,scheduledAt:now,reason:'Prepare a bounded retry while retaining the original failed receipt.'},actor('worker'),failedState.members.find(m=>m.userId==='worker'),now);
 await rejects('stale concurrent retry refuses without duplicate attempt',()=>applyOutreach(failedState,{type:'messageRetry',messageId:failedMessage.id,version:staleVersion,scheduledAt:now,reason:'A concurrent stale retry must not alter the accepted retry.'},actor('worker'),failedState.members.find(m=>m.userId==='worker'),now),/changed/);
 check('retry retains failure receipt and unresolved recovery',()=>{assert.equal(failedMessage.attempts.length,1);assert.equal(failedMessage.recovery.state,'open');assert.equal(failedMessage.state,'draft')});

 mkdirSync(evidence,{recursive:true});
 writeFileSync(`${evidence}/contract-result.json`,JSON.stringify({story:'SAHA-105',requirement:'BR-CARE-07',passed:checks.length,failed:0,skipped:0,checks,syntheticOnly:true,liveProviderConfigured:false,credentialsStored:false,formalAcceptance:'not-run',completedAt:new Date().toISOString(),limits:'Local source contract using synthetic records and an in-memory staged receipt simulator. No external provider, credential, real recipient, live receipt, formal TC-BR-CARE-07 execution, merge, deployment or domain approval.'},null,2)+'\n');
 console.log(`${checks.length} SAHA-105 external messaging checks passed`);
}finally{rmSync(temporary,{recursive:true,force:true})}
