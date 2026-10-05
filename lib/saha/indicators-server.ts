import { identity, loadFor, json, db } from './server';
import { ensurePurpose } from './purpose-scope';
import { AppError, fail, uuid } from './core';
import type { Member } from './types';
import { boundedJsonBody } from './request-body';
import { scope } from './store';
import { recordAccess } from './access-audit';
import { recordAggregateView } from './read-audit';
import { csvLines } from './operations';
import { candidateReleases, ledgerHash, readLedger, writeLedger } from './indicator-ledger';
import { catalogue, definitionLifecycle, GROUPS, indicatorRun, interpret, manager, MIN_CELL, registryRecords, releasePopulation, vocabulary, type Group, type Series } from './indicators';
import { ledgerFull, pruneLedger, RESIDUAL_RISK, screenReleases, type Release } from './indicator-differencing';
import { lateSinceRelease, teamFreshness } from './indicator-freshness';
import { resolveDefinition } from './indicators';
// Slice 6d: catalogue, governed interpretation of a question, and scoped indicator queries.
// Slice 6w (fifth review, finding 4): GET reads the catalogue and interprets questions only. Running a query
// records a release in the differencing ledger, so it is POST only (a cross-site GET cannot trigger it).
export async function indicatorsRead(request:Request){await identity();const p=new URL(request.url).searchParams;if(p.get('ids'))fail(405,'Run indicator queries with POST from the workspace.');return indicatorsFor(request,p);}
// Slice 6l: the workspace posts questions and filters in a JSON body, so free text and village
// names stay out of request URLs (and so out of platform request logs). GET remains for compatibility.
export async function indicatorsPost(request:Request){
 await identity();
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)fail(403,'Cross-origin requests are not allowed.');
 if(!request.headers.get('content-type')?.startsWith('application/json'))fail(415,'Use JSON for this request.');
 const body=await boundedJsonBody(request,4000);if(!body||typeof body!=='object'||Array.isArray(body))fail(422,'Send the indicator request as an object.');
 const p=new URLSearchParams();for(const [k,v] of Object.entries(body as Record<string,unknown>)){if(typeof v==='string'||typeof v==='number')p.set(k,String(v));else if(v!==null)fail(422,'Indicator fields must be text or numbers.');}
 return indicatorsFor(request,p);
}
const RELEASE_ATTEMPTS=3;
export const REFUSAL_SUBJECT='indicator refusal',REFUSALS_PER_DAY=20;
// Slice 13f (review of 13a–13e, findings 3 and 4): only refusals that protect against differencing count (a whole refusal, a
// cohort below 5, or results withheld because they would combine with the viewer's recent queries). Results withheld because a
// definition sets its own higher minimum cohort do not count, so a strict definition cannot lock a manager out. CSV exports
// record the same marker as views.
export const REFUSAL_LIMIT_MESSAGE=`Indicator queries refused or partly withheld to protect small groups reached ${REFUSALS_PER_DAY} in the last 24 hours, so no more indicator figures can be run until the oldest of those leave that window. The catalogue stays available; ask a supervisor or owner if figures are needed sooner.`;
async function refusalLimit(orgId:string,userId:string){
 const since=new Date(Date.now()-86400000).toISOString();
 const row=await db().prepare("SELECT count(*) AS n FROM audit_events WHERE org_id=? AND actor_id=? AND action='viewAggregate' AND at>? AND subject=?").bind(orgId,userId,since,REFUSAL_SUBJECT).first<{n:number}>();
 if((row?.n??0)>=REFUSALS_PER_DAY)fail(429,REFUSAL_LIMIT_MESSAGE);
}
export const DIFFERENCING_MESSAGE='Together with your indicator queries of the last seven days, this result would reveal a group of fewer than 5 people. Use the same filters as before or widen them.';
function registryView(s:import('./types').OrgState,m:Member,viewerId:string){return {organisationId:s.organisation.id,catalogue:catalogue(s),registry:registryRecords(s).map(r=>({id:r.id,version:r.version,...definitionLifecycle(s,r),title:r.spec.title,spec:r.spec,reason:r.reason,by:r.byName,authorId:r.by,at:r.at,intendedStatus:r.intendedStatus??r.status,rollbackFrom:r.rollbackFrom??null,builtIn:!!r.builtIn})),vocabulary:vocabulary(),canMaintain:m.isOwner,canReview:['supervisor','clinician'].includes(m.role),viewerId,governanceNotice:'Synthetic software governance only. Clinical denominator and publication approval remain pending. Definition reruns use current authorised records; immutable released figures are not yet implemented.'};}
async function indicatorsFor(request:Request,p:URLSearchParams){
 const u=await identity();
 const s=await loadFor(u,request.headers.get('x-saha-organisation'),undefined,true),m=scope(s,u.userId);if(p.get('registryOnly')==='1'){if(m.status!=='active'||!(m.isOwner||['supervisor','clinician'].includes(m.role)))fail(403,'A current owner, supervisor or clinician can read definition governance.');return json(registryView(s,m,u.userId));}manager(m);
 const question=p.get('question');
 if(question!==null){if(question.length>300)fail(422,'Keep the question under 300 characters.');return json({interpretation:interpret(question,s)});}
 ensurePurpose(m,'reporting'); // slice 13a: computing and releasing indicator figures is a reporting flow
 const ids=(p.get('ids')??'').split(',').map(x=>x.trim()).filter(Boolean);
 // Slice 6s: the catalogue read also carries every recorded version and the definition vocabulary.
 if(!ids.length)return json({...registryView(s,m,u.userId),protection:RESIDUAL_RISK,groups:GROUPS,minimumCell:MIN_CELL,teams:s.teams.filter(t=>m.teamIds.includes(t.id)).map(t=>({id:t.id,name:t.name})),villages:[...new Set(s.workspace.people.filter(x=>x.assigned).map(x=>x.village))].sort(),programmes:[...new Set(s.workspace.people.filter(x=>x.assigned).flatMap(x=>x.programmes))].sort()});
 // Slice 13d (ninth review, finding 8): each refusal tells the viewer that a combination would reveal a small group, so refused
 // and partly withheld queries are recorded (below and in recordRelease) and limited per viewer per day.
 await refusalLimit(s.organisation.id,u.userId);
 const text=(k:string)=>{const v=p.get(k);if(v&&v.length>200)fail(422,'Filter value too long.');return v||null;};
 const q={ids,days:Number(p.get('days')??30),group:(p.get('group')??'none') as Group,team:text('team'),village:text('village'),programme:text('programme')};
 // A cohort below the minimum is refused by indicatorRun; that refusal also tells the viewer something (the group has 0 to 4
 // people), so it is recorded and counted toward the same limit (slice 13d).
 const filtersSet=[q.team&&'team',q.village&&'village',q.programme&&'programme'].filter(Boolean).join(', ')||'none';
 let run:ReturnType<typeof indicatorRun>;
 try{run=indicatorRun(s,m,q);}catch(e){if(e instanceof AppError&&e.status===422&&/^This cohort has fewer than/.test(e.message))await recordAggregateView(db(),s,u,m,REFUSAL_SUBJECT,`Indicator query refused: the cohort is below the minimum of 5 people. Filters set: ${filtersSet}; nothing was shown.`);throw e;}
 const {result,series}=run;
 // Results whose series would allow differencing are withheld whole; nothing of them is returned.
 const shape=(released:Set<string>)=>({...result,results:result.results.map(r=>'refused' in r||released.has(r.id+'@'+r.version)?r:{...r,rows:[],refused:'differencing' as const,message:DIFFERENCING_MESSAGE}),differencing:{windowHours:168,note:'Results that would reveal a group of fewer than 5 people when combined with your recent queries are withheld.',limits:RESIDUAL_RISK}});
 // Slice 6ac: the viewer's previous release of each figure is read before this one is recorded (read only).
 const previous=p.get('format')==='csv'?null:await previousReleases(s.organisation.id,u.userId,q,series,result.computedAt);
 const {released,file}=await recordRelease(u,s.organisation.id,m,q,series,result.computedAt,p.get('format')==='csv'?shape:null,s);
 // Slice 13f: results withheld for differencing are recorded as a refusal and counted toward the limit, on screen and in CSV.
 {const diff=shape(released).results.filter((r:any)=>r.refused==='differencing').length;if(diff)await recordAggregateView(db(),s,u,m,REFUSAL_SUBJECT,`Indicator query partly withheld${file?' (CSV export)':''}: ${diff} result${diff===1?'':'s'} withheld because, together with this viewer's queries of the last seven days, ${diff===1?'it':'they'} would reveal a group of fewer than 5 people. Filters set: ${filtersSet}.`);}
 // Slice 10h: an on-screen indicator view (not the CSV, which records indicatorExport) is an aggregate view: recorded before the results are returned. Which filters were set is recorded, not their values.
 if(!file){const shown=shape(released).results,withheld=shown.filter((r:any)=>r.refused).length,filters=[q.team&&'team',q.village&&'village',q.programme&&'programme'].filter(Boolean);await recordAggregateView(db(),s,u,m,'indicator results',`Indicator results viewed: ${shown.map((r:any)=>`${r.id} v${r.version}${r.refused?' withheld':''}`).join(', ')}; ${shown.length-withheld} released, ${withheld} withheld; grouped by ${q.group}; ${q.days}-day window; filters set: ${filters.length?filters.join(', '):'none'}. No cell values recorded.`);}
 if(previous){const shaped=shape(released),people=s.workspace.people.filter(x=>x.assigned&&!x.mergedInto&&(!q.team||x.teamId===q.team)&&(!q.village||x.village===q.village)&&(!q.programme||x.programmes.includes(q.programme as any)));
  // Slice 6ac: freshness per team and late arrivals per released result; withheld results carry nothing more. The CSV is unchanged.
  return json({...shaped,freshness:teamFreshness(s,m,q,result.window,new Date(result.computedAt)),results:shaped.results.map((r:any)=>r.refused?r:{...r,lateArrivals:lateSinceRelease(s,people,resolveDefinition(s,`${r.id}@${r.version}`),result.window.since,result.window.until,previous.get(r.id+'@'+r.version)??null)})});}
 if(file)return new Response(file.csv,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="saha-indicators.csv"','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Saha-Export-Id':file.exportId,'X-Saha-Content-SHA256':file.sha256}});
 return json(shape(released));
}
// Slice 6s: record what this viewer was given (hashed filters and per-cell counts only) and refuse
// anything that, nested with the viewer's recent releases, would reveal a remainder of 1 to 4.
// Slice 6s-2: a CSV request builds its file from the withheld-and-suppressed result and records an
// indicatorExport audit event naming the export identifier, definitions, row count and SHA-256.
// Slice 6w (fifth review, finding 4): a view is not a command. The ledger is written by its own
// compare-and-swap statement on the ledger value in the operations row: it moves neither organisation
// nor patient revision, writes no command receipt, and a concurrent release is retried on a fresh
// ledger read. Commands that write the operations row keep the stored ledger (`store.guarded`). A CSV
// export's audit event is an access-audit commit (slice 6t pattern), written before the file is returned.
// Slice 6ac: when this viewer was last given each figure (same series and filters, any window), from the ledger as it
// stands before this query is recorded. Only the release time is used; nothing is written.
async function previousReleases(orgId:string,userId:string,q:{team:string|null;village:string|null;programme:string|null},series:Series[],at:string){
 const cands=await candidateReleases(orgId,`viewer:${userId}`,q,series,at),{ledger}=await readLedger(db(),orgId),out=new Map<string,string>();
 const same=(a:Record<string,string>,b:Record<string,string>)=>JSON.stringify(Object.entries(a).sort())===JSON.stringify(Object.entries(b).sort());
 for(const c of cands){const r=c.release as any;if(!r.n)continue;const last=ledger.filter((x:any)=>x.v===r.v&&x.k===r.k&&x.n===r.n&&same(x.f??{},r.f??{})).map((x:any)=>x.at as string).sort().at(-1);if(last)for(const id of c.ids)out.set(id,last);}
 return out;
}
type Shaped={computedAt:string;results:any[]};
export const LEDGER_FULL_MESSAGE='You have run many different indicator queries in the last seven days. To keep small groups protected, Saha cannot record more until older queries leave the seven-day window. Repeat an earlier query or try again later.';
async function recordRelease(u:{userId:string;displayName:string;email:string},orgId:string,m:Member,q:{team:string|null;village:string|null;programme:string|null},series:Series[],at:string,csvOf:((released:Set<string>)=>Shaped)|null,state:Parameters<typeof recordAccess>[1]):Promise<{released:Set<string>;file:{csv:string;sha256:string;rows:number;exportId:string}|null}>{
 // Slice 7g: candidate releases and ledger storage are shared with aggregate report delivery (indicator-ledger.ts).
 const cands=await candidateReleases(orgId,`viewer:${u.userId}`,q,series,at);
 // Slice 6aa (seventh review): every measure release is also checked against the people in the viewer's scope now.
 const population=await releasePopulation(state,ledgerHash(orgId),new Date(at));
 let released=new Set<string>();
 for(let attempt=1;;attempt++){
  const {ledger,text}=await readLedger(db(),orgId);
  // The cohort is checked first; if it alone would reveal a small group, nothing is returned.
  const {accepted,refused}=screenReleases(ledger,cands,MIN_CELL,at,population);
  if(refused.some(c=>c.isCohort)){await recordAggregateView(db(),state,u,m,REFUSAL_SUBJECT,`Indicator query refused whole: together with this viewer's queries of the last seven days it would reveal a group of fewer than 5 people. Filters set: ${[q.team&&'team',q.village&&'village',q.programme&&'programme'].filter(Boolean).join(', ')||'none'}; nothing was shown.`);fail(422,DIFFERENCING_MESSAGE);}
  const withheld=new Set(refused.flatMap(c=>c.ids));released=new Set(accepted.flatMap(c=>c.ids).filter(id=>!withheld.has(id)));
  if(ledgerFull(ledger,accepted.map(c=>c.release),at))fail(429,LEDGER_FULL_MESSAGE);
  // Slice 6aa (finding 4): a write D1 refuses (for example a value over its size limit) is refused as a full ledger.
  let written=false;try{written=await writeLedger(db(),orgId,text,pruneLedger([...ledger,...accepted.map(c=>c.release)],at));}catch{fail(429,LEDGER_FULL_MESSAGE);}
  if(written)break;
  if(attempt>=RELEASE_ATTEMPTS)fail(409,'Many indicator queries are being recorded in this organisation at once. Nothing was shown. Please try again.');
 }
 if(!csvOf)return {released,file:null};
 const shaped=csvOf(released),exportId=uuid(),file={...await indicatorCsv(shaped,{exportId,by:u.displayName,role:m.role}),exportId};
 await recordAccess(db(),state,u,m,{action:'indicatorExport',subject:exportId,detail:`Indicator CSV ${exportId}: ${shaped.results.map((r:any)=>`${r.id} v${r.version}${r.refused?' withheld':''}`).join(', ')}; ${file.rows} data rows; SHA-256 ${file.sha256}. Draft export with small cells suppressed.`},at);
 return {released,file};
}
// Slice 6s: indicator results as CSV, written from the suppressed result only. Suppressed and withheld
// cells are written as such; each block names the definition and version it used.
// Slice 6s-2: the file names its export identifier and exporter and ends with the slice 6k manifest (data row
// count and SHA-256 of every line above), so a receiver checks it with head -n -2 file | sha256sum.
async function indicatorCsv(r:any,meta:{exportId:string;by:string;role:string}){
 const rows:unknown[][]=[['Saha indicator results'],['Export identifier',meta.exportId],['Generated by',meta.by,meta.role],['Computed at',r.computedAt],['Window days',r.window.days],['Cohort people',r.cohort.people],['Grouping',r.group],['Minimum cell',r.minimumCell],['Status','Draft export; not an official or reviewed submission']];
 for(const x of r.results){rows.push(['Indicator',x.id,'Version',x.version,x.title]);
  if(x.refused){rows.push(['Withheld',x.refused==='cohort'?'Definition cohort below its minimum':'Differencing protection']);continue;}
  rows.push(['Group',x.unit==='proportion'?'Percent':'Count','Numerator','Denominator']);
  for(const c of x.rows)rows.push(c.suppressed?[c.group,'suppressed','suppressed','suppressed']:[c.group,c.value??'',c.numerator??'',c.denominator??'']);}
 const flat=rows.map(row=>row.map(v=>typeof v==='string'?v.replace(/[\r\n]+/g,' '):v)),body=csvLines(flat),hash=await sha256Hex(body);
 return {csv:body+csvLines([['Manifest','Data rows',flat.length],['Manifest','Content SHA-256',hash]]),sha256:hash,rows:flat.length};
}
async function sha256Hex(text:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(b=>b.toString(16).padStart(2,'0')).join('');}
