import { incentiveRead } from '@/lib/saha/incentives-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
export async function GET(request:Request){return measured(request,'incentive-claims',async()=>{try{return await incentiveRead(request);}catch(e){return error(e);}});}
