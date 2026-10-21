// Slice 10f: referral needs identified by programme packs (BR-PROG-05, BR-CARE-05). Constants and types only, so the
// client can import them. The catalogue is a local default, not a clinically approved list: a worker names which need
// each programme episode on a confirmed visit raised, and the server treats two requests as the same need only when
// the need code (or, for "other", the named need), the facility and the visit all match.
export const NEED_IDS = ['antenatal-review', 'tb-testing', 'blood-pressure-review', 'nutrition-review', 'medicine-access', 'danger-sign-review', 'other'];
export const NEED_LABEL = {
    'antenatal-review': 'Antenatal review',
    'tb-testing': 'TB testing',
    'blood-pressure-review': 'Blood pressure review',
    'nutrition-review': 'Nutrition review',
    'medicine-access': 'Medicine access',
    'danger-sign-review': 'Danger-sign review',
    other: 'Other need (named)',
};
export const MAX_PACK_REQUESTS = 20;
export const MAX_REQUESTS_PER_COMMAND = 12;
export const normText = (s) => s.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
// Two requests are the same need when this key matches (and they come from the same confirmed visit of the same person).
export const needKey = (code, label, facility) => [code, code === 'other' ? normText(label) : '', normText(facility)].join('|');
