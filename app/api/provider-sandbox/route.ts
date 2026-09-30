import { providerSandboxRead } from '@/lib/saha/provider-sandbox-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
export async function GET(request:Request){return measured(request,'provider-sandbox',async()=>{try{return await providerSandboxRead(request);}catch(e){return error(e);}});}
