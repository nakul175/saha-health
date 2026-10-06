import {identity,loadFor,db,json} from './server';
import {scope,persist} from './store';
import {digest,fail,AppError} from './core';
import {boundedJsonBody} from './request-body';
import {installedWorkSchema,applyInstalledWork,installedWorkRows,policiesOf,occurrencesOf,INSTALLED_WORK_NOTICE,visitSource,governanceGate} from './installed-pack-work';
import {normallyAllowed,allowedFor,purposePermits} from './access';
import {recordPatientWorkView} from './read-audit';
import type {OrgState,Member} from './types';
function reader(s:OrgState,m:Member){if(m.status!=='active'||!['asha','clinician','supervisor'].includes(m.role)||!purposePermits(m,'care-coordination',s.operations?.purposeGrants))fail(403,'Current care membership and care-coordination purpose are required.');}
function patientGate(s:OrgState,m:Member,id:string){reader(s,m);const p=s.workspace.people.find(p=>p.id===id);if(!p||!normallyAllowed(m,p)||!allowedFor(m,p,s.operations?.purposeGrants,'care-coordination'))fail(403,'Current normal care scope and purpose are required.');return p;}
function replayGate(s:OrgState,m:Member,c:any){reader(s,m);if(c.type==='decide'){const p=patientGate(s,m,c.personId),x=occurrencesOf(p).find(x=>x.id===c.occurrenceId),v=s.workspace.visits.find(v=>v.id===x?.visitId);if(!x||!v||m.role!=='clinician'||m.userId===v.patientCheck?.by)fail(403,'Current independent clinician authority is required.');}else{const x=policiesOf(s).find(x=>x.id===c.policyId),team=c.teamId??x?.teamId;if(!team)fail(403,'Current execution governance authority is required.');governanceGate(s,m,team);if((c.type!=='review'&&!m.isOwner)||(c.type==='review'&&(m.role!=='clinician'||m.userId===x?.proposer)))fail(403,'Current execution governance authority is required.');}}
function receiptCommand(s:OrgState,type:string,result:any){if(!['propose','review','activate','suspend','decide'].includes(type))fail(403,'Saved execution result unavailable.');if(type==='decide'){const p=s.workspace.people.find(p=>occurrencesOf(p).some(x=>x.id===result.occurrenceId));if(!p)fail(403,'Saved execution result unavailable.');return {type,personId:p.id,occurrenceId:result.occurrenceId};}return {type,policyId:result.policyId};}
export async function installedWorkWrite(request:Request){
 const u=await identity(),org=request.headers.get('x-saha-organisation');
 if(request.headers.get('x-saha-expected-actor')&&request.headers.get('x-saha-expected-actor')!==u.userId)fail(403,'The original signed-in worker changed.');
 const s=await loadFor(u,org),m=scope(s,u.userId);reader(s,m);
 if((request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)||request.headers.get('sec-fetch-site')==='cross-site')fail(403,'Cross-site changes are not allowed.');
 if(!request.headers.get('content-type')?.startsWith('application/json'))fail(415,'Use JSON for this operation.');
 const raw=await boundedJsonBody(request,8000),parsed=installedWorkSchema.safeParse(raw);if(!parsed.success)fail(422,'Invalid execution governance input.');
 const c=parsed.data,key=request.headers.get('idempotency-key');if(!key||key.length>100||!/^[A-Za-z0-9_-]+$/.test(key))fail(400,'A stable operation key is required.');
 const receiptKey='installed-work:'+key,hash=await digest(c),old=await db().prepare('SELECT org_id,hash,result FROM command_receipts WHERE actor_id=? AND key=?').bind(u.userId,receiptKey).first<{org_id:string;hash:string;result:string}>();
 if(old){if(old.org_id!==s.organisation.id||old.hash!==hash)fail(409,'Operation key belongs to different input.');const latest=await loadFor(u,org);replayGate(latest,scope(latest,u.userId),c);return json({result:JSON.parse(old.result),replayed:true});}
 const before=structuredClone(s),result=await applyInstalledWork(s,c,u,m);
 // This fresh guard does not replace the original CAS baseline. Ordinary concurrent
 // authority/cohort writes still conflict rather than committing on a newer baseline.
 const fresh=await loadFor(u,org),fm=scope(fresh,u.userId);replayGate(fresh,fm,c);
 if(fm.version!==m.version||JSON.stringify(fm)!==JSON.stringify(m))fail(409,'Current membership changed before persistence. Refresh.');
 await persist(db(),before,s,u,{type:'installedWork.'+c.type},receiptKey,hash,result,installedWorkRows(s,before));
 // An atomic batch may already have committed when a final authority change is
 // observed. Never label that accepted outcome as a failed/unknown mutation or
 // disclose a governed result to the now-withdrawn member.
 try{const latest=await loadFor(u,org);replayGate(latest,scope(latest,u.userId),c);}catch(e){const withdrawn=e instanceof AppError&&[401,403].includes(e.status);return json({outcome:'accepted',operationReference:key,error:withdrawn?'The original operation was saved, then permissions changed. Its governed result is withheld. Keep this reference; do not submit again.':'The original operation was saved, but final access verification is unavailable. Its result is withheld. Keep this reference; do not submit again.'},withdrawn?403:503);}
 return json({result});
}
export async function installedWorkRead(request:Request){
 const u=await identity(),org=request.headers.get('x-saha-organisation'),query=new URL(request.url).searchParams,id=query.get('personId'),receiptKey=query.get('receiptKey');let s=await loadFor(u,org),m=scope(s,u.userId);reader(s,m);
 if(receiptKey){if(receiptKey.length>100||!/^[A-Za-z0-9_-]+$/.test(receiptKey))fail(422,'Invalid saved operation reference.');const old=await db().prepare('SELECT org_id,command_type,result FROM command_receipts WHERE actor_id=? AND key=?').bind(u.userId,'installed-work:'+receiptKey).first<{org_id:string;command_type:string;result:string}>();s=await loadFor(u,org);m=scope(s,u.userId);reader(s,m);if(!old)return json({outcome:'unknown'});if(old.org_id!==s.organisation.id||!old.command_type.startsWith('installedWork.'))fail(403,'Saved execution result unavailable.');const result=JSON.parse(old.result);replayGate(s,m,receiptCommand(s,old.command_type.slice('installedWork.'.length),result));return json({outcome:'accepted',result});}
 if(!id){if(!m.isOwner&&m.role!=='clinician')fail(403,'Only a care owner or clinician reads execution governance.');s=await loadFor(u,org);m=scope(s,u.userId);reader(s,m);if(!m.isOwner&&m.role!=='clinician')fail(403,'Current care governance authority is required.');for(const team of m.teamIds)governanceGate(s,m,team);return json({notice:INSTALLED_WORK_NOTICE,policies:policiesOf(s).filter(x=>m.teamIds.includes(x.teamId)),installations:(s.operations?.installedPacks??[]).filter(x=>x.state==='active').map(x=>({id:x.id,name:x.pack.name,hash:x.manifestHash,version:x.version})),teams:s.teams.filter(t=>m.teamIds.includes(t.id)),canPropose:!!m.isOwner,canReview:m.role==='clinician'});}
 const p=patientGate(s,m,id),originalIds=occurrencesOf(p).map(x=>x.id).sort();await recordPatientWorkView(db(),s,u,m,'action plan',occurrencesOf(p).length,p);s=await loadFor(u,org);m=scope(s,u.userId);const current=patientGate(s,m,id),items=[];
 if(JSON.stringify(occurrencesOf(current).map(x=>x.id).sort())!==JSON.stringify(originalIds))fail(409,'Care work changed during audited read. Refresh.');
 for(const x of occurrencesOf(current)){const v=s.workspace.visits.find(v=>v.id===x.visitId);if(!v)fail(409,'Original source is unavailable.');const currentHash=await visitSource(v);items.push({...x,currentVisitVersion:v.version,currentSourceHash:currentHash,currentSourceStatus:currentHash===x.sourceHash&&x.sourceHashVersion===1&&!v.voidedAt&&!v.supersededBy?'current':'review-required',canDecide:m.role==='clinician'&&m.userId!==v.patientCheck?.by&&x.kind==='escalation'&&x.state!=='resolved'});}
 const latest=await loadFor(u,org),lm=scope(latest,u.userId),lp=patientGate(latest,lm,id);if(await digest({person:lp,visits:latest.workspace.visits.filter(v=>v.personId===id)})!==await digest({person:current,visits:s.workspace.visits.filter(v=>v.personId===id)}))fail(409,'Patient source changed before returning audited work. Refresh.');
 return json({notice:INSTALLED_WORK_NOTICE,personId:current.id,personVersion:current.version,items});
}
