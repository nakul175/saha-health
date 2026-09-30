'use client';
import { useCallback, useEffect, useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from '@/components/ui/table';
import type { Snapshot } from '@/lib/saha/types';
// Slice 4c: per-worker activity evidence for the teams the viewer supervises. Read-only.
const STATUS:Record<string,string>={performed:'performed','corrected':'corrected, not counted','wrong-patient':'wrong patient, not counted',verified:'claim verified',unverified:'claim not verified'};
const SUBMISSION:Record<string,string>={accepted:'programme accepted',pending:'submission unresolved',rejected:'programme rejected',cancelled:'submission cancelled',none:'not submitted'};
export function WorkerActivity({data}:{data:Snapshot}){
 const [view,setView]=useState<any>(null),[days,setDays]=useState('30'),[error,setError]=useState('');
 const load=useCallback(async()=>{try{const r=await fetch(`/api/worker-activity?days=${days}`,{cache:'no-store',headers:{'x-saha-organisation':data.organisation.id}});const j:any=await r.json();if(r.status===403){setView(null);return;}if(!r.ok)throw Error(j.error??'Worker activity unavailable.');setView(j);setError('');}catch(e){setError(e instanceof Error?e.message:'Worker activity unavailable.');}},[days,data.organisation.id]);
 useEffect(()=>{if(data.role!=='admin')void load();},[load,data.role,data.organisation.revision]);
 if(!view&&!error)return null;
 return <section className="panel member-panel" aria-labelledby="worker-activity-title"><div className="section-heading"><h2 id="worker-activity-title"><ClipboardCheck size={19}/> Worker activity evidence</h2><Select value={days} onValueChange={setDays}><SelectTrigger aria-label="Activity period" className="w-40"><SelectValue/></SelectTrigger><SelectContent>{['7','30','90'].map(d=><SelectItem key={d} value={d}>Last {d} days</SelectItem>)}</SelectContent></Select></div>
  {error&&<p role="alert" className="notice amber-notice">{error}</p>}
  {view&&<><p className="notice" role="note">{view.notice}</p><p className="muted text-sm">{view.teams.map((t:any)=>t.name).join(', ')} · {view.scope}</p>
   <ul className="muted text-sm">{Object.entries(view.definitions).map(([k,v])=><li key={k}><strong>{k[0].toUpperCase()+k.slice(1)}:</strong> {String(v)}</li>)}</ul>
   {view.workers.length?<Table><TableHeader><TableRow><TableHead>Worker</TableHead><TableHead>Performed</TableHead><TableHead>Claimed</TableHead><TableHead>Verified</TableHead><TableHead>Submitted</TableHead><TableHead>Unresolved</TableHead><TableHead>Corrected or wrong patient</TableHead></TableRow></TableHeader><TableBody>{view.workers.map((w:any)=><TableRow key={w.userId}><TableCell><details><summary>{w.displayName} <span className="muted">· {w.role}{w.status!=='active'?` · ${w.status}`:''}</span></summary><ul className="revision-list">{w.items.map((i:any)=><li key={i.kind+i.ref+i.at}>{new Date(i.at).toLocaleDateString()} · {i.personName} · <span className="tag">{STATUS[i.status]}</span>{i.submission&&i.status==='performed'&&<span className="tag">{SUBMISSION[i.submission]}{i.receipt?` ${i.receipt}`:''}</span>} {i.trace}</li>)}</ul>{w.omitted>0&&<p className="muted">{w.omitted} older items not shown.</p>}</details></TableCell><TableCell>{w.counts.performed}</TableCell><TableCell>{w.counts.claimed}</TableCell><TableCell>{w.counts.verified}</TableCell><TableCell>{w.counts.submitted}</TableCell><TableCell>{w.counts.submissionPending}</TableCell><TableCell>{w.counts.corrected+w.counts.wrongPatient}</TableCell></TableRow>)}</TableBody></Table>:<p className="muted">No worker activity in this period.</p>}</>}
 </section>;
}
