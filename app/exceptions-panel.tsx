'use client';
import { useCallback, useEffect, useState } from 'react';
import { ListChecks, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Snapshot } from '@/lib/saha/types';
import { TracePanel } from './trace-panel';
const KIND:Record<string,string>={'safety-case':'Safety case',submission:'Programme submission','ehr-publication':'EHR publication','referral-overdue':'Referral','emergency-access-unreviewed':'Emergency access','protocol-review':'Protocol review','follow-up-overdue':'Follow-up','identity-provisional':'Provisional identity','identity-conflict':'Identity conflict','field-grant-expired':'Field grant','device-diagnostic':'Device diagnostic','abdm-received':'Received ABDM record','referral-request-waiting':'Field referral request','operation-refused':'Operation not permitted','correction-task':'Correction task'};
// Slice 6i: each exception with patient, problem, age, owner, recovery action and a link to the record.
export function ExceptionQueue({data,open,command,busy=false}:{data:Snapshot;open?:(personId:string,visitId:string|null)=>void;command?:(c:unknown,msg?:string)=>Promise<unknown>;busy?:boolean}){
 const [value,setValue]=useState<any>(null),[error,setError]=useState(''),[kind,setKind]=useState('all'),[loading,setLoading]=useState(false);
 // Slice 6y: one row's trace (submission or EHR publication) open at a time.
 const [trace,setTrace]=useState<string|null>(null);
 const [assignees,setAssignees]=useState<Record<string,string>>({}),[reasons,setReasons]=useState<Record<string,string>>({});
 const load=useCallback(async()=>{setLoading(true);try{const r=await fetch('/api/exceptions',{cache:'no-store',headers:{'x-saha-organisation':data.organisation.id}}),j:any=await r.json();if(!r.ok)throw Error(j.error);setValue(j);setError('');}catch(e){setError(e instanceof Error?e.message:'Exception queue unavailable.');}finally{setLoading(false);}},[data.organisation.id]);
 useEffect(()=>{void load();},[load,data.organisation.revision]);
 const rows=(value?.items??[]).filter((i:any)=>kind==='all'||i.kind===kind);
 return <section className="panel ops-panel ops-exceptions" aria-labelledby="ops-exceptions-title"><div className="section-heading"><h2 id="ops-exceptions-title"><ListChecks size={20}/>Exception queue</h2><Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw size={15}/>Refresh</Button></div>
  {error&&<p role="alert">{error}</p>}
  {value&&<><p className="muted text-sm">{value.scope} Oldest and most severe first. Rules {value.rulesVersion}.</p>
   {value.total>0&&<div className="button-row" role="group" aria-label="Filter exceptions"><Button size="sm" variant={kind==='all'?'default':'outline'} aria-pressed={kind==='all'} onClick={()=>setKind('all')}>All {value.total}</Button>{Object.entries(value.counts).map(([k,n])=><Button key={k} size="sm" variant={kind===k?'default':'outline'} aria-pressed={kind===k} onClick={()=>setKind(k)}>{KIND[k]??k} {n as number}</Button>)}</div>}
   {rows.length?<ul className="revision-list">{rows.map((i:any)=><li key={i.id}><span className={`tag ${i.severity==='normal'?'':'amber'}`}>{i.severity}</span> <span className="tag">{KIND[i.kind]??i.kind}</span> <strong>{i.patient?i.patient.name:'Patient outside your care scope'}</strong> · {i.what}
    <p className="muted text-sm">Since {new Date(i.since).toLocaleString()} ({i.ageDays} day{i.ageDays===1?'':'s'}) · Owner: {i.owner}</p><p className="muted text-sm">{i.recovery}</p>
    {i.link&&<a className="download-link" href={i.link.href} onClick={e=>{if(open){e.preventDefault();open(i.link.personId,i.link.visitId);}}}>Open {i.link.visitId?'visit':'patient'}</a>}
    {i.trace&&<> <Button size="sm" variant="outline" aria-expanded={trace===i.id} onClick={()=>setTrace(trace===i.id?null:i.id)}>{trace===i.id?'Hide trace':'Show trace'}</Button></>}
    {i.assignment&&<p className="muted text-sm">Assigned {new Date(i.assignment.assignedAt).toLocaleString()} · {i.assignment.reason}</p>}
    {command&&<form className="button-row" onSubmit={async e=>{e.preventDefault();const r=await command({type:'assignException',itemId:i.id,itemSince:i.since,rulesVersion:value.rulesVersion,expectedAssignmentVersion:i.assignment?.version??0,assigneeId:assignees[i.id]??i.assignment?.assignedTo??'',reason:reasons[i.id]??''},'Exception assigned');if(r){setReasons(x=>({...x,[i.id]:''}));await load();}}}><select aria-label={`Accountable owner for ${KIND[i.kind]??i.kind}`} required value={assignees[i.id]??i.assignment?.assignedTo??''} onChange={e=>setAssignees(x=>({...x,[i.id]:e.target.value}))}><option value="">Choose accountable owner</option>{data.members.filter(m=>m.status==='active'&&m.role!=='provider').map(m=><option key={m.userId} value={m.userId}>{m.displayName} · {m.role}</option>)}</select><Input aria-label={`Assignment reason for ${KIND[i.kind]??i.kind}`} placeholder="Why this person owns recovery" required minLength={10} maxLength={500} value={reasons[i.id]??''} onChange={e=>setReasons(x=>({...x,[i.id]:e.target.value}))}/><Button type="submit" size="sm" variant="outline" disabled={busy}>Assign</Button></form>}
    {i.trace&&trace===i.id&&<TracePanel organisationId={data.organisation.id} query={{[i.trace.query]:i.trace.id}} title={`Trace of this ${i.trace.query==='publication'?'EHR publication':'programme submission'}`}/>}</li>)}</ul>:<p className="muted">No exceptions in your scope.</p>}
   {value.truncated&&<p className="muted text-sm">Showing the first {value.items.length} of {value.total}.</p>}</>}
 </section>;
}
