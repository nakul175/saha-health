import {burdenPolicy} from '@/lib/saha/work-burden-server';
import {error} from '@/lib/saha/server';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{return await burdenPolicy(request);}catch(e){return error(e);}}
