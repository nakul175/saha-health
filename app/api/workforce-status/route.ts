import { workforceRead, workforceWrite } from '@/lib/saha/workforce-status-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) { return measured(request, 'workspace', async () => { try { return await workforceRead(request); } catch (cause) { return error(cause); } }); }
export async function POST(request: Request) { return measured(request, 'workspace', async () => { try { return await workforceWrite(request); } catch (cause) { return error(cause); } }); }
