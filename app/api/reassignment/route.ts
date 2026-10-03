import { reassignmentRead } from '@/lib/saha/reassignment-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) { return measured(request, 'reassignment', async () => { try { return await reassignmentRead(request); } catch (e) { return error(e); } }); }
