import {serviceAuthorityRead} from '@/lib/saha/service-authority-review-server';
import {error} from '@/lib/saha/server';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{return await serviceAuthorityRead(request);}catch(e){return error(e);}}
