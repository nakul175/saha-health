// Slice 6s: differencing protection across one viewer's indicator queries (BR-REP-04, BR-AG-11).
// A release records, for one viewer and one series (grouping plus the definition's own cohort filters),
// the hashed query filters and the number of people in each released cell. It holds no patient
// identifiers, names, villages or values: viewer, series, filter values and group labels are hashed
// by the caller. A new query is refused when, nested with the viewer's recent releases of the same
// series, it would leave a remainder of 1 to 4 people in any cell (for example all villages minus
// one village, or a parent cohort minus the sum of its one-filter children).
export const DIFFERENCING_WINDOW_HOURS = 168;
export const LEDGER_LIMIT = 500;
export const FILTER_KEYS = ['team', 'village', 'programme'] as const;
export type Release = { v: string; at: string; k: string; f: Record<string, string>; c: Record<string, number> };
const filterKey = (f: Record<string, string>) => FILTER_KEYS.map(k => `${k}=${f[k] ?? ''}`).join('&');
const sameExcept = (child: Record<string, string>, parent: Record<string, string>, key: string) =>
  FILTER_KEYS.every(k => k === key ? !!child[k] && !parent[k] : (child[k] ?? '') === (parent[k] ?? ''));
export const recent = (ledger: Release[], now: string) => { const since = Date.parse(now) - DIFFERENCING_WINDOW_HOURS * 3600000; return ledger.filter(r => Date.parse(r.at) >= since); };
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
    for (const [g, people] of Object.entries(parent.c)) {
      const rest = people - children.reduce((n, x) => n + (x.c[g] ?? 0), 0);
      if (rest > 0 && rest < min && (worst === null || rest < worst)) worst = rest;
    }
  }
  return worst;
}
// Keeps releases inside the window, newest last, bounded in number.
export const pruneLedger = (ledger: Release[], now: string) => recent(ledger, now).slice(-LEDGER_LIMIT);
