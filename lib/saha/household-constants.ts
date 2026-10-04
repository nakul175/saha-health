// Slice 1: household vocabularies shared by the server and the client (no server imports).
export const RELATIONSHIPS = ['head', 'spouse', 'partner', 'child', 'parent', 'sibling', 'grandparent', 'grandchild', 'other-relative', 'caregiver', 'other'] as const;
// Slice 14b: purposes a grant may name. The first four let a household member receive information (the slice 1 sharing
// purposes, used by the sharing preview); the last two let a representative act for the person: record or withdraw a
// consent decision, and make a rights request.
export const SHARING_PURPOSES = ['appointments', 'care-coordination', 'medicines', 'referral-follow-up'] as const;
export const ACTING_PURPOSES = ['consent-decisions', 'rights-requests'] as const;
export const PURPOSES = [...SHARING_PURPOSES, ...ACTING_PURPOSES] as const;
export const SENSITIVE = ['maternal', 'tb', 'adolescent', 'child'] as const;
// Slice 14b: the relationship a grant records is between two people: the representative is the person's spouse, parent,
// child and so on. A household role such as 'head' says nothing about that, so it is not accepted on a grant.
export const PERSON_RELATIONSHIPS = ['spouse', 'partner', 'child', 'parent', 'sibling', 'grandparent', 'grandchild', 'other-relative', 'caregiver', 'other'] as const;
// Slice 14b: the authority a grant rests on, recorded separately from the relationship (BR-SEC-04).
//  parent-of-minor          a parent of a person under 18 (ends when the person's recorded age reaches 18)
//  legal-guardian           a guardian appointed by a court or under law; the evidence reference names the order
//  nominated                nominated by the person, an adult not recorded as lacking capacity when they nominate
//  capacity-representative  for an adult recorded as lacking capacity to decide; in force only while that record stands
export const AUTHORITIES = ['parent-of-minor', 'legal-guardian', 'nominated', 'capacity-representative'] as const;
export const AUTHORITY_LABEL: Record<typeof AUTHORITIES[number], string> = {
  'parent-of-minor': 'Parent of a person under 18',
  'legal-guardian': 'Legal guardian (court order or law)',
  nominated: 'Nominated by the person',
  'capacity-representative': 'Representative of an adult who lacks capacity',
};
export const CAPACITY_STATES = ['lacks-capacity', 'has-capacity'] as const;
// Local defaults, not jurisdiction-approved policy.
export const ADULT_AGE = 18, MAX_START_DAYS = 90, MAX_GRANT_DAYS = 365;
