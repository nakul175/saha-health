import { fieldDeviceRead, fieldDeviceWrite } from '@/lib/saha/field-device-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
// Slice 14e: field notebook removal orders and receipts, sync failure reports, and the Operations view of field devices.
export async function GET(request:Request){return measured(request,'field-device',async()=>{try{return await fieldDeviceRead(request);}catch(e){return error(e);}});}
export async function POST(request:Request){return measured(request,'field-device',async()=>{try{return await fieldDeviceWrite(request);}catch(e){return error(e);}});}
