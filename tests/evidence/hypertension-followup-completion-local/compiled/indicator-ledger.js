import { digest } from './core.js';
import { defaultOperations } from './operations.js';
import { releaseCandidates } from './indicators.js';
// Slice 7g: the differencing ledger's storage, shared by the indicator queries (slice 6s/6w) and aggregate report
// delivery. Moved unchanged from indicators-server.ts so both paths write releases the same way: the ledger is a
// value inside the operations row, written by its own compare-and-swap statement (it moves no revision and writes
// no command receipt; commands that save the operations row keep the stored ledger, see store.ts KEEP_LEDGER).
//
// A release's receiver is hashed into `v`: a person viewing indicators is `viewer:<user id>`, a destination that
// receives an aggregate report is `destination:<integration id>`. Filters, series keys and group labels are hashed
// with the organisation in the salt, exactly as before.
export async function readLedger(db, orgId) {
    const r = await db.prepare("SELECT json(json_extract(data,'$.indicatorReleases')) AS l, 1 AS present FROM operations WHERE org_id=?").bind(orgId).first();
    if (!r)
        return { ledger: [], text: null };
    return { ledger: r.l ? JSON.parse(r.l) : [], text: r.l ?? '' };
}
export async function writeLedger(db, orgId, previous, next) {
    const value = JSON.stringify(next);
    if (previous === null) {
        const r = await db.prepare('INSERT INTO operations (org_id,data) VALUES (?,?) ON CONFLICT(org_id) DO NOTHING').bind(orgId, JSON.stringify({ ...defaultOperations(), indicatorReleases: next })).run();
        return r.meta.changes === 1;
    }
    const r = await db.prepare("UPDATE operations SET data=json_set(data,'$.indicatorReleases',json(?)) WHERE org_id=? AND COALESCE(json(json_extract(data,'$.indicatorReleases')),'')=?").bind(value, orgId, previous).run();
    return r.meta.changes === 1;
}
// The salted hash used for every value a release records (filters, series keys, group labels, receivers).
export const ledgerHash = (orgId) => async (x) => (await digest(`saha-indicator-release:${orgId}:${x}`)).slice(0, 20);
// Hashed candidate releases for one receiver and one query (filters team, village, programme). Since slice 6aa each
// release also records its measures, filters, exclusions, grouping, window and suppressed cells (indicators.ts
// releaseCandidates), so the indicator page and aggregate reports write releases in the same form.
export async function candidateReleases(orgId, receiver, q, series, at) {
    const h = ledgerHash(orgId);
    return (await releaseCandidates(series, q, await h(receiver), at, h));
}
export const isDisclosureProfile = (r) => !!r.b;
export async function disclosureProfile(orgId, identity, units, at) {
    const h = ledgerHash(orgId), keys = Object.keys(units).sort(), scope = await h('disclosure-scope:' + keys.join(','));
    return { v: await h('human-live-aggregate-family:v1'), at, k: await h('disclosure-series:' + identity + ':' + await digest(Object.fromEntries(keys.map(k => [k, units[k]])))), f: { team: scope }, c: { all: keys.length }, b: { version: 1, units } };
}
// Split the union of hashed contributors by everything previously disclosed and the proposed
// profile. A new/split atom smaller than MIN_CELL is withheld, including scope withdrawals and
// changes between queries. Repeated identical profiles do not manufacture new small atoms.
export function disclosureRisk(ledger, candidate, min, at) {
    const cutoff = Date.parse(at) - 168 * 3600000;
    const old = ledger.filter(r => r.v === candidate.v && Date.parse(r.at) >= cutoff).map(r => {
        if (!isDisclosureProfile(r) || r.b.version !== 1 || !r.b.units || typeof r.b.units !== 'object')
            throw Error('Unknown live disclosure profile');
        for (const [id, pair] of Object.entries(r.b.units))
            if (!/^[a-f0-9]{20}$/.test(id) || !Array.isArray(pair) || pair.length !== 2 || pair.some(x => !Number.isFinite(x) || x < 0))
                throw Error('Invalid live disclosure profile');
        return r;
    });
    const ids = new Set([...old.flatMap(r => Object.keys(r.b.units)), ...Object.keys(candidate.b.units)]), atoms = new Map(), splits = new Map();
    for (const id of ids) {
        const previous = JSON.stringify(old.map(r => r.b.units[id] ?? null)), value = candidate.b.units[id] ?? null, key = JSON.stringify([previous, value]), atom = atoms.get(key) ?? { n: 0, old: previous, candidate: value !== null };
        atom.n++;
        atoms.set(key, atom);
        const set = splits.get(previous) ?? new Set();
        set.add(key);
        splits.set(previous, set);
    }
    for (const atom of atoms.values())
        if ((atom.candidate || (splits.get(atom.old)?.size ?? 0) > 1) && atom.n > 0 && atom.n < min)
            return true;
    return false;
}
export async function indicatorDisclosureProfiles(orgId, candidates, population, personIds, at) {
    const h = ledgerHash(orgId), ids = await Promise.all(personIds.map(id => h('live-disclosure-person:v1:' + id))), out = [];
    for (const candidate of candidates) {
        const r = candidate.release;
        for (const group of Object.keys(r.c).filter(g => !(r.z ?? []).includes(g))) {
            const units = {};
            population.units.forEach((u, i) => { if (Object.entries(r.f).some(([k, v]) => !(u.f[k] ?? []).includes(v)) || (r.x ?? []).some(x => u.x.includes(x)) || !(u.g[r.gd ?? 'none'] ?? []).includes(group))
                return; const window = r.w ? (r.u ? r.w + '|' + r.u : r.w) : ''; units[ids[i]] = [r.n ? u.q(r.n, window) : 1, r.d ? u.q(r.d, window) : 0]; });
            const profile = await disclosureProfile(orgId, `indicator:${r.k}:${group}:${r.w ?? ''}:${r.u ?? ''}`, units, at);
            profile.b.source = await digest(r);
            out.push({ candidate, profile });
        }
    }
    return out;
}
export async function untrackedDisclosureHistory(ledger, at, orgId) {
    const family = orgId ? await ledgerHash(orgId)('human-live-aggregate-family:v1') : null;
    const cutoff = Date.parse(at) - 168 * 3600000, rows = ledger.filter(r => Date.parse(r.at) >= cutoff), tracked = new Set(rows.filter(isDisclosureProfile).flatMap(r => [r.b.source, ...(r.b.sources ?? []).filter(x => Date.parse(x.at) >= cutoff).map(x => x.hash)]).filter(Boolean));
    for (const row of rows)
        if (isDisclosureProfile(row)) {
            const b = row.b;
            if (family && row.v !== family)
                throw Error('Unknown disclosure profile domain');
            if (b.version !== 1 || !b.units || typeof b.units !== 'object' || Array.isArray(b.units) || Object.keys(b).some(k => !['version', 'source', 'sources', 'units'].includes(k)) || Object.keys(row).some(k => !['v', 'at', 'k', 'f', 'c', 'b'].includes(k)) || !Number.isFinite(Date.parse(row.at)) || !/^[a-f0-9]{20}$/.test(row.k) || Object.keys(row.f ?? {}).join(',') !== 'team' || !/^[a-f0-9]{20}$/.test(row.f.team) || Object.keys(row.c ?? {}).join(',') !== 'all' || row.c.all !== Object.keys(b.units).length)
                throw Error('Invalid disclosure profile shape');
            if (b.source !== undefined && !/^[a-f0-9]{64}$/.test(b.source))
                throw Error('Invalid disclosure source binding');
            if (b.sources !== undefined && (!Array.isArray(b.sources) || b.sources.some(x => !x || typeof x !== 'object' || Object.keys(x).sort().join(',') !== 'at,hash' || !/^[a-f0-9]{64}$/.test(x.hash) || !Number.isFinite(Date.parse(x.at)))))
                throw Error('Invalid disclosure source history');
            for (const [id, pair] of Object.entries(b.units))
                if (!/^[a-f0-9]{20}$/.test(id) || !Array.isArray(pair) || pair.length !== 2 || pair.some(x => !Number.isFinite(x) || x < 0))
                    throw Error('Invalid disclosure contributions');
            if (orgId && row.f.team !== await ledgerHash(orgId)('disclosure-scope:' + Object.keys(b.units).sort().join(',')))
                throw Error('Disclosure scope binding changed');
        }
    for (const row of rows)
        if (!isDisclosureProfile(row) && !tracked.has(await digest(row)))
            return true;
    return false;
}
export function mergeDisclosureSources(ledger, profiles) {
    return profiles.map(profile => { const cutoff = Date.parse(profile.at) - 168 * 3600000, old = ledger.filter(isDisclosureProfile).filter(r => r.v === profile.v && r.k === profile.k && JSON.stringify(r.f) === JSON.stringify(profile.f)); const records = old.flatMap(r => [...(r.b.source ? [{ hash: r.b.source, at: r.at }] : []), ...(r.b.sources ?? [])]).filter(x => Date.parse(x.at) >= cutoff); if (profile.b.source)
        records.push({ hash: profile.b.source, at: profile.at }); const byHash = new Map(records.map(x => [x.hash, x])); return { ...profile, b: { ...profile.b, sources: [...byHash.values()] } }; });
}
