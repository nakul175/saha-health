import {availabilityRead,availabilityProbe} from '@/lib/saha/availability-server';
import {error} from '@/lib/saha/server';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{return await availabilityRead(request);}catch(e){return error(e);}}
export async function POST(request:Request){try{return await availabilityProbe(request);}catch(e){return error(e);}}
