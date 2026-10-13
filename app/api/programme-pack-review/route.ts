import {programmePackReviewRead} from '@/lib/saha/programme-pack-review-server';
import {error} from '@/lib/saha/server';
import {measured} from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
export async function GET(request:Request){return measured(request,'pack-installations',async()=>{try{return await programmePackReviewRead(request);}catch(e){return error(e);}});}
