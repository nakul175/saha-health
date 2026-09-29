import { mergeRead } from '@/lib/saha/merge-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
export async function GET(request:Request){return measured(request,'identity-cases',async()=>{try{return await mergeRead(request);}catch(e){return error(e);}});}
