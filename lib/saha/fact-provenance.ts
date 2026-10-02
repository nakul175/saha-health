import type { EntryReview, FactAuthor, FactReview, Facts, FactSource, Measure, Role, Visit } from './types';
// Slice 2c: source and observation time for each measurement (BR-DATA-02). Pure helpers shared by the server,
// the workspace UI and the FHIR exports. A recorded value is measured or reported; a blank measurement may say
// why it is missing (not asked, declined, unknown, not applicable), which is never read as a normal finding.
// Visits without per-measurement entries fall back to the visit-level source and observation time.
export const FACT_SOURCES=['measured','reported','not-asked','declined','unknown','not-applicable'] as const satisfies readonly FactSource[];
export const RECORDED_SOURCES=['measured','reported'] as const satisfies readonly FactSource[];
export const MISSING_SOURCES=['not-asked','declined','unknown','not-applicable'] as const satisfies readonly FactSource[];
export const MEASURES=['bloodPressure','weight','temperature','weeks','coughDays'] as const satisfies readonly Measure[];
export const MEASURE_LABEL:Record<Measure,string>={bloodPressure:'Blood pressure',weight:'Weight',temperature:'Temperature',weeks:'Gestational age',coughDays:'Cough duration'};
export const SOURCE_LABEL:Record<FactSource,string>={measured:'Measured during visit',reported:'Reported by person / carer','not-asked':'Not asked',declined:'Declined',unknown:'Unknown','not-applicable':'Not applicable'};
export const measureOf=(field:string):Measure|null=>field==='systolic'||field==='diastolic'?'bloodPressure':(MEASURES as readonly string[]).includes(field)?field as Measure:null;
export const measureValue=(f:Facts,m:Measure)=>m==='bloodPressure'?(f.systolic||f.diastolic):f[m];
// The source and time that apply to one measurement; old visits fall back to the visit-level values.
export function factProvenance(f:Facts,m:Measure):{source:FactSource;at:string;own:boolean}{const p=f.provenance?.[m];return {source:p?.source??f.source,at:p?.at??f.date,own:!!p};}
// Drops entries that carry no information: a recorded source without a value, or a time without a value.
// Contradictions (a value marked as missing) are kept so the server refuses them with a reason.
export function tidyProvenance(f:Facts):Facts{if(!f.provenance)return f;const next:NonNullable<Facts['provenance']>={};
 for(const m of MEASURES){const p=f.provenance[m];if(!p)continue;const value=measureValue(f,m);if(!value&&(RECORDED_SOURCES as readonly string[]).includes(p.source))continue;next[m]=value?{...p}:{source:p.source};}
 const {provenance,...rest}=f;return Object.keys(next).length?{...rest,provenance:next}:rest;}
export function provenanceText(value:unknown){if(!value||typeof value!=='object')return String(value??'');return Object.entries(value as Record<string,{source?:string;at?:string}>).map(([m,p])=>`${MEASURE_LABEL[m as Measure]??m}: ${SOURCE_LABEL[p?.source as FactSource]??p?.source}${p?.at?` at ${p.at.replace('T',' ')} UTC`:''}`).join('; ');}
// Slice 2e: per-measurement author and clinician verification (BR-DATA-02).
// A measurement is present when it has a value or a per-measurement entry (for example a missing reason).
export const AUTHOR_ROLE_LABEL:Record<Role,string>={asha:'ASHA worker',clinician:'Clinician',supervisor:'Supervisor',admin:'Administrator',provider:'Provider (sandbox)'};
const present=(f:Facts|undefined,m:Measure)=>!!f&&(!!measureValue(f,m)||!!f.provenance?.[m]);
const fingerprint=(f:Facts|undefined,m:Measure)=>f?JSON.stringify([m==='bloodPressure'?[f.systolic,f.diastolic]:f[m],f.provenance?.[m]??null]):'';
// The authors after a change of facts: a measurement whose value or entry changed is credited to the actor (the
// authenticated server identity); an unchanged one keeps its recorded author, or none for older facts (never guessed);
// a measurement that is no longer present has no author.
export function stampAuthors(prev:Facts|undefined,next:Facts,authors:Visit['factAuthors'],actor:FactAuthor):Visit['factAuthors']{
 const out:NonNullable<Visit['factAuthors']>={};
 for(const m of MEASURES){if(!present(next,m))continue;if(fingerprint(prev,m)!==fingerprint(next,m))out[m]={...actor};else if(authors?.[m])out[m]={...authors[m]!};}
 return Object.keys(out).length?out:undefined;
}
export function factMeasuresPresent(f:Facts){return MEASURES.filter(m=>present(f,m));}
// Current verification state: the latest appended review for the measurement, or unverified.
export function factReview(v:Pick<Visit,'factReviews'>,m:Measure):FactReview|null{const rs=(v.factReviews??[]).filter(r=>r.measure===m);return rs.at(-1)??null;}
export function authorText(a:FactAuthor|undefined){return a?`${a.name} (${AUTHOR_ROLE_LABEL[a.role]??a.role}), saved ${a.at.slice(0,16).replace('T',' ')} UTC`:'not recorded';}
export function reviewText(r:Pick<FactReview,'state'|'byName'|'at'|'reason'>|null){return !r?'unverified':`${r.state==='verified'?'verified':'disputed'} by ${r.byName} (clinician), ${r.at.slice(0,16).replace('T',' ')} UTC${r.reason?`: ${r.reason}`:''}`;}
// Text added to FHIR observation notes. Visits recorded before slice 2e (no authors, no reviews) are unchanged.
export function factAuditText(v:Pick<Visit,'factAuthors'|'factReviews'>,m:Measure){if(!v.factAuthors&&!v.factReviews?.length)return '';return ` Recorded by: ${authorText(v.factAuthors?.[m])}. Verification: ${reviewText(factReview(v,m))}.`;}
// Slice 2g: authors of the visit notes and of each programme answer (an answer or an absence reason, keyed by question
// id), and clinician reviews of them. The same rule as measurements: changed entries are credited to the actor (the
// authenticated server identity), unchanged ones keep their author, cleared ones lose it, older ones stay "not recorded".
export type EntryContent={notes:string;answers:Record<string,string>;absence:Record<string,string>};
export const entryContent=(v:Pick<Visit,'facts'|'programmeCapture'>):EntryContent=>({notes:v.facts.notes??'',answers:v.programmeCapture?.answers??{},absence:v.programmeCapture?.absence??{}});
export const answerKeys=(c:EntryContent)=>[...new Set([...Object.keys(c.answers),...Object.keys(c.absence)].filter(k=>!!(c.answers[k]||c.absence[k])))].sort();
export function stampEntryAuthors(prev:EntryContent|undefined,next:EntryContent,old:Pick<Visit,'noteAuthor'|'answerAuthors'>|undefined,actor:FactAuthor){
 const noteAuthor=!next.notes?undefined:prev?.notes===next.notes?old?.noteAuthor:{...actor};
 const answerAuthors:Record<string,FactAuthor>={};const fp=(c:EntryContent|undefined,k:string)=>c?JSON.stringify([c.answers[k]??null,c.absence[k]??null]):'';
 for(const k of answerKeys(next)){if(fp(prev,k)!==fp(next,k))answerAuthors[k]={...actor};else if(old?.answerAuthors?.[k])answerAuthors[k]={...old.answerAuthors[k]};}
 return {noteAuthor:noteAuthor?{...noteAuthor}:undefined,answerAuthors:Object.keys(answerAuthors).length?answerAuthors:undefined};
}
export const entryKeys=(v:Pick<Visit,'facts'|'programmeCapture'>)=>{const c=entryContent(v);return [...(c.notes?['notes']:[]),...answerKeys(c).map(k=>'answer:'+k)];};
export const entryAuthor=(v:Pick<Visit,'noteAuthor'|'answerAuthors'>,entry:string)=>entry==='notes'?v.noteAuthor:entry.startsWith('answer:')?v.answerAuthors?.[entry.slice(7)]:undefined;
export function entryReview(v:Pick<Visit,'entryReviews'>,entry:string):EntryReview|null{return (v.entryReviews??[]).filter(r=>r.entry===entry).at(-1)??null;}
export function signOffText(s:{byName:string;role?:Role;at:string}|undefined){return s?`signed off by ${s.byName}${s.role?` (${AUTHOR_ROLE_LABEL[s.role]??s.role})`:''}, ${s.at.slice(0,16).replace('T',' ')} UTC`:'not signed off';}
