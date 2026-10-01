import { importRejections } from '@/lib/saha/record-import-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
export async function POST(request:Request){return measured(request,'import-rejections',async()=>{try{return await importRejections(request);}catch(e){return error(e);}});}
