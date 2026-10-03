import {providerRead,providerWrite} from '@/lib/saha/anaemia-server';
import {error} from '@/lib/saha/server';
import {measured} from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
export async function GET(request:Request){return measured(request,'anaemia-provider',async()=>{try{return await providerRead(request);}catch(e){return error(e);}});}
export async function POST(request:Request){return measured(request,'anaemia-provider',async()=>{try{return await providerWrite(request);}catch(e){return error(e);}});}
