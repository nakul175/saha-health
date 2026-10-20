import { contextualAcademyRead } from '@/lib/saha/contextual-academy-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return measured(request, 'patients', async () => {
    try { return await contextualAcademyRead(request); } catch (cause) { return error(cause); }
  });
}
