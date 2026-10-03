import {connectionTest} from '@/lib/saha/anaemia-server';
import {error} from '@/lib/saha/server';
import {measured} from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
export async function POST(request:Request){return measured(request,'anaemia-provider',async()=>{try{return await connectionTest(request);}catch(e){return error(e);}});}
