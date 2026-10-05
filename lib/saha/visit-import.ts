import { AppError, checkFacts, digest, fail, uuid } from './core';
import { normallyAllowed } from './access';
import { MISSING_SOURCES, RECORDED_SOURCES, VALUE_FIELDS, VALUE_RANGES, convertEntered, normaliseUnits, rangeCaptureFor, rangeSelection, rangeText, valueTier } from './fact-provenance';
import type { Facts, FactSource, RangeCapture, Member, Measure, OrgState, Person, ValueField, Visit } from './types';
import type { Actor } from './store';
// Slice 10i: controlled import of historical visits with clinical content (BR-DATA-11), as kind `visits` of the slice 2h
// record import (dry run, plan hash, apply exactly the plan). One CSV row is one visit for a person who already exists in
// Saha and is in the importer's care scope: visit date, source system, measurements with their stated unit and source,
// an optional reason for unusual values, and notes. The rules for units and unusual values are the slice 2i rules
// (`checkFacts`): units are stated, never inferred; a value outside the placeholder expected range needs a reason; a value
// beyond the placeholder confirmation range is refused because an imported visit has no draft stage for a clinician's
// confirmation. Apply creates confirmed visits marked IMPORTED with source lineage (file digest, row, importer, time) and
// implies no clinician review or sign-off. An import never creates programme enrolments, submissions, referrals or plans,
// never changes the person, and an imported visit is kept out of every path that would reuse it as a current observation
// (lib/saha/imported-visits.ts). There is no batch reversal.
export const VISIT_IMPORT='visit-import-v1';
export const VISIT_COLUMNS=['person','visit_date','source_system','systolic','diastolic','bp_unit','bp_source','weight','weight_unit','weight_source','temperature','temperature_unit','temperature_source','gestation','gestation_unit','gestation_source','cough_duration','cough_unit','cough_source','override_reason','notes'] as const;
export const FIRST_VISIT_DATE='2000-01-01';
export const VISIT_REFUSED='Only an organisation owner or a clinician can import visits, for teams they belong to.';
// Owner or clinician (the 10i brief): an active clinician, or an organisation owner whose role is supervisor. ASHAs (slice 6q:
// duplicate checks see only assigned patients), administrators (no patient access), providers and non-owner supervisors do not.
// Care scope is checked per row with normal team scope only: owner authority and emergency access do not widen it.
export const mayImportVisits=(m:Member)=>m.status==='active'&&m.teamIds.length>0&&(m.role==='clinician'||(m.role==='supervisor'&&m.isOwner));
export async function fileDigest(text:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(b=>b.toString(16).padStart(2,'0')).join('');}
const NUM=/^[0-9]+(\.[0-9]+)?$/,SYSTEM=/^[A-Za-z0-9][A-Za-z0-9 ._/-]{1,59}$/,DATE=/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2}))?$/,CONTROL=/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const sysKey=(x:string)=>x.trim().toLowerCase().replace(/\s+/g,' ');
const validDay=(x:string)=>!isNaN(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x;
// Each measurement with its columns and the units it accepts (case-insensitive) mapped to the stored unit code. A unit other
// than the base unit is an alternative unit of slice 2i: it is converted on the server and the entered value is kept.
type Spec={key:'weight'|'temperature'|'weeks'|'coughDays';measure:Measure;label:string;value:string;unit:string;source:string;units:Record<string,string>;base:string;hint:string};
const SPECS:Spec[]=[
 {key:'weight',measure:'weight',label:'Weight',value:'weight',unit:'weight_unit',source:'weight_source',units:{kg:'kg',lb:'lb'},base:'kg',hint:'kg or lb'},
 {key:'temperature',measure:'temperature',label:'Temperature',value:'temperature',unit:'temperature_unit',source:'temperature_source',units:{degc:'degC','°c':'degC',c:'degC',degf:'degF','°f':'degF',f:'degF'},base:'degC',hint:'degC or degF'},
 {key:'weeks',measure:'weeks',label:'Gestational age',value:'gestation',unit:'gestation_unit',source:'gestation_source',units:{weeks:'weeks',wk:'weeks','wk+d':'wk+d','weeks+days':'wk+d'},base:'weeks',hint:'weeks or wk+d (for example 20+3)'},
 {key:'coughDays',measure:'coughDays',label:'Cough duration',value:'cough_duration',unit:'cough_unit',source:'cough_source',units:{days:'days',d:'days',weeks:'wk',wk:'wk'},base:'days',hint:'days or weeks'},
];
export type VisitRow={row:number;status:'accepted'|'rejected';reasons:string[];personId?:string;version?:number;duplicateOf?:{visitId:string}};
export type VisitAccepted={kind:'visits';row:number;personId:string;sourceSystem:string;facts:Facts;valueRangeCapture?:RangeCapture};
type Resolve=(ref:string)=>{person?:Person;reason?:string};
// Plans the rows of a visit file. The caller (planRecordImport) has already checked the importer, parsed the CSV and the
// header. Rows are classified accepted or rejected with reasons that never repeat a cell; accepted rows carry the facts
// that apply would store, which stay on the server (clinical values and notes are never returned by the dry run).
export async function planVisitRows(s:OrgState,m:Member,h:string[],body:string[][],envName:string,now:string,digestOfFile:string,resolve:Resolve){
 const col=(r:string[],c:string)=>(r[h.indexOf(c)]??'').trim();
 const rows:VisitRow[]=[],accepted:(VisitAccepted&{key:string})[]=[],matched=new Set<string>();
 const existing=(p:Person)=>s.workspace.visits.filter(v=>v.personId===p.id&&!!v.imported&&!v.voidedAt);
 for(const [n,r] of body.entries()){
  const row=n+1,reasons:string[]=[];let duplicateOf:VisitRow['duplicateOf'];
  const who=resolve(col(r,'person')),p=who.person;if(who.reason)reasons.push(who.reason);if(p)matched.add(p.id);
  const ids=p?{personId:p.id,version:p.version}:{};const capture=p?rangeCaptureFor(s,p):undefined,selection=capture??rangeSelection();if(capture?.mode==='population-demo'&&!['synthetic','training'].includes(envName))fail(409,'Demonstration value ranges require a synthetic or training environment.');
  if(r.length!==h.length){reasons.push(`Row ${row} has ${r.length} fields; the header has ${h.length}.`);rows.push({row,status:'rejected',reasons,...ids});continue;}
  if(p&&!p.mergedInto){
   if((p.restrictions??[]).some(x=>!x.liftedAt))reasons.push('Processing is restricted for this record under a rights request. Visits are not imported for it.');
   if(p.identityReview?.state==='provisional')reasons.push('This record\'s identity review is provisional. Resolve it before importing visits.');
  }
  // Visit date: a date or a date and time to the minute; a date alone is stored as 00:00 and is never in the future.
  let date='';const dm=DATE.exec(col(r,'visit_date'));
  if(!dm||!validDay(dm[1])||(dm[2]!==undefined&&(+dm[2]>23||+dm[3]>59)))reasons.push('Visit date must be a real date written YYYY-MM-DD or YYYY-MM-DDTHH:MM.');
  else if(dm[1]<FIRST_VISIT_DATE)reasons.push(`Visit date cannot be before ${FIRST_VISIT_DATE}.`);
  else{date=`${dm[1]}T${dm[2]??'00'}:${dm[3]??'00'}`;if(Date.parse(date+'Z')>Date.parse(now)+300000){reasons.push('Visit date cannot be in the future.');date='';}}
  const system=col(r,'source_system');if(!SYSTEM.test(system))reasons.push('Source system is required: 2 to 60 letters, digits or the characters space . _ / -, starting with a letter or digit.');
  // Measurements: every recorded value states its unit and its source (measured or reported); without a value the source
  // may only say why it is missing. Units are never assumed and values never echoed in reasons.
  const facts:Facts={date,systolic:'',diastolic:'',weight:'',temperature:'',weeks:'',coughDays:'',notes:'',source:'reported'};
  const prov:NonNullable<Facts['provenance']>={},entered:NonNullable<Facts['entered']>={};
  const state=(label:string,has:boolean,unitText:string,sourceText:string,pick:(u:string)=>string|undefined,hint:string)=>{
   let unit:string|undefined,src:FactSource|undefined;const sourceWord=sourceText.toLowerCase();
   if(has){
    if(!unitText)reasons.push(`${label}: state the unit (${hint}); a unit is never assumed.`);else{unit=pick(unitText.toLowerCase());if(!unit)reasons.push(`${label}: the unit is not supported; use ${hint}.`);}
    if(!sourceWord)reasons.push(`${label}: state the source, measured or reported.`);
    else if(!(RECORDED_SOURCES as readonly string[]).includes(sourceWord))reasons.push(`${label}: a recorded value needs the source measured or reported.`);
    else src=sourceWord as FactSource;
   }else{
    if(unitText)reasons.push(`${label}: a unit was given without a value.`);
    if(sourceWord){if((MISSING_SOURCES as readonly string[]).includes(sourceWord))src=sourceWord as FactSource;else reasons.push(`${label}: without a value the source can only say why it is missing (${MISSING_SOURCES.join(', ')}).`);}
   }
   return {unit,src};
  };
  const number=(label:string,x:string)=>{if(x&&!(NUM.test(x)&&x.length<=12)){reasons.push(`${label}: enter a positive number (digits and one decimal point, at most 12 characters).`);return '';}return x;};
  const sys=number('Systolic blood pressure',col(r,'systolic')),dia=number('Diastolic blood pressure',col(r,'diastolic'));
  if(!!col(r,'systolic')!==!!col(r,'diastolic'))reasons.push('Blood pressure: enter both readings or leave both blank.');
  const bp=state('Blood pressure',!!(col(r,'systolic')||col(r,'diastolic')),col(r,'bp_unit'),col(r,'bp_source'),u=>u==='mmhg'?'mmHg':u==='kpa'?'kPa':undefined,'mmHg or kPa');
  if(bp.unit==='kPa'){if(sys)entered.systolic={value:sys,unit:'kPa'};if(dia)entered.diastolic={value:dia,unit:'kPa'};}else{facts.systolic=sys;facts.diastolic=dia;}if(bp.src)prov.bloodPressure={source:bp.src};
  for(const k of SPECS){
   const raw=col(r,k.value),st=state(k.label,!!raw,col(r,k.unit),col(r,k.source),u=>Object.hasOwn(k.units,u)?k.units[u]:undefined,k.hint);let value:string;if(k.key==='weeks'&&st.unit==='wk+d'&&raw){if(convertEntered('weeks',{value:raw,unit:'wk+d'})===null){reasons.push('Gestational age: use weeks+days as 20+3, with days from 0 to 6.');value='';}else value=raw;}else value=number(k.label,raw);
   if(st.src)prov[k.measure]={source:st.src};
   if(value&&st.unit){if(st.unit===k.base)facts[k.key]=value;else (entered as any)[k.key]={value,unit:st.unit};}
  }
  const notes=col(r,'notes');if(notes.length>3000)reasons.push('Notes are limited to 3,000 characters.');else if(CONTROL.test(notes))reasons.push('Notes contain control characters.');else facts.notes=notes;
  if(Object.keys(prov).length)facts.provenance=prov;if(Object.keys(entered).length)facts.entered=entered;
  // The slice 2i rules over the converted values: a value outside the expected range needs the row's reason; one beyond the
  // confirmation range is not imported (no draft stage exists for a clinician's confirmation).
  const reasonText=col(r,'override_reason');if(reasonText.length>500)reasons.push('override_reason is limited to 500 characters.');
  const norm=normaliseUnits(structuredClone(facts));
  if(norm.problem)reasons.push(norm.problem);
  else{
   const unusual:Partial<Record<ValueField,string>>={};let any=false;
   for(const f of VALUE_FIELDS){const value=norm.facts[f];if(!value)continue;const tier=valueTier(f,value,undefined,selection),range=selection.fields[f];if(tier==='expected')continue;any=true;
    if(tier==='clinician')reasons.push(`${range.label} is beyond the confirmation range ${rangeText(f,range.confirm)} (${selection.status}). An imported visit has no step for a clinician's confirmation, so the row is not imported. Check the value and its unit.`);
    else if(reasonText.length<10)reasons.push(`${range.label} is outside the expected range ${rangeText(f,range.expected)} (${selection.status}) and the row has no override_reason of at least 10 characters.`);
    else unusual[f]=reasonText;}
   if(reasonText&&!any)reasons.push('override_reason applies only to a row with a value outside the expected range.');
   if(Object.keys(unusual).length)facts.unusual=unusual;
  }
  if(!VALUE_FIELDS.some(f=>norm.facts[f])&&!notes)reasons.push('The row has no measurement and no notes.');
  // The shared facts check is the final authority; its wording is used when it finds something the rules above did not.
  let stored:Facts|null=null;
  if(!reasons.length){try{stored=checkFacts(structuredClone(facts),Date.parse(now),undefined,selection);}catch(e){if(e instanceof AppError)reasons.push(e.message);else throw e;}}
  // Duplicates: the same person, source system and visit date as an imported visit that is still current, or as an earlier row
  // of this file. A repeat of a file, or a second file from the same system, therefore imports nothing twice.
  const key=p&&!p.mergedInto&&date&&SYSTEM.test(system)?`${p.id}|${sysKey(system)}|${date}`:'';
  if(p&&key){
   const old=existing(p).find(v=>sysKey(v.imported!.sourceSystem)===sysKey(system)&&v.facts.date===date);
   if(old){reasons.push('A visit imported from this source system on this date already exists for this record.');duplicateOf={visitId:old.id};}
   const earlier=accepted.find(a=>a.key===key);if(earlier)reasons.push(`Row ${earlier.row} in this file already imports a visit for this record, source system and date.`);
  }
  if(p&&key&&stored&&!reasons.length){accepted.push({kind:'visits',row,personId:p.id,sourceSystem:system,facts:stored,...(capture?{valueRangeCapture:capture}:{}),key});rows.push({row,status:'accepted',reasons:[],...ids});}
  else rows.push({row,status:'rejected',reasons,...ids,...(duplicateOf?{duplicateOf}:{})});
 }
 // Bound to the file as sent, the rows as parsed and classified (which carry each matched record's id and version), the
 // importer and the environment, and to the imported visits already held for the matched records, so any change forces a new dry run.
 const imports=s.workspace.visits.filter(v=>v.imported&&matched.has(v.personId)).map(v=>[v.id,v.recordVersion,!!v.voidedAt]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
 const list=accepted.map(({key,...a})=>a);
 const planHash=await digest({import:VISIT_IMPORT,environment:envName,importer:m.userId,fileDigest:digestOfFile,rows:rows.map(x=>[x.row,x.status,x.personId??null,x.version??null,x.duplicateOf?.visitId??null,x.reasons]),accepted:list,imports});
 return {rows,accepted:list,planHash,fileDigest:digestOfFile,counts:{rows:rows.length,accepted:list.length,rejected:rows.length-list.length},notice:'Row numbers, record ids, versions, counts and reasons only; clinical values and notes stay on the server. Rejected rows are never applied. Accepted rows become confirmed visits marked IMPORTED, with no clinician review or sign-off implied.'};
}
// Applies the accepted rows of a plan the caller has verified against the importer's dry run. Each becomes a confirmed visit
// marked IMPORTED with its lineage. Nothing else changes: not the person, not programme enrolments, submissions, referrals or plans.
export function applyVisitRows(s:OrgState,plan:Awaited<ReturnType<typeof planVisitRows>>,reason:string,u:Actor,m:Member,now:string){
 const w=s.workspace,batchId=uuid(),people=new Set<string>(),created:{row:number;visitId:string}[]=[];
 for(const a of plan.accepted){
  const p=w.people.find(x=>x.id===a.personId);if(!p)fail(409,'A record in this plan no longer exists. Run the dry run again.');people.add(p.id);
  const v:Visit={id:uuid(),personId:p.id,version:1,recordVersion:1,state:'confirmed',facts:structuredClone(a.facts),...(a.valueRangeCapture?{valueRangeCapture:structuredClone(a.valueRangeCapture)}:{}),createdAt:now,confirmedAt:now,aiResults:[],imported:{batchId,row:a.row,at:now,by:u.userId,byName:u.displayName,role:m.role,planHash:plan.planHash,fileDigest:plan.fileDigest,sourceSystem:a.sourceSystem}};
  if(v.valueRangeCapture)v.valueRangeCapture.id+=':'+v.id+':1';w.visits.push(v);created.push({row:a.row,visitId:v.id});
 }
 const k=plan.counts;
 w.audit.push({id:uuid(),at:now,actorId:u.userId,actor:u.displayName,role:m.role,action:'recordImportApply',subject:s.organisation.id,detail:`Import record-import-v1 (visits) batch ${batchId} applied from dry run ${plan.planHash} (file SHA-256 ${plan.fileDigest}): ${k.rows} rows, ${created.length} visits created as confirmed IMPORTED records on ${people.size} record${people.size===1?'':'s'} (no clinician sign-off implied; no enrolment, submission, referral or plan created), ${k.rejected} rejected. Reason: ${reason}`});
 // Counts and row numbers only: a replay by key returns no record or visit ids.
 return {batchId,kind:'visits' as const,counts:{...k,applied:created.length,records:people.size},rows:created.map(x=>x.row)};
}
