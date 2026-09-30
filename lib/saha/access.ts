import type { Member, Person } from './types';
// Normal care scope: team membership, and for ASHAs direct assignment.
export function normallyAllowed(m:Member,p:Person){return m.status==='active'&&m.role!=='admin'&&m.role!=='provider'&&m.teamIds.includes(p.teamId)&&(m.role!=='asha'||p.assignedTo===m.userId);}
// Slice 6a: a current, unclosed emergency-access grant for this clinician on this patient.
export function exceptionalGrant(m:Member,p:Person,now=new Date().toISOString()){return m.status==='active'&&m.role==='clinician'?(p.exceptionalAccess??[]).find(g=>g.userId===m.userId&&!g.closedAt&&g.until>now):undefined;}
export function allowed(m:Member,p:Person,now?:string){return normallyAllowed(m,p)||!!exceptionalGrant(m,p,now);}
