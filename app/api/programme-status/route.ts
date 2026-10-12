import { programmeStatusRead } from '@/lib/saha/programme-status-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';
export const dynamic = 'force-dynamic';
// Same metadata-only patient-read monitoring group as the Today projection.
export async function GET(request: Request) { return measured(request, 'patients', async () => { try { return await programmeStatusRead(request); } catch (e) { return error(e); } }); }
