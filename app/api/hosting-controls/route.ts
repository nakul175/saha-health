import {hostingControlsRead} from '@/lib/saha/hosting-controls-server';
import {error} from '@/lib/saha/server';
import {measured} from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
export async function GET(request:Request){return measured(request,'hosting-controls',async()=>{try{return await hostingControlsRead(request);}catch(e){return error(e);}});}
