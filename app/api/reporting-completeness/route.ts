import {completenessRead,completenessPost} from '@/lib/saha/reporting-completeness-server';
import {error} from '@/lib/saha/server';
import {measured} from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
export async function GET(r:Request){return measured(r,'indicators',async()=>{try{return await completenessRead(r);}catch(e){return error(e);}});}
export async function POST(r:Request){return measured(r,'indicators',async()=>{try{return await completenessPost(r);}catch(e){return error(e);}});}
