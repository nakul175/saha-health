import {screeningsWrite} from '@/lib/saha/anaemia-server';
import {error} from '@/lib/saha/server';
import {measured} from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
export async function POST(request:Request){return measured(request,'anaemia-screenings',async()=>{try{return await screeningsWrite(request);}catch(e){return error(e);}});}
