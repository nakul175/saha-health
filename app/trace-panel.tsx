'use client';
import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Route } from 'lucide-react';
import { Button } from '@/components/ui/button';
const KIND:Record<string,string>={submission:'Programme submission','ehr-publication':'EHR publication',assistant:'Assistant request'};
const SOURCE:Record<string,string>={command:'User command',destination:'Destination or provider response',callback:'Destination callback','not linked':'Not linked'};
const when=(x:string|null)=>x?new Date(x).toLocaleString():'—';
// Slice 6y: read-only trace from the user commands to execution checkpoints, receipts and audit events.
// The query names one record by identifier only; the server decides what the viewer may see.
export function TracePanel({organisationId,query,revision,title='Trace of external work'}:{organisationId:string;query:{visit?:string;submission?:string;publication?:string};revision?:number;title?:string}){
 const [value,setValue]=useState<any>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 const [k,id]=Object.entries(query).find(([,v])=>!!v)??['visit',''];
 const load=useCallback(async()=>{setLoading(true);try{const r=await fetch(`/api/trace?${k}=${encodeURIComponent(id)}`,{cache:'no-store',headers:{'x-saha-organisation':organisationId}}),j:any=await r.json();if(!r.ok)throw Error(j.error);setValue(j);setError('');}catch(e){setError(e instanceof Error?e.message:'Trace unavailable.');}finally{setLoading(false);}},[k,id,organisationId]);
 useEffect(()=>{void load();},[load,revision]);
 const head=`trace-${k}-${id}`;
 return <section className="trace-panel" aria-labelledby={head}><div className="trace-heading"><h3 id={head}><Route size={17}/>{title}</h3><Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw size={15}/>Refresh trace</Button></div>
  {error&&<p role="alert" className="notice amber-notice">{error}</p>}
  {value&&<><p className="muted text-sm">{value.note}{value.notLinked?` ${value.notLinked} step${value.notLinked===1?' is':'s are'} not linked.`:''} Trace {value.traceVersion}.{value.truncated?' This history is long: only the most recent events are listed.':''}</p>
   {!value.threads.length&&<p className="muted text-sm">No programme submission, EHR publication or assistant request on this visit.</p>}
   {value.threads.map((t:any)=><div key={t.id} className={`trace-thread${value.focus===t.id?' trace-focus':''}`}>
    <p><span className="tag">{KIND[t.kind]??t.kind}</span> <strong>{t.destination}</strong> · <span className={`tag ${['accepted','review','applied'].includes(t.state)?'success':['uncertain','running','sending','retryable','blocked','failed','rejected','conflict','not-stored'].includes(t.state)?'amber':''}`}>{t.state}</span>{t.timedOut&&<> <span className="tag amber">timed out, outcome uncertain</span></>}</p>
    <p className="muted text-sm">Record {t.recordId} · Destination receipt: {t.receipt??(t.receiptExists?'recorded (not shown outside your care scope)':'none')} · Attempts {t.attempts.used}{t.attempts.limit!=null?` of ${t.attempts.limit}`:''}{t.taskAttempt!=null?` · Task attempt ${t.taskAttempt}${t.limits?.attempts?` of ${t.limits.attempts}`:''} on this visit`:''}{t.limits?.timeMinutes?` · Time limit ${t.limits.timeMinutes} min`:''}. {t.attempts.rule}</p>
    <div className="trace-scroll"><table className="trace-table"><caption className="sr-only">Steps of {KIND[t.kind]??t.kind} {t.recordId}</caption><thead><tr><th scope="col">Time</th><th scope="col">State</th><th scope="col">Attempt</th><th scope="col">Step</th><th scope="col">Command</th><th scope="col">By</th><th scope="col">Receipt id</th><th scope="col">Audit event</th></tr></thead>
     <tbody>{t.steps.map((x:any,i:number)=><tr key={i}><td>{when(x.at)}</td><td>{x.state}</td><td>{x.attempt??'—'}</td><td>{SOURCE[x.source]??x.source}</td><td>{x.command??'not linked'}</td><td>{x.actor??'—'}</td><td className="trace-id">{x.receiptId?<>{x.receiptId}{x.receiptFound===false?' (no receipt row)':''}</>:'—'}</td><td className="trace-id">{x.auditId?<>{x.auditSeq!=null?`#${x.auditSeq} `:''}{x.auditId}</>:'not linked'}</td></tr>)}</tbody></table></div>
   </div>)}
   <h4 className="trace-subhead">Audit events{value.scope==='full'?' (execution, record access and external requests)':' linked to this item'}</h4>
   {value.events.length?<div className="trace-scroll"><table className="trace-table"><caption className="sr-only">Audit events</caption><thead><tr><th scope="col">Time</th><th scope="col">Sequence</th><th scope="col">Action</th><th scope="col">Kind</th><th scope="col">By</th><th scope="col">Linked step</th></tr></thead>
    <tbody>{value.events.map((e:any)=><tr key={e.id}><td>{when(e.at)}</td><td>{e.seq??'—'}</td><td>{e.action}</td><td>{e.kind}</td><td>{e.actor} ({e.role})</td><td className="trace-id">{e.steps.length?e.steps.join(', '):'not linked'}</td></tr>)}</tbody></table></div>:<p className="muted text-sm">No audit events found for this trace.</p>}</>}
 </section>;
}
