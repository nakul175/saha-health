import { transitionEffectVerified, transitionReplacementVerified } from './installed-transition-authority.js';
export const COMPILED_PACK_IDS = ['maternal', 'tb', 'hypertension'];
const weight = { id: 'weight', label: 'Weight', unit: 'kg', fact: 'weight', required: true };
const bp = [{ id: 'systolic', label: 'Systolic blood pressure', unit: 'mmHg', fact: 'systolic', required: true }, { id: 'diastolic', label: 'Diastolic blood pressure', unit: 'mmHg', fact: 'diastolic', required: true }];
export const PACKS = [
    { id: 'maternal', version: 1, name: 'Maternal care', programme: 'Maternal care', purpose: 'Document a locally confirmed pregnancy episode and visit follow-up.', questions: [weight, ...bp, { id: 'weeks', label: 'Gestational age, reported', unit: 'weeks', fact: 'weeks', required: true }, { id: 'maternal_contact', label: 'Was a care appointment discussed?', options: ['Yes', 'No'], required: true }] },
    { id: 'tb', version: 1, name: 'TB screening', programme: 'TB screening', purpose: 'Record reported screening information; no diagnosis or official TB registration.', questions: [weight, { id: 'cough', label: 'Does the person report a cough?', options: ['Yes', 'No'], required: true }, { id: 'coughDays', label: 'Cough duration, reported', unit: 'days', fact: 'coughDays', when: { id: 'cough', value: 'Yes' }, required: true }, { id: 'testing', label: 'Is a testing follow-up already arranged?', options: ['Yes', 'No'], required: true }] },
    // Slice 4e: a synthetic, illustrative second maternal version that exercises reviewed open-episode migration.
    // It is not clinically approved; the schedule and escalation text are descriptive and nothing is automated.
    { id: 'maternal', version: 2, name: 'Maternal care', programme: 'Maternal care', purpose: 'Document a locally confirmed pregnancy episode and visit follow-up.', questions: [weight, ...bp, { id: 'weeks', label: 'Gestational age, reported', unit: 'weeks', fact: 'weeks', required: true }, { id: 'appointment_discussed', renamedFrom: 'maternal_contact', label: 'Was the next care appointment discussed?', options: ['Yes', 'No'], required: true }, { id: 'danger_signs_reviewed', label: 'Were pregnancy danger signs discussed with the person?', options: ['Yes', 'No'], required: true }], schedule: 'Illustrative: the worker sets a follow-up within 28 days of each confirmed visit; nothing is scheduled automatically.', escalation: 'Illustrative: a "No" to the danger-sign discussion is shown for clinician review; nothing is escalated automatically.', migratesFrom: [1], changeNote: 'Synthetic illustrative revision for the migration workflow; not clinically approved.' },
    { id: 'hypertension', version: 1, name: 'Hypertension follow-up', programme: 'Chronic care', purpose: 'Record current measurements and reported medication access; no prescribing.', questions: [weight, ...bp, { id: 'medication_access', label: 'Reported access to prescribed medicines', options: ['Available', 'Access difficulty', 'No medicines reported'], required: true }] }
];
export const ABSENCE = ['Unknown', 'Not measured', 'Declined', 'Unable to obtain'];
// Slice 6z (sixth review): answers and absence reasons are keyed by question id. They are read as own properties only,
// so an id that names an Object.prototype member (constructor, toString, valueOf…) can never read a built-in function as
// an answer or an absence reason. Installed manifests also refuse such ids (pack-installation.ts).
export const RESERVED_QUESTION_IDS = new Set(Object.getOwnPropertyNames(Object.prototype));
export const own = (r, k) => r && Object.prototype.hasOwnProperty.call(r, k) ? r[k] : undefined;
export function questions(c) { const found = new Map(); for (const { pack } of c?.packs ?? [])
    for (const q of pack.questions) {
        if (q.when && own(c?.answers, q.when.id) !== q.when.value)
            continue;
        const old = found.get(q.id);
        if (old)
            old.programmes.push(pack.name);
        else
            found.set(q.id, { ...q, programmes: [pack.name] });
    } return [...found.values()]; }
export function unresolved(v) { return questions(v.programmeCapture).filter(q => !String(q.fact ? v.facts[q.fact] : own(v.programmeCapture?.answers, q.id) ?? '').trim() && !own(v.programmeCapture?.absence, q.id)); }
export function captureFor(enrolments, installed) { const all = [...PACKS, ...(installed ?? [])]; return { packs: enrolments.filter(e => e.state === 'active').flatMap(e => { const pack = all.find(p => p.id === e.packId && p.version === e.packVersion); return pack ? [{ enrolmentId: e.id, pack: structuredClone(pack) }] : []; }), answers: {}, absence: {} }; }
export const installedPacks = (s, states = ['active', 'retired']) => (s?.operations?.installedPacks ?? []).filter(x => states.includes(x.state)).map(x => x.pack);
export const enrollablePacks = (s) => [...PACKS, ...installedPacks(s, ['active'])];
export const catalogueOf = (s) => [...PACKS, ...installedPacks(s)];
export const packIds = (s) => [...new Set(enrollablePacks(s).map(p => p.id))];
export const latestVersion = (id, s) => Math.max(0, ...enrollablePacks(s).filter(p => p.id === id).map(p => p.version));
export const packAt = (id, version, s) => catalogueOf(s).find(p => p.id === id && p.version === version);
export const enrollableAt = (id, version, s) => enrollablePacks(s).find(p => p.id === id && p.version === version);
export const packName = (id, s) => catalogueOf(s).filter(p => p.id === id).sort((a, b) => b.version - a.version)[0]?.name ?? id;
// The version new episodes open on: the adopted version while it can open episodes, else the lowest version that can
// (v1 for the compiled packs; the first activated version for an installed pack). 0 when the pack cannot open episodes.
export function adoptedVersion(s, id) { const v = s.operations?.packVersions?.[id]; if (v && enrollableAt(id, v, s))
    return v; const vs = enrollablePacks(s).filter(p => p.id === id).map(p => p.version); return vs.length ? Math.min(...vs) : 0; }
// Prepared work permits documentary capture only; no offline clinical decision or task closure.
export function offlineWorkFor(c) {
    const packs = c?.packs ?? [];
    if (packs.length > 20 || packs.some(x => x.pack.questions.length > 25))
        throw new Error('Prepared programme work exceeds the bounded notebook contract.');
    return { schema: 1, tasks: packs.length ? ['visit-facts', 'programme-answers'] : ['visit-facts'], clinicalApproval: 'pending', packs: packs.map(x => ({ enrolmentId: x.enrolmentId, pack: structuredClone(x.pack) })) };
}
export function conditionMet(v, c) { if (!c)
    return true; const q = questions(v.programmeCapture).find(q => q.id === c.questionId); if (!q)
    return false; const value = String(q.fact ? v.facts[q.fact] : own(v.programmeCapture?.answers, q.id) ?? '').trim(); if (c.operator === 'missing')
    return !value; if (!value)
    return false; if (c.operator === 'eq')
    return value === c.value; return /^-?\d+(\.\d+)?$/.test(value) && Number.isFinite(Number(value)) && (c.operator === 'gte' ? Number(value) >= Number(c.value) : Number(value) <= Number(c.value)); }
export function completionEligible(v, contract, enrolmentId) {
    const cap = v.programmeCapture?.packs.find(x => x.enrolmentId === enrolmentId);
    if (!cap || cap.pack.id !== contract.packId || cap.pack.version !== contract.packVersion || cap.pack.installed?.installationId !== contract.installationId || cap.pack.installed?.manifestHash !== contract.manifestHash)
        return false;
    const rule = cap.pack.completionRules?.find(x => x.id === contract.rule.id);
    if (!rule || JSON.stringify(rule) !== JSON.stringify(contract.rule) || !conditionMet(v, rule.when))
        return false;
    const qs = questions(v.programmeCapture);
    return rule.requiredQuestions.every(id => { const q = qs.find(x => x.id === id); return !!q && !!String(q.fact ? v.facts[q.fact] : own(v.programmeCapture?.answers, id) ?? '').trim() && !own(v.programmeCapture?.absence, id); });
}
export function declaredNeed(pack, id, v) { if (!pack.referralNeeds)
    return null; const d = pack.referralNeeds.find(x => x.id === id); return d && conditionMet(v, d.when) ? d : null; }
export function transitionSuperseded(s, t) { const marker = t.transitionSupersessions?.at(-1); if (!marker)
    return false; const policy = (s.operations?.installedTransitions ?? []).find((x) => x.id === marker.transitionId && x.hash === marker.declarationHash && x.state === 'applied' && x.reviewer && x.reviewer !== x.proposer && x.history.some((h) => h.id === marker.eventId && h.kind === 'applied' && h.at === marker.at && h.by === marker.by && h.reason === marker.reason)); if (!policy || !transitionEffectVerified(s, policy, marker, t.id))
    return false; const person = s.workspace.people.find(p => p.followUps?.some(x => x.id === t.id)); const replacement = person?.followUps?.find(x => x.id === marker.replacementId), origin = replacement?.transitionOrigin; return !!person && !!replacement && transitionReplacementVerified(s, replacement, person.id) && person.id === marker.personId && marker.teamId === policy.teamId && origin?.personId === person?.id && origin.teamId === marker.teamId && origin?.transitionId === policy.id && origin.declarationHash === policy.hash && origin.eventId === marker.eventId && origin.originalId === t.id && origin.originalHash === marker.originalHash; }
export function followUpOpen(s, t) { if (transitionSuperseded(s, t))
    return false; if (t.state === 'open')
    return true; if (t.state !== 'completed')
    return false; const evidence = t.completionReplacements?.at(-1) ?? t.completionEvidence; if (!evidence)
    return false; const v = s.workspace.visits.find(x => x.id === evidence.visitId); return !v || v.state !== 'confirmed' || !!v.voidedAt || !!v.supersededBy; }
