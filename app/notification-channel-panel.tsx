'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BellRing, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from '@/components/ui/table';
import type { Snapshot } from '@/lib/saha/types';
type Command=(c:any,s?:string)=>Promise<any>;
type Row={on:boolean;tier:string;channel:string;kinds:string[]};
// Short names for the alert kinds an owner chooses between (the full alert text is on the Operations page).
const KIND:Record<string,string>={'destination-uncertain':'Programme submissions not confirmed','ehr-uncertain':'EHR publications not confirmed','referrals-overdue':'Referrals past due','followups-overdue':'Follow-ups past due','referrals-undated':'Referrals without a due date','provider-usage-missing':'Provider calls without usage','server-errors':'Server error rate','incident-critical-open':'Critical incidents open','incident-open':'Other incidents open',maintenance:'Organisation paused','ai-budget-reached':'AI budget reached','ai-budget-near':'AI budget near','ai-invoice-variance':'AI invoice differs from estimate','ai-invoice-unreconciled':'AI invoice not reconciled'};
const when=(v:string)=>new Date(v).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'});
function Choice({value,onChange,items,label,disabled}:{value:string;onChange:(v:string)=>void;items:{value:string;label:string}[];label:string;disabled?:boolean}){return <Select value={value} onValueChange={onChange} disabled={disabled}><SelectTrigger aria-label={label}><SelectValue/></SelectTrigger><SelectContent>{items.map(x=><SelectItem key={x.value} value={x.value}>{x.label}</SelectItem>)}</SelectContent></Select>}
// Slice 10b: owners manage who receives out-of-app messages for operational alerts, in which tier and by which channel, how long an
// alert may stay unacknowledged before the next tier is told, and read the message log. Demonstration simulator only: recipients hold no contact
// details and nothing leaves Saha; the server refuses the channel outside the synthetic and training environments.
export function NotificationChannelPanel({data,busy,command}:{data:Snapshot;busy:boolean;command:Command}){
 const [value,setValue]=useState<any>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[enabled,setEnabled]=useState(false),[minutes,setMinutes]=useState('30'),[rows,setRows]=useState<Record<string,Row>>({}),[reason,setReason]=useState('');
 const serial=useRef(0),owner=!!data.canManage;
 const load=useCallback(async()=>{if(!owner)return;const sequence=++serial.current;setLoading(true);try{const r=await fetch('/api/notification-channel',{headers:{'x-saha-organisation':data.organisation.id},cache:'no-store'});const j:any=await r.json();if(sequence!==serial.current)return;if(!r.ok)throw Error(j.error);setValue(j);setError('');}catch(e){if(sequence===serial.current)setError(e instanceof Error?e.message:'Could not load the notification channel.');}finally{if(sequence===serial.current)setLoading(false);}},[owner,data.organisation.id,data.organisation.revision]);
 useEffect(()=>{void load();return()=>{serial.current++;};},[load]);
 // A newer saved setting (here or by another owner) resets the form.
 useEffect(()=>{if(!value)return;const c=value.channel;setEnabled(c.enabled);setMinutes(String(c.escalateAfterMinutes));setRows(Object.fromEntries(c.recipients.map((r:any)=>[r.userId,{on:true,tier:String(r.tier),channel:r.channel,kinds:r.kinds}])));},[value?.channel.version]);
 if(!owner)return null;
 const members:any[]=value?.members??[],chosen=members.filter(m=>rows[m.userId]?.on),stored=value?.channel;
 const patch=(id:string,p:Partial<Row>)=>setRows(r=>({...r,[id]:{...(r[id]??{on:false,tier:'1',channel:'sms',kinds:[]}),...p}}));
 const save=async(e:React.FormEvent)=>{e.preventDefault();const r=await command({type:'setNotificationChannel',version:stored.version,enabled,escalateAfterMinutes:Number(minutes),recipients:chosen.map(m=>({userId:m.userId,tier:Number(rows[m.userId].tier),channel:rows[m.userId].channel,kinds:m.kinds.filter((k:string)=>rows[m.userId].kinds.includes(k))})),reason},'Notification channel saved');if(r){setReason('');await load();}};
 const invalid=!(Number(minutes)>=(value?.rules.escalateMinutes.min??5)&&Number(minutes)<=(value?.rules.escalateMinutes.max??1440))||reason.trim().length<5||(enabled&&!chosen.length)||chosen.some(m=>!rows[m.userId].kinds.length);
 return <section className="panel member-panel notification-channel" aria-labelledby="notification-channel-heading"><div className="section-heading"><h2 id="notification-channel-heading"><BellRing size={19}/> Out-of-app notifications</h2><span className="muted text-sm">Owners only · demonstration simulator</span></div>
  <div className="grid gap-3 px-6 pb-5">
   <p className="notice">{value?.rules.notice??'Demonstration simulator. Messages are stored and shown inside Saha. Nothing is sent to any email address or phone number.'}</p>
   {value&&!value.available&&<p className="notice amber-notice" role="status">{value.refusal}</p>}
   {error&&<p className="notice amber-notice" role="alert">{error}</p>}
   {loading&&!value&&<p role="status">Loading the notification channel…</p>}
   {value&&<>
    <form className="form-stack" onSubmit={save}>
     <label className="check-label"><Checkbox aria-label="Send out-of-app notifications" checked={enabled} disabled={busy||!value.available} onCheckedChange={on=>setEnabled(on===true)}/>Send simulated messages for operational alerts (setting version {stored.version}{stored.setAt?` · saved ${when(stored.setAt)}${stored.setByName?` by ${stored.setByName}`:''}`:' · not set up yet'})</label>
     <label className="field"><span>Escalate to the next tier when an alert is not acknowledged within (minutes, {value.rules.escalateMinutes.min} to {value.rules.escalateMinutes.max})</span><Input type="number" inputMode="numeric" min={value.rules.escalateMinutes.min} max={value.rules.escalateMinutes.max} value={minutes} onChange={e=>setMinutes(e.target.value)} disabled={busy||!value.available} required/></label>
     <fieldset className="notification-recipients"><legend>Recipients (up to {value.rules.maxRecipients}). Tier 1 is told first; each further tier is told after another interval, and only while the alert stays unacknowledged.</legend>
      {members.length?<ul className="adapter-ops-list">{members.map(m=>{const r=rows[m.userId];return <li key={m.userId} className="notification-recipient">
       <label className="check-label"><Checkbox aria-label={`Include ${m.displayName}`} checked={!!r?.on} disabled={busy||!value.available} onCheckedChange={on=>patch(m.userId,{on:on===true,...(on===true&&!r?.kinds.length?{kinds:m.kinds}:{})})}/>{m.displayName} <span className="muted">· {m.role}{m.isOwner?' · owner':''}</span></label>
       {r?.on&&<div className="notification-recipient-detail">
        <Choice label={`Tier for ${m.displayName}`} value={r.tier} onChange={v=>patch(m.userId,{tier:v})} items={value.rules.tiers.map((t:number)=>({value:String(t),label:`Tier ${t}`}))} disabled={busy||!value.available}/>
        <Choice label={`Channel for ${m.displayName}`} value={r.channel} onChange={v=>patch(m.userId,{channel:v})} items={value.rules.channels.map((c:string)=>({value:c,label:c==='sms'?'SMS (simulated)':'Email (simulated)'}))} disabled={busy||!value.available}/>
        <fieldset className="notification-kinds"><legend>Alert kinds {m.displayName} receives</legend>{m.kinds.map((k:string)=><label key={k} className="check-label"><Checkbox aria-label={`${KIND[k]??k} for ${m.displayName}`} checked={r.kinds.includes(k)} disabled={busy||!value.available} onCheckedChange={on=>patch(m.userId,{kinds:on===true?[...r.kinds,k]:r.kinds.filter(x=>x!==k)})}/>{KIND[k]??k}</label>)}</fieldset>
       </div>}
      </li>;})}</ul>:<p className="muted">No active member holds an alert kind yet. Owners, administrators and supervisors can.</p>}
     </fieldset>
     <label className="field"><span>Reason for the change</span><Input value={reason} onChange={e=>setReason(e.target.value)} minLength={5} maxLength={500} required disabled={busy||!value.available}/></label>
     <div className="button-row"><Button type="submit" variant="outline" disabled={busy||!value.available||invalid}>Save notification channel</Button><Button type="button" variant="outline" onClick={()=>void load()} disabled={loading}><RefreshCw size={16}/>Refresh log</Button></div>
    </form>
    {!!stored.history.length&&<p className="text-sm muted">Earlier settings: {stored.history.slice(-3).map((h:any)=>`v${h.version} ${h.enabled?'on':'off'}, ${h.recipients} recipients, ${h.escalateAfterMinutes} min`).join(' · ')}</p>}
    {value.aggregatePrivacy&&<p className="muted">{value.aggregatePrivacy.notice} Protected clinical aggregate event history is excluded from the lists and totals below.</p>}
    <h3>Available open alerts and their escalation schedule</h3>
    {value.open.length?<Table><TableHeader><TableRow><TableHead>Alert</TableHead><TableHead>Opened</TableHead><TableHead>Tiers</TableHead></TableRow></TableHeader><TableBody>{value.open.map((o:any)=><TableRow key={o.occurrenceId}><TableCell><span className="tag">{o.severity}</span> {o.title}<small className="audit-actor">{o.scope==='organisation'?'Organisation alert':`Care scope of ${o.scope}`}{o.acknowledged?' · acknowledged: no further tiers':''}</small></TableCell><TableCell className="time-cell">{when(o.openedAt)}</TableCell><TableCell>{o.rungs.length?<ol className="notification-rungs">{o.rungs.map((r:any)=><li key={r.tier}>Tier {r.tier} · {r.recipients} {r.recipients===1?'recipient':'recipients'} · due {when(r.dueAt)} · {o.acknowledged&&r.state!=='sent'?'not needed':r.state}</li>)}</ol>:<span className="muted">No recipient is listed for this alert.</span>}</TableCell></TableRow>)}</TableBody></Table>:<p className="muted">No available open alerts. Protected clinical aggregate history is excluded; this does not mean no care work exists.</p>}
    <h3>Available message log ({value.total} available entries{value.total>value.messages.length?`; latest ${value.messages.length} shown`:''})</h3>
    {value.messages.length?<Table><TableHeader><TableRow><TableHead>Sent</TableHead><TableHead>Recipient</TableHead><TableHead>Message</TableHead><TableHead>Receipt</TableHead></TableRow></TableHeader><TableBody>{value.messages.map((m:any)=><TableRow key={m.id}><TableCell className="time-cell">{when(m.sentAt)}{m.lateMinutes>=2&&<small className="audit-actor">{m.lateMinutes} min after it was due (Saha evaluates alerts when people use it)</small>}</TableCell><TableCell>{m.recipientName}<small className="audit-actor">Tier {m.tier} · {m.channel==='sms'?'SMS':'Email'} · {m.address}</small></TableCell><TableCell><span className="tag">{m.severity}</span> {m.reason==='escalation'?<span className="tag blue">Escalation</span>:null} {m.title}{m.count!==null&&` (${m.count})`}<details><summary>Show what was &quot;sent&quot;</summary>{m.subject&&<p><strong>Subject:</strong> {m.subject}</p>}<pre className="notification-body">{m.body}</pre></details>{m.redacted&&<small className="audit-actor">Count withheld: it comes from the recipient&apos;s own care scope.</small>}</TableCell><TableCell>{m.receipt.status==='simulated-delivered'?'Simulated delivery':m.receipt.status}<small className="audit-actor">{m.receipt.receiptId} · nothing contacted</small></TableCell></TableRow>)}</TableBody></Table>:<p className="muted">No available message entries. Protected clinical aggregate history is excluded; this does not mean that no historical messages exist.</p>}
   </>}
  </div>
 </section>;
}
