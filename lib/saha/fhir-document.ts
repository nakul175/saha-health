import { fail, uuid } from './core';
import { AUTHOR_ROLE_LABEL, MEASURES, MEASURE_LABEL, SOURCE_LABEL, currentOverride, factAuditText, factProvenance, factReview, measureOf, measureValue, overrideConfirmation, unusualNoteText } from './fact-provenance';
import type { ConvertibleField, Measure, Person, Role, SignOff, ValueField, Visit } from './types';
export type DocumentSummary={identifier:string;patientId:string;patientName:string;date:string;dates:string[];title:string;observations:{code:string;label:string;value:string;unit:string;date:string}[];notes:string[];warnings:string[]};
const xml=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
const coding=(code:string,display:string)=>({coding:[{system:'http://loinc.org',code,display}]});
// Slice r21 (BR-DATA-02, BR-DATA-05, BR-INT-11): coded FHIR provenance for the server-recorded
// measurement author, clinician review and supervisor sign-off, and a structured (non-note) extension
// carrying unusual-value overrides. The helpers live beside the document builder so every existing
// contract harness that transpiles fhir-document.ts keeps working; the pinned rule set
// `saha-fhir-r4-document-structure` is unchanged.
export const FHIR_ROLE_SYSTEM='urn:saha:role';
export const FHIR_USER_SYSTEM='urn:saha:user';
export const FHIR_PARTICIPANT_SYSTEM='http://terminology.hl7.org/CodeSystem/provenance-participant-type';
export const FHIR_UNUSUAL_VALUE_EXTENSION='urn:saha:fhir:unusual-value';
export const FHIR_RECORDED_AT_EXTENSION='urn:saha:fhir:recorded-at';
export const FHIR_VERIFICATION_EXTENSION='urn:saha:fhir:verification';
export type FHIRAgentType='author'|'verifier'|'attester';
export const FHIR_AGENT_LABEL:Record<FHIRAgentType,string>={author:'Author',verifier:'Verifier',attester:'Attester'};
export type FHIRProvenanceAgent={type:FHIRAgentType;userId:string;name:string;role:Role;at:string;state?:'verified'|'disputed';reason?:string};
export type FHIRResolvedAgent=Omit<FHIRProvenanceAgent,'userId'|'name'>&{who:Record<string,unknown>};
// The current supervisor sign-off, computed synchronously for the document builder: the latest sign-off
// that still matches the confirmed visit version and has not been withdrawn.
export function currentSignOffSync(v:Visit):SignOff|null{const last=v.signOffs?.at(-1);if(!last)return null;if(v.state!=='confirmed'||v.voidedAt||v.supersededBy)return null;if(last.visitVersion!==v.version)return null;if(v.signOffWithdrawals?.some(w=>w.signOffId===last.id))return null;return last;}
// The server-recorded author and clinician review of one measurement, as provenance agents.
export function observationAgents(v:Visit,m:Measure):FHIRProvenanceAgent[]{const agents:FHIRProvenanceAgent[]=[];const author=v.factAuthors?.[m];if(author)agents.push({type:'author',userId:author.userId,name:author.name,role:author.role,at:author.at});const review=factReview(v,m);if(review)agents.push({type:'verifier',userId:review.by,name:review.byName,role:'clinician',at:review.at,state:review.state,reason:review.reason});return agents;}
// The current supervisor sign-off as a provenance agent, or null.
export function signOffAgent(v:Visit):FHIRProvenanceAgent|null{const so=currentSignOffSync(v);return so?{type:'attester',userId:so.by,name:so.byName,role:so.role,at:so.at}:null;}
// Resolves agents to their FHIR `who`. The author is an existing Practitioner (the observation's
// performer); the verifier and sign-off are referenced by identifier and display name, adding no resources.
export function resolveAgents(agents:FHIRProvenanceAgent[],authorReference?:string):FHIRResolvedAgent[]{return agents.map(a=>({type:a.type,role:a.role,at:a.at,state:a.state,reason:a.reason,who:a.type==='author'&&authorReference?{reference:authorReference}:{display:a.name,identifier:{system:FHIR_USER_SYSTEM,value:a.userId}}}));}
// The structured override extension for one measurement field: the entered value and unit (when converted)
// and the current override (reason, tier, ranges version and ranges, recorder, and any confirmation).
export function overrideExtension(v:Visit,field:ValueField):{url:string;extension:unknown[]}|null{const entered=v.facts.entered?.[field as ConvertibleField];const o=currentOverride(v,field);if(!entered&&!o)return null;const sub:unknown[]=[];if(entered)sub.push({url:'enteredValue',valueString:entered.value},{url:'enteredUnit',valueString:entered.unit});if(o){sub.push({url:'reason',valueString:o.reason},{url:'tier',valueCode:o.tier},{url:'rangesVersion',valueString:o.rangesVersion},{url:'expectedRange',valueString:`${o.expected[0]}..${o.expected[1]}`},{url:'confirmRange',valueString:`${o.confirm[0]}..${o.confirm[1]}`},{url:'recordedBy',valueString:o.by.name},{url:'recordedByRole',valueCode:o.by.role},{url:'recordedAt',valueDateTime:o.at});const c=overrideConfirmation(v,o);if(c)sub.push({url:'confirmation',extension:[{url:'confirmedBy',valueString:c.byName},{url:'confirmedAt',valueDateTime:c.at},...(c.note?[{url:'note',valueString:c.note}]:[])]});}return {url:FHIR_UNUSUAL_VALUE_EXTENSION,extension:sub};}
// Build a Provenance resource over the given targets with the resolved agents. Each agent carries its own
// recorded time; the verifier agent also carries its verification state and, for a dispute, the reason.
export function buildProvenance(targets:string[],agents:FHIRResolvedAgent[],id:string,recorded:string):Record<string,unknown>{return {resourceType:'Provenance',id,target:targets.map(reference=>({reference})),recorded,agent:agents.map(a=>{const ext:unknown[]=[{url:FHIR_RECORDED_AT_EXTENSION,valueDateTime:a.at}];if(a.type==='verifier')ext.push({url:FHIR_VERIFICATION_EXTENSION,valueCode:a.state??'verified'},...(a.reason?[{url:'reason',valueString:a.reason}]:[]));return {type:{coding:[{system:FHIR_PARTICIPANT_SYSTEM,code:a.type,display:FHIR_AGENT_LABEL[a.type]}]},role:[{coding:[{system:FHIR_ROLE_SYSTEM,code:a.role,display:AUTHOR_ROLE_LABEL[a.role]??a.role}]}],who:a.who,extension:ext};})};}
export function fhirDocument(p:Person,v:Visit,organisation:string,author:string,documentId=uuid(),patientId=p.id.replace(/_/g,'-')){
 const ref=()=>`urn:uuid:${uuid()}`,patientRef=ref(),encounterRef=ref(),orgRef=ref(),authorRef=ref(),compositionRef=ref();
 const date=new Date(v.facts.date+'Z').toISOString(),entries:any[]=[];
 const put=(fullUrl:string,resource:any)=>entries.push({fullUrl,resource});
 const observations:string[]=[],recorders=new Map<string,string>();
 const recorderRef=(userId:string,name:string)=>{let r=recorders.get(userId);if(!r){r=ref();recorders.set(userId,r);put(r,{resourceType:'Practitioner',id:uuid(),name:[{text:name}]});}return r;};
 for(const [field,code,label,unit,display] of [['weight','29463-7','Body weight','kg','kg'],['temperature','8310-5','Body temperature','Cel','°C'],['systolic','8480-6','Systolic blood pressure','mm[Hg]','mmHg'],['diastolic','8462-4','Diastolic blood pressure','mm[Hg]','mmHg']] as const){const value=v.facts[field];if(!value)continue;const fullUrl=ref(),m=measureOf(field)!,pv=factProvenance(v.facts,m);observations.push(fullUrl);
  // Slice 2e: the recorder (when known) is the performer, as a Practitioner in the bundle; notes name the recorder and verification state.
  const recorder=v.factAuthors?.[m],performer=recorder?recorderRef(recorder.userId,recorder.name):authorRef;
  // Slice r21: the structured (non-note) override extension, and a Provenance resource carrying the server-recorded author and clinician review.
  const override=overrideExtension(v,field),agents=observationAgents(v,m);
  // Slice 2c: each observation carries its own time and source; reported values also say so in method.
  put(fullUrl,{resourceType:'Observation',id:uuid(),status:'final',category:[{coding:[{system:'http://terminology.hl7.org/CodeSystem/observation-category',code:'vital-signs'}]}],code:coding(code,label),subject:{reference:patientRef},encounter:{reference:encounterRef},effectiveDateTime:new Date(pv.at+'Z').toISOString(),performer:[{reference:performer}],...(override?{extension:[override]}:{}),valueQuantity:{value:Number(value),unit:display,system:'http://unitsofmeasure.org',code:unit},...(pv.source==='reported'?{method:{text:'Reported by the person or carer; not measured during the visit'}}:{}),note:[{text:`Recorded source: ${pv.source}${pv.own?'':' (visit-level)'}.${factAuditText(v,m)}${unusualNoteText(v,field)} Synthetic record.`}]});
  if(agents.length)put(ref(),buildProvenance([fullUrl],resolveAgents(agents,performer),uuid(),new Date().toISOString()));}
 const own=(m:'weeks'|'coughDays')=>{const pv=factProvenance(v.facts,m);return pv.own?` (${pv.source}, ${pv.at.replace('T',' ')} UTC)`:'';};
 const missing=MEASURES.filter(m=>!measureValue(v.facts,m)&&v.facts.provenance?.[m]).map(m=>`${MEASURE_LABEL[m]}: not recorded (${SOURCE_LABEL[v.facts.provenance![m]!.source].toLowerCase()}).`);
 const notes=[v.facts.notes,v.facts.weeks?`Reported gestational age: ${v.facts.weeks} weeks${own('weeks')}.${factAuditText(v,'weeks')}${unusualNoteText(v,'weeks')}`:'',v.facts.coughDays?`Reported cough duration: ${v.facts.coughDays} days${own('coughDays')}.${factAuditText(v,'coughDays')}${unusualNoteText(v,'coughDays')}`:'',...missing].filter(Boolean).join('\n');
 const narrative=`<div xmlns="http://www.w3.org/1999/xhtml"><p>${xml(notes||'No visit notes recorded.')}</p></div>`;
 const composition={resourceType:'Composition',id:documentId,status:'final',type:{text:'Community visit record'},subject:{reference:patientRef},encounter:{reference:encounterRef},date,author:[{reference:authorRef}],title:'Synthetic community visit record',custodian:{reference:orgRef},section:[{title:'Recorded observations',text:{status:'generated',div:narrative},...(observations.length?{entry:observations.map(reference=>({reference}))}:{})}]};
 put(patientRef,{resourceType:'Patient',id:patientId,name:[{text:p.name}],gender:p.sex==='Female'?'female':p.sex==='Male'?'male':p.sex==='Other'?'other':'unknown'});
 put(encounterRef,{resourceType:'Encounter',id:uuid(),status:'finished',class:{system:'http://terminology.hl7.org/CodeSystem/v3-ActCode',code:'HH'},subject:{reference:patientRef},period:{start:date}});
 put(orgRef,{resourceType:'Organization',id:uuid(),name:organisation});put(authorRef,{resourceType:'Practitioner',id:uuid(),name:[{text:author}]});
 // Slice r21: a visit-level Provenance for the supervisor sign-off, when one applies to this visit.
 const signer=signOffAgent(v);
 if(signer)put(ref(),buildProvenance([compositionRef],resolveAgents([signer]),uuid(),new Date().toISOString()));
 return {resourceType:'Bundle',id:documentId,meta:{versionId:'1',tag:[{system:'urn:saha:environment',code:'synthetic-unvalidated'}]},identifier:{system:'urn:saha:documents',value:documentId},type:'document',timestamp:new Date().toISOString(),entry:[{fullUrl:compositionRef,resource:composition},...entries]};
}
const supported:Record<string,{label:string;unit:string}>={'29463-7':{label:'Body weight',unit:'kg'},'8310-5':{label:'Body temperature',unit:'Cel'},'8480-6':{label:'Systolic BP',unit:'mm[Hg]'},'8462-4':{label:'Diastolic BP',unit:'mm[Hg]'}};
export function inspectDocument(raw:unknown,expectedPatientId?:string):DocumentSummary{
 const b=raw as any;if(!b||b.resourceType!=='Bundle'||b.type!=='document'||typeof b.identifier?.system!=='string'||!b.identifier.system||typeof b.identifier?.value!=='string'||!b.identifier.value||typeof b.timestamp!=='string'||!Number.isFinite(Date.parse(b.timestamp)))fail(422,'Use a FHIR R4 document Bundle with identifier and timestamp.');
 if(!Array.isArray(b.entry)||!b.entry.length||b.entry.length>40)fail(422,'Document must contain between 1 and 40 resources.');
 // Slice r21: Provenance is additionally permitted (the product emits it for author/review/sign-off); the rule set id, version and basis are unchanged.
 const byRef=new Map<string,any>(),ids=new Set<string>(),allowed=new Set(['Composition','Patient','Encounter','Observation','Organization','Practitioner','Provenance']);
 for(const e of b.entry){if(!e||typeof e.fullUrl!=='string'||!/^[a-z][a-z0-9+.-]*:/i.test(e.fullUrl)||!e.resource||typeof e.resource.id!=='string'||!e.resource.id||!allowed.has(e.resource.resourceType)||e.request||e.response||e.resource.contained||e.resource.modifierExtension)fail(422,'Unsupported document resource or entry. Contained resources and modifier extensions require partner mapping.');const key=e.resource.resourceType+'/'+e.resource.id;if(byRef.has(e.fullUrl)||ids.has(key))fail(422,'Duplicate document resource references.');ids.add(key);byRef.set(e.fullUrl,e.resource);}
 const resolve=(reference:any)=>{if(typeof reference!=='string')fail(422,'Missing document reference.');const r=byRef.get(reference)??b.entry.find((e:any)=>e.resource.resourceType+'/'+e.resource.id===reference)?.resource;if(!r)fail(422,'Document reference is not resolved inside the bundle.');return r;};
 const c=b.entry[0].resource;if(c.resourceType!=='Composition'||c.status!=='final'||!c.type||typeof c.title!=='string'||!c.title||!Array.isArray(c.author)||!c.author.length)fail(422,'The first resource must be a final Composition with type, title and author.');
 if(b.entry.filter((e:any)=>e.resource.resourceType==='Composition').length!==1||b.entry.filter((e:any)=>e.resource.resourceType==='Patient').length!==1)fail(422,'Exactly one Composition and one Patient are required.');
 const patient=resolve(c.subject?.reference);if(patient.resourceType!=='Patient'||(expectedPatientId&&patient.id!==expectedPatientId))fail(422,'Document patient does not match the confirmed external patient link.');
 const patientName=patient.name?.[0]?.text??(Array.isArray(patient.name?.[0]?.given)?patient.name[0].given.join(' '):'')+' '+(typeof patient.name?.[0]?.family==='string'?patient.name[0].family:'');if(typeof patientName!=='string'||!patientName.trim()||patientName.length>200)fail(422,'A readable patient name is required for identity review.');
 for(const a of c.author){if(!['Practitioner','Organization'].includes(resolve(a.reference).resourceType))fail(422,'Unsupported document author.');}
 if(c.custodian&&resolve(c.custodian.reference).resourceType!=='Organization')fail(422,'Invalid document custodian.');
 const parseDate=(value:any)=>{if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(value)||!Number.isFinite(Date.parse(value)))fail(422,'Document observation dates must include time and timezone.');return new Date(value).toISOString();};
 const date=parseDate(c.date),dates=[date],observations:DocumentSummary['observations']=[],warnings:string[]=[],notes:string[]=[];
 for(const e of b.entry){const r=e.resource;if(r.resourceType==='Encounter'||r.resourceType==='Observation'){if(resolve(r.subject?.reference)!==patient)fail(422,'All clinical resources must refer to the same document patient.');}if(r.encounter&&resolve(r.encounter.reference).resourceType!=='Encounter')fail(422,'Invalid encounter reference.');if(r.resourceType==='Encounter'){if(r.period?.start)dates.push(parseDate(r.period.start));if(r.period?.end)dates.push(parseDate(r.period.end));}if(r.resourceType!=='Observation')continue;
 if(!['final','amended','corrected'].includes(r.status))fail(422,'Only final, amended or corrected observations may be reviewed.');const at=parseDate(r.effectiveDateTime);dates.push(at);const add=(code:any,q:any)=>{const cd=code?.coding?.find((x:any)=>x.system==='http://loinc.org'&&supported[x.code]);if(!cd){warnings.push('Unsupported observation code retained only in source document.');return;}const spec=supported[cd.code];if(!q||typeof q.value!=='number'||!Number.isFinite(q.value)||q.value<0||q.system!=='http://unitsofmeasure.org'||q.code!==spec.unit)fail(422,'Observation units or values do not match the supported field.');observations.push({code:cd.code,label:spec.label,value:String(q.value),unit:spec.unit,date:at});};
 if(r.component){if(!Array.isArray(r.component)||r.component.length>10)fail(422,'Invalid observation components.');for(const part of r.component)add(part.code,part.valueQuantity);}else add(r.code,r.valueQuantity);
 }
 if(c.encounter&&resolve(c.encounter.reference).resourceType!=='Encounter')fail(422,'Invalid Composition encounter.');
 if(!Array.isArray(c.section)||!c.section.length)fail(422,'Document requires at least one section.');for(const section of c.section){if(section.section)fail(422,'Nested sections require a partner-specific document mapper.');if(!section.text&&!section.entry?.length)fail(422,'Empty document section.');for(const e of section.entry??[])resolve(e.reference);if(section.text?.div){if(typeof section.text.div!=='string'||section.text.div.length>6000)fail(422,'Section narrative is too large.');notes.push(section.text.div);}}
 const walk=(value:any,depth=0)=>{if(depth>20)fail(422,'Document nesting exceeds the supported limit.');if(!value||typeof value!=='object')return;for(const [key,item] of Object.entries(value)){if(key==='reference')resolve(item);else walk(item,depth+1);}};walk(b);
 return {identifier:String(b.identifier.system)+'|'+String(b.identifier.value),patientId:patient.id,patientName:patientName.trim(),date,dates,title:c.title,observations,notes,warnings:[...new Set(warnings),'Structural subset checks only. Full FHIR and ABDM profile validation has not been performed.']};
}
