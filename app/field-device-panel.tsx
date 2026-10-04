'use client';
import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from '@/components/ui/table';
import type { Snapshot } from '@/lib/saha/types';
// Slice 14e (R73): field notebook copies awaiting or confirmed removal, and the sync failures notebooks reported.
// Read-only; supervisors see their teams' workers and their care scope, operations members the whole organisation.
const REASON:Record<string,string>={'grant-revoked':'grant revoked','access-ended':'access ended','record-merged':'record merged','processing-restricted':'processing restricted'};
const STEP:Record<string,string>={workspace:'loading the workspace',registration:'registration',draft:'visit draft',media:'photo or voice note'};
const when=(s?:string|null)=>s?new Date(s).toLocaleString():'—';
export function FieldDevicePanel({data}:{data:Snapshot}){
 const [view,setView]=useState<any>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 const load=useCallback(async()=>{setLoading(true);try{const r=await fetch('/api/field-device?view=operations',{cache:'no-store',headers:{'x-saha-organisation':data.organisation.id}});const j:any=await r.json();if(r.status===403){setView(null);setError('');return;}if(!r.ok)throw Error(j.error??'Field device view unavailable.');setView(j);setError('');}catch(e){setError(e instanceof Error?e.message:'Field device view unavailable.');}finally{setLoading(false);}},[data.organisation.id]);
 useEffect(()=>{void load();},[load,data.organisation.revision]);
 if(!view&&!error)return null;
 const removals=view?.removals.items??[],failures=view?.syncFailures.items??[];
 return <section className="panel ops-panel" aria-labelledby="field-device-title"><div className="section-heading"><h2 id="field-device-title"><Smartphone size={19}/>Field devices</h2><Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw size={15}/>Refresh</Button></div>
  {error&&<p role="alert" className="notice amber-notice">{error}</p>}
  {view&&<><p className="muted text-sm">{view.scope}</p><p className="notice" role="note">{view.limits}</p>
   <h3>Device copies to remove <span className="tag">{view.removals.pending} pending</span> <span className="tag">{view.removals.confirmed} confirmed</span></h3>
   {removals.length?<Table><TableHeader><TableRow><TableHead>Copy</TableHead><TableHead>Worker</TableHead><TableHead>Patient</TableHead><TableHead>Why</TableHead><TableHead>Due since</TableHead><TableHead>State</TableHead><TableHead>Receipt</TableHead></TableRow></TableHeader><TableBody>{removals.map((r:any)=><TableRow key={r.id}>
    <TableCell>{r.copy==='grant'?`Grant ${r.grant}`:'Registration copy'}</TableCell><TableCell>{r.worker}</TableCell><TableCell>{r.patient?r.patient.name:'Outside your care scope'}</TableCell><TableCell>{REASON[r.reason]??r.reason}</TableCell><TableCell>{when(r.since)}</TableCell>
    <TableCell><span className={`tag ${r.state==='pending'?'amber':''}`}>{r.state==='pending'?'awaiting the device':'removed'}</span></TableCell>
    <TableCell>{r.receipt?<>{when(r.confirmedAt??r.receipt.at)}{'drafts' in r.receipt&&<> · {r.receipt.drafts} draft{r.receipt.drafts===1?'':'s'}{r.receipt.unsynced?<strong> ({r.receipt.unsynced} not synced, discarded)</strong>:''}, {r.receipt.media} media, {r.receipt.registrations} registration{r.receipt.registrations===1?'':'s'} · notebook {r.receipt.appVersion}</>}</>:'—'}</TableCell></TableRow>)}</TableBody></Table>:<p className="muted">No device copies awaiting removal or removed in the last {view.syncFailures.windowDays} days.</p>}
   {view.removals.truncated&&<p className="muted text-sm">Showing the first {removals.length}.</p>}
   <h3>Sync failures reported by notebooks <span className="tag">{view.syncFailures.total}</span></h3>
   {failures.length?<Table><TableHeader><TableRow><TableHead>Worker</TableHead><TableHead>Step</TableHead><TableHead>Problem</TableHead><TableHead>Count</TableHead><TableHead>First and last</TableHead><TableHead>Grant</TableHead><TableHead>Recovery</TableHead></TableRow></TableHeader><TableBody>{failures.map((f:any)=><TableRow key={f.id}>
    <TableCell>{f.worker}<div className="muted text-sm">notebook {f.appVersion}</div></TableCell><TableCell>{STEP[f.step]??f.step}</TableCell><TableCell>{f.errorClass.replace(/-/g,' ')}</TableCell><TableCell>{f.count}</TableCell><TableCell>{when(f.firstAt)}<div className="muted text-sm">{when(f.lastAt)}</div></TableCell>
    <TableCell>{f.grant?<>{f.grant} <span className="tag">{f.grantState}</span>{f.patient&&<div className="muted text-sm">{f.patient.name}</div>}</>:'—'}</TableCell><TableCell className="text-sm">{f.recovery}</TableCell></TableRow>)}</TableBody></Table>:<p className="muted">No sync failures reported in the last {view.syncFailures.windowDays} days.</p>}
   {view.syncFailures.truncated&&<p className="muted text-sm">Showing the first {failures.length}.</p>}</>}
 </section>;
}
