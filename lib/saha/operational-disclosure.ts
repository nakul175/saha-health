import type {D1Database} from '@cloudflare/workers-types';
import type {Member,OrgState,Person} from './types';
import {careReport,type ReleasedCareReport} from './operations';
import {MIN_CELL} from './indicators';
import {disclosureProfile,disclosureRisk,ledgerHash,readLedger,writeLedger,untrackedDisclosureHistory,type DisclosureProfile} from './indicator-ledger';
import {ledgerFull,pruneLedger} from './indicator-differencing';
import {fail} from './core';
type Report=ReturnType<typeof careReport>;
const scalar=(r:Report):Record<string,number>=>({patients:r.patients,visitsStarted:r.visitsStarted,visitsConfirmed:r.visitsConfirmed,...Object.fromEntries(Object.entries(r.backlog).map(([k,v])=>['backlog:'+k,v])),...Object.fromEntries(Object.entries(r.usage).filter(([,v])=>typeof v==='number').map(([k,v])=>['usage:'+k,v as number])),...Object.fromEntries(r.daily.map(d=>['daily:'+d.date,d.confirmed])),...Object.fromEntries(r.programmes.flatMap(p=>['activeEpisodes','openTasks','overdueTasks'].map(k=>['programme:'+p.programme+':'+k,p[k as 'activeEpisodes']]))),...Object.fromEntries(r.destinations.flatMap(d=>['accepted','pending','rejected'].map(k=>['destination:'+d.id+':'+k,d[k as 'accepted']])))});
// Contributor counts are not a clinical denominator. A hundred events belonging to one person
// remain a one-person contribution. Full projection withholding also prevents complementary
// details/control totals/derived alerts from recovering one withheld component.
export async function operationalProfiles(s:OrgState,m:Member,raw:Report,include:(p:Person)=>boolean,at:string){
 const people=s.workspace.people.filter(include),h=ledgerHash(s.organisation.id);
 // Partition once before per-person contribution calculation. Repeatedly scanning the whole
 // organisation for each person would turn a bounded disclosure into quadratic capture work.
 const byPerson=<T extends {personId:string}>(rows:T[])=>{const out=new Map<string,T[]>();for(const row of rows){const group=out.get(row.personId)??[];group.push(row);out.set(row.personId,group);}return out;},visits=byPerson(s.workspace.visits),submissions=byPerson(s.workspace.submissions),referrals=byPerson(s.workspace.referrals);
 const single=people.map(p=>scalar(careReport({...s,workspace:{...s.workspace,people:[p],visits:visits.get(p.id)??[],submissions:submissions.get(p.id)??[],referrals:referrals.get(p.id)??[],audit:[]}},m,raw.days,new Date(at),()=>true))),ids=await Promise.all(people.map(p=>h('live-disclosure-person:v1:'+p.id))),profiles:DisclosureProfile[]=[];let small=people.length<MIN_CELL;
 for(const [key,total] of Object.entries(scalar(raw))){if(!Number.isFinite(total)||total<0)fail(503,'Operational contribution evidence is unavailable. Nothing was released.');const values=single.map(r=>r[key]??0),sum=values.reduce((a,b)=>a+b,0);if(Math.abs(sum-total)>1e-8)fail(503,'Operational contribution evidence does not reconcile. Nothing was released.');const positive=values.filter(n=>n>0).length;if(positive>0&&positive<MIN_CELL)small=true;profiles.push(await disclosureProfile(s.organisation.id,`operational:v1:${key}:${key.startsWith('daily:')?'day':raw.since}`,Object.fromEntries(ids.map((id,i)=>[id,[values[i],0] as [number,number]])),at));}
 return {profiles,small};
}
export function projectOperational(raw:Report,withheld:boolean,reason:string):ReleasedCareReport{
 const r=structuredClone(raw) as ReleasedCareReport;r.activeWorkers=null;r.activeWorkersCoverage='Withheld: distinct actor contributions are not certified by the patient aggregation profile.';
 if(withheld){r.patients=null;r.visitsStarted=null;r.visitsConfirmed=null;for(const k of Object.keys(r.backlog))r.backlog[k as keyof typeof r.backlog]=null;for(const k of Object.keys(r.usage))if(typeof r.usage[k as keyof typeof r.usage]==='number')Object.assign(r.usage,{[k]:null});r.programmes=[];r.destinations=[];r.daily=r.daily.map(d=>({...d,confirmed:null}));}
 r.privacy={withheld,reason,minimumCell:MIN_CELL,activeWorkers:r.activeWorkersCoverage};return r;
}
export async function releaseOperational(db:D1Database,s:OrgState,m:Member,raw:Report,include:(p:Person)=>boolean,at:string){
 const {profiles,small}=await operationalProfiles(s,m,raw,include,at);if(small)return projectOperational(raw,true,'Withheld to protect a group or contributing group smaller than five.');
 for(let attempt=0;attempt<3;attempt++){const {ledger,text}=await readLedger(db,s.organisation.id);let risky:boolean;try{risky=await untrackedDisclosureHistory(ledger,at,s.organisation.id);const working=[...ledger];for(const p of profiles){if(disclosureRisk(working,p,MIN_CELL,at)){risky=true;break;}working.push(p);}}catch{fail(503,'Disclosure protection history is uncertain. Nothing was released.');}if(risky)return projectOperational(raw,true,'Withheld because recent aggregate disclosures may reveal a small group; legacy history without exact contribution evidence is also withheld.');const adding=[...profiles];if(ledgerFull(ledger,adding,at))return projectOperational(raw,true,'Withheld because protected disclosure history reached its capacity. Older protecting evidence is retained.');try{if(await writeLedger(db,s.organisation.id,text,pruneLedger([...ledger,...adding],at)))return projectOperational(raw,false,'Protected live aggregate projection; distinct active-worker count is withheld.');}catch{fail(503,'Disclosure protection history could not be committed. Nothing was released.');}}
 fail(409,'Concurrent aggregate disclosures changed. Nothing was released. Refresh the report.');
}
