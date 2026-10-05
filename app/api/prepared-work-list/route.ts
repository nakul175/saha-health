import { error } from '@/lib/saha/server';
import { discardUnreadRequest } from '@/lib/saha/request-discard';
import { preparedWorkRead, preparedWorkWrite } from '@/lib/saha/prepared-work-list-server';
export async function GET(request:Request){try{return await preparedWorkRead(request);}catch(e){return error(e);}}
export async function POST(request:Request){try{return await preparedWorkWrite(request);}catch(e){return error(e);}finally{await discardUnreadRequest(request);}}
