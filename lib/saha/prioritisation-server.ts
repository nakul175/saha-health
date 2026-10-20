import { ensurePurpose } from './purpose-scope';
import { prioritisationState, scopedPrioritisationRuns } from './prioritisation';
import { identity, json, loadFor } from './server';
import { scope } from './store';

export async function prioritisationRead(request:Request){
 const u=await identity(),s=await loadFor(u,request.headers.get('x-saha-organisation'),undefined,true,null,'workspace load'),m=scope(s,u.userId);
 const canPrioritise=m.status==='active'&&m.role==='supervisor';if(canPrioritise)ensurePurpose(m,'care-coordination',s.operations?.purposeGrants);
 const state=prioritisationState(s),runs=canPrioritise?scopedPrioritisationRuns(s,m):[];
 const ids=new Set(runs.flatMap(r=>r.candidates.map(c=>c.personId)));
 return json({organisationId:s.organisation.id,viewerId:u.userId,canMaintain:m.status==='active'&&m.isOwner,canReview:m.status==='active'&&['supervisor','clinician'].includes(m.role),canPrioritise,criteria:state.criteria,runs,teams:s.teams.filter(t=>m.teamIds.includes(t.id)),people:s.workspace.people.filter(p=>ids.has(p.id)).map(p=>({id:p.id,name:p.name,village:p.village,teamId:p.teamId,assignedTo:p.assignedTo,version:p.version})),members:s.members.filter(x=>x.status==='active'&&['asha','clinician'].includes(x.role)&&x.teamIds.some(t=>m.teamIds.includes(t))).map(x=>({id:x.userId,name:x.displayName,role:x.role,teamIds:x.teamIds}))});
}
