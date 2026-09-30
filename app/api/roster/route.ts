import { rosterPreview } from '@/lib/saha/roster-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
export async function POST(request:Request){return measured(request,'roster',async()=>{try{return await rosterPreview(request);}catch(e){return error(e);}});}
