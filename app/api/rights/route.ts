import { rightsRead } from '@/lib/saha/rights-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
export async function GET(request:Request){return measured(request,'rights',async()=>{try{return await rightsRead(request);}catch(e){return error(e);}});}
