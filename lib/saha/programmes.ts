import type { Facts, Programme, Visit } from './types';
// Slice 4f: pack ids are slugs. The three compiled packs keep their ids; an owner may install further packs (and
// further versions of these) at runtime through the governed installation path in pack-installation.ts.
export type PackId=string;
export const COMPILED_PACK_IDS=['maternal','tb','hypertension'] as const;
export type Question={id:string;label:string;unit?:string;fact?:Exclude<keyof Facts,'provenance'>;options?:string[];when?:{id:string;value:string};required:boolean;renamedFrom?:string};
// Slice 4e: a pack version may describe its (illustrative) schedule and escalation text and the earlier versions it
// declares a reviewed mapping from; a question renamed between versions names its earlier id in renamedFrom.
export type Pack={id:PackId;version:number;name:string;programme:Programme;purpose:string;questions:Question[];schedule?:string;escalation?:string;migratesFrom?:number[];changeNote?:string;installed?:{installationId:string;manifestHash:string}};
const weight:Question={id:'weight',label:'Weight',unit:'kg',fact:'weight',required:true};
const bp:Question[]=[{id:'systolic',label:'Systolic blood pressure',unit:'mmHg',fact:'systolic',required:true},{id:'diastolic',label:'Diastolic blood pressure',unit:'mmHg',fact:'diastolic',required:true}];
export const PACKS:readonly Pack[]=[
 {id:'maternal',version:1,name:'Maternal care',programme:'Maternal care',purpose:'Document a locally confirmed pregnancy episode and visit follow-up.',questions:[weight,...bp,{id:'weeks',label:'Gestational age, reported',unit:'weeks',fact:'weeks',required:true},{id:'maternal_contact',label:'Was a care appointment discussed?',options:['Yes','No'],required:true}]},
 {id:'tb',version:1,name:'TB screening',programme:'TB screening',purpose:'Record reported screening information; no diagnosis or official TB registration.',questions:[weight,{id:'cough',label:'Does the person report a cough?',options:['Yes','No'],required:true},{id:'coughDays',label:'Cough duration, reported',unit:'days',fact:'coughDays',when:{id:'cough',value:'Yes'},required:true},{id:'testing',label:'Is a testing follow-up already arranged?',options:['Yes','No'],required:true}]},
 // Slice 4e: a synthetic, illustrative second maternal version that exercises reviewed open-episode migration.
 // It is not clinically approved; the schedule and escalation text are descriptive and nothing is automated.
 {id:'maternal',version:2,name:'Maternal care',programme:'Maternal care',purpose:'Document a locally confirmed pregnancy episode and visit follow-up.',questions:[weight,...bp,{id:'weeks',label:'Gestational age, reported',unit:'weeks',fact:'weeks',required:true},{id:'appointment_discussed',renamedFrom:'maternal_contact',label:'Was the next care appointment discussed?',options:['Yes','No'],required:true},{id:'danger_signs_reviewed',label:'Were pregnancy danger signs discussed with the person?',options:['Yes','No'],required:true}],schedule:'Illustrative: the worker sets a follow-up within 28 days of each confirmed visit; nothing is scheduled automatically.',escalation:'Illustrative: a "No" to the danger-sign discussion is shown for clinician review; nothing is escalated automatically.',migratesFrom:[1],changeNote:'Synthetic illustrative revision for the migration workflow; not clinically approved.'},
 {id:'hypertension',version:1,name:'Hypertension follow-up',programme:'Chronic care',purpose:'Record current measurements and reported medication access; no prescribing.',questions:[weight,...bp,{id:'medication_access',label:'Reported access to prescribed medicines',options:['Available','Access difficulty','No medicines reported'],required:true}]}
];
export type Enrolment={id:string;packId:PackId;packVersion:number;state:'active'|'closed';episodeLabel:string;startDate:string|null;createdAt:string;createdBy:string;closedAt?:string;outcome?:string;registration:'not_submitted';migrations?:EpisodeMigration[];imported?:{batchId:string;row:number;at:string;by:string;planHash:string}};
// Slice 4e: each reviewed version change of an open episode, appended (never rewritten).
export type EpisodeMigration={batchId:string;from:number;to:number;at:string;by:string;reason:string;planHash:string};
export type FollowUp={id:string;enrolmentId:string;packId:PackId;title:string;due:string;ownerId:string;state:'open'|'completed'|'cancelled';createdAt:string;createdBy:string;closedAt?:string;resolution?:string};
export type ProgrammeCapture={packs:{enrolmentId:string;pack:Pack}[];answers:Record<string,string>;absence:Record<string,string>;savedBy?:string;savedAt?:string};
export const ABSENCE=['Unknown','Not measured','Declined','Unable to obtain'] as const;
export function questions(c?:ProgrammeCapture){const found=new Map<string,Question&{programmes:string[]}>();for(const {pack} of c?.packs??[])for(const q of pack.questions){if(q.when&&c?.answers[q.when.id]!==q.when.value)continue;const old=found.get(q.id);if(old)old.programmes.push(pack.name);else found.set(q.id,{...q,programmes:[pack.name]});}return [...found.values()];}
export function unresolved(v:Visit){return questions(v.programmeCapture).filter(q=>!String(q.fact?v.facts[q.fact]:v.programmeCapture?.answers[q.id]??'').trim()&&!v.programmeCapture?.absence[q.id]);}
export function captureFor(enrolments:Enrolment[],installed?:readonly Pack[]):ProgrammeCapture{const all=[...PACKS,...(installed??[])];return {packs:enrolments.filter(e=>e.state==='active').flatMap(e=>{const pack=all.find(p=>p.id===e.packId&&p.version===e.packVersion);return pack?[{enrolmentId:e.id,pack:structuredClone(pack)}]:[];}),answers:{},absence:{}};}
// Slice 4f: the catalogue is the compiled packs plus the organisation's installed versions. Activated versions can open
// episodes and be migration targets; retired installed versions stay resolvable for the episodes pinned to them.
type Installs={operations?:{packVersions?:Partial<Record<PackId,number>>;installedPacks?:{state:string;pack:Pack}[]}};
export const installedPacks=(s?:Installs,states=['active','retired'])=>(s?.operations?.installedPacks??[]).filter(x=>states.includes(x.state)).map(x=>x.pack);
export const enrollablePacks=(s?:Installs)=>[...PACKS,...installedPacks(s,['active'])];
export const catalogueOf=(s?:Installs)=>[...PACKS,...installedPacks(s)];
export const packIds=(s?:Installs)=>[...new Set(enrollablePacks(s).map(p=>p.id))];
export const latestVersion=(id:PackId,s?:Installs)=>Math.max(0,...enrollablePacks(s).filter(p=>p.id===id).map(p=>p.version));
export const packAt=(id:PackId,version:number,s?:Installs)=>catalogueOf(s).find(p=>p.id===id&&p.version===version);
export const enrollableAt=(id:PackId,version:number,s?:Installs)=>enrollablePacks(s).find(p=>p.id===id&&p.version===version);
export const packName=(id:PackId,s?:Installs)=>catalogueOf(s).filter(p=>p.id===id).sort((a,b)=>b.version-a.version)[0]?.name??id;
// The version new episodes open on: the adopted version while it can open episodes, else the lowest version that can
// (v1 for the compiled packs; the first activated version for an installed pack). 0 when the pack cannot open episodes.
export function adoptedVersion(s:Installs,id:PackId){const v=s.operations?.packVersions?.[id];if(v&&enrollableAt(id,v,s))return v;const vs=enrollablePacks(s).filter(p=>p.id===id).map(p=>p.version);return vs.length?Math.min(...vs):0;}
