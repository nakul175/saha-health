import { command, json, error } from '@/lib/saha/server';
export async function POST(request:Request){try{return json(await command(request));}catch(e){return error(e);}}
