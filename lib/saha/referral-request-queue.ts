import { fail } from './core';
import { allowed } from './access';
import { href, REQUEST_WAIT_HOURS } from './exceptions';
import type { Member, OrgState, Visit } from './types';
import { clinicalAuthority } from './operations';

// Slice 3i: every open field referral request (slice 3g, decided in slice 3h) in the viewer's care scope,
// computed on read. Clinicians decide; supervisors and owners with a care role watch the queue. Scope is access.ts, as for the exception queue (6i) and the action plan (4b).
export const REQUEST_QUEUE_VERSION = '1.0.0';
// A request undecided for REQUEST_WAIT_HOURS (exceptions.ts) is "long-waiting" and is also raised in the exception queue.
export const MAX_REQUESTS = 500;
export { REQUEST_WAIT_HOURS };
export type RequestItem = {
  visitId: string; patient: { id: string; name: string; village: string }; requestedBy: string; requestedAt: string; capturedAt: string;
  facility: string; reason: string; visit: { state: Visit['state']; date: string };
  concern: 'yes' | 'no' | 'unknown' | null; ageHours: number; longWaiting: boolean; canDecide: boolean; blocker: string | null;
  link: { personId: string; visitId: string; href: string };
};

// Open requests: undecided, on a current visit (not voided or superseded by a correction).
export function openRequests(s: OrgState) {
  const out: { v: Visit & { referralRequest: NonNullable<Visit['referralRequest']> } }[] = [];
  for (const v of s.workspace.visits) if (v.referralRequest && !v.referralRequest.decision && !v.voidedAt && !v.supersededBy) out.push({ v: v as any });
  return out;
}

export function requestAgeHours(requestedAt: string, now: string) { return Math.max(0, Math.floor((Date.parse(now) - Date.parse(requestedAt)) / 3600000)); }

export function referralRequestQueue(s: OrgState, m: Member, now = new Date().toISOString()) {
  if (m.status !== 'active') fail(403, 'Your membership is inactive.');
  if (!(m.role === 'clinician' || m.role === 'supervisor' || (m.isOwner && m.role !== 'admin')))
    fail(403, 'Clinicians, supervisors and owners with a care role see the referral request queue.');
  const people = new Map(s.workspace.people.map(p => [p.id, p])), members = new Map(s.members.map(x => [x.userId, x]));
  const items: RequestItem[] = [];
  for (const { v } of openRequests(s)) {
    const p = people.get(v.personId);
    if (!p || !allowed(m, p, now)) continue;
    const r = v.referralRequest, ageHours = requestAgeHours(r.requestedAt, now);
    const blocker = v.state !== 'confirmed' ? 'The visit is not confirmed yet; the worker who recorded it confirms it first.' : p.mergedInto ? 'This record was merged; open the surviving record.' : null;
    items.push({
      visitId: v.id, patient: { id: p.id, name: p.name, village: p.village }, requestedBy: members.get(r.requestedBy)?.displayName ?? 'Former member',
      requestedAt: r.requestedAt, capturedAt: r.capturedAt, facility: r.facility, reason: r.reason,
      visit: { state: v.state, date: v.facts?.date || v.createdAt }, concern: v.clinicalConcern?.value ?? null, ageHours,
      longWaiting: ageHours >= REQUEST_WAIT_HOURS, canDecide: clinicalAuthority(s,m,'referral-order',p.teamId,now) && !blocker, blocker,
      link: { personId: p.id, visitId: v.id, href: href(p.id, v.id) },
    });
  }
  // A recorded clinical concern first, then the oldest request.
  items.sort((a, b) => Number(b.concern === 'yes') - Number(a.concern === 'yes') || (a.requestedAt < b.requestedAt ? -1 : a.requestedAt > b.requestedAt ? 1 : a.visitId < b.visitId ? -1 : 1));
  return {
    rulesVersion: REQUEST_QUEUE_VERSION, waitHours: REQUEST_WAIT_HOURS, total: items.length, longWaiting: items.filter(i => i.longWaiting).length,
    awaitingConfirmation: items.filter(i => i.visit.state !== 'confirmed').length, canDecide: items.some(i=>i.canDecide),
    scope: m.role === 'clinician' ? 'Open field referral requests in your care scope. Ordering requires current verified professional authority for the patient team.' : 'Open field referral requests for patients in the teams you supervise or belong to. A clinician with verified professional authority decides each request.',
    items: items.slice(0, MAX_REQUESTS), truncated: items.length > MAX_REQUESTS,
  };
}
