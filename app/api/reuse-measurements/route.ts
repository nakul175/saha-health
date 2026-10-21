import {reuseMeasurementsRead,reuseMeasurementsView} from '@/lib/saha/reuse-measurements-server';
import {error} from '@/lib/saha/server';
import {measured} from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
export async function GET(request:Request){return measured(request,'indicators',async()=>{try{return await reuseMeasurementsRead(request);}catch(cause){return error(cause);}});}
export async function POST(request:Request){return measured(request,'indicators',async()=>{try{return await reuseMeasurementsView(request);}catch(cause){return error(cause);}});}
