import { db, identity, loadFor, json } from './server';
import { fail, uuid } from './core';
import { scope } from './store';
import { recordAccess } from './access-audit';
import { incentiveCsv, incentiveView } from './incentives-view';
// Slice 10c: the viewer's synthetic incentive claims (JSON), or the approved claims as CSV. The export is recorded in the
// audit chain before the file is returned (slice 6t pattern, as for indicator exports); a view is not recorded.
export async function incentiveRead(request:Request){
 const u=await identity(),s=await loadFor(u,request.headers.get('x-saha-organisation')),m=scope(s,u.userId),p=new URL(request.url).searchParams,now=new Date().toISOString(),format=p.get('format');
 if(format&&format!=='csv')fail(422,'Use format=csv or no format.');
 if(format==='csv'){
  const exportId=uuid(),file=await incentiveCsv(s,m,now,exportId,u.displayName);
  await recordAccess(db(),s,u,m,{action:'incentiveExport',subject:exportId,detail:`Incentive claims CSV ${exportId}: ${file.claims} approved claim${file.claims===1?'':'s'}, ${file.rows} data rows; SHA-256 ${file.sha256}. Synthetic placeholder amounts; no patient name or identifier is in the file.`},now);
  return new Response(file.csv,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="saha-synthetic-incentive-claims.csv"','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Saha-Export-Id':exportId,'X-Saha-Content-SHA256':file.sha256}});
 }
 return json(await incentiveView(s,m,now,{from:p.get('from'),to:p.get('to'),team:p.get('team')}));
}
