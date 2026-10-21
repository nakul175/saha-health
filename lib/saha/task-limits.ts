import { fail } from './core';
import type { AgentRun } from './agent';
import type { OrgState, Visit } from './types';
// Slice 5e (BR-AG-07): per-capability task time and attempt limits.
//
// Limits are optional fields of a capability's governance manifest (`taskTimeLimitMinutes`,
// `taskAttemptLimit`), so they are set by the governance manager who writes the revision, bound
// into its manifest hash, independently reviewed and activated by an owner with it. A request
// records the limits of the revision it was prepared under.
// - Time: an unsent request expires at its time limit (never later than the existing 15 minutes);
//   a request sent to a provider without a confirmed result after its time limit is TIMED OUT. Its
//   outcome is uncertain: it is never resent or retried, and it stays open until a person records
//   a decision (closeTimedOutAgent), after which any late result is withheld.
// - Attempts: requests for the same task on the same visit under any revision of the capability
//   that reached a provider, or are prepared and unexpired, count as attempts. Once the limit is
//   reached, further requests are refused before they are prepared and again before they are sent.
export const DEFAULT_EXPIRY_MINUTES = 15;
export type TaskLimits = { timeMinutes: number | null; attempts: number | null; steps: number; toolCalls: number; retries: number };
type Spec = { kind: string; key?: string; taskTimeLimitMinutes?: number; taskAttemptLimit?: number; taskStepLimit?: number; taskToolCallLimit?: number; taskRetryLimit?: number };
export function limitsOf(e: { spec: Spec } | undefined): TaskLimits | null {
  if (!e || e.spec.kind !== 'capability' || !e.spec.taskTimeLimitMinutes && !e.spec.taskAttemptLimit && !e.spec.taskStepLimit && e.spec.taskToolCallLimit===undefined && e.spec.taskRetryLimit===undefined) return null;
  return { timeMinutes: e.spec.taskTimeLimitMinutes ?? null, attempts: e.spec.taskAttemptLimit ?? null, steps: e.spec.taskStepLimit ?? 1, toolCalls: e.spec.taskToolCallLimit ?? 0, retries: e.spec.taskRetryLimit ?? 0 };
}
// Unsent requests expire at the earlier of the existing 15 minutes and the capability's time limit.
export function expiryMinutes(l: TaskLimits | null) { return Math.min(DEFAULT_EXPIRY_MINUTES, l?.timeMinutes ?? DEFAULT_EXPIRY_MINUTES); }
// A sent request without a confirmed result past its time limit.
export function timedOut(r: Pick<AgentRun, 'status' | 'startedAt' | 'createdAt'> & { limits?: TaskLimits | null }, now = new Date().toISOString()) {
  const minutes = r.limits?.timeMinutes;
  return r.status === 'running' && !!minutes && Date.parse(r.startedAt ?? r.createdAt) + minutes * 60000 < Date.parse(now);
}
const keyIds = (s: OrgState, key: string) => new Set(((s.governance?.entries ?? []) as unknown as { id: string; spec: Spec }[]).filter(e => e.spec.kind === 'capability' && e.spec.key === key).map(e => e.id));
export function attemptsUsed(s: OrgState, v: Visit, key: string, task: string, now: string, excludeRunId?: string) {
  const ids = keyIds(s, key);
  return (v.agentRuns ?? []).filter(r => r.id !== excludeRunId && r.task === task && r.governance && ids.has(r.governance.id) && (r.callCount > 0 || (r.status === 'pending' && r.expiresAt >= now))).length;
}
// Called before a request is prepared (nothing excluded) and before it is sent (itself excluded).
export function checkTaskAttempts(s: OrgState, e: { spec: Spec }, v: Visit, task: string, excludeRunId?: string, now = new Date().toISOString()) {
  const l = limitsOf(e); if (!l?.attempts || !e.spec.key) return;
  const used = attemptsUsed(s, v, e.spec.key, task, now, excludeRunId);
  if (used >= l.attempts) fail(429, `This task reached its attempt limit on this visit (${used} of ${l.attempts} attempts under this capability). No further request is sent, automatically or manually. Record the values with structured capture; no provider substitution was made.`);
}
export const limitsSummary = (l: TaskLimits | null) => !l ? `No governed capability limits recorded; unsent requests expire after ${DEFAULT_EXPIRY_MINUTES} minutes and execution remains one step with no tool calls or retries.` : [l.timeMinutes ? `time limit ${l.timeMinutes} minute${l.timeMinutes === 1 ? '' : 's'}` : null, l.attempts ? `${l.attempts} attempt${l.attempts === 1 ? '' : 's'} per task on a visit` : null, `${l.steps} execution step${l.steps===1?'':'s'}`, `${l.toolCalls} tool call${l.toolCalls===1?'':'s'}`, `${l.retries} retr${l.retries===1?'y':'ies'}`].filter(Boolean).join(', ') + '.';
