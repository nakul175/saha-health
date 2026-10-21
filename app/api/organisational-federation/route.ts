import { organisationalFederationWrite } from '@/lib/saha/organisational-federation-server';
import { error } from '@/lib/saha/server';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) { try { return await organisationalFederationWrite(request); } catch (value) { return error(value); } }
