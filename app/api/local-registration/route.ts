import {localRegistrationRead,localRegistrationWrite} from '@/lib/saha/local-registration-server';
import {error} from '@/lib/saha/server';
import {measured} from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
export async function GET(request:Request){return measured(request,'patients',async()=>{try{return await localRegistrationRead(request);}catch(e){return error(e);}});}
export async function POST(request:Request){return measured(request,'commands',async()=>{try{return await localRegistrationWrite(request);}catch(e){return error(e);}});}
