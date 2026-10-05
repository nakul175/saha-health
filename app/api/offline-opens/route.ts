import {identity,db,json,error} from '@/lib/saha/server';
import {boundedJsonBody} from '@/lib/saha/request-body';
import {reportOfflineOpens} from '@/lib/saha/offline-opens';
export const dynamic='force-dynamic';
export async function POST(request:Request){try{
 const u=await identity();
 if(request.headers.get('sec-fetch-site')==='cross-site'||request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Same-origin request required.'},403);
 if(request.headers.get('content-type')?.split(';')[0]!=='application/json')return json({error:'Use fixed offline report JSON.'},415);
 if(new URL(request.url).search)return json({error:'Offline report query fields are not supported.'},422);
 return json(await reportOfflineOpens(db(),u,request.headers.get('x-saha-organisation')??'',await boundedJsonBody(request,12000,262144)));
 }catch(e){return error(e);}finally{
 // Business input stays limited to 12000 bytes; transport disposal uses the existing
 // measured-request 256KiB bound, including oversized unauthenticated refusals.
 // Consume a bounded refused body so an authenticated keep-alive connection
 // cannot confuse a later metadata upload with the rejected request.
 if(request.body&&!request.bodyUsed){try{const reader=request.body.getReader();let bytes=0;while(bytes<262144){const chunk=await reader.read();if(chunk.done)break;bytes+=chunk.value.byteLength;}await reader.cancel();}catch{/* request already closed */}}
 }}
