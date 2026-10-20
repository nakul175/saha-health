import assert from 'node:assert/strict';
import ts from 'typescript';
import {mkdirSync,writeFileSync,mkdtempSync,rmSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

const dir=mkdtempSync(join(process.cwd(),'.training-competency-'));
let passed=0;
const check=(value,message)=>{assert.ok(value,message);passed++};
try{
 for(const f of readdirSync('lib/saha').filter(file=>file.endsWith('.ts')).map(file=>file.slice(0,-3))){
  const source=ts.transpileModule(await import('node:fs').then(x=>x.readFileSync(`lib/saha/${f}.ts`,'utf8')),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'");
  writeFileSync(join(dir,f+'.js'),source);
 }
 const {TRAINING,defaultPilot,trainingModules,pilotReadiness,applyPilot,authorizePilotCommand}=await import(pathToFileURL(join(dir,'pilot.js')));
 const owner={userId:'owner',displayName:'Owner',role:'clinician',isOwner:true,status:'active',version:1,teamIds:['a']},worker={userId:'worker',displayName:'Worker',role:'asha',isOwner:false,status:'active',version:1,teamIds:['a']},supervisor={userId:'supervisor',displayName:'Supervisor',role:'supervisor',isOwner:false,status:'active',version:1,teamIds:['a']},admin={userId:'admin',displayName:'Admin',role:'admin',isOwner:false,status:'active',version:1,teamIds:[]};
 const cfg={name:'Synthetic competency',location:'Synthetic site',teamIds:['a'],participantIds:['worker'],packIds:['maternal'],connectionIds:[],reviewers:{programme:'supervisor',clinical:'owner',security:'admin',deployment:'owner'},start:'2026-10-20',end:'2026-10-20',recordLimit:10,stopRule:'Stop for identity, safety or uncertain submission status.'};
 const state={organisation:{id:'org'},members:[owner,worker,supervisor,admin],teams:[{id:'a',name:'A'}],pilot:{...defaultPilot(),configuration:cfg,configRevision:1},workspace:{integrations:[],people:[{id:'person',teamId:'a',assignedTo:'worker',enrolments:[{packId:'maternal',state:'active'}]}],visits:[],submissions:[],referrals:[],audit:[]}};
 const required=['privacy','matching','capture','continuity','model-limits','escalation','submission-status'];
 check(required.every(id=>TRAINING.some(x=>x.id===id)),'All frozen competency subjects are represented');
 check(trainingModules(worker).map(x=>x.id).join(',')===required.join(','),'ASHA role requires every competency subject');
 check(trainingModules(admin).map(x=>x.id).join(',')==='privacy,model-limits,escalation,submission-status','Administrative role uses a bounded role-specific matrix');
 let view=await pilotReadiness(state,new Date('2026-10-20T12:00:00Z'));
 check(view.activationMatrix[0].status==='training-incomplete'&&!view.liveCompetencyReady,'Live activation starts restricted');
 assert.throws(()=>authorizePilotCommand(state,supervisor,{type:'pilotReviewActivation'}),/owner/);passed++;
 await assert.rejects(()=>applyPilot(state,{type:'pilotReviewActivation',version:0,userId:'worker',decision:'eligible',reference:'COMP-INCOMPLETE',note:'Incomplete training must remain restricted.'},{userId:'owner',displayName:'Owner'},owner),/remains restricted/);passed++;
 await applyPilot(state,{type:'pilotReviewActivation',version:0,userId:'worker',decision:'restricted',reference:'COMP-RESTRICTED',note:'Retain restriction while exercises are incomplete.'},{userId:'owner',displayName:'Owner'},owner);
 const failedMatch=await applyPilot(state,{type:'pilotAssessTraining',version:state.pilot.version,userId:'worker',module:'matching',result:'needs_practice',reference:'COMP-MATCH-FAIL',note:'Synthetic ambiguous matching exercise requires more practice.'},{userId:'owner',displayName:'Owner'},owner);
 await assert.rejects(()=>applyPilot(state,{type:'pilotAcknowledgeTraining',version:state.pilot.version,id:failedMatch.trainingId},{userId:'worker',displayName:'Worker'},worker),/more practice/);passed++;
 for(const module of required){
  const assessed=await applyPilot(state,{type:'pilotAssessTraining',version:state.pilot.version,userId:'worker',module,result:'passed',reference:`COMP-${module}`,note:'Different assessor observed the synthetic role-specific exercise.'},{userId:'owner',displayName:'Owner'},owner);
  await applyPilot(state,{type:'pilotAcknowledgeTraining',version:state.pilot.version,id:assessed.trainingId},{userId:'worker',displayName:'Worker'},worker);
 }
 view=await pilotReadiness(state,new Date('2026-10-20T12:00:00Z'));
 check(view.activationMatrix[0].status==='review-required'&&!view.liveCompetencyReady,'Completed competency still needs an owner activation record');
 const reviewed=await applyPilot(state,{type:'pilotReviewActivation',version:state.pilot.version,userId:'worker',decision:'eligible',reference:'COMP-ELIGIBLE',note:'Every current role-specific exercise is passed and acknowledged.'},{userId:'owner',displayName:'Owner'},owner);
 check(reviewed.decision==='eligible','Owner records exact current eligibility');
 view=await pilotReadiness(state,new Date('2026-10-20T12:00:00Z'));
 check(view.liveCompetencyReady&&view.activationMatrix[0].record.trainingRecordIds.length===required.length,'Eligibility binds every current assessment record');
 await assert.rejects(()=>applyPilot(state,{type:'pilotTransition',version:state.pilot.version,stage:'live',reason:'External rollout remains a separate gate.'},{userId:'owner',displayName:'Owner'},owner),/External acceptance/);passed++;
 const staleVersion=state.pilot.version-1;
 await assert.rejects(()=>applyPilot(state,{type:'pilotReviewActivation',version:staleVersion,userId:'worker',decision:'eligible',reference:'COMP-STALE',note:'A stale review must be refused.'},{userId:'owner',displayName:'Owner'},owner),/changed/);passed++;
 worker.version++;
 view=await pilotReadiness(state,new Date('2026-10-20T12:00:00Z'));
 check(view.activationMatrix[0].status==='training-incomplete'&&!view.liveCompetencyReady,'Changed membership invalidates training and activation custody');
 check(state.workspace.audit.filter(x=>x.action==='pilotReviewActivation').length===2,'Restricted and eligible reviews remain in audit history');
 const result={passed,failed:0,scope:'Role-specific patient matching, correction, offline, model-limit, escalation and submission-status competency; acknowledgement, restricted/eligible activation records, stale authority/version refusal and separate live rollout gate.'};
 mkdirSync('tests/evidence/saha119-local-coding-completion',{recursive:true});writeFileSync('tests/evidence/saha119-local-coding-completion/contract.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{rmSync(dir,{recursive:true,force:true});}
