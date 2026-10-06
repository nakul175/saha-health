import {discardUnreadRequest} from '@/lib/saha/request-discard';
import {inboundRead,inboundWrite} from '@/lib/saha/inbound-conflicts-server';
import {error} from '@/lib/saha/server';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{return await inboundRead(request);}catch(e){return error(e);}}
export async function POST(request:Request){try{return await inboundWrite(request);}catch(e){return error(e);}finally{await discardUnreadRequest(request);}}
