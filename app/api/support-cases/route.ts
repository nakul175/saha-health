import {supportCaseRead} from '@/lib/saha/support-case-server';
import {error} from '@/lib/saha/server';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{return await supportCaseRead(request);}catch(e){return error(e);}}
