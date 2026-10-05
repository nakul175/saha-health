import {z} from 'zod';
import {db,identity,loadFor,json} from './server';
import {scope,persistBurdenCounter} from './store';
import {operator} from './operations';
import {digest,fail} from './core';
import {recordAggregateView} from './read-audit';
const event=z.object({code:z.enum(['capture-30s','capture-2m','capture-5m','capture-15m','capture-over15m','help-request','assisted-completion','client-sync-unknown']),key:z.string().uuid()}).strict();
const care=(role:string)=>role==='asha'||role==='clinician';
export async function burdenPolicy(request:Request){
 if(new URL(request.url).search)fail(422,'Measurement policy query fields are not supported.');
 const u=await identity(),org=request.headers.get('x-saha-organisation');
 const read=async()=>{const state=await loadFor(u,org,async()=>[]),member=scope(state,u.userId);if(!care(member.role))fail(403,'Current human care membership required.');return {state,member};};
 let current=await read();
 for(let attempt=0;attempt<3;attempt++){
  if(!current.state.operations?.workBurden?.enabled){current=await read();if(!current.state.operations?.workBurden?.enabled)return json({organisationId:current.state.organisation.id,userId:u.userId,enabled:false,version:current.state.operations?.workBurden?.version??0});}
  const observed=current;
  await recordAggregateView(db(),observed.state,u,observed.member,'work-burden policy',`Fixed enabled opt-in configuration version ${observed.state.operations!.workBurden!.version} only. No patient or ticket facts.`);
  current=await read();const configuration=current.state.operations?.workBurden;
  if(!configuration?.enabled)return json({organisationId:current.state.organisation.id,userId:u.userId,enabled:false,version:configuration?.version??0});
  if(configuration.version===observed.state.operations!.workBurden!.version&&current.member.version===observed.member.version&&current.member.role===observed.member.role&&current.member.isOwner===observed.member.isOwner)return json({organisationId:current.state.organisation.id,userId:u.userId,enabled:true,version:configuration.version});
 }
 fail(409,'Measurement policy changed repeatedly. Read the current policy again.');
}
export async function burdenEvent(request:Request){
 if(new URL(request.url).search)fail(422,'Measurement query fields are not supported.');
 if(request.headers.get('sec-fetch-site')==='cross-site')fail(403,'Same-origin request required.');
 if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)fail(403,'Same-origin request required.');
 if(request.headers.get('content-type')?.split(';')[0]!=='application/json')fail(415,'Use a JSON count-only event.');
 const u=await identity(),s=await loadFor(u,request.headers.get('x-saha-organisation'),async()=>[]),m=scope(s,u.userId);if(!care(m.role))fail(403,'Current human care membership required.');
 // Disabled clients make no event writes, including receipts and read audits.

 const reader=request.body?.getReader();let raw='',size=0;if(reader)while(true){const c=await reader.read();if(c.done)break;size+=c.value.byteLength;if(size>512){await reader.cancel();fail(413,'Count-only event is too large.');}raw+=new TextDecoder().decode(c.value);}
 let value;try{value=JSON.parse(raw);}catch{fail(422,'Invalid count-only event.');}const parsed=event.safeParse(value);if(!parsed.success)fail(422,'Use one fixed measurement code and event key.');
 if(!s.operations?.workBurden?.enabled)return json({recorded:false,disabled:true});
 const hash=await digest({format:'saha-burden-v1',organisationId:s.organisation.id,code:parsed.data.code});
 const result=await persistBurdenCounter(db(),s,u,m,parsed.data.key,hash,parsed.data.code);
 // A positive withdrawal after write prevents even an acknowledgement disclosure.
 const current=await loadFor(u,s.organisation.id,async()=>[]),cm=scope(current,u.userId);if(!care(cm.role)||!current.operations?.workBurden?.enabled)fail(403,'Current enabled care measurement required.');return json(result);
}
export async function burdenRead(request:Request){
 const url=new URL(request.url);if([...url.searchParams.keys()].some(k=>k!=='week')||url.searchParams.getAll('week').length>1)fail(422,'Choose one UTC Monday.');
 const today=new Date();today.setUTCHours(0,0,0,0);today.setUTCDate(today.getUTCDate()-((today.getUTCDay()+6)%7));const week=url.searchParams.get('week')??today.toISOString().slice(0,10),from=week+'T00:00:00.000Z',start=new Date(from);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(week)||!Number.isFinite(+start)||start.toISOString()!==from||start.getUTCDay()!==1||+start>+today||+start<+today-365*86400000)fail(422,'Choose a UTC Monday within the last year.');const until=new Date(+start+7*86400000).toISOString();
 const u=await identity(),s=await loadFor(u,request.headers.get('x-saha-organisation'),async()=>[]),m=scope(s,u.userId);if(!operator(m))fail(403,'Operations access required.');
 const codes=await db().prepare("SELECT route AS code,sum(count) AS count FROM request_metrics WHERE org_id=? AND bucket=? AND route LIKE 'burden:%' AND status=0 GROUP BY route ORDER BY route LIMIT 32").bind(s.organisation.id,from).all<{code:string;count:number}>();
 // Immutable recorded human care role, not current membership or registration.
 // Administrative/read/provider/system/imported activity cannot create a denominator.
 const denominator=await db().prepare("SELECT count(DISTINCT actor_id) AS n FROM audit_events WHERE org_id=? AND at>=? AND at<? AND role IN ('asha','clinician') AND person_id IS NOT NULL AND seq>COALESCE((SELECT max(b.seq) FROM audit_events b WHERE b.org_id=audit_events.org_id AND b.action IN ('migrateWorkspace','createWorkspace','createOrganisation')),0) AND action IN ('startVisit','saveVisit','confirmVisit','syncFieldVisit','saveProgrammeAnswers') AND CASE WHEN instr(detail,char(10)||'Command authority: ')>0 AND json_valid(substr(detail,instr(detail,char(10)||'Command authority: ')+20)) THEN json_extract(substr(detail,instr(detail,char(10)||'Command authority: ')+20),'$.format')='saha-command-authority-v1' AND json_extract(substr(detail,instr(detail,char(10)||'Command authority: ')+20),'$.initiatorId')=actor_id AND json_extract(substr(detail,instr(detail,char(10)||'Command authority: ')+20),'$.principal')='member' AND json_extract(substr(detail,instr(detail,char(10)||'Command authority: ')+20),'$.membership.status')='active' AND json_extract(substr(detail,instr(detail,char(10)||'Command authority: ')+20),'$.membership.role')=role ELSE 0 END").bind(s.organisation.id,from,until).first<{n:number}>();
 const counts=Object.fromEntries(codes.results.map(r=>[r.code.slice(7),r.count])),n=denominator?.n??0;
 await recordAggregateView(db(),s,u,m,'work-burden report',`UTC week ${week}; ${codes.results.length} fixed count categories; ${n} distinct recorded human care-active actors. No patient or ticket facts.`);
 const fresh=await loadFor(u,s.organisation.id,async()=>[]),current=scope(fresh,u.userId);if(!operator(current)||current.role!==m.role||current.isOwner!==m.isOwner)fail(403,'Current operations access required.');
 return json({week,until,counts,careActiveWorkers:n,helpRequestsPer100CareActive:n&&counts['help-request']!==undefined?100*counts['help-request']/n:null,assistedPer100CareActive:n&&counts['assisted-completion']!==undefined?100*counts['assisted-completion']/n:null,configuration:fresh.operations?.workBurden??{enabled:false,version:0},operationsVersion:fresh.operations?.version??0,canConfigure:current.isOwner,denominator:'Distinct actors recorded with ASHA/clinician role on patient startVisit, saveVisit, confirmVisit, syncFieldVisit or saveProgrammeAnswers in this UTC week. Reads, system/provider, imported and admin events excluded. Requires the trusted v1 command-authority member envelope. Untracked legacy/imported history and fixture-import events are excluded. Historical membership changes do not rewrite it.',coverage:'Opt-in online app saved common-fact capture sessions and fixed self-reported help only. Missing samples are unknown. Client time excludes hidden/unfocused/idle periods, programme questions, corrections/reconciliation elsewhere, paper and external MIS. Offline encrypted outbox, verified support-ticket linkage, comparable completed-visit total time, baseline/pilot evaluation and cost remain outside this batch.'});
}
