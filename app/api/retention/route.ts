import { retentionRead,retentionWrite } from '@/lib/saha/retention-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
export async function GET(request:Request){return measured(request,'retention',async()=>{try{return await retentionRead(request);}catch(e){return error(e);}});}
export async function POST(request:Request){return measured(request,'retention',async()=>{try{return await retentionWrite(request);}catch(e){return error(e);}});}
