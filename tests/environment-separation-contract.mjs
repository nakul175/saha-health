import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';

const dir=mkdtempSync(join(process.cwd(),'.environment-separation-')),seen=new Set();
function compile(name){if(seen.has(name))return;seen.add(name);const source=readFileSync('lib/saha/'+name+'.ts','utf8');let code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;code=code.replace(/from ['"](\.\/[^'"]+)['"]/g,(_,path)=>{const rel=join(dirname(name),path);if(path.endsWith('.json')){const file=join(dir,rel);mkdirSync(dirname(file),{recursive:true});writeFileSync(file,readFileSync('lib/saha/'+rel));return "from '"+path+"' with {type:'json'}";}if(path.endsWith('.mjs')){const file=join(dir,rel);mkdirSync(dirname(file),{recursive:true});writeFileSync(file,readFileSync('lib/saha/'+rel));return "from '"+path+"'";}compile(rel);return "from '"+path+".js'";});const file=join(dir,name+'.js');mkdirSync(dirname(file),{recursive:true});writeFileSync(file,code);}

let passed=0;const check=fn=>{fn();passed++;};
const reject=async(fn,pattern)=>{await assert.rejects(fn,e=>e?.status===409&&pattern.test(e.message));passed++;};
try{
 for(const name of ['environment','mis','fhir-document','ehr-provider','core','agent-minimisation'])compile(name);
 const E=await import(pathToFileURL(join(dir,'environment.js'))),M=await import(pathToFileURL(join(dir,'mis.js'))),F=await import(pathToFileURL(join(dir,'fhir-document.js'))),P=await import(pathToFileURL(join(dir,'ehr-provider.js'))),C=await import(pathToFileURL(join(dir,'core.js'))),A=await import(pathToFileURL(join(dir,'agent-minimisation.js')));
 const bound=name=>({SAHA_ENVIRONMENT:name,SAHA_EXTERNAL_APIS_ENABLED:'true',SAHA_IDENTITY_NAMESPACE:`${name}:identity:tenant-a`,SAHA_DATA_NAMESPACE:`${name}:data:store-a`,SAHA_CREDENTIAL_NAMESPACE:`${name}:credentials:vault-a`});

 // Positive/error: explicit live environments need three correctly bound, non-secret namespaces.
 check(()=>{for(const name of ['training','staging','production']){const checks=E.deploymentChecks(bound(name));for(const kind of ['identity','data','credentials'])assert.equal(checks.find(x=>x.id===`namespace:${kind}`).status,'ok');}});
 check(()=>{const env={...bound('staging'),SAHA_DATA_NAMESPACE:'production:data:store-a'},checks=E.deploymentChecks(env);assert.equal(checks.find(x=>x.id==='namespace:data').status,'error');assert.equal(E.livePolicy(env).allowed,false);assert.match(E.livePolicy(env).reason,/namespace:data/);});
 check(()=>{const secret='do-not-render-this-value',report=E.configurationReport({...bound('staging'),SAHA_CREDENTIAL_NAMESPACE:'staging:credentials:'+secret},{organisation:{id:'org'},workspace:{people:[],integrations:[]}},'2026-10-20T00:00:00.000Z');assert.equal(JSON.stringify(report).includes(secret),false);});

 // Refusal/authorization boundary: training accepts only explicitly synthetic data, including new records.
 const training={organisation:{id:'org'},workspace:{role:'asha',people:[{id:'practice',synthetic:true}],visits:[],submissions:[],referrals:[],integrations:[],audit:[]}};
 check(()=>assert.doesNotThrow(()=>E.ensureEnvironmentDataBoundary(training,bound('training'))));
 check(()=>assert.throws(()=>E.ensureEnvironmentDataBoundary({...training,workspace:{...training.workspace,people:[{id:'live'}]}},bound('training')),/not explicitly synthetic/));
 const newPracticePerson={id:'practice-new'};E.markEnvironmentRecord(newPracticePerson,bound('training'));
 check(()=>assert.equal(newPracticePerson.synthetic,true));

 const integration={id:'mis',name:'MIS',kind:'mis',mode:'http',status:'active',version:1,description:'',programmes:['General care'],endpoint:'https://mis.example.org/v1',credentialBinding:'SAHA_MIS_TOKEN',mis:{contract:'saha-mis-v1',mapping:[{source:'personId',target:'person_ref',required:true}],corrections:false}};
 const state={workspace:{people:[{id:'p',name:'Person',identifiers:[]}],visits:[],submissions:[],integrations:[integration]}};
 const visit={id:'v',personId:'p',facts:{date:'2026-10-20T10:00',source:'measured'}};
 const payload=M.mappedPayload(integration,visit,state,'staging'),payloadHash=await C.digest(payload),wire={...payload,key:'environment-key',payloadHash};
 check(()=>assert.equal(payload.environment,'staging'));
 const misEnv={...bound('staging'),SAHA_MIS_TOKEN:'secret',SAHA_MIS_CONNECTIONS:JSON.stringify([{organisationId:'org',integrationId:'mis',origin:'https://mis.example.org',credentialBinding:'SAHA_MIS_TOKEN'}])};let sends=0;
 await M.misRequest(integration,'org',misEnv,wire,'environment-key',async(_url,init)=>{sends++;assert.equal(init.headers['X-Saha-Environment'],'staging');return Response.json({contract:'saha-mis-v1',key:'environment-key',payloadHash,status:'pending'});});
 check(()=>assert.equal(sends,1));
 await reject(()=>M.misRequest(integration,'org',{...misEnv,...bound('production')},wire,'environment-key',async()=>{sends++;return Response.json({});}),/differs from the current deployment/);
 check(()=>assert.equal(sends,1));

 // Outbound FHIR labels follow the environment, and a deployment change invalidates a prepared body before I/O.
 const person={id:'p',name:'Person',age:30,sex:'Female'},confirmed={id:'v',personId:'p',state:'confirmed',facts:{date:'2026-10-20T10:00',source:'measured',weight:'55'}};
 const bundle=F.fhirDocument(person,confirmed,'Organisation','Worker','doc','external-1','staging');
 check(()=>assert.equal(bundle.meta.tag[0].code,'staging-unvalidated'));
 const ehr={id:'ehr',name:'EHR',kind:'ehr',mode:'http',status:'active',version:1,endpoint:'https://ehr.example.org/fhir',credentialBinding:'SAHA_EHR_TOKEN'},ehrEnv={...bound('staging'),SAHA_EHR_TOKEN:'secret',SAHA_EHR_CONNECTIONS:JSON.stringify([{organisationId:'org',integrationId:'ehr',baseUrl:'https://ehr.example.org/fhir',credentialBinding:'SAHA_EHR_TOKEN'}])},init={method:'POST',headers:{'Content-Type':'application/fhir+json',Prefer:'return=representation','If-None-Exist':'identifier='+encodeURIComponent('urn:saha:documents|doc')},body:JSON.stringify(bundle)};let fhirSends=0;
 await P.fhirRequest(ehr,'org',ehrEnv,'Bundle',init,async(_url,request)=>{fhirSends++;assert.equal(request.headers['X-Saha-Environment'],'staging');return new Response(JSON.stringify(bundle),{headers:{'content-type':'application/fhir+json'}});});
 check(()=>assert.equal(fhirSends,1));
 await reject(()=>P.fhirRequest(ehr,'org',{...ehrEnv,...bound('production')},'Bundle',init,async()=>{fhirSends++;return Response.json({});}),/differs from the current deployment/);
 check(()=>assert.equal(fhirSends,1));
 await reject(async()=>E.outboundEnvironment({SAHA_ENVIRONMENT:'Prod'}),/not configured correctly/);
 check(()=>{const payload=A.minimiseLegacyAiPayload({schemaVersion:'1.0',environment:'staging',purpose:'non-diagnostic visit assistance',facts:{date:'2026-10-20T10:00',systolic:'',diastolic:'',weight:'55',temperature:'',weeks:'',coughDays:'',notes:'',source:'measured'}},new Set());assert.equal(payload.environment,'staging');});
 check(()=>assert.throws(()=>A.minimiseLegacyAiPayload({schemaVersion:'1.0',environment:'Prod',purpose:'non-diagnostic visit assistance',facts:{}},new Set()),/requires review/));

 const result={suite:'SAHA-115 environment separation contract',passed,failed:0,externalRequests:sends+fhirSends,limits:'Synthetic local component evidence. No real provider, credential, database, identity tenant, hosting, deployment or formal acceptance.',completedAt:new Date().toISOString()};
 writeFileSync('tests/environment-separation-contract-result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{rmSync(dir,{recursive:true,force:true});}
