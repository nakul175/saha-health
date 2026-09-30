import { workerActivityRead } from '@/lib/saha/worker-activity-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
export async function GET(request:Request){return measured(request,'worker-activity',async()=>{try{return await workerActivityRead(request);}catch(e){return error(e);}});}
