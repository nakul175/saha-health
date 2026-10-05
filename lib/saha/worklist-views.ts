import type { Person, Referral, Submission, Visit } from './types';
import type { FollowUp } from './programmes';
import { TERMINAL } from './referral-rules';

// Slice 0b-4: the browser-built work views (My work statistics, visit list and follow-ups, Submissions and the
// referral tracker) are defined once here. The unpaged workspace applies them to the records it holds; the
// server applies the same functions to the viewer's whole scope for a paged workspace (lib/saha/worklists.ts),
// so counts and ordering are the same for the same viewer on the same data. No database or browser code here.
export const ATTENTION_STATES = ['uncertain', 'sending', 'queued', 'retryable'] as const;
export const needsAttention = (s: Pick<Submission, 'state'>) => (ATTENTION_STATES as readonly string[]).includes(s.state);
const byIdAsc = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

type VisitPerson = Pick<Person, 'id' | 'name' | 'status' | 'due'>;
// Not yet confirmed first, then due today, then name (fixed 'en' collation, so the browser and the Worker agree);
// the record id breaks ties so the order never depends on load order.
export function visitCompare(a: VisitPerson, b: VisitPerson) {
  return Number(a.status === 'completed') - Number(b.status === 'completed') || Number(b.due === 'Today') - Number(a.due === 'Today') || a.name.localeCompare(b.name, 'en') || byIdAsc(a.id, b.id);
}
export const visitList = <T extends VisitPerson>(people: T[]) => people.slice().sort(visitCompare);

// Slice 10i: imported visits are historical records from another system and are not counted as confirmed visits.
type StatsVisit = Pick<Visit, 'state' | 'voidedAt' | 'supersededBy'> & { imported?: unknown };
export function workStats(people: Pick<Person, 'status' | 'due'>[], visits: StatsVisit[], submissions: Pick<Submission, 'state'>[]) {
  return {
    toDo: people.filter(p => p.status === 'due' && p.due === 'Today').length,
    inProgress: people.filter(p => p.status === 'in_progress').length,
    confirmed: visits.filter(v => v.state === 'confirmed' && !v.voidedAt && !v.supersededBy && !v.imported).length,
    attention: submissions.filter(needsAttention).length,
  };
}
export type WorkStats = ReturnType<typeof workStats>;

// Open programme follow-ups by due date, grouped by person in order of each person's earliest open task.
export type FollowUpGroup<P> = { person: P; tasks: FollowUp[] };
export function followUpGroups<P extends Pick<Person, 'id' | 'followUps'>>(people: P[]) {
  const rows = people.flatMap(p => (p.followUps ?? []).filter(t => t.state === 'open' && (t as any).transitionStatus!=='superseded').map(t => ({ p, t })))
    .sort((a, b) => a.t.due.localeCompare(b.t.due) || byIdAsc(a.p.id, b.p.id));
  const groups = new Map<string, FollowUpGroup<P>>();
  for (const { p, t } of rows) { const g = groups.get(p.id); if (g) g.tasks.push(t); else groups.set(p.id, { person: p, tasks: [t] }); }
  return { tasks: rows.length, groups: [...groups.values()] };
}

// Most recent first: creation time, then record id, both descending. Before slice 0b-4 the list was the reverse
// of the snapshot's record id order; ids are random, so that order was not by time.
export function submissionList<S extends Pick<Submission, 'id' | 'state' | 'createdAt'>>(submissions: S[], attentionOnly = false) {
  const all = submissions.slice().sort((a, b) => byIdAsc(b.createdAt ?? '', a.createdAt ?? '') || byIdAsc(b.id, a.id));
  return { all: all.length, attention: all.filter(needsAttention).length, rows: attentionOnly ? all.filter(needsAttention) : all };
}

// Open referrals first, then by due date (none last); the record id breaks ties.
export function referralList<R extends Pick<Referral, 'id' | 'state' | 'due'>>(referrals: R[]) {
  return referrals.slice().sort((a, b) => Number(TERMINAL.has(a.state)) - Number(TERMINAL.has(b.state)) || (a.due ?? '9999').localeCompare(b.due ?? '9999') || byIdAsc(a.id, b.id));
}
