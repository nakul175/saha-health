'use client';
import { useCallback, useEffect, useState } from 'react';
import { ChevronRight, Loader2, Search, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PROGRAMMES } from '@/lib/saha/types';
import type { PatientPage, PatientRow } from '@/lib/saha/patient-directory';

// Slice 0b-3: server-paged patient directory for large team scopes. The server applies the viewer's
// scope and search; opening a row loads that patient's detail into the workspace. Slice 6q: search text and the
// opaque cursor travel in a POST body, never in the request URL.
export function PatientDirectory({organisationId,total,open}:{organisationId:string;total:number;open:(personId:string)=>void}){
 const [q,setQ]=useState(''),[programme,setProgramme]=useState('All programmes'),[rows,setRows]=useState<PatientRow[]>([]),[cursor,setCursor]=useState<string|null>(null),[count,setCount]=useState<number|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const load=useCallback(async(after:string|null,query:string,prog:string)=>{setLoading(true);try{const r=await fetch('/api/patients',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json','x-saha-organisation':organisationId},body:JSON.stringify({q:query.trim(),programme:prog==='All programmes'?'':prog,cursor:after})}),j:PatientPage&{error?:string}=await r.json();if(!r.ok)throw Error(j.error);setRows(prev=>after?[...prev,...j.rows]:j.rows);setCursor(j.nextCursor);if(!after)setCount(j.total);setError('');}catch(e){setError(e instanceof Error?e.message:'Could not load patients.');}finally{setLoading(false);}},[organisationId]);
 useEffect(()=>{const t=setTimeout(()=>{void load(null,q,programme);},q?300:0);return()=>clearTimeout(t);},[q,programme,load]);
 return <section className="panel worklist" aria-label="Patient directory">
  <div className="section-heading"><h2>Patient records <span className="number-badge">{count??'…'}</span></h2><span className="muted text-sm">{total.toLocaleString('en-IN')} in your care scope · loaded page by page</span></div>
  <div className="list-tools"><div className="search-field"><Search size={17}/><Input aria-label="Search people" placeholder="Search name, village or record id" value={q} onChange={e=>setQ(e.target.value)} maxLength={80}/></div><Select value={programme} onValueChange={setProgramme}><SelectTrigger aria-label="Filter programme"><SelectValue/></SelectTrigger><SelectContent>{['All programmes',...PROGRAMMES].map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>
  {error&&<div className="notice amber-notice" role="alert">{error}</div>}
  <div className="patient-list">{rows.map(p=><button className="patient-row" key={p.id} onClick={()=>open(p.id)}><div className="patient-row-name"><strong>{p.name}</strong><span>{p.age??'—'} years · {p.village}{p.merged?' · merged record':''}{p.exceptional?' · emergency access':''}</span></div><div className="patient-row-task"><span>{p.task}</span></div><div className="patient-row-status"><span className="tag neutral">{p.status==='completed'?'Confirmed':p.status==='in_progress'?'In progress':p.due}</span><ChevronRight size={18}/></div></button>)}
   {!rows.length&&!loading&&!error&&<p className="muted">No matching people. Try a different name, village or programme.</p>}</div>
  <div className="list-foot">{cursor&&<Button variant="outline" disabled={loading} onClick={()=>load(cursor,q,programme)}>{loading&&<Loader2 className="spin" size={16}/>}Load more</Button>}{loading&&!cursor&&<Loader2 className="spin" size={16}/>}<ShieldCheck size={15}/>Scope and search are applied on the server. Records open one at a time.</div>
 </section>;
}
