import { capabilityRegistrationRead,capabilityRegistrationWrite } from '@/lib/saha/capability-registration-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
export async function GET(request:Request){return measured(request,'governance',async()=>{try{return await capabilityRegistrationRead(request);}catch(e){return error(e);}});}
export async function POST(request:Request){return measured(request,'governance',async()=>{try{return await capabilityRegistrationWrite(request);}catch(e){return error(e);}});}
