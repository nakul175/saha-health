'use client';
import {useState} from 'react';
import {Button} from '@/components/ui/button';
import type {Snapshot} from '@/lib/saha/types';

// This control never contacts a provider: trusted staff exercise the exact local mock-event ingestion path.
export function ReminderOptoutPanel({data,people,disabled,refresh,onSnapshot}:{data:Snapshot;people:any[];disabled:boolean;refresh:()=>Promise<void>;onSnapshot?:(s:Snapshot)=>void}){
 const [personId,setPersonId]=useState(''),[pending,setPending]=useState<any>(null),[working,setWorking]=useState(false),[result,setResult]=useState<any>(null),[error,setError]=useState('');
 const candidates=people.filter(p=>p.preferences?.method==='sms'&&/^TEST-[A-Z0-9-]{3,30}$/.test(p.preferences.destination));
 const p=candidates.find(p=>p.id===personId);
 async function simulate(){
  if(!pending&&!p)return;setWorking(true);setError('');
  const body=pending??{provider:'mock-reminder',organisationId:data.organisation.id,eventId:'ui_'+crypto.randomUUID().replaceAll('-',''),destination:p.preferences.destination,preferenceVersion:p.preferences.version,occurredAt:new Date().toISOString(),action:'STOP'};
  setPending(body);
  try{const response=await fetch('/api/reminder-optout',{method:'POST',headers:{'Content-Type':'application/json','x-saha-organisation':data.organisation.id},body:JSON.stringify(body)}),r:any=await response.json();if(!response.ok)throw Error(r.error??'Opt-out simulation could not finish.');setResult(r);setPending(null);await refresh();if(onSnapshot){const latest=await fetch('/api/workspace',{cache:'no-store',headers:{'x-saha-organisation':data.organisation.id}});if(!latest.ok)throw Error('The event was saved, but the workspace could not refresh. Reload before opening another record.');onSnapshot(await latest.json() as Snapshot);}}
  catch(e){setError((e as Error).message);}finally{setWorking(false);}
 }
 if(!['asha','clinician','supervisor'].includes(data.role))return null;
 return <section className="panel pilot-panel"><div className="eyebrow">MOCK INCOMING PROVIDER EVENT</div><h2>Test a reminder opt-out</h2><p>A synthetic STOP event withdraws automated-contact permission and cancels unsent reminders. Previous simulation receipts stay unchanged. No real message or provider request is sent.</p><label className="field"><span>Patient with a synthetic SMS contact</span><select aria-label="Opt-out simulation patient" value={personId} disabled={disabled||working||!!pending} onChange={e=>{setPersonId(e.target.value);setResult(null);setError('');}}><option value="">Choose a patient</option>{candidates.map(p=><option key={p.id} value={p.id}>{p.name} · {p.preferences.destination}</option>)}</select></label>{!candidates.length&&<p className="muted">Record a TEST- SMS contact in Contact preferences first.</p>}<Button disabled={disabled||working||(!pending&&!p)} onClick={simulate}>{working?'Recording mock event…':pending?'Retry same opt-out event':'Simulate incoming STOP'}</Button>{pending&&!working&&<Button variant="outline" disabled={disabled} onClick={()=>{setPending(null);setError('');}}>Discard local retry</Button>}{error&&<p role="alert" className="notice amber-notice">{error} {pending?'The same event key is retained for retry; check the receipt before replacing this event.':'The receipt above remains saved. Refresh the workspace before continuing.'}</p>}{result&&<p role="status" className="notice">{result.replayed?'Existing event receipt':'Mock opt-out recorded'} · {result.receipt}. {result.cancelled} unsent reminder(s) cancelled. No real message sent.</p>}</section>;
}
