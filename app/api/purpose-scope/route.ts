import { purposeScopeRead } from '@/lib/saha/purpose-scope-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
export async function GET(request:Request){return measured(request,'purpose-scope',async()=>{try{return await purposeScopeRead(request);}catch(e){return error(e);}});}
