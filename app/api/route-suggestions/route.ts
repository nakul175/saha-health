import { routeSuggestionsRead } from '@/lib/saha/route-suggestions-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) { return measured(request, 'worklists', async () => { try { return await routeSuggestionsRead(request); } catch (e) { return error(e); } }); }
