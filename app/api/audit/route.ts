import { organisationAudit, json, error } from '@/lib/saha/server';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{return json(await organisationAudit(request));}catch(e){return error(e);}}
