import {workSupportRead,workSupportWrite} from '@/lib/saha/work-support-server';
import {error} from '@/lib/saha/server';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{return await workSupportRead(request);}catch(e){return error(e);}}
export async function POST(request:Request){try{return await workSupportWrite(request);}catch(e){return error(e);}}
