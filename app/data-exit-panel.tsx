'use client';
import { useState } from 'react';
import { PackageOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import type { Snapshot } from '@/lib/saha/types';
// Slice 6m: an owner downloads the organisation's data export (tar archive with manifest and checksums).
export function DataExitPanel({data}:{data:Snapshot}){
 const [fhir,setFhir]=useState(false),[busy,setBusy]=useState(false),[done,setDone]=useState<{id:string;sha:string;manifest:string}|null>(null),[plan,setPlan]=useState<{basis:string;people:number;size:number;total:number}|null>(null),[error,setError]=useState('');
 if(!data.canManage)return null;
 const request=async(query:URLSearchParams)=>{setBusy(true);try{const r=await fetch(`/api/data-exit?${query}`,{headers:{'x-saha-organisation':data.organisation.id},cache:'no-store'});if(!r.ok)throw Error(((await r.json()) as any).error);const url=URL.createObjectURL(await r.blob()),a=document.createElement('a');a.href=url;a.download=/filename="([^"]+)"/.exec(r.headers.get('content-disposition')??'')?.[1]??'saha-organisation-export.tar';a.click();URL.revokeObjectURL(url);setDone({id:r.headers.get('x-saha-export-id')??'',sha:r.headers.get('x-saha-content-sha256')??'',manifest:r.headers.get('x-saha-manifest-sha256')??''});setError('');}catch(e){setError(e instanceof Error?e.message:'Could not export the organisation.');}finally{setBusy(false);}};
 const scoped=()=>request(new URLSearchParams({fhir:fhir?'1':'0'}));
 const full=()=>request(new URLSearchParams({fhir:fhir?'1':'0',full:'1'}));
 const prepare=async()=>{setBusy(true);try{const r=await fetch('/api/data-exit?plan=1&stageSize=1000',{headers:{'x-saha-organisation':data.organisation.id},cache:'no-store'}),body=await r.json() as any;if(!r.ok)throw Error(body.error);setPlan(body);setError('');}catch(e){setError(e instanceof Error?e.message:'Could not prepare a staged exit.');}finally{setBusy(false);}};
 const part=(number:number)=>plan&&request(new URLSearchParams({fhir:fhir?'1':'0',stage:String(number),stageSize:String(plan.size),basis:plan.basis}));
 return <section className="panel member-panel" aria-labelledby="data-exit-heading"><div className="section-heading"><h2 id="data-exit-heading"><PackageOpen size={19}/> Data export for exit or transfer</h2><span className="muted text-sm">Owners only</span></div>
  <div className="grid gap-3 px-6 pb-5"><p className="muted">Downloads stored records as a documented tar archive with checksums, audit evidence, media, provider queue disposition, named open-care handovers and a value-free field dictionary covering units and provenance. Patient records never exceed your current normal care scope. A full or staged exit refuses unless that existing scope covers every person; it does not widen owner access. Credentials, invitation codes and sign-in emails are left out. Every downloaded part is recorded in the audit chain.</p>
  <label className="flex items-center gap-2"><Checkbox checked={fhir} onCheckedChange={v=>setFhir(v===true)} aria-describedby="data-exit-fhir-help"/><span>Include a FHIR document for each confirmed visit</span></label><p id="data-exit-fhir-help" className="muted text-sm">Structural FHIR R4 documents; not profile-validated.</p>
  <div className="flex flex-wrap gap-3"><Button variant="outline" disabled={busy} onClick={scoped}>{busy?'Preparing…':'Download authorised scope'}</Button><Button variant="outline" disabled={busy} onClick={full}>Download full exit</Button><Button variant="outline" disabled={busy} onClick={prepare}>Prepare staged exit</Button></div>
  {plan&&<div className="notice" role="status"><div>Staged plan: {plan.people} people in {plan.total} part{plan.total===1?'':'s'}, bound to source {plan.basis.slice(0,16)}…. Download every part before data changes.<div className="flex flex-wrap gap-2 mt-2">{Array.from({length:plan.total},(_,i)=><Button key={i} size="sm" variant="outline" disabled={busy} onClick={()=>part(i+1)}>Download part {i+1}/{plan.total}</Button>)}</div></div></div>}
  {done&&<div role="status" className="notice"><div>Export {done.id.slice(0,8)} downloaded · archive SHA-256 {done.sha.slice(0,16)}… · manifest SHA-256 {done.manifest.slice(0,16)}…<br/>Check it offline with <code>node scripts/verify-export.mjs</code>, or extract it and run <code>sha256sum -c SHA256SUMS</code>.</div></div>}
  {error&&<p className="notice amber-notice" role="alert">{error}</p>}</div>
 </section>;
}
