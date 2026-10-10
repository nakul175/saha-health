import { todayRead } from '@/lib/saha/today-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return measured(request, 'patients', async () => {
    try {
      return await todayRead(request);
    } catch (cause) {
      return error(cause);
    }
  });
}
