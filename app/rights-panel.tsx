'use client';
import { useCallback, useEffect, useState } from 'react';
import { Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { Person, Snapshot } from '@/lib/saha/types';
type Command=(c:any,s?:string)=>Promise<any>;
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="field"><span>{label}</span>{children}</label>}
function Pick({label,value,set,items}:{label:string;value:string;set:(s:string)=>void;items:{id:string;name:string}[]}){return <Select value={value} onValueChange={set}><SelectTrigger aria-label={label}><SelectValue placeholder={label}/></SelectTrigger><SelectContent>{items.map(x=><SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent></Select>}
const KINDS=[['access','Access to records'],['correction','Correction'],['restriction','Restrict processing'],['deletion','Deletion'],['grievance','Grievance']];
const OUTCOMES=[['fulfilled','Fulfilled'],['partially-fulfilled','Partially fulfilled'],['refused','Refused'],['withdrawn','Withdrawn by requester']];
const day=(s:string)=>new Date(s).toLocaleDateString();

export function RestrictionNotice({p}:{p:Person}){return (p.restrictions??[]).some(r=>!r.liftedAt)?<div className="notice amber-notice" role="status">Processing is restricted under a rights request. Record care as usual; external sharing, programme sending, reminders and optional AI are paused until the restriction is lifted.</div>:null;}
function RequestCard({r,view,busy,run}:{r:any;view:any;busy:boolean;run:(b:any,ok:string)=>Promise<any>}){
 const [owner,setOwner]=useState(''),[note,setNote]=useState(''),[outcome,setOutcome]=useState('fulfilled'),[response,setResponse]=useState(''),[evidence,setEvidence]=useState(''),[itemNotes,setItemNotes]=useState<Record<string,string>>({});
 return <section className="stack-form merge-case"><h3>{KINDS.find(k=>k[0]===r.kind)?.[1]} · {r.state==='open'?(r.overdue?'overdue':`due ${day(r.dueAt)}`):r.closed.outcome}</h3>
  <p className="muted">{r.personName?`${r.personName} · `:''}Received {day(r.receivedAt)} ({r.channel}, {r.requester==='proxy'?'representative':'patient'}) · owner {r.owner} · {r.detail}</p>
  {r.restriction&&<p className="notice amber-notice">This request's restriction is in force.</p>}
  {r.items.length>0&&<ul className="revision-list">{r.items.map((i:any)=><li key={i.id}>{i.detail} <span className="tag">{i.state}</span>{i.state==='open'&&r.canClose&&<span className="button-row"><Input aria-label="Destination note" placeholder="How and when notified" value={itemNotes[i.id]??''} onChange={e=>setItemNotes({...itemNotes,[i.id]:e.target.value})}/><Button size="sm" variant="outline" disabled={busy||(itemNotes[i.id]??'').trim().length<5} onClick={()=>run({type:'rightsItemResolve',requestId:r.id,version:r.version,itemId:i.id,state:'notified',note:itemNotes[i.id]},'Destination recorded.')}>Notified</Button><Button size="sm" variant="ghost" disabled={busy||(itemNotes[i.id]??'').trim().length<5} onClick={()=>run({type:'rightsItemResolve',requestId:r.id,version:r.version,itemId:i.id,state:'not-required',note:itemNotes[i.id]},'Destination recorded.')}>Not required</Button></span>}</li>)}</ul>}
  {r.state==='open'&&r.canAssign&&view?.owners&&<div className="form-grid"><Pick label="Assign to" value={owner} set={setOwner} items={view.owners.map((o:any)=>({id:o.userId,name:o.displayName}))}/><Input aria-label="Assignment note" placeholder="Assignment note" value={note} onChange={e=>setNote(e.target.value)}/><Button variant="outline" disabled={busy||!owner||note.trim().length<10} onClick={()=>run({type:'rightsAssign',requestId:r.id,version:r.version,ownerId:owner,note},'Request assigned.')}>Assign</Button></div>}
  {r.state==='open'&&r.canClose&&<div className="stack-form"><div className="form-grid"><Pick label="Outcome" value={outcome} set={setOutcome} items={OUTCOMES.map(([id,name])=>({id,name}))}/><Input aria-label="Evidence reference" placeholder="Evidence reference" value={evidence} onChange={e=>setEvidence(e.target.value)}/></div><Input aria-label="Response to the requester" placeholder="Response given to the requester" value={response} onChange={e=>setResponse(e.target.value)}/><Button disabled={busy||response.trim().length<10||evidence.trim().length<3} onClick={()=>run({type:'rightsClose',requestId:r.id,version:r.version,outcome,response,evidence},'Request closed.')}>Close request</Button></div>}
  {r.canLift&&<div className="form-grid"><Input aria-label="Reason to lift the restriction" placeholder="Why the restriction ends" value={note} onChange={e=>setNote(e.target.value)}/><Button variant="outline" disabled={busy||note.trim().length<10} onClick={()=>run({type:'rightsRestrictionLift',requestId:r.id,version:r.version,reason:note},'Restriction lifted.')}>Lift restriction</Button></div>}
  <details><summary>History</summary><ul>{r.history.map((h:any,n:number)=><li key={n}>{new Date(h.at).toLocaleString()} · {h.by} · {h.action} · {h.note}</li>)}</ul></details>
 </section>;
}
// Patient page: record and work rights and grievance requests for one patient.
export function RightsPatient({data,p,busy,command}:{data:Snapshot;p:Person;busy:boolean;command:Command}){
 const [open,setOpen]=useState(false),[view,setView]=useState<any>(null),[error,setError]=useState('');
 const [kind,setKind]=useState('access'),[channel,setChannel]=useState('in-person'),[requester,setRequester]=useState('self'),[grant,setGrant]=useState(''),[check,setCheck]=useState(''),[detail,setDetail]=useState('');
 const load=useCallback(async()=>{try{const r=await fetch(`/api/rights?personId=${encodeURIComponent(p.id)}`,{cache:'no-store',headers:{'x-saha-organisation':data.organisation.id}});const j:any=await r.json();if(!r.ok)throw Error(j.error??'Rights requests unavailable.');setView(j);setError('');}catch(e){setError(e instanceof Error?e.message:'Rights requests unavailable.');}},[p.id,data.organisation.id]);
 useEffect(()=>{if(open)load();},[open,p.version]);// eslint-disable-line react-hooks/exhaustive-deps
 const run=async(body:any,ok:string)=>{const r=await command(body,ok);if(r)await load();return r;};
 return <><Button variant="outline" onClick={()=>setOpen(true)}>Rights requests</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="wide-dialog"><DialogHeader><DialogTitle>Rights and grievance requests · {p.name}</DialogTitle><DialogDescription>Record how the requester's identity or authority was checked. Requests are due {view?.dueDays??30} days after receipt by local default. Saha cannot delete clinical records; a deletion request is answered with what can and cannot be removed.</DialogDescription></DialogHeader>
  {error&&<p role="alert" className="notice amber-notice">{error}</p>}
  {view&&<>{view.requests.length===0?<p className="muted">No requests for this patient.</p>:view.requests.map((r:any)=><RequestCard key={r.id} r={r} view={view} busy={busy} run={run}/>)}
   <section className="stack-form"><h3>Record a new request</h3><div className="form-grid"><Pick label="Request type" value={kind} set={setKind} items={KINDS.map(([id,name])=>({id,name}))}/><Pick label="Received by" value={channel} set={setChannel} items={[['in-person','In person'],['phone','Phone'],['written','Written']].map(([id,name])=>({id,name}))}/><Pick label="Requested by" value={requester} set={v=>{setRequester(v);setGrant('')}} items={[{id:'self',name:'The patient'},{id:'proxy',name:'A representative'}]}/>{requester==='proxy'&&<Pick label="Proxy grant" value={grant} set={setGrant} items={view.proxies.map((g:any)=>({id:g.id,name:`${g.name} · ${g.relationship}`}))}/>}</div>
    {requester==='proxy'&&!view.proxies.length&&<p className="notice amber-notice">No current proxy grant. Record one under Household & proxies first.</p>}
    <Field label="Identity check"><Input value={check} onChange={e=>setCheck(e.target.value)} placeholder="What was checked, e.g. ANC card seen"/></Field><Field label="Request details"><Input value={detail} onChange={e=>setDetail(e.target.value)} placeholder="What the requester asked for"/></Field>
    <Button disabled={busy||check.trim().length<3||detail.trim().length<10||(requester==='proxy'&&!grant)} onClick={()=>run({type:'rightsCreate',personId:p.id,kind,channel,requester,...(requester==='proxy'?{proxyGrantId:grant}:{}),identityCheck:check,detail},'Request recorded.').then(r=>{if(r){setCheck('');setDetail('');}})}>Record request</Button></section></>}
 </DialogContent></Dialog></>;
}
// Care handover page: open requests across the viewer's scope, overdue first.
export function RightsQueue({data,busy,command}:{data:Snapshot;busy:boolean;command:Command}){
 const [view,setView]=useState<any>(null);
 const load=useCallback(async()=>{try{const r=await fetch('/api/rights',{cache:'no-store',headers:{'x-saha-organisation':data.organisation.id}});if(r.ok)setView(await r.json());}catch{}},[data.organisation.id]);
 useEffect(()=>{if(data.role!=='admin')load();},[load,data.role]);
 const run=async(body:any,ok:string)=>{const r=await command(body,ok);if(r)await load();return r;};
 if(!view||!view.open.length)return null;
 return <section className="panel member-panel"><div className="section-heading"><h2><Scale size={19}/> Rights and grievance requests</h2><span className="muted text-sm">{view.open.length} open · {view.overdue} overdue</span></div>{view.open.map((r:any)=><RequestCard key={r.id} r={r} view={null} busy={busy} run={run}/>)}</section>;
}
