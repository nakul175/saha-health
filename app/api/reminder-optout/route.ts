import {reminderOptoutSimulate} from '@/lib/saha/reminder-optout-server';
import {error} from '@/lib/saha/server';
export const dynamic='force-dynamic';
export async function POST(request:Request){try{return await reminderOptoutSimulate(request);}catch(e){return error(e);}}
