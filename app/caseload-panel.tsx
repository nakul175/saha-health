'use client';
import { useCallback, useEffect, useState } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from '@/components/ui/table';
import { ROLE_LABEL, type Snapshot } from '@/lib/saha/types';
type Command=(c:any,s?:string)=>Promise<any>;
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="field"><span>{label}</span>{children}</label>}
const when=(s:string)=>new Date(s).toLocaleString();

// Slice 1b: workload by worker, responsibility gaps, bulk caseload transfers and receiving-worker acknowledgement.
// Slice 1f: due scheduled transfers apply automatically (or are held with a reason); a whole household can be transferred.
export function CaseloadPanel({data,busy,command}:{data:Snapshot;busy:boolean;command:Command}){
 const org=data.organisation.id;
 const [view,setView]=useState<any>(null),[error,setError]=useState('');
 const [from,setFrom]=useState<any>(null),[team,setTeam]=useState(''),[preview,setPreview]=useState<any>(null),[selected,setSelected]=useState<string[]>([]),[to,setTo]=useState(''),[later,setLater]=useState(false),[at,setAt]=useState(''),[reason,setReason]=useState(''),[hh,setHh]=useState('');
 const [refs,setRefs]=useState<Record<string,string>>({}),[cancelReason,setCancelReason]=useState('');
 const read=useCallback(async(q:Record<string,string>={})=>{const r=await fetch(`/api/caseload?${new URLSearchParams(q)}`,{cache:'no-store',headers:{'x-saha-organisation':org}});const j:any=await r.json();if(!r.ok)throw Error(j.error??'Caseloads are unavailable.');return j;},[org]);
 const load=useCallback(async()=>{try{setView(await read());setError('');}catch(e){setError(e instanceof Error?e.message:'Caseloads are unavailable.');}},[read]);
 useEffect(()=>{load();},[load,data.organisation.revision]);
 const showPreview=async(worker:any,teamId:string)=>{setTeam(teamId);setPreview(null);try{const j=await read({teamId,fromUserId:worker.userId});setPreview(j.preview);setSelected(j.preview.patients.filter((p:any)=>!p.scheduledIn).map((p:any)=>p.id));setTo('');setHh('');}catch(e){setError(e instanceof Error?e.message:'Caseload preview unavailable.');}};
 const openTransfer=(worker:any)=>{setFrom(worker);setReason('');setLater(false);setAt('');showPreview(worker,worker.teamIds[0]);};
 const run=async(body:any,ok:string)=>{const r=await command(body,ok);if(r)await load();return r;};
 const households:any[]=preview?[...new Map(preview.patients.filter((p:any)=>p.household).map((p:any)=>[p.household.id,p.household])).values()]:[];
 const household=households.find(h=>h.id===hh);
 const submit=async()=>{if(!from||!preview)return;const effectiveAt=later?new Date(at).toISOString():null;const body=household?{type:'caseloadHouseholdTransfer',teamId:team,fromUserId:from.userId,toUserId:to,householdId:household.id,householdVersion:household.version,effectiveAt,reason}:{type:'caseloadTransfer',teamId:team,fromUserId:from.userId,toUserId:to,personIds:selected,effectiveAt,reason};const r=await run(body,later?'Caseload transfer scheduled.':'Caseload transferred.');if(r)setFrom(null);};
 if(!view)return error?<section className="panel"><p role="alert" className="notice amber-notice">{error}</p></section>:null;
 const pending=(view.incoming??[]).filter((t:any)=>!t.acknowledged);
 const minAt=new Date(Date.now()+60000).toISOString().slice(0,16),maxAt=new Date(Date.now()+60*86400000).toISOString().slice(0,16);
 return <>
  {pending.length>0&&<section className="panel"><div className="section-heading"><h2><ArrowRightLeft size={19}/> Caseload handed over to you</h2></div><p className="muted">Review these patients and their open work, then acknowledge the handover. Acknowledgement is recorded on each patient.</p>
   {pending.map((t:any)=><div key={t.id} className="team-list-row"><div><strong>{t.moved} patients from {t.from}</strong><p>{t.team} · applied {when(t.effectiveAt)} · {t.reason}</p></div><div className="button-row"><Input aria-label={`Acknowledgement reference for transfer from ${t.from}`} placeholder="Reference, e.g. handover meeting" value={refs[t.id]??''} onChange={e=>setRefs({...refs,[t.id]:e.target.value})}/><Button disabled={busy||!(refs[t.id]??'').trim()} onClick={()=>run({type:'caseloadAcknowledge',transferId:t.id,version:t.version,reference:refs[t.id].trim()},'Handover acknowledged.')}>Acknowledge</Button></div></div>)}
  </section>}
  {view.steward&&<section className="panel member-panel"><div className="section-heading"><h2><ArrowRightLeft size={19}/> Caseloads and handovers</h2><span className="muted text-sm">Your teams only</span></div>
   {error&&<p role="alert" className="notice amber-notice">{error}</p>}
   <p className="muted text-sm">{view.rules}</p>
   <Table><TableHeader><TableRow><TableHead>Worker</TableHead><TableHead>Status</TableHead><TableHead>Patients</TableHead><TableHead>Open items</TableHead><TableHead>Urgent</TableHead><TableHead>Transfer</TableHead></TableRow></TableHeader><TableBody>{view.workers.map((x:any)=><TableRow key={x.userId}><TableCell><strong>{x.displayName}</strong><small className="audit-actor">{ROLE_LABEL[x.role as keyof typeof ROLE_LABEL]}</small></TableCell><TableCell><span className={`tag ${x.status==='active'?'success':'amber'}`}>{x.status}</span></TableCell><TableCell>{x.patients}</TableCell><TableCell>{x.openWork}</TableCell><TableCell>{x.urgent?<span className="tag amber">{x.urgent}</span>:0}</TableCell><TableCell>{x.patients>0&&x.teamIds.length>0&&<Button size="sm" variant="outline" disabled={busy} onClick={()=>openTransfer(x)} aria-label={`Transfer caseload of ${x.displayName}`}>Transfer caseload</Button>}</TableCell></TableRow>)}</TableBody></Table>
   <h3>Responsibility gaps</h3>{view.gapCount?<><ul className="revision-list">{view.gaps.map((g:any,n:number)=><li key={n}><strong>{g.name}</strong> · {g.detail}{g.urgent&&<span className="tag amber">Urgent work</span>}</li>)}</ul>{view.gapCount>view.gaps.length&&<p className="muted">{view.gapCount-view.gaps.length} more not shown.</p>}</>:<p className="muted">No gaps: every visible patient with open work has an active assigned worker in its team who owns that work.</p>}
   <h3>Transfers</h3>{view.transfers.length?<Table><TableHeader><TableRow><TableHead>From → to</TableHead><TableHead>Patients</TableHead><TableHead>Effective</TableHead><TableHead>State</TableHead><TableHead>Action</TableHead></TableRow></TableHeader><TableBody>{view.transfers.map((t:any)=><TableRow key={t.id}><TableCell>{t.from} → {t.to}<small className="audit-actor">{t.team}{t.household?' · household':''} · {t.reason}</small>{t.held&&<small className="audit-actor">Held {when(t.held.at)}: {t.held.reason}</small>}</TableCell><TableCell>{t.state==='applied'?`${t.moved} moved${t.skipped?`, ${t.skipped} skipped`:''}`:t.patients}</TableCell><TableCell>{when(t.effectiveAt)}</TableCell><TableCell><span className={`tag ${t.state==='held'?'amber':''}`}>{t.state==='applied'?(t.acknowledged?'acknowledged':'awaiting acknowledgement')+(t.automatic?' · applied automatically':''):t.state==='held'?'held: apply or cancel':t.due?'due to apply':t.state}</span></TableCell><TableCell>{(t.state==='scheduled'||t.state==='held')&&<div className="button-row">{(t.due||t.state==='held')&&<Button size="sm" disabled={busy} onClick={()=>run({type:'caseloadApply',transferId:t.id,version:t.version},'Transfer applied.')}>Apply</Button>}<Button size="sm" variant="ghost" disabled={busy||cancelReason.trim().length<10} onClick={()=>run({type:'caseloadCancel',transferId:t.id,version:t.version,reason:cancelReason},'Transfer cancelled.')}>Cancel</Button></div>}</TableCell></TableRow>)}</TableBody></Table>:<p className="muted">No caseload transfers yet.</p>}
   {view.transfers.some((t:any)=>t.state==='scheduled'||t.state==='held')&&<Field label="Reason, for cancelling a scheduled or held transfer"><Input value={cancelReason} onChange={e=>setCancelReason(e.target.value)} placeholder="At least ten characters"/></Field>}
  </section>}
  <Dialog open={!!from} onOpenChange={o=>!o&&setFrom(null)}><DialogContent className="wide-dialog"><DialogHeader><DialogTitle>Transfer caseload · {from?.displayName}</DialogTitle><DialogDescription>Selected patients move with all their open work. The receiving worker must acknowledge. A scheduled transfer applies automatically the first time Saha is used at or after its effective time; patients whose assignment changes before then are skipped, not moved.</DialogDescription></DialogHeader>
   {from&&<div className="stack-form">
    {from.teamIds.length>1&&<Field label="Team"><Select value={team} onValueChange={t=>showPreview(from,t)}><SelectTrigger aria-label="Transfer team"><SelectValue/></SelectTrigger><SelectContent>{view.teams.filter((t:any)=>from.teamIds.includes(t.id)).map((t:any)=><SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></Field>}
    {!preview?<p className="notice">Loading caseload…</p>:<>
     <p>{preview.total} patients assigned in this team{preview.overflow?`; the first ${preview.patients.length} are shown. Transfer in batches.`:'.'}</p>
     {households.length>0&&<Field label="Transfer by"><Select value={hh||'selected'} onValueChange={v=>setHh(v==='selected'?'':v)}><SelectTrigger aria-label="Transfer by"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="selected">Selected patients</SelectItem>{households.map(h=><SelectItem key={h.id} value={h.id}>Whole household: {h.label}</SelectItem>)}</SelectContent></Select></Field>}
     {household&&<p className="notice">Every current member of {household.label} held by {from.displayName} in this team moves as one transfer. A member outside your care scope stops the transfer; members held by another worker stay where they are.</p>}
     <div className="check-list">{preview.patients.map((p:any)=><label key={p.id} className="check-row"><Checkbox disabled={!!p.scheduledIn||!!household} checked={household?p.household?.id===household.id:selected.includes(p.id)} onCheckedChange={v=>setSelected(v?[...selected,p.id]:selected.filter(x=>x!==p.id))}/>{p.name} · {p.age} years · {p.village} · {p.openWork} open{p.urgent?<span className="tag amber">{p.urgent} urgent</span>:null}{p.scheduledIn&&<span className="tag">already scheduled</span>}</label>)}</div>
     <Field label="Receiving worker"><Select value={to} onValueChange={setTo}><SelectTrigger aria-label="Receiving worker"><SelectValue placeholder="Choose an active care worker"/></SelectTrigger><SelectContent>{preview.recipients.map((r:any)=><SelectItem key={r.userId} value={r.userId}>{r.displayName} · {ROLE_LABEL[r.role as keyof typeof ROLE_LABEL]}</SelectItem>)}</SelectContent></Select></Field>
     {!preview.recipients.length&&<p className="notice amber-notice">No other active care worker is in this team. Invite or add one first; open work cannot be left without an owner.</p>}
     <label className="check-row"><Checkbox checked={later} onCheckedChange={v=>setLater(v===true)}/>Schedule for a later effective time</label>
     {later&&<Field label="Effective at"><Input type="datetime-local" min={minAt} max={maxAt} value={at} onChange={e=>setAt(e.target.value)}/></Field>}
     <Field label="Reason for transfer"><Input value={reason} onChange={e=>setReason(e.target.value)} placeholder="For example, worker on leave from Monday"/></Field>
     <Button disabled={busy||(!household&&!selected.length)||!to||reason.trim().length<10||(later&&!at)} onClick={submit}>{household?(later?'Schedule household transfer':'Transfer household now'):later?`Schedule transfer of ${selected.length}`:`Transfer ${selected.length} now`}</Button>
    </>}
   </div>}
  </DialogContent></Dialog>
 </>;
}
