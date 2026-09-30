import { dataExitRead } from '@/lib/saha/data-exit-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
export async function GET(request:Request){return measured(request,'data-exit',async()=>{try{return await dataExitRead(request);}catch(e){return error(e);}});}
