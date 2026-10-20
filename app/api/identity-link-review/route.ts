import { identityLinkRead, identityLinkWrite } from '@/lib/saha/identity-link-review-server';
import { error } from '@/lib/saha/server';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    return await identityLinkRead(request);
  } catch (e) {
    return error(e);
  }
}
export async function POST(request: Request) {
  try {
    return await identityLinkWrite(request);
  } catch (e) {
    return error(e);
  }
}
