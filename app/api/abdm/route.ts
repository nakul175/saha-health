import { abdmRead } from '@/lib/saha/abdm-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
export async function GET(request:Request){return measured(request,'abdm',async()=>{try{return await abdmRead(request);}catch(e){return error(e);}});}
