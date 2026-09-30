'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MEASURE_LABEL, authorText, factMeasuresPresent, factReview, reviewText } from '@/lib/saha/fact-provenance';
import type { Measure, Snapshot, Visit } from '@/lib/saha/types';
// Slice 2e: who recorded each measurement and its verification state (BR-DATA-02). A clinician in the patient's
// care scope may verify or dispute a measurement on a current confirmed visit; the server checks role and scope.
export function FactVerificationPanel({v,data,busy,command}:{v:Visit;data:Snapshot;busy:boolean;command:(c:any,s?:string)=>Promise<any>}){
 const [disputing,setDisputing]=useState<Measure|null>(null),[reason,setReason]=useState('');
 const measures=factMeasuresPresent(v.facts);if(!measures.length)return null;
 const canReview=data.role==='clinician'&&v.state==='confirmed'&&!v.voidedAt&&!v.supersededBy;
 const send=async(m:Measure,decision:'verified'|'disputed')=>{const ok=await command({type:'verifyFact',visitId:v.id,recordVersion:v.recordVersion,measure:m,decision,...(decision==='disputed'?{reason:reason.trim()}:{})},decision==='verified'?`${MEASURE_LABEL[m]} verified`:`${MEASURE_LABEL[m]} disputed`);if(ok){setDisputing(null);setReason('');}};
 return <div className="notes-box fact-verification" data-testid="fact-verification"><span>Who recorded each measurement · verification</span>
  {measures.map(m=>{const a=v.factAuthors?.[m],r=factReview(v,m),own=a?.userId===data.user.userId;
   return <div key={m} className="fact-review-row"><p><strong>{MEASURE_LABEL[m]}</strong> · Recorded by: {authorText(a)} · Verification: {reviewText(r)}</p>
    {canReview&&!own&&<div className="flex flex-wrap gap-2">{r?.state!=='verified'&&<Button size="sm" variant="outline" disabled={busy} onClick={()=>void send(m,'verified')}>Verify {MEASURE_LABEL[m].toLowerCase()}</Button>}{r?.state!=='disputed'&&disputing!==m&&<Button size="sm" variant="outline" disabled={busy} onClick={()=>{setDisputing(m);setReason('');}}>Dispute {MEASURE_LABEL[m].toLowerCase()}</Button>}</div>}
    {disputing===m&&<form className="flex flex-wrap gap-2 items-end" onSubmit={e=>{e.preventDefault();void send(m,'disputed');}}><label className="field grow"><span>Why is the {MEASURE_LABEL[m].toLowerCase()} disputed?</span><Input value={reason} onChange={e=>setReason(e.target.value)} minLength={10} maxLength={500} required/></label><Button type="submit" size="sm" disabled={busy||reason.trim().length<10}>Record dispute</Button><Button type="button" size="sm" variant="ghost" onClick={()=>setDisputing(null)}>Cancel</Button></form>}
   </div>;})}
  {canReview&&measures.some(m=>v.factAuthors?.[m]?.userId===data.user.userId)&&<p className="muted text-sm">A different clinician must verify or dispute measurements you recorded.</p>}
  {v.state!=='confirmed'&&<p className="muted text-sm">Measurements can be verified after the visit is confirmed.</p>}
 </div>;
}
