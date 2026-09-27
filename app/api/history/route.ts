import { measured } from '@/lib/saha/monitoring';
import { patientHistory, json, error } from '@/lib/saha/server';
export const dynamic='force-dynamic';
export async function GET(request:Request){return measured(request,'history',async()=>{try{return json(await patientHistory(request));}catch(e){return error(e);}});}
