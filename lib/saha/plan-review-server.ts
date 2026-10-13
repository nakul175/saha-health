import { identity, db, loadFor, runtime, json, command } from './server';
import { activePlan, fail, AppError } from './core';
import { scope, type Actor } from './store';
import { environmentOf } from './environment';
import { ensurePurpose } from './purpose-scope';
import { recordAccess, accessRoute } from './access-audit';
import { assertAssignedRead } from './routine-read-guard';
import { patientId } from './patient-directory';
import { boundedJsonBody } from './request-body';
import { reviewOperation, reviewProjection } from './plan-review';

function response(body: unknown, actor: Actor, org: string) {
  const r=json(body); r.headers.set('x-saha-operation-actor',actor.userId); r.headers.set('x-saha-organisation',org); return r;
}
function organisation(request: Request) { const org=request.headers.get('x-saha-organisation'); if(!org) fail(400,'Select an explicit organisation.'); return patientId(org); }
async function assigned(actor: Actor, org: string, id: string, visitId?: string) {
  const state=await loadFor(actor,org,async()=>[id]),member=scope(state,actor.userId);
  if(member.role!=='asha') fail(403,'Action review requires an active ASHA membership.');
  ensurePurpose(member,'programme-delivery',state.operations?.purposeGrants);
  const person=state.workspace.people.find(p=>p.id===id&&p.assigned&&p.assignedTo===actor.userId&&!p.mergedInto);
  if(!person) fail(404,'This record is not in your assigned care scope.');
  const visit=visitId?state.workspace.visits.find(v=>v.id===visitId&&v.personId===id&&v.state==='confirmed'&&!v.imported&&!v.voidedAt&&!v.supersededBy):undefined;
  if(visitId&&!visit) fail(404,'Choose a current original confirmed visit of this person.');
  let stale: string|null=null;
  if(visit?.plan) try {activePlan(state.workspace,visit,visit.plan.id);} catch(cause) {if(!(cause instanceof AppError)) throw cause; stale='The facts, permissions or destination changed. Prepare and review a fresh bundle.';}
  // Retain stale-plan metadata only when all named destinations remain resolvable;
  // otherwise fail closed rather than omit one recipient from the review.
  return {state,member,person,visit,review:reviewProjection(org,person,state.workspace.visits,state.workspace.integrations,visitId,stale)};
}
async function context(actor: Actor, org: string, id: string, visitId?: string) {
  const initial=await assigned(actor,org,id,visitId);
  await recordAccess(db(),initial.state,actor,initial.member,{action:'viewPatientRecord',subject:id,personId:id,detail:`Bounded action-review context.${accessRoute(initial.member,initial.person)}`});
  const current=await assigned(actor,org,id,visitId);
  if(JSON.stringify(current.review)!==JSON.stringify(initial.review)) fail(409,'The review changed while opening. Refresh before reviewing.');
  await assertAssignedRead(db(),current.member,org,{personId:id},current.visit?{id:current.visit.id,personId:id,minimumVersion:current.visit.version}:undefined);
  return current.review;
}
function environment() {if(!['synthetic','training'].includes(environmentOf(runtime()).name)) fail(409,'Action review requires a synthetic or training workspace.');}
export async function planReviewRead(request: Request) {
  environment(); const actor=await identity(),org=organisation(request),q=new URL(request.url).searchParams;
  if([...q.keys()].some(k=>!['personId','visitId'].includes(k))||q.getAll('personId').length!==1||q.getAll('visitId').length>1) fail(400,'Choose one person and at most one visit.');
  const id=patientId(q.get('personId')),v=q.has('visitId')?patientId(q.get('visitId')):undefined;
  return response(await context(actor,org,id,v),actor,org);
}
export async function planReviewWrite(request: Request) {
  environment(); const actor=await identity(),org=organisation(request);
  if(request.headers.get('x-saha-operation-actor')!==actor.userId) fail(403,'The signed-in account changed. Refresh with the original account.');
  if(new URL(request.url).search) fail(400,'Action review changes do not accept query selectors.');
  const origin=request.headers.get('origin');
  if((origin&&origin!==new URL(request.url).origin)||request.headers.get('sec-fetch-site')==='cross-site') fail(403,'Cross-origin changes are not allowed.');
  if(!request.headers.get('content-type')?.startsWith('application/json')) fail(415,'Use JSON for this operation.');
  const parsed=reviewOperation.safeParse(await boundedJsonBody(request,20000));
  if(!parsed.success) fail(422,'Choose one person and one supported review operation.');
  const input=parsed.data,id=patientId(input.personId),v=patientId(input.command.visitId);
  await context(actor,org,id,v);
  const headers=new Headers(request.headers); headers.delete('content-length'); headers.set('x-saha-organisation',org);
  const result=await command(new Request(request.url,{method:'POST',headers,body:JSON.stringify(input.command)}));
  // A failed post-write read remains uncertain to the caller, never a retry signal.
  return response({result:result.result,replayed:Boolean(result.replayed),context:await context(actor,org,id,v)},actor,org);
}
