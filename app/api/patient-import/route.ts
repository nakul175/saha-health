import { patientImportDryRun } from '@/lib/saha/patient-import-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
export async function POST(request:Request){return measured(request,'patient-import',async()=>{try{return await patientImportDryRun(request);}catch(e){return error(e);}});}
