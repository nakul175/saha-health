'use client';
import { useState } from 'react';
import { ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import type { Snapshot } from '@/lib/saha/types';
type Command=(c:any,s?:string)=>Promise<any>;
// Lines: account code, name, role, teams separated by semicolons, active or left.
export function parseRoster(text:string){return text.split(/\r?\n/).map(l=>l.trim()).filter(l=>l&&!l.startsWith('#')).map(l=>{const [accountCode='',name='',role='',teams='',status='active']=l.split(',').map(x=>x.trim());return {accountCode:accountCode.toUpperCase(),name,role:role.toLowerCase(),teams:teams?teams.split(';').map(x=>x.trim()).filter(Boolean):[],status:status.toLowerCase()};});}

// Slice 1d: owners reconcile membership with the institution's roster; preview first, apply exactly that preview.
export function RosterPanel({data,busy,command}:{data:Snapshot;busy:boolean;command:Command}){
 const [text,setText]=useState(''),[complete,setComplete]=useState(false),[preview,setPreview]=useState<any>(null),[error,setError]=useState(''),[reason,setReason]=useState(''),[applied,setApplied]=useState<any>(null);
 if(!data.canManage)return null;
 const rows=()=>parseRoster(text);
 const doPreview=async()=>{setError('');setApplied(null);try{const r=await fetch('/api/roster',{method:'POST',headers:{'Content-Type':'application/json','x-saha-organisation':data.organisation.id},body:JSON.stringify({rows:rows(),complete})});const j:any=await r.json();if(!r.ok)throw Error(j.error??'Preview failed.');setPreview(j);}catch(e){setPreview(null);setError(e instanceof Error?e.message:'Preview failed.');}};
 const apply=async()=>{const r=await command({type:'rosterApply',rows:rows(),complete,previewHash:preview.hash,reason},'Roster applied.');if(r){setApplied(r);setPreview(null);}};
 return <section className="panel member-panel"><div className="section-heading"><h2><ListChecks size={19}/> Roster sync</h2><span className="muted text-sm">Up to 100 rows per batch</span></div>
  <p className="muted text-sm">One line per person: account code, name, role (asha, clinician, supervisor, admin), teams separated by semicolons, and active or left. Roster sync invites, updates roles and teams, and suspends people who left. It never removes anyone, never reactivates a local suspension and never suspends an owner.</p>
  <Textarea aria-label="Roster lines" rows={6} value={text} onChange={e=>{setText(e.target.value);setPreview(null);}} placeholder={'3F9A21C0B7D4E6F8A1B2C3D4,Sunita Devi,asha,Care team,active'}/>
  <label className="check-row"><Checkbox checked={complete} onCheckedChange={v=>{setComplete(v===true);setPreview(null);}}/>This is the complete roster: suspend active members who are not listed</label>
  <Button variant="outline" disabled={!text.trim()} onClick={doPreview}>Preview changes</Button>
  {error&&<p role="alert" className="notice amber-notice">{error}</p>}
  {preview&&<div className="stack-form"><p>{Object.entries(preview.counts).map(([k,v])=>`${v} ${k}`).join(' · ')}</p>
   {preview.errors.length>0&&<ul className="revision-list">{preview.errors.map((e:string)=><li key={e} className="amber-notice">{e}</li>)}</ul>}
   <ul className="revision-list">{preview.actions.filter((a:any)=>a.action!=='none').map((a:any)=><li key={a.accountCode+a.action}><span className="tag">{a.action}</span> <strong>{a.name}</strong> · {a.detail}</li>)}</ul>
   {!preview.errors.length&&<><Input aria-label="Reason for applying the roster" placeholder="Source and date of the roster, at least ten characters" value={reason} onChange={e=>setReason(e.target.value)}/><Button disabled={busy||reason.trim().length<10} onClick={apply}>Apply exactly this preview</Button></>}</div>}
  {applied&&<div className="notice"><p>{Object.entries(applied.counts).map(([k,v])=>`${v} ${k}`).join(' · ')}</p>{applied.invitations.length>0&&<><p>Share each invitation code only with its account. Codes expire in 72 hours. Copy them now; this screen does not show them again.</p><Textarea aria-label="Invitation codes" readOnly rows={Math.min(8,applied.invitations.length+1)} value={applied.invitations.map((i:any)=>`${i.name},${i.accountCode},${i.token}`).join('\n')}/></>}</div>}
 </section>;
}
