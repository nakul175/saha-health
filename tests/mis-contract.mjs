import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const dir=mkdtempSync(join(process.cwd(),'.mis-contract-'));let passed=0;
try{
 for(const f of ['abdm', 'abdm-transfer', 'access', 'action-plan', 'adapter-operations', 'agent', 'agent-minimisation', 'ai-budget', 'alerts', 'anaemia', 'audit-chain', 'capability-lifecycle', 'caseload', 'consent', 'continuity', 'core', 'delegation', 'ehr', 'environment', 'evaluation', 'exceptional', 'expansion', 'facility-scope', 'fact-provenance', 'fhir-document', 'fhir-validate', 'field', 'field-registration', 'governance', 'household', 'household-constants', 'household-visit', 'household-visit-constants', 'identity', 'imported-visits', 'media', 'merge', 'mis', 'mis-callback', 'operations', 'outreach', 'pack-installation', 'partition', 'pilot', 'programme-commands', 'programmes', 'provider-sandbox', 'purpose-scope', 'referral-needs', 'referral-request', 'referral-rules', 'retention', 'rights', 'seed', 'send-gate', 'service-identity', 'shadow', 'store', 'task-limits', 'types']){const code=ts.transpileModule(readFileSync(`lib/saha/${f}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'");writeFileSync(join(dir,f+'.js'),code);}
 const {misCredential,mappedPayload,applyReceipt,misRequest,mappingSchema,deliveryCurrent}=await import(pathToFileURL(join(dir,'mis.js')));
 const {verifyMisSignature}=await import(pathToFileURL(join(dir,'mis-callback.js')));
 const {apply}=await import(pathToFileURL(join(dir,'core.js')));
 const check=fn=>{fn();passed++},rejects=async(fn,re)=>{await assert.rejects(fn,re);passed++};
 const i={id:'mis1',name:'First programme',kind:'mis',mode:'http',status:'active',version:2,endpoint:'https://programme.example/api',credentialBinding:'SAHA_MIS_TEST',programmes:['General care'],mis:{contract:'saha-mis-v1',mapping:[{source:'personId',target:'person_ref',required:true},{source:'weight',target:'weight_kg',required:true},{source:'temperature',target:'temp_c',required:false}],corrections:true,test:{ok:true,version:2}}};
 const grants=[{organisationId:'org',integrationId:i.id,origin:'https://programme.example',credentialBinding:i.credentialBinding,callbackBinding:'SAHA_MIS_CALLBACK'}];
 const env={SAHA_EXTERNAL_APIS_ENABLED:'true',SAHA_MIS_CONNECTIONS:JSON.stringify(grants),SAHA_MIS_TEST:'test-secret',SAHA_MIS_CALLBACK:'callback-test-secret'};
 const p={id:'p',assigned:true,version:2,consentVersion:3,exchangeConsent:true,programmes:['General care']};const v={id:'v',personId:'p',state:'confirmed',version:3,facts:{weight:'55',notes:'Synthetic note',temperature:''}};
 const s={organisation:{id:'org'},workspace:{role:'clinician',people:[p],visits:[v],integrations:[i],submissions:[],audit:[]}};
 check(()=>assert.equal(misCredential(i,'org',env),'test-secret'));
 for(const [changed,org,pattern] of [[env,'other',/no server-approved/],[{...env,SAHA_MIS_CONNECTIONS:'invalid'},'org',/invalid/],[{...env,SAHA_EXTERNAL_APIS_ENABLED:'false'},'org',/disabled/],[{...env,SAHA_MIS_TEST:''},'org',/credential/]])check(()=>assert.throws(()=>misCredential(i,org,changed),pattern));
 check(()=>assert.throws(()=>misCredential({...i,credentialBinding:'SAHA_PROVIDER_API_KEY'},'org',env),/dedicated/));
 check(()=>assert.throws(()=>misCredential({...i,endpoint:'http://programme.example/api'},'org',env),/HTTPS/));
 check(()=>assert.throws(()=>misCredential({...i,endpoint:'https://127.0.0.1/api'},'org',env),/HTTPS/));
 check(()=>assert.equal(mappingSchema.safeParse([{source:'notes',target:'__proto__',required:true}]).success,false));
 check(()=>assert.equal(mappingSchema.safeParse([{source:'notes',target:'same',required:false},{source:'weight',target:'same',required:false}]).success,false));
 const payload=mappedPayload(i,v,s);check(()=>assert.deepEqual(payload.fields,{person_ref:'p',weight_kg:'55'}));
 check(()=>assert.throws(()=>mappedPayload(i,{...v,facts:{weight:''}},s),/missing/));
 const base={id:'sub',visitId:'v',personId:'p',connectorId:'mis1',state:'sending',attempts:1,payloadHash:'a'.repeat(64),delivery:{key:'sub',actorId:'worker',connectorVersion:2,personVersion:2,consentVersion:3,visitVersion:3,expiresAt:new Date(Date.now()+60000).toISOString(),payload,events:[]}};
 const receipt={contract:'saha-mis-v1',key:'sub',payloadHash:base.payloadHash,status:'accepted',receipt:'PARTNER-1'};
 let sub=structuredClone(base);applyReceipt(sub,receipt);check(()=>assert.equal(sub.state,'accepted'));applyReceipt(sub,receipt);check(()=>assert.equal(sub.delivery.events.length,1));
 check(()=>assert.throws(()=>applyReceipt(sub,{...receipt,status:'rejected'}),/conflicting/));
 check(()=>assert.throws(()=>applyReceipt(structuredClone(base),{...receipt,key:'wrong'}),/match/));
 check(()=>assert.throws(()=>applyReceipt(structuredClone(base),{...receipt,receipt:undefined}),/require/));
 check(()=>assert.throws(()=>applyReceipt(structuredClone(base),{...receipt,status:'not_found'}),/lookup/));
 sub=structuredClone(base);applyReceipt(sub,{...receipt,status:'not_found',receipt:undefined},true);check(()=>assert.equal(sub.state,'retryable'));
 sub=structuredClone(base);applyReceipt(sub,{...receipt,status:'pending',receipt:undefined});check(()=>assert.equal(sub.state,'uncertain'));
 check(()=>assert.equal(deliveryCurrent(s,base,{userId:'worker'},{role:'clinician'},env).id,i.id));
 for(const [field,value] of [['exchangeConsent',false],['consentVersion',4],['version',3]]){const changed=structuredClone(s);changed.workspace.people[0][field]=value;check(()=>assert.throws(()=>deliveryCurrent(changed,base,{userId:'worker'},{role:'clinician'},env),/changed/));}
 check(()=>assert.throws(()=>deliveryCurrent(s,base,{userId:'other'},{role:'clinician'},env),/approving worker/));
 check(()=>assert.throws(()=>deliveryCurrent(s,{...base,delivery:{...base.delivery,expiresAt:'2020'}},{userId:'worker'},{role:'clinician'},env),/window/));
 const corrected=structuredClone(s);corrected.workspace.submissions=[{...base,state:'accepted',receipt:'PARTNER-1'}];const correction=mappedPayload(i,{...v,id:'v2',amendsVisitId:'v'},corrected);check(()=>{assert.equal(correction.operation,'correct');assert.equal(correction.replaces.receipt,'PARTNER-1')});
 check(()=>assert.throws(()=>mappedPayload({...i,mis:{...i.mis,corrections:false}},{...v,amendsVisitId:'v'},corrected),/correction support/));
 corrected.workspace.visits.push({...v,id:'v2',amendsVisitId:'v'});check(()=>assert.equal(mappedPayload(i,{...v,id:'v3',amendsVisitId:'v2'},corrected).replaces.receipt,'PARTNER-1'));
 corrected.workspace.submissions[0].state='uncertain';check(()=>assert.throws(()=>mappedPayload(i,{...v,amendsVisitId:'v'},corrected),/Resolve/));
 let sent=0;await misRequest(i,'org',env,payload,'stable-key',async(url,init)=>{sent++;check(()=>{assert.equal(init.redirect,'manual');assert.equal(init.headers['Idempotency-Key'],'stable-key');assert.equal(JSON.parse(init.body).environment,'synthetic');assert.equal(init.headers.Authorization,'Bearer test-secret')});return Response.json(receipt)});check(()=>assert.equal(sent,1));
 await rejects(()=>misRequest(i,'org',env,{},'key',async()=>Response.json({}, {status:429})),/429/);
 // Slice 11f: redirect mode 'manual' (workerd rejects 'error'); a redirect is refused as an unconfirmed receipt and never followed.
 let hops=0;await rejects(()=>misRequest(i,'org',env,{},'key',async()=>{hops++;return new Response(null,{status:302,headers:{location:'https://elsewhere.example/'}});}),/HTTP 302. Receipt is unconfirmed/);check(()=>assert.equal(hops,1));
 await rejects(()=>misRequest(i,'org',env,{},'key',async()=>new Response('x'.repeat(16001))),/size/);
 await rejects(()=>misRequest(i,'org',env,{},'key',async()=>new Response('bad')),/invalid JSON/);
 await rejects(()=>misRequest(i,'org',env,{},'key',async()=>{throw Error('timeout')}),/timeout/);
 const raw=JSON.stringify(receipt),timestamp=String(Date.now()),cryptoKey=await crypto.subtle.importKey('raw',new TextEncoder().encode('secret'),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=Buffer.from(await crypto.subtle.sign('HMAC',cryptoKey,new TextEncoder().encode(timestamp+'.'+raw))).toString('hex');await verifyMisSignature(raw,timestamp,signature,'secret');passed++;
 await rejects(()=>verifyMisSignature(raw+' ',timestamp,signature,'secret'),/Invalid/);await rejects(()=>verifyMisSignature(raw,timestamp,signature,'secret',Date.now()+600000),/expired/);await rejects(()=>verifyMisSignature(raw,timestamp,signature,'wrong'),/Invalid/);
 // A single approved visit creates independent durable deliveries, without transport.
 const second={...structuredClone(i),id:'mis2',name:'Second programme'};s.workspace.integrations.push(second);
 await apply(s.workspace,{type:'preparePlan',visitId:'v',recipients:['mis1','mis2']},'worker',{});await apply(s.workspace,{type:'approvePlan',visitId:'v',planId:v.plan.id,payloadHash:v.plan.payloadHash},'worker',{});await apply(s.workspace,{type:'executePlan',visitId:'v',planId:v.plan.id},'worker',{});
 check(()=>{assert.equal(s.workspace.submissions.length,2);assert.ok(s.workspace.submissions.every(x=>x.state==='queued'&&x.attempts===0));assert.notEqual(s.workspace.submissions[0].delivery.key,s.workspace.submissions[1].delivery.key)});
 await apply(s.workspace,{type:'executePlan',visitId:'v',planId:v.plan.id},'worker',{});check(()=>assert.equal(s.workspace.submissions.length,2));
 await rejects(()=>apply(s.workspace,{type:'preparePlan',visitId:'v',recipients:['mis1']},'worker',{}),/already exists/);
 const result={passed,suite:'programme integration contract',liveSystemsTested:0,completedAt:new Date().toISOString()};writeFileSync('tests/mis-contract-result.json',JSON.stringify(result,null,2)+'\n');console.log(result);
}finally{rmSync(dir,{recursive:true,force:true})}
