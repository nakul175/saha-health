import {burdenAttribution,burdenAttributionReport} from '@/lib/saha/work-burden-attribution-server';
import {error} from '@/lib/saha/server';
export const dynamic='force-dynamic';
export async function POST(request:Request){try{return await burdenAttribution(request);}catch(e){return error(e);}}
export async function GET(request:Request){try{return await burdenAttributionReport(request);}catch(e){return error(e);}}
