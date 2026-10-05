import { discardUnreadMedia } from '@/lib/saha/media';
import { mediaFile, removeMedia } from '@/lib/saha/media-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){return measured(request,'media',async()=>{try{return await mediaFile(request,(await params).id);}catch(e){return error(e);}});}
export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}){return measured(request,'media',async()=>{try{return await removeMedia(request,(await params).id);}catch(e){return error(e);}finally{await discardUnreadMedia(request);}});}
