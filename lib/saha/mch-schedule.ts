// Slice 14a (ASHA field-fit): pure due-list and composite payable-event rules for maternal and newborn care.
//
// Why this exists: the secondary research (docs/current/BRD-V1.2-ASHA-FIELD-FIT-DELTA.md) found that an ASHA is paid for a verified
// composite (for example the HBNC package at day 45), not for a visit, and that she works from dates (LMP, EDD, birth, delivery).
// Saha's person record has none of those dates, so it cannot produce a due list. This module is the rule layer only:
//   * no I/O, no clock, no storage; every date is passed in, so a result is reproducible and testable;
//   * no rate, window or condition is built in. The schedule, the conditions and the rates are a SchedulePolicy supplied by the
//     owner for the state or district in use (the BRD v1.2 delta records that the target state is not yet chosen);
//   * it proposes; it never submits a claim, pays, or messages. A payable event still needs a named verifier (BR-CARE-08).
// Dates are ISO calendar dates (YYYY-MM-DD) and day arithmetic is done in UTC so the result does not depend on the device zone.
export type IsoDate = string;
export interface DueWindow { id: string; programme: string; label: string; fromDay: number; toDay: number }
export interface SchedulePolicy {
  id: string; version: number; stateLabel: string; source: string;
  // Windows are counted from an anchor: 'lmp' (days since last menstrual period), 'birth' (days since delivery or birth) or 'dob'.
  windows: Array<DueWindow & { anchor: 'lmp' | 'birth' | 'dob' }>;
  composites: CompositeRule[];
}
export interface CompositeRule {
  id: string; label: string; anchor: 'birth'; closesOnDay: number;
  // Every id must be present in the evidence with completed=true on or before closesOnDay for the composite to be complete.
  requiredEvidence: string[];
  // Rate in minor units (paise) so no fractional rupee arithmetic is done here. Required: there is deliberately no default.
  amountMinor: number; currency: 'INR';
}
export interface PersonDates { lmp?: IsoDate; edd?: IsoDate; birthDate?: IsoDate; dob?: IsoDate }
export type DueStatus = 'upcoming' | 'due' | 'overdue';
export interface DueItem { windowId: string; programme: string; label: string; opens: IsoDate; closes: IsoDate; status: DueStatus }
export class ScheduleError extends Error { constructor(public code: string, message: string) { super(message); this.name = 'ScheduleError'; } }
const DAY = 86_400_000;
const re = /^\d{4}-\d{2}-\d{2}$/;
export function dayNumber(d: IsoDate): number {
  if (typeof d !== 'string' || !re.test(d)) throw new ScheduleError('bad_date', 'Dates must be YYYY-MM-DD.');
  const t = Date.parse(d + 'T00:00:00.000Z');
  if (!Number.isFinite(t) || new Date(t).toISOString().slice(0, 10) !== d) throw new ScheduleError('bad_date', 'Not a real calendar date.');
  return Math.round(t / DAY);
}
export const addDays = (d: IsoDate, n: number): IsoDate => new Date((dayNumber(d) + n) * DAY).toISOString().slice(0, 10);
// An EDD is 280 days after the LMP (Naegele's rule). When only an EDD is known the LMP is derived, never stored as if observed.
export function lmpFrom(p: PersonDates): IsoDate | undefined { return p.lmp ?? (p.edd ? addDays(p.edd, -280) : undefined); }
export function validatePolicy(p: SchedulePolicy): void {
  if (!p || !Array.isArray(p.windows) || !Array.isArray(p.composites)) throw new ScheduleError('bad_policy', 'Policy needs windows and composites.');
  const seen = new Set<string>();
  for (const w of p.windows) {
    if (seen.has(w.id)) throw new ScheduleError('bad_policy', `Duplicate window ${w.id}.`);
    seen.add(w.id);
    if (!Number.isInteger(w.fromDay) || !Number.isInteger(w.toDay) || w.fromDay < 0 || w.toDay < w.fromDay) throw new ScheduleError('bad_policy', `Window ${w.id} has an invalid range.`);
  }
  for (const c of p.composites) {
    if (!Number.isInteger(c.amountMinor) || c.amountMinor < 0) throw new ScheduleError('bad_policy', `Composite ${c.id} needs an integer amount.`);
    if (!Number.isInteger(c.closesOnDay) || c.closesOnDay < 1 || !c.requiredEvidence.length) throw new ScheduleError('bad_policy', `Composite ${c.id} is incomplete.`);
  }
}
// The due list for one person on one day. Windows whose anchor date is unknown are reported as missing, never guessed.
export function dueList(policy: SchedulePolicy, person: PersonDates, today: IsoDate, completedWindowIds: string[] = []) {
  validatePolicy(policy);
  const t = dayNumber(today), done = new Set(completedWindowIds), items: DueItem[] = [], missingAnchors = new Set<string>();
  const anchors = { lmp: lmpFrom(person), birth: person.birthDate, dob: person.dob ?? person.birthDate };
  for (const w of policy.windows) {
    if (done.has(w.id)) continue;
    const a = anchors[w.anchor];
    if (!a) { missingAnchors.add(w.anchor); continue; }
    const opens = addDays(a, w.fromDay), closes = addDays(a, w.toDay);
    const status: DueStatus = t < dayNumber(opens) ? 'upcoming' : t > dayNumber(closes) ? 'overdue' : 'due';
    items.push({ windowId: w.id, programme: w.programme, label: w.label, opens, closes, status });
  }
  const rank = { overdue: 0, due: 1, upcoming: 2 } as const;
  items.sort((x, y) => rank[x.status] - rank[y.status] || x.closes.localeCompare(y.closes) || x.windowId.localeCompare(y.windowId));
  return { items, missingAnchors: [...missingAnchors].sort() };
}
export interface EvidenceItem { id: string; completed: boolean; on?: IsoDate }
export type CompositeStatus = 'awaiting_day' | 'incomplete' | 'awaiting_verification' | 'payable';
export interface CompositeResult { ruleId: string; status: CompositeStatus; missing: string[]; lateEvidence: string[]; dueOn: IsoDate; amountMinor: number; currency: 'INR' }
export interface Verification { verifier: string; role: string; on: IsoDate }
// The payable event is the verified composite, not the visit. Evidence completed after the closing day does not count
// (reported as lateEvidence so a supervisor can see why), and an unverified composite is never reported as payable.
export function evaluateComposite(policy: SchedulePolicy, ruleId: string, birthDate: IsoDate, today: IsoDate, evidence: EvidenceItem[], verification?: Verification): CompositeResult {
  validatePolicy(policy);
  const rule = policy.composites.find(c => c.id === ruleId);
  if (!rule) throw new ScheduleError('unknown_rule', `No composite ${ruleId}.`);
  const dueOn = addDays(birthDate, rule.closesOnDay), t = dayNumber(today);
  const missing: string[] = [], late: string[] = [];
  for (const need of rule.requiredEvidence) {
    const e = evidence.find(x => x.id === need && x.completed);
    if (!e) { missing.push(need); continue; }
    if (!e.on) { missing.push(need); continue; }
    if (dayNumber(e.on) > dayNumber(dueOn)) { late.push(need); missing.push(need); }
  }
  const base = { ruleId, missing, lateEvidence: late, dueOn, amountMinor: rule.amountMinor, currency: rule.currency };
  if (t < dayNumber(dueOn)) return { ...base, status: 'awaiting_day', missing: [], lateEvidence: [] };
  if (missing.length) return { ...base, status: 'incomplete' };
  if (!verification || !verification.verifier || !verification.role) return { ...base, status: 'awaiting_verification' };
  if (dayNumber(verification.on) < dayNumber(dueOn)) throw new ScheduleError('early_verification', 'Verification cannot precede the closing day.');
  return { ...base, status: 'payable' };
}
