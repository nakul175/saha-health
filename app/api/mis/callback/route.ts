import { db, error, json, runtime as policyRuntime } from '@/lib/saha/server';
import { AppError, digest, fail } from '@/lib/saha/core';
import { applyReceipt, misAudit, misIntegration } from '@/lib/saha/mis';
import { authenticateCallback, callbackSchema } from '@/lib/saha/mis-callback';
import { persist, readState } from '@/lib/saha/store';
export async function POST(request:Request){try{
 if(!request.headers.get('content-type')?.startsWith('application/json'))fail(415,'Use JSON.');const reader=request.body?.getReader();if(!reader)fail(400,'Missing callback.');let size=0,raw='';const decoder=new TextDecoder();while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>16000){await reader.cancel();fail(413,'Callback too large.');}raw+=decoder.decode(value,{stream:true});}raw+=decoder.decode();let body;try{body=callbackSchema.parse(JSON.parse(raw));}catch{fail(422,'Invalid callback contract.');}
 // Slice 6u (fourth review): grant and signature first, then one integration row; the organisation is read only after.
 const store=db(),verified=await authenticateCallback(raw,body,request.headers.get('x-saha-timestamp')??'',request.headers.get('x-saha-signature')??'',policyRuntime(),async(orgId,id)=>{const r=await store.prepare('SELECT data FROM integrations WHERE org_id=? AND id=?').bind(orgId,id).first<{data:string}>();try{return r?JSON.parse(r.data):null;}catch{return null;}});
 const state=await readState(store,body.organisationId),connection=misIntegration(state,body.integrationId);if(connection.endpoint!==verified.endpoint||connection.credentialBinding!==verified.credentialBinding)fail(409,'Connection route changed; partner reconciliation required.');
 if(!['accepted','rejected','pending'].includes(body.receipt.status))fail(422,'Callbacks cannot authorise resending a record.');
 const hash=await digest(body),actor={userId:'mis_callback_'+body.integrationId,displayName:'Programme receipt callback',email:''},key='callback_'+hash;
 for(let n=0;n<3;n++){
  const s=n?await readState(db(),body.organisationId):state,old=structuredClone(s),sub=s.workspace.submissions.find(x=>x.id===body.submissionId&&x.connectorId===body.integrationId);if(!sub?.delivery)fail(404,'Delivery not found.');
  if(sub.delivery.endpoint!==connection.endpoint||sub.delivery.credentialBinding!==connection.credentialBinding)fail(409,'Connection route changed; partner reconciliation required.');const previous=sub.state;applyReceipt(sub,body.receipt);if(previous===sub.state&&['accepted','rejected'].includes(previous))return json({ok:true,replayed:true});
  const prior=await db().prepare('SELECT key FROM command_receipts WHERE actor_id=? AND key=?').bind(actor.userId,key).first();if(prior)return json({ok:true,replayed:true});
  if(sub.delivery.events.length>60)fail(409,'Receipt event limit reached; investigate with the partner.');
  misAudit(s,actor,{role:'admin'} as any,'misCallback',sub.id,sub.message,sub.personId);try{await persist(db(),old,s,actor,{type:'misCallback'},key,hash,{ok:true});return json({ok:true});}catch(e){if(!(e instanceof AppError&&e.status===409)||n===2)throw e;}
 }
 return json({error:'Callback conflict; retry the signed receipt.'},409);
 }catch(e){return error(e);}}
