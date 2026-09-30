import { exceptionsRead } from '@/lib/saha/exceptions-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
export async function GET(request:Request){return measured(request,'exceptions',async()=>{try{return await exceptionsRead(request);}catch(e){return error(e);}});}
