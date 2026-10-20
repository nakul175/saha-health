import {governedReportExportDownload,governedReportExportsPost,governedReportExportsRead} from '@/lib/saha/governed-report-export-server';
import {error} from '@/lib/saha/server';
import {measured} from '@/lib/saha/monitoring';
export const dynamic='force-dynamic';
export async function GET(r:Request){return measured(r,'operations',async()=>{try{return new URL(r.url).searchParams.has('id')?await governedReportExportDownload(r):await governedReportExportsRead(r);}catch(e){return error(e);}});}
export async function POST(r:Request){return measured(r,'operations',async()=>{try{return await governedReportExportsPost(r);}catch(e){return error(e);}});}
