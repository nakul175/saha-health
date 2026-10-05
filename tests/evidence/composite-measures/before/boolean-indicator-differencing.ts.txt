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
// Slice 6aa: the residual risk, stated to owners in the indicator registry and with every result.
export const RESIDUAL_RISK = 'Small-group protection has limits. Saha compares each new indicator result with everything the same person was shown in the last seven days and withholds it if any sum or difference of those results could single out a group of 1 to 4 people, visits or referrals in today\'s records. It does not protect against two people combining what they were each shown, against changes in the records between two queries (repeating a query after a new visit reveals that visit), against queries older than seven days, or against differences between indicators that measure unrelated things. The check is conservative: for small teams and narrow filters it withholds more results than strictly necessary.';
// Distinct (viewer, series, filters) releases kept inside the window; a repeat of the same query replaces
// its earlier release, which the check would not use anyway. Reaching a bound refuses new releases.
export const VIEWER_LEDGER_LIMIT = 400;
export const LEDGER_LIMIT = 4000;
// Slice 6aa (seventh review, finding 4): the ledger lives in the operations row, and D1 refuses a value over 2 MB.
// It is bounded by serialized size too, well below that, so the rest of the operations document keeps room.
export const LEDGER_BYTES = 1_000_000;
export const VIEWER_LEDGER_BYTES = 250_000;
export const FILTER_KEYS = ['team', 'village', 'programme', 'sex', 'ageBand', 'defProgramme'] as const;
// Slice 6aa (seventh review, findings 1 and 2): a measure release also records what it disclosed: the measures shown
// (n, d), grouping dimension (gd), exclusions (x), window start (w) and the hashed cells suppressed in the result (z).
export type Release = { v: string; at: string; k: string; f: Record<string, string>; c: Record<string, number>; m?: Record<string, [number, number]>;
  n?: string; d?: string | null; gd?: string; x?: string[]; w?: string; z?: string[]; u?: string };
// Slice 6ad (ninth review, finding 2): `u` is the window end for a release whose window ended before it was made (an
// aggregate report for a past period). A release without `u` covers a window ending when it was made, as before.
const filterKey = (f: Record<string, string>) => FILTER_KEYS.map(k => `${k}=${f[k] ?? ''}`).join('&');
// Slice 6aa (finding 2): the window is part of a measure release's identity, so a query over another window never
// replaces a protecting release. People series do not depend on the window.
const windowKey = (r: Release) => (r.m ? `${r.w ?? ''}|${r.u ?? ''}` : '');
const sameExcept = (child: Record<string, string>, parent: Record<string, string>, key: string) =>
  FILTER_KEYS.every(k => k === key ? !!child[k] && !parent[k] : (child[k] ?? '') === (parent[k] ?? ''));
export const recent = (ledger: Release[], now: string) => { const since = Date.parse(now) - DIFFERENCING_WINDOW_HOURS * 3600000; return ledger.filter(r => Date.parse(r.at) >= since); };
// The quantities a cell releases: people, and for a measure series numerator, denominator and their difference.
const parts = (r: Release, g: string): number[] => { const people = r.c[g] ?? 0, m = r.m?.[g]; return m ? [people, m[0], m[1], m[1] - m[0]] : [people]; };
// Returns the smallest remainder (1..min-1) a candidate would reveal, or null when it is safe.
export function differencingRisk(ledger: Release[], candidate: Release, min: number, now: string): number | null {
  const latest = new Map<string, Release>();
  for (const r of recent(ledger, now)) if (r.v === candidate.v && r.k === candidate.k && windowKey(r) === windowKey(candidate)) latest.set(filterKey(r.f), r);
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
  for (const r of recent(ledger, now)) { const id = `${r.v}|${r.k}|${filterKey(r.f)}|${r.w ?? ''}|${r.u ?? ''}|${r.n ?? ''}/${r.d ?? ''}`; out.delete(id); out.set(id, r); }
  return [...out.values()];
}
// Whether adding these releases would take the viewer or the organisation past its bound.
export function ledgerFull(ledger: Release[], adding: Release[], now: string) {
  const next = pruneLedger([...ledger, ...adding], now), viewers = new Set(adding.map(r => r.v));
  return next.length > LEDGER_LIMIT || ledgerBytes(next) > LEDGER_BYTES
    || [...viewers].some(v => { const own = next.filter(r => r.v === v); return own.length > VIEWER_LEDGER_LIMIT || ledgerBytes(own) > VIEWER_LEDGER_BYTES; });
}
export const ledgerBytes = (rs: Release[]) => new TextEncoder().encode(JSON.stringify(rs)).length;
// Checks a query's candidate releases in order (the cohort first), each against the ledger plus the
// candidates already accepted from the same query, so definitions in one request are compared too.
// Slice 6aa: with a population, each measure release is also checked by populationRisk (below).
export function screenReleases<T extends { release: Release }>(ledger: Release[], cands: T[], min: number, now: string, population?: Population) {
  let working = [...ledger];
  const accepted: T[] = [], refused: T[] = [];
  for (const c of cands) {
    if (differencingRisk(working, c.release, min, now) === null && (!population || populationRisk(working, c.release, min, now, population) === null)) { accepted.push(c); working = [...working, c.release]; }
    else refused.push(c);
  }
  return { accepted, refused };
}

// Slice 6aa (seventh review, findings 1 and 2): the population check.
// Two reviews in a row bypassed the series-keyed check above with a rule-specific key (a grouping, an exclusion,
// a window). Comparing releases by key cannot be made complete, so this check does not compare keys. It re-evaluates
// every measure release of the viewer's last seven days against the people in scope now (hashed attributes only,
// the ledger still holds no identifiers) and splits the people, and for a windowed measure each person's
// window-to-window increments, into atoms: units released in exactly the same set of shown cells. Every released
// figure is a sum of atoms, so any sum or difference of released figures is a signed sum of atoms; when every atom
// the candidate creates or splits is 0 or at least `min`, no combination of the viewer's releases isolates a
// group of 1 to min-1 by subtraction. The check is conservative: it refuses when a small atom exists even if no
// combination of releases determines it. Limits (stated to owners in the slice 6aa document): it uses today's data,
// so a change between two queries (a new visit) can still be seen by repeating a query; differences between two
// unrelated measures are checked only for the pairs listed in CONTAINED_PAIRS and pairs used by a definition; a
// pair difference across two windows is not split by increments.
// Slice 6ad: `q` takes a window key: the start, or `start|end` for a window that ended in the past (see windowOf).
export type Unit = { f: Record<string, string[]>; g: Record<string, string[]>; x: string[]; q: (measure: string, window: string) => number };
export type Population = { units: Unit[]; windowed: ReadonlySet<string> };
export const CONTAINED_PAIRS: [string, string][] = [['patients-seen', 'patients'], ['identity-provisional', 'patients'], ['followups-overdue', 'followups-open'], ['referrals-completed', 'referrals-created'], ['reuse-served', 'reuse-opportunities'], ['reuse-blocked', 'reuse-opportunities']];
type Cell = { pred: string; r: Release; g: string; w: string; cand: boolean };
const shownCells = (r: Release) => Object.keys(r.c).filter(g => !(r.z ?? []).includes(g));
const predicate = (r: Release, g: string) => JSON.stringify([Object.entries(r.f).sort(), [...(r.x ?? [])].sort(), r.gd ?? 'none', g]);
function memberOf(u: Unit, r: Release) {
  for (const [k, v] of Object.entries(r.f)) if (!(u.f[k] ?? []).includes(v)) return false;
  for (const e of r.x ?? []) if (u.x.includes(e)) return false;
  return true;
}
function cellsOf(rs: { r: Release; cand: boolean }[], measure: string, pop: Population): Cell[] {
  const out = new Map<string, Cell>();
  for (const { r, cand } of rs) if (r.n === measure || (r.d && r.d === measure)) for (const g of shownCells(r)) {
    const w = windowOf(r, pop.windowed.has(measure)), pred = predicate(r, g), id = pred + '|' + w, had = out.get(id);
    out.set(id, had ? { ...had, cand: had.cand && cand } : { pred, r, g, w, cand });
  }
  return [...out.values()];
}
// Slice 6ad (finding 2): a release's window key. A windowed measure is counted over [w, u] (u absent: until the release
// was made); a measure describing a moment is counted at u (absent: now), so two moments are two windows.
export const windowOf = (r: Release, windowed: boolean) => windowed ? (r.u ? `${r.w ?? ''}|${r.u}` : r.w ?? '') : (r.u ? `|${r.u}` : '');
const bounds = (w: string) => { const [since, until] = w.split('|'); return { since, until: until ?? '' }; };
// Windows ordered smallest first; null when they do not form a chain, each inside the next (then the increments
// between windows are not defined and atomRisk falls back to whole profiles).
export function windowChain(ws: string[]): string[] | null {
  const xs = [...new Set(ws)].map(w => ({ w, ...bounds(w) })), end = (u: string) => u || '\uffff';
  if (xs.length > 1 && xs.some(x => x.w.startsWith('|'))) return null;
  xs.sort((a, b) => b.since.localeCompare(a.since) || end(a.until).localeCompare(end(b.until)));
  for (let k = 0; k + 1 < xs.length; k++) if (end(xs[k].until) > end(xs[k + 1].until)) return null;
  return xs.map(x => x.w);
}
// Slice 6ad: when the windows are not a chain, each unit is one atom keyed by its whole profile (its value in every
// shown cell). Every released figure is a sum over profiles, so a profile held by 1 to min-1 units that a candidate
// cell involves or that splits an earlier profile is refused. This is more conservative than the increments split.
function profileRisk(units: Unit[], cells: Cell[], windows: string[], value: (u: Unit, k: number) => number, min: number): number | null {
  const widx = cells.map(c => windows.indexOf(c.w)), atoms = new Map<string, { v: number; old: string; cand: boolean }>(), splits = new Map<string, Set<string>>();
  for (const u of units) {
    const vals = cells.map((c, i) => memberOf(u, c.r) && (u.g[c.r.gd ?? 'none'] ?? []).includes(c.g) ? value(u, widx[i]) : 0);
    if (!vals.some(v => v !== 0)) continue;
    const key = vals.join(','), oldKey = vals.filter((_, i) => !cells[i].cand).join(','), a = atoms.get(key) ?? { v: 0, old: oldKey, cand: vals.some((v, i) => v !== 0 && cells[i].cand) };
    a.v += 1; atoms.set(key, a);
    const sp = splits.get(oldKey) ?? new Set<string>(); sp.add(key); splits.set(oldKey, sp);
  }
  let worst: number | null = null;
  for (const a of atoms.values()) if ((a.cand || (splits.get(a.old)?.size ?? 0) > 1) && a.v > 0 && a.v < min && (worst === null || a.v < worst)) worst = a.v;
  return worst;
}
// Smallest |atom| in 1..min-1 among the atoms that involve a candidate cell or split an earlier atom.
function atomRisk(units: Unit[], cells: Cell[], windows0: string[], value0: (u: Unit, k: number) => number, increments: boolean, min: number): number | null {
  if (!cells.some(c => c.cand)) return null;
  // Slice 6ad: increments need windows that nest; otherwise every unit's whole profile is its atom.
  const chain = increments ? windowChain(windows0) : windows0;
  if (!chain) return profileRisk(units, cells, windows0, value0, min);
  const windows = chain, value = (u: Unit, k: number) => value0(u, windows0.indexOf(windows[k]));
  const widx = cells.map(c => windows.indexOf(c.w)), atoms = new Map<string, { v: number; old: string; cand: boolean }>(), splits = new Map<string, Set<string>>();
  const mem = new Map<Release, boolean>();
  for (const u of units) {
    mem.clear();
    const inCell = cells.map(c => { let b = mem.get(c.r); if (b === undefined) { b = memberOf(u, c.r); mem.set(c.r, b); } return b && (u.g[c.r.gd ?? 'none'] ?? []).includes(c.g); });
    if (!inCell.some(Boolean)) continue;
    let prev = 0;
    for (let k = 0; k < windows.length; k++) {
      const total = value(u, k), d = increments ? total - prev : total; prev = total;
      if (d === 0) continue;
      const sig: number[] = [], old: number[] = [];
      cells.forEach((c, i) => { if (inCell[i] && (increments ? widx[i] >= k : widx[i] === k)) { sig.push(i); if (!c.cand) old.push(i); } });
      if (!sig.length) continue;
      const key = sig.join(','), oldKey = (increments ? '' : k + ':') + old.join(','), a = atoms.get(key) ?? { v: 0, old: oldKey, cand: sig.some(i => cells[i].cand) };
      a.v += d; atoms.set(key, a);
      const sp = splits.get(oldKey) ?? new Set<string>(); sp.add(key); splits.set(oldKey, sp);
    }
  }
  let worst: number | null = null;
  for (const a of atoms.values()) {
    const v = Math.abs(a.v);
    if ((a.cand || (splits.get(a.old)?.size ?? 0) > 1) && v > 0 && v < min && (worst === null || v < worst)) worst = v;
  }
  return worst;
}
export function populationRisk(ledger: Release[], candidate: Release, min: number, now: string, pop: Population): number | null {
  if (!candidate.n) return null;
  const same = (a: Release, b: Release) => a.k === b.k && filterKey(a.f) === filterKey(b.f) && (a.w ?? '') === (b.w ?? '') && (a.u ?? '') === (b.u ?? '') && a.n === b.n && (a.d ?? null) === (b.d ?? null);
  const rs = [...recent(ledger, now).filter(r => r.v === candidate.v && r.n && !same(r, candidate)).map(r => ({ r, cand: false })), { r: candidate, cand: true }];
  const desc = (ws: string[]) => [...new Set(ws)].sort((a, b) => b.localeCompare(a));
  let worst: number | null = null;
  const note = (x: number | null) => { if (x !== null && (worst === null || x < worst)) worst = x; };
  for (const measure of [candidate.n, ...(candidate.d ? [candidate.d] : [])]) {
    const cells = cellsOf(rs, measure, pop), windows = desc(cells.map(c => c.w));
    // atomRisk orders these windows by containment (slice 6ad); `windows[k]` stays the key the value is read for.
    note(atomRisk(pop.units, cells, windows, (u, k) => u.q(measure, windows[k]), true, min));
  }
  const pairs = new Map<string, [string, string]>();
  for (const [a, b] of [...CONTAINED_PAIRS, ...rs.filter(x => x.r.d).map(x => [x.r.n!, x.r.d!] as [string, string])])
    if ([a, b].some(x => x === candidate.n || x === candidate.d)) pairs.set(a + '/' + b, [a, b]);
  for (const [a, b] of pairs.values()) {
    const ca = cellsOf(rs, a, pop), cb = cellsOf(rs, b, pop), cells: Cell[] = [];
    // Slice 6ad: a measure describing a moment (`|end`) pairs with a window ending at that moment.
    const moment = (w: string) => !w || w.startsWith('|'), meets = (m: string, w: string) => !m || bounds(m).until === bounds(w).until;
    for (const x of cb) for (const y of ca) if (x.pred === y.pred && (x.w === y.w || (moment(x.w) && meets(x.w, y.w)) || (moment(y.w) && meets(y.w, x.w)))) cells.push({ ...x, w: moment(x.w) ? y.w || x.w : x.w, cand: x.cand && y.cand ? true : (x.cand || y.cand) });
    const seen = new Map<string, Cell>();
    for (const c of cells) { const id = c.pred + '|' + c.w, had = seen.get(id); seen.set(id, had ? { ...had, cand: had.cand && c.cand } : c); }
    const list = [...seen.values()], windows = desc(list.map(c => c.w));
    note(atomRisk(pop.units, list, windows, (u, k) => u.q(b, windows[k]) - u.q(a, windows[k]), false, min));
  }
  return worst;
}
