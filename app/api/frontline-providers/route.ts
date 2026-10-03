import {providersRead,providersWrite} from '@/lib/saha/frontline-server';
import {error} from '@/lib/saha/server';
import {measured} from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
export async function GET(r:Request){return measured(r,'frontline-providers',async()=>{try{return await providersRead(r);}catch(e){return error(e);}});}
export async function POST(r:Request){return measured(r,'frontline-providers',async()=>{try{return await providersWrite(r);}catch(e){return error(e);}});}
