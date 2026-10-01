import { identity, loadFor, json, db } from './server';
import { AppError, digest, fail, uuid } from './core';
import { boundedJsonBody } from './request-body';
import { persist, scope } from './store';
import { csvLines, defaultOperations } from './operations';
import { sameCareScope } from './export-audit';
import { catalogue, GROUPS, indicatorRun, interpret, manager, MIN_CELL, registryRecords, vocabulary, type Group } from './indicators';
import { differencingRisk, pruneLedger, type Release } from './indicator-differencing';
// Slice 6d: catalogue, governed interpretation of a question, and scoped indicator queries.
export async function indicatorsRead(request:Request){return indicatorsFor(request,new URL(request.url).searchParams);}
// Slice 6l: the workspace posts questions and filters in a JSON body, so free text and village
// names stay out of request URLs (and so out of platform request logs). GET remains for compatibility.
export async function indicatorsPost(request:Request){
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)fail(403,'Cross-origin requests are not allowed.');
 if(!request.headers.get('content-type')?.startsWith('application/json'))fail(415,'Use JSON for this request.');
 const body=await boundedJsonBody(request,4000);if(!body||typeof body!=='object'||Array.isArray(body))fail(422,'Send the indicator request as an object.');
 const p=new URLSearchParams();for(const [k,v] of Object.entries(body as Record<string,unknown>)){if(typeof v==='string'||typeof v==='number')p.set(k,String(v));else if(v!==null)fail(422,'Indicator fields must be text or numbers.');}
 return indicatorsFor(request,p);
}
const RELEASE_ATTEMPTS=3;
export const DIFFERENCING_MESSAGE='Together with your indicator queries of the last seven days, this result would reveal a group of fewer than 5 people. Use the same filters as before or widen them.';
async function indicatorsFor(request:Request,p:URLSearchParams){
 const u=await identity();
 const s=await loadFor(u,request.headers.get('x-saha-organisation'),undefined,true),m=scope(s,u.userId);manager(m);
 const question=p.get('question');
 if(question!==null){if(question.length>300)fail(422,'Keep the question under 300 characters.');return json({interpretation:interpret(question,s)});}
 const ids=(p.get('ids')??'').split(',').map(x=>x.trim()).filter(Boolean);
 // Slice 6s: the catalogue read also carries every recorded version and the definition vocabulary.
 if(!ids.length)return json({catalogue:catalogue(s),registry:registryRecords(s).map(r=>({id:r.id,version:r.version,status:r.status,title:r.spec.title,spec:r.spec,reason:r.reason,by:r.byName,at:r.at,builtIn:!!r.builtIn})),vocabulary:vocabulary(),canMaintain:m.isOwner,groups:GROUPS,minimumCell:MIN_CELL,teams:s.teams.filter(t=>m.teamIds.includes(t.id)).map(t=>({id:t.id,name:t.name})),villages:[...new Set(s.workspace.people.filter(x=>x.assigned).map(x=>x.village))].sort(),programmes:[...new Set(s.workspace.people.filter(x=>x.assigned).flatMap(x=>x.programmes))].sort()});
 const text=(k:string)=>{const v=p.get(k);if(v&&v.length>200)fail(422,'Filter value too long.');return v||null;};
 const q={ids,days:Number(p.get('days')??30),group:(p.get('group')??'none') as Group,team:text('team'),village:text('village'),programme:text('programme')};
 const {result,series}=indicatorRun(s,m,q);
 const released=await recordRelease(u,s.organisation.id,m,q,series,result.computedAt);
 // Results whose series would allow differencing are withheld whole; nothing of them is returned.
 const out={...result,results:result.results.map(r=>'refused' in r||released.has(r.id+'@'+r.version)?r:{...r,rows:[],refused:'differencing' as const,message:DIFFERENCING_MESSAGE}),differencing:{windowHours:168,note:'Results that would reveal a group of fewer than 5 people when combined with your recent queries are withheld.'}};
 if(p.get('format')==='csv')return indicatorCsv(out);
 return json(out);
}
// Slice 6s: record what this viewer was given (hashed filters and per-cell people counts only) and refuse
// anything that, nested with the viewer's recent releases, would reveal a remainder of 1 to 4 people.
// The release is committed through persist on a fresh full read, with the viewer's authority and care
// scope checked again on that read; a concurrent commit is retried on a new read, as exports are (slice 6p).
async function recordRelease(u:{userId:string;displayName:string;email:string},orgId:string,first:{teamIds:string[]},q:{team:string|null;village:string|null;programme:string|null},series:{key:string;cells:Record<string,number>;ids:string[]}[],at:string){
 const h=async(x:string)=>(await digest(`saha-indicator-release:${orgId}:${x}`)).slice(0,20);
 const f:Record<string,string>={};for(const k of ['team','village','programme'] as const)if(q[k])f[k]=await h(`${k}:${q[k]}`);
 const viewer=await h(`viewer:${u.userId}`);
 const cands=await Promise.all(series.map(async sr=>({ids:sr.ids,isCohort:sr.key==='cohort',release:{v:viewer,at,k:await h(`series:${sr.key}`),f,c:Object.fromEntries(await Promise.all(Object.entries(sr.cells).map(async([g,n])=>[await h(`group:${g}`),n] as const)))} as Release})));
 for(let attempt=1;;attempt++){
  const full=await loadFor(u,orgId),m=scope(full,u.userId);manager(m);sameCareScope(first,m);
  const ledger=((full.operations as any)?.indicatorReleases??[]) as Release[];
  const cohort=cands.find(c=>c.isCohort)!;
  if(differencingRisk(ledger,cohort.release,MIN_CELL,at)!==null)fail(422,DIFFERENCING_MESSAGE);
  const ok=cands.filter(c=>c.isCohort||differencingRisk(ledger,c.release,MIN_CELL,at)===null);
  const before=structuredClone(full),ops=full.operations??=defaultOperations();
  (ops as any).indicatorReleases=pruneLedger([...ledger,...ok.map(c=>c.release)],at);
  try{await persist(db(),before,full,u,{type:'indicatorRelease'},`indicator-release-${uuid()}`,await digest({at,viewer}),{ok:true});return new Set(ok.flatMap(c=>c.ids));}
  catch(e){if(!(e instanceof AppError)||e.status!==409||attempt>=RELEASE_ATTEMPTS)throw e;}
 }
}
// Slice 6s: indicator results as CSV, written from the suppressed result only. Suppressed and withheld
// cells are written as such; each block names the definition and version it used.
function indicatorCsv(r:any){
 const rows:unknown[][]=[['Saha indicator results'],['Computed at',r.computedAt],['Window days',r.window.days],['Cohort people',r.cohort.people],['Grouping',r.group],['Minimum cell',r.minimumCell],['Status','Draft export; not an official or reviewed submission']];
 for(const x of r.results){rows.push(['Indicator',x.id,'Version',x.version,x.title]);
  if(x.refused){rows.push(['Withheld',x.refused==='cohort'?'Definition cohort below its minimum':'Differencing protection']);continue;}
  rows.push(['Group',x.unit==='proportion'?'Percent':'Count','Numerator','Denominator']);
  for(const c of x.rows)rows.push(c.suppressed?[c.group,'suppressed','suppressed','suppressed']:[c.group,c.value??'',c.numerator??'',c.denominator??'']);}
 return new Response(csvLines(rows.map(row=>row.map(v=>typeof v==='string'?v.replace(/[\r\n]+/g,' '):v))),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="saha-indicators.csv"','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
