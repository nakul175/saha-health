import { importedEvidenceRead,importedEvidenceWrite } from '@/lib/saha/imported-evidence-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
export async function GET(request:Request){return measured(request,'record-import',async()=>{try{return await importedEvidenceRead(request);}catch(e){return error(e);}});}
export async function POST(request:Request){return measured(request,'record-import',async()=>{try{return await importedEvidenceWrite(request);}catch(e){return error(e);}});}
