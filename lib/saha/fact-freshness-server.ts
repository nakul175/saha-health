import { identity,loadFor,db,json,runtime } from './server';
import { scope,type Actor } from './store';
import { fail } from './core';
import { environmentOf } from './environment';
import { patientId } from './patient-directory';
import { ensurePurpose } from './purpose-scope';
import { recordAccess,accessRoute } from './access-audit';
import { assertAssignedRead } from './routine-read-guard';
import { checkSourceCommand } from './clinical-source';
import { factFreshnessProjection } from './fact-freshness';
import { assertFreshnessPurpose } from './fact-freshness-purpose';
import type { D1PreparedStatement } from '@cloudflare/workers-types';

async function assigned(actor:Actor,org:string,id:string,visitId:string|undefined,expected:number|undefined,now:string){
  const state=await loadFor(actor,org,async()=>[id]),member=scope(state,actor.userId);
  if(member.role!=='asha')fail(403,'Fact review requires an active ASHA membership.');
  ensurePurpose(member,'care-coordination',state.operations?.purposeGrants);
  const person=state.workspace.people.find(p=>p.id===id&&p.assigned&&p.assignedTo===actor.userId&&!p.mergedInto);if(!person)fail(404,'This record is not in your assigned care scope.');
  const visit=visitId?state.workspace.visits.find(v=>v.id===visitId&&v.personId===id&&!v.voidedAt&&!v.supersededBy):undefined;
  if(visitId&&(!visit||visit.version!==expected))fail(409,'The selected existing visit changed. Refresh and choose again.');
  if(visit)await checkSourceCommand(db(),state,{type:'checkProtocol',visitId:visit.id},member);
  return {state,member,person,visit,review:factFreshnessProjection(org,actor.userId,state,member,person,visitId,now)};
}
export async function factFreshnessRead(request:Request){
  if(!['synthetic','training'].includes(environmentOf(runtime()).name))fail(409,'Fact review requires a synthetic or training workspace.');
  const actor=await identity(),rawOrg=request.headers.get('x-saha-organisation');if(!rawOrg)fail(400,'Choose an explicit organisation.');const org=patientId(rawOrg),q=new URL(request.url).searchParams;
  if([...q.keys()].some(k=>!['personId','visitId','version'].includes(k))||q.getAll('personId').length!==1||q.getAll('visitId').length>1||q.getAll('version').length>1||q.has('visitId')!==q.has('version'))fail(400,'Choose one assigned person and an exact existing visit/version.');
  const expectedActor=request.headers.get('x-saha-operation-actor');if(expectedActor&&expectedActor!==actor.userId)fail(403,'The signed-in account changed. Return to Today.');
  const id=patientId(q.get('personId')),visitId=q.has('visitId')?patientId(q.get('visitId')):undefined,rawVersion=q.get('version'),expected=rawVersion===null?undefined:Number(rawVersion);
  if(rawVersion!==null&&(!/^[1-9]\d*$/.test(rawVersion)||!Number.isSafeInteger(expected)))fail(400,'Choose an exact current visit version.');
  const now=new Date().toISOString(),initial=await assigned(actor,org,id,visitId,expected,now);
  await recordAccess(db(),initial.state,actor,initial.member,{action:'viewRecordHistory',subject:id,personId:id,detail:`Read-only original fact time/freshness context; no reuse or model execution.${accessRoute(initial.member,initial.person)}`});
  const current=await assigned(actor,org,id,visitId,expected,now);
  if(JSON.stringify(current.review)!==JSON.stringify(initial.review)||current.member.version!==initial.member.version)fail(409,'Facts, rules or permissions changed while opening. Refresh and choose again.');
  const database=db();let batches=0;const consistent=new Proxy(database,{get(target,key){if(key==='batch')return async(statements:D1PreparedStatement[])=>{const rows=await target.batch([...statements,target.prepare("SELECT json_type(data) AS root_type,data FROM operations WHERE org_id=?").bind(org)]);const proof=rows.pop();assertFreshnessPurpose(current.member,proof?.results);batches++;return rows;};const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});
  await assertAssignedRead(consistent,current.member,org,{personId:id},current.visit?{id:current.visit.id,personId:id,minimumVersion:current.visit.version}:undefined);
  if(batches!==1)fail(503,'Current fact review scope is unavailable.');
  const response=json(current.review);response.headers.set('x-saha-operation-actor',actor.userId);response.headers.set('x-saha-organisation',org);return response;
}
