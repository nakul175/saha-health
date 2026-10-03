import { z } from 'zod';
import { fail, uuid } from './core';
import { allowed, normallyAllowed } from './access';
import { supervises } from './delegation';
import { TERMINAL, type Urgency } from './referral-rules';
import { requireReporting } from './operations';
import type { Actor } from './store';
import type { FollowUp } from './programmes';
import type { Member, OrgState, Person, Referral } from './types';
import type { SafetyCase } from './governance';

// Slice r74: automatic reassignment of work that loses its owner, safety-case reassignment beyond
// clinicians, and assignment of items directly from the exception/action queue (BR-CARE-01, BR-CARE-04,
// BR-REP-01). The reassignment itself is derived on read — nothing is copied or sent, and nobody is
// notified; a named eligible owner is recorded only when a steward (or a claiming care worker) runs the
// assignment command. The existing ownership-gap and stewardship rules from the action plan, referrals
// and governance are reused unchanged: a steward is a supervisor, or an owner with a care role, in the
// patient's team (or a clinician holding a supervision delegation for it), an eligible care-worker owner
// is an active ASHA or clinician with normal access, and a safety-case owner must be an active clinician
// with normal access.
export const REASSIGNMENT_RULES_VERSION = '1.0.0';
export type QueueKind = 'follow-up' | 'referral' | 'safety-case';

// Steward of a patient's team: mirrors action-plan.ts and referrals.ts.
const steward = (s: OrgState, m: Member, p: Person) => supervises(s, m, p.teamId);
// Eligible owner of a care task: mirrors action-plan.ts eligibleOwner.
const eligibleOwner = (o: Member | undefined, p: Person) => !!o && ['asha', 'clinician'].includes(o.role) && normallyAllowed(o, p);
const careWorker = (m: Member, p: Person) => ['asha', 'clinician'].includes(m.role) && normallyAllowed(m, p);
// A safety-case owner must be a clinician: mirrors governance.ts ownPatient.
const clinicianOwner = (o: Member | undefined, p: Person) => !!o && o.status === 'active' && o.role === 'clinician' && normallyAllowed(o, p);

// Why an item's named owner no longer counts, or null when the owner still holds the work.
function lostOwner(s: OrgState, p: Person, ownerId: string | undefined, clinical: boolean): { reason: string; name: string | null } | null {
  if (!ownerId) return { reason: clinical ? 'No named clinical owner' : 'No named care worker', name: null };
  const o = s.members.find(x => x.userId === ownerId);
  if (!o || o.status !== 'active') return { reason: 'the owner is no longer an active member', name: o?.displayName ?? 'Former member' };
  if (clinical ? o.role !== 'clinician' : !['asha', 'clinician'].includes(o.role)) return { reason: clinical ? 'the owner no longer holds a clinical role' : 'the owner no longer holds a care role', name: o.displayName };
  if (!normallyAllowed(o, p)) return { reason: 'the owner no longer has current care access', name: o.displayName };
  return null;
}

export type LostWorkItem = {
  kind: QueueKind;
  id: string;
  personId: string;
  personName: string;
  title: string;
  due: string | null;
  urgency: Urgency;
  ownerId: string | null;
  ownerName: string | null;
  reason: string;
  reassignedTo: string;
  automatic: true;
  since: string;
  link: { personId: string; visitId: string | null; href: string };
  recovery: string;
  canAssign: boolean;
  canClaim: boolean;
};

export const href = (personId: string, visitId: string | null) => `/?patient=${encodeURIComponent(personId)}${visitId ? `&visit=${encodeURIComponent(visitId)}` : ''}`;
export const MAX_ROWS = 500;

// The monitored queue of work whose owner was lost (BR-CARE-01, BR-REP-01): derived on read, one row per
// open follow-up, referral or safety case in the viewer's reporting scope, each showing the queue it is
// automatically reassigned to. Supervisors and owners see their teams; administrators are refused like the
// exception queue.
export function lostWork(s: OrgState, m: Member, now = new Date().toISOString()) {
  requireReporting(m);
  if (m.status !== 'active') fail(403, 'Your membership is inactive.');
  if (m.role === 'admin') fail(403, 'This queue contains patient information.');
  const team = (p: Person) => s.teams.find(t => t.id === p.teamId)?.name ?? 'the patient\'s team';
  const name = (id?: string | null) => (id ? s.members.find(x => x.userId === id)?.displayName ?? 'Former member' : null);
  const rows: LostWorkItem[] = [];
  for (const p of s.workspace.people) {
    if (!allowed(m, p, now)) continue;
    const lead = steward(s, m, p);
    // Open follow-ups.
    for (const f of p.followUps ?? []) {
      if (f.state !== 'open') continue;
      const lost = lostOwner(s, p, f.ownerId, false);
      if (!lost) continue;
      rows.push({
        kind: 'follow-up', id: f.id, personId: p.id, personName: p.name, title: f.title, due: f.due, urgency: 'routine',
        ownerId: f.ownerId, ownerName: name(f.ownerId), reason: lost.reason, reassignedTo: `Supervisors of ${team(p)}`, automatic: true,
        since: f.createdAt, link: { personId: p.id, visitId: null, href: href(p.id, null) },
        recovery: 'Assign the follow-up to an eligible care worker from here, or complete it from the patient\'s action plan.',
        canAssign: lead, canClaim: careWorker(m, p),
      });
    }
    // Open referrals.
    for (const r of s.workspace.referrals) {
      if (r.personId !== p.id || TERMINAL.has(r.state)) continue;
      const lost = lostOwner(s, p, r.ownerId, false);
      if (!lost) continue;
      rows.push({
        kind: 'referral', id: r.id, personId: p.id, personName: p.name, title: `Referral to ${r.facility}`, due: r.due ?? null,
        urgency: r.urgency ?? 'routine', ownerId: r.ownerId ?? null, ownerName: name(r.ownerId), reason: lost.reason,
        reassignedTo: `Supervisors of ${team(p)}`, automatic: true, since: r.createdAt,
        link: { personId: p.id, visitId: r.visitId, href: href(p.id, r.visitId) },
        recovery: 'Record the next referral event with evidence, or assign an owner from here.',
        canAssign: lead, canClaim: careWorker(m, p),
      });
    }
    // Open clinical safety cases.
    for (const c of s.governance?.safety ?? []) {
      if (c.personId !== p.id || c.state !== 'open') continue;
      const lost = lostOwner(s, p, c.ownerId, true);
      if (!lost) continue;
      rows.push({
        kind: 'safety-case', id: c.id, personId: p.id, personName: p.name, title: `Clinical safety case: ${c.kind.replace(/-/g, ' ')}`, due: null,
        urgency: 'urgent', ownerId: c.ownerId, ownerName: name(c.ownerId), reason: lost.reason, reassignedTo: `Clinicians of ${team(p)}`, automatic: true,
        since: c.createdAt, link: { personId: p.id, visitId: c.visitId, href: href(p.id, c.visitId) },
        recovery: 'A steward reassigns the case to an active clinician with patient access from here; the clinical owner then reviews and resolves it.',
        canAssign: lead, canClaim: false,
      });
    }
  }
  rows.sort((a, b) => (a.kind === 'safety-case' ? 0 : 1) - (b.kind === 'safety-case' ? 0 : 1) || ({ emergency: 0, urgent: 1, routine: 2 })[a.urgency] - ({ emergency: 0, urgent: 1, routine: 2 })[b.urgency] || a.since.localeCompare(b.since) || a.personId.localeCompare(b.personId) || a.id.localeCompare(b.id));
  return {
    rulesVersion: REASSIGNMENT_RULES_VERSION, generatedAt: now, total: rows.length, items: rows.slice(0, MAX_ROWS), truncated: rows.length > MAX_ROWS,
    scope: 'Patients in your reporting scope whose open work lost its owner.',
    rules: 'Work that loses its owner is automatically reassigned on read to the responsible team queue (supervisors for care tasks, clinicians for safety cases). Assign it to a named eligible care worker from here; nothing is notified and nothing is sent — the reassignment is computed, not stored.',
  };
}

// Resolve one queue item to its patient and record; fails when the item is not open work of this organisation.
type Resolved = { p: Person; kind: QueueKind; record: FollowUp | Referral | SafetyCase };
function resolveQueueItem(s: OrgState, t: { kind: QueueKind; id: string }): Resolved {
  if (t.kind === 'follow-up') {
    for (const p of s.workspace.people) {
      const f = p.followUps?.find(x => x.id === t.id);
      if (f) {
        if (f.state !== 'open') fail(409, 'Choose an open follow-up of this patient.');
        return { p, kind: 'follow-up', record: f };
      }
    }
    fail(404, 'Follow-up not found.');
  }
  if (t.kind === 'referral') {
    const r = s.workspace.referrals.find(x => x.id === t.id);
    if (!r) fail(404, 'Referral not found.');
    const p = s.workspace.people.find(x => x.id === r.personId);
    if (!p) fail(404, 'Patient not found.');
    if (TERMINAL.has(r.state)) fail(409, 'This referral is closed.');
    return { p, kind: 'referral', record: r };
  }
  const c = s.governance?.safety?.find(x => x.id === t.id);
  if (!c) fail(404, 'Safety case not found.');
  const p = s.workspace.people.find(x => x.id === c.personId);
  if (!p) fail(404, 'Patient not found.');
  if (c.state !== 'open') fail(409, 'This safety case is closed.');
  return { p, kind: 'safety-case', record: c };
}
const ownerIdOf = (kind: QueueKind, r: FollowUp | Referral | SafetyCase) => kind === 'follow-up' ? (r as FollowUp).ownerId : kind === 'referral' ? (r as Referral).ownerId : (r as SafetyCase).ownerId;

// Slice r74: assign queue items (follow-up, referral or safety case) directly from the exception/action
// queue, naming the item rather than the patient. A steward may reassign any of them — including a safety
// case, which previously only a clinician could reassign — and a care worker may take ownership for
// themselves of an unowned follow-up or referral. The same authority is rechecked on replay.
export function authorizeReassignment(s: OrgState, m: Member, c: any) {
  if (c?.type !== 'assignQueueItem') return;
  if (new Set(c.targets.map((t: { kind: QueueKind; id: string }) => t.kind + ':' + t.id)).size !== c.targets.length) fail(422, 'List each item once.');
  const rows = c.targets.map((t: { kind: QueueKind; id: string }) => resolveQueueItem(s, t));
  for (const { p, kind, record } of rows) {
    if (steward(s, m, p)) continue;
    if (!careWorker(m, p)) fail(403, 'A supervisor or owner of the patient\'s team, or a care worker with current access, is required.');
    if (c.ownerId !== m.userId) fail(403, 'Care workers can take ownership for themselves only. Ask a supervisor to assign someone else.');
    if (kind === 'safety-case') fail(403, 'Only a supervisor or owner of the patient\'s team can reassign a safety case.');
    if (eligibleOwner(s.members.find(x => x.userId === ownerIdOf(kind, record) && x.status === 'active'), p)) fail(403, 'This item already has an owner with current access. Ask a supervisor to reassign it.');
  }
}

export const reassignmentSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('assignQueueItem'),
    targets: z.array(z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('follow-up'), id: z.string().trim().min(1).max(200) }).strict(),
      z.object({ kind: z.literal('referral'), id: z.string().trim().min(1).max(200), version: z.number().int().positive() }).strict(),
      z.object({ kind: z.literal('safety-case'), id: z.string().trim().min(1).max(200), version: z.number().int().positive() }).strict(),
    ])).min(1).max(20),
    ownerId: z.string().trim().min(1).max(200),
    reason: z.string().trim().min(10).max(500),
  }).strict(),
]);

export function applyReassignment(s: OrgState, input: unknown, u: Actor, m: Member, now = new Date().toISOString()): any | null {
  const parsed = reassignmentSchema.safeParse(input);
  if (!parsed.success) return null;
  const c = parsed.data, w = s.workspace;
  authorizeReassignment(s, m, c);
  const owner = s.members.find(x => x.userId === c.ownerId && x.status === 'active');
  const rows = c.targets.map(t => ({ t, ...resolveQueueItem(s, t) }));
  const nameOf = (id?: string | null) => (id ? s.members.find(x => x.userId === id)?.displayName ?? 'Former member' : 'nobody');
  // Validate the new owner and capture what changed (before any mutation), then mutate.
  const changed: string[] = [];
  for (const { t, p, kind, record } of rows) {
    const prior = ownerIdOf(kind, record);
    const label = kind === 'follow-up' ? `follow-up "${(record as FollowUp).title}"` : kind === 'referral' ? `referral to ${(record as Referral).facility}` : `safety case "${(record as SafetyCase).kind.replace(/-/g, ' ')}"`;
    if (kind === 'safety-case') {
      if (!clinicianOwner(owner, p)) fail(422, 'Choose an active clinician with current access to this patient.');
      if ((record as SafetyCase).version !== (t as any).version) fail(409, 'Safety case changed. Refresh before assigning.');
      if (prior === owner!.userId) fail(409, 'This safety case already belongs to that clinician.');
    } else {
      if (!eligibleOwner(owner, p)) fail(422, 'Choose an active care worker with current access to this patient.');
      if (kind === 'referral') {
        if (((record as Referral).version ?? 1) !== (t as any).version) fail(409, 'Referral changed. Refresh before assigning.');
        if (prior === owner!.userId) fail(409, 'This referral already belongs to that care worker.');
      } else if (prior === owner!.userId) {
        fail(409, 'This follow-up already belongs to that care worker.');
      }
    }
    changed.push(`${label} from ${nameOf(prior)}`);
  }
  const changedPersons = new Set<string>();
  for (const { t, p, kind, record } of rows) {
    if (kind === 'safety-case') {
      (record as SafetyCase).ownerId = owner!.userId;
      (record as SafetyCase).version++;
    } else if (kind === 'referral') {
      (record as Referral).ownerId = owner!.userId;
      (record as Referral).version = ((record as Referral).version ?? 1) + 1;
    } else {
      (record as FollowUp).ownerId = owner!.userId;
      changedPersons.add(p.id);
    }
  }
  for (const pid of changedPersons) { const p = s.workspace.people.find(x => x.id === pid)!; p.version++; }
  const stewardClaim = rows.every(({ p }) => steward(s, m, p));
  const detail = `${c.ownerId === u.userId && !stewardClaim ? 'Ownership taken' : 'Reassigned'} to ${owner!.displayName}: ${changed.join('; ')}. ${c.reason}`;
  w.audit.push({ id: uuid(), at: now, actorId: u.userId, actor: u.displayName, role: m.role, action: c.type, subject: rows[0].p.id, personId: rows[0].p.id, detail });
  return { assigned: rows.length, ownerId: owner!.userId };
}
