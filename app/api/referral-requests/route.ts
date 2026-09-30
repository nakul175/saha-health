import { referralRequestsRead } from '@/lib/saha/referral-request-queue-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
export async function GET(request:Request){return measured(request,'referral-requests',async()=>{try{return await referralRequestsRead(request);}catch(e){return error(e);}});}
