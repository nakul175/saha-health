import {ensurePurpose} from './purpose-scope';
import {releaseOperational} from './operational-disclosure';
import {independentTargets} from './service-identity';
import { db, identity, loadFor, json, rawRuntime } from './server';
import { environmentOf } from './environment';
import { careReport, configurationSupplyComponent, defaultOperations, GATES, operator, RELEASE } from './operations';
import {FRONTLINE} from './frontline';
import { reportingScope } from './delegation';
import { exportCsv, REPORT_DEFINITION } from './report-export';
import { scope, allowed } from './store';
import { recordExportAudit, sameCareScope, sameReach } from './export-audit';
import { AppError, digest, fail, uuid } from './core';
import { recordAggregateView } from './read-audit';
import { alertsFor, ALERT_RULES_VERSION } from './alerts';
import { evaluateIfDue } from './alert-delivery-server';
import { BUDGET_NOTICE, budgetView } from './ai-budget';
import { invoiceAlertInputs, invoiceView } from './ai-invoice';
import {assertAnalyticsExport,assertHostingRoute} from './hosting-controls';
import { costLedger } from './ai-cost-ledger';
import {currentDefinitions} from './indicators';
import {assertCompletenessCurrent,reportCompleteness} from './reporting-completeness-server';
import {completenessDisclosure,configuredLiveFreshness} from './reporting-completeness';
import {productPerformance,type ProductCounter,PRODUCT_PERFORMANCE_VERSION} from './product-performance';
import { operationalSignals, telemetryConfigured } from './operational-monitoring';
const currentMonth=()=>new Date().toISOString().slice(0,7);
const REPORT_SOURCE_CHANGED='Reporting authority or source changed while the report was released. Refresh before viewing it.';
// Only this private pre-alert marker permits bounded recomputation. Post-alert conflicts remain final refusals.
class PreAlertReportConflict extends AppError { constructor(){super(409,REPORT_SOURCE_CHANGED);} }
const PRODUCT_CODES:Record<string,ProductCounter['kind']>={
 'burden:server-sync-success':'sync-success','burden:server-sync-replay':'sync-replay','burden:server-sync-conflict':'sync-conflict','burden:server-sync-refused':'sync-refused','burden:server-sync-invalid':'sync-invalid','burden:client-sync-unknown':'sync-unknown','burden:help-request':'support-request','burden:assisted-completion':'support-assisted'
};
async function productCounters(orgId:string,since:string):Promise<ProductCounter[]>{
 const metricRows=await db().prepare("SELECT bucket,route,status,count FROM request_metrics WHERE org_id=? AND bucket>=? AND route NOT LIKE 'burden:%' ORDER BY bucket,route,status").bind(orgId,since).all<{bucket:string;route:string;status:number;count:number}>();
 const burdenRows=await db().prepare("SELECT at,detail FROM audit_events WHERE org_id=? AND at>=? AND action='workBurdenCounter' ORDER BY seq").bind(orgId,since).all<{at:string;detail:string}>();
 const supportRows=await db().prepare("SELECT at,kind,count(*) AS count FROM work_support_events WHERE org_id=? AND at>=? AND kind IN ('request','ack') GROUP BY at,kind ORDER BY at,kind").bind(orgId,since).all<{at:string;kind:'request'|'ack';count:number}>();
 const timingRows=await db().prepare("SELECT at,count(*) AS count FROM work_burden_samples WHERE org_id=? AND at>=? AND phase='complete' AND complete=1 GROUP BY at ORDER BY at").bind(orgId,since).all<{at:string;count:number}>();
 const rows:ProductCounter[]=[];
 for(const r of metricRows.results){rows.push({at:r.bucket,kind:'request',count:r.count});if(r.status>=500)rows.push({at:r.bucket,kind:'server-error',count:r.count});}
 for(const r of burdenRows.results){const prefix='Count-only work-burden event ',end=r.detail.indexOf(';',prefix.length),kind=end>prefix.length?PRODUCT_CODES['burden:'+r.detail.slice(prefix.length,end)]:undefined;if(kind)rows.push({at:r.at,kind,count:1});}
 for(const r of supportRows.results)rows.push({at:r.at,kind:r.kind==='request'?'support-workflow-request':'support-workflow-ack',count:r.count});
 for(const r of timingRows.results)rows.push({at:r.at,kind:'timing-complete',count:r.count});
 return rows;
}
export async function operationsRead(request:Request){
 const actor=await identity(),pinned:{organisationId?:string}={};
 for(let attempt=0;attempt<3;attempt++){
  const current=await identity();if(current.userId!==actor.userId)fail(403,'Reporting identity changed. Nothing was shown.');
  try{return await operationsReadAttempt(request,current,pinned);}catch(error){if(!(error instanceof PreAlertReportConflict)||attempt===2)throw error;}
 }
 fail(409,REPORT_SOURCE_CHANGED);
}
async function operationsReadAttempt(request:Request,u:Awaited<ReturnType<typeof identity>>,pinned:{organisationId?:string}){
 const s=await loadFor(u,pinned.organisationId??request.headers.get('x-saha-organisation'));if(pinned.organisationId&&s.organisation.id!==pinned.organisationId)fail(403,'Reporting organisation changed. Nothing was shown.');pinned.organisationId=s.organisation.id;
 const m=scope(s,u.userId);const reach=reportingScope(s,m);
 // Clinical alert delivery is evaluated only after a protected projection and fresh authority check.
 const url=new URL(request.url),days=Number(url.searchParams.get('days')??30);if(![7,30,90].includes(days))fail(422,'Choose 7, 30 or 90 days.');const format=url.searchParams.get('format')??'json';if(!['json','csv','support'].includes(format))fail(422,'Unsupported report format.');
 const at=new Date(),clinical=format!=='support'&&m.role!=='admin';if(clinical)ensurePurpose(m,'reporting');
 const report=m.role==='admin'?null:careReport(s,m,days,at,reach.include);
 if(report){const rows=await db().prepare(`SELECT count(DISTINCT a.actor_id) AS n FROM audit_events a JOIN patients p ON p.org_id=a.org_id AND p.id=a.person_id WHERE a.org_id=? AND p.team_id IN (${reach.teams.map(()=>'?').join(',')||'NULL'}) AND a.at>=? AND a.at<=?`).bind(s.organisation.id,...reach.teams,report.since,report.until).first<{n:number}>();report.activeWorkers=rows?.n??0;report.activeWorkersCoverage='Distinct actors on authorised patient activity in the selected window.';}
 const reportingDefinitions=clinical?currentDefinitions(s).filter(d=>d.status==='active').map(d=>`${d.id}@${d.version}`):[],completeness=clinical&&report?await reportCompleteness(s,m,{since:report.since,until:report.until},reportingDefinitions,report.until,reach.teams):null,reporting=completeness&&report?completenessDisclosure(completeness,configuredLiveFreshness(s,m,{teamIds:reach.teams},{since:report.since,until:report.until},report.until,completeness.body)):null;
 let telemetry:any=null;
 if(operator(m)){const rows=await db().prepare("SELECT route,status,sum(count) AS count,sum(total_ms) AS total_ms,max(max_ms) AS max_ms FROM request_metrics WHERE org_id=? AND route NOT LIKE 'burden:%' AND bucket>=? GROUP BY route,status ORDER BY route,status").bind(s.organisation.id,new Date(Date.now()-86400000).toISOString()).all<{route:string;status:number;count:number;total_ms:number;max_ms:number}>();const count=rows.results.reduce((n,r)=>n+r.count,0),errors=rows.results.filter(r=>r.status>=500).reduce((n,r)=>n+r.count,0);telemetry={windowHours:24,count,serverErrors:errors,errorRate:count?errors/count:null,meanMs:count?Math.round(rows.results.reduce((n,r)=>n+r.total_ms,0)/count):null,maxMs:rows.results.reduce((n,r)=>Math.max(n,r.max_ms),0),routes:rows.results,coverage:'Authenticated application routes. Older buckets are pruned after 30 days when traffic resumes. Pre-authentication and platform outages are not counted. Metrics storage is best effort.'};}
 // Slice 5e: budget rows feed the owner-owned budget alerts as well as the budget table.
 const budgetRows=operator(m)?budgetView(s):null;
 // Slice 5h: invoice reconciliations and their alerts, for the same operators who see budgets.
 const invoiceAlerts=operator(m)?invoiceAlertInputs(s):null;
 const productPeople=report?s.workspace.people.filter(reach.include):[],wholeProductScope=!!report&&s.workspace.people.filter(p=>p.assigned&&!p.mergedInto).every(reach.include),productSince=new Date(at.getTime()-2*days*86400000).toISOString(),productRows=wholeProductScope?await productCounters(s.organisation.id,productSince):[];
 const product=report?(wholeProductScope?productPerformance(s,productPeople,productRows,days,at):{version:PRODUCT_PERFORMANCE_VERSION,withheld:true,minimumCell:5,reason:'Product evaluation is withheld because the current reporting authority does not cover every current assigned person. Widen the authorised scope; person-level reconstruction is not permitted.'}):null;
 const released=clinical&&report?await releaseOperational(db(),s,m,report,reach.include,at.toISOString()):report;
 const protectedRelease=(released as import('./operations').ReleasedCareReport|null)?.privacy?.withheld,productReleased=product&&protectedRelease?{version:PRODUCT_PERFORMANCE_VERSION,withheld:true,minimumCell:5,reason:'Product evaluation is withheld by the current aggregate disclosure controls. Widen the authorised cohort or wait for sufficient independent activity.'}:product;
 const ops=s.operations??defaultOperations(),runtime=rawRuntime(),signals=operator(m)?operationalSignals(s,at.toISOString(),telemetryConfigured(runtime)):null,supplyComponents=operator(m)?[...s.workspace.integrations.map(i=>({id:i.id,name:i.name,status:i.status,release:String(i.status==='active'?i.version:i.version+1)})),...FRONTLINE.map(p=>{const agreement=ops.frontlineProviders?.[p.id]??{active:true,version:1};return {id:'frontline:'+p.id,name:p.name,status:agreement.active?'active':'suspended',release:String(agreement.active?agreement.version:agreement.version+1)}}),{id:'independent:anaemia',name:'Independent anaemia screening',status:(ops.anaemiaProvider?.active??runtime.SAHA_ANAEMIA_DEMO_BOOTSTRAP==='true')?'active':'suspended',release:String((ops.anaemiaProvider?.active??runtime.SAHA_ANAEMIA_DEMO_BOOTSTRAP==='true')?(ops.anaemiaProvider?.version??1):(ops.anaemiaProvider?.version??0)+1)},...(ops.configurationReleases??[]).map(r=>({id:configurationSupplyComponent(r.manifest.kind,r.manifest.key,r.manifestHash),name:`${r.manifest.kind} ${r.manifest.key} · exact manifest ${r.manifestHash.slice(0,12)}`,status:r.state,release:String(r.manifest.version)}))]:[],result={release:RELEASE,generatedAt:new Date().toISOString(),environment:environmentOf(runtime).name,maintenance:{active:ops.maintenance,reason:ops.reason},report:released,reporting,productPerformance:productReleased,telemetry,operationalSignals:signals,operations:operator(m)?withoutReleases(ops):null,operators:operator(m)?s.members.filter(x=>x.status==='active'&&operator(x)).map(x=>({id:x.userId,name:x.displayName})):[],supplyComponents,gates:GATES,pilotReady:false,serviceAuthority:m.isOwner?{identities:ops.serviceIdentities??[],bindings:ops.serviceBindings??{},targets:[...s.workspace.integrations.filter(i=>i.status==='active'&&i.kind!=='abdm').map(i=>({id:i.id,name:i.name,kind:i.kind==='ai'?'agent':'connector'})),...independentTargets.map(id=>({id,name:id,kind:'agent'}))],owners:s.members.filter(x=>x.status==='active'&&(x.isOwner||x.role==='admin')).map(x=>({id:x.userId,name:x.displayName}))}:null,budgets:budgetRows?{notice:BUDGET_NOTICE,month:currentMonth(),rows:budgetRows}:null,invoices:operator(m)?invoiceView(s):null,alerts:alertsFor({budgets:budgetRows,invoices:invoiceAlerts,report:(released as import('./operations').ReleasedCareReport|null)?.privacy?.withheld?null:released,telemetry,signals,operations:operator(m)?ops:null,acknowledgements:ops.acknowledgements??[],viewerId:u.userId}),alertRules:ALERT_RULES_VERSION};
 const basis=(x:typeof s,o:typeof m)=>{const r=reportingScope(x,o),ps=x.workspace.people.filter(r.include),ids=new Set(ps.map(p=>p.id));return {member:o,reach:{teams:r.teams,own:r.own,delegations:r.delegations},patients:ps.map(p=>[p.id,p.version]),visits:x.workspace.visits.filter(v=>ids.has(v.personId)).map(v=>[v.id,v.version,v.recordVersion]),report:{...careReport(x,o,days,at,r.include),activeWorkers:null,activeWorkersCoverage:null}};};
 const initialBasis=clinical?await digest(basis(s,m)):null;
 const productBasis=wholeProductScope?await digest(productRows):null;
 const maybeEvaluate=async()=>{if(!clinical||!(released as import('./operations').ReleasedCareReport|null)?.privacy?.withheld)await evaluateIfDue(s.organisation.id,s);};
 const supportRoute=()=>({area:'support' as const,targetId:'approved-support',purpose:'incident-support',direction:'interactive-access' as const,actualLocation:rawRuntime().SAHA_SUPPORT_ACCESS_LOCATION});
 const freshGuard=async(beforeAlert=false)=>{const fresh=await loadFor(u,s.organisation.id),current=scope(fresh,u.userId);if(clinical){ensurePurpose(current,'reporting');const currentReach=reportingScope(fresh,current),currentWhole=fresh.workspace.people.filter(p=>p.assigned&&!p.mergedInto).every(currentReach.include),currentProduct=currentWhole?await digest(await productCounters(fresh.organisation.id,productSince)):null;if(await digest(basis(fresh,current))!==initialBasis||currentWhole!==wholeProductScope||currentProduct!==productBasis){if(beforeAlert&&format==='json')throw new PreAlertReportConflict();fail(409,REPORT_SOURCE_CHANGED);}if(completeness)await assertCompletenessCurrent(fresh,current,completeness,reportingDefinitions,reach.teams);}else if(format==='support'&&!operator(current))fail(403,'Operations access required.');else if(current.role!==m.role||current.version!==m.version||current.isOwner!==m.isOwner)fail(409,'Operations authority changed. Refresh.');if(format==='support')assertHostingRoute(s,fresh,supportRoute());if(format==='csv')assertAnalyticsExport(s,fresh,rawRuntime().SAHA_ANALYTICS_LOCATION);};
 // Slice 10h: the JSON view is the preview of the CSV and support exports (which are audited as opsExport); it is an aggregate view and is recorded before it is returned.
 if(format==='json'){await recordAggregateView(db(),s,u,m,'operations and care report',`Operations view read (JSON): ${days}-day window; scoped care report ${report?`included (${reach.teams.length} team${reach.teams.length===1?'':'s'}, ${reach.own?'own':'delegated'} reporting authority; protected projection)`:'not included'}; product evaluation ${productReleased?(productReleased.withheld?'withheld':'included as privacy-minimised current/baseline aggregates'):'not included'}; operator detail ${operator(m)?'included':'not included'}. Aggregate figures only.`);await freshGuard(true);await maybeEvaluate();await freshGuard();return json(result);}
 if(format==='csv'&&!report)fail(403,'Clinical reporting is unavailable to administrators.');if(format==='support'&&!operator(m))fail(403,'Operations access required.');
 if(format==='csv')assertAnalyticsExport(s,s,rawRuntime().SAHA_ANALYTICS_LOCATION);
 // Slice 6k: the CSV carries its definition, identifier, exporter, control totals and a checksum manifest;
 // the audit line records the same identifier and checksum so a received file can be matched to its export.
 const exportId=format==='csv'?uuid():null,exported=exportId?await exportCsv(released!,{exportId,generatedBy:u.displayName,role:m.role,teams:reach.teams.map(t=>s.teams.find(x=>x.id===t)?.name??t),days},reporting??undefined):null;
 // Slice 6p: the audit commit is retried on a fresh read if a command saved meanwhile; the exporter's
 // authority for this format is checked again there (CSV: not an administrator; support: operator).
 // Slice 6q (second review): the retry also refuses the export if the care scope (sorted team ids) or, for the
 // CSV, the reporting reach (teams and delegation ids) changed; nothing is delivered and the exporter retries.
 const orgId=s.organisation.id,again=(x:typeof s)=>{const o=scope(x,u.userId);if(format==='csv'&&o.role==='admin')fail(403,'Clinical reporting is unavailable to administrators.');if(format==='support'&&!operator(o))fail(403,'Operations access required.');if(o.role!==m.role)fail(409,'Your role changed while the export was prepared. Export again.');if(format==='csv')ensurePurpose(o,'reporting');sameCareScope(m,o);if(format==='csv'){sameReach(reach,reportingScope(x,o));assertAnalyticsExport(s,x,rawRuntime().SAHA_ANALYTICS_LOCATION);}if(format==='support')assertHostingRoute(s,x,supportRoute());return o;};
 if(format==='support')assertHostingRoute(s,s,supportRoute());
 const auditId=uuid();await recordExportAudit(db(),{state:s,reload:()=>loadFor(u,orgId),authorize:again,authorityDelegations:(current,member)=>{if(format!=='csv')return [];const currentReach=reportingScope(current,member);return currentReach.delegations.filter(d=>!currentReach.own||current.workspace.people.some(p=>d.teamIds.includes(p.teamId)&&!allowed(member,p))).map(d=>({id:d.id,kind:d.kind,grantorId:d.grantorId,until:d.until}));},event:o=>({id:auditId,at:result.generatedAt,actorId:u.userId,actor:u.displayName,role:o.role,action:'opsExport',subject:orgId,detail:exported?`Scoped aggregate report exported; ${days}-day period; definition ${REPORT_DEFINITION.id} ${REPORT_DEFINITION.version}; export ${exportId}; ${exported.rows} data rows; SHA-256 ${exported.sha256}; control totals ${exported.reconciled?'reconciled':'NOT reconciled'}.${reach.delegations.length?` Includes teams under reporting delegation ${reach.delegations.map(d=>d.id).join(', ')}.`:''}`:'Support diagnostic exported without patient records, actor identifiers, credentials or incident free text.'}),actor:u,type:'opsExport',key:'export_'+uuid(),hash:await digest({format,days})});
 // Support output intentionally excludes organisation, members, free text,
 // clinical counters and connector endpoints. This is safe to inspect, not
 // permission to send it outside the organisation.
 const support={release:RELEASE,generatedAt:result.generatedAt,environment:environmentOf(runtime).name,maintenance:ops.maintenance,telemetry,incidents:{open:ops.incidents.filter(x=>x.state!=='resolved').length},gates:GATES.map(g=>({id:g.id,state:g.state})),pilotReady:false};
 await freshGuard();await maybeEvaluate();await freshGuard();
 return new Response(exported?exported.csv:JSON.stringify(support,null,2),{headers:{...(exported?{'X-Saha-Export-Id':exportId!,'X-Saha-Content-SHA256':exported.sha256}:{}),'Content-Type':format==='csv'?'text/csv; charset=utf-8':'application/json','Content-Disposition':`attachment; filename="saha-${format==='csv'?'report.csv':'support.json'}"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
// Slice 6s: the indicator differencing ledger (hashed filters and per-cell people counts) stays on the server.
// Slice 7g: aggregate reports are read through /api/aggregate-reports (scoped to the viewer's teams).
// Slice 10k (review of the combined 10a–10j stack): an allow-list, not a deny-list. The organisation's operations document also
// holds 10c incentive claims (patient ids, evidence visit ids) and every later slice's records, each with its own scoped route.
// Operators (owners and administrators) receive only the fields the Operations screen shows, plus the 10d staff-id map
// (member identifiers kept for the people who manage members; no patient data).
export const OPERATOR_FIELDS=['version','maintenance','reason','updatedAt','incidents','rates','budgets','staffIds','clinicalAuthorities','supplyChain'] as const;
export const withoutReleases=(ops:any)=>Object.fromEntries(OPERATOR_FIELDS.filter(k=>ops&&k in ops).map(k=>[k,ops[k]]));
