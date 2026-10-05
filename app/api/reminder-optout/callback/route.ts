import {reminderOptoutCallback} from '@/lib/saha/reminder-optout-server';
import {error} from '@/lib/saha/server';
export async function POST(request:Request){try{return await reminderOptoutCallback(request);}catch(e){return error(e);}}
