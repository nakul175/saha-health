import type { Member, Person } from './types';
import { assignedFacilities, assignedLocalities, scopeAllows, type AccessScope } from './facility-scope';
import type { AccessPurpose, PurposeGrant } from './purpose-scope';
// Normal care scope: team membership, and for ASHAs direct assignment.
// Slice feat/r08 (BR-ID-02): when a facility/geography access policy is configured, the member's
// facility and locality scope (from their teams and their own assignment) further constrains access;
// with no policy configured the behaviour is exactly the existing team + assignment scope.
//
// Slice 13a: the organisation's policy (facility/locality scope, slice R08, and a programme-narrowing grant, slice R09)
// is bound to its members when the organisation state is read (store.readState, store.scope), so every check that
// goes through normallyAllowed applies it, for the viewer and for any other member it judges (an eligible owner, a
// receiving worker), without threading the policy through every call site. Before this slice the policy applied
// only where a caller passed it (the workspace scope gate). A member not bound to any state (a hand-built test
// member, a member added in this command) keeps the plain team + assignment scope, as before.
type PolicySource={operations?:{accessScope?:AccessScope;purposeGrants?:PurposeGrant[]}|null};
const POLICY=new WeakMap<Member,PolicySource>();
export function bindAccessPolicy<T extends PolicySource&{members:Member[]}>(s:T):T{for(const m of s.members)POLICY.set(m,s);return s;}
// The policy part of normal scope only (no team or assignment): used where a caller checks team membership itself.
export function withinPolicy(m:Member,p:Person,scope?:AccessScope){const src=POLICY.get(m)?.operations,sc=scope??src?.accessScope;if(sc&&(sc.enforceFacility||sc.enforceLocality)&&!scopeAllows(m,p,sc))return false;return programmeAllows(m,p,src?.purposeGrants);}
export function normallyAllowed(m:Member,p:Person,scope?:AccessScope){const base=m.status==='active'&&m.role!=='admin'&&m.role!=='provider'&&m.teamIds.includes(p.teamId)&&(m.role!=='asha'||p.assignedTo===m.userId);if(!base)return false;return withinPolicy(m,p,scope);}
// Slice 6a: a current, unclosed emergency-access grant for this clinician on this patient.
export function exceptionalGrant(m:Member,p:Person,now=new Date().toISOString()){return m.status==='active'&&m.role==='clinician'?(p.exceptionalAccess??[]).find(g=>g.userId===m.userId&&!g.closedAt&&g.until>now):undefined;}
export function allowed(m:Member,p:Person,now?:string,scope?:AccessScope){return normallyAllowed(m,p,scope)||!!exceptionalGrant(m,p,now);}
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
// Integration of #144 (review finding): the programme part also narrows the workspace scope gate (store.ts scope),
// so it applies to the snapshot and to every command that resolves the patient through core.person().
export function programmeAllows(m:Member,p:Person,grants:readonly PurposeGrant[]|undefined):boolean{
  const programme=programmeScopeOf(m,grants);
  return !programme||(p.programmes??[]).includes(programme);
}
export function allowedFor(m:Member,p:Person,grants:readonly PurposeGrant[]|undefined,purpose?:AccessPurpose):boolean{
  if(!allowed(m,p))return false;
  const g=purposeGrantFor(m,grants);
  if(!g)return true;
  if(!programmeAllows(m,p,grants))return false;
  if(purpose&&g.purposes.length&&!g.purposes.includes(purpose))return false;
  return true;
}
// Slice 13a (R09 purpose at the data-flow checkpoints): whether a member's active grant permits a flow of this purpose.
// No grant, or a grant naming no purposes (programme only), permits every purpose.
export function purposePermits(m:Member,purpose:AccessPurpose,grants?:readonly PurposeGrant[]):boolean{const g=purposeGrantFor(m,grants??POLICY.get(m)?.operations?.purposeGrants);return !g||!g.purposes.length||g.purposes.includes(purpose);}
// Slice 13a: the same policy as an SQL predicate on `patients p` (used by store.viewerScope for scoped and paged
// reads), or null when nothing narrows this member. It mirrors scopeAllows and programmeAllows exactly: an enforced
// dimension with no assignment denies (fail closed); a patient's locality is its own, else its facility's.
export function policySql(member:{userId:string;teamIds:string[]},ops:{accessScope?:AccessScope|null;purposeGrants?:PurposeGrant[]|null}|null|undefined):{sql:string;binds:string[]}|null{
  const sc=ops?.accessScope??undefined,parts:string[]=[],binds:string[]=[],marks=(n:number)=>Array(n).fill('?').join(','),m=member as Member;
  if(sc?.enforceFacility){const fs=[...assignedFacilities(m,sc)];if(!fs.length)parts.push('0');else{parts.push(`json_extract(p.data,'$.facilityId') IN (${marks(fs.length)})`);binds.push(...fs);}}
  if(sc?.enforceLocality){const ls=[...assignedLocalities(m,sc)];if(!ls.length)parts.push('0');else{const via=(sc.facilities??[]).filter(f=>f.localityId&&ls.includes(f.localityId)).map(f=>f.id);
    parts.push(`(json_extract(p.data,'$.localityId') IN (${marks(ls.length)}) OR (json_extract(p.data,'$.localityId') IS NULL AND ${via.length?`json_extract(p.data,'$.facilityId') IN (${marks(via.length)})`:'0'}))`);binds.push(...ls,...via);}}
  const programme=programmeScopeOf(m,ops?.purposeGrants??undefined);
  if(programme){parts.push(`EXISTS (SELECT 1 FROM json_each(p.data,'$.programmes') g WHERE g.value=?)`);binds.push(programme);}
  return parts.length?{sql:parts.join(' AND '),binds}:null;
}
