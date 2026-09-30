import { identity, loadFor, json } from './server';
import { scope } from './store';
import { exceptionQueue } from './exceptions';
// Slice 6i: item-level exception queue for the viewer (organisation read, filtered by viewer scope).
export async function exceptionsRead(request:Request){
 const u=await identity(),s=await loadFor(u,request.headers.get('x-saha-organisation')),m=scope(s,u.userId);
 return json(exceptionQueue(s,m));
}
