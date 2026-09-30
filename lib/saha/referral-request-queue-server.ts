import { identity, loadFor, json } from './server';
import { scope } from './store';
import { referralRequestQueue } from './referral-request-queue';
// Slice 3i: open field referral requests for the viewer (organisation read, filtered by viewer scope).
export async function referralRequestsRead(request:Request){
 const u=await identity(),s=await loadFor(u,request.headers.get('x-saha-organisation')),m=scope(s,u.userId);
 return json(referralRequestQueue(s,m));
}
