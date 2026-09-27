import { db, identity, loadFor, json } from './server';
import { canMeasure, defaultPilot, pilotReadiness, TRAINING } from './pilot';
import { operator, RELEASE } from './operations';
import { PACKS } from './programmes';
import { persist, scope } from './store';
import { digest, fail, uuid } from './core';
export async function pilotRead(request:Request){
 const u=await identity(),s=await loadFor(u,request.headers.get('x-saha-organisation')),m=scope(s,u.userId),p=s.pilot??defaultPilot(),c=p.configuration,r=await pilotReadiness(s),format=new URL(request.url).searchParams.get('format')??'json';
 if(!['json','export'].includes(format))fail(422,'Unsupported pilot format.');
 const reviewer=!!c&&Object.values(c.reviewers).includes(m.userId),full=operator(m)||reviewer||(m.role==='supervisor'&&!!c&&c.teamIds.every(t=>m.teamIds.includes(t)));
 const clinical=!!c&&m.role!=='admin'&&c.teamIds.every(t=>m.teamIds.includes(t))&&(m.role!=='asha');
 const pilot=full?{...p,measurements:clinical?p.measurements.filter(b=>b.context===r.context):[]}: {...defaultPilot(),version:p.version,configRevision:p.configRevision,stage:p.stage,training:p.training.filter(t=>t.userId===m.userId)};
 const readiness=full?{...r,baseline:clinical?r.baseline:null}: {context:r.context,effectiveStage:r.effectiveStage,liveReady:false,matrix:r.matrix.filter(t=>t.userId===m.userId)};
 const result={release:RELEASE,environment:'synthetic',generatedAt:new Date().toISOString(),title:c?.name??'Pilot readiness',pilot,readiness,training:TRAINING,canManage:full,canConfigure:m.isOwner,canMeasure:canMeasure(m,c),canAssess:full&&(operator(m)||['clinician','supervisor'].includes(m.role)),members:full?s.members.filter(x=>operator(m)||x.userId===m.userId||!!c&&([...c.participantIds,...Object.values(c.reviewers)].includes(x.userId))).map(x=>({id:x.userId,name:x.displayName,role:x.role,status:x.status,isOwner:x.isOwner,teamIds:x.teamIds})):[],teams:full?s.teams.filter(t=>operator(m)||m.teamIds.includes(t.id)):[],packs:PACKS.map(({id,version,name})=>({id,version,name})),connections:full?s.workspace.integrations.filter(i=>i.status==='active'&&i.mode==='demo').map(({id,name,version,kind,mode})=>({id,name,version,kind,mode})):[],incidents:full?(s.operations?.incidents??[]).map(({id,title,severity,state})=>({id,title,severity,state})):[]};
 if(format==='json')return json(result);
 if(!full)fail(403,'Pilot management or named reviewer access is required to export the dossier.');
 const before=structuredClone(s);s.workspace.audit.push({id:uuid(),at:result.generatedAt,actorId:u.userId,actor:u.displayName,role:m.role,action:'pilotExport',subject:s.organisation.id,detail:'Synthetic rehearsal dossier exported with current reporting permissions. Evidence references are user-entered, not verified by Saha.'});await persist(db(),before,s,u,{type:'pilotExport'},'export_'+uuid(),await digest({format}),{ok:true});
 return new Response(JSON.stringify({...result,notice:'Synthetic rehearsal only. Contains account identifiers and user-entered references; keep within the authorised team. Live clinical deployment is unavailable. This export does not constitute external accreditation or partner acceptance.'},null,2),{headers:{'Content-Type':'application/json','Content-Disposition':'attachment; filename="saha-pilot-dossier.json"','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
