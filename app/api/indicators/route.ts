import { indicatorsPost, indicatorsRead } from '@/lib/saha/indicators-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
export async function GET(request:Request){return measured(request,'indicators',async()=>{try{return await indicatorsRead(request);}catch(e){return error(e);}});}
export async function POST(request:Request){return measured(request,'indicators',async()=>{try{return await indicatorsPost(request);}catch(e){return error(e);}});}
