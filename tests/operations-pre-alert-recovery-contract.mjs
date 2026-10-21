import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
// Actual whole exported operationRead; controlled collaborators, not real HTTP/D1 or formal acceptance.
const source=readFileSync('lib/saha/operations-server.ts','utf8').replace(/^import .*;$/gm,'');
const core=readFileSync('lib/saha/core.ts','utf8');
const errorSource=core.slice(core.indexOf('export class AppError'),core.indexOf('export const uuid'));
const js=ts.transpileModule(errorSource+'\n'+source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/^export /gm,'');
const keys=['identity','loadFor','scope','reportingScope','ensurePurpose','careReport','db','operator','budgetView','invoiceAlertInputs','releaseOperational','defaultOperations','RELEASE','environmentOf','rawRuntime','GATES','alertsFor','ALERT_RULES_VERSION','digest','recordAggregateView','evaluateIfDue','json','fail','uuid','exportCsv','recordExportAudit','REPORT_DEFINITION','sameCareScope','sameReach','currentDefinitions','reportCompleteness','completenessDisclosure','configuredLiveFreshness','assertCompletenessCurrent','productPerformance','PRODUCT_PERFORMANCE_VERSION','assertAnalyticsExport','assertHostingRoute'];
const factory=new Function(...keys,js+'\nreturn {operationsRead,AppError};');
let passed=0;const check=(a,b)=>{assert.deepEqual(a,b);passed++;};
async function scenario(kind,format='json'){
 const calls={identity:0,load:0,release:0,audit:0,evaluate:0};let api;
 const version=n=>kind==='persistent'?n:kind==='post-change'?Math.max(0,n-1):kind==='first-change'||['actor-change','org-change','revoked-after-conflict','purpose-after-conflict'].includes(kind)?Math.min(1,n):0;
 const member={userId:'synthetic-actor',role:'asha',version:1,isOwner:false,status:'active'};
 const mocks={
 identity:async()=>({userId:++calls.identity===3&&kind==='actor-change'?'different-actor':'synthetic-actor',displayName:'Synthetic'}),
  loadFor:async(u,org)=>{const n=calls.load++;if(n>=2&&kind==='revoked-after-conflict')throw new api.AppError(403,'Inactive membership');return {organisation:{id:n>=2&&kind==='org-change'?'different-org':'synthetic-org'},workspace:{people:[{id:'person',version:version(n),assigned:true}],visits:[],integrations:[]},members:[member],teams:[{id:'default',name:'Synthetic'}],operations:{acknowledgements:[],incidents:[]},testVersion:version(n),withdrawn:n>=2&&kind==='purpose-after-conflict'};},
 scope:(s)=>({...member,withdrawn:s.withdrawn}),reportingScope:()=>({include:()=>true,teams:['default'],own:true,delegations:[]}),ensurePurpose:m=>{if(m.withdrawn)throw new api.AppError(403,'Reporting purpose withdrawn');},
 careReport:s=>({since:'2026-01-01',until:'2026-10-11',testVersion:s.testVersion}),db:()=>({prepare:()=>({bind:()=>({first:async()=>({n:0}),all:async()=>({results:[]})})})}),operator:()=>false,budgetView:()=>null,invoiceAlertInputs:()=>null,
 releaseOperational:async(d,s,m,r)=>{calls.release++;if(kind==='ledger-conflict')throw new api.AppError(409,'Privacy ledger changed');if(kind==='same-message-app-error')throw new api.AppError(409,'Reporting authority or source changed while the report was released. Refresh before viewing it.');if(kind==='spoof')throw Object.assign(new Error('Reporting authority or source changed while the report was released. Refresh before viewing it.'),{status:409});return {...r,privacy:{withheld:kind==='withheld'}};},
 defaultOperations:()=>({}),RELEASE:'synthetic',environmentOf:()=>({name:'synthetic-local'}),rawRuntime:()=>({}),GATES:[],alertsFor:()=>[],ALERT_RULES_VERSION:'synthetic',digest:async x=>JSON.stringify(x),
 recordAggregateView:async()=>{calls.audit++;},evaluateIfDue:async()=>{calls.evaluate++;if(kind==='evaluate-fails')throw new api.AppError(503,'Synthetic evaluation unavailable');},json:x=>x,fail:(status,msg)=>{throw new api.AppError(status,msg);},uuid:()=>crypto.randomUUID(),exportCsv:async()=>({csv:'synthetic',rows:0,sha256:'synthetic',reconciled:true}),recordExportAudit:async()=>{},REPORT_DEFINITION:{id:'synthetic',version:1},sameCareScope:()=>{},sameReach:()=>{},currentDefinitions:()=>[],reportCompleteness:async()=>({body:{evaluatedAt:'2026-10-11T00:00:00.000Z',window:{since:'2026-01-01',until:'2026-10-11'},coverage:'complete',calendars:[],affectedDenominatorCoverage:[],affectedSourcePeriods:[],sources:[],notice:'synthetic'},basis:'synthetic-basis',digest:'synthetic-digest'}),completenessDisclosure:()=>({coverage:'complete'}),configuredLiveFreshness:()=>({}),assertCompletenessCurrent:async()=>{},productPerformance:()=>({version:'synthetic-product-performance',withheld:false,current:{},baseline:{}}),PRODUCT_PERFORMANCE_VERSION:'synthetic-product-performance',assertAnalyticsExport:()=>{},assertHostingRoute:()=>{}
 };
 api=factory(...keys.map(k=>mocks[k]));let value,error;
 try{value=await api.operationsRead(new Request('http://synthetic.invalid/api/operations?format='+format,{headers:{'x-saha-organisation':'synthetic-org'}}));}catch(e){error=e;}
 return {calls,value,error};
}
let r=await scenario('success');check(Boolean(r.value),true);check(r.calls.load,3);check(r.calls.evaluate,1);check(r.calls.release,1);
r=await scenario('first-change');check(Boolean(r.value),true);check(r.calls.load,5);check(r.calls.release,2);check(r.calls.evaluate,1);check(r.value.report.testVersion,1);
r=await scenario('persistent');check(r.value,undefined);check(r.error.status,409);check(r.calls.load,6);check(r.calls.release,3);check(r.calls.evaluate,0);
r=await scenario('post-change');check(r.value,undefined);check(r.error.status,409);check(r.calls.load,3);check(r.calls.release,1);check(r.calls.evaluate,1);
for(const kind of ['actor-change','org-change','revoked-after-conflict','purpose-after-conflict']){r=await scenario(kind);check(r.value,undefined);check(r.error.status,403);check(r.calls.evaluate,0);check(r.calls.release,1);}
for(const kind of ['ledger-conflict','spoof','same-message-app-error']){r=await scenario(kind);check(r.value,undefined);check(r.calls.release,1);check(r.calls.evaluate,0);check(r.calls.load,1);}
r=await scenario('first-change','csv');check(r.value,undefined);check(r.error.status,409);check(r.calls.release,1);check(r.calls.evaluate,0);
r=await scenario('withheld');check(r.value.report.privacy.withheld,true);check(r.value.productPerformance.withheld,true);check(r.calls.release,1);check(r.calls.evaluate,0);check(r.calls.load,3);
r=await scenario('evaluate-fails');check(r.value,undefined);check(r.error.status,503);check(r.calls.release,1);check(r.calls.evaluate,1);check(r.calls.load,2);
mkdirSync('tests/reports',{recursive:true});writeFileSync('tests/reports/operations-pre-alert-recovery-contract.json',JSON.stringify({passed,failed:0,scope:'Prepared whole actual operationRead candidate executed with controlled collaborators; advisory unit contract, not real HTTP/D1 load or acceptance'},null,2)+'\n');console.log(JSON.stringify({passed,failed:0}));
