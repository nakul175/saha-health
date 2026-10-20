import { identity, loadFor, json, db } from './server';
import { digest, fail } from './core';
import { scope } from './store';
import { recordAccess } from './access-audit';
import { rightsView } from './rights';
// Slice 6b: rights requests for one patient (partition load), or open requests across the viewer's scope.
export async function rightsRead(request:Request){
 const u=await identity(),personId=new URL(request.url).searchParams.get('personId');
 if(personId!==null&&(!personId||personId.length>200))fail(422,'Choose a person.');
 const s=await loadFor(u,request.headers.get('x-saha-organisation'),personId?async()=>[personId]:undefined);const m=scope(s,u.userId);
 // An owner-admin may read the organisation policy shell, but never a patient
 // request or the scoped queue (rightsView returns no assigned rows for admin).
 if(m.role==='admin'&&personId!==null)fail(403,'Rights requests contain patient information; an administrator role cannot view them.');
 return json(rightsView(s,m,personId));
}

// A requester-facing JSON copy is deliberately patient-scoped and excludes
// organisation settings, staff rosters, audit-chain contents and credentials.
// Its hash is suitable for the append-only `record-copy` evidence entry.
function recordPackage(s:Awaited<ReturnType<typeof loadFor>>,requestId:string,userId:string,now:string){
 const r=(s.rightsRequests??[]).find(x=>x.id===requestId);if(!r)fail(404,'Rights request not found.');if(r.kind!=='access')fail(422,'A portable record copy belongs to an access request.');const m=scope(s,userId),p=s.workspace.people.find(x=>x.id===r.personId);if(!p||!p.assigned)fail(403,'This patient is outside your current care scope.');
 if(!r.policy||!r.identity)fail(409,'This legacy request has no captured policy and structured identity evidence; migrate it through an approved review before preparing a package.');
 const canHandle=r.ownerId===m.userId||m.isOwner||m.role==='supervisor';if(!canHandle)fail(403,'Only the request owner or an accountable supervisor can prepare this copy.');
 const patient={id:p.id,name:p.name,age:p.age,sex:p.sex,village:p.village,programmes:p.programmes,task:p.task,due:p.due,status:p.status,createdAt:p.createdAt,version:p.version};
 const visits=s.workspace.visits.filter(x=>x.personId===p.id).map(x=>({id:x.id,state:x.state,facts:x.facts,createdAt:x.createdAt,confirmedAt:x.confirmedAt,recordVersion:x.recordVersion,amendsVisitId:x.amendsVisitId,supersededBy:x.supersededBy,voidedAt:x.voidedAt,voidReason:x.voidReason}));
 const referrals=s.workspace.referrals.filter(x=>x.personId===p.id).map(x=>({id:x.id,visitId:x.visitId,facility:x.facility,reason:x.reason,state:x.state,createdAt:x.createdAt,due:x.due,appointmentAt:x.appointmentAt}));
 const rightsHistory=(s.rightsRequests??[]).filter(x=>x.personId===p.id).map(x=>({id:x.id,kind:x.kind,state:x.state,receivedAt:x.receivedAt,dueAt:x.dueAt,closed:x.closed?{at:x.closed.at,outcome:x.closed.outcome,response:x.closed.response,evidence:x.closed.evidence}:undefined}));
 return {format:'saha-patient-record-copy-v1',generatedAt:now,request:{id:r.id,receivedAt:r.receivedAt,policy:r.policy,requester:r.requester},patient,visits,referrals,programmeReceipts:s.workspace.submissions.filter(x=>x.personId===p.id).map(x=>({id:x.id,connectorName:x.connectorName,state:x.state,receipt:x.receipt,createdAt:x.createdAt,updatedAt:x.updatedAt})),rightsHistory};
}
export async function rightsPackageRead(request:Request){
 const u=await identity(),url=new URL(request.url);if([...url.searchParams.keys()].some(k=>k!=='requestId'))fail(422,'Use the fixed rights-package query.');const requestId=url.searchParams.get('requestId')??'';if(!requestId||requestId.length>200)fail(422,'Choose an access request.');const s=await loadFor(u,request.headers.get('x-saha-organisation')),now=new Date().toISOString(),body=recordPackage(s,requestId,u.userId,now),hash=await digest(body),r=(s.rightsRequests??[]).find(x=>x.id===requestId)!;
 const m=scope(s,u.userId);await recordAccess(db(),s,u,m,{action:'viewRecordHistory',subject:r.personId,personId:r.personId,detail:`Portable record copy prepared for rights request ${requestId}; SHA-256 ${hash}.`});const fresh=await loadFor(u,s.organisation.id),freshBody=recordPackage(fresh,requestId,u.userId,now);if(await digest(freshBody)!==hash)fail(409,'The patient record changed while the copy was prepared. Prepare it again.');
 return new Response(JSON.stringify(freshBody,null,2)+'\n',{headers:{'Content-Type':'application/json; charset=utf-8','Content-Disposition':`attachment; filename="saha-record-copy-${requestId.slice(0,8)}.json"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Saha-Rights-Package-SHA256':hash}});
}
