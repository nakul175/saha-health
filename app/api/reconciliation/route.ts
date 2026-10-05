import { reconciliationRead } from '@/lib/saha/reconciliation-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
export async function POST(request:Request){return measured(request,'reconciliation',async()=>{try{return await reconciliationRead(request);}catch(e){return error(e);}});}
