'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { Person, Snapshot } from '@/lib/saha/types';
import type { NoticeHolder, NoticeState, WithdrawalNotice } from '@/lib/saha/withdrawal-notices';
type Command=(c:any,s?:string)=>Promise<any>;
// Slice 14e (R91): the notices that tell each destination holding a person's records that the sharing permission was
// withdrawn, with the outcome per destination. English only.
const NOTICE_OPEN:NoticeState[]=['due','uncertain','manual'],noticesOf=(p:Person)=>(p as NoticeHolder).withdrawalNotices??[];
const STATE:Record<string,string>={due:'not yet sent',uncertain:'sent, outcome unknown',acknowledged:'acknowledged',recorded:'recorded with the gateway',manual:'tell by hand',told:'told by hand','not-required':'not required'};
const HOLD:Record<string,string>={'programme-submission':'submission','ehr-publication':'EHR publication','abdm-consent':'consent artefact','abdm-care-context':'care context','abdm-transfer':'records delivered'};
function NoticeCard({n,p,care,busy,command}:{n:WithdrawalNotice;p:Person;care:boolean;busy:boolean;command:Command}){
 const [reference,setReference]=useState(''),[note,setNote]=useState(''),ok=reference.trim().length>=3&&note.trim().length>=10;
 const base={personId:p.id,noticeId:n.id,version:n.version};
 const record=async(outcome:'told'|'not-required')=>{const r=await command({type:'recordWithdrawalNotice',...base,outcome,reference,note},outcome==='told'?'Recorded as told.':'Recorded as not required.');if(r){setReference('');setNote('');}};
 return <li className="stack-form merge-case"><strong>{n.destination.name}</strong> <span className={`tag ${NOTICE_OPEN.includes(n.state)?'amber':''}`}>{STATE[n.state]??n.state}</span> <span className="muted">· withdrawn {new Date(n.withdrawnAt).toLocaleString()} · permission version {n.permissionVersion}</span>
  <p>{n.message}</p>
  <p className="muted text-sm">Holds: {n.holds.map(h=>`${HOLD[h.kind]??h.kind} ${h.ref.slice(0,8)} (${h.state}${h.receipt?`, receipt ${h.receipt}`:''})`).join('; ')}{n.omittedHolds?`; and ${n.omittedHolds} more`:''}</p>
  {n.receipt&&<p className="muted text-sm">Destination receipt {n.receipt} · sent {n.attempts} time{n.attempts===1?'':'s'}{n.lookups?` · looked up ${n.lookups} time${n.lookups===1?'':'s'}`:''}</p>}
  {n.outcome&&<p className="muted text-sm">Recorded by {n.outcome.byName} on {new Date(n.outcome.at).toLocaleString()} · reference {n.outcome.reference}: {n.outcome.note}</p>}
  {care&&n.state==='due'&&n.payload&&<details><summary>Message to send (no record content)</summary><pre className="text-sm">{JSON.stringify(n.payload,null,2)}</pre></details>}
  {care&&<div className="button-row">
   {n.state==='due'&&n.path==='simulator'&&<Button size="sm" disabled={busy} onClick={()=>command({type:'sendWithdrawalNotice',...base},'Withdrawal notice sent.')}>Send this notice</Button>}
   {n.state==='uncertain'&&<Button size="sm" variant="outline" disabled={busy} onClick={()=>command({type:'lookupWithdrawalNotice',...base},'Receipt lookup recorded.')}>Look up receipt</Button>}
  </div>}
  {care&&(n.state==='manual'||n.state==='due')&&<div className="form-grid"><Input aria-label={`Reference for ${n.destination.name}`} placeholder="Reference, e.g. letter or call note" value={reference} onChange={e=>setReference(e.target.value)}/><Input aria-label={`Note for ${n.destination.name}`} placeholder="How and when the destination was told, or why it is not needed" value={note} onChange={e=>setNote(e.target.value)}/>
   {n.state==='manual'&&<Button size="sm" variant="outline" disabled={busy||!ok} onClick={()=>record('told')}>Record as told</Button>}<Button size="sm" variant="outline" disabled={busy||!ok} onClick={()=>record('not-required')}>Not required</Button></div>}
 </li>;
}
export function WithdrawalNoticesPatient({data,p,busy,command}:{data:Snapshot;p:Person;busy:boolean;command:Command}){
 const [open,setOpen]=useState(false),notices=[...noticesOf(p)].reverse(),pending=notices.filter(n=>NOTICE_OPEN.includes(n.state)).length;
 if(!notices.length)return null;
 const care=['asha','clinician'].includes(data.role);
 return <><Button variant="outline" onClick={()=>setOpen(true)}>Withdrawal notices{pending?` (${pending} open)`:''}</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="wide-dialog"><DialogHeader><DialogTitle>Withdrawal notices · {p.name}</DialogTitle><DialogDescription>Each destination that holds this person&apos;s records is told that the sharing permission was withdrawn. Saha does not recall or erase what a destination already holds; it records each destination&apos;s answer, and an unknown outcome is looked up, never sent again.</DialogDescription></DialogHeader>
  <ul className="revision-list">{notices.map(n=><NoticeCard key={n.id} n={n} p={p} care={care} busy={busy} command={command}/>)}</ul>
 </DialogContent></Dialog></>;
}
