'use client';
import { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { Snapshot, Visit } from '@/lib/saha/types';
// Slice 3h: a referral request captured with a field registration (slice 3g). A clinician creates the referral
// from it in one step, or declines it with a reason, once the visit is confirmed. No facility is contacted.
export function ReferralRequestPanel({data,v,busy,command}:{data:Snapshot;v:Visit;busy:boolean;command:(c:any,s?:string)=>Promise<any>}){
 const r=v.referralRequest,[facility,setFacility]=useState(r?.facility??''),[reason,setReason]=useState(r?.reason??'');
 useEffect(()=>{setFacility(v.referralRequest?.facility??'');setReason(v.referralRequest?.reason??'');},[v.id,v.referralRequest?.facility,v.referralRequest?.reason]);
 if(!r)return null;
 const name=(id:string)=>data.members.find(m=>m.userId===id)?.displayName??'a care worker',clinician=data.membership.role==='clinician',current=v.state==='confirmed'&&!v.voidedAt&&!v.supersededBy,d=r.decision;
 const decide=(decision:'refer'|'decline')=>command({type:'decideReferralRequest',visitId:v.id,decision,...(decision==='refer'&&facility.trim()!==r.facility?{facility:facility.trim()}:{}),reason:reason.trim()},decision==='refer'?'Referral created from the request. No facility was contacted.':'Referral request declined.');
 return <section className="panel referral-request"><div className="section-heading"><h3><Send size={17}/> Field referral request</h3><span className="muted text-sm">Requested by {name(r.requestedBy)} · captured {r.capturedAt.slice(0,16).replace('T',' ')} UTC</span></div>
  <p><strong>{r.facility}</strong> · {r.reason}</p>
  {d?<p className="notice">{d.decision==='referred'?`Referral created by ${name(d.by)} on ${d.at.slice(0,16).replace('T',' ')} UTC. Track it under referrals below.`:`Declined by ${name(d.by)} on ${d.at.slice(0,16).replace('T',' ')} UTC.`} Reason: {d.reason}</p>
  :!current?<p className="muted text-sm">Confirm the visit before a clinician acts on this request.</p>
  :!clinician?<p className="muted text-sm">A clinician decides whether to refer.</p>
  :<div className="stack-form"><label className="field"><span>Facility</span><Input value={facility} onChange={e=>setFacility(e.target.value)} maxLength={200}/></label><label className="field"><span>Reason for your decision</span><Textarea value={reason} onChange={e=>setReason(e.target.value)} maxLength={1000} rows={3}/></label>
   <div className="button-row"><Button disabled={busy||facility.trim().length<3||reason.trim().length<5} onClick={()=>decide('refer')}>Create referral</Button><Button variant="outline" disabled={busy||reason.trim().length<5} onClick={()=>decide('decline')}>Decline request</Button></div>
   <p className="muted text-sm">Creating the referral records a draft referral for tracking; no facility is contacted.</p></div>}
 </section>;
}
