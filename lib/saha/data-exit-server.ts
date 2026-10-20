import { mediaBackend, custodyMediaBytes, assertObjectCurrent } from './media-storage';
import { identity, loadFor, db, rawRuntime } from './server';
import { environmentOf } from './environment';
import { accountCode, scope } from './store';
import { recordExportAudit } from './export-audit';
import { digest, fail, uuid } from './core';
import {normallyAllowed,purposePermits} from './access';
import { buildExport, dataExitCompletenessBasis, dataExitRetentionBasis, assertDataExitPatientScope, dataExitStagePlan, dataExitPortableBasis } from './data-exit';
// Slice 6m: organisation data exit. Owners only; patient content follows the owner's care scope.
// Reads are not paused by maintenance (the existing rule pauses commands only), so an exit can run
// while the organisation is paused. Each export is recorded in the audit chain with its checksums.
export async function dataExitRead(request:Request){
 const u=await identity(),s=await loadFor(u,request.headers.get('x-saha-organisation')),m=scope(s,u.userId);
 if(!m.isOwner)fail(403,'Only an organisation owner can export the organisation\'s data.');
 const url=new URL(request.url),fhir=url.searchParams.get('fhir')??'0';
 if(!['0','1'].includes(fhir))fail(422,'Choose whether to include FHIR documents (fhir=0 or fhir=1).');
 if((url.searchParams.get('format')??'tar')!=='tar')fail(422,'Unsupported export format.');
 const size=Number(url.searchParams.get('stageSize')??1000);
 if(url.searchParams.get('plan')==='1'){
  const plan=await dataExitStagePlan(db(),s.organisation.id,m,size);
  return new Response(JSON.stringify({format:plan.format,basis:plan.basis,people:plan.people,size:plan.size,total:plan.total,notice:'No provider is disabled and no external action is sent. Download every numbered part against this exact basis.'}),{headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }
 const stageRaw=url.searchParams.get('stage'),basis=url.searchParams.get('basis');
 let stage:undefined|{number:number;total:number;size:number;basis:string;patientIds:string[]};
 if(stageRaw!==null){const number=Number(stageRaw),plan=await dataExitStagePlan(db(),s.organisation.id,m,size);if(!Number.isInteger(number)||number<1||number>plan.total)fail(422,`Stage must be from 1 to ${plan.total}.`);if(!basis||basis!==plan.basis)fail(409,'The staged exit basis is missing or changed. Prepare a new plan.');stage={number,total:plan.total,size,basis,patientIds:plan.patientIds.slice((number-1)*size,number*size)};}
 const full=(url.searchParams.get('full')??(stage?'1':'0'));
 if(!['0','1'].includes(full))fail(422,'Choose full=0 or full=1.');
 const now=new Date().toISOString(),exportId=uuid();
 const mediaPeople=new Set<string>(),mediaRows=new Map<string,Record<string,any>>();
 const built=await buildExport(db(),{orgId:s.organisation.id,member:m,exporter:{userId:u.userId,name:u.displayName,accountCode:await accountCode(u.userId)},exportId,now,includeFhir:fhir==='1',environment:environmentOf(rawRuntime()).name,fullScope:full==='1',stage,mediaBytes:async row=>{mediaPeople.add(String(row.person_id));mediaRows.set(String(row.id),row);return custodyMediaBytes(db(),row,mediaBackend(rawRuntime()).bucket);}});
 if(await dataExitRetentionBasis(db(),s.organisation.id)!==built.retentionBasis)fail(409,'Retention authority changed while the export was prepared. Export again.');
 if(stage&&await dataExitPortableBasis(db(),s.organisation.id)!==stage.basis)fail(409,'Organisation data changed while the staged export was prepared. Prepare a new plan.');
 const t=built.manifest.totals,eventId=uuid(),at=new Date().toISOString(),orgId=s.organisation.id;
 const detail=`Organisation data export ${exportId}${stage?` stage ${stage.number}/${stage.total}`:''}: ${t.files} files, ${t.rows} rows${t.withheld?`, ${t.withheld} protected or out-of-scope rows withheld`:''}${t.withheldEntries?`, ${t.withheldEntries} patient-linked entries in organisation documents withheld`:''}${built.manifest.scope.complete?', complete':''}; ${built.manifest.fhir.documents} FHIR documents; audit chain ${built.manifest.auditChain.verification.status}${built.manifest.auditChain.verification.head?` at head ${built.manifest.auditChain.verification.head.seq}`:''}; manifest SHA-256 ${built.manifestSha256}; archive SHA-256 ${built.archiveSha256}.`;
 // Slice 6p: a command saved during the export no longer discards it; only the audit commit is retried
 // on a fresh read, and the exporter must still be an active owner there with the same care scope.
 const owner=(x:typeof s)=>{const o=scope(x,u.userId);if(!o.isOwner)fail(403,'Only an organisation owner can export the organisation\'s data.');if(o.role!==m.role||[...o.teamIds].sort().join()!==[...m.teamIds].sort().join())fail(409,'Your care scope changed while the export was prepared. Export again.');if(built.figureCohort.length&&(!(o.role==='supervisor'||o.isOwner)||['admin','provider','asha'].includes(o.role)||!purposePermits(o,'reporting')||built.figureCohort.some(id=>!x.workspace.people.some(p=>p.id===id&&p.assigned&&!p.mergedInto&&normallyAllowed(o,p)))))fail(403,'Original figure cohort or reporting authority changed while preparing the export. Nothing was downloaded.');if(built.calendarTeams.length&&(['admin','provider','asha'].includes(o.role)||!purposePermits(o,'reporting')||!built.calendarTeams.every(id=>o.teamIds.includes(id))||x.workspace.people.some(p=>built.calendarTeams.includes(p.teamId)&&!p.mergedInto&&!normallyAllowed(o,p))))fail(403,'Whole calendar team reporting scope changed. Nothing was downloaded.');return o;};
 await assertDataExitPatientScope(db(),orgId,owner(await loadFor(u,orgId)),built.exportedPeople);
 if(built.completenessBasis&&await dataExitCompletenessBasis(db(),orgId)!==built.completenessBasis)fail(409,'Reporting calendar, producer or evidence changed during export. Nothing was downloaded.');
 await recordExportAudit(db(),{state:s,reload:()=>loadFor(u,orgId),authorize:owner,event:o=>({id:eventId,at,actorId:u.userId,actor:u.displayName,role:o.role,action:'organisationExport',subject:orgId,detail}),actor:u,type:'organisationExport',key:'export_'+uuid(),hash:await digest({exportId,archive:built.archiveSha256})});
 await assertDataExitPatientScope(db(),orgId,owner(await loadFor(u,orgId)),built.exportedPeople);
 if(built.completenessBasis){owner(await loadFor(u,orgId));if(await dataExitCompletenessBasis(db(),orgId)!==built.completenessBasis)fail(409,'Reporting calendar, producer or evidence changed during export audit. Nothing was downloaded.');}
 if(built.figureCohort.length)owner(await loadFor(u,orgId));
 if(stage&&await dataExitPortableBasis(db(),orgId)!==stage.basis)fail(409,'Organisation data changed during staged export audit. Prepare a new plan.');
 // Private media objects were read before export auditing; their whole included patient scope is rechecked before download.
 if(mediaPeople.size){for(const original of mediaRows.values()){const current=await db().prepare('SELECT * FROM media WHERE org_id=? AND id=?').bind(orgId,original.id).first();if(JSON.stringify(current)!==JSON.stringify(original))fail(409,'Media changed while preparing export. Nothing was downloaded.');await assertObjectCurrent(mediaBackend(rawRuntime()).bucket,original);}const fresh=await loadFor(u,orgId),fm=owner(fresh);if([...mediaPeople].some(id=>!fresh.workspace.people.some(p=>p.id===id&&p.assigned&&normallyAllowed(fm,p))))fail(403,'Media care scope changed during export. Nothing was downloaded.');}
 if(await dataExitRetentionBasis(db(),orgId)!==built.retentionBasis)fail(409,'Retention authority changed during export audit. Nothing was downloaded.');
 return new Response(built.archive,{headers:{'Content-Type':'application/x-tar','Content-Disposition':`attachment; filename="saha-organisation-export-${now.slice(0,10)}-${exportId.slice(0,8)}${stage?`-part-${stage.number}-of-${stage.total}`:''}.tar"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Saha-Export-Id':exportId,'X-Saha-Content-SHA256':built.archiveSha256,'X-Saha-Manifest-SHA256':built.manifestSha256,...(stage?{'X-Saha-Export-Part':`${stage.number}/${stage.total}`,'X-Saha-Export-Basis':stage.basis}:{})}});
}
