import { facilityScopeRead } from '@/lib/saha/facility-scope-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
export async function GET(request:Request){return measured(request,'facility-scope',async()=>{try{return await facilityScopeRead(request);}catch(e){return error(e);}});}
