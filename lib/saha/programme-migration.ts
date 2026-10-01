import { z } from 'zod';
import { digest, fail, uuid } from './core';
import { normallyAllowed } from './access';
import { defaultOperations, type ProgrammeMigrationBatch } from './operations';
import { PACKS, adoptedVersion, latestVersion, packAt, type Pack, type PackId } from './programmes';
import type { Actor } from './store';
import type { Member, OrgState, Person } from './types';
// Slice 4e: reviewed migration of open programme episodes to a newer pack version (BR-PROG-07).
//
// Every episode is pinned to the pack version it opened on, and every visit keeps a copy of the pack
// version it captured under. When the catalogue carries a newer version of a pack, an owner or a
// clinician runs a dry run over the open episodes on older versions in their normal care scope: what
// would change between the versions (questions added, removed, renamed or redefined; schedule and
// escalation text), which episodes would move, and which cannot move automatically and why. The dry
// run carries a plan hash bound to the pack, the target and adopted versions and each listed episode's
// record version. Apply recomputes the plan and refuses unless the hash matches, moves exactly the
// listed episodes (one record revision each, with the reason and the from/to versions), appends the
// change to the episode's own history, records one counted batch and one audit event, and, when the
// applier is an owner, adopts the target version for new episodes so open and new work move together.
// Visits and submissions are never rewritten: confirmed work keeps the pack version it was made under.
export const MIGRATION='programme-pack-version';
const reason=z.string().trim().min(10,'Explain the reason in at least 10 characters.').max(500);
const packId=z.enum(['maternal','tb','hypertension']);
export const programmeMigrationSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('programmeMigrationApply'),packId,targetVersion:z.number().int().positive(),planHash:z.string().regex(/^[0-9a-f]{64}$/),reason}).strict(),
]);
const TYPES=new Set(['programmeMigrationApply']);
export const mayMigrate=(m:Member)=>m.status==='active'&&(m.isOwner||m.role==='clinician');
export function authorizeProgrammeMigration(_s:OrgState,m:Member,c:any){if(TYPES.has(c?.type)&&!mayMigrate(m))fail(403,'Only an organisation owner or a clinician can migrate programme episodes.');}
// What changes between two versions of a pack. Question ids, flags and descriptive text only.
export function packChanges(from:Pack,to:Pack){
 const old=new Map(from.questions.map(q=>[q.id,q])),toIds=new Set(to.questions.map(q=>q.id));
 const renamed=to.questions.filter(q=>q.renamedFrom&&old.has(q.renamedFrom)&&!old.has(q.id)).map(q=>({from:q.renamedFrom!,to:q.id,relabelled:old.get(q.renamedFrom!)!.label!==q.label}));
 const renamedFrom=new Set(renamed.map(r=>r.from));
 const added=to.questions.filter(q=>!old.has(q.id)&&!renamedFrom.has(q.renamedFrom??'')).map(q=>({id:q.id,required:q.required}));
 const removed=from.questions.filter(q=>!toIds.has(q.id)&&!renamedFrom.has(q.id)).map(q=>q.id);
 const shape=(q:any)=>JSON.stringify({label:q.label,unit:q.unit??null,fact:q.fact??null,options:q.options??null,when:q.when??null,required:q.required});
 const redefined=to.questions.filter(q=>old.has(q.id)&&shape(old.get(q.id))!==shape(q)).map(q=>q.id);
 return {fromVersion:from.version,toVersion:to.version,reviewedMapping:!!to.migratesFrom?.includes(from.version),added,removed,renamed,redefined,
  schedule:{from:from.schedule??null,to:to.schedule??null,changed:(from.schedule??null)!==(to.schedule??null)},
  escalation:{from:from.escalation??null,to:to.escalation??null,changed:(from.escalation??null)!==(to.escalation??null)},note:to.changeNote??null};
}
const openDraft=(s:OrgState,p:Person,enrolmentId:string)=>s.workspace.visits.some(v=>v.personId===p.id&&v.state==='draft'&&!v.voidedAt&&!v.supersededBy&&v.programmeCapture?.packs.some(x=>x.enrolmentId===enrolmentId));
// Why an in-scope episode cannot move automatically; null when it can.
export function episodeBlocker(s:OrgState,p:Person,e:{id:string;packVersion:number},target:Pack):{code:string;reason:string}|null{
 if(!packAt(target.id,e.packVersion))return {code:'unknown-version',reason:`The episode's pack version v${e.packVersion} is not in this deployment's catalogue; review it manually.`};
 if(!target.migratesFrom?.includes(e.packVersion))return {code:'no-reviewed-mapping',reason:`No reviewed mapping from v${e.packVersion} to v${target.version} is declared; keep the episode on v${e.packVersion} or migrate it manually.`};
 if((p.restrictions??[]).some(r=>!r.liftedAt))return {code:'restricted',reason:'Processing of this record is restricted; the episode stays on its version until the restriction is lifted.'};
 if(openDraft(s,p,e.id))return {code:'open-visit',reason:`An open visit is capturing this episode under v${e.packVersion}; confirm or discard it, then run the dry run again.`};
 return null;
}
// The dry run for one pack: pure over the loaded state; ids, versions, counts and reasons only, never names or labels.
export async function planProgrammeMigration(s:OrgState,m:Member,id:PackId){
 const targetVersion=latestVersion(id),target=packAt(id,targetVersion)!,adopted=adoptedVersion(s,id);
 const episodes=s.workspace.people.flatMap(p=>(p.enrolments??[]).filter(e=>e.packId===id&&e.state==='active'&&e.packVersion<targetVersion).map(e=>({p,e})));
 const mine=episodes.filter(x=>normallyAllowed(m,x.p)),candidates:any[]=[],blocked:any[]=[];
 for(const {p,e} of mine){const b=episodeBlocker(s,p,e,target);const base={personId:p.id,enrolmentId:e.id,version:p.version,fromVersion:e.packVersion};
  if(b)blocked.push({...base,...b});else candidates.push({...base,openFollowUps:(p.followUps??[]).filter(t=>t.enrolmentId===e.id&&t.state==='open').length,keptVisits:s.workspace.visits.filter(v=>v.personId===p.id&&v.state!=='draft'&&v.programmeCapture?.packs.some(x=>x.enrolmentId===e.id)).length});}
 const fromVersions=[...new Set([...mine.map(x=>x.e.packVersion),...(adopted<targetVersion?[adopted]:[])])].sort((a,b)=>a-b);
 const changes=fromVersions.map(v=>packAt(id,v)).filter((x):x is Pack=>!!x).map(from=>packChanges(from,target));
 const adopts=m.isOwner&&adopted<targetVersion;
 const planHash=await digest({migration:MIGRATION,packId:id,targetVersion,adopted,adopts,candidates:candidates.map(c=>[c.personId,c.enrolmentId,c.version,c.fromVersion]),blocked:blocked.map(b=>[b.personId,b.enrolmentId,b.version,b.code])});
 return {migration:MIGRATION,packId:id,name:target.name,targetVersion,adoptedVersion:adopted,adopts,adoptionNote:adopted>=targetVersion?`New episodes already open on v${targetVersion}.`:adopts?`Applying also opens new episodes on v${targetVersion}.`:`New episodes keep opening on v${adopted} until an owner applies a migration of this pack.`,
  examined:episodes.length,changes,candidates,blocked,outOfScope:episodes.length-mine.length,planHash};
}
// Packs with a newer version than their adopted version or than any open episode.
export function migratablePacks(s:OrgState):PackId[]{return [...new Set(PACKS.map(p=>p.id))].filter(id=>{const t=latestVersion(id);return adoptedVersion(s,id)<t||s.workspace.people.some(p=>(p.enrolments??[]).some(e=>e.packId===id&&e.state==='active'&&e.packVersion<t));});}
export async function applyProgrammeMigration(s:OrgState,input:unknown,u:Actor,m:Member,now=new Date().toISOString()):Promise<any|null>{
 const parsed=programmeMigrationSchema.safeParse(input);if(!parsed.success)return null;const c=parsed.data;authorizeProgrammeMigration(s,m,c);
 if(c.targetVersion!==latestVersion(c.packId))fail(409,'A different version is now the latest for this pack. Run the dry run again.');
 const plan=await planProgrammeMigration(s,m,c.packId);
 if(plan.planHash!==c.planHash)fail(409,'Episodes changed since the dry run. Run the dry run again and review it before applying.');
 if(!plan.candidates.length&&!plan.adopts)fail(409,'The dry run found nothing to migrate.');
 const ops=s.operations??=defaultOperations(),batches=ops.programmeMigrations??=[];if(batches.length>=100)fail(422,'Programme migration batch history limit reached.');
 const id=uuid(),byId=new Map(s.workspace.people.map(p=>[p.id,p]));
 for(const x of plan.candidates){const p=byId.get(x.personId) as Person,e=p.enrolments!.find(e=>e.id===x.enrolmentId)!;
  (e.migrations??=[]).push({batchId:id,from:e.packVersion,to:plan.targetVersion,at:now,by:u.userId,reason:c.reason,planHash:plan.planHash});
  p.packMigration={batchId:id,enrolmentId:e.id,packId:e.packId,from:e.packVersion,to:plan.targetVersion,at:now};e.packVersion=plan.targetVersion;p.version++;}
 if(plan.adopts)(ops.packVersions??={})[c.packId]=plan.targetVersion;
 const b:ProgrammeMigrationBatch={id,packId:c.packId,fromVersions:[...new Set(plan.candidates.map(x=>x.fromVersion as number))].sort((a,b)=>a-b),toVersion:plan.targetVersion,planHash:plan.planHash,at:now,by:u.userId,reason:c.reason,examined:plan.examined,migrated:plan.candidates.length,blocked:plan.blocked.length,outOfScope:plan.outOfScope,adopted:plan.adopts,previousAdopted:plan.adoptedVersion};batches.push(b);
 const detail=`Programme migration ${c.packId} to v${plan.targetVersion}, batch ${id}, applied from dry run ${plan.planHash}: ${plan.examined} open episodes on older versions examined, ${b.migrated} migrated, ${b.blocked} left on their version for manual action, ${b.outOfScope} outside the applier's care scope.${b.adopted?` New episodes now open on v${plan.targetVersion} (previously v${plan.adoptedVersion}).`:''} Confirmed visits keep their versions. Reason: ${c.reason}`;
 s.workspace.audit.push({id:uuid(),at:now,actorId:u.userId,actor:u.displayName,role:m.role,action:c.type,subject:s.organisation.id,detail});
 return {batchId:id,migrated:b.migrated,blocked:b.blocked,outOfScope:b.outOfScope,adopted:b.adopted};
}
