import { caseloadRead } from '@/lib/saha/caseload-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
export async function GET(request:Request){return measured(request,'caseload',async()=>{try{return await caseloadRead(request);}catch(e){return error(e);}});}
