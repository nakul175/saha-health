// Slice 14b (ASHA field-fit, BR-DATA-13 proposed): dates on the person record, appended and never edited.
//
// An ASHA works from dates (LMP, EDD, birth, date of birth); Saha's person record had none, so it could not produce a due list.
// Each date is an entry with who recorded it, when, and where the value came from. A change appends a new entry that supersedes the
// old one, with a reason; a withdrawal appends a mark and keeps the entry. The current value of a kind is the newest entry that is
// neither superseded nor withdrawn. The audit detail never names the kind or the value, because an LMP or EDD discloses a pregnancy
// to anyone who can read the audit; the kind and value are on the person record, behind the same patient scope as every other fact.
// No location is captured. Dates feed lib/saha/mch-schedule.ts; nothing here sends, schedules or messages.
import { z } from 'zod';
import { fail, person, uuid } from './core';
import type { Member, OrgState } from './types';
import type { Actor } from './store';
import { dayNumber } from './mch-schedule';

export const DATE_KINDS = ['lmp', 'edd', 'birthDate', 'dob'] as const;
export const DATE_SOURCES = ['reported', 'document', 'measured', 'estimated'] as const;
export type DateKind = typeof DATE_KINDS[number];
export type PersonDateEntry = { id: string; kind: DateKind; value: string; source: typeof DATE_SOURCES[number]; recordedAt: string; recordedBy: string; supersedes?: string; reason?: string; withdrawn?: { at: string; by: string; reason: string } };
const id = z.string().trim().min(1).max(100), ver = z.number().int().positive(), reason = z.string().trim().min(5).max(300);
export const personDatesSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('personDateRecord'), personId: id, version: ver, kind: z.enum(DATE_KINDS), value: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), source: z.enum(DATE_SOURCES), reason: reason.optional() }).strict(),
  z.object({ type: z.literal('personDateWithdraw'), personId: id, version: ver, entryId: id, reason }).strict(),
]);
const MAX_ENTRIES = 60;
export const currentDate = (entries: PersonDateEntry[] | undefined, kind: DateKind): PersonDateEntry | undefined => {
  const list = entries ?? [], superseded = new Set(list.map(e => e.supersedes).filter(Boolean));
  return list.filter(e => e.kind === kind && !e.withdrawn && !superseded.has(e.id)).at(-1);
};
export const currentDates = (entries: PersonDateEntry[] | undefined) => Object.fromEntries(DATE_KINDS.map(k => [k, currentDate(entries, k)?.value]).filter(([, v]) => v)) as Partial<Record<DateKind, string>>;
export function authorizePersonDates(s: OrgState, m: Member, c: any) {
  if (!['personDateRecord', 'personDateWithdraw'].includes(c?.type)) return;
  if (!['asha', 'clinician'].includes(m.role)) fail(403, 'A care role is required to record dates on a person.');
  person(s.workspace, c.personId);
}
export function applyPersonDates(s: OrgState, input: unknown, u: Actor, m: Member, now = new Date().toISOString()): any | null {
  const parsed = personDatesSchema.safeParse(input);
  if (!parsed.success) return null;
  const c = parsed.data;
  authorizePersonDates(s, m, c);
  const p = person(s.workspace, c.personId), today = now.slice(0, 10);
  if (p.version !== c.version) fail(409, 'Patient details changed. Refresh before recording a date.');
  const entries = p.dateEntries ??= [];
  let result: any = { ok: true };
  if (c.type === 'personDateRecord') {
    let t: number;
    try { t = dayNumber(c.value); } catch { fail(422, 'Enter a real calendar date.'); }
    const td = dayNumber(today);
    if (c.kind !== 'edd' && t! > td) fail(422, 'This date cannot be in the future.');
    if (c.kind === 'lmp' && td - t! > 320) fail(422, 'An LMP more than 320 days ago cannot start a current pregnancy. Check the date.');
    if (c.kind === 'edd' && (t! < td - 60 || t! > td + 300)) fail(422, 'Check the expected delivery date: it is more than 60 days past or 300 days ahead.');
    if ((c.kind === 'birthDate' || c.kind === 'dob') && td - t! > 365 * 125) fail(422, 'Check the date: it is more than 125 years ago.');
    if (entries.length >= MAX_ENTRIES) fail(422, 'A person can have up to 60 recorded date entries.');
    const prior = currentDate(entries, c.kind);
    if (prior?.value === c.value) fail(409, 'This date is already recorded.');
    if (prior && !c.reason) fail(422, 'Say why the recorded date is being replaced.');
    const e: PersonDateEntry = { id: uuid(), kind: c.kind, value: c.value, source: c.source, recordedAt: now, recordedBy: u.userId, ...(prior ? { supersedes: prior.id, reason: c.reason } : {}) };
    entries.push(e);
    // Disagreement between LMP and EDD is surfaced, never resolved silently: the worker or clinician decides which stands.
    const lmp = currentDate(entries, 'lmp'), edd = currentDate(entries, 'edd');
    const gap = lmp && edd ? Math.abs(dayNumber(edd.value) - dayNumber(lmp.value) - 280) : 0;
    result = { ok: true, entryId: e.id, warnings: gap > 14 ? ['The LMP and the expected delivery date differ by more than 14 days. Confirm which is right.'] : [] };
  } else {
    const e = entries.find(x => x.id === c.entryId);
    if (!e) fail(404, 'Date entry not found.');
    if (e!.withdrawn) fail(409, 'This entry is already withdrawn.');
    e!.withdrawn = { at: now, by: u.userId, reason: c.reason };
  }
  p.version++;
  s.workspace.audit.push({ id: uuid(), at: now, actor: u.displayName, actorId: u.userId, role: m.role, action: c.type, subject: p.id, detail: c.type === 'personDateRecord' ? 'A date on the person record was recorded.' : 'A date entry on the person record was withdrawn.', personId: p.id });
  return result;
}
