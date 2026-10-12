import { institutionRosterRead, institutionRosterWrite } from '@/lib/saha/institution-roster-review-server';
import { error } from '@/lib/saha/server';
export const dynamic = 'force-dynamic';
export async function GET(r: Request) {
  try {
    return await institutionRosterRead(r);
  } catch (e) {
    return error(e);
  }
}
export async function POST(r: Request) {
  try {
    return await institutionRosterWrite(r);
  } catch (e) {
    return error(e);
  }
}
