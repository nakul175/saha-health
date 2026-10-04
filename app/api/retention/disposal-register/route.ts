import { disposalRegisterRead } from '@/lib/saha/disposal-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
// Slice 14f: owners download the organisation's disposal register to keep beside its backups.
export async function GET(request:Request){return measured(request,'retention-disposal-register',async()=>{try{return await disposalRegisterRead(request);}catch(e){return error(e);}});}
