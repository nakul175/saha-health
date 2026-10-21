import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {startMiniflare} from './lib/miniflare.mjs';
import {identity,client} from './lib/worker.mjs';

const worker=await startMiniflare({port:20939,name:'training-competency'});
let passed=0;
const check=(value,message)=>{assert.ok(value,message);passed++};
try{
 const api=client(worker.base),owner=identity('training-owner'),participant=identity('training-worker'),supervisor=identity('training-supervisor'),clinician=identity('training-clinician'),admin=identity('training-admin');
 const home=(await api.get(owner,'/api/workspace')).json,org=home.organisation.id;
 const join=async(who,role,teamIds=['default'])=>{const own=(await api.get(who,'/api/workspace')).json,invited=await api.command(owner,{type:'createInvite',accountCode:own.user.accountCode,label:`Training ${role}`,role,teamIds},org);check(invited.status===200,invited.text);const accepted=await api.command(who,{type:'joinOrganisation',token:invited.json.result.token},org);check(accepted.status===200,accepted.text);};
 await join(participant,'asha');await join(supervisor,'supervisor');await join(clinician,'clinician');await join(admin,'admin',[]);
 const created=await api.command(owner,{type:'createPerson',name:'Synthetic competency person',age:29,sex:'Female',village:'Synthetic training site',programme:'Maternal care',teamId:'default'},org);check(created.status===200,created.text);let person=created.json.snapshot.people.find(x=>x.id===created.json.result.personId);const enrolled=await api.command(owner,{type:'enrolProgramme',personId:person.id,version:person.version,packId:'maternal',episodeLabel:'Synthetic competency rehearsal',startDate:null},org);check(enrolled.status===200,enrolled.text);
 const today=new Date().toISOString().slice(0,10),configuration={name:'Synthetic role competency',location:'Synthetic training site',teamIds:['default'],participantIds:[participant.id],packIds:['maternal'],connectionIds:[],reviewers:{programme:supervisor.id,clinical:clinician.id,security:admin.id,deployment:owner.id},start:today,end:today,recordLimit:10,stopRule:'Stop for identity, safety, assistance or uncertain submission status.'};
 let version=0;
 const pilot=async(who,body,status=200)=>{const result=await api.command(who,{...body,version},org);check(result.status===status,result.text);if(status===200&&!result.json.replayed)version++;return result.json;};
 await pilot(owner,{type:'pilotConfigure',configuration});
 await pilot(owner,{type:'pilotReviewActivation',userId:participant.id,decision:'eligible',reference:'HTTP-INCOMPLETE',note:'Incomplete training must keep activation restricted.'},409);
 await pilot(supervisor,{type:'pilotReviewActivation',userId:participant.id,decision:'restricted',reference:'HTTP-WRONG-ACTOR',note:'Non-owner activation review must be refused.'},403);
 await pilot(owner,{type:'pilotReviewActivation',userId:participant.id,decision:'restricted',reference:'HTTP-RESTRICTED',note:'Keep live activation restricted during practice.'});
 const failedMatch=await pilot(owner,{type:'pilotAssessTraining',userId:participant.id,module:'matching',result:'needs_practice',reference:'HTTP-MATCH-FAIL',note:'Synthetic ambiguous matching exercise requires more practice.'});await pilot(participant,{type:'pilotAcknowledgeTraining',id:failedMatch.result.trainingId},409);
 const modules=['privacy','matching','capture','continuity','model-limits','escalation','submission-status'];
 for(const module of modules){const assessment=await pilot(owner,{type:'pilotAssessTraining',userId:participant.id,module,result:'passed',reference:`HTTP-${module}`,note:'Observed synthetic role-specific exercise with no real patient data.'});await pilot(participant,{type:'pilotAcknowledgeTraining',id:assessment.result.trainingId});}
 const eligible=await pilot(owner,{type:'pilotReviewActivation',userId:participant.id,decision:'eligible',reference:'HTTP-ELIGIBLE',note:'Every current role-specific competency is passed and acknowledged.'});check(eligible.result.decision==='eligible','Owner records eligible activation evidence');
 let report=await api.get(owner,'/api/pilot',org);check(report.status===200,report.text);check(report.json.readiness.liveCompetencyReady===true&&report.json.readiness.activationMatrix[0].status==='eligible','Fresh D1 readback binds current competency to eligibility');check(report.json.readiness.activationMatrix[0].record.trainingRecordIds.length===modules.length,'Every required exercise is bound to the activation record');
 const own=await api.get(participant,'/api/pilot',org);check(own.status===200&&own.json.pilot.configuration===null&&own.json.readiness.activationMatrix.length===1,'Participant sees only own bounded training and activation status');
 await pilot(owner,{type:'pilotTransition',stage:'live',reason:'Live deployment remains separately unavailable.'},409);
 const refreshed=(await api.get(owner,'/api/workspace',org)).json,member=refreshed.members.find(x=>x.userId===participant.id),changed=await api.command(owner,{type:'updateMember',userId:participant.id,version:member.version,role:'asha',teamIds:member.teamIds,isOwner:false,status:'active',reason:'Synthetic role authority version changed after review'},org);check(changed.status===200,changed.text);
 report=await api.get(owner,'/api/pilot',org);check(report.status===200&&report.json.readiness.liveCompetencyReady===false&&report.json.readiness.activationMatrix[0].status==='training-incomplete','Changed membership invalidates exact training and activation custody');
 const result={passed,failed:0,scope:'Fresh Worker/D1 pilot scope, seven role competency exercises, personal acknowledgement, incomplete/non-owner refusals, restricted and eligible activation records, privacy-bounded participant view, separate live gate and changed-authority invalidation.'};
 mkdirSync('tests/evidence/saha119-local-coding-completion',{recursive:true});writeFileSync('tests/evidence/saha119-local-coding-completion/http.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{await worker.stop();}
