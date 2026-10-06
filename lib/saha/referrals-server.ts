import { db, identity, loadFor, json } from './server';
import { scope } from './store';
import { escalationQueue } from './referrals';
import { recordPatientWorkView } from './read-audit';
// Slice 4a: open referrals needing attention in the viewer's scope (viewer-scoped read).
export async function escalationsRead(request:Request){
 const u=await identity(),s=await loadFor(u,request.headers.get('x-saha-organisation'),undefined,true),m=scope(s,u.userId);
 const result=escalationQueue(s,m);
 await recordPatientWorkView(db(),s,u,m,'referral escalations',result.items.length);
 return json(result);
}
