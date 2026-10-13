import {identity,db,json,runtime} from './server';
import {readState,scope} from './store';import {fail} from './core';
import {environmentOf} from './environment';import {patientId} from './patient-directory';import {recordAccess} from './access-audit';
import {ownCarePermissionsProjection} from './own-care-permissions';import {ownCarePermissionsTransferProof,OWN_CARE_PERMISSIONS_TRANSFER_SQL} from './own-care-permissions-read-guard';
type Row=Record<string,string|number|null>;
const specs=[['org','SELECT * FROM organisations WHERE id=?'],['members','SELECT * FROM memberships WHERE org_id=? ORDER BY user_id'],['teams','SELECT * FROM teams WHERE org_id=? ORDER BY id'],['teamMembers','SELECT * FROM team_members WHERE org_id=? ORDER BY user_id,team_id'],['ops','SELECT * FROM operations WHERE org_id=?'],['transfers',OWN_CARE_PERMISSIONS_TRANSFER_SQL]]as const;
async function proof(org:string){const rows=await db().batch(specs.map(([,sql])=>db().prepare(sql).bind(org)));return Object.fromEntries(specs.map(([key],i)=>[key,rows[i].results]))as Record<typeof specs[number][0],Row[]>;}
export async function ownCarePermissionsRead(request:Request){
 if(new URL(request.url).search)fail(400,'This view accepts no person, member, purpose or action selectors.');if(!['synthetic','training'].includes(environmentOf(runtime()).name))fail(409,'Use a synthetic or training care workspace.');
 const actor=await identity(),org=patientId(request.headers.get('x-saha-organisation'));if(request.headers.has('x-saha-operation-actor')&&request.headers.get('x-saha-operation-actor')!==actor.userId)fail(403,'The original care account changed.');
 const s=await readState(db(),org,[],actor.userId,true),m=scope(s,actor.userId);if(m.role!=='asha')fail(403,'An active ASHA care context is required.');const before=await proof(org),queued=ownCarePermissionsTransferProof(before.transfers,new Date().toISOString());
 if(!before.members.some(r=>r.user_id===m.userId&&r.version===m.version&&r.role===m.role&&r.status===m.status&&!!r.is_owner===m.isOwner)||JSON.stringify(before.teamMembers.filter(r=>r.user_id===m.userId).map(r=>r.team_id).sort())!==JSON.stringify([...m.teamIds].sort())||JSON.stringify(before.ops[0]?JSON.parse(before.ops[0].data as string):undefined)!==JSON.stringify(s.operations))fail(409,'Current care membership or policy source differs.');
 if(JSON.stringify(before.teams.map(r=>({id:r.id,name:r.name,createdAt:r.created_at})))!==JSON.stringify([...s.teams].sort((a,b)=>a.id.localeCompare(b.id))))fail(409,'Current team source differs.');
 const value=ownCarePermissionsProjection(s,m,actor.userId,queued.refreshAt);await recordAccess(db(),s,actor,m,{action:'viewWorkspace',subject:actor.userId,detail:'Own recorded care restriction summary only; no record values or another member configuration disclosed.'});
 const after=await proof(org);if(JSON.stringify(after)!==JSON.stringify(before))fail(409,'Current care context changed. Refresh before continuing.');ownCarePermissionsTransferProof(after.transfers,new Date().toISOString());if(value.refreshAt&&Date.parse(value.refreshAt)<=Date.now())fail(409,'Current assignment context expired.');
 const response=json(value);response.headers.set('x-saha-operation-actor',actor.userId);response.headers.set('x-saha-organisation',org);return response;
}
