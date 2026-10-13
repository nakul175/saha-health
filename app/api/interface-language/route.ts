import { interfaceLanguageRead, interfaceLanguageWrite } from '@/lib/saha/interface-language-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';
export const dynamic = 'force-dynamic';
export async function GET(request:Request) {
  return measured(request,'patients',async()=>{try{return await interfaceLanguageRead(request);}catch(cause){return error(cause);}});
}
export async function POST(request:Request) {
  return measured(request,'commands',async()=>{try{return await interfaceLanguageWrite(request);}catch(cause){return error(cause);}});
}
