import { db, identity, loadFor, json } from './server';
import { canMeasure, defaultPilot, pilotReadiness, TRAINING } from './pilot';
import { operator, RELEASE } from './operations';
import { PACKS } from './programmes';
import { scope } from './store';
import { recordExportAudit } from './export-audit';
import type { Member, OrgState } from './types';
import { digest, fail, uuid } from './core';
export async function pilotRead(request:Request){
 const u=await identity(),s=await loadFor(u,request.headers.get('x-saha-organisation')),m=scope(s,u.userId),p=s.pilot??defaultPilot(),c=p.configuration,r=await pilotReadiness(s),format=new URL(request.url).searchParams.get('format')??'json';
 if(!['json','export'].includes(format))fail(422,'Unsupported pilot format.');
 const {full,clinical}=pilotAccess(s,m);
 const pilot=full?{...p,measurements:clinical?p.measurements.filter(b=>b.context===r.context):[]}: {...defaultPilot(),version:p.version,configRevision:p.configRevision,stage:p.stage,training:p.training.filter(t=>t.userId===m.userId)};
 const readiness=full?{...r,baseline:clinical?r.baseline:null}: {context:r.context,effectiveStage:r.effectiveStage,liveReady:false,matrix:r.matrix.filter(t=>t.userId===m.userId)};
 const result={release:RELEASE,environment:'synthetic',generatedAt:new Date().toISOString(),title:c?.name??'Pilot readiness',pilot,readiness,training:TRAINING,canManage:full,canConfigure:m.isOwner,canMeasure:canMeasure(m,c),canAssess:full&&(operator(m)||['clinician','supervisor'].includes(m.role)),members:full?s.members.filter(x=>operator(m)||x.userId===m.userId||!!c&&([...c.participantIds,...Object.values(c.reviewers)].includes(x.userId))).map(x=>({id:x.userId,name:x.displayName,role:x.role,status:x.status,isOwner:x.isOwner,teamIds:x.teamIds})):[],teams:full?s.teams.filter(t=>operator(m)||m.teamIds.includes(t.id)):[],packs:PACKS.map(({id,version,name})=>({id,version,name})),connections:full?s.workspace.integrations.filter(i=>i.status==='active'&&i.mode==='demo').map(({id,name,version,kind,mode})=>({id,name,version,kind,mode})):[],incidents:full?(s.operations?.incidents??[]).map(({id,title,severity,state})=>({id,title,severity,state})):[]};
 if(format==='json')return json(result);
 if(!full)fail(403,'Pilot management or named reviewer access is required to export the dossier.');
 // Slice 6u (fourth review): the export audit goes through recordExportAudit (slice 6p): a concurrent command
 // retries only the audit commit, after checking again that the exporter still has dossier access with the same
 // clinical reach; a change refuses the export and nothing is delivered.
 const orgId=s.organisation.id,auditId=uuid(),again=(x:OrgState)=>{const o=scope(x,u.userId),a=pilotAccess(x,o);if(!a.full)fail(403,'Pilot management or named reviewer access is required to export the dossier.');if(o.role!==m.role||a.clinical!==clinical)fail(409,'Your access changed while the export was prepared. Export again.');return o;};
 await recordExportAudit(db(),{state:s,reload:()=>loadFor(u,orgId),authorize:again,event:o=>({id:auditId,at:result.generatedAt,actorId:u.userId,actor:u.displayName,role:o.role,action:'pilotExport',subject:orgId,detail:'Synthetic rehearsal dossier exported with current reporting permissions. Evidence references are user-entered, not verified by Saha.'}),actor:u,type:'pilotExport',key:'export_'+uuid(),hash:await digest({format})});
 return new Response(JSON.stringify({...result,notice:'Synthetic rehearsal only. Contains account identifiers and user-entered references; keep within the authorised team. Live clinical deployment is unavailable. This export does not constitute external accreditation or partner acceptance.'},null,2),{headers:{'Content-Type':'application/json','Content-Disposition':'attachment; filename="saha-pilot-dossier.json"','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
// Dossier access: operators, named reviewers and supervisors of every pilot team; clinical measurements need a care role in every pilot team.
export function pilotAccess(s:OrgState,m:Member){const c=(s.pilot??defaultPilot()).configuration,reviewer=!!c&&Object.values(c.reviewers).includes(m.userId);
 return {full:operator(m)||reviewer||(m.role==='supervisor'&&!!c&&c.teamIds.every(t=>m.teamIds.includes(t))),clinical:!!c&&m.role!=='admin'&&c.teamIds.every(t=>m.teamIds.includes(t))&&(m.role!=='asha')};}
