'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { Person, Snapshot } from '@/lib/saha/types';
import type { ConsentEvent, ConsentPurpose, Disposition } from '@/lib/saha/consent';
import { consentStanding, noticeInForce, type NoticeLanguage } from '@/lib/saha/core';
import { AUTHORITY_LABEL } from '@/lib/saha/household-constants';
import { useI18n } from './i18n';
import { Checkbox } from '@/components/ui/checkbox';
import { EventTerms } from './consent-terms-panel';
type Command=(c:any,s?:string)=>Promise<any>;
// Slice 6o: permission withdrawal with its downstream record, and the patient's consent history.
const LABEL:Record<ConsentPurpose,string>={ai:'Optional AI assistance',exchange:'External record sharing',contact:'Automated contact'};
const NOTICE_LANGUAGE:Record<NoticeLanguage,string>={en:'English',hi:'Hindi'};
const DISPOSITION:Record<Disposition,string>={stopped:'stopped','in-flight':'awaiting receipt','already-sent':'already sent, not recalled',kept:'kept'};
const CHANNEL:Record<string,string>={'in-person':'in person',phone:'by phone',written:'in writing',switch:'with the permission switch','contact-preferences':'with contact preferences'};
const current=(p:Person,x:ConsentPurpose)=>x==='ai'?p.aiConsent:x==='exchange'?p.exchangeConsent:!!p.contactPreferences?.permission;
function Pick({label,value,set,items}:{label:string;value:string;set:(s:string)=>void;items:[string,string][]}){return <Select value={value} onValueChange={set}><SelectTrigger aria-label={label}><SelectValue placeholder={label}/></SelectTrigger><SelectContent>{items.map(([id,name])=><SelectItem key={id} value={id}>{name}</SelectItem>)}</SelectContent></Select>}
// Slice 14b: a representative is named only when their own record is in the viewer's list (slice 6r); otherwise the
// relationship, authority and record reference are shown.
const who=(data:Snapshot,id:string)=>data.people.find(q=>q.id===id)?.name??`Representative (record ${id.slice(0,8)}, outside your list)`;
const repText=(data:Snapshot,r:NonNullable<ConsentEvent['representative']>)=>`${who(data,r.proxyPersonId)} · ${r.relationship.replace(/-/g,' ')} · ${AUTHORITY_LABEL[r.authority]} · grant until ${r.expiresAt.slice(0,10)}`;
function EventCard({e,data}:{e:ConsentEvent;data:Snapshot}){
 return <li className="stack-form merge-case"><strong>{LABEL[e.purpose]} {e.action}</strong> <span className="muted">· {new Date(e.at).toLocaleString()} · {e.byName} ({e.role}) · recorded {CHANNEL[e.channel]??e.channel}{e.reference?` · reference ${e.reference}`:''} · version {e.fromVersion} to {e.toVersion}</span>
  {e.decidedBy&&<p className="muted">Decided by {e.representative?repText(data,e.representative):'the patient'}</p>}
  {e.reason&&<p className="muted">{e.reason}</p>}
  <EventTerms e={e}/>
  {e.items.length>0?<ul className="revision-list">{e.items.map(i=><li key={i.kind+i.ref}>{i.detail} <span className="tag">{DISPOSITION[i.disposition]}</span></li>)}</ul>:e.action==='withdrawn'&&<p className="muted">Nothing was waiting on this permission.</p>}
  {!!e.omitted&&<p className="muted">{e.omitted} further items are in the audit record and patient revision history.</p>}
 </li>;
}
// Shown on the patient screen while a withdrawal left deliveries without a confirmed outcome.
export function ConsentNotice({p}:{p:Person}){
 const {n}=useI18n(),open=(p.consentHistory??[]).filter(e=>e.action==='withdrawn').flatMap(e=>e.items).filter(i=>i.disposition==='in-flight').length;
 return open?<div className="notice amber-notice" role="status">{n('patient.consentWithdrawn',open)}</div>:null;
}
export function ConsentPatient({data,p,busy,command}:{data:Snapshot;p:Person;busy:boolean;command:Command}){
 const [open,setOpen]=useState(false),[purpose,setPurpose]=useState(''),[channel,setChannel]=useState('in-person'),[reference,setReference]=useState(''),[reason,setReason]=useState(''),[decider,setDecider]=useState('self'),[givePurpose,setGivePurpose]=useState(''),[giveBy,setGiveBy]=useState(''),[giveLang,setGiveLang]=useState<NoticeLanguage|''>(''),[giveShown,setGiveShown]=useState(false);
 const care=['asha','clinician'].includes(data.role),active=(['ai','exchange','contact'] as ConsentPurpose[]).filter(x=>current(p,x)),history=[...(p.consentHistory??[])].reverse();
 // Slice 14b: grants that look in force for consent decisions. The server checks each one again (authority, age, capacity) when used.
 const now=new Date().toISOString(),reps=(p.proxies??[]).filter(g=>!g.revokedAt&&g.authority&&g.from<=now&&g.expiresAt>now&&g.purposes.includes('consent-decisions'));
 const repItems:[string,string][]=reps.map(g=>[g.id,`${who(data,g.proxyPersonId)} · ${g.relationship.replace(/-/g,' ')} · ${AUTHORITY_LABEL[g.authority!]}`]);
 const representative=(id:string)=>{const g=reps.find(x=>x.id===id);return g?{representative:{grantId:g.id,proxyPersonId:g.proxyPersonId}}:{};};
 const lacks=p.capacity?.at(-1)?.state==='lacks-capacity',list=data.consentNotices??[],givable=(['ai','exchange'] as ConsentPurpose[]).filter(x=>consentStanding(p,x,now,list).state!=='in-force');
 // Integration 14 (14b with 14d): a representative's permission is given under the notice in force, as the person's own is. The form shows the notice, the language it was shown in and what was read; the command names both (the server refuses a missing or stale notice).
 const giveNotice=givePurpose==='ai'||givePurpose==='exchange'?noticeInForce(list,givePurpose,now):null;
 const pickPurpose=(x:string)=>{setGivePurpose(x);setGiveShown(false);const n=x==='ai'||x==='exchange'?noticeInForce(list,x,now):null;setGiveLang(n?(n.texts.en?'en':'hi'):'');};
 const submit=async()=>{const r=await command({type:'withdrawConsent',personId:p.id,version:p.version,purpose,channel,reference,reason,...(decider==='self'?{}:representative(decider))},'Permission withdrawn. Downstream work recorded.');if(r){setPurpose('');setReference('');setReason('');setDecider('self');}};
 const give=async()=>{const r=await command({type:'setConsent',personId:p.id,purpose:givePurpose,active:true,version:p.version,...(giveNotice&&giveLang?{notice:{id:giveNotice.id,language:giveLang}}:{}),...representative(giveBy)},'Permission recorded as decided by the representative.');if(r){setGivePurpose('');setGiveBy('');setGiveLang('');setGiveShown(false);}};
 return <><Button variant="outline" onClick={()=>setOpen(true)}>Consent history</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="wide-dialog"><DialogHeader><DialogTitle>Consent history · {p.name}</DialogTitle><DialogDescription>Withdrawing a permission stops unsent work that depends on it and lists what already left Saha. Nothing already shared is recalled or erased by Saha.</DialogDescription></DialogHeader>
  <ul className="revision-list">{(['ai','exchange','contact'] as ConsentPurpose[]).map(x=><li key={x}>{LABEL[x]}: <span className="tag">{current(p,x)?'permitted':'not permitted'}</span></li>)}</ul>
  {care&&active.length>0&&<section className="stack-form"><h3>Record a withdrawal</h3><div className="form-grid"><Pick label="Permission" value={purpose} set={setPurpose} items={active.map(x=>[x,LABEL[x]])}/><Pick label="Received" value={channel} set={setChannel} items={[['in-person','In person'],['phone','By phone'],['written','In writing']]}/><Pick label="Decided by" value={decider} set={setDecider} items={[['self','The patient'],...repItems]}/><Input aria-label="Reference" placeholder="Reference, e.g. form or call note" value={reference} onChange={e=>setReference(e.target.value)}/></div><Input aria-label="What the patient said" placeholder="What the patient asked for" value={reason} onChange={e=>setReason(e.target.value)}/><Button disabled={busy||!purpose||reference.trim().length<3||reason.trim().length<10} onClick={submit}>Withdraw permission</Button></section>}
  {care&&<section className="stack-form"><h3>Record a permission given by a representative</h3>{lacks&&<p className="notice amber-notice">{p.name} is recorded as lacking capacity to decide. A permission must be given by a representative whose grant covers consent decisions.</p>}{!repItems.length?<p className="muted">No representative grant covering consent decisions is in force. Record one under Household & proxies.</p>:!givable.length?<p className="muted">Both permissions are already given and in force.</p>:<><div className="form-grid"><Pick label="Permission to give" value={givePurpose} set={pickPurpose} items={givable.map(x=>[x,LABEL[x]])}/><Pick label="Representative" value={giveBy} set={setGiveBy} items={repItems}/></div>{giveNotice&&<div data-testid="representative-notice"><p className="text-sm"><strong>Notice version {giveNotice.version}</strong> · in force since {giveNotice.effectiveFrom.slice(0,10)}</p><Pick label="Language the notice was shown in" value={giveLang} set={v=>{setGiveLang(v as NoticeLanguage);setGiveShown(false);}} items={(Object.keys(giveNotice.texts) as NoticeLanguage[]).map(l=>[l,NOTICE_LANGUAGE[l]] as [string,string])}/>{giveLang&&<div className="notes-box" lang={giveLang}><p>{giveNotice.texts[giveLang]}</p></div>}<label className="check-label"><Checkbox checked={giveShown} onCheckedChange={v=>setGiveShown(!!v)}/>I showed or read this notice to the representative in {giveLang?NOTICE_LANGUAGE[giveLang]:'the chosen language'}, and they agreed on the person's behalf.</label></div>}<Button variant="outline" disabled={busy||!givePurpose||!giveBy||(!!giveNotice&&(!giveLang||!giveShown))} onClick={give}>Record representative's permission</Button></>}</section>}
  <h3>History</h3>{history.length?<ul className="revision-list">{history.map(e=><EventCard key={e.id} e={e} data={data}/>)}</ul>:<p className="muted">No permission changes recorded since consent history began. Earlier changes are in the activity log.</p>}
 </DialogContent></Dialog></>;
}
