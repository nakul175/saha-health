import { aggregateReportsRead } from '@/lib/saha/aggregate-reports-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
export async function GET(request:Request){return measured(request,'aggregate-reports',async()=>{try{return await aggregateReportsRead(request);}catch(e){return error(e);}});}
