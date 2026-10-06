import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {identity,client} from './lib/worker.mjs';
import {startMiniflare} from './lib/miniflare.mjs';
const beforeMode=process.env.SAHA_FIGURE_REVIEW_EXPECT_STALE==='1';let passed=0;const equal=(a,b,m)=>{assert.equal(a,b,m);passed++};
const w=await startMiniflare({port:9003,name:'figures-review-submission'});const observations=[];
try {
 const api=client(w.base),o=identity('figure-review-owner'),r=identity('figure-review-manager'),s=(await api.get(o,'/api/workspace')).json,org=s.organisation.id,db=await w.mf.getD1Database('DB'),reason='Synthetic independent frozen source freshness challenge';
 const cmd=async(who,c)=>{const x=await api.command(who,c,org);equal(x.status,200,x.text);return x.json};
 const post=async(who,c)=>api.call(who,'/api/indicator-figures',{method:'POST',org,body:c});
 const snapshot=async()=>(await api.get(o,'/api/workspace',org)).json;
 const reviewer=(await api.get(r,'/api/workspace')).json;const inv=(await cmd(o,{type:'createInvite',accountCode:reviewer.user.accountCode,label:'Synthetic independent reporting reviewer',role:'supervisor',teamIds:['default']})).result;await cmd(r,{type:'joinOrganisation',token:inv.token});
 await cmd(o,{type:'registerIntegration',name:'Synthetic frozen delivery source',kind:'mis',endpoint:'https://programme.example/v1/visits',credentialBinding:'SAHA_MIS_TEST',description:'Previously onboarded local fixture only; external transport remains disabled'});
 let t=await snapshot(),i=t.integrations.find(x=>x.name==='Synthetic frozen delivery source');
 await cmd(o,{type:'configureMis',integrationId:i.id,version:i.version,programmes:['General care'],mapping:[{source:'personId',target:'person_ref',required:true}],corrections:true});
 t=await snapshot();i=t.integrations.find(x=>x.id===i.id);i.status='active';i.mis.test={at:new Date().toISOString(),version:i.version,ok:true,message:'Local previously onboarded fixture; no transport grant or provider enabled'};
 await db.prepare('UPDATE integrations SET status=?,data=? WHERE org_id=? AND id=?').bind(i.status,JSON.stringify(i),org,i.id).run();
 const p=t.people.find(x=>x.programmes.includes('General care'));assert.ok(p,'Seed has general care member');await cmd(o,{type:'setConsent',personId:p.id,version:p.version,purpose:'exchange',active:true});
 const vid=(await cmd(o,{type:'startVisit',personId:p.id})).result.visitId;t=await snapshot();let v=t.visits.find(x=>x.id===vid);
 await cmd(o,{type:'saveVisit',visitId:vid,version:v.version,facts:{date:new Date(Date.now()-60000).toISOString().slice(0,16),weight:'55',systolic:'',diastolic:'',temperature:'',weeks:'',coughDays:'',notes:'Synthetic frozen source',source:'measured'}});
 t=await snapshot();v=t.visits.find(x=>x.id===vid);await cmd(o,{type:'confirmVisit',visitId:vid,version:v.version,patientCheck:{personId:p.id,personVersion:t.people.find(x=>x.id===p.id).version,confirmed:true}});
 await cmd(o,{type:'preparePlan',visitId:vid,recipients:[i.id]});t=await snapshot();v=t.visits.find(x=>x.id===vid);await cmd(o,{type:'approvePlan',visitId:vid,planId:v.plan.id,payloadHash:v.plan.payloadHash});await cmd(o,{type:'executePlan',visitId:vid,planId:v.plan.id});
 t=await snapshot();const sub=t.submissions.find(x=>x.visitId===vid);equal(sub.state,'queued');equal(sub.attempts,0);
 const prepared=await post(o,{type:'prepare',query:{ids:['submissions-unresolved@1'],days:30,group:'none'},cutoff:new Date().toISOString(),reason});equal(prepared.status,200,prepared.text);const fid=prepared.json.figureId;
 const beforeUnit=JSON.parse((await db.prepare('SELECT data FROM indicator_figure_units WHERE org_id=? AND figure_id=? AND person_id=?').bind(org,fid,p.id).first()).data);
 const approvedDraft=await post(o,{type:'prepare',query:{ids:['submissions-unresolved@1'],days:30,group:'none'},cutoff:new Date().toISOString(),reason});equal(approvedDraft.status,200,approvedDraft.text);const approvedBefore=await post(r,{type:'review',figureId:approvedDraft.json.figureId,expectedSequence:1,decision:'approve',reason});equal(approvedBefore.status,200,approvedBefore.text);
 const beforePerson=t.people.find(x=>x.id===p.id),beforeVisit=t.visits.find(x=>x.id===vid);
 await cmd(o,{type:'cancelSubmission',submissionId:sub.id});const after=await snapshot();equal(after.submissions.find(x=>x.id===sub.id).state,'cancelled');equal(after.people.find(x=>x.id===p.id).version,beforePerson.version);equal(after.visits.find(x=>x.id===vid).version,beforeVisit.version);
 const fresh=await post(o,{type:'prepare',query:{ids:['submissions-unresolved@1'],days:30,group:'none'},cutoff:new Date().toISOString(),reason});equal(fresh.status,200,fresh.text);
 const afterUnit=JSON.parse((await db.prepare('SELECT data FROM indicator_figure_units WHERE org_id=? AND figure_id=? AND person_id=?').bind(org,fresh.json.figureId,p.id).first()).data);
 const reviewed=await post(r,{type:'review',figureId:fid,expectedSequence:1,decision:'approve',reason});
 const published=await post(o,{type:'publish',figureId:approvedDraft.json.figureId,expectedSequence:2,reviewId:approvedBefore.json.eventId,reason});
 equal(beforeUnit.unresolved,1);equal(afterUnit.unresolved,0);equal(beforeUnit.sourceHash===afterUnit.sourceHash,beforeMode);equal(reviewed.status,beforeMode?200:409,reviewed.text);equal(published.status,beforeMode?200:409,published.text);
 observations.push({publishStatus:published.status,beforeUnresolved:beforeUnit.unresolved,afterUnresolved:afterUnit.unresolved,sourceHashUnchanged:beforeUnit.sourceHash===afterUnit.sourceHash,reviewStatus:reviewed.status,reviewBody:reviewed.json,queuedAttempts:sub.attempts,personVersionUnchanged:true,visitVersionUnchanged:true,externalTransportEnabled:false});

 if(beforeMode){
  const legacyDraft=await post(o,{type:'prepare',query:{ids:['submissions-unresolved@1'],days:30,group:'none'},cutoff:new Date().toISOString(),reason});equal(legacyDraft.status,200);
  const legacyApproved=await post(o,{type:'prepare',query:{ids:['submissions-unresolved@1'],days:30,group:'none'},cutoff:new Date().toISOString(),reason});equal(legacyApproved.status,200);
  const legacyReview=await post(r,{type:'review',figureId:legacyApproved.json.figureId,expectedSequence:1,decision:'approve',reason});equal(legacyReview.status,200);
  writeFileSync('.wrangler/figure-review-upgrade.json',JSON.stringify({o,r,org,reason,publishedId:approvedDraft.json.figureId,draftId:legacyDraft.json.figureId,approvedId:legacyApproved.json.figureId,reviewId:legacyReview.json.eventId}));
 }
 mkdirSync('tests/evidence/indicator-figures-review',{recursive:true});writeFileSync('tests/evidence/indicator-figures-review/submission-freshness-'+(beforeMode?'before':'after')+'.json',JSON.stringify({passed,failed:beforeMode?2:0,diagnosticBeforeMode:beforeMode,expectedSafeReviewStatus:409,expectedSafePublishStatus:409,actualWorker:true,actualD1:true,observations},null,2)+'\n');console.log(JSON.stringify(observations));
} finally {await w.stop()}
