import { identity, loadFor, json } from './server';
import { scope } from './store';
import { currentDefinitions } from './indicators';
import { operationsOf } from './adapter-operations';
import { AGGREGATE_GROUPS, APPROVAL_HOURS, reportsOf } from './aggregate-delivery';
import { manager } from './indicators';
// Slice 7g: aggregate-only destinations, what an owner or supervisor may report on, and the report history with
// receipts for reports whose teams are all in the viewer's reporting scope. Reports hold suppressed aggregate cells
// only; the differencing ledger is never returned.
export async function aggregateReportsRead(request:Request){
 const u=await identity(),s=await loadFor(u,request.headers.get('x-saha-organisation')),m=scope(s,u.userId);manager(m);
 const destinations=s.workspace.integrations.filter(i=>i.kind==='mis'&&operationsOf(i).aggregateOnly).map(i=>{const o=operationsOf(i);return {id:i.id,name:i.name,mode:i.mode,status:i.status,settingVersion:o.version,aggregate:o.allowed.includes('aggregate'),lookup:o.allowed.includes('lookup')};});
 const reports=reportsOf(s).filter(r=>r.teamIds.every(t=>m.teamIds.includes(t))).slice(-100).reverse().map(r=>({...r,teamNames:r.teamIds.map(t=>s.teams.find(x=>x.id===t)?.name??t)}));
 return json({destinations,reports,approvalHours:APPROVAL_HOURS,groups:AGGREGATE_GROUPS,viewer:u.userId,
  catalogue:currentDefinitions(s).filter(r=>r.status==='active').map(r=>({id:r.id,version:r.version,title:r.spec.title,unit:r.spec.unit})),
  teams:s.teams.filter(t=>m.teamIds.includes(t.id)).map(t=>({id:t.id,name:t.name}))});
}
