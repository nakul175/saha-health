'use client';
import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Person, Snapshot } from '@/lib/saha/types';
type Command=(c:any,message?:string)=>Promise<any>;
const KIND_LABEL:Record<string,string>={'safety-case':'Safety case',referral:'Referral','protocol-review':'Protocol review','ai-disagreement':'Assistant disagreement','follow-up':'Programme follow-up',outreach:'Outreach','message-follow-up':'Message follow-up'};
const ATTENTION_LABEL:Record<string,string>={escalated:'Escalated',overdue:'Overdue','due-today':'Due today',now:'Review now',undated:'No due date',upcoming:'Upcoming'};

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
 useEffect(()=>{if(data.role!=='admin')void load();},[load,data.role,p.version,referrals,data.organisation.revision]);
 if(data.role==='admin')return null;
 return <section className="panel action-plan" aria-labelledby="action-plan-title"><div className="section-heading"><div><h2 id="action-plan-title">Action plan</h2><p className="muted text-sm">Open work for {p.name} from every programme, referral, review and safety case, in one order.</p></div><Button variant="outline" size="sm" disabled={loading} onClick={load}><RefreshCw size={15}/>Refresh</Button></div>
  {error&&<p role="alert">{error}</p>}
  {plan&&(plan.items.length?<>{plan.unowned>0&&<p className="notice amber-notice" role="status">{plan.unowned} item{plan.unowned===1?'':'s'} without a current eligible owner. {plan.canAssign?'Assign an owner below.':'They stay in the responsible queue shown until someone takes ownership.'}</p>}
   <ol className="revision-list action-plan-list">{plan.items.map((i:any)=><li key={i.key}><div><span className={`tag ${['escalated','overdue'].includes(i.attention)?'amber':''}`}>{ATTENTION_LABEL[i.attention]??i.attention}</span> <span className="tag">{KIND_LABEL[i.kind]??i.kind}</span> <strong>{i.title}</strong></div>
    <p>{i.reason}</p>
    <p className="muted text-sm">Owner: {i.owner?`${i.owner.displayName}${i.owner.eligible?'':' (no current access)'}`:'none'}{i.queue?` · Queue: ${i.queue}`:''} · Due: {i.due??'not set'}{i.daysOverdue?` (${i.daysOverdue} day${i.daysOverdue===1?'':'s'} overdue)`:''} · Urgency: {i.urgency} · Status: {i.status}</p>
    {i.sources.length>1&&<p className="muted text-sm">Sources: {i.sources.map((s:any)=>s.label).join('; ')}</p>}
    {i.ownershipGap&&<p className="notice amber-notice">{i.ownershipGap}</p>}
    {i.assignVia==='action-plan'&&(i.canAssign||i.canClaim)&&<Assign item={i} plan={plan} p={p} busy={busy} command={command} done={load}/>}
    {i.ownershipGap&&i.assignVia==='governance'&&<p className="muted text-sm">A clinician with access reassigns safety cases under Clinical governance.</p>}
    {i.ownershipGap&&i.assignVia==='outreach'&&<p className="muted text-sm">Reassign outreach work on the Outreach page.</p>}
   </li>)}</ol><p className="subtle-note">{plan.rules}</p></>:<p className="muted">No open work for this patient.</p>)}
 </section>;
}
