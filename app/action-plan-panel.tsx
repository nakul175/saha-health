'use client';
import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Person, Snapshot } from '@/lib/saha/types';
type Command=(c:any,message?:string)=>Promise<any>;
const KIND_LABEL:Record<string,string>={'safety-case':'Safety case',referral:'Referral','protocol-review':'Protocol review','ai-disagreement':'Assistant disagreement','follow-up':'Programme follow-up',outreach:'Outreach','message-follow-up':'Message follow-up',correction:'Correction task'};
const ATTENTION_LABEL:Record<string,string>={escalated:'Escalated',overdue:'Overdue','due-today':'Due today',now:'Review now',undated:'No due date',upcoming:'Upcoming',waiting:'Waiting'};
const DEP_STATE:Record<string,string>={waiting:'Waiting',released:'Blocker closed',closed:'Item closed',removed:'Removed'};
// Slice 4d: record that this item waits on another open item of the same patient.
function Wait({item,plan,p,busy,command,done}:{item:any;plan:any;p:Person;busy:boolean;command:Command;done:()=>void}){
 const [blocker,setBlocker]=useState(''),[reason,setReason]=useState('');
 const others=plan.items.filter((i:any)=>i.key!==item.key&&i.refs.length);
 if(!others.length)return null;
 return <details><summary>Wait on another item</summary><div className="form-grid"><Select value={blocker} onValueChange={setBlocker}><SelectTrigger aria-label={`Blocker for ${item.title}`}><SelectValue placeholder="Choose the item to wait for"/></SelectTrigger><SelectContent>{others.map((o:any)=><SelectItem key={o.key} value={o.key}>{KIND_LABEL[o.kind]??o.kind}: {o.title}</SelectItem>)}</SelectContent></Select>
  <label>Reason<Input aria-label={`Dependency reason for ${item.title}`} value={reason} maxLength={500} onChange={e=>setReason(e.target.value)} placeholder="At least 10 characters"/></label></div>
  <Button disabled={busy||!blocker||reason.trim().length<10} onClick={async()=>{const b=others.find((o:any)=>o.key===blocker);const r=await command({type:'linkPlanItems',personId:p.id,version:plan.personVersion,dependent:item.refs[0],blocker:b.refs[0],reason},'Dependency recorded');if(r){setReason('');setBlocker('');done();}}}>Record dependency</Button></details>;
}
function Unlink({dep,plan,p,busy,command,done}:{dep:any;plan:any;p:Person;busy:boolean;command:Command;done:()=>void}){
 const [reason,setReason]=useState('');
 return <details><summary>Remove</summary><label>Reason<Input aria-label={`Removal reason for ${dep.dependent.title}`} value={reason} maxLength={500} onChange={e=>setReason(e.target.value)} placeholder="At least 10 characters"/></label>
  <Button variant="outline" disabled={busy||reason.trim().length<10} onClick={async()=>{const r=await command({type:'unlinkPlanItems',personId:p.id,version:plan.personVersion,dependencyId:dep.id,reason},'Dependency removed');if(r){setReason('');done();}}}>Remove dependency</Button></details>;
}

// Slice 2j: close a correction task with evidence: the Saha receipt of the correction (checked on the server)
// or a reason, with an optional reference from the destination. Closing never changes the output itself.
function CloseCorrection({item,p,busy,command,done}:{item:any;p:Person;busy:boolean;command:Command;done:()=>void}){
 const c=item.correction,[receiptId,setReceipt]=useState(''),[reference,setReference]=useState(''),[reason,setReason]=useState('');
 const ok=receiptId.trim().length>0||reason.trim().length>=10;
 return <details data-work-stage="reconciliation" data-work-visit={c.visitId} data-work-task={c.taskId}><summary>Close with evidence</summary><div className="form-grid">
  {c.receiptCloses&&<label>Correction receipt<Input aria-label={`Correction receipt for ${item.title}`} value={receiptId} maxLength={200} onChange={e=>setReceipt(e.target.value)} placeholder="Receipt of the correction sent through Saha"/></label>}
  {c.external&&<label>Destination reference<Input aria-label={`Destination reference for ${item.title}`} value={reference} maxLength={200} onChange={e=>setReference(e.target.value)} placeholder="Optional"/></label>}
  <label>Reason<Input aria-label={`Closing reason for ${item.title}`} value={reason} maxLength={500} onChange={e=>setReason(e.target.value)} placeholder={c.receiptCloses?'Or at least 10 characters':'At least 10 characters'}/></label></div>
  <Button disabled={busy||!ok} onClick={async()=>{const r=await command({type:'closeCorrectionTask',personId:p.id,visitId:c.visitId,taskId:c.taskId,...(receiptId.trim()?{receiptId:receiptId.trim()}:{}),...(reference.trim()?{reference:reference.trim()}:{}),...(reason.trim()?{reason:reason.trim()}:{})},'Correction task closed');if(r){setReceipt('');setReference('');setReason('');done();}}}>Close task</Button></details>;
}
// Slice 4b: one ordered plan of this patient's open work, with owners and ownership gaps.
function Assign({item,plan,p,busy,command,done}:{item:any;plan:any;p:Person;busy:boolean;command:Command;done:()=>void}){
 const self=plan.eligibleOwners.length===1&&!plan.canAssign?plan.eligibleOwners[0].userId:'';
 const [owner,setOwner]=useState(self),[reason,setReason]=useState('');
 const claim=!plan.canAssign;
 return <details><summary>{claim?'Take ownership':'Assign or reassign'}</summary><div className="form-grid">{claim?<p className="muted text-sm">You will become the owner.</p>:<Select value={owner} onValueChange={setOwner}><SelectTrigger aria-label={`Owner for ${item.title}`}><SelectValue placeholder="Choose a care worker"/></SelectTrigger><SelectContent>{plan.eligibleOwners.map((o:any)=><SelectItem key={o.userId} value={o.userId}>{o.displayName} · {o.role}</SelectItem>)}</SelectContent></Select>}
  <label>Reason<Input aria-label={`Reason for ${item.title}`} value={reason} maxLength={500} onChange={e=>setReason(e.target.value)} placeholder="At least 10 characters"/></label></div>
  <Button disabled={busy||!owner||reason.trim().length<10} onClick={async()=>{const r=await command({type:'assignPlanItem',personId:p.id,version:plan.personVersion,targets:item.targets,ownerId:owner,reason},claim?'Ownership recorded':'Owner assigned');if(r){setReason('');done();}}}>{claim?'Take ownership':'Save owner'}</Button></details>;
}
export function ActionPlanPanel({data,p,busy,command}:{data:Snapshot;p:Person;busy:boolean;command:Command}){
 const [plan,setPlan]=useState<any>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 const load=useCallback(async()=>{setLoading(true);try{const r=await fetch(`/api/action-plan?${new URLSearchParams({personId:p.id})}`,{cache:'no-store',headers:{'x-saha-organisation':data.organisation.id}}),j:any=await r.json();if(!r.ok)throw Error(j.error);setPlan(j);setError('');}catch(e){setError(e instanceof Error?e.message:'Action plan unavailable.');}finally{setLoading(false);}},[p.id,data.organisation.id]);
 const referrals=data.referrals.filter(r=>r.personId===p.id).map(r=>`${r.id}:${r.version??1}`).join(',');
 // Slice 2j: an amendment or void adds correction tasks without changing the patient version.
 const corrections=data.visits.filter(v=>v.personId===p.id&&(v.supersededBy||v.voidedAt)).map(v=>v.id).join(',');
 useEffect(()=>{if(data.role!=='admin')void load();},[load,data.role,p.version,referrals,corrections,data.organisation.revision]);
 if(data.role==='admin')return null;
 return <section className="panel action-plan" aria-labelledby="action-plan-title"><div className="section-heading"><div><h2 id="action-plan-title">Action plan</h2><p className="muted text-sm">Open work for {p.name} from every programme, referral, review and safety case, in one order.</p></div><Button variant="outline" size="sm" disabled={loading} onClick={load}><RefreshCw size={15}/>Refresh</Button></div>
  {error&&<p role="alert">{error}</p>}
  {plan&&(plan.items.length?<>{plan.unowned>0&&<p className="notice amber-notice" role="status">{plan.unowned} item{plan.unowned===1?'':'s'} without a current eligible owner. {plan.canAssign?'Assign an owner below.':'They stay in the responsible queue shown until someone takes ownership.'}</p>}
   <ol className="revision-list action-plan-list">{plan.items.map((i:any)=><li key={i.key}><div><span className={`tag ${['escalated','overdue'].includes(i.attention)?'amber':''}`}>{ATTENTION_LABEL[i.attention]??i.attention}</span> <span className="tag">{KIND_LABEL[i.kind]??i.kind}</span> <strong>{i.title}</strong></div>
    <p>{i.reason}</p>
    <p className="muted text-sm">Owner: {i.owner?`${i.owner.displayName}${i.owner.eligible?'':' (no current access)'}`:'none'}{i.queue?` · Queue: ${i.queue}`:''} · Due: {i.due??'not set'}{i.daysOverdue?` (${i.daysOverdue} day${i.daysOverdue===1?'':'s'} overdue)`:''} · Urgency: {i.urgency} · Status: {i.status}</p>
    {i.sources.length>1&&<p className="muted text-sm">Sources: {i.sources.map((s:any)=>s.label).join('; ')}</p>}
    {i.waitingOn.length>0&&<p className="notice" role="status">Waiting for {i.waitingOn.map((x:any)=>`${x.title} (${x.status}${x.daysOverdue?`, ${x.daysOverdue} day${x.daysOverdue===1?'':'s'} overdue`:''})`).join('; ')}.</p>}
    {i.blocks.length>0&&<p className="muted text-sm">Holds back: {i.blocks.map((x:any)=>x.title).join('; ')}</p>}
    {plan.canLink&&['follow-up','referral'].includes(i.kind)&&<Wait item={i} plan={plan} p={p} busy={busy} command={command} done={load}/>}
    {i.ownershipGap&&<p className="notice amber-notice">{i.ownershipGap}</p>}
    {i.assignVia==='action-plan'&&(i.canAssign||i.canClaim)&&<Assign item={i} plan={plan} p={p} busy={busy} command={command} done={load}/>}
    {i.correction&&<p className="muted text-sm">{i.correction.external?'External output':'Internal output'}{i.correction.destination?` · ${i.correction.destination}`:''}{i.correction.receipt?` · receipt ${i.correction.receipt}`:''} · Open {i.correction.ageDays} day{i.correction.ageDays===1?'':'s'} · <a href={i.correction.href}>Open the earlier visit</a></p>}
    {i.correction?.canClose&&<CloseCorrection item={i} p={p} busy={busy} command={command} done={load}/>}
    {i.ownershipGap&&i.assignVia==='governance'&&<p className="muted text-sm">A clinician with access reassigns safety cases under Clinical governance.</p>}
    {i.ownershipGap&&i.assignVia==='outreach'&&<p className="muted text-sm">Reassign outreach work on the Outreach page.</p>}
   </li>)}</ol><p className="subtle-note">{plan.rules}</p></>:<p className="muted">No open work for this patient.</p>)}
  {plan&&plan.dependencies.length>0&&<div className="action-plan-dependencies"><h3>Dependencies</h3><ul className="revision-list">{plan.dependencies.map((d:any)=><li key={d.id}><span className={`tag ${d.state==='waiting'?'amber':''}`}>{DEP_STATE[d.state]??d.state}</span> <strong>{d.dependent.title}</strong> waits on <strong>{d.blocker.title}</strong>
   <p className="muted text-sm">Recorded {d.at.slice(0,10)} by {d.by}: {d.reason}{d.removed?` · Removed ${d.removed.at.slice(0,10)} by ${d.removed.by}: ${d.removed.reason}`:''}</p>
   {plan.canLink&&!d.removed&&<Unlink dep={d} plan={plan} p={p} busy={busy} command={command} done={load}/>}</li>)}</ul></div>}
 </section>;
}
