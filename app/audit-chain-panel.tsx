'use client';
import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Snapshot } from '@/lib/saha/types';
const STATUS:Record<string,string>={intact:'Intact',broken:'Broken',incomplete:'Checked up to the limit','not-started':'Not started'};
// Slice 6j: owners and administrators verify the audit chain and download the auditor export.
export function AuditChainPanel({data}:{data:Snapshot}){
 const [result,setResult]=useState<any>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 if(!data.canManage&&data.role!=='admin')return null;
 const headers={'x-saha-organisation':data.organisation.id};
 const verify=async()=>{setBusy(true);try{const r=await fetch('/api/audit/chain',{headers,cache:'no-store'});const j:any=await r.json();if(!r.ok)throw Error(j.error);setResult(j);setError('');}catch(e){setError(e instanceof Error?e.message:'Could not verify the audit chain.');}finally{setBusy(false);}};
 const download=async()=>{setBusy(true);try{const r=await fetch('/api/audit/chain?format=jsonl',{headers,cache:'no-store'});if(!r.ok)throw Error(((await r.json()) as any).error);const url=URL.createObjectURL(await r.blob()),a=document.createElement('a');a.href=url;a.download=/filename="([^"]+)"/.exec(r.headers.get('content-disposition')??'')?.[1]??'saha-audit-chain.jsonl';a.click();URL.revokeObjectURL(url);setError('');}catch(e){setError(e instanceof Error?e.message:'Could not export the audit chain.');}finally{setBusy(false);}};
 return <section className="panel member-panel" aria-labelledby="audit-chain-heading"><div className="section-heading"><h2 id="audit-chain-heading"><ShieldCheck size={19}/> Audit chain</h2><span className="muted text-sm">Owners and administrators</span></div>
  <div className="grid gap-3 px-6 pb-5"><p className="muted">Each saved audit event is linked to the one before it by a SHA-256 hash, so a changed, removed or inserted event shows as a break. The export lists the chain for auditors; events linked to patients outside your care teams appear as digests only. Downloading an export is itself recorded in the chain.</p>
  <div className="flex flex-wrap gap-3"><Button variant="outline" disabled={busy} onClick={verify}>{busy?'Checking…':'Verify chain'}</Button><Button variant="outline" disabled={busy} onClick={download}>Download export (JSONL)</Button></div>
  {result&&<div role="status" className={`notice ${result.status==='broken'?'amber-notice':''}`}><strong>{STATUS[result.status]??result.status}</strong> · {result.events} chained events checked{result.priorEvents?` · ${result.priorEvents} earlier events sealed at the start of the chain`:''}{result.head?` · head ${result.head.seq} (${String(result.head.hash).slice(0,12)}…)`:''}{result.firstBreak&&<><br/>First break at event {result.firstBreak.seq}: {result.firstBreak.reason}</>}{result.clockRegressions?.count?<><br/>{result.clockRegressions.count} events carry a time earlier than the event before them (largest {Math.round(result.clockRegressions.largestMs/60000)} min). This is reported, not treated as a break.</>:null}</div>}
  {error&&<p className="notice amber-notice" role="alert">{error}</p>}</div>
 </section>;
}
