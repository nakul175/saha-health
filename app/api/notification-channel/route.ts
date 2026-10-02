import { notificationChannelRead } from '@/lib/saha/notification-channel-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
// Slice 10b: the owner's notification channel (demonstration simulator): settings, escalation schedule and message log. Changes are the `setNotificationChannel` command.
export async function GET(request:Request){return measured(request,'notification-channel',async()=>{try{return await notificationChannelRead(request);}catch(e){return error(e);}});}
