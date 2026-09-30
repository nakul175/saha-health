import { delegationsRead } from '@/lib/saha/delegation-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
export async function GET(request:Request){return measured(request,'delegations',async()=>{try{return await delegationsRead(request);}catch(e){return error(e);}});}
