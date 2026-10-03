import {connectionTest} from '@/lib/saha/frontline-server';
import {error} from '@/lib/saha/server';
import {measured} from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
export async function POST(r:Request){return measured(r,'frontline-providers',async()=>{try{return await connectionTest(r);}catch(e){return error(e);}});}
