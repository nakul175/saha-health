import { identity, loadFor, json, db } from './server';
import { digest, fail, uuid } from './core';
import type { Member } from './types';
import { boundedJsonBody } from './request-body';
import { scope } from './store';
import { recordAccess } from './access-audit';
import { csvLines, defaultOperations } from './operations';
import { catalogue, GROUPS, indicatorRun, interpret, manager, MIN_CELL, registryRecords, vocabulary, type Group, type Series } from './indicators';
import { ledgerFull, pruneLedger, screenReleases, type Release } from './indicator-differencing';
// Slice 6d: catalogue, governed interpretation of a question, and scoped indicator queries.
// Slice 6w (fifth review, finding 4): GET reads the catalogue and interprets questions only. Running a query
// records a release in the differencing ledger, so it is POST only (a cross-site GET cannot trigger it).
export async function indicatorsRead(request:Request){const p=new URL(request.url).searchParams;if(p.get('ids'))fail(405,'Run indicator queries with POST from the workspace.');return indicatorsFor(request,p);}
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
 // Results whose series would allow differencing are withheld whole; nothing of them is returned.
 const shape=(released:Set<string>)=>({...result,results:result.results.map(r=>'refused' in r||released.has(r.id+'@'+r.version)?r:{...r,rows:[],refused:'differencing' as const,message:DIFFERENCING_MESSAGE}),differencing:{windowHours:168,note:'Results that would reveal a group of fewer than 5 people when combined with your recent queries are withheld.'}});
 const {released,file}=await recordRelease(u,s.organisation.id,m,q,series,result.computedAt,p.get('format')==='csv'?shape:null,s);
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
type Shaped={computedAt:string;results:any[]};
export const LEDGER_FULL_MESSAGE='You have run many different indicator queries in the last seven days. To keep small groups protected, Saha cannot record more until older queries leave the seven-day window. Repeat an earlier query or try again later.';
async function readLedger(orgId:string):Promise<{ledger:Release[];text:string|null}>{
 const r=await db().prepare("SELECT json(json_extract(data,'$.indicatorReleases')) AS l, 1 AS present FROM operations WHERE org_id=?").bind(orgId).first<{l:string|null;present:number}>();
 if(!r)return {ledger:[],text:null};
 return {ledger:r.l?JSON.parse(r.l) as Release[]:[],text:r.l??''};
}
async function writeLedger(orgId:string,previous:string|null,next:Release[]){
 const value=JSON.stringify(next);
 if(previous===null){const r=await db().prepare('INSERT INTO operations (org_id,data) VALUES (?,?) ON CONFLICT(org_id) DO NOTHING').bind(orgId,JSON.stringify({...defaultOperations(),indicatorReleases:next})).run();return r.meta.changes===1;}
 const r=await db().prepare("UPDATE operations SET data=json_set(data,'$.indicatorReleases',json(?)) WHERE org_id=? AND COALESCE(json(json_extract(data,'$.indicatorReleases')),'')=?").bind(value,orgId,previous).run();
 return r.meta.changes===1;
}
async function recordRelease(u:{userId:string;displayName:string;email:string},orgId:string,m:Member,q:{team:string|null;village:string|null;programme:string|null},series:Series[],at:string,csvOf:((released:Set<string>)=>Shaped)|null,state:Parameters<typeof recordAccess>[1]):Promise<{released:Set<string>;file:{csv:string;sha256:string;rows:number;exportId:string}|null}>{
 const h=async(x:string)=>(await digest(`saha-indicator-release:${orgId}:${x}`)).slice(0,20);
 const f:Record<string,string>={};for(const k of ['team','village','programme'] as const)if(q[k])f[k]=await h(`${k}:${q[k]}`);
 const viewer=await h(`viewer:${u.userId}`);
 const cands=await Promise.all(series.map(async sr=>{const df:Record<string,string>={...f};for(const [k,v] of Object.entries(sr.f))df[k]=await h(`${k}:${v}`);
  const hashCells=async<T,>(x:Record<string,T>)=>Object.fromEntries(await Promise.all(Object.entries(x).map(async([g,n])=>[await h(`group:${g}`),n] as const)));
  return {ids:sr.ids,isCohort:sr.key==='cohort',release:{v:viewer,at,k:await h(`series:${sr.key}`),f:df,c:await hashCells(sr.cells),...(sr.m?{m:await hashCells(sr.m)}:{})} as Release};}));
 let released=new Set<string>();
 for(let attempt=1;;attempt++){
  const {ledger,text}=await readLedger(orgId);
  // The cohort is checked first; if it alone would reveal a small group, nothing is returned.
  const {accepted,refused}=screenReleases(ledger,cands,MIN_CELL,at);
  if(refused.some(c=>c.isCohort))fail(422,DIFFERENCING_MESSAGE);
  const withheld=new Set(refused.flatMap(c=>c.ids));released=new Set(accepted.flatMap(c=>c.ids).filter(id=>!withheld.has(id)));
  if(ledgerFull(ledger,accepted.map(c=>c.release),at))fail(429,LEDGER_FULL_MESSAGE);
  if(await writeLedger(orgId,text,pruneLedger([...ledger,...accepted.map(c=>c.release)],at)))break;
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
