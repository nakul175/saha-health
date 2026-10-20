import { prioritisationRead } from '@/lib/saha/prioritisation-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
export async function GET(request:Request){return measured(request,'prioritisation',async()=>{try{return await prioritisationRead(request);}catch(e){return error(e);}});}
