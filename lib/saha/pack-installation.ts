import { VALUE_RANGES, POPULATION_RANGES } from './fact-provenance';
import { z } from 'zod';
import { digest, fail, uuid } from './core';
import { defaultOperations } from './operations';
import { PACKS, RESERVED_QUESTION_IDS, adoptedVersion, catalogueOf, enrollablePacks, type Pack, type Question } from './programmes';
import type { Actor } from './store';
import type { Member, OrgState } from './types';
// Slice 4f: governed runtime installation of a programme pack, or of a new version of an existing pack, without a code
// change (BR-PROG-08). An owner uploads a manifest (JSON data only: questions, shared measurement facts with their fixed
// units, answer options, show-when conditions, a follow-up interval and escalation rules in the protocol rule vocabulary;
// no code and no free-form expressions). The server validates it against a strict schema, checks it against the compiled
// and installed catalogue, and stages it as a draft. A clinician other than the uploader reviews the exact manifest hash
// and approves or rejects it; an owner then activates the approved version. Activation, review and retirement are
// versioned in the installation's own history and audited. Retirement (never deletion) reverses an activation: no new
// episodes open on a retired version and it stops being a migration target, while episodes already pinned to it keep it.
// Episodes open only on compiled or activated versions; slice 4e migration moves open episodes to an installed version
// when the manifest declares a reviewed mapping (migratesFrom, renamedFrom). Installed packs are synthetic configuration:
// a governance review here is not clinical approval of the content.
export const MANIFEST_FORMAT='saha-pack-manifest-1';
export const MAX_MANIFEST_CHARS=8000,MAX_INSTALLATIONS=12;
export const NOT_CLINICALLY_APPROVED='Installed packs are synthetic configuration. Review and activation here are a governance check of structure and conflicts; they are not clinical approval of the content.';
const PROGRAMMES=['Maternal care','Chronic care','TB screening','Child health','General care'] as const;
// A measurement question captures a shared visit fact; its id is the fact key and its unit is fixed.
export const FACT_UNITS={weight:'kg',systolic:'mmHg',diastolic:'mmHg',temperature:'°C',weeks:'weeks',coughDays:'days'} as const;
type FactKey=keyof typeof FACT_UNITS;
const qid=z.string().regex(/^[a-z][a-zA-Z0-9_]{1,39}$/,'Question ids are 2–40 letters, digits or underscores, starting with a lower-case letter.').refine(x=>!RESERVED_QUESTION_IDS.has(x),'This question id is a reserved name (such as constructor or toString). Choose another id.');
// Slice 6z: ids that name Object.prototype members are refused (answers are also read as own properties only).
const label=z.string().trim().min(3).max(160);
const question=z.object({id:qid,label,required:z.boolean(),fact:z.enum(Object.keys(FACT_UNITS) as [FactKey,...FactKey[]]).optional(),unit:z.enum(['kg','mmHg','°C','weeks','days']).optional(),options:z.array(z.string().trim().min(1).max(60)).min(2).max(8).optional(),when:z.object({id:qid,value:z.string().trim().min(1).max(60)}).strict().optional(),renamedFrom:qid.optional()}).strict();
// The escalation vocabulary of the governed protocol rules (slice 4a/5x): a question, gte/lte/eq/missing and a value.
const rule=z.object({id:z.string().regex(/^[a-z][a-z0-9-]{0,40}$/),label,condition:z.object({questionId:qid,operator:z.enum(['gte','lte','eq','missing']),value:z.string().trim().max(30)}).strict(),urgency:z.enum(['review','urgent_review'])}).strict();
export const packManifestSchema=z.object({format:z.literal(MANIFEST_FORMAT),id:z.string().regex(/^[a-z][a-z0-9_]{1,31}$/,'Pack ids are 2–32 lower-case letters, digits or underscores.'),version:z.number().int().min(1).max(999),name:z.string().trim().min(3).max(80),programme:z.enum(PROGRAMMES),purpose:z.string().trim().min(10).max(300),
 questions:z.array(question).min(1).max(25),schedule:z.object({followUpWithinDays:z.number().int().min(1).max(365),note:z.string().trim().max(300).optional()}).strict().optional(),escalation:z.array(rule).max(10).optional(),migratesFrom:z.array(z.number().int().min(1).max(999)).max(10).optional(),changeNote:z.string().trim().min(10).max(300)}).strict();
export type PackManifest=z.infer<typeof packManifestSchema>;
export type InstallState='staged'|'approved'|'rejected'|'active'|'retired';
export type InstalledPack={id:string;packId:string;version:number;state:InstallState;manifest:PackManifest;manifestHash:string;pack:Pack;stagedBy:string;stagedAt:string;reason:string;
 review?:{by:string;memberVersion:number;at:string;decision:'approve'|'reject';reason:string};activatedAt?:string;activatedBy?:string;retiredAt?:string;retiredBy?:string;history:{state:InstallState;at:string;by:string;reason:string}[]};
const reason=z.string().trim().min(10,'Explain the reason in at least 10 characters.').max(500);
const iid=z.string().min(1).max(100),hash=z.string().regex(/^[0-9a-f]{64}$/);
export const packInstallationSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('packInstallStage'),manifest:z.unknown().refine(x=>x!==undefined&&JSON.stringify(x).length<=MAX_MANIFEST_CHARS,`Upload a pack manifest of at most ${MAX_MANIFEST_CHARS.toLocaleString('en')} characters.`),reason}).strict(),
 z.object({type:z.literal('packInstallReview'),installationId:iid,manifestHash:hash,decision:z.enum(['approve','reject']),reason}).strict(),
 z.object({type:z.literal('packInstallActivate'),installationId:iid,manifestHash:hash,reason}).strict(),
 z.object({type:z.literal('packInstallRetire'),installationId:iid,reason}).strict(),
]);
const TYPES=new Set(['packInstallStage','packInstallReview','packInstallActivate','packInstallRetire']);
export const installationsOf=(s:OrgState)=>s.operations?.installedPacks??[];
const active=(m:Member)=>m.status==='active';
export const mayReadInstallations=(m:Member)=>active(m)&&(m.isOwner||m.role==='clinician');
// The reviewer is a clinician other than the uploader (the slice 5b/5d independent-review rule).
export const mayReview=(m:Member,x:InstalledPack)=>active(m)&&m.role==='clinician'&&m.userId!==x.stagedBy;
function installation(s:OrgState,id:string){const x=installationsOf(s).find(x=>x.id===id);if(!x)fail(404,'Pack installation not found.');return x!;}
export function authorizePackInstallation(s:OrgState,m:Member,c:any){
 if(!TYPES.has(c?.type))return;
 if(c.type==='packInstallReview'){const x=installation(s,c.installationId);if(m.role!=='clinician'||!active(m))fail(403,'A clinician reviews pack installations.');if(!mayReview(m,x))fail(403,'The reviewer must be a different person from the one who uploaded the pack.');return;}
 if(!m.isOwner||!active(m))fail(403,'An organisation owner uploads, activates and retires programme packs.');
}
// Structural checks the schema cannot express. Messages name the question or rule; never patient data.
export function manifestIssues(x:PackManifest){
 const issues:string[]=[],ids=new Set<string>(),byId=new Map<string,PackManifest['questions'][number]>();
 x.questions.forEach((q,i)=>{
  if(ids.has(q.id))issues.push(`Question ${q.id} appears more than once.`);ids.add(q.id);
  if(!!q.fact===!!q.options)issues.push(`Question ${q.id} must be either a measurement (fact) or a choice (options), not both or neither.`);
  if(q.fact){if(q.id!==q.fact)issues.push(`Measurement question ${q.id} must use its fact key ${q.fact} as its id.`);if(q.unit!==FACT_UNITS[q.fact])issues.push(`Measurement ${q.fact} is recorded in ${FACT_UNITS[q.fact]}.`);}
  else if(q.unit)issues.push(`Choice question ${q.id} cannot have a unit.`);
  if(q.options&&new Set(q.options).size!==q.options.length)issues.push(`Question ${q.id} repeats an option.`);
  if(q.when){const d=byId.get(q.when.id);if(!d||!d.options)issues.push(`Question ${q.id} can only depend on an earlier choice question.`);else if(!d.options.includes(q.when.value))issues.push(`Question ${q.id} depends on a value that ${q.when.id} does not offer.`);}
  if(q.renamedFrom&&!x.migratesFrom?.length)issues.push(`Question ${q.id} names an earlier id but the manifest declares no reviewed mapping (migratesFrom).`);
  byId.set(q.id,q);if(i>=25)issues.push('Too many questions.');
 });
 for(const q of x.questions)if(q.renamedFrom&&ids.has(q.renamedFrom))issues.push(`Question ${q.id} is renamed from ${q.renamedFrom}, which is still a question in this version.`);
 const rules=new Set<string>();
 for(const r of x.escalation??[]){
  if(rules.has(r.id))issues.push(`Escalation rule ${r.id} appears more than once.`);rules.add(r.id);
  const q=byId.get(r.condition.questionId),v=r.condition.value,op=r.condition.operator;
  if(!q){issues.push(`Escalation rule ${r.id} refers to a question this pack does not ask.`);continue;}
  if(op==='missing'){if(v)issues.push(`Escalation rule ${r.id}: "missing" takes no value.`);}
  else if(q.fact){if(!/^-?\d{1,4}(\.\d{1,2})?$/.test(v))issues.push(`Escalation rule ${r.id} needs a number for ${q.id}.`);}
  else if(op!=='eq')issues.push(`Escalation rule ${r.id}: choice question ${q.id} can only be compared with "eq".`);
  else if(!q.options?.includes(v))issues.push(`Escalation rule ${r.id} compares ${q.id} with a value it does not offer.`);
 }
 const from=x.migratesFrom??[];if(new Set(from).size!==from.length)issues.push('migratesFrom repeats a version.');if(from.some(v=>v>=x.version))issues.push('migratesFrom can only name earlier versions.');
 return issues;
}
const opText={gte:'at or above',lte:'at or below',eq:'is',missing:'is not recorded'} as const;
export function packFromManifest(x:PackManifest,installationId:string,manifestHash:string):Pack{
 const questions:Question[]=x.questions.map(q=>({id:q.id,label:q.label,required:q.required,...(q.fact?{fact:q.fact,unit:FACT_UNITS[q.fact]}:{}),...(q.options?{options:[...q.options]}:{}),...(q.when?{when:{...q.when}}:{}),...(q.renamedFrom?{renamedFrom:q.renamedFrom}:{})}));
 const schedule=x.schedule?`Follow-up within ${x.schedule.followUpWithinDays} days of each confirmed visit${x.schedule.note?` (${x.schedule.note})`:''}. Declared by an installed pack; nothing is scheduled automatically.`:undefined;
 const escalation=x.escalation?.length?x.escalation.map(r=>`${r.label}: ${r.condition.questionId} ${opText[r.condition.operator]}${r.condition.operator==='missing'?'':' '+r.condition.value} → ${r.urgency==='urgent_review'?'urgent clinician review':'clinician review'}`).join('; ')+'. Declared by an installed pack; nothing is escalated automatically.':undefined;
 return {id:x.id,version:x.version,name:x.name,programme:x.programme,purpose:x.purpose,questions,...(schedule?{schedule}:{}),...(escalation?{escalation}:{}),...(x.migratesFrom?.length?{migratesFrom:[...x.migratesFrom].sort((a,b)=>a-b)}:{}),changeNote:x.changeNote,installed:{installationId,manifestHash}};
}
const shape=(q:Question)=>JSON.stringify({label:q.label,unit:q.unit??null,fact:q.fact??null,options:q.options??null,when:q.when??null});
// Conflicts with the compiled catalogue and the other installations (rejected and withdrawn ones excepted). Version order
// is checked against every staged, approved, active and retired version at staging, and against compiled, active and
// retired versions at activation, so an approved version can be activated while a higher one waits for review. A mapping
// (migratesFrom) must name a compiled or activated version, and the shared-question check covers every pack a visit could
// capture alongside this one.
export function conflicts(s:OrgState,p:Pack,self?:string,activating=false){
 const out:string[]=[],others=installationsOf(s).filter(x=>x.id!==self&&x.state!=='rejected'&&!(x.state==='retired'&&!x.activatedAt));
 const all=[...PACKS,...others.map(x=>x.pack)],same=all.filter(x=>x.id===p.id);
 const ordered=activating?[...PACKS,...others.filter(x=>['active','retired'].includes(x.state)).map(x=>x.pack)].filter(x=>x.id===p.id):same;
 if(same.some(x=>x.version===p.version))out.push(`${p.id} v${p.version} is already in the catalogue or awaiting review.`);
 const highest=Math.max(0,...ordered.map(x=>x.version));if(ordered.length&&p.version<=highest)out.push(`${p.id} already has v${highest}; a new version must be higher.`);
 if(!ordered.length&&(p.version!==1||p.migratesFrom?.length))out.push(`${p.id} is a new pack: its first version is v1 with no earlier versions to migrate from.`);
 if(same.length&&same.some(x=>x.programme!==p.programme))out.push(`${p.id} belongs to the ${same[0].programme} programme; a new version cannot move it to ${p.programme}.`);
 if(!same.length&&all.some(x=>x.name.toLowerCase()===p.name.toLowerCase()))out.push(`Another pack is already named ${p.name}.`);
 const usable=activating?catalogueOf(s):[...PACKS,...others.filter(x=>['active','retired'].includes(x.state)).map(x=>x.pack)];
 for(const v of p.migratesFrom??[])if(!usable.some(x=>x.id===p.id&&x.version===v))out.push(`migratesFrom names ${p.id} v${v}, which is not an activated version.`);
 for(const q of p.questions.filter(q=>q.renamedFrom))if(!usable.some(x=>x.id===p.id&&p.migratesFrom?.includes(x.version)&&x.questions.some(o=>o.id===q.renamedFrom)))out.push(`Question ${q.id} is renamed from ${q.renamedFrom}, which no mapped earlier version asks.`);
 for(const q of p.questions)for(const o of all.filter(x=>x.id!==p.id))for(const oq of o.questions)if(oq.id===q.id&&shape(oq)!==shape(q)){out.push(`Question ${q.id} is defined differently by ${o.id} v${o.version}; a visit captures a question id once, so shared questions must match.`);break;}
 return [...new Set(out)];
}
function record(s:OrgState,u:Actor,m:Member,action:string,subject:string,detail:string,now:string){s.workspace.audit.push({id:uuid(),at:now,actorId:u.userId,actor:u.displayName,role:m.role,action,subject,detail});}
export const openEpisodesOn=(s:OrgState,packId:string,version:number)=>s.workspace.people.reduce((n,p)=>n+(p.enrolments??[]).filter(e=>e.packId===packId&&e.packVersion===version&&e.state==='active').length,0);
export async function applyPackInstallation(s:OrgState,input:unknown,u:Actor,m:Member,now=new Date().toISOString()):Promise<any|null>{
 const parsed=packInstallationSchema.safeParse(input);if(!parsed.success)return null;const c=parsed.data;authorizePackInstallation(s,m,c);
 const ops=s.operations??=defaultOperations(),list=ops.installedPacks??=[];
 if(c.type==='packInstallStage'){
  const r=packManifestSchema.safeParse(c.manifest);
  if(!r.success)fail(422,'The pack manifest is invalid: '+r.error.issues.slice(0,6).map(i=>`${i.path.join('.')||'manifest'}: ${i.message}`).join('; '));
  const x=r.data,issues=manifestIssues(x);if(issues.length)fail(422,'The pack manifest is invalid: '+issues.slice(0,6).join(' '));
  if(list.length>=MAX_INSTALLATIONS)fail(422,`This release keeps at most ${MAX_INSTALLATIONS} pack installations per organisation.`);
  const id=uuid(),manifestHash=await digest({format:MANIFEST_FORMAT,manifest:x}),pack=packFromManifest(x,id,manifestHash);
  const clash=conflicts(s,pack);if(clash.length)fail(409,'The pack conflicts with the catalogue: '+clash.slice(0,6).join(' '));
  list.push({id,packId:x.id,version:x.version,state:'staged',manifest:x,manifestHash,pack,stagedBy:u.userId,stagedAt:now,reason:c.reason,history:[{state:'staged',at:now,by:u.userId,reason:c.reason}]});
  record(s,u,m,c.type,s.organisation.id,`Programme pack ${x.id} v${x.version} staged for review (installation ${id}, manifest ${manifestHash}): ${x.questions.length} questions, ${x.escalation?.length??0} escalation rules${x.migratesFrom?.length?`, reviewed mapping from v${x.migratesFrom.join(', v')}`:''}. Not clinically approved. Reason: ${c.reason}`,now);
  return {installationId:id,packId:x.id,version:x.version,state:'staged',manifestHash};
 }
 const x=installation(s,c.installationId);
 if(c.type==='packInstallReview'){
  if(!['staged','approved'].includes(x.state))fail(409,'Only a staged or approved, not yet active, pack can be reviewed.');
  if(c.manifestHash!==x.manifestHash)fail(409,'The manifest you reviewed is not the staged one. Reload and review again.');
  const state=c.decision==='approve'?'approved':'rejected';x.review={by:u.userId,memberVersion:m.version,at:now,decision:c.decision,reason:c.reason};x.state=state;x.history.push({state,at:now,by:u.userId,reason:c.reason});
  record(s,u,m,c.type,s.organisation.id,`Programme pack ${x.packId} v${x.version} ${state} by an independent clinician reviewer (installation ${x.id}, manifest ${x.manifestHash}). A governance review, not clinical approval. Reason: ${c.reason}`,now);
  return {installationId:x.id,state};
 }
 if(c.type==='packInstallActivate'){
  if(x.state!=='approved')fail(409,'Only an approved pack can be activated.');if(c.manifestHash!==x.manifestHash)fail(409,'The manifest changed since you reviewed it.');
  const rv=s.members.find(y=>y.userId===x.review?.by);if(!rv||!mayReview(rv,x)||rv.version!==x.review!.memberVersion)fail(409,'The reviewer\'s authority changed since the review. Ask a clinician to review it again.');
  const clash=conflicts(s,x.pack,x.id,true);if(clash.length)fail(409,'The pack now conflicts with the catalogue: '+clash.slice(0,6).join(' '));
  x.state='active';x.activatedAt=now;x.activatedBy=u.userId;x.history.push({state:'active',at:now,by:u.userId,reason:c.reason});
  const compiled=PACKS.some(p=>p.id===x.packId),earlier=enrollablePacks(s).filter(p=>p.id===x.packId&&p.version<x.version).length;
  record(s,u,m,c.type,s.organisation.id,`Programme pack ${x.packId} v${x.version} activated (installation ${x.id}, manifest ${x.manifestHash}). ${earlier?`Open episodes on earlier versions stay where they are until a reviewed migration moves them; new episodes keep opening on the adopted version until an owner applies one.`:`New episodes can now open on v${x.version}.`}${compiled?'':' New installed pack.'} Not clinically approved. Reason: ${c.reason}`,now);
  return {installationId:x.id,state:'active',packId:x.packId,version:x.version,migrationAvailable:earlier>0};
 }
 if(x.state==='retired'||x.state==='rejected')fail(409,'This pack installation is already closed.');
 const was=x.state,episodes=was==='active'?openEpisodesOn(s,x.packId,x.version):0;
 x.state='retired';x.retiredAt=now;x.retiredBy=u.userId;x.history.push({state:'retired',at:now,by:u.userId,reason:c.reason});
 let adoption='';const pv=ops.packVersions??={};
 if(was==='active'){if(pv[x.packId]===x.version){const below=enrollablePacks(s).filter(p=>p.id===x.packId&&p.version<x.version).map(p=>p.version);if(below.length)pv[x.packId]=Math.max(...below);else delete pv[x.packId];}const after=adoptedVersion(s,x.packId);adoption=after?` New episodes open on v${after}.`:' No version of this pack can open new episodes.';}
 record(s,u,m,c.type,s.organisation.id,`Programme pack ${x.packId} v${x.version} retired from ${was} (installation ${x.id}); kept, not deleted.${was==='active'?` ${episodes} open episodes stay pinned to v${x.version} until closed or migrated; it no longer opens episodes or receives migrations.`:''}${adoption} Reason: ${c.reason}`,now);
 return {installationId:x.id,state:'retired',openEpisodes:episodes};
}

// Range publication shares pack installation's independently reviewed, append-only governance contract.
// It publishes compiled engineering examples only; governance approval never means clinical approval.
export type RangeProtocol={id:string;mode:'default'|'population-demo';publicationVersion:number;state:'staged'|'approved'|'rejected'|'active'|'retired';manifestHash:string;manifest:unknown;clinicalApproval:'pending';stagedBy:string;stagedAt:string;review?:{by:string;memberVersion:number;at:string;decision:'approve'|'reject';reason:string};history:{state:RangeProtocol['state'];at:string;by:string;reason:string}[]};
export const rangeProtocolSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('rangeProtocolStage'),mode:z.enum(['default','population-demo']),publicationVersion:z.number().int().min(1).max(999),reason}).strict(),
 z.object({type:z.literal('rangeProtocolReview'),protocolId:iid,manifestHash:hash,decision:z.enum(['approve','reject']),reason}).strict(),
 z.object({type:z.literal('rangeProtocolActivate'),protocolId:iid,manifestHash:hash,reason}).strict(),
 z.object({type:z.literal('rangeProtocolRetire'),protocolId:iid,reason}).strict(),
]);
const rangeTypes=new Set(rangeProtocolSchema.options.map(x=>x.shape.type.value));
export const rangeProtocolsOf=(s:OrgState)=>s.operations?.valueRangeProtocols??[];
const protocol=(s:OrgState,id:string)=>{const x=rangeProtocolsOf(s).find(x=>x.id===id);if(!x)fail(404,'Value range protocol not found.');return x!;};
export function authorizeRangeProtocol(s:OrgState,m:Member,c:any){
 if(!rangeTypes.has(c?.type))return;
 if(c.type==='rangeProtocolReview'){const x=protocol(s,c.protocolId);if(!active(m)||m.role!=='clinician'||m.userId===x.stagedBy)fail(403,'A different active clinician must review the exact value range publication.');}
 else if(!active(m)||!m.isOwner)fail(403,'An organisation owner stages, publishes and retires value range protocols.');
}
export async function applyRangeProtocol(s:OrgState,input:unknown,u:Actor,m:Member,environment:string,now=new Date().toISOString()):Promise<any|null>{
 const parsed=rangeProtocolSchema.safeParse(input);if(!parsed.success)return null;const c=parsed.data;authorizeRangeProtocol(s,m,c);
 const list=(s.operations??=defaultOperations()).valueRangeProtocols??=[];
 if(c.type==='rangeProtocolStage'){
  if(list.length>=32)fail(422,'Value range publication limit reached; history is retained.');
  if(list.some(x=>x.publicationVersion>=c.publicationVersion))fail(409,'Publication version must be greater than every earlier staged publication.');
  const manifest={format:'saha-value-range-publication-1',mode:c.mode,publicationVersion:c.publicationVersion,clinicalApproval:'pending',defaultRanges:VALUE_RANGES,...(c.mode==='population-demo'?{population:{version:POPULATION_RANGES.version,status:POPULATION_RANGES.status,note:POPULATION_RANGES.note,precedence:POPULATION_RANGES.groups.map(g=>g.id),groups:POPULATION_RANGES.groups.map(g=>({id:g.id,label:g.label,fields:g.fields})),contextRule:'age<18 first; otherwise Maternal care programme or active maternal enrolment; sex retained as context, no sex threshold'}}:{})};
  const manifestHash=await digest(manifest),id=uuid();list.push({id,mode:c.mode,publicationVersion:c.publicationVersion,state:'staged',manifestHash,manifest,clinicalApproval:'pending',stagedBy:u.userId,stagedAt:now,history:[{state:'staged',at:now,by:u.userId,reason:c.reason}]});record(s,u,m,c.type,s.organisation.id,`Value range publication ${id} v${c.publicationVersion} staged, manifest ${manifestHash}; clinical approval pending. ${c.reason}`,now);return {protocolId:id,manifestHash,state:'staged'};
 }
 const x=protocol(s,c.protocolId);if(x.history.length>=128)fail(422,'Publication history limit reached; earlier evidence is retained.');
 if(c.type==='rangeProtocolReview'){
  if(!['staged','approved'].includes(x.state)||c.manifestHash!==x.manifestHash)fail(409,'Review the current staged publication and exact manifest hash.');x.state=c.decision==='approve'?'approved':'rejected';x.review={by:u.userId,memberVersion:m.version,at:now,decision:c.decision,reason:c.reason};
 }else if(c.type==='rangeProtocolActivate'){
  if(x.state!=='approved'||c.manifestHash!==x.manifestHash)fail(409,'Only the independently approved exact publication can be activated.');
  const rv=s.members.find(y=>y.userId===x.review?.by);if(!rv||rv.status!=='active'||rv.role!=='clinician'||rv.userId===x.stagedBy||rv.version!==x.review?.memberVersion)fail(409,'Reviewer authority changed; review this publication again.');
  if(x.mode==='population-demo'&&!['synthetic','training'].includes(environment))fail(409,'Population examples are allowed only in synthetic or training environments while clinical approval is pending.');
  if(list.some(y=>y.state==='active'&&y.publicationVersion>=x.publicationVersion))fail(409,'A newer publication is already active.');
  if(list.some(y=>y.state==='active'&&y.history.length>=128))fail(422,'Active publication history limit reached; earlier evidence is retained.');for(const y of list.filter(y=>y.state==='active')){y.state='retired';y.history.push({state:'retired',at:now,by:u.userId,reason:`Superseded by publication ${x.id}. ${c.reason}`});}
  x.state='active';
 }else{if(['retired','rejected'].includes(x.state))fail(409,'This publication is already closed.');x.state='retired';}
 x.history.push({state:x.state,at:now,by:u.userId,reason:c.reason});record(s,u,m,c.type,s.organisation.id,`Value range publication ${x.id} v${x.publicationVersion} ${x.state}, manifest ${x.manifestHash}. Existing visits and signed grants stay pinned; clinical approval pending. ${c.reason}`,now);return {protocolId:x.id,manifestHash:x.manifestHash,state:x.state};
}
