import { matchesRead } from '@/lib/saha/continuity-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
export async function POST(request:Request){return measured(request,'patient-matches',async()=>{try{return await matchesRead(request);}catch(e){return error(e);}});}
