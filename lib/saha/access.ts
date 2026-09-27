import type { Member, Person } from './types';
export function allowed(m:Member,p:Person){return m.status==='active'&&m.role!=='admin'&&m.teamIds.includes(p.teamId)&&(m.role!=='asha'||p.assignedTo===m.userId);}
