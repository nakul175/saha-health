import { fail } from './core';
import { openPatientWork } from './continuity';
import { ABSENCE, own, questions, followUpOpen } from './programmes';
import { PROGRAMMES, type Member, type OrgState, type Person, type Programme } from './types';

// Slice 6d: a versioned indicator registry, cohort queries with small-cell suppression, and a
// governed question interpreter (BR-AG-11, BR-REP-02..05). Managers choose catalogue indicators
// only; there is no free query language. Every figure is computed over the viewer's current scope.
export const MIN_CELL=5;
type Ctx={s:OrgState;people:Person[];since:string;until:string;today:string};
// Slice 10i: imported visits (historical records from another system) are not counted as visits recorded in Saha.
const visitsOf=(c:Ctx,p:Person)=>c.s.workspace.visits.filter(v=>v.personId===p.id&&!v.voidedAt&&!v.supersededBy&&!v.imported);
const inWindow=(c:Ctx,t?:string)=>!!t&&t>=c.since&&t<=c.until;
// Slice 2a: reuse metering, reproducible from stored visits. A question shared by N programme packs in
// one visit is N-1 reuse opportunities; answering it once reuses it for all N; an absence reason blocks it.
export function reuseOf(v:{facts:Record<string,any>;programmeCapture?:any}){const c=v.programmeCapture,blockedBy=Object.fromEntries(ABSENCE.map(x=>[x,0])) as Record<typeof ABSENCE[number],number>;let opportunities=0,reused=0,blocked=0,unresolved=0;if(!c)return {opportunities,reused,blocked,unresolved,blockedBy};
 const current=new Map(questions(c).map(q=>[q.id,q])),snapshot=Array.isArray(c.reuseOpportunities)?c.reuseOpportunities:questions(c).filter(q=>q.programmes.length>1).map(q=>({questionId:q.id,links:q.programmes.length-1}));
 for(const o of snapshot){const k=Number(o.links);if(!Number.isInteger(k)||k<1)continue;opportunities+=k;const q=current.get(String(o.questionId)),value=q?.fact?v.facts[q.fact]:own(c.answers,String(o.questionId)),reason=own(c.absence,String(o.questionId));if(String(value??'').trim())reused+=k;else if(ABSENCE.includes(reason as any)){blocked+=k;blockedBy[reason as typeof ABSENCE[number]]+=k;}else unresolved+=k;}
 return {opportunities,reused,blocked,unresolved,blockedBy};}
const confirmedIn=(c:Ctx,p:Person)=>visitsOf(c,p).filter(v=>v.state==='confirmed'&&inWindow(c,v.confirmedAt??v.createdAt));
const signature=(v:{facts:Record<string,any>})=>[String(v.facts.date??'').slice(0,10),v.facts.weight,v.facts.systolic,v.facts.diastolic,v.facts.temperature].join('|');
// Slice 6s: the computation vocabulary. Every definition, built-in or owner-maintained, is a numerator
// and optional denominator drawn from these per-patient measures, cohort filters from a fixed list and
// exclusions from a fixed list. Bounded versioned calculations can combine these measures; free field access is refused.
export type MeasureId='patients'|'patients-seen'|'visits-confirmed'|'followups-open'|'followups-overdue'|'referrals-created'|'referrals-completed'|'maternal-episodes-active'|'open-work-unowned'|'submissions-unresolved'|'reuse-opportunities'|'reuse-served'|'reuse-blocked'|'reuse-blocked-unknown'|'reuse-blocked-not-measured'|'reuse-blocked-declined'|'reuse-blocked-unable'|'repeat-entries'|'corrections'|'identity-provisional';
type Measure={id:MeasureId;label:string;sources:string[];count:(c:Ctx,p:Person)=>number};
export const MEASURES:Measure[]=[
 {id:'patients',label:'Patients in the cohort',sources:['patients'],count:()=>1},
 {id:'patients-seen',label:'Patients with at least one visit confirmed in the window',sources:['patients','visits'],count:(c,p)=>confirmedIn(c,p).length?1:0},
 {id:'visits-confirmed',label:'Visits confirmed in the window',sources:['visits'],count:(c,p)=>confirmedIn(c,p).length},
 {id:'followups-open',label:'Open follow-ups today',sources:['follow-ups'],count:(c,p)=>(p.followUps??[]).filter(f=>followUpOpen(c.s,f)).length},
 {id:'followups-overdue',label:'Open follow-ups past their due date today',sources:['follow-ups'],count:(c,p)=>(p.followUps??[]).filter(f=>followUpOpen(c.s,f)&&f.due<c.today).length},
 {id:'referrals-created',label:'Referrals created in the window',sources:['referrals'],count:(c,p)=>c.s.workspace.referrals.filter(x=>x.personId===p.id&&inWindow(c,x.createdAt)).length},
 {id:'referrals-completed',label:'Referrals created in the window now completed',sources:['referrals'],count:(c,p)=>c.s.workspace.referrals.filter(x=>x.personId===p.id&&inWindow(c,x.createdAt)&&x.state==='completed').length},
 {id:'maternal-episodes-active',label:'Maternal episodes active today',sources:['enrolments'],count:(_c,p)=>(p.enrolments??[]).filter(e=>e.packId==='maternal'&&e.state==='active').length},
 {id:'open-work-unowned',label:'Open items whose owner is not an active member',sources:['follow-ups','referrals','outreach'],count:(c,p)=>{const active=new Set(c.s.members.filter(m=>m.status==='active').map(m=>m.userId));return openPatientWork(c.s,p).filter(w=>!w.ownerId||!active.has(w.ownerId)).length;}},
 {id:'submissions-unresolved',label:'Submissions queued, sending, retryable or uncertain today',sources:['submissions'],count:(c,p)=>c.s.workspace.submissions.filter(x=>x.personId===p.id&&['queued','sending','retryable','uncertain'].includes(x.state)).length},
 {id:'reuse-opportunities',label:'Reuse opportunities: programme links beyond the first for questions shared by several packs in a confirmed visit',sources:['visits'],count:(c,p)=>confirmedIn(c,p).reduce((a,v)=>a+reuseOf(v).opportunities,0)},
 {id:'reuse-served',label:'Programme links served by one shared answer beyond the first',sources:['visits'],count:(c,p)=>confirmedIn(c,p).reduce((a,v)=>a+reuseOf(v).reused,0)},
 {id:'reuse-blocked',label:'Reuse opportunities where the shared answer was recorded as unknown, declined, not measured or unobtainable',sources:['visits'],count:(c,p)=>confirmedIn(c,p).reduce((a,v)=>a+reuseOf(v).blocked,0)},
 {id:'reuse-blocked-unknown',label:'Blocked reuse links recorded as unknown',sources:['visits'],count:(c,p)=>confirmedIn(c,p).reduce((a,v)=>a+reuseOf(v).blockedBy.Unknown,0)},
 {id:'reuse-blocked-not-measured',label:'Blocked reuse links recorded as not measured',sources:['visits'],count:(c,p)=>confirmedIn(c,p).reduce((a,v)=>a+reuseOf(v).blockedBy['Not measured'],0)},
 {id:'reuse-blocked-declined',label:'Blocked reuse links recorded as declined',sources:['visits'],count:(c,p)=>confirmedIn(c,p).reduce((a,v)=>a+reuseOf(v).blockedBy.Declined,0)},
 {id:'reuse-blocked-unable',label:'Blocked reuse links recorded as unable to obtain',sources:['visits'],count:(c,p)=>confirmedIn(c,p).reduce((a,v)=>a+reuseOf(v).blockedBy['Unable to obtain'],0)},
 {id:'repeat-entries',label:'Confirmed visits repeating the date and core measurements of an earlier confirmed visit for the same person',sources:['visits'],count:(c,p)=>{const all=visitsOf(c,p).filter(v=>v.state==='confirmed').sort((a,b)=>(a.confirmedAt??a.createdAt).localeCompare(b.confirmedAt??b.createdAt));const seen=new Set<string>();let n=0;for(const v of all){const k=signature(v);if(seen.has(k)&&inWindow(c,v.confirmedAt??v.createdAt))n++;seen.add(k);}return n;}},
 {id:'corrections',label:'Correction drafts started and visits marked wrong-patient in the window',sources:['visits'],count:(c,p)=>c.s.workspace.visits.filter(v=>v.personId===p.id&&((v.amendsVisitId&&inWindow(c,v.createdAt))||inWindow(c,v.voidedAt))).length},
 {id:'identity-provisional',label:'Patients whose identity review is provisional today',sources:['patients'],count:(_c,p)=>p.identityReview?.state==='provisional'&&!p.mergedInto?1:0},
];
export const MEASURE_IDS=MEASURES.map(m=>m.id) as [MeasureId,...MeasureId[]];
// Versioned bounded owner calculations: no fields, code, definition references or negative contributions.
export type Expression={measure:MeasureId}|{constant:number}|{op:'sum'|'min'|'max'|'any'|'all';terms:Expression[]}|{op:'at-least';term:Expression;value:number};
export type CompositeOperand={version:1;expression:Expression;fixtures:{inputs:Partial<Record<MeasureId,number>>;expected:number}[]};
export type Operand=MeasureId|CompositeOperand;
export type MeasureRef=MeasureId|`expr-v1:${string}`;
const MAX_CONTRIBUTION=100000;
const integer=(n:unknown,max=MAX_CONTRIBUTION)=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0&&n<=max;
const object=(x:any)=>!!x&&typeof x==='object'&&!Array.isArray(x);
const exact=(x:any,keys:string[])=>object(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
export function expressionError(root:unknown):string|null{let nodes=0,operations=0,leaves=0;const walk=(n:any,depth:number):boolean=>{
 if(++nodes>31||depth>5||!object(n))return false;
 if(exact(n,['measure'])){leaves++;return MEASURE_IDS.includes(n.measure);}
 if(exact(n,['constant']))return integer(n.constant,1000);
 operations++;if(exact(n,['op','term','value'])&&n.op==='at-least')return integer(n.value)&&n.value>0&&walk(n.term,depth+1);
 return exact(n,['op','terms'])&&['sum','min','max','any','all'].includes(n.op)&&Array.isArray(n.terms)&&n.terms.length>=2&&n.terms.length<=4&&n.terms.every((t:any)=>walk(t,depth+1));
 };return walk(root,1)&&leaves>0&&operations>0?null:'Choose a calculation with known measures, 2–4 terms, at most 31 nodes and 5 levels; constants 0–1000 and thresholds 1–100000.';}
export function expressionLeaves(n:Expression):MeasureId[]{if('measure' in n)return [n.measure];if('constant' in n)return [];return [...new Set(('term' in n?[n.term]:n.terms).flatMap(expressionLeaves))].sort();}
export function evaluateExpression(n:Expression,input:(id:MeasureId)=>number):number{let value:number;if('measure' in n)value=input(n.measure);else if('constant' in n)value=n.constant;else if(n.op==='at-least')value=evaluateExpression(n.term,input)>=n.value?1:0;else{const a=n.terms.map(t=>evaluateExpression(t,input));value=n.op==='sum'?a.reduce((x,y)=>x+y,0):n.op==='min'?Math.min(...a):n.op==='max'?Math.max(...a):n.op==='any'?(a.some(x=>x>0)?1:0):(a.every(x=>x>0)?1:0);}if(!integer(value))fail(422,'A calculation contribution exceeds the supported nonnegative integer range. Nothing was shown.');return value;}
export function operandError(x:unknown):string|null{if(typeof x==='string')return MEASURE_IDS.includes(x as MeasureId)?null:'Choose a known measure.';const o=x as CompositeOperand;if(!exact(o,['version','expression','fixtures'])||o.version!==1)return 'Choose a supported version 1 calculation.';const error=expressionError(o.expression);if(error)return error;const leaves=expressionLeaves(o.expression);if(!Array.isArray(o.fixtures)||o.fixtures.length<2||o.fixtures.length>6)return 'Supply 2–6 independently reviewed calculation examples.';const examples=new Set<string>();for(const f of o.fixtures){if(!exact(f,['inputs','expected'])||!exact(f.inputs,leaves)||!integer(f.expected)||!Object.values(f.inputs).every(n=>integer(n)))return 'Each example needs every referenced measure once, nonnegative integer inputs and an expected result.';const key=JSON.stringify(leaves.map(id=>f.inputs[id]));if(examples.has(key))return 'Use distinct calculation example inputs.';examples.add(key);try{if(evaluateExpression(o.expression,id=>f.inputs[id]!)!==f.expected)return 'A calculation example does not match its expected result.';}catch{return 'A calculation example exceeds the supported contribution range.';}}return null;}
export function canonicalExpression(n:Expression):Expression{if('measure' in n)return {measure:n.measure};if('constant' in n)return {constant:n.constant};if(n.op==='at-least')return {op:n.op,term:canonicalExpression(n.term),value:n.value};return {op:n.op,terms:n.terms.map(canonicalExpression).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))};}
export const operandLeaves=(o:Operand)=>typeof o==='string'?[o]:expressionLeaves(o.expression);
export const operandRef=(o:Operand):MeasureRef=>typeof o==='string'?o:`expr-v1:${JSON.stringify(canonicalExpression(o.expression))}`;
export function referenceExpression(id:string):Expression|null{if(MEASURE_IDS.includes(id as MeasureId))return null;if(!id.startsWith('expr-v1:')||id.length>5000)fail(422,'The stored calculation needs review.');let e:unknown;try{e=JSON.parse(id.slice(8));}catch{fail(422,'The stored calculation needs review.');}if(expressionError(e))fail(422,'The stored calculation needs review.');return e as Expression;}
export function referenceValue(id:string,input:(id:MeasureId)=>number){const e=referenceExpression(id);return e?evaluateExpression(e,input):input(id as MeasureId);}
export function operandLabel(o:Operand):string{if(typeof o==='string')return MEASURES.find(m=>m.id===o)!.label;const label=(e:Expression):string=>'measure' in e?operandLabel(e.measure):'constant' in e?String(e.constant):e.op==='at-least'?`At least ${e.value} (${label(e.term)})`:`${({sum:'Sum',min:'Smallest',max:'Largest',any:'Any positive',all:'All positive'} as const)[e.op]} (${e.terms.map(label).join('; ')})`;return label(o.expression);}

export const AGE_BANDS=['0–9','10–17','18–49','50+'] as const;
export const SEXES=['Female','Male','Other'] as const;
export const EXCLUSIONS=['identity-provisional','no-programme'] as const;
export const CADENCES=['Daily','Weekly','Monthly','Quarterly'] as const;
export type Exclusion=typeof EXCLUSIONS[number];
export type Spec={title:string;unit:'count'|'proportion';numerator:Operand;denominator:Operand|null;filters:{programme?:Programme;ageBand?:typeof AGE_BANDS[number];sex?:typeof SEXES[number]};exclude:Exclusion[];exclusionsNote:string;owner:string;cadence:typeof CADENCES[number];minimumCohort:number};
export type DefinitionRecord={id:string;version:number;status:'active'|'retired'|'proposed';intendedStatus?:'active'|'retired';rollbackFrom?:number;spec:Spec;reason:string;by:string;byName:string;at:string;builtIn?:boolean};
// The slice 6d catalogue, now the version 1 entries of the registry. Keywords serve the interpreter only.
const BUILT_IN_AT='2026-09-30T00:00:00.000Z';
const b=(id:string,title:string,unit:'count'|'proportion',numerator:MeasureId,denominator:MeasureId|null,exclusionsNote:string,owner:string,cadence:Spec['cadence'],keywords:string[])=>({record:{id,version:1,status:'active' as const,spec:{title,unit,numerator,denominator,filters:{},exclude:[] as Exclusion[],exclusionsNote,owner,cadence,minimumCohort:MIN_CELL},reason:'Built-in catalogue definition (slice 6d).',by:'built-in',byName:'Saha release',at:BUILT_IN_AT,builtIn:true},keywords});
const BUILT_IN=[
 b('visits-confirmed','Confirmed visits','count','visits-confirmed',null,'Voided and superseded visits','Programme manager','Weekly',['visit','visits','confirmed','encounter']),
 b('patients-seen','Patients with a confirmed visit','proportion','patients-seen','patients','Voided and superseded visits','Programme manager','Monthly',['seen','coverage','reached','patients seen']),
 b('followups-overdue','Overdue follow-ups','proportion','followups-overdue','followups-open','Completed and cancelled follow-ups','Supervisor','Weekly',['overdue','follow-up','follow-ups','followup','followups','late']),
 b('referrals-completed','Referrals completed','proportion','referrals-completed','referrals-created','None','Programme manager','Monthly',['referral','referrals','completed referrals']),
 b('maternal-episodes','Active maternal episodes','count','maternal-episodes-active',null,'Closed episodes','Maternal programme lead','Monthly',['maternal','pregnancy','pregnant','anc','antenatal']),
 b('open-work-unowned','Open work without an active owner','count','open-work-unowned',null,'None','Supervisor','Weekly',['unowned','orphaned','owner','responsibility','gap','gaps']),
 b('submissions-unresolved','Unresolved programme submissions','count','submissions-unresolved',null,'Accepted, rejected and cancelled','Data manager','Daily',['submission','submissions','unresolved','uncertain','programme record','mis']),
 b('reuse-shared-answers','Shared answers reused across programmes','proportion','reuse-served','reuse-opportunities','Voided and superseded visits; visits with one pack','Programme manager','Monthly',['reuse','reused','shared','re-entry','duplication']),
 b('reuse-blocked','Reuse blocked by a missing shared answer','count','reuse-blocked',null,'Voided and superseded visits','Programme manager','Monthly',['blocked','missing answer','absence']),
 b('reuse-blocked-unknown','Reuse blocked: unknown','count','reuse-blocked-unknown',null,'Voided and superseded visits','Programme manager','Monthly',['blocked','unknown','reuse reason']),
 b('reuse-blocked-not-measured','Reuse blocked: not measured','count','reuse-blocked-not-measured',null,'Voided and superseded visits','Programme manager','Monthly',['blocked','not measured','reuse reason']),
 b('reuse-blocked-declined','Reuse blocked: declined','count','reuse-blocked-declined',null,'Voided and superseded visits','Programme manager','Monthly',['blocked','declined','reuse reason']),
 b('reuse-blocked-unable','Reuse blocked: unable to obtain','count','reuse-blocked-unable',null,'Voided and superseded visits','Programme manager','Monthly',['blocked','unable to obtain','reuse reason']),
 b('repeat-entry','Possible repeated entries','count','repeat-entries',null,'Voided and superseded visits','Data manager','Monthly',['repeat','repeated','duplicate entry','entered twice','double entry']),
 b('corrections','Visit corrections','count','corrections',null,'None','Data manager','Monthly',['correction','corrections','amended','voided','wrong patient']),
 b('identity-provisional','Provisional identities','count','identity-provisional',null,'Merged records','Identity steward','Weekly',['identity','provisional','duplicate','unverified']),
];
export const BUILT_IN_IDS=BUILT_IN.map(x=>x.record.id);
// Every version of every definition: built-in version 1 entries, then the owner's appended records.
export const registryRecords=(s?:OrgState):DefinitionRecord[]=>[...BUILT_IN.map(x=>x.record),...(((s?.operations as any)?.indicatorDefinitions??[]) as DefinitionRecord[])];
export type DefinitionEvent={id:string;definitionId:string;definitionVersion:number;sequence:number;kind:'proposed'|'approved'|'rejected'|'released'|'withdrawn';by:string;byName:string;at:string;reason:string;memberVersion:number;role:Member['role'];reviewEventId?:string;effectiveAt?:string};
export const definitionEvents=(s?:OrgState):DefinitionEvent[]=>((s?.operations as any)?.indicatorDefinitionEvents??[]);
export function definitionLifecycle(s:OrgState|undefined,r:DefinitionRecord,now=new Date()){
 const events=definitionEvents(s).filter(e=>e.definitionId===r.id&&e.definitionVersion===r.version),last=events.at(-1),review=[...events].reverse().find(e=>e.kind==='approved'),release=events.find(e=>e.kind==='released');
 const eligible=r.status!=='proposed'||!!(release&&last?.kind!=='withdrawn'&&release.effectiveAt&&Date.parse(release.effectiveAt)<=now.getTime());
 const status=r.status!=='proposed'?r.status:last?.kind==='withdrawn'?'withdrawn':release?(eligible?(r.intendedStatus??'active'):'scheduled'):last?.kind==='approved'?'approved':last?.kind==='rejected'?'rejected':'proposed';
 return {status,eligible,review,release,events,governanceVersion:definitionEvents(s).filter(e=>e.definitionId===r.id).length,legacy:r.status!=='proposed'};
}
export function currentDefinitions(s?:OrgState,now=new Date()){const latest=new Map<string,DefinitionRecord>();for(const r of registryRecords(s)){if(!definitionLifecycle(s,r,now).eligible)continue;const x=latest.get(r.id);if(!x||r.version>x.version)latest.set(r.id,{...r,status:r.status==='proposed'?(r.intendedStatus??'active'):r.status});}return [...latest.values()];}
const measure=(id:MeasureId)=>MEASURES.find(m=>m.id===id)!;
// A definition's canonical form; its digest is stated with every result so a reader can match it to the registry.
export const canonicalSpec=(r:DefinitionRecord)=>JSON.stringify({id:r.id,version:r.version,unit:r.spec.unit,numerator:r.spec.numerator,denominator:r.spec.denominator,filters:Object.fromEntries(Object.entries(r.spec.filters).sort()),exclude:[...r.spec.exclude].sort(),minimumCohort:r.spec.minimumCohort});
// Resolve "id" (current version) or "id@N" (that recorded version, even if later revised or retired).
export function resolveDefinition(s:OrgState|undefined,ref:string,now=new Date()){const m=/^([a-z][a-z0-9-]{1,39})(?:@(\d{1,4}))?$/.exec(ref);if(!m)fail(422,'Choose up to eight catalogue indicators.');const all=registryRecords(s).filter(r=>r.id===m![1]);if(!all.length)fail(422,'Choose up to eight catalogue indicators.');
 if(m![2]){const r=all.find(x=>x.version===Number(m![2]));if(!r||!definitionLifecycle(s,r,now).eligible||(r.intendedStatus??r.status)==='retired')fail(422,'That indicator version is not released and effective in the registry.');return r!;}
 const eligible=all.filter(x=>definitionLifecycle(s,x,now).eligible);if(!eligible.length)fail(422,'That indicator has no released effective definition.');const r=eligible.reduce((a,x)=>x.version>a.version?x:a);if((r.intendedStatus??r.status)==='retired')fail(422,`The indicator "${r.spec.title}" was retired. Run an earlier version by number to reproduce a past result.`);return r;}
export const GROUPS=['none','team','village','programme','age-band'] as const;
export type Group=typeof GROUPS[number];
const band=(age:number)=>age<10?'0–9':age<18?'10–17':age<50?'18–49':'50+';
const keysFor=(s:OrgState,p:Person,g:Group):string[]=>g==='team'?[s.teams.find(t=>t.id===p.teamId)?.name??'Unknown team']:g==='village'?[p.village]:g==='programme'?(p.programmes.length?p.programmes:['None']):g==='age-band'?[band(p.age)]:['All'];
export function manager(m:Member){if(m.status!=='active'||m.role==='admin'||m.role==='asha'||!(m.role==='supervisor'||m.isOwner))fail(403,'Indicators are for supervisors and owners with patient access.');}
// Suppress 1..MIN_CELL-1 counts, proportions with a small denominator, and one more cell when a
// single suppressed cell could be recovered from the total.
function suppress(rows:{group:string;n:number;d?:number}[],unit:'count'|'proportion'){
 const small=(x:number)=>x>0&&x<MIN_CELL;
 const out=rows.map(r=>({...r,suppressed:unit==='count'?small(r.n):(small(r.d??0)||small(r.n)||small((r.d??0)-r.n))}));
 if(out.length>1&&out.filter(r=>r.suppressed).length===1){const next=out.filter(r=>!r.suppressed&&r.n>0).sort((a,b)=>a.n-b.n)[0];if(next)next.suppressed=true;}
 return out.map(r=>r.suppressed?{group:r.group,value:null,numerator:null,denominator:null,suppressed:true}:{group:r.group,value:unit==='count'?r.n:(r.d?Math.round(r.n/r.d*1000)/10:null),numerator:r.n,denominator:unit==='proportion'?r.d??0:null,suppressed:false});
}
export type Query={ids:string[];days:number;group:Group;team?:string|null;village?:string|null;programme?:string|null};
// Slice 6s: the people counted in each released cell, per (grouping, definition cohort). These counts never
// leave the server; they feed the differencing check across one viewer's recent queries.
// Slice 6w: a definition contributes two series: its people per cell, and its numerator and denominator per
// cell (keyed by measure). Definition filters are carried in `f` as nesting dimensions (sex, ageBand,
// defProgramme), not in the series key, so complementary definitions are compared with each other.
export type Series={key:string;f:Record<string,string>;cells:Record<string,number>;m?:Record<string,[number,number]>;ids:string[];
 // Slice 6aa (seventh review): what the release discloses, for the population check in indicator-differencing.
 // n/d: the measures shown; gd: the grouping dimension; x: exclusions; w: window start; shown: cells whose values were returned.
 n?:MeasureRef;d?:MeasureRef|null;gd?:Group;x?:string[];w?:string;shown?:string[];
 // Slice 6ad (ninth review, finding 2): the window end, set by an aggregate report for a period that ended in the past.
 u?:string};
// Slice 6aa: measures counted over the query window; the others describe today and do not depend on it.
const PRIMITIVE_WINDOWED=new Set<MeasureId>(['patients-seen','visits-confirmed','referrals-created','referrals-completed','reuse-opportunities','reuse-served','reuse-blocked','reuse-blocked-unknown','reuse-blocked-not-measured','reuse-blocked-declined','reuse-blocked-unable','repeat-entries','corrections']);
export const WINDOWED=new class extends Set<string>{has(id:string){if(PRIMITIVE_WINDOWED.has(id as MeasureId))return true;if(MEASURE_IDS.includes(id as MeasureId))return false;return expressionLeaves(referenceExpression(id)!).some(x=>PRIMITIVE_WINDOWED.has(x));}}(PRIMITIVE_WINDOWED);
// A person's value of one measure over the window starting at `since` (ISO) and ending now.
// Slice 6ad: `now` is the window end (and the moment a measure describing today is counted at).
export function measureValue(s:OrgState,p:Person,id:string,since:string,now:Date){const today=now.toISOString().slice(0,10);return referenceValue(id,leaf=>measure(leaf).count({s,people:[],since,until:now.toISOString(),today},p));}
export const ageBandOf=(age:number)=>band(age);
export const groupLabels=(s:OrgState,p:Person,g:Group)=>keysFor(s,p,g);
// Reporting cutoff and current definition authority are separate clocks. Aggregate windows can be historical.
export function indicatorRun(s:OrgState,m:Member,q:Query,now=new Date(),governanceAt=new Date()){
 manager(m);
 if(!q.ids.length||q.ids.length>8)fail(422,'Choose up to eight catalogue indicators.');
 const defs=q.ids.map(ref=>resolveDefinition(s,ref,governanceAt));
 if(!GROUPS.includes(q.group))fail(422,'Choose a grouping from the catalogue.');if(!Number.isInteger(q.days)||q.days<1||q.days>366)fail(422,'Choose a window of 1 to 366 days.');
 if(q.team&&!m.teamIds.includes(q.team))fail(403,'Choose one of your teams.');
 const today=now.toISOString().slice(0,10),ctx0={since:new Date(Date.parse(today+'T00:00:00Z')-(q.days-1)*86400000).toISOString(),until:now.toISOString(),today};
 const people=s.workspace.people.filter(p=>p.assigned&&!p.mergedInto&&(!q.team||p.teamId===q.team)&&(!q.village||p.village===q.village)&&(!q.programme||p.programmes.includes(q.programme as any)));
 // Filter-composition protection: a cohort smaller than the minimum cell is refused outright.
 if(people.length<MIN_CELL)fail(422,`This cohort has fewer than ${MIN_CELL} people. Widen the filters.`);
 const ctx:Ctx={s,people,...ctx0};
 const latest=[...s.workspace.visits.filter(v=>people.some(p=>p.id===v.personId)).map(v=>v.confirmedAt??v.createdAt),...s.workspace.submissions.filter(x=>people.some(p=>p.id===x.personId)).map(x=>x.updatedAt)].sort().at(-1)??null;
 const series=new Map<string,Series>();
 const cohortCells:Record<string,number>={};for(const p of people)for(const k of keysFor(s,p,'none'))cohortCells[k]=(cohortCells[k]??0)+1;
 series.set('cohort',{key:'cohort',f:{},cells:cohortCells,ids:[],n:'patients',d:null,gd:'none',x:[],w:ctx0.since,shown:Object.keys(cohortCells)});
 const results=defs.map(def=>{const sp=def.spec,f=sp.filters;
  const head={id:def.id,version:def.version,title:sp.title,unit:sp.unit,numerator:operandLabel(sp.numerator),denominator:sp.denominator?operandLabel(sp.denominator):null,definition:{id:def.id,version:def.version,recordedAt:def.at,canonical:canonicalSpec(def),governance:{legacy:definitionLifecycle(s,def,governanceAt).legacy,reviewEventId:definitionLifecycle(s,def,governanceAt).release?.reviewEventId??null,releaseEventId:definitionLifecycle(s,def,governanceAt).release?.id??null,effectiveAt:definitionLifecycle(s,def,governanceAt).release?.effectiveAt??null}}};
  const cohort=people.filter(p=>(!f.programme||p.programmes.includes(f.programme))&&(!f.ageBand||band(p.age)===f.ageBand)&&(!f.sex||p.sex===f.sex)&&!(sp.exclude.includes('identity-provisional')&&p.identityReview?.state==='provisional')&&!(sp.exclude.includes('no-programme')&&!p.programmes.length));
  // Slice 6s: the definition's own minimum cohort, applied after its filters and exclusions.
  if(cohort.length<Math.max(MIN_CELL,sp.minimumCohort))return {...head,rows:[],refused:'cohort' as const,message:`This definition needs a cohort of at least ${Math.max(MIN_CELL,sp.minimumCohort)} people after its own filters. Widen the filters.`};
  const composite=typeof sp.numerator!=='string'||(sp.denominator!==null&&typeof sp.denominator!=='string'),dependencies=[...new Set([...operandLeaves(sp.numerator),...(sp.denominator?operandLeaves(sp.denominator):[])])],nr=operandRef(sp.numerator),dr=sp.denominator?operandRef(sp.denominator):null;
  const groups=new Map<string,{n:number;d:number;people:number}>();
  for(const p of cohort){const n=referenceValue(operandRef(sp.numerator),id=>measure(id).count(ctx,p)),d=sp.denominator?referenceValue(operandRef(sp.denominator),id=>measure(id).count(ctx,p)):0;if(composite&&sp.unit==='proportion'&&n>d)fail(422,'A proportion calculation exceeds its denominator for a person. Nothing was shown.');for(const k of keysFor(s,p,q.group)){const g=groups.get(k)??{n:0,d:0,people:0};g.n+=n;g.d+=d;g.people++;groups.set(k,g);}}
  const defF:Record<string,string>=Object.fromEntries(([['sex',f.sex],['ageBand',f.ageBand],['defProgramme',f.programme]] as [string,string|undefined][]).filter(([,v])=>!!v) as [string,string][]);
  const rows=[...groups.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([group,g])=>({group,n:g.n,d:sp.unit==='proportion'?g.d:undefined}));
  const unsafe=new Set<string>();if(composite)for(const leaf of dependencies){const a=new Map<string,number>();for(const p of cohort)for(const k of keysFor(s,p,q.group))a.set(k,(a.get(k)??0)+measure(leaf).count(ctx,p));for(const [k,n] of a)if(n>0&&n<MIN_CELL)unsafe.add(k);}
  const out=suppress(rows.map(r=>unsafe.has(r.group)?{...r,n:1}:r),sp.unit),shown=out.filter(r=>!r.suppressed).map(r=>r.group);
  const base=`${q.group}|${[...sp.exclude].sort().join(',')}`,pc=Object.fromEntries([...groups].map(([g,x])=>[g,x.people]));
  for(const [key,m] of [[base,undefined],[`${base}|${nr}/${dr??''}`,Object.fromEntries([...groups].map(([g,x])=>[g,[x.n,x.d] as [number,number]]))]] as [string,Record<string,[number,number]>|undefined][]){
   const id=key+'#'+JSON.stringify(defF)+(m?'#'+sp.unit:''),sr=series.get(id)??{key,f:defF,cells:pc,...(m?{m,n:nr,d:sp.unit==='proportion'?dr:null,gd:q.group,x:[...sp.exclude].sort(),w:ctx0.since,shown}:{}),ids:[]};sr.ids.push(def.id+'@'+def.version);series.set(id,sr);}
  if(composite)for(const leaf of dependencies){const counts:Record<string,number>={};for(const p of cohort)for(const k of keysFor(s,p,q.group))counts[k]=(counts[k]??0)+measure(leaf).count(ctx,p);const key=`${base}|${leaf}/`,id=key+'#'+JSON.stringify(defF)+'#count',sr=series.get(id)??{key,f:defF,cells:pc,m:Object.fromEntries(Object.entries(counts).map(([k,n])=>[k,[n,0] as [number,number]])),n:leaf,d:null,gd:q.group,x:[...sp.exclude].sort(),w:ctx0.since,shown,ids:[]};sr.ids.push(def.id+'@'+def.version);series.set(id,sr);}
  return {...head,rows:out};});
 const result={computedAt:ctx0.until,window:{since:ctx0.since,until:ctx0.until,days:q.days},cohort:{people:people.length,team:q.team??null,village:q.village??null,programme:q.programme??null},group:q.group,latestSourceRecord:latest,minimumCell:MIN_CELL,results,
  analysis:{contract:'saha-programme-analysis-v1',method:'Approved versioned indicator definitions over current authorised assigned records; merged records are excluded and small cells are suppressed.',filters:{team:q.team??null,village:q.village??null,programme:q.programme??null},definitionLineage:defs.map(def=>({ref:`${def.id}@${def.version}`,recordedAt:def.at,owner:def.spec.owner,sources:[...new Set([...operandLeaves(def.spec.numerator),...(def.spec.denominator?operandLeaves(def.spec.denominator):[])].flatMap(x=>measure(x).sources))].sort(),canonicalSpec:canonicalSpec(def)})),missingness:{latestSourceRecord:latest,note:latest?'Source completeness and freshness are reported separately; a latest record time does not prove complete capture.':'No source record was found in the selected result window; zero values must not be read as complete capture.'}},
  scope:'Current authorised teams and current assignments; merged records excluded. Counts from 1 to 4 and proportions built on them are suppressed, with one further cell suppressed where a total would reveal it.'};
 return {result,series:[...series.values()]};
}
export function indicatorQuery(s:OrgState,m:Member,q:Query,now=new Date(),governanceAt=new Date()){return indicatorRun(s,m,q,now,governanceAt).result;}
// Slice R26 (BR-DATA-06): the released indicator figures a correction may have affected. The differencing ledger
// (slices 6w/6aa) stores hashed series and cells with no patient link, so a release recorded at or after the
// corrected visit's confirmation is marked as affected. Only the release identity (its time and hashed series key)
// is returned — never a cell value — so a patient-scoped correction task can name the affected figures without
// rewriting the organisation-wide ledger it cannot write.
export type AffectedRelease={at:string;k:string|null};
export function affectedReleases(s:OrgState,confirmedAt?:string):AffectedRelease[]{
 const releases=((s.operations as any)?.indicatorReleases??[]) as {at?:string;k?:string|null}[];
 if(!confirmedAt)return [];
 return releases.filter(r=>typeof r?.at==='string'&&r.at>=confirmedAt).map(r=>({at:r.at!,k:typeof r.k==='string'?r.k:null}));
}
// Slice 6aa (seventh review): the releases a query records and the population they are checked against. Labels and
// filter values are hashed by `h` (organisation-salted on the server), so the ledger holds no names or identifiers.
export type Hash=(x:string)=>Promise<string>;
const memoHash=(h:Hash)=>{const seen=new Map<string,Promise<string>>();return (x:string)=>{let v=seen.get(x);if(!v){v=h(x);seen.set(x,v);}return v;};};
export async function releaseCandidates(series:Series[],q:{team?:string|null;village?:string|null;programme?:string|null},viewer:string,at:string,h0:Hash){
 const h=memoHash(h0),f:Record<string,string>={};for(const k of ['team','village','programme'] as const)if(q[k])f[k]=await h(`${k}:${q[k]}`);
 const hashCells=async<T,>(x:Record<string,T>)=>Object.fromEntries(await Promise.all(Object.entries(x).map(async([g,n])=>[await h(`group:${g}`),n] as const)));
 return Promise.all(series.map(async sr=>{const df:Record<string,string>={...f};for(const [k,v] of Object.entries(sr.f))df[k]=await h(`${k}:${v}`);
  const shown=new Set(sr.shown??Object.keys(sr.cells)),z=await Promise.all(Object.keys(sr.cells).filter(g=>!shown.has(g)).map(g=>h(`group:${g}`)));
  return {ids:sr.ids,isCohort:sr.key==='cohort',release:{v:viewer,at,k:await h(`series:${sr.key}`),f:df,c:await hashCells(sr.cells),...(sr.m?{m:await hashCells(sr.m)}:{}),...(sr.n?{n:sr.n,d:sr.d??null,gd:sr.gd,x:sr.x,w:sr.w,z,...(sr.u?{u:sr.u}:{})}:{})}};}));
}
export async function releasePopulation(s:OrgState,h0:Hash,now=new Date()){
 const h=memoHash(h0),people=s.workspace.people.filter(p=>p.assigned&&!p.mergedInto);
 const units=await Promise.all(people.map(async p=>{const progs=p.programmes,memo=new Map<string,number>();
  const f:Record<string,string[]>={team:[await h(`team:${p.teamId}`)],village:[await h(`village:${p.village}`)],programme:await Promise.all(progs.map(x=>h(`programme:${x}`))),defProgramme:await Promise.all(progs.map(x=>h(`defProgramme:${x}`))),sex:[await h(`sex:${p.sex}`)],ageBand:[await h(`ageBand:${band(p.age)}`)]};
  const g:Record<string,string[]>={};for(const d of GROUPS)g[d]=await Promise.all(keysFor(s,p,d).map(x=>h(`group:${x}`)));
  const x=[...(p.identityReview?.state==='provisional'?['identity-provisional']:[]),...(!progs.length?['no-programme']:[])];
  // Slice 6ad: the window key is `start` (ending now) or `start|end` (a window that ended at `end`).
  const q=(id:string,window:string)=>{const k=id+'|'+window;let v=memo.get(k);if(v===undefined){const [since,until]=window.split('|');v=measureValue(s,p,id as MeasureId,since,until?new Date(until):now);memo.set(k,v);}return v;};
  return {f,g,x,q};}));
 return {units,windowed:WINDOWED as ReadonlySet<string>};
}
// Current, non-retired definitions; registry history and the vocabulary are separate.
export function catalogue(s?:OrgState,now=new Date()){return currentDefinitions(s,now).filter(r=>r.status==='active').map(r=>({id:r.id,version:r.version,title:r.spec.title,unit:r.spec.unit,numerator:operandLabel(r.spec.numerator),denominator:r.spec.denominator?operandLabel(r.spec.denominator):null,numeratorMeasure:r.spec.numerator,denominatorMeasure:r.spec.denominator,filters:r.spec.filters,exclude:r.spec.exclude,exclusions:r.spec.exclusionsNote||'None',owner:r.spec.owner,cadence:r.spec.cadence,minimumCohort:r.spec.minimumCohort,sources:[...new Set([...operandLeaves(r.spec.numerator),...(r.spec.denominator?operandLeaves(r.spec.denominator):[])].flatMap(x=>measure(x).sources))],builtIn:!!r.builtIn,recordedAt:r.at}));}
export const vocabulary=()=>({measures:MEASURES.map(m=>({id:m.id,label:m.label})),filters:{programme:PROGRAMMES,ageBand:AGE_BANDS,sex:SEXES},exclusions:EXCLUSIONS,cadences:CADENCES,minimumCohort:MIN_CELL});
// Governed question interpreter: maps words to catalogue entries and never runs anything itself.
export function interpret(question:string,s?:OrgState){
 const t=question.toLowerCase().replace(/[^a-z0-9\s-]/g,' ');const words=new Set(t.split(/\s+/).filter(Boolean));
 const disclosure=/\b(list|names?|phone|address|details?|records?|individual|person-level|patient-level)\b/.test(t)&&/\b(patient|patients|people|person|beneficiar|recipient)\w*\b/.test(t);
 if(disclosure)return {ids:[],group:'none' as Group,days:30,understood:false,refused:'person-list' as const,note:'Programme analysis returns protected aggregates only. Patient lists, names and person-level records cannot be produced by reformulating a question.'};
 const active=new Set(catalogue(s).map(d=>d.id)),owned=catalogue(s).filter(d=>!d.builtIn&&t.includes(d.title.toLowerCase().replace(/[^a-z0-9\s-]/g,' '))).map(d=>d.id);
 const ids=[...BUILT_IN.filter(d=>active.has(d.record.id)&&d.keywords.some(k=>k.includes(' ')?t.includes(k):words.has(k))).map(d=>d.record.id),...owned].slice(0,8);
 const group:Group=/\bby (team|teams)\b/.test(t)?'team':/\bby (village|villages|locality)\b/.test(t)?'village':/\bby (programme|programmes|program)\b/.test(t)?'programme':/\bby age\b/.test(t)?'age-band':'none';
 const m=t.match(/\blast (\d{1,3}) days?\b/);const days=m?Math.min(366,Math.max(1,Number(m[1]))):/\blast week\b|\bthis week\b/.test(t)?7:/\blast month\b|\bthis month\b/.test(t)?30:/\blast year\b|\bthis year\b/.test(t)?365:30;
 return {ids,group,days,understood:ids.length>0,refused:null,note:ids.length?'Review this interpretation before running it. Only catalogue indicators can be answered.':'No catalogue indicator matches. Choose one from the list.'};
}
