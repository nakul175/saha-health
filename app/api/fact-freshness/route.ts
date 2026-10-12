import { factFreshnessRead } from '@/lib/saha/fact-freshness-server';
import { error } from '@/lib/saha/server';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{return await factFreshnessRead(request);}catch(e){return error(e);}}
