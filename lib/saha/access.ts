import type { Member, Person } from './types';
import { scopeAllows, type AccessScope } from './facility-scope';
// Normal care scope: team membership, and for ASHAs direct assignment.
// Slice feat/r08 (BR-ID-02): when a facility/geography access policy is configured, the member's
// facility and locality scope (from their teams and their own assignment) further constrains access;
// with no policy configured the behaviour is exactly the existing team + assignment scope.
export function normallyAllowed(m:Member,p:Person,scope?:AccessScope){const base=m.status==='active'&&m.role!=='admin'&&m.role!=='provider'&&m.teamIds.includes(p.teamId)&&(m.role!=='asha'||p.assignedTo===m.userId);if(!base)return false;if(!scope||(!scope.enforceFacility&&!scope.enforceLocality))return true;return scopeAllows(m,p,scope);}
// Slice 6a: a current, unclosed emergency-access grant for this clinician on this patient.
export function exceptionalGrant(m:Member,p:Person,now=new Date().toISOString()){return m.status==='active'&&m.role==='clinician'?(p.exceptionalAccess??[]).find(g=>g.userId===m.userId&&!g.closedAt&&g.until>now):undefined;}
export function allowed(m:Member,p:Person,now?:string,scope?:AccessScope){return normallyAllowed(m,p,scope)||!!exceptionalGrant(m,p,now);}
