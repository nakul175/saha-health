'use client';
import { useState } from 'react';
import { ServerCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Snapshot } from '@/lib/saha/types';
const STATUS:Record<string,string>={ok:'OK',warning:'Warning',error:'Error'};
// Slice 6n: owners read the deployment's environment and a configuration check. Read-only; no secret values.
export function EnvironmentPanel({data}:{data:Snapshot}){
 const [report,setReport]=useState<any>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 if(!data.canManage)return null;
 const run=async()=>{setBusy(true);try{const r=await fetch('/api/environment',{headers:{'x-saha-organisation':data.organisation.id},cache:'no-store'});const j:any=await r.json();if(!r.ok)throw Error(j.error);setReport(j);setError('');}catch(e){setError(e instanceof Error?e.message:'Could not run the configuration check.');}finally{setBusy(false);}};
 return <section className="panel member-panel" aria-labelledby="environment-heading"><div className="section-heading"><h2 id="environment-heading"><ServerCog size={19}/> Environment and configuration</h2><span className="muted text-sm">Owners only · read-only</span></div>
  <div className="grid gap-3 px-6 pb-5"><p className="muted">This deployment runs as: <strong>{data.environmentLabel}</strong>. The check lists missing or unsafe settings for the deployment and this organisation's connections. It names settings and their state; it never shows secret values.</p>
  <div className="flex flex-wrap gap-3"><Button variant="outline" disabled={busy} onClick={run}>{busy?'Checking…':'Run configuration check'}</Button></div>
  {report&&<div role="status"><p className="notice"><span><strong>{report.counts.error} errors, {report.counts.warning} warnings, {report.counts.ok} OK.</strong> Live services: {report.live.allowed?'allowed':'refused'}. {report.live.reason}</span></p>
   <ul className="grid gap-2">{report.checks.map((c:any)=><li key={c.id} className={`notice ${c.status==='ok'?'':'amber-notice'}`}><span><strong>{STATUS[c.status]}</strong> · {c.message}</span></li>)}</ul></div>}
  {error&&<p className="notice amber-notice" role="alert">{error}</p>}</div>
 </section>;
}
