import { planReviewRead, planReviewWrite } from '@/lib/saha/plan-review-server';
import { error } from '@/lib/saha/server';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {try {return await planReviewRead(request);} catch(cause) {return error(cause);}}
export async function POST(request: Request) {try {return await planReviewWrite(request);} catch(cause) {return error(cause);}}
