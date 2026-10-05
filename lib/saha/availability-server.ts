import {db,identity,loadFor,json,rawRuntime} from './server';
import {scope} from './store';
import {operator} from './operations';
import {fail} from './core';
import {readAvailabilityReport,sampleAvailability} from './availability';
import {recordAggregateView} from './read-audit';
const authorize=async(request:Request)=>{const u=await identity(),s=await loadFor(u,request.headers.get('x-saha-organisation'),async()=>[]),m=scope(s,u.userId);if(!operator(m))fail(403,'Operations access required.');return {u,s,m};};
export async function availabilityRead(request:Request){
 const url=new URL(request.url);if([...url.searchParams.keys()].some(k=>k!=='month')||url.searchParams.getAll('month').length>1)fail(422,'Only one UTC month filter is supported.');
 const {u,s,m}=await authorize(request),month=url.searchParams.get('month')??new Date().toISOString().slice(0,7),report=await readAvailabilityReport(db(),s,month);
 await recordAggregateView(db(),s,u,m,'synthetic availability report',`UTC month ${month}; ${report.scheduler.expected} expected local slots; ${report.scheduler.observed} observed. Aggregate operational values only.`);
 const fresh=await loadFor(u,s.organisation.id,async()=>[]),current=scope(fresh,u.userId);if(!operator(current)||current.role!==m.role||current.isOwner!==m.isOwner)fail(403,'Current operations access required.');
 return json({...report,configuration:s.operations?.availability??null,destinations:s.workspace.integrations.filter(i=>i.kind==='mis'&&i.mode==='demo'&&i.status==='active').map(i=>({id:i.id,name:i.name})),canConfigure:current.isOwner});
}
export async function availabilityProbe(request:Request){
 if(new URL(request.url).search)fail(422,'Probe query parameters are not supported.');
 const {u,s,m}=await authorize(request);
 const reader=request.body?.getReader();let raw='',bytes=0;if(reader){while(true){const chunk=await reader.read();if(chunk.done)break;bytes+=chunk.value.byteLength;if(bytes>2){await reader.cancel();fail(422,'This fixed synthetic probe takes no payload or URL.');}raw+=new TextDecoder().decode(chunk.value);}}if(raw!==''&&raw!=='{}')fail(422,'This fixed synthetic probe takes no payload or URL.');
 return json(await sampleAvailability(db(),s,'manual-http',u,m,undefined,rawRuntime()));
}
