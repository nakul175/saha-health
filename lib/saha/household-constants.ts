// Slice 1: household vocabularies shared by the server and the client (no server imports).
export const RELATIONSHIPS = ['head', 'spouse', 'partner', 'child', 'parent', 'sibling', 'grandparent', 'grandchild', 'other-relative', 'caregiver', 'other'] as const;
export const PURPOSES = ['appointments', 'care-coordination', 'medicines', 'referral-follow-up'] as const;
export const SENSITIVE = ['maternal', 'tb', 'adolescent', 'child'] as const;
