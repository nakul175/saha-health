import assert from 'node:assert/strict';import ts from 'typescript';import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';import {join} from 'node:path';import {pathToFileURL} from 'node:url';
import {derive,seal,unseal,verifyPacket,packetHash} from '../public/field/vault.js';
const dir=mkdtempSync(join(process.cwd(),'.field-contract-'));let passed=0;const check=fn=>{fn();passed++},rejects=async(fn,re)=>{await assert.rejects(fn,re);passed++};
try{
 for(const f of ['abdm', 'abdm-transfer', 'access', 'action-plan', 'adapter-operations', 'agent', 'agent-minimisation', 'ai-budget', 'alerts', 'anaemia', 'audit-chain', 'capability-lifecycle', 'caseload', 'consent', 'continuity', 'core', 'delegation', 'ehr', 'environment', 'evaluation', 'exceptional', 'expansion', 'facility-scope', 'fact-provenance', 'fhir-document', 'fhir-validate', 'field', 'field-device', 'field-registration', 'governance', 'household', 'household-constants', 'household-visit', 'household-visit-constants', 'identity', 'imported-visits', 'media', 'merge', 'mis', 'operations', 'outreach', 'pack-installation', 'partition', 'pilot', 'programme-commands', 'programmes', 'provider-sandbox', 'purpose-scope', 'referral-needs', 'referral-request', 'referral-rules', 'retention', 'rights', 'seed', 'send-gate', 'service-identity', 'shadow', 'store', 'task-limits', 'types', 'withdrawal-notices']){writeFileSync(join(dir,f+'.js'),ts.transpileModule(readFileSync(`lib/saha/${f}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'"));}
 const {applyField,fieldSchema}=await import(pathToFileURL(join(dir,'field.js')));
 const actor={userId:'worker',displayName:'Synthetic worker'},member={userId:'worker',version:1,role:'clinician',isOwner:true,status:'active',teamIds:['team']},p={id:'patient',name:'Synthetic Test',age:30,sex:'Other',village:'Test village',teamId:'team',assignedTo:'worker',version:1,assigned:true,consentVersion:1};
 const s={organisation:{id:'org'},members:[member],workspace:{role:'clinician',people:[p],visits:[],referrals:[],audit:[],integrations:[],submissions:[]}};
 const prepare=()=>applyField(s,{type:'prepareFieldVisit',personId:p.id,version:p.version},actor,member);
 let grant=await prepare(),payload=grant.packet.payload;
 check(()=>assert.equal(payload.userId,actor.userId));check(()=>assert.equal(payload.organisationId,'org'));check(()=>assert.equal(Date.parse(payload.expiresAt)-Date.parse(payload.issuedAt),86400000));
 assert.ok(await verifyPacket(grant.packet));passed++;assert.equal(await packetHash(grant.packet),grant.packageHash);passed++;
 const altered=structuredClone(grant.packet);altered.payload.personName='Wrong patient';assert.equal(await verifyPacket(altered),false);passed++;
 const salt=Array.from(crypto.getRandomValues(new Uint8Array(16))),key=await derive('synthetic-passphrase-123',salt),value={grant,notes:'Unique private synthetic note'};
 const encrypted=await seal(key,value);check(()=>assert.ok(!JSON.stringify(encrypted).includes(value.notes)));check(()=>assert.deepEqual(encrypted.cipher instanceof Array,true));
 const restoredKey=await derive('synthetic-passphrase-123',salt);check(()=>assert.deepEqual(encrypted.iv.length,12));assert.deepEqual(await unseal(restoredKey,encrypted),value);passed++;
 const wrong=await derive('incorrect-passphrase-123',salt);await rejects(()=>unseal(wrong,encrypted));const bad=structuredClone(encrypted);bad.cipher[0]^=1;await rejects(()=>unseal(key,bad));
 const encrypted2=await seal(key,value);check(()=>assert.notDeepEqual(encrypted2.iv,encrypted.iv));await rejects(()=>derive('short',salt),/12/);
 const command=()=>({type:'syncFieldVisit',personId:p.id,leaseId:grant.packet.payload.leaseId,packageHash:grant.packageHash,facts:{...grant.packet.payload.facts,weight:'62',notes:'Captured without network'},answers:{},absence:{}});
 check(()=>assert.equal(fieldSchema.safeParse({...command(),confirmed:true}).success,false));
 await rejects(()=>applyField(s,command(),actor,{...member,role:'admin'}),/care role/);
 await rejects(()=>applyField(s,command(),{...actor,userId:'other'},member),/another worker|worker or membership/);
 await rejects(()=>applyField(s,command(),actor,{...member,version:2}),/membership/);
 const lease=p.fieldLeases.at(-1);lease.expiresAt='2020-01-01T00:00:00.000Z';await rejects(()=>applyField(s,command(),actor,member),/expired/);lease.expiresAt=payload.expiresAt;
 await rejects(()=>applyField(s,{...command(),packageHash:'0'.repeat(64)},actor,member),/Identity/);
 p.name='Changed identity';await rejects(()=>applyField(s,command(),actor,member),/Identity/);p.name='Synthetic Test';p.consentVersion++;await rejects(()=>applyField(s,command(),actor,member),/permission/);p.consentVersion--;
 const v=s.workspace.visits[0];v.version++;await rejects(()=>applyField(s,command(),actor,member),/server visit/);v.version--;v.state='confirmed';await rejects(()=>applyField(s,command(),actor,member),/server visit/);v.state='draft';
 await applyField(s,command(),actor,member);check(()=>{assert.equal(v.state,'draft');assert.equal(v.facts.weight,'62');assert.equal(lease.status,'synced');assert.equal(v.fieldSync.leaseId,lease.id);assert.ok(Date.parse(v.fieldSync.at)>0)});await rejects(()=>applyField(s,command(),actor,member),/already synced/);
 grant=await prepare();await applyField(s,{type:'revokeFieldLease',personId:p.id,leaseId:grant.packet.payload.leaseId},actor,member);await rejects(()=>applyField(s,command(),actor,member),/revoked/);
 grant=await prepare();const old=grant;grant=await prepare();check(()=>assert.equal(p.fieldLeases.find(l=>l.id===old.packet.payload.leaseId).status,'revoked'));
 v.state='confirmed';const now=new Date().toISOString(),r={id:'ref',personId:p.id,visitId:v.id,facility:'Synthetic facility',state:'draft',createdAt:now};s.workspace.referrals.push(r);
 const event={type:'recordReferralEvent',referralId:r.id,version:1,event:'sent',note:'Synthetic call confirmed',source:'worker-observed',evidenceReference:'TEST-REF',occurredAt:now,confirmed:true};
 await rejects(()=>applyField(s,event,actor,member),/Assign an owner/);
 await applyField(s,{type:'assignReferral',referralId:r.id,version:1,ownerId:actor.userId,due:now.slice(0,10),reason:'Care follow-up responsibility'},actor,member);passed++;
 await rejects(()=>applyField(s,event,actor,member),/changed/);await rejects(()=>applyField(s,{...event,version:2,event:'completed'},actor,member),/in order/);
 await rejects(()=>applyField(s,{...event,version:2,occurredAt:'2099-01-01T00:00:00.000Z'},actor,member),/Event time/);
 for(const state of ['sent','received','completed']){await applyField(s,{...event,event:state,version:r.version},actor,member);passed++;}
 check(()=>{assert.equal(r.state,'completed');assert.equal(r.events.length,3);assert.equal(r.events.at(-1).actorId,actor.userId)});
 await rejects(()=>applyField(s,{...event,version:r.version},actor,member),/immutable/);
 writeFileSync('tests/field-contract-result.json',JSON.stringify({passed,at:new Date().toISOString(),coverage:'Cryptography restart, tamper and wrong-key rejection; signed grants; identity, permission, membership, expiry and version checks; referral evidence state machine. No browser storage or real facility acceptance implied.'},null,2));console.log(`${passed} field and encryption contract checks passed`);
}finally{rmSync(dir,{recursive:true,force:true})}
