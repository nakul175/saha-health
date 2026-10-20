import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const dir=mkdtempSync(join(process.cwd(),'.outreach-contract-'));let passed=0;const check=fn=>{fn();passed++};
try{
 for(const f of ['abdm', 'abdm-transfer', 'access', 'action-authority', 'action-plan', 'adapter-operations', 'agent', 'agent-minimisation', 'ai-budget', 'alerts', 'anaemia', 'audit-chain', 'capability-lifecycle', 'caseload', 'consent', 'continuity', 'core', 'delegation', 'ehr', 'environment', 'evaluation', 'exceptional', 'expansion', 'facility-scope', 'fact-provenance', 'fhir-document', 'fhir-validate', 'field', 'field-registration', 'governance', 'household', 'household-constants', 'household-visit', 'household-visit-constants', 'identity', 'imported-visits', 'media', 'merge', 'mis', 'operations', 'outreach', 'pack-installation', 'partition', 'pilot', 'programme-commands', 'programmes', 'provider-sandbox', 'purpose-scope', 'referral-needs', 'referral-request', 'referral-rules', 'retention', 'rights', 'seed', 'send-gate', 'service-identity', 'shadow', 'store', 'task-limits', 'types'])writeFileSync(join(dir,f+'.js'),ts.transpileModule(readFileSync(`lib/saha/${f}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'"));
 const {inContactWindow,messageReview,applyOutreach,contactSchema,MESSAGE_COPY}=await import(pathToFileURL(join(dir,'outreach.js')));
 const {maintenanceAllows}=await import(pathToFileURL(join(dir,'operations.js')));
 const {expansionStatus,EXPANSION_CHECKS}=await import(pathToFileURL(join(dir,'expansion.js')));
 const {digest}=await import(pathToFileURL(join(dir,'core.js')));
 const members=[['author','clinician',true],['reviewer','clinician',false],['operator','admin',false],['worker','asha',false]].map(([userId,role,isOwner])=>({userId,role,isOwner,displayName:userId,status:'active',version:1,teamIds:['a']}));
 const contact={version:1,method:'sms',destination:'TEST-PATIENT',ownership:'personal',language:'en',timezone:'Asia/Kolkata',from:'09:00',to:'17:00',permission:true,privateContact:false,reference:'SYNTHETIC',updatedAt:'2026-09-27T00:00:00Z',by:'author'};
 check(()=>assert.equal(inContactWindow(contact,'2026-09-27T03:29:00Z'),false));
 check(()=>assert.equal(inContactWindow(contact,'2026-09-27T03:30:00Z'),true));
 check(()=>assert.equal(inContactWindow(contact,'2026-09-27T11:30:00Z'),false));
 for(const [at,expected] of [['2026-01-15T14:00:00Z',true],['2026-07-15T13:00:00Z',true],['2026-07-15T12:59:00Z',false]])check(()=>assert.equal(inContactWindow({...contact,timezone:'America/New_York'},at),expected));
 for(const destination of ['+919999999999','919999999999','https://example.test','TEST-<script>'])check(()=>assert.equal(contactSchema.safeParse({...Object.fromEntries(Object.entries(contact).filter(([k])=>!['version','updatedAt','by'].includes(k))),destination}).success,false));
 const now='2026-09-27T04:00:00.000Z';
 const s={organisation:{id:'org'},members,workspace:{role:'clinician',people:[{id:'p',version:1,assigned:true,name:'Synthetic person',age:30,sex:'Unknown',village:'Synthetic',teamId:'a',assignedTo:'worker',contactPreferences:contact}],visits:[],audit:[]},outreach:{plans:[{id:'plan',version:1,state:'scheduled',createdBy:'author',items:[{id:'item',personId:'p',ownerId:'worker',state:'planned',events:[]}],history:[]}],templates:[{id:'template',version:2,language:'en',body:MESSAGE_COPY.en,state:'approved',createdBy:'author',reviewedBy:'operator',reviewerVersion:1}],messages:[]}};
 const v={id:'message',version:1,planId:'plan',itemId:'item',personId:'p',templateId:'template',templateVersion:2,body:MESSAGE_COPY.en,scheduledAt:now,createdAt:now,createdBy:'author',authorVersion:1,state:'draft',attempts:[]};s.outreach.messages.push(v);
 const preview=await messageReview(s,v,now);await applyOutreach(s,{type:'messageApprove',messageId:v.id,version:1,hash:preview.hash},{userId:'reviewer',displayName:'reviewer'},members[1],now);check(()=>assert.equal(v.state,'approved'));
 check(()=>assert.deepEqual({actorId:v.approval.actorId,actorVersion:v.approval.actorVersion,taskId:v.approval.taskId,taskVersion:v.approval.taskVersion,evidenceHash:v.approval.evidenceHash,action:v.approval.action,destination:v.approval.destination,purpose:v.approval.purpose},{actorId:'reviewer',actorVersion:1,taskId:'message',taskVersion:2,evidenceHash:preview.hash,action:'simulate-contact-attempt',destination:'TEST-PATIENT',purpose:'outreach-reminder'}));
 const simulate=async(state,at=now)=>applyOutreach(state,{type:'messageSimulate',messageId:v.id,version:2,outcome:'simulated'},{userId:'author',displayName:'author'},state.members[0],at);
 for(const mutate of [x=>x.members[0].version++,x=>x.members[0].status='suspended',x=>x.members[1].version++,x=>x.members[1].teamIds=[],x=>x.members[2].status='suspended',x=>x.members[3].status='suspended',x=>x.workspace.people[0].name='Changed identity',x=>x.workspace.people[0].contactPreferences.permission=false,x=>x.workspace.people[0].contactPreferences.destination='TEST-CHANGED',x=>x.outreach.plans[0].version++,x=>x.outreach.plans[0].items[0].state='completed']){
  const copy=structuredClone(s);mutate(copy);await assert.rejects(()=>simulate(copy));passed++;check(()=>assert.equal(copy.outreach.messages[0].attempts.length,0));
 }
 for(const mutate of [a=>a.actorId='author',a=>a.taskVersion++,a=>a.evidenceHash='0'.repeat(64),a=>a.action='send-real-message',a=>a.destination='TEST-OTHER',a=>a.purpose='different-purpose',a=>a.capabilityVersions={...a.capabilityVersions,template:'template:999'},a=>a.bindingHash='f'.repeat(64)]){
  const copy=structuredClone(s);mutate(copy.outreach.messages[0].approval);await assert.rejects(()=>simulate(copy),/expired or access\/context changed/);passed++;check(()=>assert.equal(copy.outreach.messages[0].attempts.length,0));
 }
 await assert.rejects(()=>simulate(structuredClone(s),'2026-09-28T04:00:00.001Z'),/expired/);passed++;
 await assert.rejects(()=>simulate(structuredClone(s),'2026-09-27T12:00:00.000Z'),/hours/);passed++;
 const repeated=structuredClone(s),msg=repeated.outreach.messages[0];
 for(let n=0;n<3;n++){
  if(n){await applyOutreach(repeated,{type:'messageRetry',messageId:msg.id,version:msg.version,scheduledAt:now,reason:'Retry the same synthetic message record.'},{userId:'author',displayName:'author'},members[0],now);const p=await messageReview(repeated,msg,now);await applyOutreach(repeated,{type:'messageApprove',messageId:msg.id,version:msg.version,hash:p.hash},{userId:'reviewer',displayName:'reviewer'},members[1],now);}
  await applyOutreach(repeated,{type:'messageSimulate',messageId:msg.id,version:msg.version,outcome:'failed'},{userId:'author',displayName:'author'},members[0],now);
 }
 check(()=>assert.equal(msg.attempts.length,3));check(()=>assert.equal(new Set(msg.attempts.map(a=>a.receipt)).size,3));
 await assert.rejects(()=>applyOutreach(repeated,{type:'messageRetry',messageId:msg.id,version:msg.version,scheduledAt:now,reason:'The fourth attempt must be rejected.'},{userId:'author',displayName:'author'},members[0],now),/limit/);passed++;
 for(const command of [{type:'messageCancel'},{type:'messageResolve'},{type:'setContactPreferences',preferences:{permission:false}},{type:'messageTemplateReview',state:'suspended'},{type:'outreachTransition',state:'cancelled'}])check(()=>assert.equal(maintenanceAllows(command),true));
 for(const command of [{type:'messageSimulate'},{type:'messageCreate'},{type:'setContactPreferences',preferences:{permission:true}},{type:'expansionReview'}])check(()=>assert.equal(maintenanceAllows(command),false));
 const spec={kind:'location',name:'Synthetic location',jurisdiction:'Synthetic district',population:'Synthetic adult records',languages:['en'],purpose:'Synthetic workflow evaluation',localDifferences:'Different local accountable team',dependencies:'External acceptance remains required',rollback:'Pause and preserve work before restoring configuration'};
 const x={id:'proposal',version:1,spec,ownerId:'operator',reviewerId:'author',createdBy:'operator',state:'reviewed',evidence:[]};const specHash=await digest(spec);x.evidence=EXPANSION_CHECKS.map(check=>({check,specHash,reference:'SYNTHETIC',findings:'Synthetic reference only'}));x.review={hash:(await expansionStatus(s,x)).hash};check(()=>assert.equal((x.review.hash).length,64));
 const ready=await expansionStatus(s,x);check(()=>assert.equal(ready.reviewCurrent,true));check(()=>assert.equal(ready.liveEnabled,false));
 for(const mutate of [c=>c.members[2].status='suspended',c=>c.members[0].version++,c=>c.members[0].isOwner=false]){const copy=structuredClone(s);mutate(copy);const status=await expansionStatus(copy,x);check(()=>assert.equal(status.reviewCurrent,false));}
 const changed=structuredClone(x);changed.spec.population='A newly defined population';const status=await expansionStatus(s,changed);check(()=>assert.equal(status.missing.length,6));check(()=>assert.equal(status.reviewCurrent,false));
 writeFileSync('tests/outreach-contract-result.json',JSON.stringify({passed,suite:'contact windows, stale message authority, bounded retries, maintenance and expansion review',completedAt:new Date().toISOString()},null,2)+'\n');console.log(`${passed} outreach contract checks passed`);
}finally{rmSync(dir,{recursive:true,force:true})}
