import type { Facts, Programme, Visit } from './types';
export type PackId='maternal'|'tb'|'hypertension';
export type Question={id:string;label:string;unit?:string;fact?:Exclude<keyof Facts,'provenance'>;options?:string[];when?:{id:string;value:string};required:boolean};
export type Pack={id:PackId;version:number;name:string;programme:Programme;purpose:string;questions:Question[]};
const weight:Question={id:'weight',label:'Weight',unit:'kg',fact:'weight',required:true};
const bp:Question[]=[{id:'systolic',label:'Systolic blood pressure',unit:'mmHg',fact:'systolic',required:true},{id:'diastolic',label:'Diastolic blood pressure',unit:'mmHg',fact:'diastolic',required:true}];
export const PACKS:readonly Pack[]=[
 {id:'maternal',version:1,name:'Maternal care',programme:'Maternal care',purpose:'Document a locally confirmed pregnancy episode and visit follow-up.',questions:[weight,...bp,{id:'weeks',label:'Gestational age, reported',unit:'weeks',fact:'weeks',required:true},{id:'maternal_contact',label:'Was a care appointment discussed?',options:['Yes','No'],required:true}]},
 {id:'tb',version:1,name:'TB screening',programme:'TB screening',purpose:'Record reported screening information; no diagnosis or official TB registration.',questions:[weight,{id:'cough',label:'Does the person report a cough?',options:['Yes','No'],required:true},{id:'coughDays',label:'Cough duration, reported',unit:'days',fact:'coughDays',when:{id:'cough',value:'Yes'},required:true},{id:'testing',label:'Is a testing follow-up already arranged?',options:['Yes','No'],required:true}]},
 {id:'hypertension',version:1,name:'Hypertension follow-up',programme:'Chronic care',purpose:'Record current measurements and reported medication access; no prescribing.',questions:[weight,...bp,{id:'medication_access',label:'Reported access to prescribed medicines',options:['Available','Access difficulty','No medicines reported'],required:true}]}
];
export type Enrolment={id:string;packId:PackId;packVersion:number;state:'active'|'closed';episodeLabel:string;startDate:string|null;createdAt:string;createdBy:string;closedAt?:string;outcome?:string;registration:'not_submitted'};
export type FollowUp={id:string;enrolmentId:string;packId:PackId;title:string;due:string;ownerId:string;state:'open'|'completed'|'cancelled';createdAt:string;createdBy:string;closedAt?:string;resolution?:string};
export type ProgrammeCapture={packs:{enrolmentId:string;pack:Pack}[];answers:Record<string,string>;absence:Record<string,string>;savedBy?:string;savedAt?:string};
export const ABSENCE=['Unknown','Not measured','Declined','Unable to obtain'] as const;
export function questions(c?:ProgrammeCapture){const found=new Map<string,Question&{programmes:string[]}>();for(const {pack} of c?.packs??[])for(const q of pack.questions){if(q.when&&c?.answers[q.when.id]!==q.when.value)continue;const old=found.get(q.id);if(old)old.programmes.push(pack.name);else found.set(q.id,{...q,programmes:[pack.name]});}return [...found.values()];}
export function unresolved(v:Visit){return questions(v.programmeCapture).filter(q=>!String(q.fact?v.facts[q.fact]:v.programmeCapture?.answers[q.id]??'').trim()&&!v.programmeCapture?.absence[q.id]);}
export function captureFor(enrolments:Enrolment[]):ProgrammeCapture{return {packs:enrolments.filter(e=>e.state==='active').map(e=>({enrolmentId:e.id,pack:structuredClone(PACKS.find(p=>p.id===e.packId&&p.version===e.packVersion)!)})),answers:{},absence:{}};}
