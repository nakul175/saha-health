import { fixtureMigrationRead } from '@/lib/saha/fixture-migration-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
export async function GET(request:Request){return measured(request,'fixture-migration',async()=>{try{return await fixtureMigrationRead(request);}catch(e){return error(e);}});}
