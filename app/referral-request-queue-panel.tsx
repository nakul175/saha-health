'use client';
import { useCallback, useEffect, useState } from 'react';
import { Inbox, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Snapshot } from '@/lib/saha/types';
import type { RequestItem } from '@/lib/saha/referral-request-queue';
const waited=(h:number)=>h<48?`${h} hour${h===1?'':'s'}`:`${Math.floor(h/24)} days`;
// Slice 3i: open field referral requests in the viewer's scope, concern first then oldest, each linking to its visit.
export function ReferralRequestQueue({data}:{data:Snapshot}){
 const shown=data.role==='clinician'||data.role==='supervisor'||(data.membership.isOwner&&data.role!=='admin');
 const [value,setValue]=useState<any>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 const load=useCallback(async()=>{if(!shown)return;setLoading(true);try{const r=await fetch('/api/referral-requests',{cache:'no-store',headers:{'x-saha-organisation':data.organisation.id}}),j:any=await r.json();if(!r.ok)throw Error(j.error);setValue(j);setError('');}catch(e){setError(e instanceof Error?e.message:'Referral request queue unavailable.');}finally{setLoading(false);}},[data.organisation.id,shown]);
 useEffect(()=>{void load();},[load,data.organisation.revision]);
 if(!shown)return null;
 return <section className="panel" aria-labelledby="referral-requests-title"><div className="section-heading"><h2 id="referral-requests-title"><Inbox size={20}/>Field referral requests {value&&<span className="number-badge">{value.total}</span>}</h2><Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw size={15}/>Refresh</Button></div>
  {error&&<p role="alert">{error}</p>}
  {value&&<><p className="muted text-sm">{value.scope} A recorded clinical concern first, then the oldest request. Requests waiting {value.waitHours} hours or more ({value.longWaiting}) are also in the exception queue.</p>
   {value.items.length?<ul className="revision-list">{value.items.map((i:RequestItem)=><li key={i.visitId}>
    {i.concern==='yes'&&<><span className="tag amber">Clinical concern</span> </>}{i.longWaiting&&<><span className="tag amber">Waiting {waited(i.ageHours)}</span> </>}<strong>{i.patient.name}</strong> · {i.patient.village} · to {i.facility}
    <p className="muted text-sm">Requested by {i.requestedBy} on {new Date(i.requestedAt).toLocaleString()} ({waited(i.ageHours)} ago) · Visit {i.visit.state==='confirmed'?'confirmed':'not confirmed'} ({i.visit.date.slice(0,10)})</p>
    <p className="text-sm">Reason given: {i.reason}</p>
    {i.blocker&&<p className="muted text-sm">{i.blocker}</p>}
    <a className="download-link" href={i.link.href}>{i.canDecide?'Open visit to decide':'Open visit'}</a></li>)}</ul>:<p className="muted">No open field referral requests in your scope.</p>}
   {value.truncated&&<p className="muted text-sm">Showing the first {value.items.length} of {value.total}.</p>}</>}
 </section>;
}
