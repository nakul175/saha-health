import { identifierSearch } from '@/lib/saha/identifier-search-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
export async function POST(request:Request){return measured(request,'identifier-search',async()=>{try{return await identifierSearch(request);}catch(e){return error(e);}});}
