import { exceptionalRead } from '@/lib/saha/exceptional-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
export async function GET(request:Request){return measured(request,'exceptional',async()=>{try{return await exceptionalRead(request);}catch(e){return error(e);}});}
