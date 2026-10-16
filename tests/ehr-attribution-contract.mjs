import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir=mkdtempSync(join(process.cwd(),'.ehr-attribution-contract-'));let passed=0;
try {
  for (const f of ['abdm','abdm-transfer','access','action-plan','adapter-operations','agent','agent-minimisation','ai-budget','alerts','anaemia','audit-chain','capability-lifecycle','caseload','consent','continuity','core','delegation','ehr','ehr-provider','environment','evaluation','exceptional','expansion','facility-scope','fact-provenance','fhir-document','fhir-validate','field','field-registration','governance','household','household-constants','household-visit','household-visit-constants','identity','imported-visits','media','merge','mis','operations','outreach','pack-installation','partition','pilot','programme-commands','programmes','provider-sandbox','purpose-scope','referral-needs','referral-request','referral-rules','retention','rights','seed','send-gate','service-identity','shadow','store','task-limits','types']) {
    const js=ts.transpileModule(readFileSync(`lib/saha/${f}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'");
    writeFileSync(join(dir,f+'.js'),js);
  }
  const E=await import(pathToFileURL(join(dir,'ehr.js'))),F=await import(pathToFileURL(join(dir,'fhir-document.js')));
  const now=new Date(),past=new Date(now.getTime()-3600000).toISOString(),future=new Date(now.getTime()+86400000).toISOString();
  const actor={userId:'clin-1',displayName:'Synthetic clinician'},member={userId:'clin-1',displayName:'Synthetic clinician',role:'clinician',isOwner:true,status:'active',version:1,teamIds:[],createdAt:past};
  const i={id:'ehr1',name:'Synthetic EHR',kind:'ehr',mode:'http',status:'suspended',version:1,description:'Synthetic',programmes:[],ehr:{read:true,write:true}};
  const s={organisation:{id:'org-1',name:'Synthetic organisation'},members:[member],teams:[],workspace:{audit:[],integrations:[i],people:[],visits:[]},operations:{version:0,maintenance:false,reason:'',updatedAt:'',incidents:[],rates:null,accessScope:{version:1,enforceFacility:true,enforceLocality:false,facilities:[{id:'fac-local',name:'Synthetic PHC',localityId:null,createdAt:past}],localities:[],teamAssignments:{},memberAssignments:{'clin-1':{facilityId:'fac-local'}},updatedAt:past,updatedBy:'owner'}}};
  const cmd={type:'configureEhrAttribution',integrationId:'ehr1',version:1,facilitySystem:'HFR',facilityIdentifier:'HFR-SYN-001',localFacilityId:'fac-local',facilityVerifiedAt:past,facilityExpiresAt:future,professionalSystem:'HPR',professionalIdentifier:'HPR-SYN-001',professionalUserId:'clin-1',professionalRole:'clinician',professionalVerifiedAt:past,professionalExpiresAt:future,reason:'Synthetic registry verification for contract testing'};
  await E.applyEhr(s,cmd,actor,member,{});passed++;
  const a=E.currentEhrAttribution(s,i,actor,member);assert.equal(a.version,1);assert.equal(a.facility.identifier,'HFR-SYN-001');passed++;
  await assert.rejects(()=>E.applyEhr(s,cmd,actor,member,{}),/Connection changed/);passed++;
  await assert.rejects(()=>E.applyEhr({...s,workspace:{...s.workspace,integrations:[{...i,version:1,ehr:{read:true,write:true}}]}},cmd,actor,{...member,isOwner:false},{}),/owner/);passed++;
  assert.throws(()=>E.currentEhrAttribution(s,i,{...actor,userId:'other'},member),/active professional/);passed++;
  assert.throws(()=>E.currentEhrAttribution(s,i,actor,{...member,role:'asha'}),/active professional/);passed++;
  const expired=structuredClone(i);expired.ehr.attribution.professional.expiresAt=past;assert.throws(()=>E.currentEhrAttribution(s,expired,actor,member),/expired/);passed++;
  const moved=structuredClone(s);moved.operations.accessScope.memberAssignments['clin-1']={};assert.throws(()=>E.currentEhrAttribution(moved,i,actor,member),/not assigned/);passed++;
  const p={id:'p',name:'Synthetic Person',sex:'Other',age:30,village:'Synthetic',version:1,consentVersion:1,exchangeConsent:true,assigned:true,assignedWorkerIds:['clin-1'],facilityId:'fac-local'},v={id:'v',personId:'p',version:1,state:'confirmed',facts:{date:'2026-10-16T08:00',source:'reported',weight:'55',temperature:'',systolic:'',diastolic:'',weeks:'',coughDays:'',notes:'Synthetic'}};
  const bundle=F.fhirDocument(p,v,s.organisation.name,actor.displayName,'doc-1','external-1',a),org=bundle.entry.find(e=>e.resource.resourceType==='Organization').resource,practitioner=bundle.entry.find(e=>e.resource.resourceType==='Practitioner').resource;
  assert.deepEqual(org.identifier,[{system:'https://facility.ndhm.gov.in',value:'HFR-SYN-001'}]);assert.deepEqual(practitioner.identifier,[{system:'https://hprid.ndhm.gov.in',value:'HPR-SYN-001'}]);assert.equal(practitioner.qualification[0].code.text,'clinician');passed++;
  const link={id:'link-1',integrationId:i.id,externalId:'external-1',externalName:p.name,identityHash:await E.identityHash(p),status:'active',at:past,verifiedBy:actor.userId,method:'worker-confirmed'},permission={id:'permission-1',linkId:link.id,direction:'write',purpose:'care-coordination',from:'2026-10-16T00:00:00.000Z',to:'2026-10-17T00:00:00.000Z',expiresAt:future,status:'active',at:past};
  p.ehr={links:[link],permissions:[permission],documents:[],operations:[]};s.workspace.people=[p];s.workspace.visits=[v];
  const prepared=await E.applyEhr(s,{type:'prepareEhrPublish',personId:p.id,linkId:link.id,permissionId:permission.id,visitId:v.id},actor,member,{});assert.ok(prepared.operationId);const preparedBundle=p.ehr.operations[0].bundle;assert.equal(preparedBundle.entry.find(e=>e.resource.resourceType==='Organization').resource.identifier[0].value,'HFR-SYN-001');passed++;
  const result={suite:'verified facility and professional attribution contract',passed,completedAt:new Date().toISOString(),formalAcceptance:false,liveRegistryTested:false};writeFileSync('tests/ehr-attribution-contract-result.json',JSON.stringify(result,null,2)+'\n');console.log(result);
} finally { rmSync(dir,{recursive:true,force:true}); }
