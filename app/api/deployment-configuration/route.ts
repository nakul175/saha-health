import { deploymentConfigurationRead } from '@/lib/saha/deployment-configuration-server';
import { error } from '@/lib/saha/server';
import { measured } from '@/lib/saha/monitoring';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return measured(request, 'governance', async () => { try { return await deploymentConfigurationRead(request); } catch (e) { return error(e); } });
}
