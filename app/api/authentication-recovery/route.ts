import { authenticationRecoveryRead, authenticationRecoveryWrite } from '@/lib/saha/authentication-recovery-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) { return measured(request, 'patients', async () => { try { return await authenticationRecoveryRead(); } catch (cause) { return error(cause); } }); }
export async function POST(request: Request) { return measured(request, 'commands', async () => { try { return await authenticationRecoveryWrite(request); } catch (cause) { return error(cause); } }); }
