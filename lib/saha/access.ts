import type { Member, Person } from './types';
import type { AccessPurpose, PurposeGrant } from './purpose-scope';
// Normal care scope: team membership, and for ASHAs direct assignment.
export function normallyAllowed(m:Member,p:Person){return m.status==='active'&&m.role!=='admin'&&m.role!=='provider'&&m.teamIds.includes(p.teamId)&&(m.role!=='asha'||p.assignedTo===m.userId);}
// Slice 6a: a current, unclosed emergency-access grant for this clinician on this patient.
export function exceptionalGrant(m:Member,p:Person,now=new Date().toISOString()){return m.status==='active'&&m.role==='clinician'?(p.exceptionalAccess??[]).find(g=>g.userId===m.userId&&!g.closedAt&&g.until>now):undefined;}
export function allowed(m:Member,p:Person,now?:string){return normallyAllowed(m,p)||!!exceptionalGrant(m,p,now);}
// Slice r09: a member's active purpose-limited grant, if any (see lib/saha/purpose-scope.ts).
export function purposeGrantFor(m:Member,grants:readonly PurposeGrant[]|undefined):PurposeGrant|undefined{
  return (grants??[]).find(g=>g.memberId===m.userId&&!g.revokedAt);
}
// The programme a member is narrowed to, or null (no programme restriction).
export function programmeScopeOf(m:Member,grants:readonly PurposeGrant[]|undefined):PurposeGrant['programme']{
  return purposeGrantFor(m,grants)?.programme??null;
}
// The scope check that honours an optional programme/purpose tag. It is additive: it never
// widens `allowed`, and with no grant it behaves exactly as `allowed` did before this slice.
// `purpose` is the data-flow context; on an ordinary record read pass no purpose, so a
// purpose-only grant leaves the member's record scope unchanged.
export function allowedFor(m:Member,p:Person,grants:readonly PurposeGrant[]|undefined,purpose?:AccessPurpose):boolean{
  if(!allowed(m,p))return false;
  const g=purposeGrantFor(m,grants);
  if(!g)return true;
  if(g.programme&&!p.programmes.includes(g.programme))return false;
  if(purpose&&g.purposes.length&&!g.purposes.includes(purpose))return false;
  return true;
}
