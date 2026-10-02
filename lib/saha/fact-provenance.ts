import type { ConvertibleField, EnteredValue, EntryReview, FactAuthor, FactReview, Facts, FactSource, Measure, OverrideConfirmation, Role, ValueField, ValueOverride, Visit } from './types';
// Slice 6z: entries are keyed by question id; read them as own properties only (the same rule as programmes.ts `own`,
// repeated here so this module keeps no import of the programme catalogue).
const own=<T>(r:Record<string,T>|undefined|null,k:string):T|undefined=>r&&Object.prototype.hasOwnProperty.call(r,k)?r[k]:undefined;
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
export const answerKeys=(c:EntryContent)=>[...new Set([...Object.keys(c.answers),...Object.keys(c.absence)].filter(k=>!!(own(c.answers,k)||own(c.absence,k))))].sort();
export function stampEntryAuthors(prev:EntryContent|undefined,next:EntryContent,old:Pick<Visit,'noteAuthor'|'answerAuthors'>|undefined,actor:FactAuthor){
 const noteAuthor=!next.notes?undefined:prev?.notes===next.notes?old?.noteAuthor:{...actor};
 const answerAuthors:Record<string,FactAuthor>={};const fp=(c:EntryContent|undefined,k:string)=>c?JSON.stringify([own(c.answers,k)??null,own(c.absence,k)??null]):'';
 for(const k of answerKeys(next)){if(fp(prev,k)!==fp(next,k))answerAuthors[k]={...actor};else if(own(old?.answerAuthors,k))answerAuthors[k]={...own(old?.answerAuthors,k)!};}
 return {noteAuthor:noteAuthor?{...noteAuthor}:undefined,answerAuthors:Object.keys(answerAuthors).length?answerAuthors:undefined};
}
export const entryKeys=(v:Pick<Visit,'facts'|'programmeCapture'>)=>{const c=entryContent(v);return [...(c.notes?['notes']:[]),...answerKeys(c).map(k=>'answer:'+k)];};
export const entryAuthor=(v:Pick<Visit,'noteAuthor'|'answerAuthors'>,entry:string)=>entry==='notes'?v.noteAuthor:entry.startsWith('answer:')?own(v.answerAuthors,entry.slice(7)):undefined;
export function entryReview(v:Pick<Visit,'entryReviews'>,entry:string):EntryReview|null{return (v.entryReviews??[]).filter(r=>r.entry===entry).at(-1)??null;}
export function signOffText(s:{byName:string;role?:Role;at:string}|undefined){return s?`signed off by ${s.byName}${s.role?` (${AUTHOR_ROLE_LABEL[s.role]??s.role})`:''}, ${s.at.slice(0,16).replace('T',' ')} UTC`:'not signed off';}

// Slice 2i: units and unusual values (BR-DATA-05). Pure helpers shared by the server, the visit screen and (mirrored by
// hand) the field notebook. The ranges below are an ENGINEERING PLACEHOLDER: they are not clinically approved and claim no
// clinical authority. They only decide when a value needs a recorded reason (outside "expected") and, further out
// (outside "confirm"), a clinician's confirmation before the visit can be confirmed. Changing them needs a release.
export const VALUE_FIELDS=['systolic','diastolic','weight','temperature','weeks','coughDays'] as const satisfies readonly ValueField[];
export const VALUE_RANGES={version:'saha-value-ranges-0.1.0',status:'engineering placeholder — not clinically approved',fields:{
 systolic:{label:'Systolic blood pressure',unit:'mmHg',expected:[70,200],confirm:[50,260]},
 diastolic:{label:'Diastolic blood pressure',unit:'mmHg',expected:[40,120],confirm:[25,160]},
 weight:{label:'Weight',unit:'kg',expected:[2,150],confirm:[0.5,300]},
 temperature:{label:'Temperature',unit:'°C',expected:[34,41],confirm:[30,44]},
 weeks:{label:'Gestational age',unit:'weeks',expected:[4,42],confirm:[1,45]},
 coughDays:{label:'Cough duration',unit:'days',expected:[0,90],confirm:[0,730]},
}} as const satisfies {version:string;status:string;fields:Record<ValueField,{label:string;unit:string;expected:readonly [number,number];confirm:readonly [number,number]}>};
// Alternative units accepted at entry. The unit is always stated by the person entering the value; nothing guesses it.
// Blood pressure is accepted in mmHg only and gestational age in weeks only (no exact conversion from months).
export const CONVERTIBLE_FIELDS=['weight','temperature','coughDays'] as const satisfies readonly ConvertibleField[];
export const ALT_UNITS:Record<ConvertibleField,{unit:string;label:string;decimals:number;convert:(x:number)=>number}>={
 weight:{unit:'lb',label:'lb (pounds)',decimals:2,convert:x=>x*0.45359237},
 temperature:{unit:'degF',label:'°F (Fahrenheit)',decimals:1,convert:x=>(x-32)*5/9},
 coughDays:{unit:'wk',label:'weeks',decimals:1,convert:x=>x*7},
};
const NUMBER=/^[0-9]+(\.[0-9]+)?$/;
export function convertEntered(field:ConvertibleField,e:EnteredValue):string|null{const alt=ALT_UNITS[field];if(e.unit!==alt.unit||!NUMBER.test(e.value)||e.value.length>12)return null;const x=alt.convert(+e.value);if(!Number.isFinite(x)||x<0)return null;return String(Number(x.toFixed(alt.decimals)));}
export const rangeText=(f:ValueField,r:readonly [number,number])=>`${r[0]}–${r[1]} ${VALUE_RANGES.fields[f].unit}`;
// 'expected' inside the expected range; 'reason' outside it but inside the confirmation range; 'clinician' beyond that.
export function valueTier(field:ValueField,value:string):'expected'|'reason'|'clinician'{const x=+value,r=VALUE_RANGES.fields[field];if(!value||!Number.isFinite(x))return 'expected';if(x>=r.expected[0]&&x<=r.expected[1])return 'expected';return x>=r.confirm[0]&&x<=r.confirm[1]?'reason':'clinician';}
// Converts values entered in an alternative unit. Returns the converted facts, or a problem the server refuses with.
export function normaliseUnits(f:Facts):{facts:Facts;problem?:string}{
 if(!f.entered)return {facts:f};const next:Facts={...f,entered:{}};
 for(const k of Object.keys(f.entered)){const field=k as ConvertibleField,e=f.entered[field]!,label=VALUE_RANGES.fields[field].label;
  if(!(CONVERTIBLE_FIELDS as readonly string[]).includes(field))return {facts:f,problem:`${k}: no alternative unit is accepted for this measurement.`};
  const value=convertEntered(field,e);if(value===null)return {facts:f,problem:`${label}: enter a positive number in ${ALT_UNITS[field].label}, or enter the value in ${VALUE_RANGES.fields[field].unit}.`};
  if(f[field]&&f[field]!==value)return {facts:f,problem:`${label}: ${f[field]} ${VALUE_RANGES.fields[field].unit} does not match the entered ${e.value} ${ALT_UNITS[field].label} (${value} ${VALUE_RANGES.fields[field].unit}). Clear one of them.`};
  next[field]=value;next.entered![field]={value:e.value,unit:e.unit};}
 if(!Object.keys(next.entered!).length)delete next.entered;return {facts:next};
}
// The first range problem in normalised facts: a value outside the expected range without a reason of at least 10
// characters, or a reason without an unusual value. The server refuses with it; the notebook and screen show it early.
export function rangeProblem(f:Facts):string|null{
 for(const field of VALUE_FIELDS){const value=f[field],reason=(f.unusual?.[field]??'').trim(),r=VALUE_RANGES.fields[field],tier=valueTier(field,value);
  if(tier!=='expected'&&reason.length<10)return `${r.label} ${value} ${r.unit} is outside the expected range ${rangeText(field,r.expected)} (${VALUE_RANGES.status}). Check the value and its unit, or give a reason of at least 10 characters for this unusual value.`;
  if(tier==='expected'&&f.unusual?.[field]!==undefined)return `${r.label}: a reason applies only to a value outside the expected range ${rangeText(field,r.expected)}.`;}
 return null;
}
// The override that applies to a field now: the latest appended one for the same value and reason.
export function currentOverride(v:Pick<Visit,'facts'|'valueOverrides'>,field:ValueField):ValueOverride|null{const reason=v.facts.unusual?.[field];if(!reason||!v.facts[field])return null;return [...(v.valueOverrides??[])].reverse().find(o=>o.field===field&&o.value===v.facts[field]&&o.reason===reason)??null;}
export const overrideConfirmation=(v:Pick<Visit,'overrideConfirmations'>,o:ValueOverride):OverrideConfirmation|null=>(v.overrideConfirmations??[]).find(c=>c.overrideId===o.id)??null;
// Unusual values that still block confirming the visit: no recorded override, or a clinician confirmation is missing.
export type UnconfirmedValue={field:ValueField;need:'reason'|'clinician';override?:ValueOverride};
export function unconfirmedValues(v:Pick<Visit,'facts'|'valueOverrides'|'overrideConfirmations'>):UnconfirmedValue[]{return VALUE_FIELDS.flatMap((field):UnconfirmedValue[]=>{const tier=valueTier(field,v.facts[field]);if(tier==='expected')return [];const o=currentOverride(v,field);return !o?[{field,need:'reason' as const}]:tier==='clinician'&&!overrideConfirmation(v,o)?[{field,need:'clinician' as const,override:o}]:[];});}
export function enteredText(e:EnteredValue|undefined){if(!e)return '';const alt=Object.values(ALT_UNITS).find(a=>a.unit===e.unit);return `${e.value} ${alt?alt.label.split(' ')[0]:e.unit}`;}
export function overrideText(o:ValueOverride){const r=VALUE_RANGES.fields[o.field];return `${r.label} ${o.value} ${r.unit}${o.entered?` (entered as ${enteredText(o.entered)})`:''} outside the expected range ${rangeText(o.field,o.expected)}; reason: ${o.reason}; recorded by ${authorText(o.by)}`;}
// Text added to FHIR observation notes for a field with an unusual value; empty when none applies (output unchanged).
export function unusualNoteText(v:Pick<Visit,'facts'|'valueOverrides'|'overrideConfirmations'>,field:ValueField){const o=currentOverride(v,field);const e=v.facts.entered?.[field as ConvertibleField];
 const parts=[e?` Entered as ${enteredText(e)}; converted by Saha.`:'',o?` Unusual value (${VALUE_RANGES.version}, ${VALUE_RANGES.status}): outside ${rangeText(field,o.expected)}; reason: ${o.reason.replace(/[.\s]+$/,'')}.${o.tier==='clinician'?(()=>{const c=overrideConfirmation(v,o);return c?` Confirmed by ${c.byName} (clinician), ${c.at.slice(0,16).replace('T',' ')} UTC.`:' Clinician confirmation pending.';})():''}`:''];return parts.join('');}
// Before a save: fills the base-unit value from an alternative-unit entry (the server recomputes and compares), drops
// blank entries and reasons for values that are not unusual. Unconvertible entries are kept so the server refuses them.
export function tidyValues(f:Facts):Facts{const next:Facts={...f};
 if(f.entered){const e:NonNullable<Facts['entered']>={};for(const k of CONVERTIBLE_FIELDS){const x=f.entered[k];if(!x||!x.value.trim())continue;e[k]={value:x.value.trim(),unit:x.unit};if(!next[k])next[k]=convertEntered(k,e[k]!)??'';}if(Object.keys(e).length)next.entered=e;else delete next.entered;}
 if(f.unusual){const u:NonNullable<Facts['unusual']>={};for(const k of VALUE_FIELDS){const r=f.unusual[k];if(r&&r.trim()&&valueTier(k,next[k])!=='expected')u[k]=r;}if(Object.keys(u).length)next.unusual=u;else delete next.unusual;}
 return next;}
// Slice 2i: text for any facts entry in the record history and version-conflict views (strings unchanged).
export function factEntryText(key:string,value:unknown):string{if(typeof value==='string')return value;if(!value||typeof value!=='object')return String(value??'');
 const label=(k:string)=>VALUE_RANGES.fields[k as ValueField]?.label??k;
 if(key==='entered')return Object.entries(value as Record<string,EnteredValue>).map(([k,e])=>`${label(k)}: ${enteredText(e)}`).join('; ');
 if(key==='unusual')return Object.entries(value as Record<string,string>).map(([k,r])=>`${label(k)}: ${r}`).join('; ');
 return provenanceText(value);}
export const FACT_ENTRY_LABEL:Record<string,string>={entered:'Entered in another unit',unusual:'Reasons for unusual values'};
