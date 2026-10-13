import { householdProxyRead } from '@/lib/saha/household-proxy-review-server';
import { error } from '@/lib/saha/server';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{return await householdProxyRead(request);}catch(e){return error(e);}}
