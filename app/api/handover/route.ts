import { handoverRead, handoverWrite } from '@/lib/saha/handover-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) { return measured(request, 'caseload', async () => { try { return await handoverRead(request); } catch (e) { return error(e); } }); }
export async function POST(request: Request) { return measured(request, 'caseload', async () => { try { return await handoverWrite(request); } catch (e) { return error(e); } }); }
