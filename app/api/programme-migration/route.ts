import { programmeMigrationRead } from '@/lib/saha/programme-migration-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
export async function GET(request:Request){return measured(request,'programme-migration',async()=>{try{return await programmeMigrationRead(request);}catch(e){return error(e);}});}
