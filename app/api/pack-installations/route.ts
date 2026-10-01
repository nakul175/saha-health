import { packInstallationRead } from '@/lib/saha/pack-installation-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
export async function GET(request:Request){return measured(request,'pack-installations',async()=>{try{return await packInstallationRead(request);}catch(e){return error(e);}});}
