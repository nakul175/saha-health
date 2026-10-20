import {sharedQuestionRead} from '@/lib/saha/shared-question-review-server';
import {error} from '@/lib/saha/server';
import {measured} from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
export async function GET(request:Request){return measured(request,'history',async()=>{try{return await sharedQuestionRead(request);}catch(cause){return error(cause);}});}
