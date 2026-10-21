// Slice 5i: drift monitoring from shadow comparisons (BR-AI-10).
//
// For each capability revision with shadow comparisons (slice 5f), the per-field outcomes are grouped into
// consecutive 7-day periods by the date the compared visit was confirmed (the comparison time when the visit is
// no longer present), ending with the current UTC day. The agreement rate of a period is agreement divided by the
// fields that had a clinician-confirmed value (agreement + disagreement + missing); fields without a confirmed value
// and unable-to-assess outcomes are counted but not rated. A drop is flagged when a period's rate is more than
// DRIFT_DROP_POINTS percentage points below the previous period's, and both periods have at least DRIFT_MIN_FIELDS
// rated fields; otherwise the pair is "insufficient". Counts only: no visit, person, value or field-level detail.
// Derived on read; nothing is stored, nothing is suspended automatically.
export const DRIFT_PERIOD_DAYS = 7, DRIFT_PERIODS = 4, DRIFT_DROP_POINTS = 10, DRIFT_MIN_FIELDS = 10;
const DAY = 86400000;
export function periods(now) {
    const end = Date.parse(now.slice(0, 10) + 'T00:00:00Z') + DAY;
    return Array.from({ length: DRIFT_PERIODS }, (_, i) => { const to = end - (DRIFT_PERIODS - 1 - i) * DRIFT_PERIOD_DAYS * DAY; return { from: new Date(to - DRIFT_PERIOD_DAYS * DAY).toISOString(), to: new Date(to).toISOString() }; });
}
const round1 = (n) => Math.round(n * 10) / 10;
// Slice 13c: `fieldsOf` gives a result's comparison as it stands now (shadow.currentFields: re-derived for an amended visit, null
// for a voided one, which is then left out); the default keeps the stored fields, as before this slice.
export function driftReport(s, shadows, now = new Date().toISOString(), fieldsOf = r => r.fields ?? null) {
    const visits = new Map(s.workspace.visits.map(v => [v.id, v]));
    const entries = (s.governance?.entries ?? []);
    const bounds = periods(now), byEntry = new Map();
    for (const sh of shadows)
        byEntry.set(sh.entryId, [...(byEntry.get(sh.entryId) ?? []), sh]);
    return [...byEntry.entries()].map(([entryId, list]) => {
        const e = entries.find(x => x.id === entryId);
        const rows = bounds.map(b => ({ ...b, visits: 0, rated: 0, rate: null, agreement: 0, disagreement: 0, missing: 0, notRecorded: 0, unable: 0 }));
        for (const [r, sh] of list.flatMap(sh => sh.results.map(r => [r, sh]))) {
            if (r.status === 'not-run')
                continue;
            const fields = r.status === 'compared' ? fieldsOf(r, sh) : null;
            if (r.status === 'compared' && !fields)
                continue;
            const at = visits.get(r.visitId)?.confirmedAt ?? r.at, p = rows.find(x => at >= x.from && at < x.to);
            if (!p)
                continue;
            p.visits++;
            if (r.status === 'unable') {
                p.unable++;
                continue;
            }
            for (const f of fields ?? []) {
                if (f.outcome === 'not-recorded')
                    p.notRecorded++;
                else if (f.outcome === 'unable')
                    p.unable++;
                else
                    p[f.outcome]++;
            }
        }
        for (const p of rows) {
            p.rated = p.agreement + p.disagreement + p.missing;
            p.rate = p.rated ? round1(p.agreement / p.rated * 100) : null;
        }
        const changes = rows.slice(1).map((p, i) => { const q = rows[i], ok = q.rated >= DRIFT_MIN_FIELDS && p.rated >= DRIFT_MIN_FIELDS; const points = ok ? round1(p.rate - q.rate) : null; return { from: q.from, to: p.to, points, status: (points === null ? 'insufficient' : points < -DRIFT_DROP_POINTS ? 'drop' : 'stable') }; });
        const status = changes.some(c => c.status === 'drop') ? 'drop' : changes.some(c => c.status === 'stable') ? 'stable' : 'insufficient';
        return { entryId, key: e?.spec.key ?? list[0].key, revision: e?.revision ?? list[0].revision, title: e?.spec.title ?? list[0].key, state: e?.state ?? 'unknown', periods: rows, changes, status };
    }).sort((a, b) => Number(b.status === 'drop') - Number(a.status === 'drop') || a.key.localeCompare(b.key) || a.revision - b.revision);
}
export const DRIFT_NOTICE = `Agreement of shadow outputs with clinician-confirmed values per ${DRIFT_PERIOD_DAYS}-day period, by visit confirmation date. A drop of more than ${DRIFT_DROP_POINTS} percentage points between consecutive periods, each with at least ${DRIFT_MIN_FIELDS} rated fields, is flagged. Counts only; shadow comparisons from the local rules provider on synthetic or confirmed records, not a validated accuracy measure. Nothing is suspended automatically: a governance manager decides, and can place a safety hold.`;
