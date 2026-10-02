import { z } from 'zod';
import { fail, person, uuid } from './core';
import { allowed, normallyAllowed } from './access';
import { actionPlan } from './action-plan';
import { supervises } from './delegation';
import { TERMINAL } from './referral-rules';
import { CANCEL_REASONS, ITEM_KINDS, MAX_AHEAD_DAYS, MAX_COVERS, MAX_ITEMS, MAX_PLANNED, MAX_SLOTS, VISIT_WINDOWS, type CancelReason, type VisitItemKind, type VisitWindow } from './household-visit-constants';
import type { Household } from './household';
import type { Actor } from './store';
import type { Member, OrgState, Person } from './types';

// Slice 10f: household visit planning (BR-PROG-05). One household visit slot covers chosen open items of several
// household members. A slot is a planning record only:
//  - it never changes a programme due date, owner or completion condition, and completing the visit does not close
//    anything; each item stays open until its own record is resolved (follow-up, referral event);
//  - it holds only references (member, item kind, item id), a date and a window, and a closed cancellation reason, so no
//    fact or free text about one member is written where another member's worker reads it;
//  - each member's observations stay on that member's own visit and each member's permissions are checked separately:
//    the worker needs normal care access to every member a slot covers, and a viewer sees only the covered members inside
//    their own scope. Members outside it are counted, never named.
// Timing: an item whose due date is before the slot date is shown as late by that many days, never silently treated as on
// time. These are local defaults, not an approved timing or privacy policy.
export type HouseholdVisitItem = { kind: VisitItemKind; id: string };
export type HouseholdVisit = { id: string; date: string; window: VisitWindow; workerId: string; covers: { personId: string; items: HouseholdVisitItem[] }[]; state: 'planned' | 'cancelled'; createdAt: string; createdBy: string; cancelledAt?: string; cancelledBy?: string; cancelReason?: CancelReason };

const id = z.string().trim().min(1).max(100), ver = z.number().int().positive();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(x => !isNaN(Date.parse(x)) && new Date(x).toISOString().slice(0, 10) === x, 'Enter a valid date.');
const item = z.object({ kind: z.enum(ITEM_KINDS), id }).strict();
export const householdVisitSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('householdVisitSchedule'), householdId: id, version: ver, date, window: z.enum(VISIT_WINDOWS), covers: z.array(z.object({ personId: id, items: z.array(item).min(1).max(MAX_ITEMS) }).strict()).min(1).max(MAX_COVERS) }).strict(),
  z.object({ type: z.literal('householdVisitCancel'), householdId: id, version: ver, visitId: id, reason: z.enum(CANCEL_REASONS) }).strict(),
]);
export type HouseholdVisitCommand = z.infer<typeof householdVisitSchema>;

const current = (h: Household) => h.members.filter(x => !x.to);
const day = 86400000, addDays = (d: string, n: number) => new Date(Date.parse(d) + n * day).toISOString().slice(0, 10), iso = (d: string | null | undefined): d is string => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d);
const same = (a: HouseholdVisitItem, b: HouseholdVisitItem) => a.kind === b.kind && a.id === b.id;
const careIn = (m: Member, h: Household) => ['asha', 'clinician'].includes(m.role) && m.teamIds.includes(h.teamId);

// One item as its own record states it now: title, whether it is still open work, and its own due date.
export function resolveItem(s: OrgState, p: Person, r: HouseholdVisitItem): { found: boolean; open: boolean; title: string; due: string | null } {
  if (r.kind === 'follow-up') { const f = p.followUps?.find(x => x.id === r.id); return f ? { found: true, open: f.state === 'open', title: f.title, due: f.due } : { found: false, open: false, title: 'Follow-up', due: null }; }
  if (r.kind === 'referral') { const x = s.workspace.referrals.find(y => y.id === r.id && y.personId === p.id); return x ? { found: true, open: !TERMINAL.has(x.state), title: `Referral to ${x.facility}`, due: x.due ?? null } : { found: false, open: false, title: 'Referral', due: null }; }
  return r.id === p.id ? { found: true, open: p.status !== 'completed', title: 'Routine home visit', due: p.due ?? null } : { found: false, open: false, title: 'Routine home visit', due: null };
}

// Also applied when an idempotent request is replayed.
export function authorizeHouseholdVisit(s: OrgState, m: Member, c: any) {
  if (c?.type !== 'householdVisitSchedule' && c?.type !== 'householdVisitCancel') return;
  if (!['asha', 'clinician'].includes(m.role) && !(c.type === 'householdVisitCancel' && m.role === 'supervisor')) fail(403, 'A care role is required to plan household visits.');
  const h = (s.households ?? []).find(x => x.id === c.householdId);
  if (!h) fail(404, 'Household not found.');
  if (!m.teamIds.includes(h.teamId)) fail(403, 'This household belongs to a care team you are not in.');
}

const MESSAGE_MEMBERS = 'Choose current household members within your care scope.';
export function applyHouseholdVisit(s: OrgState, input: unknown, u: Actor, m: Member, now = new Date().toISOString()): any | null {
  const parsed = householdVisitSchema.safeParse(input);
  if (!parsed.success) return null;
  const c = parsed.data, w = s.workspace;
  authorizeHouseholdVisit(s, m, c);
  const h = (s.households ?? []).find(x => x.id === c.householdId)!, today = now.slice(0, 10), slots = h.visits ??= [];
  if (h.version !== c.version) fail(409, 'This household changed. Refresh before planning a visit.');
  if (c.type === 'householdVisitCancel') {
    const slot = slots.find(x => x.id === c.visitId);
    if (!slot) fail(404, 'Household visit not found.');
    if (slot.state !== 'planned') fail(409, 'This household visit is already cancelled.');
    if (!(slot.createdBy === u.userId && careIn(m, h)) && !supervises(s, m, h.teamId, now)) fail(403, 'Only the worker who planned this visit, or a supervisor or owner of the household\'s team, cancels it.');
    Object.assign(slot, { state: 'cancelled', cancelledAt: now, cancelledBy: u.userId, cancelReason: c.reason });
    h.version++;
    for (const cv of slot.covers) { const p = w.people.find(x => x.id === cv.personId); if (p) w.audit.push({ id: uuid(), at: now, actorId: u.userId, actor: u.displayName, role: m.role, action: c.type, subject: p.id, personId: p.id, detail: `Household visit planned for ${slot.date} cancelled (${c.reason.replace(/-/g, ' ')}). Items stay open with their own due dates.` }); }
    return { visitId: slot.id, state: 'cancelled' };
  }
  if (!['asha', 'clinician'].includes(m.role)) fail(403, 'A care role is required to plan household visits.');
  if (c.date < today || c.date > addDays(today, MAX_AHEAD_DAYS)) fail(422, `Choose a date from today to ${MAX_AHEAD_DAYS} days ahead.`);
  if (slots.length >= MAX_SLOTS) fail(422, 'A household can hold up to 100 recorded visit slots.');
  if (slots.filter(x => x.state === 'planned').length >= MAX_PLANNED) fail(422, 'A household can have up to 10 planned visits at once. Cancel one first.');
  const members = new Set(current(h).map(x => x.personId)), seen = new Set<string>(), covers: HouseholdVisit['covers'] = [], lines: { p: Person; titles: string[] }[] = [];
  for (const cv of c.covers) {
    if (seen.has(cv.personId)) fail(422, 'Name each household member once.');
    seen.add(cv.personId);
    const p = w.people.find(x => x.id === cv.personId);
    // One refusal for a non-member and for a member outside the worker's scope, so the answer does not reveal membership.
    if (!p || !members.has(p.id) || !p.assigned || !normallyAllowed(m, p)) fail(422, MESSAGE_MEMBERS);
    person(w, p.id);
    if (p.mergedInto) fail(409, 'A covered record was merged into another record. Plan the visit on the surviving record.');
    const refs: HouseholdVisitItem[] = [], titles: string[] = [];
    for (const ref of cv.items) {
      if (refs.some(x => same(x, ref))) fail(422, 'Name each item once.');
      const r = resolveItem(s, p, ref);
      if (!r.found) fail(422, 'Each item must belong to the household member it is listed under.');
      if (!r.open) fail(409, `"${r.title}" is no longer open work. Refresh the household plan.`);
      const other = slots.find(x => x.state === 'planned' && x.covers.some(y => y.personId === p.id && y.items.some(i => same(i, ref))));
      if (other) fail(409, `"${r.title}" is already covered by the household visit planned for ${other.date}. Cancel that visit first.`);
      refs.push({ kind: ref.kind, id: ref.id }); titles.push(r.title);
    }
    covers.push({ personId: p.id, items: refs }); lines.push({ p, titles });
  }
  const slot: HouseholdVisit = { id: uuid(), date: c.date, window: c.window, workerId: u.userId, covers, state: 'planned', createdAt: now, createdBy: u.userId };
  slots.push(slot); h.version++;
  // Each member's own audit line names only that member's items; nothing about the others.
  for (const { p, titles } of lines) w.audit.push({ id: uuid(), at: now, actorId: u.userId, actor: u.displayName, role: m.role, action: c.type, subject: p.id, personId: p.id, detail: `Household visit planned for ${c.date} (${c.window}) covering ${titles.length} item${titles.length === 1 ? '' : 's'} of this person: ${titles.join('; ')}. Due dates and completion conditions are unchanged; this person's observations are recorded on this person's own visit.` });
  return { visitId: slot.id, date: slot.date, window: slot.window, members: covers.length, items: covers.reduce((n, x) => n + x.items.length, 0) };
}

// Worker-facing household visit plan: each member's open follow-ups, referrals and routine visit in one place (members
// inside the worker's scope only; the rest are counted) and the planned slots the worker may see.
type Line = { key: string; kind: VisitItemKind; title: string; due: string | null; attention: string; daysOverdue: number; status: string; owner: string | null; programmes: string[]; waitingOn: string[]; refs: HouseholdVisitItem[]; covered: { visitId: string; date: string } | null };
export function householdVisitPlan(s: OrgState, m: Member, h: Household, now = new Date().toISOString()) {
  const today = now.slice(0, 10), slots = h.visits ?? [], names = new Map(s.members.map(x => [x.userId, x.displayName]));
  const coveredBy = (personId: string, ref: HouseholdVisitItem) => slots.find(x => x.state === 'planned' && x.covers.some(cv => cv.personId === personId && cv.items.some(i => same(i, ref))));
  let outsideScope = 0;
  const members = current(h).flatMap(x => {
    const q = s.workspace.people.find(p => p.id === x.personId);
    if (!q || !allowed(m, q, now)) { outsideScope++; return []; }
    const own: Line[] = q.mergedInto ? [] : actionPlan(s, m, q, now).items.filter(i => i.kind === 'follow-up' || i.kind === 'referral').slice(0, 50).map(i => {
      const refs = i.refs.filter(r => r.kind === 'follow-up' || r.kind === 'referral') as HouseholdVisitItem[], slot = refs.map(r => coveredBy(q.id, r)).find(Boolean);
      return { key: i.key, kind: i.kind as 'follow-up' | 'referral', title: i.title, due: i.due, attention: i.attention, daysOverdue: i.daysOverdue, status: i.status, owner: i.owner?.displayName ?? null,
        programmes: [...new Set(i.sources.map(y => y.programme).filter((z): z is string => !!z))], waitingOn: i.waitingOn.map(y => y.title), refs, covered: slot ? { visitId: slot.id, date: slot.date } : null };
    });
    const ref: HouseholdVisitItem = { kind: 'home-visit', id: q.id }, slot = coveredBy(q.id, ref);
    if (!q.mergedInto && q.status !== 'completed') own.push({ key: 'home-visit:' + q.id, kind: 'home-visit', title: 'Routine home visit', due: q.due ?? null, attention: 'now', daysOverdue: 0, status: 'Due', owner: null, programmes: [], waitingOn: [], refs: [ref], covered: slot ? { visitId: slot.id, date: slot.date } : null });
    return [{ personId: q.id, name: q.name, age: q.age, relationship: x.relationship, merged: !!q.mergedInto, canCover: normallyAllowed(m, q) && !q.mergedInto, items: own }];
  });
  const lead = supervises(s, m, h.teamId, now, false), care = ['asha', 'clinician'].includes(m.role) && m.teamIds.includes(h.teamId);
  // A slot is shown to a viewer who can see at least one covered person (a former member too), and only for the people they can see.
  const seeable = (personId: string) => { const q = s.workspace.people.find(p => p.id === personId); return q && allowed(m, q, now) ? q : undefined; };
  const visits = slots.filter(x => x.covers.some(cv => seeable(cv.personId))).slice(-30).reverse().map(x => {
    const shown = x.covers.flatMap(cv => { const q = seeable(cv.personId); return q ? [{ cv, q }] : []; }).map(({ cv, q }) => {
      const items = cv.items.map(ref => { const r = resolveItem(s, q, ref); return { kind: ref.kind, id: ref.id, title: r.title, open: r.open, due: r.due, lateByDays: iso(r.due) && x.date > r.due ? Math.round((Date.parse(x.date) - Date.parse(r.due)) / day) : 0 }; });
      return { personId: q.id, name: q.name, left: !current(h).some(y => y.personId === q.id), items, stillOpen: items.filter(i => i.open).length };
    });
    return { id: x.id, date: x.date, window: x.window, state: x.state, when: x.date < today ? 'past' : x.date === today ? 'today' : 'upcoming', worker: names.get(x.workerId) ?? 'Former member', covers: shown, outsideScopeCovered: x.covers.length - shown.length,
      cancelReason: x.cancelReason ?? null, canCancel: x.state === 'planned' && ((x.createdBy === m.userId && care) || lead) };
  });
  return {
    householdVersion: h.version, canSchedule: care, minDate: today, maxDate: addDays(today, MAX_AHEAD_DAYS), members, outsideScope, visits,
    rules: 'A household visit slot covers the open items you choose, member by member. It does not change any due date, owner or completion condition, and an item stays open until its own record is resolved. Each member keeps their own observations, visit and permissions; a slot holds only references, a date and a window, and no free text. Items due before the slot date are shown as late, never as on time. Members outside your care scope are counted, not named. Nothing is sent to anyone. These are local defaults, not an approved timing or privacy policy.',
  };
}
