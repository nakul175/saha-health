import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { globSync, mkdirSync, writeFileSync } from 'node:fs';
import { startWorker } from './lib/worker.mjs';
import { buildWorld } from './lib/nfr-world.mjs';

const evidenceDir='tests/evidence/tenant-record-isolation';
mkdirSync(evidenceDir,{recursive:true});
let worker,sql,passed=0;
const checks=[];
const check=(condition,label)=>{assert.ok(condition,label);passed++;checks.push(label);};
const marker='SAHA127 PRIVATE TENANT MARKER '+crypto.randomUUID();
const noMarker=(response,label)=>check(!response.text.includes(marker)&&!response.text.includes('Quillon Alpha'),label);

try{
 worker=await startWorker({port:'18950',name:'saha127-isolation',state:'.wrangler/saha127-isolation-state'});
 const world=await buildWorld(worker.base,{run:'saha127'}),{api,who,org,visits,mediaId}=world;
 const created=(await world.cmd('owner',{type:'createPerson',name:marker,age:35,sex:'Unknown',village:'Synthetic isolation village',programme:'General care',teamId:'default'},{org})).result.personId;
 await world.cmd('owner',{type:'startVisit',personId:created},{org});

 // Positive controls: exact-tenant search, transactional retrieval and file/download links work for current authority.
 const ownSearch=await api.call(who.owner,'/api/patients',{method:'POST',org,body:{q:marker}});
 check(ownSearch.status===200&&ownSearch.text.includes(marker),'Authorised exact-tenant search returns its own record');
 const ownDetail=await api.get(who.owner,'/api/patients/detail?personId='+created,org);
 check(ownDetail.status===200&&ownDetail.text.includes(marker),'Authorised exact-tenant partition retrieval returns its own record');
 const ownFhir=await api.get(who.owner,'/api/fhir/'+visits.v1+'?organisationId='+org);
 check(ownFhir.status===200&&ownFhir.headers.get('content-type')?.includes('application/fhir+json'),'Authorised exact-tenant FHIR file download succeeds');
 const ownMedia=await api.get(who.asha2,'/api/media/'+mediaId+'?organisationId='+org);
 check(ownMedia.status===200&&ownMedia.headers.get('cache-control')?.includes('no-store'),'Authorised exact-tenant media retrieval succeeds without browser caching');
 const ownExit=await fetch(worker.base+'/api/data-exit',{headers:{...who.owner.headers,'x-saha-organisation':org}});
 const ownExitBytes=Buffer.from(await ownExit.arrayBuffer());
 check(ownExit.status===200&&ownExit.headers.get('content-type')==='application/x-tar'&&ownExitBytes.includes(Buffer.from(marker)),'Authorised exact-tenant archive contains its own record');

 // A foreign or nonexistent tenant is refused at tenant resolution, before any record/search/report/export work.
 const foreignPaths=['/api/workspace','/api/patients','/api/worklists?view=work','/api/patients/detail?personId='+created,'/api/fhir/'+visits.v1+'?organisationId='+org,'/api/media/'+mediaId+'?organisationId='+org,'/api/operations','/api/data-exit'];
 for(const path of foreignPaths){const response=await api.get(who.stranger,path,org);check(response.status===403,'Foreign tenant refused before '+path);noMarker(response,'Foreign refusal discloses no tenant marker on '+path);}
 const missing='org_missing_saha127';
 const foreign=await api.get(who.stranger,'/api/workspace',org),unknown=await api.get(who.stranger,'/api/workspace',missing);
 check(unknown.status===403&&unknown.json?.error===foreign.json?.error,'Missing and foreign tenant use the same refusal without an existence oracle');

 // The same owner can legitimately belong to two tenants. A record key from A remains unavailable in B.
 const second=(await world.cmd('owner',{type:'createOrganisation',name:'Synthetic isolated tenant B'},{org})).result.organisationId;
 const wrongDetail=await api.get(who.owner,'/api/patients/detail?personId='+created,second);
 check(wrongDetail.status===404,'Wrong-tenant patient reference is not found even for an owner of both tenants');noMarker(wrongDetail,'Wrong-tenant detail reveals no source record');
 const wrongFhir=await api.get(who.owner,'/api/fhir/'+visits.v1+'?organisationId='+second);
 check(wrongFhir.status===404,'Wrong-tenant FHIR record reference is not found');noMarker(wrongFhir,'Wrong-tenant FHIR refusal reveals no source record');
 const wrongMedia=await api.get(who.owner,'/api/media/'+mediaId+'?organisationId='+second);
 check(wrongMedia.status===404,'Wrong-tenant media reference is not found');noMarker(wrongMedia,'Wrong-tenant media refusal reveals no source record');
 const isolatedSearch=await api.call(who.owner,'/api/patients',{method:'POST',org:second,body:{q:marker}});
 check(isolatedSearch.status===200&&isolatedSearch.json.rows.length===0&&!isolatedSearch.text.includes(marker),'Tenant-B search neither returns nor counts tenant-A record');
 const secondBefore=(await api.get(who.owner,'/api/workspace',second)).text;
 const wrongWrite=await api.command(who.owner,{type:'startVisit',personId:created},second);
 check(wrongWrite.status===404,'Wrong-tenant transactional reference is refused before mutation');
 const secondAfter=(await api.get(who.owner,'/api/workspace',second)).text;
 check(secondAfter===secondBefore,'Wrong-tenant transaction leaves tenant-B workspace byte-equivalent');
 const secondExit=await fetch(worker.base+'/api/data-exit',{headers:{...who.owner.headers,'x-saha-organisation':second}});
 const secondExitBytes=Buffer.from(await secondExit.arrayBuffer());
 check(secondExit.status===200&&!secondExitBytes.includes(Buffer.from(marker)),'Tenant-B archive excludes tenant-A record');

 // A current membership withdrawal blocks the named tenant before search/export/file work.
 await world.load('owner',org);let member=world.snap.owner.members.find(x=>x.userId===who.clinician.id);
 await world.cmd('owner',{type:'updateMember',userId:member.userId,version:member.version,role:member.role,teamIds:member.teamIds,isOwner:false,status:'suspended',reason:'Synthetic SAHA-127 current authority withdrawal'},{org});
 for(const path of ['/api/workspace','/api/patients/detail?personId='+created,'/api/fhir/'+visits.v1+'?organisationId='+org,'/api/data-exit']){const response=await api.get(who.clinician,path,org);check(response.status===403,'Suspended membership refused before '+path);noMarker(response,'Suspended refusal reveals no tenant marker on '+path);}

 // D1 rows maintain the tenant key across record stores; no visit/media row can join a patient in another tenant.
 const file=globSync('.wrangler/saha127-isolation-state/**/*.sqlite').find(x=>!x.includes('cache'));
 check(!!file,'Fresh local D1 file located for storage-isolation assertions');sql=new DatabaseSync(file);
 const orphanVisits=sql.prepare('SELECT count(*) n FROM visits v LEFT JOIN patients p ON p.org_id=v.org_id AND p.id=v.person_id WHERE p.id IS NULL').get().n;
 const orphanMedia=sql.prepare('SELECT count(*) n FROM media m LEFT JOIN patients p ON p.org_id=m.org_id AND p.id=m.person_id LEFT JOIN visits v ON v.org_id=m.org_id AND v.id=m.visit_id WHERE p.id IS NULL OR v.id IS NULL').get().n;
 check(orphanVisits===0&&orphanMedia===0,'Transactional and file rows retain same-tenant patient/visit lineage');

 // Race: withdraw the exporter inside its fail-closed audit transaction. The prepared archive is withheld.
 const current=sql.prepare('SELECT status,version FROM memberships WHERE org_id=? AND user_id=?').get(org,who.owner.id);
 const quoted=who.owner.id.replaceAll("'","''");
 sql.exec(`CREATE TRIGGER saha127_export_withdraw AFTER INSERT ON audit_events WHEN NEW.action='organisationExport' AND NEW.actor_id='${quoted}' BEGIN UPDATE memberships SET status='suspended',version=version+1 WHERE org_id=NEW.org_id AND user_id=NEW.actor_id; END;`);
 const raced=await fetch(worker.base+'/api/data-exit',{headers:{...who.owner.headers,'x-saha-organisation':org}});
 const racedText=await raced.text();
 sql.exec('DROP TRIGGER saha127_export_withdraw');
 check(raced.status===403&&!raced.headers.get('content-type')?.includes('application/x-tar'),'Authority withdrawal during export withholds the prepared archive');
 check(!racedText.includes(marker),'Authority-race refusal returns no prepared tenant content');
 sql.prepare('UPDATE memberships SET status=?,version=? WHERE org_id=? AND user_id=?').run(current.status,current.version,org,who.owner.id);

 const result={story:'SAHA-127',requirement:'BR-SEC-06',passed,failed:0,checks,actualWorker:true,actualD1:true,syntheticOnly:true,hostedBackupTested:false,formalAcceptance:'not-run',scope:'Exact-tenant positive controls; uniform foreign/missing-tenant refusal; wrong-record transaction/search/FHIR/media/archive isolation across two authorised tenants; changed membership; D1 lineage; export authority race.'};
 writeFileSync(evidenceDir+'/http.json',JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({passed,failed:0}));
}finally{sql?.close();await worker?.stop();}
