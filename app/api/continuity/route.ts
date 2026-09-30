import { continuityRead } from '@/lib/saha/continuity-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
export async function GET(request:Request){return measured(request,'continuity',async()=>{try{return await continuityRead(request);}catch(e){return error(e);}});}
