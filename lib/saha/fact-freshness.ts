import { z } from 'zod';
import { factProvenance,MEASURES,MEASURE_LABEL,VALUE_RANGES,measureOf,RECORDED_SOURCES } from './fact-provenance';
import { FACT_FIELDS } from './fact-reuse';
import { governanceState,activeEntry,entryScope,governanceSpec } from './governance';
import { openDisputes } from './send-gate';
import type { OrgState,Person,Visit,Member,Measure } from './types';

// Individually inspected predicate from PR217/3e019d94 only. No writer/core cherry-pick.
export function validObservationMinute(value:unknown):value is string{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))return false;
 const at=Date.parse(value+'Z');
 return Number.isFinite(at)&&new Date(at).toISOString().slice(0,16)===value;
}
const id=z.string().regex(/^[A-Za-z0-9_:.-]{1,120}$/),version=z.number().int().positive();
const statuses=['within-configured-age','past-configured-age','unknown','not-applicable','unavailable-rule'] as const;
export const freshnessResponse=z.object({organisationId:id,actorId:z.string().min(1),evaluatedAt:z.string().datetime(),person:z.object({id,name:z.string().min(1),version,consentVersion:version}).strict(),visits:z.array(z.object({id,version,state:z.enum(['draft','confirmed']),date:z.string(),imported:z.boolean()}).strict()).max(50),limited:z.boolean(),selected:z.object({id,version,recordVersion:version,state:z.enum(['draft','confirmed']),visitTime:z.string().nullable(),receivedAt:z.string().nullable(),imported:z.boolean(),measurements:z.array(z.object({measure:z.enum(MEASURES),label:z.string(),values:z.record(z.string().nullable()),units:z.record(z.string()),entered:z.record(z.object({value:z.string(),unit:z.string()}).strict()).nullable(),source:z.string().nullable(),observedAt:z.string().nullable(),origin:z.enum(['earlier-observation','selected-visit-time','different-observation-time','unknown-time']),sourceRestriction:z.string().nullable(),rules:z.array(z.object({id,revision:version,manifestHash:z.string().min(1),title:z.string(),maxHours:z.number().int().positive().nullable(),status:z.enum(statuses),reason:z.string().min(1)}).strict()).max(50)}).strict()).length(5)}).strict().nullable()}).strict().superRefine((r,c)=>{if(new Set(r.visits.map(v=>v.id)).size!==r.visits.length)c.addIssue({code:'custom',message:'Duplicate visit references.'});if(r.selected&&!r.visits.some(v=>v.id===r.selected!.id&&v.version===r.selected!.version))c.addIssue({code:'custom',message:'Selected visit changed.'});});
export type FreshnessReview=z.infer<typeof freshnessResponse>;
function assessment(s:OrgState,m:Member,p:Person,v:Visit,measure:Measure,now:string){
 const fields=FACT_FIELDS[measure],pv=factProvenance(v.facts,measure),raw=fields.map(f=>v.facts[f]);
 // Legacy absence keeps the original visit fallback. Explicit malformed evidence never does.
 const provenance=v.facts.provenance,hasEntry=Boolean(provenance&&Object.prototype.hasOwnProperty.call(provenance,measure)),entry:unknown=hasEntry?provenance![measure]:undefined;
 const object=entry&&typeof entry==='object'&&!Array.isArray(entry)?entry as Record<string,unknown>:undefined;
 const at=object&&Object.prototype.hasOwnProperty.call(object,'at')?object.at:pv.at,source=object&&Object.prototype.hasOwnProperty.call(object,'source')?object.source:pv.source;
 const intactEntry=!hasEntry||Boolean(object);
 const numeric=raw.every(x=>typeof x==='string'&&/^\d+(\.\d+)?$/.test(x)&&Number.isFinite(+x));
 const knownSource=intactEntry&&(RECORDED_SOURCES as readonly unknown[]).includes(source);
 const knownClock=intactEntry&&validObservationMinute(at)&&validObservationMinute(v.facts.date);
 const knownContext=typeof p.age==='number'&&Number.isInteger(p.age)&&p.age>=0&&p.age<=120&&Array.isArray(p.programmes)&&p.programmes.every(x=>typeof x==='string');
 const age=knownClock?Date.parse(now)-Date.parse(at+'Z'):NaN;
 const entries=governanceState(s).entries.filter(e=>e.spec.kind==='protocol'&&entryScope(m,e));
 if(entries.length>50)throw new Error('Too many configured review rules.');
 const rules=entries.filter(e=>e.spec.kind==='protocol'&&e.spec.rules.some(r=>measureOf(r.condition.field)===measure)).map(e=>{
   const parsed=governanceSpec.safeParse(e.spec),c=e.spec;
   const base={id:e.id,revision:e.revision,manifestHash:e.manifestHash,title:c.title,maxHours:c.kind==='protocol'&&Number.isInteger(c.maxObservationAgeHours)&&c.maxObservationAgeHours>=1&&c.maxObservationAgeHours<=720?c.maxObservationAgeHours:null};
   if(!parsed.success||c.kind!=='protocol'||!activeEntry(s,e,now))return {...base,status:'unavailable-rule' as const,reason:'No current usable configured rule; approval, ownership or source dependencies may be unavailable.'};
   if(!knownContext)return {...base,status:'unknown' as const,reason:'Current age or programme context is unavailable; applicability cannot be established.'};
   if(!c.teamIds.includes(p.teamId)||!c.roles.includes(m.role as 'asha')||!p.programmes.includes(c.programme)||p.age<c.ageMin||p.age>c.ageMax)return {...base,status:'not-applicable' as const,reason:'This configured rule does not cover the current person, team, programme, age or care role.'};
   if(v.imported||v.voidedAt||v.supersededBy||openDisputes(v).some(d=>d.target==='fact:'+measure))return {...base,status:'not-applicable' as const,reason:'Imported, superseded, voided or disputed source is historical/restricted, not a current usable input.'};
   if(!numeric||!knownSource||!knownClock||!Number.isFinite(age)||age< -300000)return {...base,status:'unknown' as const,reason:'Current evidence required: missing, contradictory, malformed or future observation is not a normal finding.'};
   return age>c.maxObservationAgeHours*3600000?{...base,status:'past-configured-age' as const,reason:'Past this configured age limit. A new observation is required before this rule can use it.'}:{...base,status:'within-configured-age' as const,reason:'Within this configured age limit at the displayed evaluation time only. This is not reuse or clinical approval.'};
 });
 const entered=Object.fromEntries(fields.flatMap(f=>{const x=v.facts.entered?.[f as keyof typeof v.facts.entered];return x&&typeof x.value==='string'&&typeof x.unit==='string'?[[f,{value:x.value,unit:x.unit}]]:[];}));
 const observed=intactEntry&&typeof at==='string'?at:null,visitTime=validObservationMinute(v.facts.date)?Date.parse(v.facts.date+'Z'):NaN,observedTime=validObservationMinute(observed)?Date.parse(observed+'Z'):NaN;
 const missing=raw.every(x=>x===''||x===null||x===undefined);
 return {measure,label:MEASURE_LABEL[measure],values:Object.fromEntries(fields.map(f=>[f,typeof v.facts[f]==='string'?v.facts[f]:null])),units:Object.fromEntries(fields.map(f=>[f,VALUE_RANGES.fields[f].unit])),entered:Object.keys(entered).length?entered:null,source:intactEntry&&typeof source==='string'?source:null,observedAt:observed,origin:!Number.isFinite(visitTime)||!Number.isFinite(observedTime)?'unknown-time' as const:observedTime<visitTime?'earlier-observation' as const:observedTime===visitTime?'selected-visit-time' as const:'different-observation-time' as const,sourceRestriction:v.imported?'Imported read-only history; cannot be reused as a current observation.':openDisputes(v).some(d=>d.target==='fact:'+measure)?'Open dispute on this measurement.':missing?'No measurement recorded. Stored source/time context alone does not establish an observation or a normal finding.':v.state!=='confirmed'?'Draft; not a confirmed reusable source.':null,rules};
}
export function factFreshnessProjection(org:string,actor:string,s:OrgState,m:Member,p:Person,visitId:string|undefined,now:string):FreshnessReview{
 const all=s.workspace.visits.filter(v=>v.personId===p.id&&!v.voidedAt&&!v.supersededBy).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id)),visits=all.slice(0,50),v=visitId?visits.find(v=>v.id===visitId):undefined;
 if(visitId&&!v)throw new Error('Choose an existing current visit from the bounded index.');
 return freshnessResponse.parse({organisationId:org,actorId:actor,evaluatedAt:now,person:{id:p.id,name:p.name,version:p.version,consentVersion:p.consentVersion},visits:visits.map(v=>({id:v.id,version:v.version,state:v.state,date:typeof v.facts.date==='string'?v.facts.date:'Unavailable',imported:Boolean(v.imported)})),limited:all.length>50,selected:v?{id:v.id,version:v.version,recordVersion:v.recordVersion,state:v.state,visitTime:typeof v.facts.date==='string'?v.facts.date:null,receivedAt:typeof v.createdAt==='string'?v.createdAt:null,imported:Boolean(v.imported),measurements:MEASURES.map(measure=>assessment(s,m,p,v,measure,now))}:null});
}
