import {burdenRead,burdenEvent} from '@/lib/saha/work-burden-server';
import {error} from '@/lib/saha/server';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{return await burdenRead(request);}catch(e){return error(e);}}
export async function POST(request:Request){try{return await burdenEvent(request);}catch(e){return error(e);}finally{
 // Early sign-in/scope/origin refusals must consume a bounded body so a reused
 // connection closes cleanly. This is transport hygiene, not telemetry.
 if(request.body&&!request.bodyUsed){try{const reader=request.body.getReader();let bytes=0;while(bytes<513){const c=await reader.read();if(c.done)break;bytes+=c.value.byteLength;}await reader.cancel();}catch{/* request already closed */}}
}}
