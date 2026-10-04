// The minimum is the indicator minimum (indicators.ts MIN_CELL); it is repeated here so this module stays free of the indicator
// engine's dependencies, and tests/export-suppression-contract.mjs fails if the two ever differ.
export const MIN_CELL = 5;

// Slice 14g (BR-REP-04, BR-REP-05): small-number suppression for every export that carries counts out of Saha.
// The rule is the one the indicator queries use (slice 6d), applied to a count-bearing report:
//   - a count of 1 to 4 is shown as "<5";
//   - when the people behind the whole report number 1 to 4, every count is withheld ("withheld");
//   - where a breakdown sums to a total that is shown and exactly one cell was suppressed, the smallest other non-zero cell is
//     withheld as well, so the suppressed cell cannot be recovered by subtraction.
// Zero is shown. A pure module: no storage, no clock.
export const SUPPRESSED = '<5';
export const WITHHELD = 'withheld';
export type Shown = number | typeof SUPPRESSED | typeof WITHHELD;
export const SUPPRESSION_RULE = `Counts of 1 to ${MIN_CELL - 1} are shown as ${SUPPRESSED}. If fewer than ${MIN_CELL} people are behind the report, every count is withheld. Where a breakdown sums to a displayed total and one cell is suppressed, one more cell is withheld so it cannot be recovered by subtraction. Zero is shown. Sums of rows that contain a suppressed or withheld cell are not shown.`;
const primary = (n: number): Shown => (n > 0 && n < MIN_CELL ? SUPPRESSED : n);
export const isSuppressed = (v: unknown) => v === SUPPRESSED || v === WITHHELD;
// Complementary suppression over one breakdown whose total is displayed (and itself not suppressed).
function complementary<T extends Record<string, any>>(rows: T[], key: string, total: Shown) {
  if (isSuppressed(total) || rows.length < 2) return;
  if (rows.filter(r => isSuppressed(r[key])).length !== 1) return;
  const next = rows.filter(r => !isSuppressed(r[key]) && r[key] > 0).sort((a, b) => a[key] - b[key])[0];
  if (next) (next as any)[key] = WITHHELD;
}
type Count = Record<string, any>;
export type CareReportLike = {
  patients: number; visitsStarted: number; visitsConfirmed: number; activeWorkers: number;
  backlog: Record<string, number>; usage: { requests: number; missingUsage: number; [k: string]: any };
  programmes: Count[]; destinations: Count[]; daily: Count[]; [k: string]: any;
};
export function suppressCareReport<R extends CareReportLike>(full: R, cohortOverride?: number): { report: any; cells: number; cohortWithheld: boolean } {
  const cohortWithheld = (cohortOverride ?? full.patients) > 0 && (cohortOverride ?? full.patients) < MIN_CELL;
  const c = (n: number): Shown => (cohortWithheld ? WITHHELD : primary(n));
  const r: any = structuredClone(full);
  r.patients = cohortWithheld ? SUPPRESSED : primary(full.patients);
  r.visitsStarted = c(full.visitsStarted); r.visitsConfirmed = c(full.visitsConfirmed); r.activeWorkers = c(full.activeWorkers);
  r.backlog = Object.fromEntries(Object.entries(full.backlog).map(([k, v]) => [k, c(v)]));
  r.usage.requests = c(full.usage.requests); r.usage.missingUsage = c(full.usage.missingUsage);
  // Provider-level usage figures count agent requests; they are withheld together with them.
  for (const k of ['localCalls', 'liveCalls', 'inputTokens', 'outputTokens'] as const) if (k in r.usage) r.usage[k] = isSuppressed(r.usage.requests) ? WITHHELD : full.usage[k];
  if (isSuppressed(r.usage.requests)) r.usage.estimatedUsd = WITHHELD;
  r.daily = full.daily.map(d => ({ ...d, confirmed: c(d.confirmed) }));
  r.programmes = full.programmes.map(p => ({ ...p, activeEpisodes: c(p.activeEpisodes), openTasks: c(p.openTasks), overdueTasks: c(p.overdueTasks) }));
  r.destinations = full.destinations.map(d => ({ ...d, accepted: c(d.accepted), pending: c(d.pending), rejected: c(d.rejected) }));
  complementary(r.daily, 'confirmed', r.visitsConfirmed);
  complementary(r.programmes, 'openTasks', r.backlog.openFollowUps);
  complementary(r.programmes, 'overdueTasks', r.backlog.overdueFollowUps);
  complementary(r.destinations, 'pending', r.backlog.unresolvedSubmissions);
  let cells = 0;
  const count = (v: unknown) => { if (isSuppressed(v)) cells++; };
  count(r.patients); count(r.visitsStarted); count(r.visitsConfirmed); count(r.activeWorkers); Object.values(r.backlog).forEach(count); count(r.usage.requests); count(r.usage.missingUsage);
  r.daily.forEach((d: Count) => count(d.confirmed)); r.programmes.forEach((p: Count) => { count(p.activeEpisodes); count(p.openTasks); count(p.overdueTasks); });
  r.destinations.forEach((d: Count) => { count(d.accepted); count(d.pending); count(d.rejected); });
  r.suppression = { rule: SUPPRESSION_RULE, cells, cohortWithheld };
  return { report: r, cells, cohortWithheld };
}
