import { identity, loadFor, db } from './server';
import { accountCode, persist, scope } from './store';
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
 const built=await buildExport(db(),{orgId:s.organisation.id,member:m,exporter:{userId:u.userId,name:u.displayName,accountCode:await accountCode(u.userId)},exportId,now,includeFhir:fhir==='1',environment:'synthetic'});
 const t=built.manifest.totals,before=structuredClone(s);
 s.workspace.audit.push({id:uuid(),at:new Date().toISOString(),actorId:u.userId,actor:u.displayName,role:m.role,action:'organisationExport',subject:s.organisation.id,detail:`Organisation data export ${exportId}: ${t.files} files, ${t.rows} rows${t.withheld?`, ${t.withheld} patient-linked rows withheld outside the owner's care scope`:', complete'}; ${built.manifest.fhir.documents} FHIR documents; audit chain ${built.manifest.auditChain.verification.status}${built.manifest.auditChain.verification.head?` at head ${built.manifest.auditChain.verification.head.seq}`:''}; manifest SHA-256 ${built.manifestSha256}; archive SHA-256 ${built.archiveSha256}.`});
 await persist(db(),before,s,u,{type:'organisationExport'},'export_'+uuid(),await digest({exportId,archive:built.archiveSha256}),{ok:true});
 return new Response(built.archive,{headers:{'Content-Type':'application/x-tar','Content-Disposition':`attachment; filename="saha-organisation-export-${now.slice(0,10)}-${exportId.slice(0,8)}.tar"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Saha-Export-Id':exportId,'X-Saha-Content-SHA256':built.archiveSha256,'X-Saha-Manifest-SHA256':built.manifestSha256}});
}
