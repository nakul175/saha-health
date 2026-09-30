'use client';
import { useState } from 'react';
import { PackageOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import type { Snapshot } from '@/lib/saha/types';
// Slice 6m: an owner downloads the organisation's data export (tar archive with manifest and checksums).
export function DataExitPanel({data}:{data:Snapshot}){
 const [fhir,setFhir]=useState(false),[busy,setBusy]=useState(false),[done,setDone]=useState<{id:string;sha:string;manifest:string}|null>(null),[error,setError]=useState('');
 if(!data.canManage)return null;
 const download=async()=>{setBusy(true);try{const r=await fetch(`/api/data-exit?fhir=${fhir?1:0}`,{headers:{'x-saha-organisation':data.organisation.id},cache:'no-store'});if(!r.ok)throw Error(((await r.json()) as any).error);const url=URL.createObjectURL(await r.blob()),a=document.createElement('a');a.href=url;a.download=/filename="([^"]+)"/.exec(r.headers.get('content-disposition')??'')?.[1]??'saha-organisation-export.tar';a.click();URL.revokeObjectURL(url);setDone({id:r.headers.get('x-saha-export-id')??'',sha:r.headers.get('x-saha-content-sha256')??'',manifest:r.headers.get('x-saha-manifest-sha256')??''});setError('');}catch(e){setError(e instanceof Error?e.message:'Could not export the organisation.');}finally{setBusy(false);}};
 return <section className="panel member-panel" aria-labelledby="data-exit-heading"><div className="section-heading"><h2 id="data-exit-heading"><PackageOpen size={19}/> Data export for exit or transfer</h2><span className="muted text-sm">Owners only</span></div>
  <div className="grid gap-3 px-6 pb-5"><p className="muted">Downloads every stored table for this organisation as a tar archive with a manifest (row counts and SHA-256 per file), the audit chain, media, and a list of unresolved external actions and open patient tasks with their named owner. Patient records are included only for patients in your care teams; others are counted as withheld. Credentials, invitation codes and sign-in emails are left out. The download is recorded in the audit chain.</p>
  <label className="flex items-center gap-2"><Checkbox checked={fhir} onCheckedChange={v=>setFhir(v===true)} aria-describedby="data-exit-fhir-help"/><span>Include a FHIR document for each confirmed visit</span></label><p id="data-exit-fhir-help" className="muted text-sm">Structural FHIR R4 documents; not profile-validated.</p>
  <div className="flex flex-wrap gap-3"><Button variant="outline" disabled={busy} onClick={download}>{busy?'Preparing export…':'Download organisation export'}</Button></div>
  {done&&<div role="status" className="notice"><div>Export {done.id.slice(0,8)} downloaded · archive SHA-256 {done.sha.slice(0,16)}… · manifest SHA-256 {done.manifest.slice(0,16)}…<br/>Check it offline with <code>node scripts/verify-export.mjs</code>, or extract it and run <code>sha256sum -c SHA256SUMS</code>.</div></div>}
  {error&&<p className="notice amber-notice" role="alert">{error}</p>}</div>
 </section>;
}
