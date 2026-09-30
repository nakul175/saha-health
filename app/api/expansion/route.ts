import { expansionRead } from '@/lib/saha/outreach-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
export async function GET(request:Request){return measured(request,'expansion',async()=>{try{return await expansionRead(request);}catch(e){return error(e);}});}
