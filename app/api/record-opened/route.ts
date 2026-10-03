import { recordOpenedPost } from '@/lib/saha/record-opened-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
export async function POST(request:Request){return measured(request,'record-opened',async()=>{try{return await recordOpenedPost(request);}catch(e){return error(e);}});}
