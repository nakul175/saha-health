import { discardUnreadMedia } from '@/lib/saha/media';
import { uploadMedia, mediaCapabilities } from '@/lib/saha/media-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
export async function POST(request:Request){return measured(request,'media',async()=>{try{return await uploadMedia(request);}catch(e){return error(e);}finally{await discardUnreadMedia(request);}});}

export async function GET(request:Request){return measured(request,'media',async()=>{try{return await mediaCapabilities(request);}catch(e){return error(e);}});}
