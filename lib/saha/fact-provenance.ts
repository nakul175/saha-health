import type { Facts, FactSource, Measure } from './types';
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
