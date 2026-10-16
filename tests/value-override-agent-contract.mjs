// Slice 2i contract: the assistant's reviewed field application under the placeholder value ranges (BR-DATA-05). An
// applied value replaces the field's other-unit entry and unusual-value reason; a proposal outside the expected range
// is refused and the worker enters it by hand with a reason. Local structured parser and mock state only.
import assert from 'node:assert/strict';import ts from 'typescript';import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';import {join} from 'node:path';import {pathToFileURL} from 'node:url';
const dir=mkdtempSync(join(process.cwd(),'.value-override-agent-contract-'));let passed=0;const check=fn=>{fn();passed++};
const status=async(fn,code,pattern)=>{try{await fn();}catch(e){assert.equal(e.status,code,e.message);if(pattern)assert.match(e.message,pattern);passed++;return e;}assert.fail(`expected ${code}`);};
try{
 for(const file of ['abdm', 'abdm-transfer', 'access', 'action-plan', 'adapter-operations', 'agent', 'agent-minimisation', 'agent-provider', 'ai-budget', 'alerts', 'anaemia', 'audit-chain', 'capability-lifecycle', 'caseload', 'consent', 'continuity', 'core', 'delegation', 'ehr', 'environment', 'evaluation', 'exceptional', 'expansion', 'facility-scope', 'fact-provenance', 'fhir-document', 'fhir-validate', 'field', 'field-registration', 'governance', 'household', 'household-constants', 'household-visit', 'household-visit-constants', 'identity', 'imported-visits', 'media', 'merge', 'mis', 'operations', 'outreach', 'pack-installation', 'partition', 'pilot', 'programme-commands', 'programmes','installed-transition-authority', 'provider-sandbox', 'purpose-scope', 'referral-needs', 'referral-request', 'referral-rules', 'retention', 'rights', 'seed', 'send-gate', 'service-identity', 'shadow', 'store', 'task-limits', 'types'])writeFileSync(join(dir,file+'.js'),ts.transpileModule(readFileSync(`lib/saha/${file}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'"));
 const {markConflicts,agentApply,providers}=await import(pathToFileURL(join(dir,'agent.js')));
 const {invokeAgent}=await import(pathToFileURL(join(dir,'agent-provider.js')));
 const now=new Date().toISOString();
 const worker={userId:'worker',displayName:'Synthetic worker',role:'clinician',status:'active',teamIds:['team'],version:1,isOwner:false};
 const p={id:'patient',name:'Synthetic Subject',village:'Test village',version:1,consentVersion:1,aiConsent:true,teamId:'team',assignedTo:'worker',assigned:true,age:32,programmes:['General care']};
 const v={id:'visit',personId:p.id,version:3,recordVersion:1,state:'draft',facts:{date:now.slice(0,16),systolic:'',diastolic:'',weight:'',temperature:'',weeks:'',coughDays:'',notes:'',source:'measured',entered:{temperature:{value:'98.6',unit:'degF'}}},agentRuns:[]};
 v.facts.temperature='37';
 const s={organisation:{id:'org'},teams:[{id:'team',name:'Care team'}],members:[worker],workspace:{people:[p],visits:[v],referrals:[],audit:[],role:'clinician',integrations:[]},governance:{entries:[],evaluations:[],safety:[]}};
 const ps=providers([],{}),actor=id=>({userId:id,displayName:'Synthetic '+id});
 const result=async(text)=>{const {runId}=await agentApply(s,{type:'prepareAgent',visitId:v.id,version:v.version,providerId:'local',task:'extract',input:text},actor('worker'),worker,ps);const r=v.agentRuns.find(x=>x.id===runId);const o=await invokeAgent(r,v,{},[]);Object.assign(r,{status:'review',callCount:1,output:o.output,warnings:o.warnings,message:o.message,...(o.output.assessment?{assessment:o.output.assessment}:{})});markConflicts(v);return r;};
 const apply=(r,fields,extra={})=>agentApply(s,{type:'applyAgent',visitId:v.id,runId:r.id,version:v.version,fields,includeNote:false,resolve:[],source:'measured',date:now.slice(0,16),...extra},actor('worker'),worker,ps);
 // A proposal outside the expected range is refused; nothing changes.
 const heavy=await result('Weight 180 kg');
 check(()=>assert.deepEqual(heavy.output.proposals.map(x=>[x.field,x.value]),[['weight','180']]));
 await status(()=>apply(heavy,['weight']),422,/^Assistant value not applied\. Weight 180 kg is outside the expected range 2–150 kg \(engineering placeholder — not clinically approved\)/);
 check(()=>{assert.equal(v.facts.weight,'');assert.equal(v.version,3);assert.equal(heavy.status,'review');});
 // An applied value replaces the other-unit entry for that field; other entries stay.
 const usual=await result('Weight 58 kg; temperature 37.2 C');
 await apply(usual,['temperature'],{resolve:['temperature'],conflictReason:'Second synthetic reading taken in Celsius.'});
 check(()=>{assert.equal(v.facts.temperature,'37.2');assert.equal(v.facts.entered,undefined,'the °F entry no longer applies');assert.equal(usual.status,'applied');});
} finally { rmSync(dir,{recursive:true,force:true}); }
writeFileSync('tests/value-override-agent-contract-result.json',JSON.stringify({passed,suite:'value-override-agent-contract',liveProviderTested:false,completedAt:new Date().toISOString(),coverage:'Assistant field application under the placeholder value ranges: an out-of-range proposal refused with nothing changed; an applied value replacing its other-unit entry.'},null,2)+'\n');
console.log(`${passed} value override assistant checks passed`);
