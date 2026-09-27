import { measured } from '@/lib/saha/monitoring';
import { snapshot, json, error } from '@/lib/saha/server';
export const dynamic='force-dynamic';
export async function GET(request:Request){return measured(request,'workspace',async()=>{try{return json(await snapshot(request));}catch(e){return error(e);}});}
