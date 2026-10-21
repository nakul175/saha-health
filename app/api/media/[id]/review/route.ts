import { discardUnreadMedia } from '@/lib/saha/media';
import { reviewMedia } from '@/lib/saha/media-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';

export const runtime='edge';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){return measured(request,'media',async()=>{try{return await reviewMedia(request,(await params).id);}catch(e){return error(e);}finally{await discardUnreadMedia(request);}});}
