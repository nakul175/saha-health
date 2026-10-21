import { approvedSourceLibraryRead } from '@/lib/saha/approved-source-library-server';
import { measured } from '@/lib/saha/monitoring';
import { error } from '@/lib/saha/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return measured(request, 'governance', async () => {
    try {
      return await approvedSourceLibraryRead(request);
    } catch (caught) {
      return error(caught);
    }
  });
}
