type DynamicValue = ReturnType<typeof JSON.parse>;

import { db, identity, loadFor, json } from './server';
import { defaultOutreach, messageReview, outreachEvidenceCurrent } from './outreach';
import { allowed } from './access';
import { operator } from './operations';
import { expansionFor, expansionStatus, EXPANSION_CHECKS } from './expansion';
import { digest, fail, uuid } from './core';
import { scope } from './store';
import { recordExportAudit } from './export-audit';
import type { OrgState } from './types';
import { buildDeploymentPack } from './deployment-pack';

export async function outreachRead(request:Request){
 const u=await identity(),s=await loadFor(u,request.headers.get('x-saha-organisation')),m=scope(s,u.userId),o=s.outreach??defaultOutreach();
 const ids=new Set(s.workspace.people.filter(p=>allowed(m,p)).map(p=>p.id));
 const plans=o.plans.map(p=>({...p,items:p.items.filter(i=>ids.has(i.personId)).map(i=>({...i,evidenceCurrent:outreachEvidenceCurrent(s,i)}))})).filter(p=>p.items.length).map(p=>({...p,fullScope:o.plans.find(x=>x.id===p.id)!.items.every(i=>ids.has(i.personId))}));
 const messages=await Promise.all(o.messages.filter(v=>ids.has(v.personId)).map(async v=>{let preview:DynamicValue=null,blocker='';try{preview=await messageReview(s,v);}catch(e){blocker=e instanceof Error?e.message:'Review unavailable.';}return {...v,preview,blocker};}));
 return json({environment:'synthetic',liveMessaging:false,generatedAt:new Date().toISOString(),canManageTemplates:operator(m),canReview:['clinician','supervisor'].includes(m.role),plans,messages,templates:o.templates,channels:o.channels??[],people:s.workspace.people.filter(p=>ids.has(p.id)).map(p=>({id:p.id,name:p.name,village:p.village,version:p.version,teamId:p.teamId,assignedTo:p.assignedTo,preferences:p.contactPreferences??null,preferencesByPurpose:p.contactPreferenceRecords??(p.contactPreferences?[p.contactPreferences]:[]),dueTasks:(p.followUps??[]).filter(t=>t.state==='open').map(t=>({id:t.id,title:t.title,due:t.due,packId:t.packId})),programmes:(p.enrolments??[]).filter(e=>e.state==='active').map(e=>e.packId)})),members:s.members.filter(x=>x.status==='active'&&(operator(m)||x.teamIds.some(t=>m.teamIds.includes(t)))).map(x=>({id:x.userId,name:x.displayName,role:x.role,teamIds:x.teamIds})),teams:s.teams.filter(t=>m.teamIds.includes(t.id)),visits:s.workspace.visits.filter(v=>ids.has(v.personId)&&v.state==='confirmed'&&!v.voidedAt&&!v.supersededBy).map(v=>({id:v.id,personId:v.personId,createdAt:v.createdAt}))});
}
export async function expansionRead(request:Request){
 const u=await identity(),s=await loadFor(u,request.headers.get('x-saha-organisation')),m=scope(s,u.userId);if(!operator(m))fail(403,'Operations access required.');const url=new URL(request.url),format=url.searchParams.get('format')??'json';if(!['json','pack','deployment-pack'].includes(format))fail(422,'Unsupported expansion format.');
 if(format==='json')return json({environment:'synthetic',liveExpansion:false,checks:EXPANSION_CHECKS,proposals:await Promise.all((s.expansions??[]).map(async p=>({...p,readiness:await expansionStatus(s,p)}))),members:s.members.filter(x=>x.status==='active'&&operator(x)).map(x=>({id:x.userId,name:x.displayName,isOwner:x.isOwner})),pilotExitAccepted:false});
 const p=expansionFor(s,url.searchParams.get('id')??''),status=await expansionStatus(s,p);let pack:DynamicValue={format:'saha-expansion-proposal',schema:1,spec:p.spec};
 if(format==='deployment-pack'){if(!p.deployment)fail(409,'Record settings, dependencies, training, tests and operating responsibilities before packaging this deployment.');if(!status.reviewCurrent||!p.review)fail(409,'A current independent proposal review is required before deployment packaging.');pack=await buildDeploymentPack(p.spec,p.deployment,p.version,{hash:status.hash,at:p.review.at});}
 // Slice 6u (fourth review): the export audit goes through recordExportAudit (slice 6p) with operations access checked again.
 const owner=s.members.find(x=>x.userId===p.ownerId),reviewer=s.members.find(x=>x.userId===p.reviewerId),orgId=s.organisation.id,auditId=uuid(),at=new Date().toISOString(),again=(x:OrgState)=>{const o=scope(x,u.userId);if(!operator(o))fail(403,'Operations access required.');if(o.role!==m.role)fail(409,'Your role changed while the export was prepared. Export again.');if(format==='deployment-pack'){const current=expansionFor(x,p.id),ownerNow=x.members.find(v=>v.userId===p.ownerId),reviewerNow=x.members.find(v=>v.userId===p.reviewerId);if(current.version!==p.version||current.state!=='reviewed'||current.review?.hash!==status.hash||JSON.stringify(current.spec)!==JSON.stringify(p.spec)||JSON.stringify(current.deployment)!==JSON.stringify(p.deployment)||!owner||!reviewer||!ownerNow||!reviewerNow||ownerNow.version!==owner.version||reviewerNow.version!==reviewer.version||ownerNow.status!=='active'||reviewerNow.status!=='active'||!operator(ownerNow)||!reviewerNow.isOwner)fail(409,'The deployment package, review or accountable authority changed while the export was prepared. Export again.');}return o;};
 await recordExportAudit(db(),{state:s,reload:()=>loadFor(u,orgId),authorize:again,event:o=>({id:auditId,at,actorId:u.userId,actor:u.displayName,role:o.role,action:'expansionExport',subject:orgId,detail:`${format==='deployment-pack'?'Reviewed deployment package':'Configuration-only expansion proposal'} ${p.id} exported. Evidence, accounts, secret values, credentials and patient records excluded.`}),actor:u,type:'expansionExport',key:'export_'+uuid(),hash:await digest(pack)});
 return new Response(JSON.stringify(pack,null,2),{headers:{'Content-Type':'application/json','Content-Disposition':`attachment; filename="${format==='deployment-pack'?'saha-deployment-pack':'saha-expansion-proposal'}.json"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
