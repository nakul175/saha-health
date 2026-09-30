import { identity, loadFor, db, rawRuntime } from './server';
import { environmentOf } from './environment';
import { accountCode, scope } from './store';
import { recordExportAudit } from './export-audit';
import { digest, fail, uuid } from './core';
import { buildExport } from './data-exit';
// Slice 6m: organisation data exit. Owners only; patient content follows the owner's care scope.
// Reads are not paused by maintenance (the existing rule pauses commands only), so an exit can run
// while the organisation is paused. Each export is recorded in the audit chain with its checksums.
export async function dataExitRead(request:Request){
 const u=await identity(),s=await loadFor(u,request.headers.get('x-saha-organisation')),m=scope(s,u.userId);
 if(!m.isOwner)fail(403,'Only an organisation owner can export the organisation\'s data.');
 const url=new URL(request.url),fhir=url.searchParams.get('fhir')??'0';
 if(!['0','1'].includes(fhir))fail(422,'Choose whether to include FHIR documents (fhir=0 or fhir=1).');
 if((url.searchParams.get('format')??'tar')!=='tar')fail(422,'Unsupported export format.');
 const now=new Date().toISOString(),exportId=uuid();
 const built=await buildExport(db(),{orgId:s.organisation.id,member:m,exporter:{userId:u.userId,name:u.displayName,accountCode:await accountCode(u.userId)},exportId,now,includeFhir:fhir==='1',environment:environmentOf(rawRuntime()).name});
 const t=built.manifest.totals,eventId=uuid(),at=new Date().toISOString(),orgId=s.organisation.id;
 const detail=`Organisation data export ${exportId}: ${t.files} files, ${t.rows} rows${t.withheld?`, ${t.withheld} patient-linked rows withheld outside the owner's care scope`:''}${t.withheldEntries?`, ${t.withheldEntries} patient-linked entries in organisation documents withheld`:''}${built.manifest.scope.complete?', complete':''}; ${built.manifest.fhir.documents} FHIR documents; audit chain ${built.manifest.auditChain.verification.status}${built.manifest.auditChain.verification.head?` at head ${built.manifest.auditChain.verification.head.seq}`:''}; manifest SHA-256 ${built.manifestSha256}; archive SHA-256 ${built.archiveSha256}.`;
 // Slice 6p: a command saved during the export no longer discards it; only the audit commit is retried
 // on a fresh read, and the exporter must still be an active owner there with the same care scope.
 const owner=(x:typeof s)=>{const o=scope(x,u.userId);if(!o.isOwner)fail(403,'Only an organisation owner can export the organisation\'s data.');if(o.role!==m.role||[...o.teamIds].sort().join()!==[...m.teamIds].sort().join())fail(409,'Your care scope changed while the export was prepared. Export again.');return o;};
 await recordExportAudit(db(),{state:s,reload:()=>loadFor(u,orgId),authorize:owner,event:o=>({id:eventId,at,actorId:u.userId,actor:u.displayName,role:o.role,action:'organisationExport',subject:orgId,detail}),actor:u,type:'organisationExport',key:'export_'+uuid(),hash:await digest({exportId,archive:built.archiveSha256})});
 return new Response(built.archive,{headers:{'Content-Type':'application/x-tar','Content-Disposition':`attachment; filename="saha-organisation-export-${now.slice(0,10)}-${exportId.slice(0,8)}.tar"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Saha-Export-Id':exportId,'X-Saha-Content-SHA256':built.archiveSha256,'X-Saha-Manifest-SHA256':built.manifestSha256}});
}
