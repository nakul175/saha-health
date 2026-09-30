import { z } from 'zod';
import { digest, fail, uuid } from './core';
import { seedWorkspace } from './seed';
import { normallyAllowed } from './access';
import { defaultOperations, type FixtureBatch } from './operations';
import type { Actor } from './store';
import type { Member, OrgState, Person } from './types';
// Slice 2d: controlled migration (BR-DATA-11) — mark the seeded synthetic fixtures of earlier releases.
//
// Slice 6n marks the six seeded fixture people `synthetic: true` at seeding, and refuses to send a
// marked record to any destination outside the synthetic environment. Fixtures seeded before 6n
// are unmarked, so that barrier does not cover them. This migration finds them, reports a dry run
// (examined, candidates, rejected with reasons, already marked, outside the owner's care scope)
// under a plan hash bound to each candidate's record version, applies only that exact plan,
// records a batch with its counts, writes one revision per marked record (source lineage) and can
// reverse a batch. A candidate is a record with a seeded fixture id and the seeded name; a record
// with a fixture id and another name is rejected for review. Nothing else in a record changes.
export const MIGRATION='mark-seeded-fixtures-v1';
export const FIXTURES:ReadonlyMap<string,string>=new Map(seedWorkspace('2026-01-01T00:00:00.000Z').people.map(p=>[p.id,p.name]));
export const CRITERIA='Record id is one of the six seeded fixture ids and its name is the seeded name; not already marked; within the owner\'s normal care scope.';
const reason=z.string().trim().min(10,'Explain the reason in at least 10 characters.').max(500);
export const fixtureMarkSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('fixtureMarkApply'),planHash:z.string().regex(/^[0-9a-f]{64}$/),reason}).strict(),
 z.object({type:z.literal('fixtureMarkRevert'),batchId:z.string().trim().min(1).max(100),reason}).strict(),
]);
const TYPES=new Set(['fixtureMarkApply','fixtureMarkRevert']);
export function authorizeFixtureMark(_s:OrgState,m:Member,c:any){if(TYPES.has(c?.type)&&!m.isOwner)fail(403,'Only an organisation owner can run a data migration.');}
// The dry run: pure over the loaded state; ids, versions and reasons only, never names.
export async function planFixtureMarking(s:OrgState,m:Member){
 const fixtures=s.workspace.people.filter(p=>FIXTURES.has(p.id)),inScope=fixtures.filter(p=>normallyAllowed(m,p));
 const alreadyMarked=inScope.filter(p=>p.synthetic),open=inScope.filter(p=>!p.synthetic);
 const candidates=open.filter(p=>p.name===FIXTURES.get(p.id)),rejected=open.filter(p=>p.name!==FIXTURES.get(p.id)).map(p=>({personId:p.id,version:p.version,reason:'Fixture id with a name other than the seeded name; review before marking.'}));
 const planHash=await digest({migration:MIGRATION,candidates:candidates.map(p=>[p.id,p.version]),rejected:rejected.map(r=>[r.personId,r.version])});
 return {migration:MIGRATION,criteria:CRITERIA,examined:s.workspace.people.length,fixtureIds:fixtures.length,candidates:candidates.map(p=>({personId:p.id,version:p.version})),rejected,alreadyMarked:alreadyMarked.length,outOfScope:fixtures.length-inScope.length,planHash};
}
export async function applyFixtureMark(s:OrgState,input:unknown,u:Actor,m:Member,now=new Date().toISOString()):Promise<any|null>{
 const parsed=fixtureMarkSchema.safeParse(input);if(!parsed.success)return null;const c=parsed.data;authorizeFixtureMark(s,m,c);
 const ops=s.operations??=defaultOperations(),batches=ops.fixtureBatches??=[];let detail:string,result:any;
 if(c.type==='fixtureMarkApply'){
  const plan=await planFixtureMarking(s,m);
  if(plan.planHash!==c.planHash)fail(409,'Records changed since the dry run. Run the dry run again and review it before applying.');
  if(!plan.candidates.length)fail(409,'The dry run found no records to mark.');
  if(batches.length>=100)fail(422,'Migration batch history limit reached.');
  const id=uuid(),byId=new Map(s.workspace.people.map(p=>[p.id,p]));
  for(const x of plan.candidates){const p=byId.get(x.personId) as Person;p.synthetic=true;p.syntheticMark={batchId:id,at:now,by:u.userId};}
  const b:FixtureBatch={id,migration:MIGRATION,planHash:plan.planHash,at:now,by:u.userId,reason:c.reason,examined:plan.examined,marked:plan.candidates.length,rejected:plan.rejected.length,alreadyMarked:plan.alreadyMarked,outOfScope:plan.outOfScope};batches.push(b);
  detail=`Migration ${MIGRATION} batch ${id} applied from dry run ${plan.planHash}: ${plan.examined} records examined, ${b.marked} marked as synthetic fixtures, ${b.rejected} rejected for review, ${b.alreadyMarked} already marked, ${b.outOfScope} outside the owner's care scope. Reason: ${c.reason}`;
  result={batchId:id,marked:b.marked,rejected:b.rejected};
 } else {
  const b=batches.find(x=>x.id===c.batchId);if(!b)fail(404,'Migration batch not found.');if(b.revertedAt)fail(409,'This batch has already been reversed.');
  const marked=s.workspace.people.filter(p=>p.syntheticMark?.batchId===b.id);
  for(const p of marked){delete p.synthetic;delete p.syntheticMark;}
  Object.assign(b,{revertedAt:now,revertedBy:u.userId,revertReason:c.reason,reverted:marked.length});
  detail=`Migration ${b.migration} batch ${b.id} reversed: ${marked.length} of ${b.marked} marks removed. Reason: ${c.reason}`;
  result={batchId:b.id,reverted:marked.length};
 }
 s.workspace.audit.push({id:uuid(),at:now,actorId:u.userId,actor:u.displayName,role:m.role,action:c.type,subject:s.organisation.id,detail});
 return result;
}
