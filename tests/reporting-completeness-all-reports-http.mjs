import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {identity,client} from './lib/worker.mjs';
import {startMiniflare} from './lib/miniflare.mjs';

const evidence='tests/evidence/reporting-completeness-all-reports';
mkdirSync(evidence,{recursive:true});
const worker=await startMiniflare({port:20189,name:'reporting-completeness-all-reports'});
let passed=0;
const check=(value,label)=>{assert.ok(value,label);passed++;};
try{
 const api=client(worker.base),owner=identity('all-reports-owner'),reviewer=identity('all-reports-reviewer');
 const home=(await api.get(owner,'/api/workspace')).json,org=home.organisation.id,db=await worker.mf.getD1Database('DB'),reason='Synthetic reporting completeness across released report paths';
 const cmd=async(who,body,status=200)=>{const response=await api.call(who,'/api/commands',{method:'POST',org,body,headers:{'Idempotency-Key':crypto.randomUUID()}});check(response.status===status,`${body.type}: expected ${status}, got ${response.status}: ${response.text}`);return response.json.result;};
 const other=(await api.get(reviewer,'/api/workspace')).json,invite=await cmd(owner,{type:'createInvite',accountCode:other.user.accountCode,label:'Synthetic reporting reviewer',role:'supervisor',teamIds:['default']});
 await cmd(reviewer,{type:'joinOrganisation',token:invite.token});
 const mis=home.integrations.find(x=>x.id==='mis_maternal')??home.integrations.find(x=>x.kind==='mis');
 check(!!mis,'Synthetic programme destination exists');
 await cmd(owner,{type:'setAdapterOperations',integrationId:mis.id,version:mis.operations?.version??0,allowed:['aggregate','lookup'],aggregateOnly:true,reason});
 const start=new Date(Date.now()-25*86400000).toISOString(),end=new Date(Date.now()-86400000).toISOString(),period={id:'all-reports-period',start,end,deadline:new Date(Date.now()-3600000).toISOString()};
 const spec={title:'All report source calendar',teamIds:['default'],definitions:['patients-seen@1'],periods:[period],sources:[{id:'online-source',label:'Online visit source',kind:'online-visits',integrationId:null,lateHours:24,syncHours:6,affects:[{definitionRef:'patients-seen@1',component:'numerator'}]},{id:'mis-source',label:'Programme report source',kind:'mis',integrationId:mis.id,lateHours:48,syncHours:8,affects:[{definitionRef:'patients-seen@1',component:'denominator'}]}]};
 const post=async(who,body,status=200)=>{body.expectedActorId=who.id;if(body.type==='declare'&&!body.expectedSourceVersion)body.expectedSourceVersion={contractVersion:1,kind:body.sourceId==='mis-source'?'mis':'online-visits',integrationId:body.sourceId==='mis-source'?mis.id:null,integrationVersion:body.sourceId==='mis-source'?mis.version:null};const response=await api.call(who,'/api/reporting-completeness',{method:'POST',org,body,headers:{'Idempotency-Key':crypto.randomUUID()}});check(response.status===status,`${body.type}: expected ${status}, got ${response.status}: ${response.text}`);return response.json;};
 await post(owner,{type:'propose',id:'all-reports-calendar',expectedVersion:0,spec,reason});
 const review=await post(reviewer,{type:'review',id:'all-reports-calendar',version:1,expectedSequence:1,decision:'approve',reason}),effectiveAt=new Date(Date.now()+150).toISOString();
 await post(owner,{type:'release',id:'all-reports-calendar',version:1,expectedSequence:2,reviewId:review.eventId,effectiveAt,reason});
 while(Date.now()<Date.parse(effectiveAt))await new Promise(resolve=>setTimeout(resolve,10));
 const declaration=(sourceId,status,expectedCoverageVersion)=>({type:'declare',id:'all-reports-calendar',version:1,teamId:'default',sourceId,periodId:period.id,expectedCoverageVersion,status,through:status==='complete'?end:null,evidenceHash:(sourceId==='mis-source'?'b':'a').repeat(64),reason});
 await post(reviewer,declaration('online-source','complete',0));
 await post(reviewer,declaration('mis-source','complete',0));

 const operations=await api.get(owner,'/api/operations?days=30',org);
 check(operations.status===200,operations.text);
 check(operations.json.reporting.coverage==='operator-declared-complete','Operational JSON carries governed source coverage');
 check(operations.json.reporting.clinicalDenominator==='unknown','Operational JSON never invents a clinical denominator');
 check(operations.json.reporting.affectedDenominatorCoverage.some(x=>x.sourceId==='mis-source'&&x.definitionRef==='patients-seen@1'),'Operational JSON identifies the configured source that affects the denominator');
 check(operations.json.reporting.sources.some(x=>x.sourceId==='mis-source'&&x.status==='declared-complete'),'Operational JSON identifies the configured source beside figures');
 check(operations.json.reporting.freshness.teams[0].sources.every(x=>typeof x.arrivals==='string'&&typeof x.late==='string'),'Operational JSON carries privacy-banded arrival freshness');
 check(!JSON.stringify(operations.json.reporting).includes(home.people[0].id),'Operational completeness disclosure has no patient identifier');
 const csv=await api.get(owner,'/api/operations?days=30&format=csv',org);
 check(csv.status===200,csv.text);
 check(csv.text.includes('Source completeness')&&csv.text.includes('Clinical denominator')&&csv.text.includes('Source freshness'),'Operational CSV carries completeness, denominator and freshness rows');

 const today=new Date().toISOString().slice(0,10),yesterday=new Date(Date.now()-86400000).toISOString().slice(0,10),prepared=await cmd(owner,{type:'prepareAggregateReport',destinationId:mis.id,definitions:['patients-seen@1'],period:{start:yesterday,end:today},teamIds:['default'],group:'none'});
 const reports=await api.get(owner,'/api/aggregate-reports',org),saved=reports.json.reports.find(x=>x.id===prepared.reportId);
 check(reports.status===200&&!!saved,'Prepared aggregate report is visible in scoped history');
 check(saved.reporting.coverage==='operator-declared-complete'&&saved.reporting.clinicalDenominator==='unknown','Aggregate history pins completeness beside the report');
 check(saved.reporting.freshness.teams[0].sources.some(x=>x.source==='online-visits'),'Aggregate history carries source freshness bands');
 const stored=JSON.parse((await db.prepare('SELECT data FROM operations WHERE org_id=?').bind(org).first()).data).aggregateReports.find(x=>x.id===prepared.reportId);
 check(stored.payload.contract==='saha-aggregate-v2'&&stored.payload.reporting.evidenceDigest===saved.reporting.evidenceDigest,'Destination payload signs the same bounded completeness disclosure');
 await cmd(reviewer,{type:'approveAggregateReport',reportId:prepared.reportId,payloadSha256:prepared.sha256});
 await post(reviewer,declaration('mis-source','outage',1));
 const outage=await api.get(owner,'/api/operations?days=30',org);
 check(outage.status===200&&outage.json.reporting.coverage==='incomplete-or-unknown','A disconnected source makes the operational report visibly incomplete');
 check(outage.json.reporting.affectedSourcePeriods.some(x=>x.sourceId==='mis-source'&&x.status==='outage'&&x.affectedOperands.some(y=>y.component==='denominator')),'The outage names its affected denominator and reporting period');
 const sent=await cmd(owner,{type:'sendAggregateReport',reportId:prepared.reportId});
 check(sent.state==='cancelled'&&sent.refused,'Source-status change after approval closes the report without sending');
 const after=JSON.parse((await db.prepare('SELECT data FROM operations WHERE org_id=?').bind(org).first()).data).aggregateReports.find(x=>x.id===prepared.reportId);
 check(after.attempts===0&&!after.receipt&&after.message.includes('would now differ'),'Race refusal retains zero external attempts and no receipt');

 writeFileSync(evidence+'/http.json',JSON.stringify({passed,failed:0,actualWorker:true,actualD1:true,scope:'Synthetic operational JSON/CSV and aggregate destination completeness, privacy-banded freshness, unknown clinical denominator, independent approval and source-status race refusal.'},null,2)+'\n');
 console.log(JSON.stringify({passed,failed:0}));
}finally{await worker.stop();}
