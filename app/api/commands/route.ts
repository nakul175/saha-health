import { measured } from '@/lib/saha/monitoring';
import { command, json, error } from '@/lib/saha/server';
export async function POST(request:Request){return measured(request,'commands',async()=>{try{return json(await command(request));}catch(e){return error(e);}});}
