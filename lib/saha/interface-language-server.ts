import { z } from 'zod';
import { db, identity, json, runtime, command, error } from './server';
import { readState, scope, type Actor } from './store';
import { fail, digest, AppError } from './core';
import { environmentOf } from './environment';
import { patientId } from './patient-directory';
import { recordAccess, accessRoute } from './access-audit';
import { assertAssignedRead } from './routine-read-guard';
import { boundedJsonBody } from './request-body';
import { currentInterfaceLanguage, interfaceLanguageContext, interfaceLanguageChange, interfaceLanguageReceipt, interfaceLanguageRefusal } from './interface-language';
import { interfaceLanguageTransferReadProof, INTERFACE_LANGUAGE_TRANSFER_PROOF_SQL } from './interface-language-read-guard';
const SQL = ['SELECT id,revision FROM organisations WHERE id=?',
  'SELECT user_id,role,status,version,is_owner FROM memberships WHERE org_id=? ORDER BY user_id',
  'SELECT user_id,team_id FROM team_members WHERE org_id=? ORDER BY user_id,team_id',
  'SELECT data FROM operations WHERE org_id=?',
  'SELECT id,version,team_id,assigned_to,data FROM patients WHERE org_id=? AND id=?', INTERFACE_LANGUAGE_TRANSFER_PROOF_SQL];
async function proof(org:string,personId:string) { return (await db().batch(SQL.map((sql,index)=>db().prepare(sql).bind(...(index===4?[org,personId]:[org]))))).map(row=>row.results); }
async function bind(request:Request) {
  const actor=await identity(),query=new URL(request.url).searchParams;
  if ([...query.keys()].some(key=>key!=='personId') || query.getAll('personId').length!==1) fail(400,'Choose one existing assigned person.');
  const personId=patientId(query.get('personId')),org=patientId(request.headers.get('x-saha-organisation'));
  if (!['synthetic','training'].includes(environmentOf(runtime()).name)) fail(409,'Use a synthetic or training workspace.');
  const expected=request.headers.get('x-saha-operation-actor');
  if(expected!==null && expected!==actor.userId) fail(403,'The signed-in account changed. Use the original account.');
  return {actor,org,personId};
}
async function current(actor:Actor,org:string,personId:string,forDispatch=false) {
  const before=await proof(org,personId),state=await readState(db(),org,[personId],actor.userId,true),member=scope(state,actor.userId);
  if(member.role!=='asha') fail(403,'An active ASHA membership is required.');
  const person=state.workspace.people.find(row=>row.id===personId&&row.assigned&&row.assignedTo===actor.userId&&!row.mergedInto);
  if(!person)fail(404,'This record is not in your assigned care scope.');
  const pending=interfaceLanguageTransferReadProof(before[SQL.length-1],[personId],new Date().toISOString(),forDispatch);
  if(forDispatch&&pending.refreshAt)fail(409,'A recorded assignment transfer is pending. Resolve it through Today or a steward before changing this display preference.');
  let language;try {language=currentInterfaceLanguage(state.operations?.memberLanguages,actor.userId);} catch { fail(503,'Current language choice is unavailable.'); }
  await recordAccess(db(),state,actor,member,{action:'viewPatientRecord',subject:personId,personId,
    detail:`Own display-language preference for the selected routine record; no patient facts returned.${accessRoute(member,person)}`});
  await assertAssignedRead(db(),member,org,{personId});
  const final=await proof(org,personId);
  if(JSON.stringify(before)!==JSON.stringify(final))fail(409,'Current language or care context changed. Refresh current access.');
  const transfer=interfaceLanguageTransferReadProof(final[SQL.length-1],[personId],new Date().toISOString(),forDispatch);
  return interfaceLanguageContext.parse({actorId:actor.userId,organisationId:org,personId,...language,refreshAt:transfer.refreshAt});
}
function reply(value:unknown,actor:Actor,org:string,status=200) {
  const response=json(value,status);response.headers.set('x-saha-operation-actor',actor.userId);response.headers.set('x-saha-organisation',org);return response;
}
export async function interfaceLanguageRead(request:Request) {
  const {actor,org,personId}=await bind(request);return reply(await current(actor,org,personId),actor,org);
}
export async function interfaceLanguageWrite(request:Request) {
  const {actor,org,personId}=await bind(request);
  if(request.headers.get('x-saha-operation-actor')!==actor.userId)fail(403,'Bind the original account before changing its language.');
  const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin||request.headers.get('sec-fetch-site')==='cross-site')fail(403,'Cross-origin changes are not allowed.');
  if(!request.headers.get('content-type')?.startsWith('application/json'))fail(415,'Use JSON for this operation.');
  const parsed=interfaceLanguageChange.safeParse(await boundedJsonBody(request,1000)),key=z.string().uuid().safeParse(request.headers.get('idempotency-key'));
  if(!parsed.success||!key.success)fail(422,'Choose English or Hindi with the current version and one original operation key.');
  const change=parsed.data,c={type:'setMyLanguage' as const,...change};let dispatched=false;
  try {
    const initial=await current(actor,org,personId,true),hash=await digest(c);
    const saved=await db().prepare('SELECT org_id,hash,command_type,result FROM command_receipts WHERE actor_id=? AND key=?').bind(actor.userId,key.data).first<{org_id:string;hash:string;command_type:string;result:string}>();
    if(saved&&(saved.org_id!==org||saved.hash!==hash||saved.command_type!=='setMyLanguage'))fail(409,'This original key belongs to different input or scope.');
    if(!saved && initial.version!==change.version) fail(409,'Your language in this organisation changed. Refresh before choosing again.');
    if(!saved && initial.version===Number.MAX_SAFE_INTEGER) fail(422,'The current language version cannot be advanced safely. Keep the saved preference.');
    if(!saved && initial.language===change.language) fail(422,'This is already your language in this organisation.');
    // Receipt lookup/digest are awaited. Recheck the original actor/person/scope and
    // current transfer clock before entering the unchanged authoritative writer.
    const final=await current(actor,org,personId,true);
    if(!saved && (final.version!==initial.version||final.language!==initial.language))fail(409,'Current language changed. Refresh before choosing again.');
    const headers=new Headers(request.headers);headers.delete('content-length');headers.set('x-saha-organisation',org);
    dispatched=true;
    const result=await command(new Request(request.url,{method:'POST',headers,body:JSON.stringify(c)}));
    const operation=z.object({language:z.enum(['en','hi']),version:z.number().int().positive()}).strict().safeParse(result.result);
    if(!operation.success||operation.data.language!==change.language||operation.data.version!==change.version+1)fail(409,'The exact preference receipt could not be matched. Keep the attempt unresolved.');
    // Replaying an old valid receipt does not roll back a newer own preference.
    const latest=await current(actor,org,personId);
    if(latest.version<operation.data.version||latest.version===operation.data.version&&latest.language!==operation.data.language)fail(409,'The saved preference and current readback could not be matched. Keep the exact original attempt unresolved.');
    return reply(interfaceLanguageReceipt.parse({context:latest,operation:{key:key.data,...operation.data,replayed:result.replayed===true}}),actor,org);
  } catch(cause) {
    // This witness describes only this request. A previously uncertain attempt
    // must still retain its original key/body; it is not a global absence proof.
    if(!dispatched&&cause instanceof AppError) return reply({error:cause.message,operation:interfaceLanguageRefusal.parse({outcome:'request-not-dispatched',key:key.data,actorId:actor.userId,organisationId:org,personId,...change})},actor,org,cause.status);
    return error(cause);
  }
}
