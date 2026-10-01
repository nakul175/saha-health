import { worklistsRead } from '@/lib/saha/worklists-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
export async function GET(request:Request){return measured(request,'worklists',async()=>{try{return await worklistsRead(request);}catch(e){return error(e);}});}
