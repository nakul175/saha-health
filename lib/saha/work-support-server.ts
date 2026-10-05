import {z} from 'zod';
import {db,identity,loadFor,json} from './server';
import {scope} from './store';
import {normallyAllowed} from './access';
import {operator} from './operations';
import {digest,fail,uuid} from './core';
import {boundedJsonBody} from './request-body';
import {recordAggregateView} from './read-audit';
import {appendBurdenLedger} from './work-burden-ledger-store';
const id=z.string().min(1).max(200),key=z.string().uuid(),category=z.enum(['capture','sync-recovery','correction','reconciliation']);
const schema=z.discriminatedUnion('type',[
 z.object({type:z.literal('request'),key,expectedActorId:id,visitId:id,category}).strict(),
 z.object({type:z.literal('assign'),key,expectedActorId:id,requestId:key,expectedSequence:z.number().int().min(1).max(99),helperId:id}).strict(),
 z.object({type:z.literal('attest'),key,expectedActorId:id,requestId:key,expectedSequence:z.number().int().min(1).max(99)}).strict(),
 z.object({type:z.literal('ack'),key,expectedActorId:id,requestId:key,expectedSequence:z.number().int().min(1).max(99)}).strict(),
]);
type Event={actor_id:string;id:string;request_id:string;person_id:string;visit_id:string;kind:string;category:string;requester_id:string;helper_id:string|null;sequence:number;input_hash:string;member_version:number;at:string};
export async function workSupportWrite(request:Request){
 const origin=request.headers.get('origin');if(request.headers.get('sec-fetch-site')==='cross-site'||origin&&origin!==new URL(request.url).origin)fail(403,'Same-origin request required.');if(!request.headers.get('content-type')?.startsWith('application/json'))fail(415,'Use fixed JSON support metadata.');const parsed=schema.safeParse(await boundedJsonBody(request,1200));if(!parsed.success)fail(422,'Use a fixed support action and current workflow reference.');const c=parsed.data,u=await identity();if(c.expectedActorId!==u.userId)fail(403,'The original support account is no longer current.');let last:Event|null=null;
 const s=await loadFor(u,request.headers.get('x-saha-organisation'),async org=>{if(c.type==='request'){const v=await db().prepare('SELECT person_id FROM visits WHERE org_id=? AND id=?').bind(org,c.visitId).first<{person_id:string}>();return v?[v.person_id]:[];}last=await db().prepare('SELECT * FROM work_support_events WHERE org_id=? AND request_id=? ORDER BY sequence DESC LIMIT 1').bind(org,c.requestId).first<Event>();return last?[last.person_id]:[];}),m=scope(s,u.userId),tail=last as Event|null,visitId=c.type==='request'?c.visitId:tail?.visit_id,v=s.workspace.visits.find(x=>x.id===visitId),p=s.workspace.people.find(x=>x.id===v?.personId);
 if(!v||!p||!normallyAllowed(m,p)||m.role==='provider')fail(403,'Current scoped human support access required.');
 if(!s.operations?.workBurden?.enabled)return json({recorded:false,disabled:true});
 const authorizeResponse=async()=>{const fresh=await loadFor(u,s.organisation.id,async()=>[p.id]),fm=scope(fresh,u.userId),fp=fresh.workspace.people.find(x=>x.id===p.id);if(!fp||!normallyAllowed(fm,fp)||c.type==='assign'&&!operator(fm))fail(403,'Current support access required.');if(tail){const rm=fresh.members.find(x=>x.userId===tail.requester_id),hm=fresh.members.find(x=>x.userId===(c.type==='assign'?c.helperId:tail.helper_id));if(!rm||!normallyAllowed(rm,fp)||!['asha','clinician'].includes(rm.role)||!hm||!normallyAllowed(hm,fp))fail(403,'Current requester and helper scope required.');}};
 let requester=m,helper=null,requestId=c.type==='request'?c.key:c.requestId,sequence=1,helperId:string|null=null;
 if(c.type==='request'){if(!['asha','clinician'].includes(m.role))fail(403,'Current care requester required.');if(v.voidedAt||v.supersededBy)fail(409,'Choose the current visit context.');}
 else{
  if(!tail)fail(404,'Support request unavailable.');requester=s.members.find(x=>x.userId===tail.requester_id&&x.status==='active')!;if(!requester||!normallyAllowed(requester,p)||!['asha','clinician'].includes(requester.role))fail(403,'Current requester care scope required.');
  // Stable same-key acknowledgement is checked before workflow sequence guards,
  // but never before current actor/requester/patient scope checks.
  if(c.type==='assign'&&!operator(m))fail(403,'Current scoped operator required.');
  if(c.type==='attest'&&tail.helper_id!==u.userId||c.type==='ack'&&tail.requester_id!==u.userId)fail(403,'Current workflow actor required.');
  if(c.type==='ack'&&!s.members.some(x=>x.userId===tail.helper_id&&x.status==='active'&&normallyAllowed(x,p)))fail(403,'Current helper scope required.');
  const prior=await db().prepare('SELECT input_hash FROM work_support_events WHERE org_id=? AND actor_id=? AND id=?').bind(s.organisation.id,u.userId,c.key).first<{input_hash:string}>();if(prior){if(prior.input_hash!==await digest(c))fail(409,'This support key identifies another action.');await authorizeResponse();return json({recorded:false,replayed:true,requestId});}
  if(tail.sequence!==c.expectedSequence)fail(409,'Support assignment changed. Refresh without repeating clinical work.');sequence=tail.sequence+1;helperId=tail.helper_id;
  if(c.type==='assign'){if(!operator(m))fail(403,'Current scoped operator required.');if(!['request','assign'].includes(tail.kind))fail(409,'Attested or acknowledged help cannot be reassigned.');helper=s.members.find(x=>x.userId===c.helperId&&x.status==='active')??null;if(!helper||helper.userId===requester.userId||!['asha','clinician','supervisor'].includes(helper.role)||!normallyAllowed(helper,p))fail(403,'Current helper patient scope required.');helperId=helper.userId;}
  else{helper=s.members.find(x=>x.userId===tail.helper_id&&x.status==='active')??null;if(!helper||!normallyAllowed(helper,p))fail(403,'Current assigned helper scope required.');if(c.type==='attest'&&(tail.kind!=='assign'||helper.userId!==u.userId))fail(403,'Only the currently assigned helper may attest this intervention.');if(c.type==='ack'&&(tail.kind!=='attest'||requester.userId!==u.userId))fail(403,'Only the current requester may acknowledge attested assistance.');}
 }
 const at=new Date().toISOString(),inputHash=await digest(c),cat=c.type==='request'?c.category:tail!.category,entry={org_id:s.organisation.id,actor_id:u.userId,id:c.key,request_id:requestId,person_id:p.id,visit_id:v.id,kind:c.type,category:cat,requester_id:requester.userId,helper_id:helperId,sequence,input_hash:inputHash,member_version:m.version,at},entryHash=await digest(entry),response=await appendBurdenLedger(db(),s,u,m,{table:'work_support_events',keys:['org_id','actor_id','id'],append:true,values:entry},{id:uuid(),at,actor:u.displayName,actorId:u.userId,role:m.role,action:'workSupportWorkflow',subject:requestId,personId:p.id,detail:`Fixed support workflow ${c.type}/${cat}; sequence ${sequence}; immutable entry digest ${entryHash}. No ticket text, URL or clinical facts.`},[requester,...(helper?[helper]:[])],{requestId,sequence:sequence-1});
 await authorizeResponse();return json({...response,requestId,sequence});
}
export async function workSupportRead(request:Request){
 const url=new URL(request.url);if([...url.searchParams.keys()].some(k=>k!=='visitId')||url.searchParams.getAll('visitId').length!==1)fail(422,'Choose one visit context.');const visitId=url.searchParams.get('visitId')!;if(!id.safeParse(visitId).success)fail(422,'Choose a valid visit context.');
 const u=await identity(),s=await loadFor(u,request.headers.get('x-saha-organisation'),async org=>{const row=await db().prepare('SELECT person_id FROM visits WHERE org_id=? AND id=?').bind(org,visitId).first<{person_id:string}>();return row?[row.person_id]:[];}),m=scope(s,u.userId),v=s.workspace.visits.find(x=>x.id===visitId),p=s.workspace.people.find(x=>x.id===v?.personId);if(!v||!p||!normallyAllowed(m,p)||!['asha','clinician','supervisor'].includes(m.role))fail(403,'Current scoped support access required.');
 const rows=await db().prepare('SELECT e.* FROM work_support_events e WHERE org_id=? AND visit_id=? AND sequence=(SELECT max(sequence) FROM work_support_events x WHERE x.org_id=e.org_id AND x.request_id=e.request_id) ORDER BY at DESC,id LIMIT 51').bind(s.organisation.id,visitId).all<Event>();
 const visible=rows.results.filter(e=>operator(m)||e.requester_id===u.userId||e.helper_id===u.userId).slice(0,50).map(e=>({requestId:e.request_id,category:e.category,state:e.kind,requesterId:e.requester_id,helperId:e.helper_id,sequence:e.sequence,at:e.at})),helpers=s.members.filter(x=>x.status==='active'&&['asha','clinician','supervisor'].includes(x.role)&&normallyAllowed(x,p)).map(x=>({id:x.userId,label:x.displayName}));
 await recordAggregateView(db(),s,u,m,'scoped work support queue',`${visible.length} fixed workflow entries; no clinical or ticket content.`);const fresh=await loadFor(u,s.organisation.id,async()=>[p.id]),fm=scope(fresh,u.userId),fp=fresh.workspace.people.find(x=>x.id===p.id);if(!fp||!normallyAllowed(fm,fp)||fm.role!==m.role||fm.isOwner!==m.isOwner)fail(403,'Current support access required.');return json({rows:visible,helpers,canAssign:operator(m),overflow:rows.results.length>50,enabled:fresh.operations?.workBurden?.enabled===true});
}
