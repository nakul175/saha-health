import { householdRead } from '@/lib/saha/household-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
export async function GET(request:Request){return measured(request,'household',async()=>{try{return await householdRead(request);}catch(e){return error(e);}});}
