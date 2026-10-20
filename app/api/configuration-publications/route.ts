import {configurationPublicationPost,configurationPublicationRead} from '@/lib/saha/configuration-publication-server';
import {error} from '@/lib/saha/server';
import {measured} from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
export async function GET(request:Request){return measured(request,'configuration-publications',async()=>{try{return await configurationPublicationRead(request);}catch(e){return error(e);}});}
export async function POST(request:Request){return measured(request,'configuration-publications',async()=>{try{return await configurationPublicationPost(request);}catch(e){return error(e);}});}
