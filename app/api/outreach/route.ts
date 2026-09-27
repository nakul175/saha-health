import { outreachRead } from '@/lib/saha/outreach-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
export async function GET(request:Request){return measured(request,'outreach',async()=>{try{return await outreachRead(request);}catch(e){return error(e);}});}
