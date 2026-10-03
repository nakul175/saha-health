import { z } from 'zod';
import { fail, uuid } from './core';
import type { Actor } from './store';
import type { Member, OrgState, Person } from './types';

// Slice feat/r08 (BR-ID-02, BR-ID-04, BR-OPS-01): facility and geography/locality dimensions in
// the access policy. An owner defines facilities (a named point of care) and localities (a named
// geography; a facility may sit in one), then attaches a facility and/or a locality to teams and
// to individual members. When the policy is configured to enforce either dimension, the scope
// predicate in `lib/saha/access.ts` further constrains access so a member only sees patients whose
// facility/locality matches the member's own facility/locality scope. With no policy configured the
// behaviour is exactly the existing team + direct-assignment scope, so nothing existing changes.
//
// The configuration lives in the organisation operations document (`operations.accessScope`), like
// delegations and the indicator registry: owner-managed, version-checked and audited, no migration.

export type Locality = { id: string; name: string; createdAt: string };
export type Facility = { id: string; name: string; localityId: string | null; createdAt: string };
// What a team or a member is attached to. Either dimension may be absent.
export type LocationRef = { facilityId?: string; localityId?: string };
export type AccessScope = {
  version: number;
  enforceFacility: boolean;
  enforceLocality: boolean;
  facilities: Facility[];
  localities: Locality[];
  teamAssignments: Record<string, LocationRef>;
  memberAssignments: Record<string, LocationRef>;
  updatedAt: string;
  updatedBy: string;
};

export const MAX_FACILITIES = 200;
export const MAX_LOCALITIES = 100;

export const defaultAccessScope = (): AccessScope => ({
  version: 0,
  enforceFacility: false,
  enforceLocality: false,
  facilities: [],
  localities: [],
  teamAssignments: {},
  memberAssignments: {},
  updatedAt: '',
  updatedBy: '',
});

// The current access-scope configuration, or the inert default (everything off).
export function accessScope(s: OrgState): AccessScope {
  return s.operations?.accessScope ?? defaultAccessScope();
}

const name = z.string().trim().min(2, 'Enter a name of at least 2 characters.').max(120);
const ref = z.string().trim().min(1).max(200);
const ver = z.number().int().min(0);

export const facilityScopeSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('setAccessScope'), version: ver, enforceFacility: z.boolean(), enforceLocality: z.boolean() }).strict(),
  z.object({ type: z.literal('addFacility'), version: ver, name, localityId: ref.nullable() }).strict(),
  z.object({ type: z.literal('addLocality'), version: ver, name }).strict(),
  z.object({ type: z.literal('setTeamLocation'), version: ver, teamId: ref, facilityId: ref.nullable(), localityId: ref.nullable() }).strict(),
  z.object({ type: z.literal('setMemberLocation'), version: ver, userId: ref, facilityId: ref.nullable(), localityId: ref.nullable() }).strict(),
]);

export type FacilityScopeCommand = z.infer<typeof facilityScopeSchema>;
export const FACILITY_SCOPE_TYPES = new Set(['setAccessScope', 'addFacility', 'addLocality', 'setTeamLocation', 'setMemberLocation']);

export function authorizeFacilityScope(s: OrgState, m: Member, c: unknown): void {
  const type = (c as { type?: string } | undefined)?.type;
  if (!type || !FACILITY_SCOPE_TYPES.has(type)) return;
  if (!m.isOwner) fail(403, 'Only an organisation owner can manage facility and geography access.');
}

function validateRefs(scope: AccessScope, facilityId: string | null, localityId: string | null): void {
  if (facilityId && !scope.facilities.some(f => f.id === facilityId)) fail(422, 'Choose a facility in this organisation.');
  if (localityId && !scope.localities.some(l => l.id === localityId)) fail(422, 'Choose a locality in this organisation.');
}

const EMPTY_OPERATIONS = { version: 0, maintenance: false, reason: '', updatedAt: '', incidents: [], rates: null };

// Owner-managed, version-checked and audited mutations of the facility/geography access policy.
export function applyFacilityScope(s: OrgState, input: unknown, u: Actor, m: Member): { version: number } | null {
  const parsed = facilityScopeSchema.safeParse(input);
  if (!parsed.success) return null;
  const c = parsed.data;
  authorizeFacilityScope(s, m, c);
  const ops = s.operations ??= { ...EMPTY_OPERATIONS };
  const scope = ops.accessScope ??= defaultAccessScope();
  if (c.version !== scope.version) fail(409, 'Facility and geography access changed. Refresh and try again.');
  const now = new Date().toISOString();
  let detail: string;
  if (c.type === 'setAccessScope') {
    if (c.enforceFacility && scope.facilities.length === 0) fail(422, 'Define at least one facility before enforcing facility scope.');
    if (c.enforceLocality && scope.localities.length === 0 && !scope.facilities.some(f => f.localityId)) fail(422, 'Define at least one locality before enforcing geography scope.');
    scope.enforceFacility = c.enforceFacility;
    scope.enforceLocality = c.enforceLocality;
    detail = `Facility scope ${c.enforceFacility ? 'enforced' : 'not enforced'}; geography scope ${c.enforceLocality ? 'enforced' : 'not enforced'}.`;
  } else if (c.type === 'addLocality') {
    if (scope.localities.some(l => l.name.toLowerCase() === c.name.toLowerCase())) fail(409, 'A locality with this name already exists.');
    if (scope.localities.length >= MAX_LOCALITIES) fail(422, `At most ${MAX_LOCALITIES} localities.`);
    const locality: Locality = { id: uuid(), name: c.name, createdAt: now };
    scope.localities.push(locality);
    detail = `Locality added: ${locality.name}.`;
  } else if (c.type === 'addFacility') {
    if (c.localityId && !scope.localities.some(l => l.id === c.localityId)) fail(422, 'Choose a locality in this organisation.');
    if (scope.facilities.some(f => f.name.toLowerCase() === c.name.toLowerCase())) fail(409, 'A facility with this name already exists.');
    if (scope.facilities.length >= MAX_FACILITIES) fail(422, `At most ${MAX_FACILITIES} facilities.`);
    const facility: Facility = { id: uuid(), name: c.name, localityId: c.localityId, createdAt: now };
    scope.facilities.push(facility);
    detail = `Facility added: ${facility.name}${facility.localityId ? ` (${scope.localities.find(l => l.id === facility.localityId)?.name ?? facility.localityId})` : ''}.`;
  } else if (c.type === 'setTeamLocation') {
    const team = s.teams.find(t => t.id === c.teamId);
    if (!team) fail(422, 'Choose a team in this organisation.');
    validateRefs(scope, c.facilityId, c.localityId);
    scope.teamAssignments[c.teamId] = { facilityId: c.facilityId ?? undefined, localityId: c.localityId ?? undefined };
    detail = `Team ${team.name}: facility/geography scope updated.`;
  } else {
    const target = s.members.find(x => x.userId === c.userId && x.status === 'active');
    if (!target) fail(422, 'Choose an active member.');
    validateRefs(scope, c.facilityId, c.localityId);
    scope.memberAssignments[c.userId] = { facilityId: c.facilityId ?? undefined, localityId: c.localityId ?? undefined };
    detail = `Member ${target.displayName}: facility/geography scope updated.`;
  }
  scope.version += 1;
  scope.updatedAt = now;
  scope.updatedBy = u.userId;
  s.workspace.audit.push({ id: uuid(), at: now, actor: u.displayName, actorId: u.userId, role: m.role, action: c.type, subject: s.organisation.id, detail });
  return { version: scope.version };
}

// --- scope resolution (used by lib/saha/access.ts) --------------------------------------------

const facility = (scope: AccessScope, id?: string) => scope.facilities.find(f => f.id === id);

// The facilities a member is attached to, directly or through any of their teams.
export function assignedFacilities(m: Member, scope: AccessScope): Set<string> {
  const out = new Set<string>();
  for (const t of m.teamIds) { const a = scope.teamAssignments?.[t]; if (a?.facilityId) out.add(a.facilityId); }
  const own = scope.memberAssignments?.[m.userId];
  if (own?.facilityId) out.add(own.facilityId);
  return out;
}

// The localities a member is attached to: directly, or through a facility (its locality) attached
// to their teams or to themselves.
export function assignedLocalities(m: Member, scope: AccessScope): Set<string> {
  const out = new Set<string>();
  const localityOf = (fid?: string) => { const f = facility(scope, fid); if (f?.localityId) out.add(f.localityId); };
  for (const t of m.teamIds) { const a = scope.teamAssignments?.[t]; if (a?.localityId) out.add(a.localityId); if (a?.facilityId) localityOf(a.facilityId); }
  const own = scope.memberAssignments?.[m.userId];
  if (own?.localityId) out.add(own.localityId);
  if (own?.facilityId) localityOf(own.facilityId);
  return out;
}

// A patient's locality: recorded directly, else the locality of their recorded facility.
export function patientLocality(p: Person, scope: AccessScope): string | undefined {
  return p.localityId ?? facility(scope, p.facilityId)?.localityId ?? undefined;
}

// The additive facility/geography check. It never widens access: it only further constrains the
// team + assignment scope. A member with no facility scope under an enforced dimension is denied
// (fail closed); a patient without a matching facility/locality is denied.
export function scopeAllows(m: Member, p: Person, scope: AccessScope): boolean {
  if (scope.enforceFacility) {
    const fs = assignedFacilities(m, scope);
    if (!fs.size || !p.facilityId || !fs.has(p.facilityId)) return false;
  }
  if (scope.enforceLocality) {
    const ls = assignedLocalities(m, scope);
    const pl = patientLocality(p, scope);
    if (!ls.size || !pl || !ls.has(pl)) return false;
  }
  return true;
}

// --- read view --------------------------------------------------------------------------------

export function facilityScopeView(s: OrgState, m: Member) {
  const scope = accessScope(s);
  if (!m.isOwner) return { canManage: false, version: scope.version };
  const facilityName = (id?: string) => id ? (scope.facilities.find(f => f.id === id)?.name ?? id) : null;
  const localityName = (id?: string) => id ? (scope.localities.find(l => l.id === id)?.name ?? id) : null;
  const teamName = (id: string) => s.teams.find(t => t.id === id)?.name ?? id;
  const memberName = (id: string) => s.members.find(x => x.userId === id)?.displayName ?? id;
  const decorate = (ref: LocationRef) => ({ ...ref, facilityName: facilityName(ref.facilityId), localityName: localityName(ref.localityId) });
  return {
    canManage: true,
    version: scope.version,
    enforceFacility: scope.enforceFacility,
    enforceLocality: scope.enforceLocality,
    facilities: scope.facilities.map(f => ({ ...f, localityName: localityName(f.localityId ?? undefined) })),
    localities: scope.localities,
    teamAssignments: Object.fromEntries(Object.entries(scope.teamAssignments).map(([id, ref]) => [id, { ...decorate(ref), teamName: teamName(id) }])),
    memberAssignments: Object.fromEntries(Object.entries(scope.memberAssignments).map(([id, ref]) => [id, { ...decorate(ref), memberName: memberName(id) }])),
    teams: s.teams.map(t => ({ id: t.id, name: t.name, ...decorate(scope.teamAssignments[t.id] ?? {}) })),
  };
}
