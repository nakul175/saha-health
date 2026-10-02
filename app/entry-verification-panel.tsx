'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authorText, entryAuthor, entryKeys, entryReview, reviewText, signOffText } from '@/lib/saha/fact-provenance';
import { own } from '@/lib/saha/programmes';
import type { Person, Snapshot, Visit } from '@/lib/saha/types';
type Command=(c:any,s?:string)=>Promise<any>;
// Slice 2g: who recorded the visit notes and each programme answer, and their clinician verification (BR-DATA-02).
// The server sets authors from the authenticated identity and checks role, care scope and state for every review.
const label=(v:Visit,entry:string)=>entry==='notes'?'Visit notes':v.programmeCapture?.packs.flatMap(x=>x.pack.questions).find(q=>q.id===entry.slice(7))?.label??entry.slice(7);
const value=(v:Visit,entry:string)=>{if(entry==='notes')return '';const k=entry.slice(7),a=own(v.programmeCapture?.answers,k),r=own(v.programmeCapture?.absence,k);return a?`: ${a}`:r?`: ${r} (absence reason)`:'';};
export function EntryVerificationPanel({v,data,busy,command}:{v:Visit;data:Snapshot;busy:boolean;command:Command}){
 const [disputing,setDisputing]=useState<string|null>(null),[reason,setReason]=useState('');
 const entries=entryKeys(v);if(!entries.length)return null;
 const canReview=data.role==='clinician'&&v.state==='confirmed'&&!v.voidedAt&&!v.supersededBy;
 const send=async(entry:string,decision:'verified'|'disputed')=>{const ok=await command({type:'verifyEntry',visitId:v.id,recordVersion:v.recordVersion,entry,decision,...(decision==='disputed'?{reason:reason.trim()}:{})},`${label(v,entry)} ${decision}`);if(ok){setDisputing(null);setReason('');}};
 return <div className="notes-box fact-verification" data-testid="entry-verification"><span>Who recorded the notes and programme answers · verification</span>
  {entries.map(e=>{const a=entryAuthor(v,e),r=entryReview(v,e),own=a?.userId===data.user.userId,name=label(v,e);
   return <div key={e} className="fact-review-row"><p><strong>{name}</strong>{value(v,e)} · Recorded by: {authorText(a)} · Verification: {reviewText(r)}</p>
    {canReview&&!own&&<div className="flex flex-wrap gap-2">{r?.state!=='verified'&&<Button size="sm" variant="outline" disabled={busy} onClick={()=>void send(e,'verified')}>Verify {name.toLowerCase()}</Button>}{r?.state!=='disputed'&&disputing!==e&&<Button size="sm" variant="outline" disabled={busy} onClick={()=>{setDisputing(e);setReason('');}}>Dispute {name.toLowerCase()}</Button>}</div>}
    {disputing===e&&<form className="flex flex-wrap gap-2 items-end" onSubmit={ev=>{ev.preventDefault();void send(e,'disputed');}}><label className="field grow"><span>Why is this disputed?</span><Input value={reason} onChange={ev=>setReason(ev.target.value)} minLength={10} maxLength={500} required/></label><Button type="submit" size="sm" disabled={busy||reason.trim().length<10}>Record dispute</Button><Button type="button" size="sm" variant="ghost" onClick={()=>setDisputing(null)}>Cancel</Button></form>}
   </div>;})}
  {canReview&&entries.some(e=>entryAuthor(v,e)?.userId===data.user.userId)&&<p className="muted text-sm">A different clinician must verify or dispute entries you recorded.</p>}
  {v.state!=='confirmed'&&<p className="muted text-sm">Notes and answers can be verified after the visit is confirmed.</p>}
 </div>;
}
// Supervisor sign-off of a confirmed visit before its programme submissions are sent. Display only; the server decides.
// Slice 10g: a supervisor can withdraw a current sign-off (with a reason); sending is then held until a supervisor signs the
// visit off again. The sign-off rules per programme and destination are set by the owner (SignOffRulesPanel).
export function SignOffPanel({v,person:p,data,busy,command}:{v:Visit;person:Person;data:Snapshot;busy:boolean;command:Command}){
 const [note,setNote]=useState(''),[reason,setReason]=useState(''),[withdrawing,setWithdrawing]=useState(false);const policy=data.signOffPolicy,last=v.signOffs?.at(-1),m=data.membership;
 const withdrawal=last?(v.signOffWithdrawals??[]).find(w=>w.signOffId===last.id):undefined,live=v.state==='confirmed'&&!v.voidedAt&&!v.supersededBy;
 const fresh=!!last&&last.visitVersion===v.version&&live&&!withdrawal;
 const ruled=Object.keys(policy?.rules?.programmes??{}).length+Object.keys(policy?.rules?.destinations??{}).length>0;
 if(!policy?.required&&!ruled&&!v.signOffs?.length)return null;
 const supervisor=m.role!=='admin'&&((m.role==='supervisor'||m.isOwner)&&m.teamIds.includes(p.teamId)||(data.delegatedAuthority??[]).some(d=>d.kind==='team-supervision'&&d.teamIds.includes(p.teamId)));
 const recorder=[v.patientCheck?.by,v.noteAuthor?.userId,...Object.values(v.answerAuthors??{}).map(a=>a.userId),...Object.values(v.factAuthors??{}).map(a=>a?.userId)].includes(data.user.userId);
 return <div className="notes-box" data-testid="sign-off"><span>Supervisor sign-off before sending · {policy?.required?'required by default for programme destinations':'not required by default'}{ruled?'; rules for some programmes or destinations apply':''}</span>
  <p>{fresh?<>Current: {signOffText(last)}{last?.note?` — ${last.note}`:''}</>:withdrawal?<>Withdrawn: the sign-off by {last?.byName} was withdrawn by {withdrawal.byName} ({withdrawal.at.slice(0,16).replace('T',' ')} UTC): {withdrawal.reason}. The sign-off record is kept.</>:last?<>Earlier sign-off is no longer current ({signOffText(last)}): the visit changed afterwards.</>:'Not signed off yet.'}</p>
  {withdrawal&&<p className="muted text-sm" data-testid="sign-off-hold">Sending of this visit to programmes and health records is held until a supervisor of the patient’s team signs it off again, whatever the sign-off rules say.</p>}
  {(policy?.required||ruled)&&!fresh&&!withdrawal&&<p className="muted text-sm">Where a rule requires sign-off, programme submissions and EHR publications for this visit cannot be sent until a supervisor of the patient’s team signs it off.</p>}
  {supervisor&&fresh&&!withdrawing&&<Button size="sm" variant="outline" disabled={busy} onClick={()=>{setWithdrawing(true);setReason('');}}>Withdraw sign-off</Button>}
  {supervisor&&fresh&&withdrawing&&<form className="flex flex-wrap gap-2 items-end" onSubmit={e=>{e.preventDefault();void command({type:'withdrawSignOff',visitId:v.id,recordVersion:v.recordVersion,reason:reason.trim()},'Sign-off withdrawn. Sending is held.').then(ok=>{if(ok){setWithdrawing(false);setReason('');}});}}><label className="field grow"><span>Why is the sign-off withdrawn?</span><Input value={reason} onChange={e=>setReason(e.target.value)} minLength={10} maxLength={500} required/></label><Button type="submit" size="sm" disabled={busy||reason.trim().length<10}>Withdraw and hold sending</Button><Button type="button" size="sm" variant="ghost" onClick={()=>setWithdrawing(false)}>Cancel</Button></form>}
  {fresh&&supervisor&&<p className="muted text-sm">Withdrawing stops sending that has not happened yet. Anything already sent is not recalled.</p>}
  {supervisor&&!fresh&&live&&(recorder?<p className="muted text-sm">A different supervisor must sign off a visit you confirmed or recorded.</p>:<form className="flex flex-wrap gap-2 items-end" onSubmit={e=>{e.preventDefault();void command({type:'signOffVisit',visitId:v.id,recordVersion:v.recordVersion,...(note.trim()?{note:note.trim()}:{})},'Visit signed off for sending').then(ok=>{if(ok)setNote('');});}}><label className="field grow"><span>Sign-off note (optional)</span><Input value={note} onChange={e=>setNote(e.target.value)} maxLength={500}/></label><Button type="submit" size="sm" disabled={busy}>Sign off for sending</Button></form>)}
 </div>;
}
// Owner control: whether this organisation requires supervisor sign-off before programme submissions are sent.
export function SignOffPolicyPanel({data,busy,command}:{data:Snapshot;busy:boolean;command:Command}){
 const [reason,setReason]=useState('');const policy=data.signOffPolicy??{required:false,version:0};if(!data.membership.isOwner)return null;
 return <section className="panel" aria-label="Supervisor sign-off policy" data-testid="sign-off-policy"><div className="section-heading"><div><h2>Supervisor sign-off before sending: organisation default</h2><p className="muted text-sm">{policy.required?'Required: a supervisor of the patient’s team (or a supervision delegate) must sign off each confirmed visit before its programme submissions are sent.':'Not required: workers send approved programme submissions without a supervisor sign-off.'}</p></div></div>
  <form className="flex flex-wrap gap-2 items-end" onSubmit={e=>{e.preventDefault();void command({type:'setSignOffPolicy',required:!policy.required,version:policy.version,reason:reason.trim()},policy.required?'Sign-off no longer required':'Sign-off now required').then(ok=>{if(ok)setReason('');});}}><label className="field grow"><span>Reason for the change</span><Input value={reason} onChange={e=>setReason(e.target.value)} minLength={10} maxLength={500} required/></label><Button type="submit" size="sm" disabled={busy||reason.trim().length<10}>{policy.required?'Stop requiring sign-off':'Require sign-off'}</Button></form>
 </section>;
}
