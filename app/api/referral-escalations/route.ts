import { escalationsRead } from '@/lib/saha/referrals-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
export async function GET(request:Request){return measured(request,'referral-escalations',async()=>{try{return await escalationsRead(request);}catch(e){return error(e);}});}
