import { z } from 'zod';

const id = z.string().min(1).max(200);
const actor = z.string().min(1);
const version = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const role = z.enum(['asha', 'clinician', 'supervisor', 'admin', 'provider']);
const teams = z.array(id).max(20).refine(value => new Set(value).size === value.length);
export const workforceMember = z.object({
  userId: actor, name: z.string().min(1).max(200), role,
  isOwner: z.boolean(), status: z.enum(['active', 'suspended', 'removed']),
  version, teamIds: teams,
}).strict();
export const workforceContext = z.object({
  actorId: actor, organisation: z.object({ id, name: z.string().min(1).max(200) }).strict(),
  members: z.array(workforceMember).max(500),
}).strict().superRefine((value, context) => {
  if (new Set(value.members.map(member => member.userId)).size !== value.members.length)
    context.addIssue({ code: 'custom', message: 'Duplicate membership.' });
  if (!value.members.some(member => member.userId === value.actorId && member.isOwner && member.status === 'active'))
    context.addIssue({ code: 'custom', message: 'Current owner membership required.' });
});
export const ownerOrganisations = z.object({
  actorId: actor,
  organisations: z.array(z.object({ id, name: z.string().min(1).max(200) }).strict()).max(500),
}).strict().superRefine((value, context) => {
  if (new Set(value.organisations.map(organisation => organisation.id)).size !== value.organisations.length)
    context.addIssue({ code: 'custom', message: 'Duplicate organisation.' });
});
export const suspensionCommand = z.object({
  type: z.literal('updateMember'), userId: z.string().trim().min(1).max(200), version, role, teamIds: teams,
  isOwner: z.boolean(), status: z.literal('suspended'), reason: z.string().trim().min(5).max(1000),
}).strict();
export type WorkforceContext = z.infer<typeof workforceContext>;
export type SuspensionCommand = z.infer<typeof suspensionCommand>;
export type SuspensionAttempt = {
  key: string; actorId: string; organisationId: string; command: SuspensionCommand;
};
export function prepareSuspension(value: WorkforceContext, userId: string, reason: string, key: string): SuspensionAttempt {
  const current = workforceContext.parse(value), member = current.members.find(member => member.userId === userId);
  if (!member || member.status !== 'active' || member.userId === current.actorId || member.userId.startsWith('fixture:'))
    throw Error('Choose another current active membership.');
  if (member.userId.trim() !== member.userId) throw Error('This member reference cannot be preserved by the original suspension command.');
  if (member.isOwner && current.members.filter(member => member.isOwner && member.status === 'active').length <= 1)
    throw Error('Keep an active organisation owner.');
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(key)) throw Error('A valid original attempt reference is required.');
  return { key, actorId: current.actorId, organisationId: current.organisation.id,
    command: suspensionCommand.parse({ type: 'updateMember', userId: member.userId, version: member.version,
      role: member.role, teamIds: [...member.teamIds], isOwner: member.isOwner, status: 'suspended', reason }) };
}
export function unchangedSuspensionTarget(member: z.infer<typeof workforceMember> | undefined, command: SuspensionCommand): boolean {
  return !!member && member.status === 'active' && member.version === command.version && member.role === command.role &&
    member.isOwner === command.isOwner && JSON.stringify([...member.teamIds].sort()) === JSON.stringify([...command.teamIds].sort());
}
export function recordedSuspensionMatches(attempt: SuspensionAttempt, context: WorkforceContext): boolean {
  const target = context.members.find(member => member.userId === attempt.command.userId);
  return context.actorId === attempt.actorId && context.organisation.id === attempt.organisationId &&
    !!target && target.version > attempt.command.version;
}
