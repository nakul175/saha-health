'use client';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { Person, Snapshot } from '@/lib/saha/types';
type Command=(c:any,s?:string)=>Promise<any>;
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="field"><span>{label}</span>{children}</label>}
const KIND:Record<string,string>={'programme-record':'Programme record','ehr-link':'EHR link','referral':'Referral','follow-up':'Follow-up','enrolment':'Episode','household':'Household','proxy':'Proxy grant','post-merge-review':'Created while merged'};

// Slice 1c: duplicate-record merge proposals, two-person review, impact queue and unmerge for one patient.
export function MergeNotice({p}:{p:Person}){
 if(p.mergedInto)return <div className="notice amber-notice" role="status">This record was merged into another record on {new Date(p.mergedInto.at).toLocaleDateString()}. It is read-only for new care; visits, receipts and history are kept. Open Identity & merges for the surviving record and remaining work.</div>;
 const active=(p.mergedFrom??[]).filter(x=>!x.unmergedAt).length;
 return active?<div className="notice" role="status">{active} duplicate record{active>1?'s were':' was'} merged into this record. Their history stays on the original record; open Identity & merges for remaining work.</div>:null;
}
export function MergePatient({data,p,busy,command}:{data:Snapshot;p:Person;busy:boolean;command:Command}){
 const [open,setOpen]=useState(false),[view,setView]=useState<any>(null),[error,setError]=useState('');
 const [other,setOther]=useState(''),[keep,setKeep]=useState<'this'|'other'>('this'),[evidence,setEvidence]=useState(''),[reason,setReason]=useState(''),[decision,setDecision]=useState(''),[notes,setNotes]=useState<Record<string,string>>({});
 const load=useCallback(async()=>{setError('');try{const r=await fetch(`/api/identity-cases?personId=${encodeURIComponent(p.id)}`,{cache:'no-store',headers:{'x-saha-organisation':data.organisation.id}});const j:any=await r.json();if(!r.ok)throw Error(j.error??'Identity cases unavailable.');setView(j);}catch(e){setError(e instanceof Error?e.message:'Identity cases unavailable.');}},[p.id,data.organisation.id]);
 useEffect(()=>{if(open)load();},[open,p.version]);// eslint-disable-line react-hooks/exhaustive-deps
 const run=async(body:any,ok:string)=>{const r=await command(body,ok);if(r){await load();setReason('');setDecision('');}return r;};
 const candidates=data.people.filter(q=>q.id!==p.id&&!q.mergedInto);
 return <><Button variant="outline" onClick={()=>setOpen(true)}>Identity & merges</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="wide-dialog"><DialogHeader><DialogTitle>Identity & merges · {p.name}</DialogTitle><DialogDescription>{view?.rule??'Loading…'}</DialogDescription></DialogHeader>
  {error&&<p role="alert" className="notice amber-notice">{error}</p>}
  {view&&<>
   {view.mergedInto&&<p className="notice amber-notice">Merged into {view.mergedInto.survivor.name}{view.mergedInto.survivor.village?` · ${view.mergedInto.survivor.village}`:''}. New care must be recorded there.</p>}
   {view.cases.length===0?<p className="muted">No merge proposals involve this record.</p>:view.cases.map((k:any)=><section key={k.id} className="stack-form merge-case">
    <h3>{k.state==='proposed'?'Merge proposed':k.state==='merged'?'Merged':k.state==='unmerged'?'Merged, then reversed':'Proposal rejected'}</h3>
    <p><strong>Keep:</strong> {k.survivor.name}{k.survivor.age!=null?` · ${k.survivor.age} years · ${k.survivor.village}`:''}<br/><strong>Duplicate:</strong> {k.duplicate.name}{k.duplicate.age!=null?` · ${k.duplicate.age} years · ${k.duplicate.village}`:''}</p>
    <p className="muted">{k.detailWithheld?'Evidence and reason withheld: the other record is outside your scope':`Evidence ${k.evidence}`} · proposed {new Date(k.proposedAt).toLocaleString()}{k.proposedBySelf?' by you':''}{k.detailWithheld?'':` · ${k.reason}`}</p>
    {k.decided&&<p className="muted">{k.decided.decision==='approve'?'Approved':'Rejected'} {new Date(k.decided.at).toLocaleString()}{k.decided.reason?` · ${k.decided.reason}`:''}</p>}
    {k.invalidated&&<p className="muted">At merge: {k.invalidated.plans} pending approvals invalidated, {k.invalidated.leases} field packages revoked, {k.invalidated.messages} reminders cancelled.</p>}
    {k.unmerged&&<p className="muted">Reversed {new Date(k.unmerged.at).toLocaleString()}{k.unmerged.reason?` · ${k.unmerged.reason}`:''}</p>}
    {k.state==='proposed'&&(k.canDecide?<div className="stack-form"><Field label="Review reason"><Input value={decision} onChange={e=>setDecision(e.target.value)} placeholder="What you compared, at least ten characters"/></Field><div className="button-row"><Button disabled={busy||decision.trim().length<10} onClick={()=>run({type:'identityMergeDecide',caseId:k.id,version:k.version,decision:'approve',reason:decision},'Merge approved.')}>Approve merge</Button><Button variant="outline" disabled={busy||decision.trim().length<10} onClick={()=>run({type:'identityMergeDecide',caseId:k.id,version:k.version,decision:'reject',reason:decision},'Merge rejected.')}>Keep separate</Button></div></div>:<p className="muted">{k.proposedBySelf?'A different identity steward must review this proposal.':'An identity steward with access to both records can review this proposal.'}</p>)}
    {k.items.length>0&&<><h4>Impact queue · {k.openItems} open</h4><ul className="revision-list">{k.items.map((i:any)=><li key={i.id}><span className="tag">{KIND[i.kind]??i.kind}</span> {i.detail}{i.state==='resolved'?<span className="muted"> · Resolved: {i.resolved.note}</span>:k.canResolve&&<span className="button-row"><Input aria-label={`Resolution note for ${KIND[i.kind]??i.kind}`} placeholder="How it was resolved" value={notes[i.id]??''} onChange={e=>setNotes({...notes,[i.id]:e.target.value})}/><Button size="sm" variant="outline" disabled={busy||(notes[i.id]??'').trim().length<5} onClick={()=>run({type:'identityImpactResolve',caseId:k.id,version:k.version,itemId:i.id,note:notes[i.id]},'Item resolved.')}>Resolve</Button></span>}</li>)}</ul></>}
    {k.canUnmerge&&<div className="stack-form"><Field label="Reason to reverse this merge"><Input value={reason} onChange={e=>setReason(e.target.value)} placeholder="Why these are different people, at least ten characters"/></Field><Button variant="destructive" disabled={busy||reason.trim().length<10} onClick={()=>run({type:'identityUnmerge',caseId:k.id,version:k.version,reason},'Merge reversed.')}>Reverse merge</Button></div>}
   </section>)}
   {view.canPropose&&<section className="stack-form"><h3>Propose a merge</h3><p className="muted">Only when you are sure two records describe the same person. Same name, shared phone or household is not enough. Nothing is merged until a different steward approves.</p>
    <Field label="Other record"><Select value={other} onValueChange={setOther}><SelectTrigger aria-label="Other record"><SelectValue placeholder="Choose a record in your scope"/></SelectTrigger><SelectContent>{candidates.map(q=><SelectItem key={q.id} value={q.id}>{q.name} · {q.age} years · {q.village}</SelectItem>)}</SelectContent></Select></Field>
    <Field label="Record to keep"><Select value={keep} onValueChange={v=>setKeep(v as any)}><SelectTrigger aria-label="Record to keep"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="this">Keep this record ({p.name})</SelectItem><SelectItem value="other">Keep the other record</SelectItem></SelectContent></Select></Field>
    <Field label="Evidence reference"><Input value={evidence} onChange={e=>setEvidence(e.target.value)} placeholder="Document or register compared"/></Field>
    <Field label="Reason"><Input value={reason} onChange={e=>setReason(e.target.value)} placeholder="What shows they are the same person"/></Field>
    <Button disabled={busy||!other||evidence.trim().length<3||reason.trim().length<10} onClick={()=>run({type:'identityMergePropose',survivorId:keep==='this'?p.id:other,duplicateId:keep==='this'?other:p.id,evidence,reason},'Merge proposed for review.').then(r=>{if(r){setOther('');setEvidence('');}})}>Propose merge</Button>
   </section>}
  </>}
 </DialogContent></Dialog></>;
}
