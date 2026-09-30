import { db, identity, loadFor, json, rawRuntime } from './server';
import { environmentOf } from './environment';
import { careReport, defaultOperations, GATES, operator, RELEASE } from './operations';
import { reportingScope } from './delegation';
import { exportCsv, REPORT_DEFINITION } from './report-export';
import { persist, scope } from './store';
import { digest, fail, uuid } from './core';
import { alertsFor, ALERT_RULES_VERSION } from './alerts';
import { BUDGET_NOTICE, budgetView } from './ai-budget';
import { invoiceAlertInputs, invoiceView } from './ai-invoice';
const currentMonth=()=>new Date().toISOString().slice(0,7);
export async function operationsRead(request:Request){
 const u=await identity(),s=await loadFor(u,request.headers.get('x-saha-organisation')),m=scope(s,u.userId);const reach=reportingScope(s,m);
 const url=new URL(request.url),days=Number(url.searchParams.get('days')??30);if(![7,30,90].includes(days))fail(422,'Choose 7, 30 or 90 days.');const format=url.searchParams.get('format')??'json';if(!['json','csv','support'].includes(format))fail(422,'Unsupported report format.');
 const report=m.role==='admin'?null:careReport(s,m,days,undefined,reach.include);
 if(report){const rows=await db().prepare(`SELECT count(DISTINCT a.actor_id) AS n FROM audit_events a JOIN patients p ON p.org_id=a.org_id AND p.id=a.person_id WHERE a.org_id=? AND p.team_id IN (${reach.teams.map(()=>'?').join(',')||'NULL'}) AND a.at>=? AND a.at<=?`).bind(s.organisation.id,...reach.teams,report.since,report.until).first<{n:number}>();report.activeWorkers=rows?.n??0;report.activeWorkersCoverage='Distinct actors on authorised patient activity in the selected window.';}
 let telemetry:any=null;
 if(operator(m)){const rows=await db().prepare('SELECT route,status,sum(count) AS count,sum(total_ms) AS total_ms,max(max_ms) AS max_ms FROM request_metrics WHERE org_id=? AND bucket>=? GROUP BY route,status ORDER BY route,status').bind(s.organisation.id,new Date(Date.now()-86400000).toISOString()).all<{route:string;status:number;count:number;total_ms:number;max_ms:number}>();const count=rows.results.reduce((n,r)=>n+r.count,0),errors=rows.results.filter(r=>r.status>=500).reduce((n,r)=>n+r.count,0);telemetry={windowHours:24,count,serverErrors:errors,errorRate:count?errors/count:null,meanMs:count?Math.round(rows.results.reduce((n,r)=>n+r.total_ms,0)/count):null,maxMs:rows.results.reduce((n,r)=>Math.max(n,r.max_ms),0),routes:rows.results,coverage:'Authenticated application routes. Older buckets are pruned after 30 days when traffic resumes. Pre-authentication and platform outages are not counted. Metrics storage is best effort.'};}
 // Slice 5e: budget rows feed the owner-owned budget alerts as well as the budget table.
 const budgetRows=operator(m)?budgetView(s):null;
 // Slice 5h: invoice reconciliations and their alerts, for the same operators who see budgets.
 const invoiceAlerts=operator(m)?invoiceAlertInputs(s):null;
 const ops=s.operations??defaultOperations(),result={release:RELEASE,generatedAt:new Date().toISOString(),environment:environmentOf(rawRuntime()).name,maintenance:{active:ops.maintenance,reason:ops.reason},report,telemetry,operations:operator(m)?ops:null,operators:operator(m)?s.members.filter(x=>x.status==='active'&&operator(x)).map(x=>({id:x.userId,name:x.displayName})):[],gates:GATES,pilotReady:false,budgets:budgetRows?{notice:BUDGET_NOTICE,month:currentMonth(),rows:budgetRows}:null,invoices:operator(m)?invoiceView(s):null,alerts:alertsFor({budgets:budgetRows,invoices:invoiceAlerts,report,telemetry,operations:operator(m)?ops:null,acknowledgements:ops.acknowledgements??[],viewerId:u.userId}),alertRules:ALERT_RULES_VERSION};
 if(format==='json')return json(result);
 if(format==='csv'&&!report)fail(403,'Clinical reporting is unavailable to administrators.');if(format==='support'&&!operator(m))fail(403,'Operations access required.');
 // Slice 6k: the CSV carries its definition, identifier, exporter, control totals and a checksum manifest;
 // the audit line records the same identifier and checksum so a received file can be matched to its export.
 const exportId=format==='csv'?uuid():null,exported=exportId?await exportCsv(report!,{exportId,generatedBy:u.displayName,role:m.role,teams:reach.teams.map(t=>s.teams.find(x=>x.id===t)?.name??t),days}):null;
 const before=structuredClone(s);s.workspace.audit.push({id:uuid(),at:result.generatedAt,actorId:u.userId,actor:u.displayName,role:m.role,action:'opsExport',subject:s.organisation.id,detail:exported?`Scoped aggregate report exported; ${days}-day period; definition ${REPORT_DEFINITION.id} ${REPORT_DEFINITION.version}; export ${exportId}; ${exported.rows} data rows; SHA-256 ${exported.sha256}; control totals ${exported.reconciled?'reconciled':'NOT reconciled'}.${reach.delegations.length?` Includes teams under reporting delegation ${reach.delegations.map(d=>d.id).join(', ')}.`:''}`:'Support diagnostic exported without patient records, actor identifiers, credentials or incident free text.'});
 await persist(db(),before,s,u,{type:'opsExport'},'export_'+uuid(),await digest({format,days}),{ok:true});
 // Support output intentionally excludes organisation, members, free text,
 // clinical counters and connector endpoints. This is safe to inspect, not
 // permission to send it outside the organisation.
 const support={release:RELEASE,generatedAt:result.generatedAt,environment:environmentOf(rawRuntime()).name,maintenance:ops.maintenance,telemetry,incidents:{open:ops.incidents.filter(x=>x.state!=='resolved').length},gates:GATES.map(g=>({id:g.id,state:g.state})),pilotReady:false};
 return new Response(exported?exported.csv:JSON.stringify(support,null,2),{headers:{...(exported?{'X-Saha-Export-Id':exportId!,'X-Saha-Content-SHA256':exported.sha256}:{}),'Content-Type':format==='csv'?'text/csv; charset=utf-8':'application/json','Content-Disposition':`attachment; filename="saha-${format==='csv'?'report.csv':'support.json'}"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
