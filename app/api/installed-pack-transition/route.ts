import {transitionRead,transitionWrite} from '@/lib/saha/installed-pack-transition-server';
import {error} from '@/lib/saha/server';
import {measured} from '@/lib/saha/monitoring';
import {discardUnreadRequest} from '@/lib/saha/request-discard';
export const dynamic='force-dynamic';
export async function GET(request:Request){return measured(request,'pack-installations',async()=>{try{return await transitionRead(request);}catch(e){return error(e);}});}
export async function POST(request:Request){return measured(request,'pack-installations',async()=>{try{return await transitionWrite(request);}catch(e){return error(e);}finally{await discardUnreadRequest(request);}});}
