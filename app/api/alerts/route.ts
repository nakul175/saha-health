import { alertInbox } from '@/lib/saha/alert-delivery-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
// Slice 6v: the signed-in member's in-app alert notifications (bell). Marking read is the `alertInboxMarkRead` command.
export async function GET(request:Request){return measured(request,'alerts',async()=>{try{return await alertInbox(request);}catch(e){return error(e);}});}
