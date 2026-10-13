import { recordMatchingSetup,recordMatchingRead } from '@/lib/saha/record-matching-server';
import { error } from '@/lib/saha/server';
export const dynamic='force-dynamic';
export async function GET(r:Request){try{return await recordMatchingSetup(r);}catch(e){return error(e);}}
export async function POST(r:Request){try{return await recordMatchingRead(r);}catch(e){return error(e);}}
