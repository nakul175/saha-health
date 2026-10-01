'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ADAPTER_OPERATIONS, LABEL, NO_PATH, OPERATION_PATHS, governed, operationsOf, type AdapterOperation, type GovernedKind } from '@/lib/saha/adapter-operations';
import type { Integration, Snapshot } from '@/lib/saha/types';
type Command=(c:any,s?:string)=>Promise<any>;
// Slice 7e: the operations a programme, EHR or ABDM connection may perform. Owners change them; everyone sees them.
export function AdapterOperationsControls({i,data,busy,command}:{i:Integration;data:Snapshot;busy:boolean;command:Command}){
 const current=operationsOf(i),[allowed,setAllowed]=useState<AdapterOperation[]>(current.allowed),[aggregateOnly,setAggregateOnly]=useState(current.aggregateOnly),[reason,setReason]=useState('');
 // A newer setting (saved here or by another owner) resets the form; the disclosure stays open.
 useEffect(()=>{setAllowed(operationsOf(i).allowed);setAggregateOnly(operationsOf(i).aggregateOnly);},[i.operations?.version]);
 if(!governed(i))return null;
 const kind=i.kind as GovernedKind,owner=data.canManage,changed=allowed.join()!==current.allowed.join()||aggregateOnly!==current.aggregateOnly;
 const toggle=(op:AdapterOperation,on:boolean)=>setAllowed(ADAPTER_OPERATIONS.filter(x=>x===op?on:allowed.includes(x)));
 const summary=current.allowed.length?current.allowed.map(x=>LABEL[x].toLowerCase()).join(', '):'none';
 return <details className="adapter-ops">
  <summary>Permitted operations: {current.aggregateOnly?'aggregate reports only':summary}</summary>
  <p className="text-sm muted">Setting version {current.version}{current.explicit?` · changed ${new Date(i.operations!.setAt).toLocaleString()}`:' · release default'}. Every send and lookup rechecks this on the server; an item already prepared is closed as not sent if its operation is withdrawn.</p>
  <ul className="adapter-ops-list" aria-label={`${i.name} permitted operations`}>{ADAPTER_OPERATIONS.map(op=>{const path=OPERATION_PATHS[kind][op];return <li key={op}>
   {owner?<label className="check-label"><Checkbox aria-label={LABEL[op]} checked={allowed.includes(op)} disabled={busy||(aggregateOnly&&['create','update','delete'].includes(op))} onCheckedChange={on=>toggle(op,on===true)}/>{LABEL[op]}</label>:<strong>{LABEL[op]}: {current.allowed.includes(op)?'permitted':'not permitted'}</strong>}
   <span className="text-sm muted">{path||NO_PATH}</span></li>})}</ul>
  {kind==='mis'&&(owner?<label className="check-label"><Checkbox aria-label="Aggregate reports only" checked={aggregateOnly} disabled={busy} onCheckedChange={on=>{const v=on===true;setAggregateOnly(v);if(v)setAllowed(ADAPTER_OPERATIONS.filter(x=>x==='aggregate'||(x==='lookup'&&allowed.includes('lookup'))));}}/>Aggregate reports only: never send patient-level records</label>:<p className="text-sm">{current.aggregateOnly?'Aggregate-only: this destination never receives patient-level records.':'Receives patient-level records under the permitted operations.'}</p>)}
  {kind==='mis'&&<p className="text-sm muted">An aggregate-only destination receives only approved aggregate reports with small cells suppressed (slice 7g), prepared below its operations. Demonstration destinations only in this release.</p>}
  {owner&&<form className="form-stack" onSubmit={async e=>{e.preventDefault();const r=await command({type:'setAdapterOperations',integrationId:i.id,version:current.version,allowed,aggregateOnly,reason},'Operation setting saved');if(r)setReason('');}}>
   <label className="field"><span>Reason for the change</span><Input value={reason} onChange={e=>setReason(e.target.value)} minLength={5} maxLength={500} required/></label>
   <Button type="submit" variant="outline" disabled={busy||!changed||reason.trim().length<5}>Save operation setting</Button>
  </form>}
  {!!i.operations?.history.length&&<p className="text-sm muted">Earlier settings: {i.operations.history.slice(-3).map(h=>`v${h.version} ${h.aggregateOnly?'aggregate only':h.allowed.join('/')||'none'}`).join(' · ')}</p>}
 </details>;
}
