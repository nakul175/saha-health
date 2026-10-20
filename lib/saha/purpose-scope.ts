import { z } from 'zod';
import { fail, uuid } from './core';
import { purposePermits } from './access';
import type { Actor } from './store';
import type { Member, OrgState, Programme } from './types';

// Slice r09: programme and purpose dimensions in the access policy (BR-ID-02, BR-DATA-10).
//
// An organisation owner can narrow a member's care scope with an optional programme and/or
// purpose tag on a purpose-limited access grant. The grant is versioned and audited and is
// revoked by appending (never deleted), so it is additive: it only ever narrows the access
// the member already holds through team, role and assignment, and never widens it. When no
// grant is set the scope check in access.ts behaves exactly as it did before this slice.
//
//   - The programme tag narrows record-level access: the member may only see and act on
//     people recorded in that programme (checked against person.programmes).
//   - The purpose tag narrows data-flow authorisation: a flow carrying a purpose is only
//     permitted when the grant names that purpose. It is evaluated with a purpose context at
//     the checkpoint, not on ordinary record reads, so a purpose-only grant leaves a member's
//     normal record scope unchanged.
//
// The grant list lives in the organisation operations document (next to delegations) and is
// surfaced through its own scoped route; it is deliberately absent from the operations
// allow-list (OPERATOR_FIELDS).

export const ACCESS_PURPOSES = ['care-coordination', 'programme-delivery', 'ai-assistance', 'reporting', 'household-sharing'] as const;
export type AccessPurpose = typeof ACCESS_PURPOSES[number];
// The data flows this release already has, labelled for the access policy; illustrative, not clinical authority.
export const ACCESS_PURPOSE_LABEL: Record<AccessPurpose, string> = {
  'care-coordination': 'Care coordination (EHR exchange)',
  'programme-delivery': 'Programme delivery (MIS)',
  'ai-assistance': 'AI assistance',
  'reporting': 'Reporting and aggregate care reports',
  'household-sharing': 'Household sharing',
};
// Slice 13a: the data-flow checkpoints. Each command or route that starts an outbound flow (or, for household
// sharing, discloses one member's details to another) names its purpose; a member whose active grant lists purposes
// may start only flows of those purposes. Lookups that resolve an uncertain outcome of a flow already started are
// not listed: refusing them could leave an outcome unknown, and they send no new data.
export const COMMAND_PURPOSE: Readonly<Record<string, AccessPurpose>> = {
  preparePlan: 'programme-delivery', approvePlan: 'programme-delivery', executePlan: 'programme-delivery', sendSubmission: 'programme-delivery',
  requestDestinationEnrolment: 'programme-delivery', activateDestinationEnrolment: 'programme-delivery',
  prepareIdentifierCorrection: 'programme-delivery', approveIdentifierCorrection: 'programme-delivery', sendIdentifierCorrection: 'programme-delivery',
  prepareIncentiveClaim: 'programme-delivery', prepareIncentiveCorrection: 'programme-delivery',
  prepareEhrPublish: 'care-coordination', executeEhrPublish: 'care-coordination', retrieveEhrDocument: 'care-coordination', importEhrDocument: 'care-coordination', recordEhrConflictResolution: 'care-coordination',
  linkEhr: 'care-coordination', grantEhrPermission: 'care-coordination', abdmConsentRequest: 'care-coordination', abdmCareContextLink: 'care-coordination', abdmFetch: 'care-coordination',
  createProgrammeReferrals: 'care-coordination',
  prepareAgent: 'ai-assistance', executeAgent: 'ai-assistance', applyAgent: 'ai-assistance',
  prepareAggregateReport: 'reporting', approveAggregateReport: 'reporting', sendAggregateReport: 'reporting',
  householdAddMember: 'household-sharing', householdVisitSchedule: 'household-sharing', householdVisitReschedule: 'household-sharing', householdVisitRecord:'household-sharing',householdVisitOutreach:'household-sharing', proxyGrant: 'household-sharing',
};
export function purposeRefusal(m: Member, purpose: AccessPurpose, grants?: readonly PurposeGrant[]): string | null {
  if (purposePermits(m, purpose, grants)) return null;
  return `Your organisation limits your access to named purposes, and ${ACCESS_PURPOSE_LABEL[purpose].toLowerCase()} is not one of them. Ask an owner to change your access.`;
}
export function ensurePurpose(m: Member, purpose: AccessPurpose | undefined, grants?: readonly PurposeGrant[]) {
  if (!purpose) return;
  const why = purposeRefusal(m, purpose, grants);
  if (why) fail(403, why);
}
export const PROGRAMME_NAMES = ['Maternal care', 'Chronic care', 'TB screening', 'Child health', 'General care'] as const;

export type PurposeGrant = {
  id: string;
  memberId: string;            // the member whose access this narrows
  programme: Programme | null; // optional programme dimension (null = none)
  purposes: AccessPurpose[];   // optional purpose dimension (empty = none)
  version: number;
  setBy: string;
  setAt: string;
  reason: string;
  revokedAt?: string;
  revokedBy?: string;
  revokeReason?: string;
};

// One active grant per member; revoked and replaced records are kept as evidence, never deleted.
export const MAX_STORED = 1000;
export const MAX_ACTIVE = 200;

const id = z.string().trim().min(1).max(200);
const reason = z.string().trim().min(10, 'Write at least 10 characters.').max(500);

export const purposeScopeSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('setAccessPurpose'),
    memberId: id,
    version: z.number().int().min(0),
    programme: z.enum(PROGRAMME_NAMES).nullable(),
    purposes: z.array(z.enum(ACCESS_PURPOSES)).max(ACCESS_PURPOSES.length).refine(x => new Set(x).size === x.length, 'List each purpose once.'),
    reason,
  }).strict(),
  z.object({
    type: z.literal('revokeAccessPurpose'),
    grantId: id,
    version: z.number().int().positive(),
    reason,
  }).strict(),
]);
export type PurposeScopeCommand = z.infer<typeof purposeScopeSchema>;

const TYPES = new Set(['setAccessPurpose', 'revokeAccessPurpose']);
const member = (s: OrgState, userId: string) => s.members.find(x => x.userId === userId);
export const purposeGrants = (s: OrgState) => s.operations?.purposeGrants ?? [];

// Whether a member's care scope is narrowed by an active purpose-limited grant, and to what.
export function grantFor(s: OrgState, m: Member): PurposeGrant | undefined {
  return purposeGrants(s).find(g => g.memberId === m.userId && !g.revokedAt);
}
export function programmeScopeOf(s: OrgState, m: Member): Programme | null {
  return grantFor(s, m)?.programme ?? null;
}

// Replay check: only an owner may manage purpose-limited access.
export function authorizePurposeScope(s: OrgState, m: Member, c: unknown) {
  if (!TYPES.has(String((c as {type?:unknown}|null)?.type??''))) return;
  if (!m.isOwner) fail(403, 'Only an organisation owner can manage a member’s programme or purpose scope.');
}

export function applyPurposeScope(s: OrgState, input: unknown, u: Actor, m: Member, now = new Date().toISOString()): any | null {
  if (!TYPES.has(String((input as {type?:unknown}|null)?.type??''))) return null;
  if (!m.isOwner) fail(403, 'Only an organisation owner can manage a member’s programme or purpose scope.');
  const parsed = purposeScopeSchema.safeParse(input);
  if (!parsed.success) fail(422, parsed.error.issues[0]?.message ?? 'Invalid access-purpose setting.');
  const c = parsed.data!;
  if (c.type === 'setAccessPurpose' && c.programme === null && c.purposes.length === 0) fail(422, 'Name a programme, at least one purpose, or both.');
  const ops = s.operations ?? { version: 0, maintenance: false, reason: '', updatedAt: '', incidents: [], rates: null };
  s.operations = ops;
  const list = ops.purposeGrants ?? [];
  let g: PurposeGrant, detail: string, result: Record<string, unknown>;
  if (c.type === 'setAccessPurpose') {
    const target = member(s, c.memberId);
    if (!target || target.status !== 'active') fail(422, 'Choose an active member.');
    if (target.userId === u.userId) fail(422, 'An owner cannot narrow their own scope here.');
    if (target.isOwner) fail(422, 'Organisation owners keep full access; choose another member.');
    if (target.role === 'admin' || target.role === 'provider') fail(422, 'Administrators and providers have no patient scope to narrow.');
    if (list.some(x => x.memberId === c.memberId && !x.revokedAt)) fail(409, 'This member already has an active programme/purpose scope. Revoke it before setting another.');
    if (list.filter(x => !x.revokedAt).length >= MAX_ACTIVE) fail(422, 'Active access-purpose grant limit reached.');
    if (list.length >= MAX_STORED) fail(422, `Stored access-purpose grant limit reached (${MAX_STORED.toLocaleString('en-IN')} records, kept as evidence).`);
    g = { id: uuid(), memberId: c.memberId, programme: c.programme, purposes: [...new Set(c.purposes)], version: 1, setBy: u.userId, setAt: now, reason: c.reason };
    (ops.purposeGrants ??= []).push(g);
    const parts: string[] = [];
    if (c.programme) parts.push(`programme ${c.programme}`);
    if (c.purposes.length) parts.push(`purposes ${c.purposes.map(p => ACCESS_PURPOSE_LABEL[p].toLowerCase()).join(', ')}`);
    detail = `${target.displayName}: access narrowed to ${parts.join(' and ')} (grant ${g.id}). Reason: ${c.reason}`;
    result = { grantId: g.id, version: g.version };
  } else {
    g = list.find(x => x.id === c.grantId)!;
    if (!g) fail(404, 'Access-purpose grant not found.');
    if (g.version !== c.version) fail(409, 'This grant changed. Refresh before revoking it.');
    if (g.revokedAt) fail(409, 'This grant is already revoked.');
    Object.assign(g, { revokedAt: now, revokedBy: u.userId, revokeReason: c.reason, version: g.version + 1 });
    detail = `Access-purpose grant for ${member(s, g.memberId)?.displayName ?? 'a former member'} revoked. Reason: ${c.reason}`;
    result = { grantId: g.id, version: g.version };
  }
  s.workspace.audit.push({ id: uuid(), at: now, actor: u.displayName, actorId: u.userId, role: m.role, action: c.type, subject: g.id, detail });
  return result;
}

// Read view: owners see every grant; a member sees their own. Admins and providers see none.
export function purposeScopeView(s: OrgState, m: Member) {
  const name = (userId: string) => member(s, userId)?.displayName ?? 'Former member';
  const all = purposeGrants(s).slice().reverse();
  const visible = m.isOwner ? all : all.filter(g => g.memberId === m.userId);
  return {
    purposes: ACCESS_PURPOSES.map(p => ({ id: p, label: ACCESS_PURPOSE_LABEL[p] })),
    programmes: PROGRAMME_NAMES.slice(),
    grants: visible.map(g => ({
      id: g.id,
      memberId: g.memberId,
      memberName: name(g.memberId),
      programme: g.programme,
      purposes: g.purposes,
      purposeLabels: g.purposes.map(p => ACCESS_PURPOSE_LABEL[p]),
      version: g.version,
      setBy: name(g.setBy),
      setAt: g.setAt,
      reason: g.reason,
      state: g.revokedAt ? 'revoked' : 'active',
      revokedBy: g.revokedBy ? name(g.revokedBy) : undefined,
      revokeReason: g.revokeReason,
    })),
    grantable: m.isOwner
      ? s.members.filter(x => x.status === 'active' && !x.isOwner && x.role !== 'admin' && x.role !== 'provider').map(x => ({
          userId: x.userId,
          displayName: x.displayName,
          role: x.role,
          teamIds: x.teamIds,
          hasActive: all.some(g => g.memberId === x.userId && !g.revokedAt),
        }))
      : [],
  };
}
