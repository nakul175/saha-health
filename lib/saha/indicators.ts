import { fail } from './core';
import { openPatientWork } from './continuity';
import type { Member, OrgState, Person } from './types';

// Slice 6d: a versioned indicator registry, cohort queries with small-cell suppression, and a
// governed question interpreter (BR-AG-11, BR-REP-02..05). Managers choose catalogue indicators
// only; there is no free query language. Every figure is computed over the viewer's current scope.
export const MIN_CELL=5;
type Ctx={s:OrgState;people:Person[];since:string;until:string;today:string};
type Def={id:string;version:number;title:string;unit:'count'|'proportion';numerator:string;denominator?:string;exclusions:string;owner:string;cadence:string;sources:string[];keywords:string[];
 compute:(c:Ctx,p:Person)=>{n:number;d?:number}};
const visitsOf=(c:Ctx,p:Person)=>c.s.workspace.visits.filter(v=>v.personId===p.id&&!v.voidedAt&&!v.supersededBy);
const inWindow=(c:Ctx,t?:string)=>!!t&&t>=c.since&&t<=c.until;
export const INDICATORS:Def[]=[
 {id:'visits-confirmed',version:1,title:'Confirmed visits',unit:'count',numerator:'Visits confirmed in the window',exclusions:'Voided and superseded visits',owner:'Programme manager',cadence:'Weekly',sources:['visits'],keywords:['visit','visits','confirmed','encounter'],compute:(c,p)=>({n:visitsOf(c,p).filter(v=>v.state==='confirmed'&&inWindow(c,v.confirmedAt??v.createdAt)).length})},
 {id:'patients-seen',version:1,title:'Patients with a confirmed visit',unit:'proportion',numerator:'Patients with at least one visit confirmed in the window',denominator:'Patients in the cohort',exclusions:'Voided and superseded visits',owner:'Programme manager',cadence:'Monthly',sources:['patients','visits'],keywords:['seen','coverage','reached','patients seen'],compute:(c,p)=>({n:visitsOf(c,p).some(v=>v.state==='confirmed'&&inWindow(c,v.confirmedAt??v.createdAt))?1:0,d:1})},
 {id:'followups-overdue',version:1,title:'Overdue follow-ups',unit:'proportion',numerator:'Open follow-ups past their due date today',denominator:'Open follow-ups today',exclusions:'Completed and cancelled follow-ups',owner:'Supervisor',cadence:'Weekly',sources:['follow-ups'],keywords:['overdue','follow-up','follow-ups','followup','followups','late'],compute:(c,p)=>{const open=(p.followUps??[]).filter(f=>f.state==='open');return {n:open.filter(f=>f.due<c.today).length,d:open.length};}},
 {id:'referrals-completed',version:1,title:'Referrals completed',unit:'proportion',numerator:'Referrals created in the window now completed',denominator:'Referrals created in the window',exclusions:'None',owner:'Programme manager',cadence:'Monthly',sources:['referrals'],keywords:['referral','referrals','completed referrals'],compute:(c,p)=>{const r=c.s.workspace.referrals.filter(x=>x.personId===p.id&&inWindow(c,x.createdAt));return {n:r.filter(x=>x.state==='completed').length,d:r.length};}},
 {id:'maternal-episodes',version:1,title:'Active maternal episodes',unit:'count',numerator:'Maternal episodes active today',exclusions:'Closed episodes',owner:'Maternal programme lead',cadence:'Monthly',sources:['enrolments'],keywords:['maternal','pregnancy','pregnant','anc','antenatal'],compute:(_c,p)=>({n:(p.enrolments??[]).filter(e=>e.packId==='maternal'&&e.state==='active').length})},
 {id:'open-work-unowned',version:1,title:'Open work without an active owner',unit:'count',numerator:'Open items whose owner is not an active member',exclusions:'None',owner:'Supervisor',cadence:'Weekly',sources:['follow-ups','referrals','outreach'],keywords:['unowned','orphaned','owner','responsibility','gap','gaps'],compute:(c,p)=>{const active=new Set(c.s.members.filter(m=>m.status==='active').map(m=>m.userId));return {n:openPatientWork(c.s,p).filter(w=>!w.ownerId||!active.has(w.ownerId)).length};}},
 {id:'submissions-unresolved',version:1,title:'Unresolved programme submissions',unit:'count',numerator:'Submissions queued, sending, retryable or uncertain today',exclusions:'Accepted, rejected and cancelled',owner:'Data manager',cadence:'Daily',sources:['submissions'],keywords:['submission','submissions','unresolved','uncertain','programme record','mis'],compute:(c,p)=>({n:c.s.workspace.submissions.filter(x=>x.personId===p.id&&['queued','sending','retryable','uncertain'].includes(x.state)).length})},
 {id:'identity-provisional',version:1,title:'Provisional identities',unit:'count',numerator:'Patients whose identity review is provisional today',exclusions:'Merged records',owner:'Identity steward',cadence:'Weekly',sources:['patients'],keywords:['identity','provisional','duplicate','unverified'],compute:(_c,p)=>({n:p.identityReview?.state==='provisional'&&!p.mergedInto?1:0})},
];
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
export function indicatorQuery(s:OrgState,m:Member,q:{ids:string[];days:number;group:Group;team?:string|null;village?:string|null;programme?:string|null},now=new Date()){
 manager(m);
 if(!q.ids.length||q.ids.length>8||q.ids.some(id=>!INDICATORS.some(d=>d.id===id)))fail(422,'Choose up to eight catalogue indicators.');
 if(!GROUPS.includes(q.group))fail(422,'Choose a grouping from the catalogue.');if(!Number.isInteger(q.days)||q.days<1||q.days>366)fail(422,'Choose a window of 1 to 366 days.');
 if(q.team&&!m.teamIds.includes(q.team))fail(403,'Choose one of your teams.');
 const today=now.toISOString().slice(0,10),ctx0={since:new Date(Date.parse(today+'T00:00:00Z')-(q.days-1)*86400000).toISOString(),until:now.toISOString(),today};
 const people=s.workspace.people.filter(p=>p.assigned&&!p.mergedInto&&(!q.team||p.teamId===q.team)&&(!q.village||p.village===q.village)&&(!q.programme||p.programmes.includes(q.programme as any)));
 // Filter-composition protection: a cohort smaller than the minimum cell is refused outright.
 if(people.length<MIN_CELL)fail(422,`This cohort has fewer than ${MIN_CELL} people. Widen the filters.`);
 const ctx:Ctx={s,people,...ctx0};
 const latest=[...s.workspace.visits.filter(v=>people.some(p=>p.id===v.personId)).map(v=>v.confirmedAt??v.createdAt),...s.workspace.submissions.filter(x=>people.some(p=>p.id===x.personId)).map(x=>x.updatedAt)].sort().at(-1)??null;
 const results=q.ids.map(id=>{const def=INDICATORS.find(d=>d.id===id)!;const groups=new Map<string,{n:number;d:number}>();
  for(const p of people){const v=def.compute(ctx,p);for(const k of keysFor(s,p,q.group)){const g=groups.get(k)??{n:0,d:0};g.n+=v.n;g.d+=v.d??0;groups.set(k,g);}}
  const rows=[...groups.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([group,g])=>({group,n:g.n,d:def.unit==='proportion'?g.d:undefined}));
  return {id:def.id,version:def.version,title:def.title,unit:def.unit,numerator:def.numerator,denominator:def.denominator??null,rows:suppress(rows,def.unit)};});
 return {computedAt:ctx0.until,window:{since:ctx0.since,until:ctx0.until,days:q.days},cohort:{people:people.length,team:q.team??null,village:q.village??null,programme:q.programme??null},group:q.group,latestSourceRecord:latest,minimumCell:MIN_CELL,results,
  scope:'Current authorised teams and current assignments; merged records excluded. Counts from 1 to 4 and proportions built on them are suppressed, with one further cell suppressed where a total would reveal it.'};
}
export function catalogue(){return INDICATORS.map(({compute,keywords,...d})=>d);}
// Governed question interpreter: maps words to catalogue entries and never runs anything itself.
export function interpret(question:string){
 const t=question.toLowerCase().replace(/[^a-z0-9\s-]/g,' ');const words=new Set(t.split(/\s+/).filter(Boolean));
 const ids=INDICATORS.filter(d=>d.keywords.some(k=>k.includes(' ')?t.includes(k):words.has(k))).map(d=>d.id).slice(0,8);
 const group:Group=/\bby (team|teams)\b/.test(t)?'team':/\bby (village|villages|locality)\b/.test(t)?'village':/\bby (programme|programmes|program)\b/.test(t)?'programme':/\bby age\b/.test(t)?'age-band':'none';
 const m=t.match(/\blast (\d{1,3}) days?\b/);const days=m?Math.min(366,Math.max(1,Number(m[1]))):/\blast week\b|\bthis week\b/.test(t)?7:/\blast month\b|\bthis month\b/.test(t)?30:/\blast year\b|\bthis year\b/.test(t)?365:30;
 return {ids,group,days,understood:ids.length>0,note:ids.length?'Review this interpretation before running it. Only catalogue indicators can be answered.':'No catalogue indicator matches. Choose one from the list.'};
}
