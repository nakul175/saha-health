// Slice 10f: household visit slots (BR-PROG-05). Constants only, so the client can import them.
export const VISIT_WINDOWS = ['morning', 'afternoon', 'evening', 'any'];
// Cancellation reasons are a closed list on purpose: a slot is read by every worker who can see any covered member,
// so it carries no free text that could describe one member to a worker who may not see them.
export const CANCEL_REASONS = ['household-unavailable', 'worker-unavailable', 'members-changed', 'rescheduled', 'no-longer-needed'];
export const ITEM_KINDS = ['follow-up', 'referral', 'home-visit'];
export const MAX_COVERS = 30, MAX_ITEMS = 20, MAX_PLANNED = 10, MAX_SLOTS = 100, MAX_AHEAD_DAYS = 90;
