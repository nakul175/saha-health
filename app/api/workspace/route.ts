import { snapshot, json, error } from '@/lib/saha/server';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{return json(await snapshot(request));}catch(e){return error(e);}}
