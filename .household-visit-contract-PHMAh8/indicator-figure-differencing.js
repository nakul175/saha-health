import { MIN_CELL, WINDOWED } from './indicators.js';
import { figurePopulation } from './indicator-figure-material.js';
import { windowOf } from './indicator-differencing.js';
// Edition values cannot replace one another in the live seven-day ledger: users can retain original reports.
// This conservative additional guard compares protected patient contributions across actually disclosed editions.
function contributions(material, r, measure) {
    const pop = figurePopulation(material), out = new Map(), hidden = new Set(r.z ?? []), shown = new Set(Object.keys(r.c).filter(g => !hidden.has(g)));
    material.units.forEach((u, i) => { if (Object.entries(r.f).some(([k, v]) => !u.f[k]?.includes(v)) || (r.x ?? []).some(x => u.x.includes(x)))
        return; const groups = (u.g[r.gd ?? 'none'] ?? []).filter(g => shown.has(g)); if (!groups.length)
        return; out.set(u.personId, { value: pop.units[i].q(measure, windowOf(r, WINDOWED.has(measure))), groups: [...groups].sort() }); });
    return out;
}
export function editionRisk(oldMaterial, old, newMaterial, next, min = MIN_CELL) {
    const measures = [next.n, ...(next.d ? [next.d] : [])].filter((x) => !!x && [old.n, old.d].includes(x));
    let worst = null;
    for (const measure of measures) {
        const a = contributions(oldMaterial, old, measure), b = contributions(newMaterial, next, measure);
        let changed = 0;
        for (const personId of new Set([...a.keys(), ...b.keys()])) {
            const av = a.get(personId), bv = b.get(personId);
            if (!(av?.value || bv?.value))
                continue;
            const valueChanged = (av?.value ?? 0) !== (bv?.value ?? 0), groupChanged = old.gd === next.gd && JSON.stringify(av?.groups ?? []) !== JSON.stringify(bv?.groups ?? []);
            if (valueChanged || groupChanged)
                changed++;
        }
        if (changed > 0 && changed < min && (worst === null || changed < worst))
            worst = changed;
    }
    return worst;
}
