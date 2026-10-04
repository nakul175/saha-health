'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { operationRefusal } from '@/lib/saha/adapter-operations';
import type { Withdrawal } from '@/lib/saha/withdrawal';
import type { Person, Snapshot, Visit } from '@/lib/saha/types';
type Command=(c:any,s?:string)=>Promise<any>;
const REASONS:[Withdrawal['reasonCode'],string][]=[['wrong-patient','Recorded against the wrong patient'],['entered-in-error','Entered in error'],['corrected','Replaced by a corrected record']];
const STATE:Record<Withdrawal['state'],string>={prepared:'Prepared, awaiting approval',approved:'Approved, ready to send',sending:'Sending',accepted:'Confirmed by the destination',rejected:'Rejected by the destination',uncertain:'Outcome unknown','not-stored':'Not held by the destination',cancelled:'Closed, not sent'};
const field='grid gap-1 text-sm font-medium min-w-[14rem] flex-1',select='h-11 w-full rounded-[7px] border border-input bg-white px-2 text-base font-normal';
const when=(at?:string)=>at?`${at.slice(0,16).replace('T',' ')} UTC`:'—';
// Slice 14c: withdrawal (void) of an accepted programme submission and withdrawal or amendment of an accepted EHR publication,
// on the visit's Receipts tab. Display and forms only: the server decides who may act, what is bound to the approval and what
// is sent. The original submission or publication and its receipt are never changed; each withdrawal gets its own receipt.
export function WithdrawalPanel({data,visit:v,person:p,busy,command}:{data:Snapshot;visit:Visit;person:Person;busy:boolean;command:Command}){
 const care=['asha','clinician'].includes(data.role),me=data.user.userId,list=v.withdrawals??[];
 const open=(id:string)=>list.some(w=>w.original.id===id&&['prepared','approved','sending','uncertain','accepted'].includes(w.state));
 const subs=data.submissions.filter(s=>s.visitId===v.id&&s.state==='accepted'&&s.receipt);
 const pubs=(p.ehr?.operations??[]).filter(o=>o.visitId===v.id&&o.state==='accepted'&&o.receipt);
 if(!subs.length&&!pubs.length&&!list.length)return null;
 // What the destination's operation setting (slice 7e) refuses, shown instead of a form; the server checks it again.
 const refusal=(id:string|undefined,op:'delete'|'update')=>{const i=data.integrations.find(x=>x.id===id);return i?operationRefusal(i,op,'patient'):'The destination connection no longer exists.';};
 const ehrOf=(linkId:string)=>p.ehr?.links.find(l=>l.id===linkId)?.integrationId;
 return <section className="panel withdrawal-panel" aria-labelledby={`withdrawals-${v.id}`}>
  <h3 id={`withdrawals-${v.id}`}>Withdrawals and amendments</h3>
  <p className="muted text-sm">A withdrawal asks a destination to void a record it accepted; an EHR amendment replaces a published document with the confirmed correction visit's document. Each is prepared, approved by a care worker for the exact payload, and sent by that person within 15 minutes, and gets its own receipt. The original receipt is kept unchanged. Nothing is sent automatically, and an unknown outcome is looked up, never sent again. A destination must permit the operation; otherwise record the change with it by its own process.</p>
  {care&&subs.filter(s=>!open(s.id)).map(s=>refusal(s.connectorId,'delete')?<p key={s.id} className="muted text-sm">{s.connectorName} · receipt {s.receipt}: {refusal(s.connectorId,'delete')} Record a withdrawal with the destination by its own process.</p>:<TargetForm key={s.id} label={`${s.connectorName} · receipt ${s.receipt}`} disabled={busy||open(s.id)} operations={['withdraw']} onPrepare={(operation,reasonCode,reason)=>command({type:'prepareWithdrawal',personId:p.id,target:'programme-submission',refId:s.id,operation,reasonCode,reason},'Withdrawal prepared. Review and approve it.')}/>)}
  {care&&pubs.filter(o=>!open(o.id)).map(o=>{const ops=([['withdraw','delete'],...(v.supersededBy?[['amend','update']]:[])] as [('withdraw'|'amend'),('delete'|'update')][]).filter(([,op])=>!refusal(ehrOf(o.linkId),op)).map(([x])=>x);return ops.length?<TargetForm key={o.id} label={`EHR publication · ${o.receipt}`} disabled={busy||open(o.id)} operations={ops} onPrepare={(operation,reasonCode,reason)=>command({type:'prepareWithdrawal',personId:p.id,target:'ehr-publication',refId:o.id,operation,reasonCode,reason},operation==='amend'?'Amendment prepared. Review and approve it.':'Withdrawal prepared. Review and approve it.')}/>:<p key={o.id} className="muted text-sm">EHR publication · {o.receipt}: {refusal(ehrOf(o.linkId),'delete')} Withdraw or amend it with the EHR by its own process.</p>;})}
  {list.slice().reverse().map(w=><div className="receipt-row" key={w.id} data-withdrawal={w.id}><div className="receipt-main">
   <strong>{w.operation==='amend'?'EHR amendment':'Withdrawal'} · {w.destination.name}</strong>
   <span>{STATE[w.state]} · original receipt {w.original.receipt}{w.receipt?` · withdrawal receipt ${w.receipt}`:''}</span>
   <p>{w.message}</p>
   <small>Reason: {REASONS.find(r=>r[0]===w.reasonCode)?.[1]} — {w.reason}</small>
   <small className="block">Prepared by {w.preparedByName} {when(w.preparedAt)}{w.approvedByName?` · approved by ${w.approvedByName} until ${when(w.expiresAt)}`:''} · payload SHA-256 {w.payloadHash.slice(0,16)}…{w.closedTaskIds?.length?` · ${w.closedTaskIds.length} correction task${w.closedTaskIds.length===1?'':'s'} completed`:''}</small>
   {w.payload&&w.state==='prepared'&&<details><summary>Exact payload to approve</summary><pre className="text-sm">{JSON.stringify(w.payload,null,2).slice(0,4000)}</pre></details>}
   {care&&<div className="button-row">
    {w.state==='prepared'&&<Button disabled={busy} onClick={()=>command({type:'approveWithdrawal',personId:p.id,withdrawalId:w.id,payloadHash:w.payloadHash},'Approved for 15 minutes. Send it now.')}>Approve this exact payload</Button>}
    {w.state==='approved'&&w.approvedBy===me&&<Button disabled={busy} onClick={()=>command({type:'executeWithdrawal',personId:p.id,withdrawalId:w.id},'Withdrawal sent. Check its receipt.')}>Send {w.operation==='amend'?'amendment':'withdrawal'}</Button>}
    {['sending','uncertain'].includes(w.state)&&<Button variant="outline" disabled={busy} onClick={()=>command({type:'lookupWithdrawal',personId:p.id,withdrawalId:w.id},'Receipt lookup completed. Nothing was sent again.')}>Look up receipt</Button>}
    {['prepared','approved'].includes(w.state)&&<Button variant="outline" disabled={busy} onClick={()=>command({type:'cancelWithdrawal',personId:p.id,withdrawalId:w.id},'Cancelled. Nothing was sent.')}>Cancel</Button>}
   </div>}
  </div></div>)}
 </section>;
}
function TargetForm({label,disabled,operations,onPrepare}:{label:string;disabled:boolean;operations:('withdraw'|'amend')[];onPrepare:(operation:'withdraw'|'amend',reasonCode:Withdrawal['reasonCode'],reason:string)=>Promise<any>}){
 const [operation,setOperation]=useState(operations[0]),[reasonCode,setCode]=useState<Withdrawal['reasonCode']>('wrong-patient'),[reason,setReason]=useState('');
 return <form className="receipt-row" onSubmit={async e=>{e.preventDefault();const r=await onPrepare(operation,reasonCode,reason);if(r)setReason('');}}><div className="receipt-main">
  <strong>{label}</strong>
  <div className="flex flex-wrap gap-3">
   {operations.length>1&&<label className={field}>Operation<select className={select} value={operation} onChange={e=>setOperation(e.target.value as 'withdraw'|'amend')}><option value="withdraw">Withdraw the document</option><option value="amend">Amend with the correction visit</option></select></label>}
   <label className={field}>Reason code<select className={select} value={reasonCode} onChange={e=>setCode(e.target.value as Withdrawal['reasonCode'])}>{REASONS.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label>
   <label className={field}>Reason<Input aria-label={`Reason for the withdrawal of ${label}`} value={reason} maxLength={500} onChange={e=>setReason(e.target.value)} placeholder="At least 10 characters"/></label>
  </div>
  <div className="button-row"><Button type="submit" variant="outline" disabled={disabled||reason.trim().length<10}>Prepare {operation==='amend'?'amendment':'withdrawal'}</Button></div>
 </div></form>;
}
