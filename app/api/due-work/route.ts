import {dueWorkRead} from '@/lib/saha/due-work-server';
import {error} from '@/lib/saha/server';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{return await dueWorkRead(request);}catch(e){return error(e);}}
