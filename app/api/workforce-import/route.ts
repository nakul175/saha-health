import { workforceImportDryRun } from '@/lib/saha/workforce-import-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
export async function POST(request:Request){return measured(request,'workforce-import',async()=>{try{return await workforceImportDryRun(request);}catch(e){return error(e);}});}
