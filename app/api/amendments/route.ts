import { amendmentsRead, amendmentsWrite } from '@/lib/saha/amendments-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) { return measured(request,'history',async () => { try { return await amendmentsRead(request); } catch(e) { return error(e); } }); }
export async function POST(request: Request) { return measured(request,'history',async () => { try { return await amendmentsWrite(request); } catch(e) { return error(e); } }); }
