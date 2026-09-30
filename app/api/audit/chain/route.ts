import { auditChainRead } from '@/lib/saha/audit-chain-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
export async function GET(request:Request){return measured(request,'audit-chain',async()=>{try{return await auditChainRead(request);}catch(e){return error(e);}});}
