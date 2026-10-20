import {recordAccess} from './access-audit';
import {AppError,digest,fail} from './core';
import {applyEventGeotag,authorizeEventGeotag,eventGeotagSchema,eventGeotagView,policyOf} from './event-geotag';
import {boundedJsonBody} from './request-body';
import {db,identity,json,loadFor} from './server';
import {persist,scope} from './store';

const token=(value:string|null)=>{if(!value||!/^[A-Za-z0-9_:.-]{1,120}$/.test(value))fail(400,'Choose one current person and visit.');return value;};
export async function eventGeotagRead(request:Request){
 const q=new URL(request.url).searchParams,actor=await identity();
 if(q.get('policy')==='1'&&q.size===1){const state=await loadFor(actor,request.headers.get('x-saha-organisation'),async()=>[]),member=scope(state,actor.userId);if(!member.isOwner)fail(403,'Only an organisation owner can read event location controls.');const response=json({policy:policyOf(state)??null});response.headers.set('x-saha-operation-actor',actor.userId);return response;}
 if([...q.keys()].some(k=>!['personId','visitId'].includes(k))||q.getAll('personId').length!==1||q.getAll('visitId').length!==1)fail(400,'Choose one current person and visit.');
 const org=request.headers.get('x-saha-organisation'),personId=token(q.get('personId')),visitId=token(q.get('visitId')),state=await loadFor(actor,org,async()=>[personId]),member=scope(state,actor.userId);eventGeotagView(state,member,personId,visitId);
 await recordAccess(db(),state,actor,member,{action:'viewPatientRecord',subject:visitId,personId,detail:'Purpose-limited event location outcome viewed; expired coordinates remain withheld.'});
 // The access-audit writer only rechecks membership. Reload the patient window and
 // repeat every person/assignment/visit guard after that await before disclosing data.
 const current=await loadFor(actor,org,async()=>[personId]),currentMember=scope(current,actor.userId),value=eventGeotagView(current,currentMember,personId,visitId);
 const response=json(value);response.headers.set('x-saha-operation-actor',actor.userId);return response;
}
export async function eventGeotagWrite(request:Request){
 const actor=await identity(),org=request.headers.get('x-saha-organisation');
 if(request.headers.get('x-saha-operation-actor')!==actor.userId)fail(403,'Bind the original signed-in account before saving this location outcome.');
 if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin||request.headers.get('sec-fetch-site')==='cross-site')fail(403,'Cross-origin changes are not allowed.');
 if(!request.headers.get('content-type')?.startsWith('application/json'))fail(415,'Use JSON for this operation.');
 const parsed=eventGeotagSchema.safeParse(await boundedJsonBody(request,5000)),key=request.headers.get('idempotency-key');
 if(!parsed.success||!key||!/^[A-Za-z0-9_-]{8,100}$/.test(key))fail(422,'Use one valid event location request and one stable original operation key.');
 const command=parsed.data,receiptKey='event-geotag:'+key,hash=await digest(command),state=await loadFor(actor,org,async()=>command.type==='recordEventGeotag'?[command.personId]:[]),member=scope(state,actor.userId);
 authorizeEventGeotag(state,member,command);
 const saved=await db().prepare('SELECT org_id,hash,result FROM command_receipts WHERE actor_id=? AND key=?').bind(actor.userId,receiptKey).first<{org_id:string;hash:string;result:string}>();
 if(saved){if(saved.org_id!==state.organisation.id||saved.hash!==hash)fail(409,'This original operation key belongs to different input or scope.');const fresh=await loadFor(actor,org,async()=>command.type==='recordEventGeotag'?[command.personId]:[]);authorizeEventGeotag(fresh,scope(fresh,actor.userId),command);return json({result:JSON.parse(saved.result),replayed:true});}
 const before=structuredClone(state),result=applyEventGeotag(state,command,actor,member);
 if(!result)fail(422,'Invalid event location request.');
 const fresh=await loadFor(actor,org,async()=>command.type==='recordEventGeotag'?[command.personId]:[]),freshMember=scope(fresh,actor.userId);authorizeEventGeotag(fresh,freshMember,command);
 if(JSON.stringify(freshMember)!==JSON.stringify(member))fail(409,'Current authority changed before save. Refresh.');
 await persist(db(),before,state,actor,{type:'eventGeotag.'+command.type},receiptKey,hash,result);
 try{const final=await loadFor(actor,org,async()=>command.type==='recordEventGeotag'?[command.personId]:[]);authorizeEventGeotag(final,scope(final,actor.userId),command);}catch(error){const withdrawn=error instanceof AppError&&[401,403].includes(error.status);return json({outcome:'accepted',operationReference:key,error:withdrawn?'The outcome was saved, then access changed. Keep this reference and do not submit again.':'The outcome was saved, but final access verification is unavailable. Keep this reference and do not submit again.'},withdrawn?403:503);}
 return json({result});
}
