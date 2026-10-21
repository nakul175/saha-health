import { identity, loadFor, json } from './server.js';
import { scope } from './store.js';
import { referralRequestQueue } from './referral-request-queue.js';
// Slice 3i: open field referral requests for the viewer (organisation read, filtered by viewer scope).
export async function referralRequestsRead(request) {
    const u = await identity(), s = await loadFor(u, request.headers.get('x-saha-organisation')), m = scope(s, u.userId);
    return json(referralRequestQueue(s, m));
}
