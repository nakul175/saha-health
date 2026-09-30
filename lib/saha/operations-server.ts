import { db, identity, loadFor, json } from './server';
import { careReport, defaultOperations, GATES, operator, RELEASE, reportCsv, requireReporting } from './operations';
import { persist, scope } from './store';
import { digest, fail, uuid } from './core';
import { alertsFor, ALERT_RULES_VERSION } from './alerts';
import { BUDGET_NOTICE, budgetView } from './ai-budget';
const currentMonth=()=>new Date().toISOString().slice(0,7);
export async function operationsRead(request:Request){
 const u=await identity(),s=await loadFor(u,request.headers.get('x-saha-organisation')),m=scope(s,u.userId);requireReporting(m);
 const url=new URL(request.url),days=Number(url.searchParams.get('days')??30);if(![7,30,90].includes(days))fail(422,'Choose 7, 30 or 90 days.');const format=url.searchParams.get('format')??'json';if(!['json','csv','support'].includes(format))fail(422,'Unsupported report format.');
 const report=m.role==='admin'?null:careReport(s,m,days);
 if(report){const rows=await db().prepare(`SELECT count(DISTINCT a.actor_id) AS n FROM audit_events a JOIN patients p ON p.org_id=a.org_id AND p.id=a.person_id JOIN team_members t ON t.org_id=p.org_id AND t.team_id=p.team_id AND t.user_id=? WHERE a.org_id=? AND a.at>=? AND a.at<=?`).bind(u.userId,s.organisation.id,report.since,report.until).first<{n:number}>();report.activeWorkers=rows?.n??0;report.activeWorkersCoverage='Distinct actors on authorised patient activity in the selected window.';}
 let telemetry:any=null;
 if(operator(m)){const rows=await db().prepare('SELECT route,status,sum(count) AS count,sum(total_ms) AS total_ms,max(max_ms) AS max_ms FROM request_metrics WHERE org_id=? AND bucket>=? GROUP BY route,status ORDER BY route,status').bind(s.organisation.id,new Date(Date.now()-86400000).toISOString()).all<{route:string;status:number;count:number;total_ms:number;max_ms:number}>();const count=rows.results.reduce((n,r)=>n+r.count,0),errors=rows.results.filter(r=>r.status>=500).reduce((n,r)=>n+r.count,0);telemetry={windowHours:24,count,serverErrors:errors,errorRate:count?errors/count:null,meanMs:count?Math.round(rows.results.reduce((n,r)=>n+r.total_ms,0)/count):null,maxMs:rows.results.reduce((n,r)=>Math.max(n,r.max_ms),0),routes:rows.results,coverage:'Authenticated application routes. Older buckets are pruned after 30 days when traffic resumes. Pre-authentication and platform outages are not counted. Metrics storage is best effort.'};}
 const ops=s.operations??defaultOperations(),result={release:RELEASE,generatedAt:new Date().toISOString(),environment:'synthetic',maintenance:{active:ops.maintenance,reason:ops.reason},report,telemetry,operations:operator(m)?ops:null,operators:operator(m)?s.members.filter(x=>x.status==='active'&&operator(x)).map(x=>({id:x.userId,name:x.displayName})):[],gates:GATES,pilotReady:false,budgets:operator(m)?{notice:BUDGET_NOTICE,month:currentMonth(),rows:budgetView(s)}:null,alerts:alertsFor({report,telemetry,operations:operator(m)?ops:null,acknowledgements:ops.acknowledgements??[],viewerId:u.userId}),alertRules:ALERT_RULES_VERSION};
 if(format==='json')return json(result);
 if(format==='csv'&&!report)fail(403,'Clinical reporting is unavailable to administrators.');if(format==='support'&&!operator(m))fail(403,'Operations access required.');
 const before=structuredClone(s);s.workspace.audit.push({id:uuid(),at:result.generatedAt,actorId:u.userId,actor:u.displayName,role:m.role,action:'opsExport',subject:s.organisation.id,detail:format==='csv'?`Scoped aggregate report exported; ${days}-day period.`:'Support diagnostic exported without patient records, actor identifiers, credentials or incident free text.'});
 await persist(db(),before,s,u,{type:'opsExport'},'export_'+uuid(),await digest({format,days}),{ok:true});
 // Support output intentionally excludes organisation, members, free text,
 // clinical counters and connector endpoints. This is safe to inspect, not
 // permission to send it outside the organisation.
 const support={release:RELEASE,generatedAt:result.generatedAt,environment:'synthetic',maintenance:ops.maintenance,telemetry,incidents:{open:ops.incidents.filter(x=>x.state!=='resolved').length},gates:GATES.map(g=>({id:g.id,state:g.state})),pilotReady:false};
 return new Response(format==='csv'?reportCsv(report!):JSON.stringify(support,null,2),{headers:{'Content-Type':format==='csv'?'text/csv; charset=utf-8':'application/json','Content-Disposition':`attachment; filename="saha-${format==='csv'?'report.csv':'support.json'}"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
