import { identity, loadFor, json } from './server';
import { scope } from './store';
import { escalationQueue } from './referrals';
// Slice 4a: open referrals needing attention in the viewer's scope (viewer-scoped read).
export async function escalationsRead(request:Request){
 const u=await identity(),s=await loadFor(u,request.headers.get('x-saha-organisation'),undefined,true),m=scope(s,u.userId);
 return json(escalationQueue(s,m));
}
