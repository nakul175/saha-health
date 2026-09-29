'use client';
import { useCallback, useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Person, Snapshot } from '@/lib/saha/types';
type Command=(c:any,s?:string)=>Promise<any>;
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="field"><span>{label}</span>{children}</label>}
const time=(s:string)=>new Date(s).toLocaleString();

// Slice 6a: a notice on a patient opened through emergency access.
export function ExceptionalNotice({data,p}:{data:Snapshot;p:Person}){
 const now=new Date().toISOString(),g=(p.exceptionalAccess??[]).find(x=>x.userId===data.user.userId&&!x.closedAt&&x.until>now);
 const normal=data.membership.teamIds.includes(p.teamId)&&(data.role!=='asha'||p.assignedTo===data.user.userId);
 return g&&!normal?<div className="notice amber-notice" role="status">Emergency access until {time(g.until)}. You may read this record and record urgent care. Sharing, consent, identity and assignment changes are not available. This access will be reviewed.</div>:null;
}
// Slice 6a: open, close and review emergency access.
export function ExceptionalPanel({data,busy,command}:{data:Snapshot;busy:boolean;command:Command}){
 const [view,setView]=useState<any>(null),[error,setError]=useState(''),[ref,setRef]=useState(''),[minutes,setMinutes]=useState('60'),[reason,setReason]=useState(''),[notes,setNotes]=useState<Record<string,string>>({});
 const load=useCallback(async()=>{try{const r=await fetch('/api/exceptional',{cache:'no-store',headers:{'x-saha-organisation':data.organisation.id}});const j:any=await r.json();if(!r.ok)throw Error(j.error??'Emergency access is unavailable.');setView(j);setError('');}catch(e){setError(e instanceof Error?e.message:'Emergency access is unavailable.');}},[data.organisation.id]);
 useEffect(()=>{if(data.role!=='admin')load();},[load,data.role]);
 const run=async(body:any,ok:string)=>{const r=await command(body,ok);if(r)await load();return r;};
 if(!view||(!view.canOpen&&!view.canReview))return error?<p role="alert" className="notice amber-notice">{error}</p>:null;
 return <section className="panel member-panel"><div className="section-heading"><h2><ShieldAlert size={19}/> Emergency access</h2></div><p className="muted text-sm">{view.rule}</p>
  {error&&<p role="alert" className="notice amber-notice">{error}</p>}
  {view.canOpen&&<div className="stack-form"><div className="form-grid"><Field label="Record reference"><Input value={ref} onChange={e=>setRef(e.target.value)} placeholder="As shown on the patient's record, e.g. 3F9A21C0"/></Field><Field label="Duration"><Select value={minutes} onValueChange={setMinutes}><SelectTrigger aria-label="Emergency access duration"><SelectValue/></SelectTrigger><SelectContent>{[15,30,60,120,240].map(n=><SelectItem key={n} value={String(n)}>{n<60?`${n} minutes`:`${n/60} hour${n>60?'s':''}`}</SelectItem>)}</SelectContent></Select></Field></div>
   <Field label="Reason for emergency access"><Input value={reason} onChange={e=>setReason(e.target.value)} placeholder="The urgent situation, at least 20 characters"/></Field>
   <Button variant="destructive" disabled={busy||ref.trim().length<4||reason.trim().length<20} onClick={()=>run({type:'exceptionalOpen',recordRef:ref.trim(),minutes:Number(minutes),reason},'Emergency access opened. The patient now appears in your workspace.').then(r=>{if(r){setRef('');setReason('');}})}>Open emergency access</Button>
   {view.mine.length>0&&<ul className="revision-list">{view.mine.map((g:any)=><li key={g.grantId}><strong>{g.name}</strong> · {time(g.from)} to {time(g.closedAt??g.until)} · {g.active?'active':'ended'}{g.review?` · reviewed: ${g.review.outcome}`:g.active?'':' · awaiting review'}{g.active&&<Button size="sm" variant="ghost" disabled={busy} onClick={()=>run({type:'exceptionalClose',personId:g.personId,grantId:g.grantId},'Emergency access closed.')}>Close now</Button>}</li>)}</ul>}
  </div>}
  {view.canReview&&<><h3>Awaiting review</h3>{view.reviews.length?<ul className="revision-list">{view.reviews.map((g:any)=><li key={g.grantId}><strong>{g.user}</strong> opened <strong>{g.name}</strong> {time(g.from)} to {time(g.closedAt??g.until)} · {g.reason}{g.active?<span className="tag amber">still active</span>:<span className="button-row"><Input aria-label={`Review note for ${g.user} on ${g.name}`} placeholder="Review note" value={notes[g.grantId]??''} onChange={e=>setNotes({...notes,[g.grantId]:e.target.value})}/><Button size="sm" variant="outline" disabled={busy||(notes[g.grantId]??'').trim().length<5} onClick={()=>run({type:'exceptionalReview',personId:g.personId,grantId:g.grantId,outcome:'appropriate',note:notes[g.grantId]},'Review recorded.')}>Appropriate</Button><Button size="sm" variant="outline" disabled={busy||(notes[g.grantId]??'').trim().length<5} onClick={()=>run({type:'exceptionalReview',personId:g.personId,grantId:g.grantId,outcome:'inappropriate',note:notes[g.grantId]},'Review recorded.')}>Inappropriate</Button></span>}</li>)}</ul>:<p className="muted">No emergency access awaiting review in your teams.</p>}</>}
 </section>;
}
