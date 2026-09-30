'use client';
import { useCallback, useEffect, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Snapshot } from '@/lib/saha/types';
type Command=(c:any,s?:string)=>Promise<any>;
// Slice 1e: time-limited delegation of team supervision or reporting-only access.
const local=(iso:string)=>new Date(iso).toLocaleString();
export function DelegationPanel({data,busy,command}:{data:Snapshot;busy:boolean;command:Command}){
 const [view,setView]=useState<any>(null),[kind,setKind]=useState(''),[delegate,setDelegate]=useState(''),[teams,setTeams]=useState<string[]>([]),[days,setDays]=useState('7'),[reason,setReason]=useState(''),[revoke,setRevoke]=useState<Record<string,string>>({});
 const load=useCallback(async()=>{try{const r=await fetch('/api/delegations',{cache:'no-store',headers:{'x-saha-organisation':data.organisation.id}});if(r.ok)setView(await r.json());}catch{}},[data.organisation.id]);
 useEffect(()=>{if(data.role!=='admin'||data.membership.isOwner)load();},[load,data.role,data.membership.isOwner]);
 if(!view||(!view.grantable.length&&!view.delegations.length))return null;
 const g=view.grantable.find((x:any)=>x.kind===kind),candidates=g?g.delegates.filter((d:any)=>kind==='reporting'||teams.every(t=>d.teamIds.includes(t))):[];
 const run=async(body:any,ok:string)=>{const r=await command(body,ok);if(r)await load();return r;};
 const grant=()=>run({type:'delegationGrant',kind,delegateId:delegate,teamIds:teams,until:new Date(Date.now()+Number(days)*86400000).toISOString(),reason},'Delegation recorded.').then(r=>{if(r){setReason('');setDelegate('');}});
 return <section className="panel member-panel" aria-labelledby="delegation-title"><div className="section-heading"><h2 id="delegation-title"><KeyRound size={19}/> Delegated authority</h2><span className="muted text-sm">Time-limited · at most {view.maxDays} days · audited</span></div>
  {view.delegations.length?<ul className="revision-list">{view.delegations.map((d:any)=><li key={d.id} className="merge-case"><strong>{d.kindLabel}</strong> · {d.delegate} · {d.teams.join(', ')} <span className="tag">{d.state}</span>
   <p className="muted">From {d.grantor}, {local(d.from)} until {local(d.until)}. {d.reason}{d.revokedAt?` Revoked by ${d.revoker} on ${local(d.revokedAt)}: ${d.revokeReason}`:''}</p><p className="muted">{d.scope}</p>
   {d.canRevoke&&<div className="form-grid"><Input aria-label={`Reason to revoke delegation to ${d.delegate}`} placeholder="Why it ends now" value={revoke[d.id]??''} onChange={e=>setRevoke({...revoke,[d.id]:e.target.value})}/><Button variant="outline" disabled={busy||(revoke[d.id]??'').trim().length<10} onClick={()=>run({type:'delegationRevoke',delegationId:d.id,version:d.version,reason:revoke[d.id]},'Delegation revoked.')}>Revoke</Button></div>}</li>)}</ul>:<p className="muted">No delegations recorded.</p>}
  {view.grantable.length>0&&<div className="stack-form"><h3>Delegate for a limited time</h3><div className="form-grid">
   <Select value={kind} onValueChange={v=>{setKind(v);setTeams([]);setDelegate('');}}><SelectTrigger aria-label="Authority to delegate"><SelectValue placeholder="Authority to delegate"/></SelectTrigger><SelectContent>{view.grantable.map((x:any)=><SelectItem key={x.kind} value={x.kind}>{x.label}</SelectItem>)}</SelectContent></Select>
   <Select value={days} onValueChange={setDays}><SelectTrigger aria-label="Duration"><SelectValue/></SelectTrigger><SelectContent>{['1','7','14','30'].map(d=><SelectItem key={d} value={d}>{d==='1'?'1 day':`${d} days`}</SelectItem>)}</SelectContent></Select></div>
   {g&&<><p className="muted">{g.scope}</p><fieldset className="team-choices"><legend>Teams</legend>{g.teams.map((t:any)=><label key={t.id}><Checkbox checked={teams.includes(t.id)} onCheckedChange={v=>setTeams(v?[...teams,t.id]:teams.filter(x=>x!==t.id))}/>{t.name}</label>)}</fieldset>
    <Select value={delegate} onValueChange={setDelegate}><SelectTrigger aria-label="Delegate to"><SelectValue placeholder="Delegate to"/></SelectTrigger><SelectContent>{candidates.map((d:any)=><SelectItem key={d.userId} value={d.userId}>{d.displayName} · {d.role}</SelectItem>)}</SelectContent></Select></>}
   <Input aria-label="Reason for the delegation" placeholder="Reason, e.g. supervisor on leave" value={reason} onChange={e=>setReason(e.target.value)}/>
   <Button disabled={busy||!g||!delegate||!teams.length||reason.trim().length<10} onClick={grant}>Delegate</Button></div>}
 </section>;
}
