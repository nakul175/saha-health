import type { D1Database } from '@cloudflare/workers-types';
import { digest, fail, uuid } from './core';
import { seedWorkspace } from './seed';
import type { OrgState, Workspace, Member, Person, Visit, Audit, RecordRevision } from './types';
export type Actor={userId:string;displayName:string;email:string};
type Value=string|number|null;
type Row={table:string;values:Record<string,Value>;keys:string[];append?:boolean};
const row=(table:string,values:Record<string,Value>,keys=['org_id','id'],append=false):Row=>({table,values,keys,append});
const j=(x:unknown)=>JSON.stringify(x);
const same=(a:unknown,b:unknown)=>j(a)===j(b);
export const accountCode=async(id:string)=>(await digest(`saha-account:${id}`)).slice(0,24).toUpperCase();
export const homeOrg=async(id:string)=>`org_${(await digest(`saha-home:${id}`)).slice(0,32)}`;
// Every statement is guarded by a transaction-local CAS token. D1 batch rolls back
// all writes on error; a losing CAS leaves every dependent statement a no-op.
export function guarded(db:D1Database,orgId:string,token:string,rows:Row[]){
 const groups=new Map<string,Row[]>();for(const r of rows){const key=r.table+'|'+Object.keys(r.values).join(',')+'|'+r.append;groups.set(key,[...(groups.get(key)??[]),r]);}
 const statements=[];
 for(const rs of groups.values()){
  const first=rs[0],cols=Object.keys(first.values),size=Math.max(1,Math.floor(88/cols.length));
  for(let n=0;n<rs.length;n+=size){const part=rs.slice(n,n+size);const binds=part.flatMap(r=>cols.map(k=>r.values[k]));const select=cols.map((_,i)=>`column${i+1}`).join(',');const updates=cols.filter(c=>!first.keys.includes(c));const conflict=first.append?'':updates.length?` ON CONFLICT (${first.keys.join(',')}) DO UPDATE SET ${updates.map(c=>`${c}=excluded.${c}`).join(',')}`:' ON CONFLICT DO NOTHING';
   statements.push(db.prepare(`INSERT INTO ${first.table} (${cols.join(',')}) SELECT ${select} FROM (VALUES ${part.map(()=>`(${cols.map(()=>'?').join(',')})`).join(',')}) WHERE EXISTS (SELECT 1 FROM organisations WHERE id=? AND last_command=?)${conflict}`).bind(...binds,orgId,token));
  }
 }
 return statements;
}
export function allowed(m:Member,p:Person){return m.status==='active'&&m.role!=='admin'&&m.teamIds.includes(p.teamId)&&(m.role!=='asha'||p.assignedTo===m.userId);}
export function scope(state:OrgState,userId:string){const m=state.members.find(x=>x.userId===userId&&x.status==='active');if(!m)fail(403,'Your organisation membership is inactive or unavailable.');state.workspace.role=m.role;for(const p of state.workspace.people)p.assigned=allowed(m,p);return m;}
export async function readState(db:D1Database,orgId:string):Promise<OrgState>{
 const tables=['organisations','teams','memberships','team_members','invitations','patients','visits','integrations','plans','ai_results','submissions','referrals','audit_events'];
 const results=await db.batch(tables.map(t=>db.prepare(t==='organisations'?'SELECT * FROM organisations WHERE id=?':t==='memberships'?'SELECT m.*,a.display_name,a.account_code FROM memberships m JOIN accounts a ON a.user_id=m.user_id WHERE m.org_id=?':`SELECT * FROM ${t} WHERE org_id=?${t==='audit_events'?' ORDER BY at DESC LIMIT 250':t==='visits'?" ORDER BY json_extract(data,'$.createdAt'),id":''}`).bind(orgId)));
 const values=Object.fromEntries(tables.map((t,i)=>[t,results[i].results as Record<string,any>[]]));
 const org=values.organisations[0];if(!org)fail(404,'Organisation not found.');
 const w:Workspace={schemaVersion:1,revision:org.revision,role:'admin',people:values.patients.map(r=>({...JSON.parse(r.data),version:r.version,teamId:r.team_id,assignedTo:r.assigned_to,assigned:false})),visits:values.visits.map(r=>{const {planId,...data}=JSON.parse(r.data);return {...data,version:r.version,recordVersion:r.record_version,plan:values.plans.find(p=>p.id===planId)?JSON.parse(values.plans.find(p=>p.id===planId)!.data):undefined,aiResults:values.ai_results.filter(a=>a.visit_id===r.id).map(a=>JSON.parse(a.data))};}),integrations:values.integrations.map(r=>JSON.parse(r.data)),submissions:values.submissions.map(r=>JSON.parse(r.data)),referrals:values.referrals.map(r=>JSON.parse(r.data)),receipts:{},audit:values.audit_events.reverse().map(r=>({id:r.id,at:r.at,actor:r.actor_name,actorId:r.actor_id,role:r.role,action:r.action,subject:r.subject,detail:r.detail,personId:r.person_id}))};
 return {organisation:{id:org.id,name:org.name,revision:org.revision,createdAt:org.created_at},teams:values.teams.map(r=>({id:r.id,name:r.name,createdAt:r.created_at})),members:values.memberships.map(r=>({userId:r.user_id,displayName:r.display_name,accountCode:r.account_code,role:r.role,isOwner:!!r.is_owner,status:r.status,version:r.version,createdAt:r.created_at,teamIds:values.team_members.filter(t=>t.user_id===r.user_id).map(t=>t.team_id)})),invitations:values.invitations.map(r=>({id:r.id,accountCode:r.account_code,label:r.label,role:r.role,teamIds:JSON.parse(r.team_ids),status:r.status,expiresAt:r.expires_at,createdBy:r.created_by,createdAt:r.created_at,tokenHash:r.token_hash,acceptedBy:r.accepted_by??undefined})),workspace:w};
}
function revisionChanges(previous:unknown,current:unknown){
 const flatten=(value:any,prefix=''):Record<string,string>=>{const out:Record<string,string>={};for(const [key,val] of Object.entries(value??{})){if(['assigned','plan','aiResults','version','recordVersion'].includes(key))continue;const name=prefix?prefix+'.'+key:key;if(val!==null&&typeof val==='object'&&!Array.isArray(val))Object.assign(out,flatten(val,name));else out[name]=val==null?'—':Array.isArray(val)?val.join(', '):String(val);}return out;};
 const before=flatten(previous),after=flatten(current);return [...new Set([...Object.keys(before),...Object.keys(after)])].filter(k=>before[k]!==after[k]).map(field=>({field,before:before[field]??'—',after:after[field]??'—'}));
}
export function rowsForState(state:OrgState,previous:OrgState|null,actor:Actor,action:string,reason:string,now:string){
 const orgId=state.organisation.id,rows:Row[]=[];const old=previous?.workspace;
 for(const team of state.teams){if(!same(team,previous?.teams.find(t=>t.id===team.id)))rows.push(row('teams',{org_id:orgId,id:team.id,name:team.name,created_at:team.createdAt}));}
 for(const m of state.members){if(!same(m,previous?.members.find(x=>x.userId===m.userId)))rows.push(row('memberships',{org_id:orgId,user_id:m.userId,role:m.role,is_owner:+m.isOwner,status:m.status,version:m.version,created_at:m.createdAt},['org_id','user_id']));}
 for(const i of state.invitations){if(!same(i,previous?.invitations.find(x=>x.id===i.id)))rows.push(row('invitations',{id:i.id,org_id:orgId,token_hash:i.tokenHash!,account_code:i.accountCode,label:i.label,role:i.role,team_ids:j(i.teamIds),status:i.status,expires_at:i.expiresAt,created_by:i.createdBy,created_at:i.createdAt,accepted_by:i.acceptedBy??null},['id']));}
 function revision(type:'person'|'visit',entity:Person|Visit,before:Person|Visit|undefined){rows.push(row('record_revisions',{id:uuid(),org_id:orgId,person_id:type==='person'?entity.id:(entity as Visit).personId,entity_type:type,entity_id:entity.id,version:type==='person'?entity.version:(entity as Visit).recordVersion,actor_id:actor.userId,actor_name:actor.displayName,action,reason,data:j(entity),changes:j(revisionChanges(before,entity)),created_at:now},['id'],true));}
 for(const p of state.workspace.people){const before=old?.people.find(x=>x.id===p.id);if(same(p,before))continue;if(before&&p.version<=before.version)p.version=before.version+1;const {assigned,...data}=p;rows.push(row('patients',{org_id:orgId,id:p.id,version:p.version,name:p.name,team_id:p.teamId,assigned_to:p.assignedTo,data:j(data)}));revision('person',p,before);}
 for(const v of state.workspace.visits){const before=old?.visits.find(x=>x.id===v.id);if(same(v,before))continue;v.recordVersion=before?before.recordVersion+1:1;const {plan,aiResults,...data}=v;rows.push(row('visits',{org_id:orgId,id:v.id,person_id:v.personId,version:v.version,record_version:v.recordVersion,state:v.state,data:j({...data,planId:plan?.id})}));if(plan&&!same(plan,before?.plan))rows.push(row('plans',{org_id:orgId,id:plan.id,visit_id:v.id,state:plan.state,data:j(plan)}));for(const a of aiResults){if(!same(a,before?.aiResults.find(x=>x.id===a.id)))rows.push(row('ai_results',{org_id:orgId,id:a.id,visit_id:v.id,data:j(a)}));}revision('visit',v,before);}
 for(const i of state.workspace.integrations){if(!same(i,old?.integrations.find(x=>x.id===i.id)))rows.push(row('integrations',{org_id:orgId,id:i.id,version:i.version,kind:i.kind,status:i.status,data:j(i)}));}
 for(const s of state.workspace.submissions){if(!same(s,old?.submissions.find(x=>x.id===s.id)))rows.push(row('submissions',{org_id:orgId,id:s.id,visit_id:s.visitId,person_id:s.personId,state:s.state,data:j(s)}));}
 for(const r of state.workspace.referrals){if(!same(r,old?.referrals.find(x=>x.id===r.id)))rows.push(row('referrals',{org_id:orgId,id:r.id,person_id:r.personId,data:j(r)}));}
 for(const a of state.workspace.audit){if(old?.audit.some(x=>x.id===a.id))continue;rows.push(auditRow(orgId,a,actor.userId,state.workspace));}
 return rows;
}
function auditRow(orgId:string,a:Audit,fallbackActor:string,w:Workspace){const personId=a.personId??(w.people.some(p=>p.id===a.subject)?a.subject:w.visits.find(v=>v.id===a.subject)?.personId??w.submissions.find(s=>s.id===a.subject)?.personId??null);return row('audit_events',{org_id:orgId,id:a.id,person_id:personId,actor_id:a.actorId??fallbackActor,actor_name:a.actor,role:a.role,action:a.action,subject:a.subject,detail:a.detail,at:a.at},['org_id','id'],true);}
export async function persist(db:D1Database,before:OrgState,after:OrgState,actor:Actor,command:{type:string;reason?:string},key:string,hash:string,result:any,extraRows:Row[]=[],switchOrg=false){
 const orgId=before.organisation.id,token=uuid(),now=new Date().toISOString();const rows=rowsForState(after,before,actor,command.type,command.reason??'',now);
 const actionEvent=after.workspace.audit.find(a=>!before.workspace.audit.some(b=>b.id===a.id));const patientId=actionEvent?.personId??after.workspace.people.find(p=>p.id===actionEvent?.subject)?.id??after.workspace.visits.find(v=>v.id===actionEvent?.subject)?.personId??after.workspace.visits.find(v=>v.id===result?.visitId)?.personId??null;
 rows.push(row('command_receipts',{actor_id:actor.userId,key,org_id:orgId,hash,result:j(result),person_id:patientId,created_at:now},['actor_id','key'],true),...extraRows);
 const stmts=[db.prepare('UPDATE organisations SET revision=revision+1,last_command=?,name=? WHERE id=? AND revision=?').bind(token,after.organisation.name,orgId,before.organisation.revision),...guarded(db,orgId,token,rows)];
 for(const m of after.members){const prev=before.members.find(x=>x.userId===m.userId);if(!same(prev?.teamIds,m.teamIds)){
  stmts.push(db.prepare('DELETE FROM team_members WHERE org_id=? AND user_id=? AND EXISTS (SELECT 1 FROM organisations WHERE id=? AND last_command=?)').bind(orgId,m.userId,orgId,token));
  if(m.teamIds.length)stmts.push(...guarded(db,orgId,token,m.teamIds.map(t=>row('team_members',{org_id:orgId,team_id:t,user_id:m.userId},['org_id','team_id','user_id']))));
 }}
 if(switchOrg)stmts.push(db.prepare('UPDATE accounts SET active_org_id=? WHERE user_id=? AND EXISTS (SELECT 1 FROM organisations WHERE id=? AND last_command=?)').bind(orgId,actor.userId,orgId,token));
 const saved=await db.batch(stmts);if(saved[0].meta.changes!==1)fail(409,'A teammate changed this organisation. Refresh to load their changes, then review and retry. Your unsaved input is kept on screen.');
}
export async function ensureAccount(db:D1Database,u:Actor){
 const code=await accountCode(u.userId),now=new Date().toISOString();
 await db.prepare('INSERT INTO accounts (user_id,account_code,display_name,email,created_at) VALUES (?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET display_name=excluded.display_name,email=excluded.email').bind(u.userId,code,u.displayName,u.email,now).run();
 const orgId=await homeOrg(u.userId);
 const migrated=await db.prepare('SELECT owner_id FROM legacy_migrations WHERE owner_id=?').bind(u.userId).first();
 if(!migrated){const legacy=await db.prepare('SELECT revision,state FROM workspaces WHERE owner_id=?').bind(u.userId).first<{revision:number;state:string}>();const w:Workspace=legacy?JSON.parse(legacy.state):seedWorkspace();
  if(!Array.isArray(w.people)||!Array.isArray(w.visits))fail(503,'Existing records could not be migrated. The original workspace has been preserved.');
  for(const p of w.people){p.version=1;p.teamId='default';p.assignedTo=p.assigned?u.userId:null;}
  for(const v of w.visits){v.recordVersion=1;if(v.plan&&v.plan.state!=='completed')v.plan.state='blocked';}
  const state:OrgState={organisation:{id:orgId,name:'Rampur care organisation',revision:1,createdAt:now},teams:[{id:'default',name:'Rampur care team',createdAt:now}],members:[{userId:u.userId,accountCode:code,displayName:u.displayName,role:'clinician',isOwner:true,status:'active',version:1,teamIds:['default'],createdAt:now}],invitations:[],workspace:w};
  await createState(db,state,u,legacy?'migrateWorkspace':'createWorkspace',legacy?.revision??0,legacy?await digest(legacy.state):await digest(w),w.receipts);
 }
 const account=await db.prepare('SELECT active_org_id FROM accounts WHERE user_id=?').bind(u.userId).first<{active_org_id:string|null}>();
 if(!account?.active_org_id)await db.prepare('UPDATE accounts SET active_org_id=? WHERE user_id=? AND active_org_id IS NULL').bind(orgId,u.userId).run();
 return code;
}
export async function createState(db:D1Database,state:OrgState,u:Actor,action:string,sourceRevision=0,sourceHash='',legacyReceipts:Workspace['receipts']={},operation?:{key:string;hash:string}){
 const orgId=state.organisation.id,token=uuid(),now=state.organisation.createdAt;
 state.workspace.audit.push({id:uuid(),at:now,actor:u.displayName,actorId:u.userId,role:'clinician',action,subject:orgId,detail:action==='migrateWorkspace'?'Legacy workspace copied to structured records. Original retained. Old unexecuted approvals require a new review.':'Organisation created with an owner and a care team.'});
 const rows=rowsForState(state,null,u,action,'Initial baseline; earlier events remain in the activity log.',now);
 rows.push(...state.members.flatMap(m=>m.teamIds.map(t=>row('team_members',{org_id:orgId,team_id:t,user_id:m.userId},['org_id','team_id','user_id']))));
 if(action!=='createOrganisation')rows.push(row('legacy_migrations',{owner_id:u.userId,org_id:orgId,source_revision:sourceRevision,source_hash:sourceHash,counts:j({people:state.workspace.people.length,visits:state.workspace.visits.length,integrations:state.workspace.integrations.length,submissions:state.workspace.submissions.length,referrals:state.workspace.referrals.length,audit:state.workspace.audit.length-1,receipts:Object.keys(legacyReceipts).length}),migrated_at:now},['owner_id'],true));
 for(const [key,r] of Object.entries(legacyReceipts))rows.push(row('command_receipts',{actor_id:u.userId,key,org_id:orgId,hash:r.hash,result:j(r.result),person_id:state.workspace.visits.find(v=>v.id===r.result?.visitId)?.personId??r.result?.personId??null,created_at:now},['actor_id','key'],true));
 if(operation)rows.push(row('command_receipts',{actor_id:u.userId,key:operation.key,org_id:orgId,hash:operation.hash,result:j({organisationId:orgId}),person_id:null,created_at:now},['actor_id','key'],true));
 await db.batch([db.prepare('INSERT OR IGNORE INTO organisations (id,name,revision,last_command,created_at) VALUES (?,?,1,?,?)').bind(orgId,state.organisation.name,token,now),...guarded(db,orgId,token,rows),...(operation?[db.prepare('UPDATE accounts SET active_org_id=? WHERE user_id=? AND EXISTS (SELECT 1 FROM organisations WHERE id=? AND last_command=?)').bind(orgId,u.userId,orgId,token)]:[])]);
}
export async function history(db:D1Database,orgId:string,personId:string,cursor:[string,string]|null=null){const r=await db.prepare(`SELECT * FROM record_revisions WHERE org_id=? AND person_id=?${cursor?' AND (created_at<? OR (created_at=? AND id<?))':''} ORDER BY created_at DESC,id DESC LIMIT 51`).bind(orgId,personId,...(cursor?[cursor[0],cursor[0],cursor[1]]:[])).all<Record<string,any>>();const rows=r.results.slice(0,50),last=rows.at(-1);return {revisions:rows.map(r=>({id:r.id,personId:r.person_id,entityType:r.entity_type,entityId:r.entity_id,version:r.version,actorId:r.actor_id,actorName:r.actor_name,action:r.action,reason:r.reason,data:JSON.parse(r.data),changes:JSON.parse(r.changes),createdAt:r.created_at})) as RecordRevision[],nextCursor:r.results.length>50?j([last!.created_at,last!.id]):null};}
export function parseCursor(value:string|null){if(!value)return null;if(value.length>500)fail(400,'Invalid history cursor.');try{const c=JSON.parse(value);if(!Array.isArray(c)||c.length!==2||c.some(x=>typeof x!=='string'||x.length>200))fail(400,'Invalid history cursor.');return c as [string,string];}catch{fail(400,'Invalid history cursor.');}}
export async function auditPage(db:D1Database,orgId:string,userId:string,cursor:[string,string]|null=null){
 const q=`SELECT a.* FROM audit_events a JOIN memberships m ON m.org_id=a.org_id AND m.user_id=? AND m.status='active' WHERE a.org_id=? AND ((a.person_id IS NULL AND (m.is_owner=1 OR m.role='admin')) OR EXISTS (SELECT 1 FROM patients p JOIN team_members t ON t.org_id=p.org_id AND t.team_id=p.team_id AND t.user_id=m.user_id WHERE p.org_id=a.org_id AND p.id=a.person_id AND m.role!='admin' AND (m.role!='asha' OR p.assigned_to=m.user_id)))${cursor?' AND (a.at<? OR (a.at=? AND a.id<?))':''} ORDER BY a.at DESC,a.id DESC LIMIT 101`;
 const result=await db.prepare(q).bind(userId,orgId,...(cursor?[cursor[0],cursor[0],cursor[1]]:[])).all<Record<string,any>>();
 const rows=result.results.slice(0,100),last=rows.at(-1);return {events:rows.map(r=>({id:r.id,at:r.at,actor:r.actor_name,actorId:r.actor_id,role:r.role,action:r.action,subject:r.subject,detail:r.detail,personId:r.person_id})) as Audit[],nextCursor:result.results.length>100?j([last!.at,last!.id]):null};
}
