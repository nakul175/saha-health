// Slice 10f: referral needs identified by programme packs (BR-PROG-05, BR-CARE-05). Constants and types only, so the
// client can import them. The catalogue is a local default, not a clinically approved list: a worker names which need
// each programme episode on a confirmed visit raised, and the server treats two requests as the same need only when
// the need code (or, for "other", the named need), the facility and the visit all match.
export const NEED_IDS = ['antenatal-review', 'tb-testing', 'blood-pressure-review', 'nutrition-review', 'medicine-access', 'danger-sign-review', 'other'] as const;
export type NeedId = typeof NEED_IDS[number];
export const NEED_LABEL: Record<NeedId, string> = {
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
// The need a referral records, and each programme episode that asked for it (kept after the referral is created).
export type ReferralNeed = { code: NeedId; label: string; declarationGroup?:string; compatibilityKey?:string|null };
export type PackRequest = { id: string; enrolmentId: string; packId: string; packVersion: number; packName: string; episodeLabel: string; reason: string; sourceId: string; requestedBy: string; requestedAt: string; declaration?:{id:string;compatibilityKey:string|null;urgency:import('./referral-rules').Urgency;manifestHash:string} };
export const normText = (s: string) => s.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
// Two requests are the same need when this key matches (and they come from the same confirmed visit of the same person).
export const needKey = (code: string, label: string, facility: string) => [code, code === 'other' ? normText(label) : '', normText(facility)].join('|');
