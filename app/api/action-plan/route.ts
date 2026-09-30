import { actionPlanRead } from '@/lib/saha/action-plan-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
export async function GET(request:Request){return measured(request,'action-plan',async()=>{try{return await actionPlanRead(request);}catch(e){return error(e);}});}
