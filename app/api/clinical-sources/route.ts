import {stageClinicalSource,readClinicalSource} from '@/lib/saha/clinical-source-server';
import {error} from '@/lib/saha/server';
import {measured} from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
export async function POST(request:Request){return measured(request,'clinical-sources',async()=>{try{return await stageClinicalSource(request);}catch(e){return error(e);}});}
export async function GET(request:Request){return measured(request,'clinical-sources',async()=>{try{return await readClinicalSource(request);}catch(e){return error(e);}});}
