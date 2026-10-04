import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const dir=mkdtempSync(join(process.cwd(),'.continuity-contract-'));let passed=0;const check=f=>{f();passed++};
try{
 for(const f of ['abdm', 'abdm-transfer', 'access', 'action-plan', 'adapter-operations', 'agent', 'agent-minimisation', 'ai-budget', 'alerts', 'anaemia', 'audit-chain', 'capability-lifecycle', 'caseload', 'consent', 'continuity', 'core', 'delegation', 'ehr', 'environment', 'evaluation', 'exceptional', 'expansion', 'facility-scope', 'fact-provenance', 'fhir-document', 'fhir-validate', 'field', 'field-device', 'field-registration', 'governance', 'household', 'household-constants', 'household-visit', 'household-visit-constants', 'identity', 'imported-visits', 'media', 'merge', 'mis', 'operations', 'outreach', 'pack-installation', 'partition', 'pilot', 'programme-commands', 'programmes', 'provider-sandbox', 'purpose-scope', 'referral-needs', 'referral-request', 'referral-rules', 'retention', 'rights', 'seed', 'send-gate', 'service-identity', 'shadow', 'store', 'task-limits', 'types', 'withdrawal-notices'])writeFileSync(join(dir,f+'.js'),ts.transpileModule(readFileSync(`lib/saha/${f}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'"));
 const {patientMatches,reviewRegistration,transferPatientWork,ensurePatientIdentity,openPatientWork}=await import(pathToFileURL(join(dir,'continuity.js')));
 const m={userId:'worker',role:'asha',status:'active',teamIds:['a']},u={userId:'reviewer',displayName:'Synthetic reviewer'},input={name:'Synthetic Alpha',age:31,sex:'Unknown',village:'Synthetic locality',teamId:'a'};
 const p={...input,id:'p',version:1,assigned:true,assignedTo:'worker',followUps:[],fieldLeases:[]},s={workspace:{role:'asha',people:[p],visits:[],referrals:[],submissions:[]},outreach:{plans:[],messages:[]}};
 const search=await patientMatches(s,m,input);check(()=>assert.equal(search.candidates.length,1));
 // Out-of-scope records cannot change the visible match set or its fingerprint.
 s.workspace.people.push({...p,id:'hidden',assignedTo:'elsewhere'});const hidden=await patientMatches(s,m,input);check(()=>assert.deepEqual(hidden,search));
 s.workspace.people[1].version++;const hiddenRevision=await patientMatches(s,m,input);check(()=>assert.equal(hiddenRevision.hash,search.hash));
 p.version++;const changed=await patientMatches(s,m,input);check(()=>assert.notEqual(changed.hash,search.hash));
 await assert.rejects(()=>reviewRegistration(s,m,{...input,registrationReview:{hash:search.hash,decision:'distinct',reason:'Synthetic stale candidate review.'}}),/changed/);passed++;
 const n={...input,name:'Ｓｙｎｔｈｅｔｉｃ　Ａｌｐｈａ'},normalised=await patientMatches(s,m,n);check(()=>assert.equal(normalised.candidates.length,1));
 // Hindi vowel signs must remain meaningful; they must not collapse to equal names.
 p.name='सुनीता';p.village='Other locality';const hindi=await patientMatches(s,m,{...input,name:'सनत'});check(()=>assert.equal(hindi.candidates.length,0));
 const exactHindi=await patientMatches(s,m,{...input,name:'सुनीता'});check(()=>assert.equal(exactHindi.candidates.length,1));
 s.workspace.people=Array.from({length:21},(_,i)=>({...p,...input,id:'p'+i}));const overflow=await patientMatches(s,m,input);check(()=>{assert.equal(overflow.candidates.length,20);assert.equal(overflow.overflow,true)});
 await assert.rejects(()=>reviewRegistration(s,m,{...input,registrationReview:{hash:overflow.hash,decision:'distinct',reason:'Synthetic overflow review cannot bypass the bound.'}}),/Too many/);passed++;
 // Completed work is immutable; open tasks and reminder recovery change together.
 s.workspace.people=[p];p.followUps=[{id:'f-open',state:'open',ownerId:'worker',due:'2026-09-28'},{id:'f-done',state:'completed',ownerId:'worker'}];p.fieldLeases=[{status:'active'},{status:'expired'}];
 s.workspace.referrals=[{id:'r-open',personId:'p',state:'sent',ownerId:'worker',version:2},{id:'r-done',personId:'p',state:'completed',ownerId:'worker',version:3}];
 s.outreach.plans=[{id:'plan',state:'scheduled',version:2,date:'2026-09-28',history:[],items:[{id:'i-open',personId:'p',state:'planned',ownerId:'worker'},{id:'i-done',personId:'p',state:'completed',ownerId:'worker'}]},{id:'closed-plan',state:'completed',version:1,history:[],items:[{id:'i-old',personId:'p',state:'planned',ownerId:'worker'}]}];
 s.outreach.messages=[{id:'m',personId:'p',version:2,state:'approved',attempts:[{receipt:'SIM-KEPT'}],recovery:{state:'open',ownerId:'worker'}}];
 const before=structuredClone(s);check(()=>assert.throws(()=>transferPatientWork(s,p,{teamId:'b',assignedTo:null,reason:'An open task cannot be abandoned.'},u),/responsible/));check(()=>assert.deepEqual(s,before));
 transferPatientWork(s,p,{teamId:'b',assignedTo:'next',reason:'Synthetic transfer with all open responsibilities.'},u,'2026-09-27T00:00:00Z');
 check(()=>assert.deepEqual(openPatientWork(s,p).map(w=>w.ownerId),['next','next','next','next']));
 check(()=>assert.equal(p.followUps[1].ownerId,'worker'));check(()=>assert.equal(s.workspace.referrals[1].version,3));check(()=>assert.equal(s.outreach.plans[0].items[1].ownerId,'worker'));check(()=>assert.equal(s.outreach.plans[1].version,1));
 check(()=>{assert.equal(s.outreach.messages[0].state,'cancelled');assert.equal(s.outreach.messages[0].attempts[0].receipt,'SIM-KEPT')});
 check(()=>assert.deepEqual(p.fieldLeases.map(l=>l.status),['revoked','expired']));check(()=>{assert.equal(p.assignmentHistory.at(-1).openWork,4);assert.equal(p.assignmentHistory.at(-1).fromOwner,'worker');assert.equal(p.assignmentHistory.at(-1).at,'2026-09-27T00:00:00Z')});
 // Even an unassignment with no open work invalidates a previously approved reminder.
 const empty={workspace:{referrals:[]},outreach:{plans:[],messages:[{id:'m2',personId:'q',version:1,state:'approved'}]}},q={...p,id:'q',followUps:[],assignmentHistory:[],fieldLeases:[]};transferPatientWork(empty,q,{teamId:'a',assignedTo:null,reason:'Synthetic unassignment with no remaining open tasks.'},u);check(()=>assert.equal(empty.outreach.messages[0].state,'cancelled'));
 p.identityReview={state:'provisional'};s.workspace.visits=[{id:'v',personId:'p'}];s.workspace.submissions=[{id:'sub',personId:'p'}];
 for(const command of [{type:'confirmVisit',visitId:'v'},{type:'executeAgent',visitId:'v'},{type:'sendSubmission',submissionId:'sub'},{type:'messageSimulate',messageId:'m'},{type:'executeEhrPublish',personId:'p'}])check(()=>assert.throws(()=>ensurePatientIdentity(s,command),/unresolved/));
 for(const command of [{type:'saveVisit',visitId:'v'},{type:'reconcile',submissionId:'sub'},{type:'messageCancel',messageId:'m'}])check(()=>assert.doesNotThrow(()=>ensurePatientIdentity(s,command)));
 writeFileSync('tests/continuity-contract-result.json',JSON.stringify({passed,suite:'scoped candidate fingerprints, Unicode identity, bounded matching, open-work handover and provisional action gates',completedAt:new Date().toISOString()},null,2)+'\n');console.log(`${passed} continuity contract assertions passed`);
}finally{rmSync(dir,{recursive:true,force:true})}
