import { z } from 'zod';

const text = z.string().trim().min(1).max(200);
export const federationRole = z.enum(['asha', 'clinician', 'supervisor', 'admin', 'provider']);
export const federationMapping = z.object({
  upstreamGroup: text,
  localRole: federationRole,
  teamIds: z.array(text).max(30).refine((x) => new Set(x).size === x.length),
}).strict();
export const federationEvent = z.object({
  eventId: z.string().uuid(),
  source: text,
  subjectAccountCode: z.string().regex(/^[A-F0-9]{24}$/),
  kind: z.enum(['membership-removed', 'groups-changed']),
  groups: z.array(text).max(50).refine((x) => new Set(x).size === x.length),
  occurredAt: z.string().datetime(),
  mappingVersion: z.number().int().positive(),
  mappings: z.array(federationMapping).max(100),
  reason: text,
}).strict().superRefine((x, ctx) => {
  if (x.kind === 'membership-removed' && x.groups.length)
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'A removal carries no groups.', path: ['groups'] });
  const groups = x.mappings.map((m) => m.upstreamGroup);
  if (new Set(groups).size !== groups.length)
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Each upstream group maps once.', path: ['mappings'] });
});
export type FederationEvent = z.infer<typeof federationEvent>;
export type FederationMember = { userId: string; accountCode: string; role: z.infer<typeof federationRole>; status: 'active'|'suspended'|'removed'; version: number; isOwner: boolean; teamIds: string[] };

export type FederationDecision =
  | { outcome: 'suspend'; reason: 'upstream-removed'|'unmapped-group'; groups: string[] }
  | { outcome: 'apply'; role: z.infer<typeof federationRole>; teamIds: string[]; groups: string[] };

/** Fail-closed translation from an authoritative event to a local access decision.
 * Mapping review/approval is an input boundary; this function never elevates an
 * unrecognised group and never combines conflicting role mappings.
 */
export function federationDecision(event: FederationEvent): FederationDecision {
  if (event.kind === 'membership-removed') return { outcome: 'suspend', reason: 'upstream-removed', groups: [] };
  const byGroup = new Map(event.mappings.map((m) => [m.upstreamGroup, m]));
  const chosen = event.groups.map((g) => byGroup.get(g));
  if (!chosen.length || chosen.some((x) => !x))
    return { outcome: 'suspend', reason: 'unmapped-group', groups: [...event.groups].sort() };
  const roles = new Set(chosen.map((x) => x!.localRole));
  if (roles.size !== 1) return { outcome: 'suspend', reason: 'unmapped-group', groups: [...event.groups].sort() };
  const role = chosen[0]!.localRole;
  const teamIds = [...new Set(chosen.flatMap((x) => x!.teamIds))].sort();
  if (role !== 'admin' && teamIds.length === 0)
    return { outcome: 'suspend', reason: 'unmapped-group', groups: [...event.groups].sort() };
  return { outcome: 'apply', role, teamIds, groups: [...event.groups].sort() };
}

export function federationCommand(member: FederationMember, event: FederationEvent) {
  if (member.status === 'removed') throw new Error('Removed memberships cannot be restored by federation.');
  if (member.isOwner) throw new Error('Federation cannot change an organisation owner.');
  const decision = federationDecision(event);
  const suspended = decision.outcome === 'suspend';
  return {
    type: 'updateMember' as const,
    userId: member.userId,
    version: member.version,
    role: suspended ? member.role : decision.role,
    teamIds: suspended ? member.teamIds : decision.teamIds,
    isOwner: false,
    status: suspended ? 'suspended' as const : 'active' as const,
    reason: `Authoritative workforce event ${event.eventId} from ${event.source}; mapping version ${event.mappingVersion}; ${event.reason}`,
    decision,
  };
}
