// Slice 6z: entries are keyed by question id; read them as own properties only (the same rule as programmes.ts `own`,
// repeated here so this module keeps no import of the programme catalogue).
const own = (r, k) => r && Object.prototype.hasOwnProperty.call(r, k) ? r[k] : undefined;
// Slice 2c: source and observation time for each measurement (BR-DATA-02). Pure helpers shared by the server,
// the workspace UI and the FHIR exports. A recorded value is measured or reported; a blank measurement may say
// why it is missing (not asked, declined, unknown, not applicable), which is never read as a normal finding.
// Visits without per-measurement entries fall back to the visit-level source and observation time.
// UTC observation minutes must name a real calendar minute, without Date.parse rollover.
// Calendar validity is separate from the existing future-time and clinical range rules.
export function validObservationMinute(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
        return false;
    const at = Date.parse(value + 'Z');
    return Number.isFinite(at) && new Date(at).toISOString().slice(0, 16) === value;
}
export const FACT_SOURCES = ['measured', 'reported', 'not-asked', 'declined', 'unknown', 'not-applicable'];
export const RECORDED_SOURCES = ['measured', 'reported'];
export const MISSING_SOURCES = ['not-asked', 'declined', 'unknown', 'not-applicable'];
export const MEASURES = ['bloodPressure', 'weight', 'temperature', 'weeks', 'coughDays'];
export const MEASURE_LABEL = { bloodPressure: 'Blood pressure', weight: 'Weight', temperature: 'Temperature', weeks: 'Gestational age', coughDays: 'Cough duration' };
export const SOURCE_LABEL = { measured: 'Measured during visit', reported: 'Reported by person / carer', 'not-asked': 'Not asked', declined: 'Declined', unknown: 'Unknown', 'not-applicable': 'Not applicable' };
export const measureOf = (field) => field === 'systolic' || field === 'diastolic' ? 'bloodPressure' : MEASURES.includes(field) ? field : null;
export const measureValue = (f, m) => m === 'bloodPressure' ? (f.systolic || f.diastolic) : f[m];
// The source and time that apply to one measurement; old visits fall back to the visit-level values.
export function factProvenance(f, m) { const p = f.provenance?.[m]; return { source: p?.source ?? f.source, at: p?.at ?? f.date, own: !!p }; }
// Drops entries that carry no information: a recorded source without a value, or a time without a value.
// Contradictions (a value marked as missing) are kept so the server refuses them with a reason.
export function tidyProvenance(f) {
    if (!f.provenance)
        return f;
    const next = {};
    for (const m of MEASURES) {
        const p = f.provenance[m];
        if (!p)
            continue;
        const value = measureValue(f, m);
        if (!value && RECORDED_SOURCES.includes(p.source))
            continue;
        next[m] = value ? { ...p } : { source: p.source };
    }
    const { provenance, ...rest } = f;
    return Object.keys(next).length ? { ...rest, provenance: next } : rest;
}
export function provenanceText(value) { if (!value || typeof value !== 'object')
    return String(value ?? ''); return Object.entries(value).map(([m, p]) => `${MEASURE_LABEL[m] ?? m}: ${SOURCE_LABEL[p?.source] ?? p?.source}${p?.at ? ` at ${p.at.replace('T', ' ')} UTC` : ''}`).join('; '); }
// Slice 2e: per-measurement author and clinician verification (BR-DATA-02).
// A measurement is present when it has a value or a per-measurement entry (for example a missing reason).
export const AUTHOR_ROLE_LABEL = { asha: 'ASHA worker', clinician: 'Clinician', supervisor: 'Supervisor', admin: 'Administrator', provider: 'Provider (sandbox)' };
const present = (f, m) => !!f && (!!measureValue(f, m) || !!f.provenance?.[m]);
const fingerprint = (f, m) => {
    if (!f)
        return '';
    // A recorded measurement may inherit its source or time from the visit. A
    // correction to that effective provenance changes the measurement even when
    // its value and optional own entry stay equal. Missing reasons have no
    // observation time, so unrelated visit edits must not reattribute them.
    const effective = measureValue(f, m) ? factProvenance(f, m) : null;
    return JSON.stringify([m === 'bloodPressure' ? [f.systolic, f.diastolic] : f[m], f.provenance?.[m] ?? null, effective ? [effective.source, effective.at] : null]);
};
// The authors after a change of facts: a measurement whose value or entry changed is credited to the actor (the
// authenticated server identity); an unchanged one keeps its recorded author, or none for older facts (never guessed);
// a measurement that is no longer present has no author.
export function stampAuthors(prev, next, authors, actor) {
    const out = {};
    for (const m of MEASURES) {
        if (!present(next, m))
            continue;
        if (fingerprint(prev, m) !== fingerprint(next, m))
            out[m] = { ...actor };
        else if (authors?.[m])
            out[m] = { ...authors[m] };
    }
    return Object.keys(out).length ? out : undefined;
}
export function factMeasuresPresent(f) { return MEASURES.filter(m => present(f, m)); }
// Current verification state: the latest appended review for the measurement, or unverified.
export function factReview(v, m) { const rs = (v.factReviews ?? []).filter(r => r.measure === m); return rs.at(-1) ?? null; }
export function authorText(a) { return a ? `${a.name} (${AUTHOR_ROLE_LABEL[a.role] ?? a.role}), saved ${a.at.slice(0, 16).replace('T', ' ')} UTC` : 'not recorded'; }
export function reviewText(r) { return !r ? 'unverified' : `${r.state === 'verified' ? 'verified' : 'disputed'} by ${r.byName} (clinician), ${r.at.slice(0, 16).replace('T', ' ')} UTC${r.reason ? `: ${r.reason}` : ''}`; }
// Text added to FHIR observation notes. Visits recorded before slice 2e (no authors, no reviews) are unchanged.
export function factAuditText(v, m) { if (!v.factAuthors && !v.factReviews?.length)
    return ''; return ` Recorded by: ${authorText(v.factAuthors?.[m])}. Verification: ${reviewText(factReview(v, m))}.`; }
export const entryContent = (v) => ({ notes: v.facts.notes ?? '', answers: v.programmeCapture?.answers ?? {}, absence: v.programmeCapture?.absence ?? {} });
export const answerKeys = (c) => [...new Set([...Object.keys(c.answers), ...Object.keys(c.absence)].filter(k => !!(own(c.answers, k) || own(c.absence, k))))].sort();
export function stampEntryAuthors(prev, next, old, actor) {
    const noteAuthor = !next.notes ? undefined : prev?.notes === next.notes ? old?.noteAuthor : { ...actor };
    const answerAuthors = {};
    const fp = (c, k) => c ? JSON.stringify([own(c.answers, k) ?? null, own(c.absence, k) ?? null]) : '';
    for (const k of answerKeys(next)) {
        if (fp(prev, k) !== fp(next, k))
            answerAuthors[k] = { ...actor };
        else if (own(old?.answerAuthors, k))
            answerAuthors[k] = { ...own(old?.answerAuthors, k) };
    }
    return { noteAuthor: noteAuthor ? { ...noteAuthor } : undefined, answerAuthors: Object.keys(answerAuthors).length ? answerAuthors : undefined };
}
export const entryKeys = (v) => { const c = entryContent(v); return [...(c.notes ? ['notes'] : []), ...answerKeys(c).map(k => 'answer:' + k)]; };
export const entryAuthor = (v, entry) => entry === 'notes' ? v.noteAuthor : entry.startsWith('answer:') ? own(v.answerAuthors, entry.slice(7)) : undefined;
export function entryReview(v, entry) { return (v.entryReviews ?? []).filter(r => r.entry === entry).at(-1) ?? null; }
export function signOffText(s) { return s ? `signed off by ${s.byName}${s.role ? ` (${AUTHOR_ROLE_LABEL[s.role] ?? s.role})` : ''}, ${s.at.slice(0, 16).replace('T', ' ')} UTC` : 'not signed off'; }
// Slice 2i: units and unusual values (BR-DATA-05). Pure helpers shared by the server, the visit screen and (mirrored by
// hand) the field notebook. The ranges below are an ENGINEERING PLACEHOLDER: they are not clinically approved and claim no
// clinical authority. They only decide when a value needs a recorded reason (outside "expected") and, further out
// (outside "confirm"), a clinician's confirmation before the visit can be confirmed. Changing them needs a release.
export const VALUE_FIELDS = ['systolic', 'diastolic', 'weight', 'temperature', 'weeks', 'coughDays'];
export const VALUE_RANGES = { version: 'saha-value-ranges-0.1.0', status: 'engineering placeholder — not clinically approved', fields: {
        systolic: { label: 'Systolic blood pressure', unit: 'mmHg', expected: [70, 200], confirm: [50, 260] },
        diastolic: { label: 'Diastolic blood pressure', unit: 'mmHg', expected: [40, 120], confirm: [25, 160] },
        weight: { label: 'Weight', unit: 'kg', expected: [2, 150], confirm: [0.5, 300] },
        temperature: { label: 'Temperature', unit: '°C', expected: [34, 41], confirm: [30, 44] },
        weeks: { label: 'Gestational age', unit: 'weeks', expected: [4, 42], confirm: [1, 45] },
        coughDays: { label: 'Cough duration', unit: 'days', expected: [0, 90], confirm: [0, 730] },
    } };
// Alternative units accepted at entry. The unit is always stated by the person entering the value; nothing guesses it.
// Slice 2i accepted lb, °F and weeks; slice r24 adds kilopascals for blood pressure and weeks + days for gestational age.
export const CONVERTIBLE_FIELDS = ['weight', 'temperature', 'coughDays'];
export const ALT_UNITS = {
    weight: { unit: 'lb', label: 'lb (pounds)', decimals: 2, convert: x => x * 0.45359237 },
    temperature: { unit: 'degF', label: '°F (Fahrenheit)', decimals: 1, convert: x => (x - 32) * 5 / 9 },
    coughDays: { unit: 'wk', label: 'weeks', decimals: 1, convert: x => x * 7 },
};
// Slice r24 (BR-DATA-05): further alternative units. Blood pressure is accepted in kilopascals (converted to mmHg,
// 1 kPa = 7.50062 mmHg) and gestational age in weeks + days (converted to decimal weeks). The same contract as slice 2i:
// the unit is always stated by the person entering the value, nothing guesses it, and the entered value is kept.
export const EXTRA_UNITS = {
    systolic: { unit: 'kPa', label: 'kPa (kilopascals)', decimals: 1, convert: x => x * 7.50062 },
    diastolic: { unit: 'kPa', label: 'kPa (kilopascals)', decimals: 1, convert: x => x * 7.50062 },
};
export const WEEKS_DAYS = { unit: 'wk+d', label: 'weeks + days', decimals: 2 };
export function alternativeUnit(field) { return field === 'weeks' ? WEEKS_DAYS : ALT_UNITS[field] ?? EXTRA_UNITS[field]; }
export const ALL_CONVERTIBLE_FIELDS = ['weight', 'temperature', 'coughDays', 'systolic', 'diastolic', 'weeks'];
const NUMBER = /^[0-9]+(\.[0-9]+)?$/;
// "20+3" means 20 weeks and 3 days; converted to decimal weeks to two decimals.
export function convertWeeksDays(value) { const m = /^([0-9]{1,2})\+([0-6])$/.exec(value.trim()); if (!m)
    return null; const x = +m[1] + (+m[2]) / 7; if (!Number.isFinite(x) || x < 0)
    return null; return String(Number(x.toFixed(WEEKS_DAYS.decimals))); }
function enteredUnitLabel(field) { if (field === 'weeks')
    return WEEKS_DAYS.label; const alt = ALT_UNITS[field] ?? EXTRA_UNITS[field]; return alt?.label ?? VALUE_RANGES.fields[field].unit; }
export function convertEntered(field, e) {
    if (field === 'weeks')
        return e.unit === WEEKS_DAYS.unit ? convertWeeksDays(e.value) : null;
    const alt = ALT_UNITS[field] ?? EXTRA_UNITS[field];
    if (!alt || e.unit !== alt.unit || !NUMBER.test(e.value) || e.value.length > 12)
        return null;
    const x = alt.convert(+e.value);
    if (!Number.isFinite(x) || x < 0)
        return null;
    return String(Number(x.toFixed(alt.decimals)));
}
export const rangeText = (f, r) => `${r[0]}–${r[1]} ${VALUE_RANGES.fields[f].unit}`;
export const POPULATION_RANGES = {
    version: 'saha-value-ranges-0.2.0',
    status: 'engineering placeholder — not clinically approved',
    note: 'Age-, sex- and pregnancy-specific ranges are illustrative placeholders. No clinical authority is claimed and no one has approved these numbers.',
    groups: [
        { id: 'paediatric', label: 'Children under 18', match: c => c.age !== undefined && c.age < 18, fields: {
                systolic: { label: 'Systolic blood pressure', unit: 'mmHg', expected: [90, 120], confirm: [70, 160] },
                diastolic: { label: 'Diastolic blood pressure', unit: 'mmHg', expected: [50, 80], confirm: [40, 100] },
                weight: { label: 'Weight', unit: 'kg', expected: [2, 65], confirm: [0.5, 100] },
            } },
        { id: 'pregnant', label: 'Pregnancy', match: c => c.pregnant === true, fields: {
                systolic: { label: 'Systolic blood pressure', unit: 'mmHg', expected: [90, 140], confirm: [80, 160] },
                diastolic: { label: 'Diastolic blood pressure', unit: 'mmHg', expected: [50, 90], confirm: [40, 110] },
                weight: { label: 'Weight', unit: 'kg', expected: [35, 120], confirm: [30, 150] },
                weeks: { label: 'Gestational age', unit: 'weeks', expected: [4, 42], confirm: [1, 45] },
            } },
    ],
};
// The ranges (and their version/status) that apply to a context; the slice 2i ranges when no group matches.
export function rangeSelection(context) {
    if (!context)
        return { fields: VALUE_RANGES.fields, version: VALUE_RANGES.version, status: VALUE_RANGES.status };
    const group = POPULATION_RANGES.groups.find(g => g.match(context));
    if (!group)
        return { fields: VALUE_RANGES.fields, version: VALUE_RANGES.version, status: VALUE_RANGES.status };
    const fields = { ...VALUE_RANGES.fields };
    for (const [k, v] of Object.entries(group.fields))
        if (v)
            fields[k] = { ...v };
    return { fields, version: POPULATION_RANGES.version, status: POPULATION_RANGES.status };
}
// The context for a person, inferred the same way a save path would: pregnancy from a Maternal care programme or an
// active maternal enrolment. Pure and optional; the server's save path keeps the default ranges unless a caller passes it.
export function rangeContextFor(p) {
    if (!p)
        return undefined;
    const pregnant = (p.programmes ?? []).includes('Maternal care') || (p.enrolments ?? []).some(e => e.packId === 'maternal' && e.state === 'active');
    return { age: p.age, ...(['Female', 'Male', 'Other', 'Unknown'].includes(p.sex ?? '') ? { sex: p.sex } : {}), pregnant };
}
// 'expected' inside the expected range; 'reason' outside it but inside the confirmation range; 'clinician' beyond that.
export function valueTier(field, value, context, selection) { const x = +value, r = (selection ?? rangeSelection(context)).fields[field]; if (!value || !Number.isFinite(x))
    return 'expected'; if (x >= r.expected[0] && x <= r.expected[1])
    return 'expected'; return x >= r.confirm[0] && x <= r.confirm[1] ? 'reason' : 'clinician'; }
// Converts values entered in an alternative unit. Returns the converted facts, or a problem the server refuses with.
export function normaliseUnits(f) {
    if (!f.entered)
        return { facts: f };
    const next = { ...f, entered: {} };
    for (const k of Object.keys(f.entered)) {
        const field = k;
        if (!ALL_CONVERTIBLE_FIELDS.includes(field))
            return { facts: f, problem: `${k}: no alternative unit is accepted for this measurement.` };
        const e = f.entered[field], label = VALUE_RANGES.fields[field].label, unitLabel = enteredUnitLabel(field);
        const value = convertEntered(field, e);
        if (value === null)
            return { facts: f, problem: `${label}: enter a positive number in ${unitLabel}, or enter the value in ${VALUE_RANGES.fields[field].unit}.` };
        if (f[field] && f[field] !== value)
            return { facts: f, problem: `${label}: ${f[field]} ${VALUE_RANGES.fields[field].unit} does not match the entered ${e.value} ${unitLabel} (${value} ${VALUE_RANGES.fields[field].unit}). Clear one of them.` };
        next[field] = value;
        next.entered[field] = { value: e.value, unit: e.unit };
    }
    if (!Object.keys(next.entered).length)
        delete next.entered;
    return { facts: next };
}
// The first range problem in normalised facts: a value outside the expected range without a reason of at least 10
// characters, or a reason without an unusual value. The server refuses with it; the notebook and screen show it early.
export function rangeProblem(f, context, selection) {
    const sel = selection ?? rangeSelection(context);
    for (const field of VALUE_FIELDS) {
        const value = f[field], reason = (f.unusual?.[field] ?? '').trim(), r = sel.fields[field], tier = valueTier(field, value, context, sel);
        if (tier !== 'expected' && reason.length < 10)
            return `${r.label} ${value} ${r.unit} is outside the expected range ${rangeText(field, r.expected)} (${sel.status}). Check the value and its unit, or give a reason of at least 10 characters for this unusual value.`;
        if (tier === 'expected' && f.unusual?.[field] !== undefined)
            return `${r.label}: a reason applies only to a value outside the expected range ${rangeText(field, r.expected)}.`;
    }
    return null;
}
// The override that applies to a field now: the latest appended one for the same value and reason.
export function currentOverride(v, field) { const reason = v.facts.unusual?.[field]; if (!reason || !v.facts[field])
    return null; return [...(v.valueOverrides ?? [])].reverse().find(o => o.field === field && o.value === v.facts[field] && o.reason === reason && o.rangeCaptureId === v.valueRangeCapture?.id) ?? null; }
export const overrideConfirmation = (v, o) => (v.overrideConfirmations ?? []).find(c => c.overrideId === o.id) ?? null;
export function unconfirmedValues(v) { return VALUE_FIELDS.flatMap((field) => { const tier = valueTier(field, v.facts[field], undefined, selectionForVisit(v)); if (tier === 'expected')
    return []; const o = currentOverride(v, field); return !o ? [{ field, need: 'reason' }] : tier === 'clinician' && !overrideConfirmation(v, o) ? [{ field, need: 'clinician', override: o }] : []; }); }
export function enteredText(e) { if (!e)
    return ''; if (e.unit === WEEKS_DAYS.unit)
    return `${e.value} ${WEEKS_DAYS.label}`; const alt = [...Object.values(ALT_UNITS), ...Object.values(EXTRA_UNITS)].find(a => a.unit === e.unit); return `${e.value} ${alt ? alt.label.split(' ')[0] : e.unit}`; }
export function overrideText(o) { const r = VALUE_RANGES.fields[o.field]; return `${r.label} ${o.value} ${r.unit}${o.entered ? ` (entered as ${enteredText(o.entered)})` : ''} outside the expected range ${rangeText(o.field, o.expected)}; reason: ${o.reason}; recorded by ${authorText(o.by)}`; }
// Text added to FHIR observation notes for a field with an unusual value; empty when none applies (output unchanged).
export function unusualNoteText(v, field) {
    const o = currentOverride(v, field);
    const e = v.facts.entered?.[field];
    const parts = [e ? ` Entered as ${enteredText(e)}; converted by Saha.` : '', o ? ` Unusual value (${o.rangesVersion}, ${VALUE_RANGES.status}): outside ${rangeText(field, o.expected)}; reason: ${o.reason.replace(/[.\s]+$/, '')}.${o.tier === 'clinician' ? (() => { const c = overrideConfirmation(v, o); return c ? ` Confirmed by ${c.byName} (clinician), ${c.at.slice(0, 16).replace('T', ' ')} UTC.` : ' Clinician confirmation pending.'; })() : ''}` : ''];
    return parts.join('');
}
// Before a save: fills the base-unit value from an alternative-unit entry (the server recomputes and compares), drops
// blank entries and reasons for values that are not unusual. Unconvertible entries are kept so the server refuses them.
export function tidyValues(f, selection) {
    const next = { ...f };
    if (f.entered) {
        const e = {};
        for (const k of ALL_CONVERTIBLE_FIELDS) {
            const x = f.entered[k];
            if (!x || !x.value.trim())
                continue;
            e[k] = { value: x.value.trim(), unit: x.unit };
            if (!next[k])
                next[k] = convertEntered(k, e[k]) ?? '';
        }
        if (Object.keys(e).length)
            next.entered = e;
        else
            delete next.entered;
    }
    if (f.unusual) {
        const u = {};
        for (const k of VALUE_FIELDS) {
            const r = f.unusual[k];
            if (r && r.trim() && valueTier(k, next[k], undefined, selection) !== 'expected')
                u[k] = r;
        }
        if (Object.keys(u).length)
            next.unusual = u;
        else
            delete next.unusual;
    }
    return next;
}
// Slice 2i: text for any facts entry in the record history and version-conflict views (strings unchanged).
export function factEntryText(key, value) {
    if (typeof value === 'string')
        return value;
    if (!value || typeof value !== 'object')
        return String(value ?? '');
    const label = (k) => VALUE_RANGES.fields[k]?.label ?? k;
    if (key === 'entered')
        return Object.entries(value).map(([k, e]) => `${label(k)}: ${enteredText(e)}`).join('; ');
    if (key === 'unusual')
        return Object.entries(value).map(([k, r]) => `${label(k)}: ${r}`).join('; ');
    return provenanceText(value);
}
export const FACT_ENTRY_LABEL = { entered: 'Entered in another unit', unusual: 'Reasons for unusual values' };
// New captures pin the exact reviewed compiled policy. Absence preserves historical default behaviour.
export const selectionForVisit = (v) => v.valueRangeCapture ?? rangeSelection();
export const rangeContextKey = (c) => JSON.stringify([c?.age ?? null, c?.sex ?? null, c?.pregnant ?? false]);
export function rangeCaptureFor(s, p) {
    const x = (s.operations?.valueRangeProtocols ?? []).find(x => x.state === 'active');
    if (!x)
        return undefined;
    const manifest = x.manifest;
    const context = x.mode === 'population-demo' ? rangeContextFor(p) : undefined, contextKey = rangeContextKey(context), group = context?.age !== undefined && context.age < 18 ? 'paediatric' : context?.pregnant ? 'pregnant' : 'default';
    const g = manifest.population?.groups.find(g => g.id === group), sel = { fields: { ...manifest.defaultRanges.fields, ...g?.fields }, version: g ? manifest.population.version : manifest.defaultRanges.version, status: g ? manifest.population.status : manifest.defaultRanges.status };
    return { id: x.id + ':' + contextKey, protocolId: x.id, manifestHash: x.manifestHash, publicationVersion: x.publicationVersion, mode: x.mode, compiledVersion: x.mode === 'population-demo' ? manifest.population.version : manifest.defaultRanges.version, version: sel.version, status: sel.status, clinicalApproval: 'pending', ...(context ? { context } : {}), contextKey, group, fields: JSON.parse(JSON.stringify(sel.fields)) };
}
export function rangeContextProblem(v, p) {
    const c = v.valueRangeCapture;
    if (!c || c.mode !== 'population-demo')
        return null;
    return c.contextKey !== rangeContextKey(rangeContextFor(p)) ? 'Patient age, sex or programme context changed. Review and refresh this draft’s range context before saving or confirming.' : null;
}
