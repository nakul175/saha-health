'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { Person, Snapshot } from '@/lib/saha/types';
import type { ConsentEvent, ConsentPurpose, Disposition } from '@/lib/saha/consent';
type Command=(c:any,s?:string)=>Promise<any>;
// Slice 6o: permission withdrawal with its downstream record, and the patient's consent history.
const LABEL:Record<ConsentPurpose,string>={ai:'Optional AI assistance',exchange:'External record sharing',contact:'Automated contact'};
const DISPOSITION:Record<Disposition,string>={stopped:'stopped','in-flight':'awaiting receipt','already-sent':'already sent, not recalled',kept:'kept'};
const CHANNEL:Record<string,string>={'in-person':'in person',phone:'by phone',written:'in writing',switch:'with the permission switch','contact-preferences':'with contact preferences'};
const current=(p:Person,x:ConsentPurpose)=>x==='ai'?p.aiConsent:x==='exchange'?p.exchangeConsent:!!p.contactPreferences?.permission;
function Pick({label,value,set,items}:{label:string;value:string;set:(s:string)=>void;items:[string,string][]}){return <Select value={value} onValueChange={set}><SelectTrigger aria-label={label}><SelectValue placeholder={label}/></SelectTrigger><SelectContent>{items.map(([id,name])=><SelectItem key={id} value={id}>{name}</SelectItem>)}</SelectContent></Select>}
function EventCard({e}:{e:ConsentEvent}){
 return <li className="stack-form merge-case"><strong>{LABEL[e.purpose]} {e.action}</strong> <span className="muted">· {new Date(e.at).toLocaleString()} · {e.byName} ({e.role}) · recorded {CHANNEL[e.channel]??e.channel}{e.reference?` · reference ${e.reference}`:''} · version {e.fromVersion} to {e.toVersion}</span>
  {e.reason&&<p className="muted">{e.reason}</p>}
  {e.items.length>0?<ul className="revision-list">{e.items.map(i=><li key={i.kind+i.ref}>{i.detail} <span className="tag">{DISPOSITION[i.disposition]}</span></li>)}</ul>:e.action==='withdrawn'&&<p className="muted">Nothing was waiting on this permission.</p>}
  {!!e.omitted&&<p className="muted">{e.omitted} further items are in the audit record and patient revision history.</p>}
 </li>;
}
// Shown on the patient screen while a withdrawal left deliveries without a confirmed outcome.
export function ConsentNotice({p}:{p:Person}){
 const open=(p.consentHistory??[]).filter(e=>e.action==='withdrawn').flatMap(e=>e.items).filter(i=>i.disposition==='in-flight').length;
 return open?<div className="notice amber-notice" role="status">A permission was withdrawn while {open} {open===1?'delivery was':'deliveries were'} awaiting a receipt. Look up each receipt; nothing is resent under the withdrawn permission.</div>:null;
}
export function ConsentPatient({data,p,busy,command}:{data:Snapshot;p:Person;busy:boolean;command:Command}){
 const [open,setOpen]=useState(false),[purpose,setPurpose]=useState(''),[channel,setChannel]=useState('in-person'),[reference,setReference]=useState(''),[reason,setReason]=useState('');
 const care=['asha','clinician'].includes(data.role),active=(['ai','exchange','contact'] as ConsentPurpose[]).filter(x=>current(p,x)),history=[...(p.consentHistory??[])].reverse();
 const submit=async()=>{const r=await command({type:'withdrawConsent',personId:p.id,version:p.version,purpose,channel,reference,reason},'Permission withdrawn. Downstream work recorded.');if(r){setPurpose('');setReference('');setReason('');}};
 return <><Button variant="outline" onClick={()=>setOpen(true)}>Consent history</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="wide-dialog"><DialogHeader><DialogTitle>Consent history · {p.name}</DialogTitle><DialogDescription>Withdrawing a permission stops unsent work that depends on it and lists what already left Saha. Nothing already shared is recalled or erased by Saha.</DialogDescription></DialogHeader>
  <ul className="revision-list">{(['ai','exchange','contact'] as ConsentPurpose[]).map(x=><li key={x}>{LABEL[x]}: <span className="tag">{current(p,x)?'permitted':'not permitted'}</span></li>)}</ul>
  {care&&active.length>0&&<section className="stack-form"><h3>Record a withdrawal</h3><div className="form-grid"><Pick label="Permission" value={purpose} set={setPurpose} items={active.map(x=>[x,LABEL[x]])}/><Pick label="Received" value={channel} set={setChannel} items={[['in-person','In person'],['phone','By phone'],['written','In writing']]}/><Input aria-label="Reference" placeholder="Reference, e.g. form or call note" value={reference} onChange={e=>setReference(e.target.value)}/></div><Input aria-label="What the patient said" placeholder="What the patient asked for" value={reason} onChange={e=>setReason(e.target.value)}/><Button disabled={busy||!purpose||reference.trim().length<3||reason.trim().length<10} onClick={submit}>Withdraw permission</Button></section>}
  <h3>History</h3>{history.length?<ul className="revision-list">{history.map(e=><EventCard key={e.id} e={e}/>)}</ul>:<p className="muted">No permission changes recorded since consent history began. Earlier changes are in the activity log.</p>}
 </DialogContent></Dialog></>;
}
