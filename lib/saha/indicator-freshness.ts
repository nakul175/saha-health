import { ageBandOf, MEASURES, operandLeaves, type Operand } from './indicators';
import type { Member, OrgState, Person, Visit } from './types';
// Slice 6ac: source freshness and late arrivals beside indicator results (BR-REP-03). Read-only: nothing here is
// written, recorded in the differencing ledger or included in a released cell. Figures are reported only per team
// the viewer belongs to (never per village, programme or person) and every count is a band, never an exact number,
// so a team figure cannot be subtracted from a released village or programme cell to recover a small group.
export const LATE_HOURS=72;          // a record is late when it arrived more than this after the time it describes
export const SYNC_WARNING_HOURS=12;  // a field grant still unsynced this long after it was prepared raises a warning
export const SHARE_MINIMUM=20;       // a late share is stated only over at least this many records in the window
export type Source='online-visits'|'field-syncs'|'imports'|'programme-receipts';
export const SOURCES:{id:Source;label:string;arrival:string;described:string}[]=[
 {id:'online-visits',label:'Online visits',arrival:'confirmed',described:'visit date entered by the worker'},
 {id:'field-syncs',label:'Field-notebook syncs',arrival:'synced from the field notebook',described:'visit date entered offline'},
 {id:'imports',label:'Imports',arrival:'applied from an import batch',described:'enrolment start date (imported patients, identifiers and visits carry no source time)'},
 {id:'programme-receipts',label:'Programme receipts',arrival:'accepted with a receipt',described:'time the submission was queued'},
];
type Rec={arrival:string;described:string|null};
const H=3600000;
// facts.date is a local date-time without a zone ("YYYY-MM-DDTHH:mm") or a date; it is read as UTC. The 72-hour
// threshold absorbs the difference between local time and UTC.
export function describedTime(x?:string|null){if(!x)return null;const t=/^\d{4}-\d{2}-\d{2}$/.test(x)?Date.parse(x+'T00:00:00Z'):/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(x)?Date.parse(x+':00Z'):Date.parse(x);return Number.isFinite(t)?new Date(t).toISOString():null;}
export const isLate=(r:Rec)=>!!r.described&&Date.parse(r.arrival)-Date.parse(r.described)>LATE_HOURS*H;
const live=(v:Visit)=>!v.voidedAt&&!v.supersededBy;
// A visit came from the field notebook when it was synced under a field grant (slice 6ac stamps the sync time) or
// created by an offline registration (slice 3g records the sync time on the person).
export function fieldSyncTime(p:Person|undefined,v:Visit){if(v.fieldSync?.at)return v.fieldSync.at;if(v.fieldRegistrationId&&p?.fieldRegistration?.id===v.fieldRegistrationId)return p.fieldRegistration.syncedAt;return null;}
const fromField=(v:Visit)=>!!v.fieldSync||!!v.fieldRegistrationId;
// The records of each source for a set of people, with the time each arrived and the time it describes.
export function sourceRecords(s:OrgState,people:Person[]):Record<Source,Rec[]>{
 const byId=new Map(people.map(p=>[p.id,p])),visits=s.workspace.visits.filter(v=>byId.has(v.personId)&&live(v));
 const online=visits.filter(v=>!fromField(v)&&!v.imported&&v.state==='confirmed'&&v.confirmedAt).map(v=>({arrival:v.confirmedAt!,described:describedTime(v.facts?.date)}));
 const field=visits.filter(fromField).map(v=>{const at=fieldSyncTime(byId.get(v.personId),v);return at?{arrival:at,described:describedTime(v.facts?.date)??describedTime(byId.get(v.personId)?.fieldRegistration?.capturedAt)}:null;}).filter((x):x is Rec=>!!x);
 const imports:Rec[]=people.flatMap(p=>[...(p.imported?[{arrival:p.imported.at,described:null}]:[]),...(p.enrolments??[]).filter(e=>e.imported).map(e=>({arrival:e.imported!.at,described:describedTime(e.startDate)})),...(p.identifiers??[]).filter(i=>i.imported).map(i=>({arrival:i.recordedAt,described:null})),...visits.filter(v=>v.personId===p.id&&v.imported).map(v=>({arrival:v.imported!.at,described:null}))]);
 const receipts=s.workspace.submissions.filter(x=>byId.has(x.personId)&&x.state==='accepted'&&x.receipt).map(x=>({arrival:x.updatedAt,described:x.createdAt}));
 return {'online-visits':online,'field-syncs':field,imports,'programme-receipts':receipts};
}
// Counts are bands. "fewer than 5" covers 0 to 4 so that neither zero nor a small count can be told apart.
export function band(n:number){return n<5?'fewer than 5':n<20?'5–19':n<100?'20–99':'100 or more';}
const small=(n:number)=>n>0&&n<5;
// The late share is stated to the nearest 10 percentage points, and only when at least SHARE_MINIMUM records with a
// described time arrived in the window and neither the late nor the on-time records number 1 to 4.
export function lateShare(late:number,assessable:number){if(assessable<SHARE_MINIMUM||small(late)||small(assessable-late))return null;return Math.round(late/assessable*10)*10;}
const hour=(t:string|null)=>t?new Date(Math.floor(Date.parse(t)/H)*H).toISOString():null;
export function freshnessOf(recs:Record<Source,Rec[]>,since:string,until:string){
 return SOURCES.map(src=>{const all=recs[src.id],inWin=all.filter(r=>r.arrival>=since&&r.arrival<=until),assessable=inWin.filter(r=>!!r.described),late=assessable.filter(isLate).length;
  const share=lateShare(late,assessable.length);
  return {source:src.id,label:src.label,arrival:src.arrival,described:src.described,latestAt:hour(all.map(r=>r.arrival).sort().at(-1)??null),arrivals:band(inWin.length),late:band(late),lateShare:share,lateShareNote:share===null?`Not stated: fewer than ${SHARE_MINIMUM} records with a stated time, or 1 to 4 late or on-time records.`:null};});
}
// Field grants prepared more than SYNC_WARNING_HOURS ago that are still neither synced nor revoked.
export function unsyncedGrants(people:Person[],now:Date){const cut=new Date(now.getTime()-SYNC_WARNING_HOURS*H).toISOString();return people.reduce((a,p)=>a+(p.fieldLeases??[]).filter(l=>l.status==='active'&&l.createdAt<=cut).length,0);}
// Team-level freshness for the teams the viewer belongs to (or the one team the query names). Village and programme
// filters are deliberately ignored, so these figures do not change with them.
export function teamFreshness(s:OrgState,m:Member,q:{team?:string|null},window:{since:string;until:string},now=new Date()){
 const teams=s.teams.filter(t=>m.teamIds.includes(t.id)&&(!q.team||t.id===q.team));
 return {thresholdHours:LATE_HOURS,syncWarningHours:SYNC_WARNING_HOURS,shareMinimum:SHARE_MINIMUM,
  note:`Per team you belong to; village and programme filters are not applied. A record is late when it arrived more than ${LATE_HOURS} hours after the time it describes. Counts are shown in bands and the late share to the nearest 10 percentage points; none of these figures are part of a released result.`,
  teams:teams.map(t=>{const people=s.workspace.people.filter(p=>p.teamId===t.id&&p.assigned&&!p.mergedInto),unsynced=unsyncedGrants(people,now);
   return {team:t.name,sources:freshnessOf(sourceRecords(s,people),window.since,window.until),
    syncing:unsynced>0?{grants:band(unsynced),message:`Data still syncing: field work prepared more than ${SYNC_WARNING_HOURS} hours ago has not synced (${band(unsynced)} field grants). Results for this team may rise when it arrives.`}:null};})};
}
// Visit-based measures are the ones a late visit can change; a referral is created from a visit.
const lateSensitive=(o:Operand)=>operandLeaves(o).some(id=>MEASURES.find(x=>x.id===id)!.sources.some(x=>x==='visits'||x==='referrals'));
type DefLike={spec:{numerator:Operand;denominator:Operand|null;filters:{programme?:string;ageBand?:string;sex?:string};exclude:string[]}};
// For one released result: how many late visits arrived after the viewer's previous release of the same figure and now
// count towards its numerator or denominator (inside the current window and the definition's cohort). Banded.
export function lateSinceRelease(s:OrgState,people:Person[],def:DefLike,since:string,until:string,lastRelease:string|null){
 const sp=def.spec;if(!lateSensitive(sp.numerator)&&!(sp.denominator&&lateSensitive(sp.denominator)))return {applicable:false as const,note:'This indicator has no visit-based source, so late arrivals do not change it.'};
 if(!lastRelease)return {applicable:true as const,since:null,count:null,note:'No earlier release of this figure to you in the last seven days.'};
 const f=sp.filters,cohort=new Map(people.filter(p=>(!f.programme||p.programmes.includes(f.programme as any))&&(!f.ageBand||ageBandOf(p.age)===f.ageBand)&&(!f.sex||p.sex===f.sex)&&!(sp.exclude.includes('identity-provisional')&&p.identityReview?.state==='provisional')&&!(sp.exclude.includes('no-programme')&&!p.programmes.length)).map(p=>[p.id,p]));
 // Slice 13d (tenth review): a correction of an earlier visit (amendsVisitId) is not a late arrival: it keeps the original visit's
 // described time but was confirmed later. Its effect on released figures is reported by the correction's own task (slice 2j).
 let n=0;for(const v of s.workspace.visits){if(!cohort.has(v.personId)||!live(v)||v.state!=='confirmed'||v.amendsVisitId)continue;const arrival=v.confirmedAt??v.createdAt,rec={arrival,described:describedTime(v.facts?.date)};
  if(arrival>lastRelease&&arrival>=since&&arrival<=until&&isLate(rec))n++;}
 return {applicable:true as const,since:hour(lastRelease),count:band(n),note:`Late visits confirmed since your previous release of this figure (${band(n)}), counted in this result's window and cohort.`};
}
