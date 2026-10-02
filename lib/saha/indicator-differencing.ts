// Slice 6s: differencing protection across one viewer's indicator queries (BR-REP-04, BR-AG-11).
// A release records, for one viewer and one series (grouping, exclusions and, for a measure series, the
// numerator and denominator measures), the hashed query filters and definition filters, the number of
// people in each released cell and, for a measure series, the numerator and denominator of each cell.
// It holds no patient identifiers, names, villages or values: viewer, series, filter values and group
// labels are hashed by the caller. A new query is refused when, nested with the viewer's recent releases
// of the same series, it would leave a remainder of 1 to 4 in any cell (for example all villages minus
// one village, or a parent cohort minus the sum of its one-filter children).
//
// Slice 6w (fifth review): the remainder test covers numerators, denominators and denominator minus
// numerator, not only people (finding 1); definition filters (sex, age band, programme) are nesting
// dimensions, so complementary definitions are compared (finding 3); the ledger is pruned by time only
// and, when a viewer or the organisation reaches its bound, new releases are refused instead of older
// protecting releases being dropped (finding 2).
export const DIFFERENCING_WINDOW_HOURS = 168;
// Distinct (viewer, series, filters) releases kept inside the window; a repeat of the same query replaces
// its earlier release, which the check would not use anyway. Reaching a bound refuses new releases.
export const VIEWER_LEDGER_LIMIT = 400;
export const LEDGER_LIMIT = 4000;
export const FILTER_KEYS = ['team', 'village', 'programme', 'sex', 'ageBand', 'defProgramme'] as const;
export type Release = { v: string; at: string; k: string; f: Record<string, string>; c: Record<string, number>; m?: Record<string, [number, number]> };
const filterKey = (f: Record<string, string>) => FILTER_KEYS.map(k => `${k}=${f[k] ?? ''}`).join('&');
const sameExcept = (child: Record<string, string>, parent: Record<string, string>, key: string) =>
  FILTER_KEYS.every(k => k === key ? !!child[k] && !parent[k] : (child[k] ?? '') === (parent[k] ?? ''));
export const recent = (ledger: Release[], now: string) => { const since = Date.parse(now) - DIFFERENCING_WINDOW_HOURS * 3600000; return ledger.filter(r => Date.parse(r.at) >= since); };
// The quantities a cell releases: people, and for a measure series numerator, denominator and their difference.
const parts = (r: Release, g: string): number[] => { const people = r.c[g] ?? 0, m = r.m?.[g]; return m ? [people, m[0], m[1], m[1] - m[0]] : [people]; };
// Returns the smallest remainder (1..min-1) a candidate would reveal, or null when it is safe.
export function differencingRisk(ledger: Release[], candidate: Release, min: number, now: string): number | null {
  const latest = new Map<string, Release>();
  for (const r of recent(ledger, now)) if (r.v === candidate.v && r.k === candidate.k) latest.set(filterKey(r.f), r);
  latest.set(filterKey(candidate.f), candidate);
  const all = [...latest.values()];
  let worst: number | null = null;
  for (const parent of all) for (const key of FILTER_KEYS) {
    if (parent.f[key]) continue;
    const children = all.filter(x => x !== parent && sameExcept(x.f, parent.f, key));
    if (!children.length || (parent !== candidate && !children.includes(candidate))) continue;
    for (const g of Object.keys(parent.c)) {
      parts(parent, g).forEach((value, i) => {
        const rest = value - children.reduce((n, x) => n + (parts(x, g)[i] ?? 0), 0);
        if (rest > 0 && rest < min && (worst === null || rest < worst)) worst = rest;
      });
    }
  }
  return worst;
}
// Keeps releases inside the window, newest last. Nothing inside the window is dropped for space: only a
// release for the same viewer, series and filters is replaced by its newer one, which the check uses instead.
export function pruneLedger(ledger: Release[], now: string) {
  const out = new Map<string, Release>();
  for (const r of recent(ledger, now)) { const id = `${r.v}|${r.k}|${filterKey(r.f)}`; out.delete(id); out.set(id, r); }
  return [...out.values()];
}
// Whether adding these releases would take the viewer or the organisation past its bound.
export function ledgerFull(ledger: Release[], adding: Release[], now: string) {
  const next = pruneLedger([...ledger, ...adding], now), viewers = new Set(adding.map(r => r.v));
  return next.length > LEDGER_LIMIT || [...viewers].some(v => next.filter(r => r.v === v).length > VIEWER_LEDGER_LIMIT);
}
// Checks a query's candidate releases in order (the cohort first), each against the ledger plus the
// candidates already accepted from the same query, so definitions in one request are compared too.
export function screenReleases<T extends { release: Release }>(ledger: Release[], cands: T[], min: number, now: string) {
  let working = [...ledger];
  const accepted: T[] = [], refused: T[] = [];
  for (const c of cands) {
    if (differencingRisk(working, c.release, min, now) === null) { accepted.push(c); working = [...working, c.release]; }
    else refused.push(c);
  }
  return { accepted, refused };
}
