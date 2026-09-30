import { z } from 'zod';
import { digest, fail, uuid } from './core';
import type { Actor } from './store';
import type { Member, OrgState, Role } from './types';

// Slice 1d: workforce roster reconciliation (BR-ID-10, BR-ID-01). An owner supplies the roster an
// institution maintains; Saha previews the differences and applies them only against that exact
// preview. It invites new accounts, updates roles and teams, and suspends people who left. It never
// removes anyone, never reactivates a local suspension, never changes owners' owner flag or the
// owner's own membership, and never suspends an owner.
const code=z.string().trim().toUpperCase().regex(/^[A-F0-9]{24}$/,'Use 24-character account codes.');
export const rosterRow=z.object({accountCode:code,name:z.string().trim().min(1).max(200),role:z.enum(['asha','clinician','supervisor','admin']),teams:z.array(z.string().trim().min(1).max(200)).max(20),status:z.enum(['active','left'])}).strict();
export const rosterInput=z.object({rows:z.array(rosterRow).min(1).max(100),complete:z.boolean()}).strict();
export const rosterSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('rosterApply'),rows:z.array(rosterRow).min(1).max(100),complete:z.boolean(),previewHash:z.string().length(64),reason:z.string().trim().min(10).max(1000)}).strict(),
]);
export type RosterRow=z.infer<typeof rosterRow>;
export type RosterAction={accountCode:string;name:string;action:'invite'|'update'|'suspend'|'none'|'conflict';detail:string;role?:Role;teamIds?:string[];userId?:string};
export async function rosterDiff(s:OrgState,rows:RosterRow[],complete:boolean,actorId:string,now=new Date().toISOString()){
 const errors:string[]=[],actions:RosterAction[]=[],seen=new Set<string>();
 const teamId=(t:string)=>s.teams.find(x=>x.id===t||x.name.toLowerCase()===t.toLowerCase())?.id;
 const activeOwners=s.members.filter(x=>x.isOwner&&x.status==='active').length;
 rows.forEach((r,i)=>{
  const line=`Row ${i+1} (${r.accountCode})`;
  if(seen.has(r.accountCode)){errors.push(`${line}: listed more than once.`);return;}seen.add(r.accountCode);
  const ids=r.teams.map(teamId);if(ids.some(x=>!x)){errors.push(`${line}: unknown team ${r.teams.filter((_,n)=>!ids[n]).join(', ')}.`);return;}
  const teamIds=[...new Set(ids as string[])].sort();
  if(r.status==='active'&&r.role!=='admin'&&!teamIds.length){errors.push(`${line}: a care or supervisor role needs a team.`);return;}
  const m=s.members.find(x=>x.accountCode===r.accountCode);
  if(m?.userId===actorId){actions.push({accountCode:r.accountCode,name:r.name,action:'none',detail:'Your own membership is not changed by roster sync.'});return;}
  if(r.status==='left'){
   if(!m||m.status!=='active'){actions.push({accountCode:r.accountCode,name:r.name,action:'none',detail:m?`Already ${m.status}.`:'Not a member.'});return;}
   if(m.isOwner){actions.push({accountCode:r.accountCode,name:r.name,action:'conflict',detail:'An owner is listed as left. Change ownership by hand; roster sync never suspends an owner.'});return;}
   actions.push({accountCode:r.accountCode,name:r.name,action:'suspend',detail:'Listed as left: membership will be suspended. Their caseload stays visible as a responsibility gap until transferred.',userId:m.userId});return;
  }
  if(!m||m.status==='removed'){
   if(s.invitations.some(x=>x.accountCode===r.accountCode&&x.status==='pending'&&x.expiresAt>now)){actions.push({accountCode:r.accountCode,name:r.name,action:'none',detail:'A current invitation already exists.'});return;}
   actions.push({accountCode:r.accountCode,name:r.name,action:'invite',detail:`New ${r.role} invitation for ${teamIds.map(t=>s.teams.find(x=>x.id===t)!.name).join(', ')||'no team'}.`,role:r.role,teamIds});return;
  }
  if(m.status==='suspended'){actions.push({accountCode:r.accountCode,name:r.name,action:'conflict',detail:'Suspended here but active in the roster. Reactivate by hand if the suspension no longer applies.'});return;}
  const same=m.role===r.role&&[...m.teamIds].sort().join()===teamIds.join();
  actions.push(same?{accountCode:r.accountCode,name:r.name,action:'none',detail:'No change.'}:{accountCode:r.accountCode,name:r.name,action:'update',detail:`Role ${m.role} → ${r.role}; teams ${m.teamIds.map(t=>s.teams.find(x=>x.id===t)?.name??t).join(', ')||'none'} → ${teamIds.map(t=>s.teams.find(x=>x.id===t)!.name).join(', ')||'none'}.`,role:r.role,teamIds,userId:m.userId});
 });
 if(complete)for(const m of s.members.filter(x=>x.status==='active'&&!seen.has(x.accountCode)&&x.userId!==actorId)){
  if(m.isOwner)actions.push({accountCode:m.accountCode,name:m.displayName,action:'conflict',detail:'Owner missing from the complete roster. Roster sync never suspends an owner.'});
  else actions.push({accountCode:m.accountCode,name:m.displayName,action:'suspend',detail:'Missing from the complete roster: membership will be suspended.',userId:m.userId});
 }
 if(activeOwners<1)errors.push('No active owner.');
 const counts=Object.fromEntries(['invite','update','suspend','none','conflict'].map(a=>[a,actions.filter(x=>x.action===a).length]));
 return {actions,errors,counts,hash:await digest({rows,complete,actions:actions.map(({detail,...a})=>a),members:s.members.map(m=>[m.userId,m.version,m.status])})};
}
export async function applyRoster(s:OrgState,input:unknown,u:Actor,m:Member,now=new Date().toISOString()):Promise<any|null>{
 const parsed=rosterSchema.safeParse(input);if(!parsed.success)return null;const c=parsed.data;
 if(!m.isOwner)fail(403,'Only an organisation owner can apply a roster.');
 const diff=await rosterDiff(s,c.rows,c.complete,u.userId,now);
 if(diff.errors.length)fail(422,`Fix the roster first: ${diff.errors.slice(0,3).join(' ')}`);
 if(diff.hash!==c.previewHash)fail(409,'The roster or the membership changed since the preview. Preview again before applying.');
 const invitations:{accountCode:string;name:string;token:string;expiresAt:string}[]=[];
 for(const a of diff.actions){
  if(a.action==='invite'){const bytes=crypto.getRandomValues(new Uint8Array(32)),token=Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join(''),expiresAt=new Date(Date.parse(now)+72*3600000).toISOString();
   s.invitations.push({id:uuid(),accountCode:a.accountCode,label:a.name,role:a.role!,teamIds:a.teamIds!,status:'pending',expiresAt,createdBy:u.userId,createdAt:now,tokenHash:await digest(token)});invitations.push({accountCode:a.accountCode,name:a.name,token,expiresAt});}
  else if(a.action==='update'){const t=s.members.find(x=>x.userId===a.userId)!;Object.assign(t,{role:a.role,teamIds:a.teamIds,version:t.version+1});}
  else if(a.action==='suspend'){const t=s.members.find(x=>x.userId===a.userId)!;Object.assign(t,{status:'suspended',version:t.version+1});}
  if(['invite','update','suspend'].includes(a.action))s.workspace.audit.push({id:uuid(),at:now,actorId:u.userId,actor:u.displayName,role:m.role,action:'rosterApply',subject:a.userId??a.accountCode,detail:`${a.name}: ${a.detail} Reason: ${c.reason}`});
 }
 s.workspace.audit.push({id:uuid(),at:now,actorId:u.userId,actor:u.displayName,role:m.role,action:'rosterApply',subject:s.organisation.id,detail:`Roster applied (${c.complete?'complete':'partial'} roster of ${c.rows.length} rows): ${diff.counts.invite} invited, ${diff.counts.update} updated, ${diff.counts.suspend} suspended, ${diff.counts.conflict} conflicts left for review. Reason: ${c.reason}`});
 return {counts:diff.counts,invitations,conflicts:diff.actions.filter(a=>a.action==='conflict')};
}
