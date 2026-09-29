import { identity, loadFor, json } from './server';
import { fail } from './core';
import { scope } from './store';
import { exceptionalView } from './exceptional';
// Slice 6a: the viewer's emergency-access grants and the grants they may review.
export async function exceptionalRead(request:Request){
 const u=await identity(),s=await loadFor(u,request.headers.get('x-saha-organisation')),m=scope(s,u.userId);
 if(m.role==='admin')fail(403,'Patient access is required.');
 return json(exceptionalView(s,m));
}
