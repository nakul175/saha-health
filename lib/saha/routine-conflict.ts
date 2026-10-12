import { z } from 'zod';
import { FACT_SOURCES, MEASURES, VALUE_FIELDS, MEASURE_LABEL, factProvenance, measureValue, measureOf } from './fact-provenance';
import type { Facts, Measure } from './types';
import type { RoutineContext } from './routine-visit';

const field=z.string().max(3000);
const provenance=z.object({source:z.enum(FACT_SOURCES),at:z.string().optional()}).strict();
const optionalMap=<T extends z.ZodTypeAny>(keys: readonly string[],value:T)=>z.object(Object.fromEntries(keys.map(k=>[k,value.optional()]))).strict();
const schema=z.object({date:field,systolic:field,diastolic:field,weight:field,temperature:field,weeks:field,coughDays:field,notes:field,source:z.enum(['measured','reported']),provenance:optionalMap(MEASURES,provenance).optional(),entered:optionalMap(VALUE_FIELDS,z.object({value:field,unit:field}).strict()).optional(),unusual:optionalMap(VALUE_FIELDS,field).optional()}).strict();
export type ConflictChoice='local'|'saved';
export type ConflictRow={id:string;label:string;original:unknown;local:unknown;saved:unknown;changed:boolean;collision:boolean};
export type ObservationConflict={base:RoutineContext;local:Facts;current:RoutineContext;rows:ConflictRow[]};
function canonical(value:unknown):string {
  if(value===undefined)return 'undefined';
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical((value as Record<string,unknown>)[k])).join(',')+'}';
}
const equal=(a:unknown,b:unknown)=>canonical(a)===canonical(b);
function checked(context:RoutineContext) {
  const v=context.visit;
  if(!context.organisationId||!context.person?.id||!Number.isSafeInteger(context.person.version)||context.person.version<1||!v||v.personId!==context.person.id||!Number.isSafeInteger(v.version)||v.version<1||v.state!=='draft'||v.voidedAt||v.supersededBy)throw Error('Only a current draft of this assigned person can be reviewed.');
  schema.parse(v.facts);return v;
}
export function sameReviewContext(base:RoutineContext,current:RoutineContext) {
  const a=checked(base),b=checked(current);
  if(base.organisationId!==current.organisationId||base.person.id!==current.person.id||base.person.version!==current.person.version||a.id!==b.id||b.version<a.version)throw Error('The person or draft context changed. Reopen the checked record before reconciling.');
  if(!equal(a.valueRangeCapture,b.valueRangeCapture)||!equal(a.programmeCapture?.packs,b.programmeCapture?.packs))throw Error('Captured protocol or programme versions changed. Reopen the checked record before reconciling.');
}
function group(f:Facts,id:string) {
  if(id==='context')return {date:f.date,source:f.source};
  if(id==='notes')return {notes:f.notes};
  const m=id as Measure,fields=VALUE_FIELDS.filter(k=>measureOf(k)===m);
  return {values:Object.fromEntries(fields.map(k=>[k,f[k]])),provenance:f.provenance?.[m]??null,entered:Object.fromEntries(fields.filter(k=>f.entered?.[k]).map(k=>[k,f.entered![k]])),unusual:Object.fromEntries(fields.filter(k=>f.unusual?.[k]!==undefined).map(k=>[k,f.unusual![k]])),effectiveSourceAndTime:measureValue(f,m)?factProvenance(f,m):null};
}
export function observationConflict(base:RoutineContext,local:Facts,current:RoutineContext):ObservationConflict {
  sameReviewContext(base,current);schema.parse(local);
  const original=base.visit!.facts,saved=current.visit!.facts;
  const groups=[{id:'context',label:'Visit time and default source'},...MEASURES.map(id=>({id,label:MEASURE_LABEL[id]})),{id:'notes',label:'Visit notes'}];
  return {base:structuredClone(base),local:structuredClone(local),current:structuredClone(current),rows:groups.map(g=>{const a=group(original,g.id),l=group(local,g.id),s=group(saved,g.id);return {...g,original:a,local:l,saved:s,changed:!equal(a,l)||!equal(a,s),collision:!equal(a,l)&&!equal(a,s)&&!equal(l,s)};})};
}
export function reviewedFacts(review:ObservationConflict,choices:Record<string,ConflictChoice>):Facts {
  const f=structuredClone(review.current.visit!.facts);
  for(const row of review.rows) {
    const choice=row.changed?choices[row.id]:'saved';
    if(choice!=='local'&&choice!=='saved')throw Error('Choose your edit or the current saved value for every changed group.');
    const source=choice==='local'?review.local:review.current.visit!.facts;
    if(row.id==='context'){f.date=source.date;f.source=source.source;continue;}
    if(row.id==='notes'){f.notes=source.notes;continue;}
    const measure=row.id as Measure;
    for(const k of VALUE_FIELDS.filter(k=>measureOf(k)===measure)) {
      f[k]=source[k];
      if(source.entered?.[k]!==undefined)f.entered={...f.entered,[k]:structuredClone(source.entered[k])};
      else if(f.entered)delete f.entered[k];
      if(source.unusual?.[k]!==undefined)f.unusual={...f.unusual,[k]:source.unusual[k]};
      else if(f.unusual)delete f.unusual[k];
    }
    if(source.provenance?.[measure])f.provenance={...f.provenance,[measure]:structuredClone(source.provenance[measure])};
    else if(f.provenance)delete f.provenance[measure];
  }
  // Choosing a different global fallback must not silently redate/re-source a
  // selected measurement. No provenance is invented to make a mix valid.
  for(const measure of MEASURES){const origin=choices[measure]==='local'?review.local:review.current.visit!.facts;
    if(measureValue(f,measure)&&!equal(factProvenance(f,measure),factProvenance(origin,measure)))throw Error('These choices change a selected observation’s source or time. Choose compatible observation and visit-context groups.');}
  for(const k of ['entered','unusual','provenance']as const)if(f[k]&&!Object.keys(f[k]!).length)delete f[k];
  return f;
}
export function unchangedReviewCheckpoint(reviewed:RoutineContext,current:RoutineContext) {
  sameReviewContext(reviewed,current);
  return reviewed.visit!.version===current.visit!.version&&equal(reviewed.visit!.facts,current.visit!.facts)&&equal(reviewed.visit!.programmeCapture,current.visit!.programmeCapture);
}
