import { patientDetailRead } from '@/lib/saha/patient-directory-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
export async function GET(request:Request){return measured(request,'patient-detail',async()=>{try{return await patientDetailRead(request);}catch(e){return error(e);}});}
