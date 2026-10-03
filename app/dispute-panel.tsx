'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { disputeLabel, disputeTargets, resolutionOf } from '@/lib/saha/send-gate';
import { PROGRAMMES, type Dispute, type Integration, type Person, type Snapshot, type Visit } from '@/lib/saha/types';
type Command=(c:any,s?:string)=>Promise<any>;
const when=(at:string)=>`${at.slice(0,16).replace('T',' ')} UTC`;
const name=(v:Visit,target:string)=>disputeLabel(target,v.programmeCapture?.packs.flatMap(x=>x.pack.questions).find(q=>q.id===target.slice(7))?.label);
// Slice 10g (BR-DATA-02): enforced disputes on a confirmed fact, note or programme answer. Display and forms only: the server
// decides who may raise or resolve a dispute and what a dispute stops. A dispute is never edited; a clinician's resolution is
// appended with its evidence. Anything already sent to a destination is not recalled.
export function DisputePanel({v,person:p,data,busy,command}:{v:Visit;person:Person;data:Snapshot;busy:boolean;command:Command}){
 const [raising,setRaising]=useState(false),[target,setTarget]=useState(''),[reason,setReason]=useState(''),[reference,setReference]=useState('');
 const [resolving,setResolving]=useState<string|null>(null),[outcome,setOutcome]=useState<'stands'|'corrected'>('stands'),[evidence,setEvidence]=useState(''),[evRef,setEvRef]=useState('');
 const m=data.membership,live=v.state==='confirmed'&&!v.voidedAt&&!v.supersededBy,disputes=v.disputes??[];
 if(!live&&!disputes.length)return null;if(v.state!=='confirmed')return null;
 const scoped=m.teamIds.includes(p.teamId)&&(m.role!=='asha'||p.assignedTo===m.userId);
 const canRaise=live&&scoped&&['asha','clinician','supervisor'].includes(m.role),canResolve=live&&scoped&&m.role==='clinician';
 const open=disputes.filter(d=>!resolutionOf(v,d)),targets=disputeTargets(v).filter(t=>!open.some(d=>d.target===t));
 const raise=async()=>{const ok=await command({type:'raiseDispute',visitId:v.id,recordVersion:v.recordVersion,target,reason:reason.trim(),reference:reference.trim()},'Dispute raised. Sending of this item is blocked until a clinician resolves it.');if(ok){setRaising(false);setTarget('');setReason('');setReference('');}};
 const resolve=async(d:Dispute)=>{const ok=await command({type:'resolveDispute',visitId:v.id,recordVersion:v.recordVersion,disputeId:d.id,outcome,evidence:evidence.trim(),...(evRef.trim()?{reference:evRef.trim()}:{})},'Dispute resolved. The dispute and your evidence are kept.');if(ok){setResolving(null);setEvidence('');setEvRef('');setOutcome('stands');}};
 return <div className="notes-box" data-testid="disputes"><span>Disputes · an open dispute stops sending</span>
  {live&&open.length>0&&<div className="notice amber-notice" role="status" data-testid="dispute-block">Sending is blocked for {open.length} open dispute{open.length===1?'':'s'}: programme plans and EHR publications that would carry {open.length===1?'this item are':'these items are'} not prepared, approved or run until a clinician resolves {open.length===1?'it':'them'}.</div>}
  {!live&&<p className="muted text-sm">This visit was corrected or marked as wrong-patient. Its open disputes were carried to the correction draft, where they must be resolved.</p>}
  {disputes.length===0&&<p className="muted text-sm">No disputes on this visit.</p>}
  {disputes.map(d=>{const r=resolutionOf(v,d);
   return <div key={d.id} className="fact-review-row" data-testid="dispute-row"><p><strong>{name(v,d.target)}</strong>{d.valueText?`: ${d.valueText}`:''} · {r?'Resolved':live?'Open':'Carried to the correction'}</p>
    <p className="text-sm">Reason: {d.reason} · Reference: {d.reference} · Raised by {d.byName} ({d.role}), {when(d.at)}{d.carriedFrom?' · carried from the corrected visit':''}</p>
    {r&&<p className="text-sm">Resolved as {r.outcome==='stands'?'standing as recorded':'corrected'} by {r.byName}, {when(r.at)}: {r.evidence}{r.reference?` (reference: ${r.reference})`:''}. The dispute stays on the record.</p>}
    {!r&&canResolve&&resolving!==d.id&&<Button size="sm" variant="outline" disabled={busy} onClick={()=>{setResolving(d.id);setOutcome('stands');setEvidence('');setEvRef('');}}>Resolve this dispute</Button>}
    {!r&&canResolve&&resolving===d.id&&<form className="grid gap-2" onSubmit={e=>{e.preventDefault();void resolve(d);}}>
     <fieldset className="field"><legend>Outcome</legend><label className="inline-flex gap-2 items-center"><input type="radio" name={`outcome-${d.id}`} checked={outcome==='stands'} onChange={()=>setOutcome('stands')}/>The recorded value stands</label> <label className="inline-flex gap-2 items-center"><input type="radio" name={`outcome-${d.id}`} checked={outcome==='corrected'} onChange={()=>setOutcome('corrected')}/>It was corrected</label></fieldset>
     <p className="muted text-sm">{outcome==='stands'?'A clinician who did not record this item and did not raise the dispute confirms the recorded value, with evidence.':'Use this on a correction draft whose content has changed since the dispute was raised.'}</p>
     <label className="field"><span>Evidence for the resolution</span><Input value={evidence} onChange={e=>setEvidence(e.target.value)} minLength={10} maxLength={500} required/></label>
     <label className="field"><span>Reference (optional)</span><Input value={evRef} onChange={e=>setEvRef(e.target.value)} maxLength={200}/></label>
     <div className="flex flex-wrap gap-2"><Button type="submit" size="sm" disabled={busy||evidence.trim().length<10}>Record resolution</Button><Button type="button" size="sm" variant="ghost" onClick={()=>setResolving(null)}>Cancel</Button></div></form>}
   </div>;})}
  {canRaise&&!raising&&<Button size="sm" variant="outline" disabled={busy||!targets.length} onClick={()=>{setRaising(true);setTarget(targets[0]??'');}}>Raise a dispute</Button>}
  {canRaise&&raising&&<form className="grid gap-2" onSubmit={e=>{e.preventDefault();void raise();}}>
   <div className="field"><span id={`dispute-target-${v.id}`}>What is disputed</span><Select value={target} onValueChange={setTarget}><SelectTrigger aria-labelledby={`dispute-target-${v.id}`}><SelectValue placeholder="Choose an item"/></SelectTrigger><SelectContent>{targets.map(t=><SelectItem key={t} value={t}>{name(v,t)}</SelectItem>)}</SelectContent></Select></div>
   <label className="field"><span>Why is it disputed?</span><Input value={reason} onChange={e=>setReason(e.target.value)} minLength={10} maxLength={500} required/></label>
   <label className="field"><span>Reference: where the conflicting information comes from</span><Input value={reference} onChange={e=>setReference(e.target.value)} minLength={3} maxLength={200} required/></label>
   <div className="flex flex-wrap gap-2"><Button type="submit" size="sm" disabled={busy||!target||reason.trim().length<10||reference.trim().length<3}>Raise dispute</Button><Button type="button" size="sm" variant="ghost" onClick={()=>setRaising(false)}>Cancel</Button></div></form>}
  <p className="muted text-sm">Anything already sent to a programme or health record is not recalled by a dispute; it stops what has not been sent. A dispute recorded while verifying a measurement, note or answer is a clinician’s review and does not stop sending; raise a dispute here for that. {canRaise&&!canResolve&&open.length>0?'A clinician resolves disputes.':''}</p>
 </div>;
}
// Owner control: sign-off rules per programme and per destination. A destination rule wins; otherwise the most protective
// rule among the programmes the send concerns applies; otherwise the organisation default above (programme destinations only).
type Choice='inherit'|'required'|'not-required';
export function SignOffRulesPanel({data,busy,command}:{data:Snapshot;busy:boolean;command:Command}){
 const policy=data.signOffPolicy??{required:false,version:0},rules=policy.rules??{programmes:{},destinations:{}};
 const destinations=data.integrations.filter((i:Integration)=>i.kind==='mis'||i.kind==='ehr');
 const [prog,setProg]=useState<Record<string,Choice>>({}),[dest,setDest]=useState<Record<string,Choice>>({}),[reason,setReason]=useState('');
 if(!data.membership.isOwner)return null;
 const cur=(r:Record<string,string>,k:string):Choice=>(r[k] as Choice|undefined)??'inherit';
 const pick=(chosen:Record<string,Choice>,r:Record<string,string>,k:string)=>chosen[k]??cur(r,k);
 const changed=PROGRAMMES.some(k=>pick(prog,rules.programmes,k)!==cur(rules.programmes,k))||destinations.some(i=>pick(dest,rules.destinations,i.id)!==cur(rules.destinations,i.id));
 const save=async()=>{const programmes=Object.fromEntries(PROGRAMMES.map(k=>[k,pick(prog,rules.programmes,k)])),destinationRules=Object.fromEntries(destinations.map(i=>[i.id,pick(dest,rules.destinations,i.id)]));
  const ok=await command({type:'setSignOffRules',version:policy.version,programmes,destinations:destinationRules,reason:reason.trim()},'Sign-off rules saved');if(ok){setProg({});setDest({});setReason('');}};
 const select=(label:string,value:Choice,onChange:(c:Choice)=>void)=><div className="field" key={label}><span>{label}</span><Select value={value} onValueChange={x=>onChange(x as Choice)}><SelectTrigger aria-label={`Sign-off rule: ${label}`}><SelectValue/></SelectTrigger><SelectContent><SelectItem value="inherit">Follow the default</SelectItem><SelectItem value="required">Sign-off required</SelectItem><SelectItem value="not-required">Sign-off not required</SelectItem></SelectContent></Select></div>;
 return <section className="panel" aria-label="Sign-off rules per programme and destination" data-testid="sign-off-rules"><div className="section-heading"><div><h2>Sign-off rules per programme and destination</h2><p className="muted text-sm">Default: {policy.required?'required':'not required'} for programme destinations (version {policy.version}). A destination rule wins; otherwise, if any programme the send concerns requires sign-off, it is required; otherwise the default applies. The default never covered EHR publication, so an EHR connection needs its own or a programme rule. Rules apply to sends not yet made; nothing already sent is recalled.</p></div></div>
  <form className="grid gap-3" onSubmit={e=>{e.preventDefault();void save();}}>
   <fieldset className="grid gap-2"><legend className="font-medium">By programme</legend><div className="grid gap-2 sm:grid-cols-2">{PROGRAMMES.map(k=>select(k,pick(prog,rules.programmes,k),c=>setProg({...prog,[k]:c})))}</div></fieldset>
   <fieldset className="grid gap-2"><legend className="font-medium">By destination</legend>{destinations.length===0?<p className="muted text-sm">No programme or EHR connections yet.</p>:<div className="grid gap-2 sm:grid-cols-2">{destinations.map(i=>select(`${i.name} (${i.kind==='ehr'?'EHR':'programme'})`,pick(dest,rules.destinations,i.id),c=>setDest({...dest,[i.id]:c})))}</div>}</fieldset>
   <label className="field"><span>Reason for the change</span><Input value={reason} onChange={e=>setReason(e.target.value)} minLength={10} maxLength={500} required/></label>
   <div><Button type="submit" size="sm" disabled={busy||!changed||reason.trim().length<10}>Save sign-off rules</Button></div>
  </form></section>;
}
