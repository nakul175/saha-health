// Slice r03: the additional alert sources that flow through the out-of-app notification channel (slice 10b).
//
// The channel originally carried only the in-app operational alerts of slice 6g/6v, one tiered ladder per occurrence.
// This module derives the further sources the requirements call for, as `SourcePresent` values the pure planner
// `planSourceNotifications` (notification-channel.ts) turns into the same demonstration-simulator messages:
//   drift                 capability revisions whose shadow agreement dropped (slice 5i, BR-AI-10), owner-owned;
//   agent-timed-out       assistant requests past their task time limit without a confirmed result (slice 5e, BR-AG-07);
//   exception-item        individual exception-queue items in a supervisor's own care scope (slice 6i, BR-REP-01);
//   referral-request      open field referral requests in a supervisor's own care scope (slice 3i, BR-CARE-01).
//
// A count is only ever the recipient's own view (slice 6v/10b). Nothing here contacts an address or number and nothing
// is persisted by this module: it is pure, and the server (notification-channel-server.ts) reads it and commits messages.
import { driftReport } from './drift';
import { currentFields } from './shadow';
import { timedOut } from './task-limits';
import { deviceDiagnosticRows, exceptionQueue, withDeviceDiagnostics, type DeviceDiagnostic } from './exceptions';
import { referralRequestQueue } from './referral-request-queue';
import { digest } from './core';
import type { Member, OrgState } from './types';
import { SOURCE_OWNERS, type OwnerRole, type SourcePresent } from './notification-channel';

export const SOURCE_RULES_VERSION = '1.1.0';

// Who holds an owner role (mirrors `canAcknowledge` in alerts.ts): owners, owners/administrators, or supervisors and
// non-administrator owners. Used only to pick which members get a count in their own view.
const holds = (m: Member, owner: OwnerRole) => m.status === 'active' && (owner === 'owners' ? m.isOwner : owner === 'operations' ? (m.isOwner || m.role === 'admin') : (m.role === 'supervisor' || (m.isOwner && m.role !== 'admin')));
const earliest = (xs: string[]) => (xs.length ? xs.reduce((a, b) => (a < b ? a : b)) : undefined);

// Pure: build the source occurrences for an organisation. No storage, no network, no clock beyond `now`.
export async function channelSources(s: OrgState, now = new Date().toISOString(), diagnostics: readonly DeviceDiagnostic[] = []): Promise<SourcePresent[]> {
  const out: SourcePresent[] = [];

  // BR-AI-10: drift — capability revisions with an agreement drop over the last periods, counted only.
  const drops = driftReport(s, s.governance?.shadows ?? [], now, (r, sh) => currentFields(s, r, sh)).filter(r => r.status === 'drop');
  if (drops.length) {
    const openedAt = earliest(drops.flatMap(d => d.changes.filter(c => c.status === 'drop').map(c => c.to))) ?? now;
    out.push({ kind: 'drift', scopeKey: 'org', severity: 'high', title: `AI capability drift: ${drops.length} revision${drops.length === 1 ? '' : 's'} with an agreement drop`, openedAt, recipients: orgRecipients(s, 'owners', drops.length) });
  }

  // BR-AG-07: assistant requests past their recorded task time limit without a confirmed result.
  const timedOutRuns = s.workspace.visits.flatMap(v => (v.agentRuns ?? []).filter(r => timedOut(r, now)));
  if (timedOutRuns.length) {
    const openedAt = earliest(timedOutRuns.map(r => r.startedAt ?? r.createdAt)) ?? now;
    out.push({ kind: 'agent-timed-out', scopeKey: 'org', severity: 'high', title: 'Assistant requests timed out without a confirmed result', openedAt, recipients: orgRecipients(s, 'operations', timedOutRuns.length) });
  }

  // BR-REP-01: one occurrence per individual visible queue item. The occurrence key uses an opaque digest so patient,
  // visit and task identifiers never enter the notification table or simulator message.
  for (const m of s.members) {
    if (!holds(m, SOURCE_OWNERS['exception-item'])) continue;
    try { const items=withDeviceDiagnostics(exceptionQueue(s,m,now),deviceDiagnosticRows(s,m,diagnostics,now)).items; for(const item of items)out.push({kind:'exception-item',scopeKey:`${m.userId}:${await digest(['exception-item',item.id])}`,severity:item.severity==='normal'?'normal':'high',title:`${item.kind.replaceAll('-',' ')} exception awaiting recovery`,openedAt:item.since,recipients:[{userId:m.userId,count:1}]}); } catch { /* A refused/scoped queue produces no notification source. */ }
  }

  // BR-CARE-01: open field referral requests, per care scope.
  for (const m of s.members) {
    if (!holds(m, SOURCE_OWNERS['referral-request'])) continue;
    let count = 0, openedAt = now;
    try { const q = referralRequestQueue(s, m, now); count = q.total; openedAt = earliest(q.items.map(r => r.requestedAt)) ?? now; } catch { count = 0; }
    if (!count) continue;
    out.push({ kind: 'referral-request', scopeKey: m.userId, severity: 'normal', title: 'Open field referral requests awaiting a decision', openedAt, recipients: [{ userId: m.userId, count }] });
  }

  return out;
}

function orgRecipients(s: OrgState, owner: OwnerRole, count: number): { userId: string; count: number }[] {
  return s.members.filter(m => holds(m, owner)).map(m => ({ userId: m.userId, count }));
}
