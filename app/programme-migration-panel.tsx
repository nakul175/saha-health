'use client';
import { useState } from 'react';
import { GitBranch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Snapshot } from '@/lib/saha/types';
// Slice 4e: owners and clinicians review what a newer programme-pack version changes, dry-run the open episodes on
// older versions in their care scope, and apply exactly that plan. The server returns ids and counts; names come from
// the people this browser already holds.
const list=(xs:string[])=>xs.length?xs.join(', '):'none';
export function ProgrammeMigrationPanel({data,busy,command}:{data:Snapshot;busy:boolean;command:(c:any,msg?:string)=>Promise<any>}){
 const [view,setView]=useState<any>(null),[reason,setReason]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(false),[done,setDone]=useState<any>(null);
 if(!(data.canManage||data.membership.role==='clinician'))return null;
 const who=(id:string)=>data.people.find(p=>p.id===id)?.name??id;
 const dryRun=async()=>{setLoading(true);try{const r=await fetch('/api/programme-migration',{headers:{'x-saha-organisation':data.organisation.id},cache:'no-store'});const j:any=await r.json();if(!r.ok)throw Error(j.error);setView(j);setError('');}catch(e){setError(e instanceof Error?e.message:'Could not run the dry run.');}finally{setLoading(false);}};
 const apply=async(p:any)=>{const r=await command({type:'programmeMigrationApply',packId:p.packId,targetVersion:p.targetVersion,planHash:p.planHash,reason},'Programme episodes migrated');if(r){setDone(r.result??r);setReason('');await dryRun();}};
 return <section className="panel member-panel" aria-labelledby="programme-migration-heading"><div className="section-heading"><h2 id="programme-migration-heading"><GitBranch size={19}/> Programme pack versions</h2><span className="muted text-sm">Owners and clinicians · dry run first</span></div>
  <div className="grid gap-3 px-6 pb-5"><p className="muted">Each open episode stays on the pack version it opened on. When a newer version exists, the dry run lists what it changes and which open episodes in your care teams would move. Applying moves exactly those episodes, with a record revision and your reason for each; visits already recorded keep the version they were made under. Episodes that cannot move stay where they are and are listed for manual action.</p>
  <div className="flex flex-wrap gap-3"><Button variant="outline" disabled={busy||loading} onClick={dryRun}>{loading?'Checking…':'Run dry run'}</Button></div>
  {view&&<ul className="grid gap-1 text-sm" aria-label="Programme pack catalogue">{view.catalogue.map((c:any)=><li key={c.packId}><strong>{c.name}</strong> · versions {c.versions.join(', ')} · new episodes open on v{c.adoptedVersion}{c.latestVersion>c.adoptedVersion?` · v${c.latestVersion} available`:''}</li>)}</ul>}
  {view&&!view.plans.length&&<p role="status" className="notice">No pack has open episodes or new-episode use on an older version.</p>}
  {view?.plans.map((p:any)=><div key={p.packId} className="grid gap-2" role="status">
   <div className="notice"><div><strong>{p.name}: v{p.targetVersion}</strong> · {p.candidates.length} to migrate · {p.blocked.length} for manual action · {p.outOfScope} outside your care teams · {p.examined} open episodes on older versions<br/><span className="text-sm">{p.adoptionNote} Plan {String(p.planHash).slice(0,16)}…</span></div></div>
   {p.changes.map((c:any)=><div key={c.fromVersion} className="text-sm"><strong>v{c.fromVersion} → v{c.toVersion}</strong>{c.reviewedMapping?'':' · no reviewed mapping declared'}{c.note?` · ${c.note}`:''}<br/>Questions added: {list(c.added.map((q:any)=>q.id+(q.required?' (required)':'')))} · removed: {list(c.removed)} · renamed: {list(c.renamed.map((r:any)=>`${r.from} → ${r.to}`))} · redefined: {list(c.redefined)}<br/>Schedule: {c.schedule.changed?(c.schedule.to??'removed'):'unchanged'}<br/>Escalation: {c.escalation.changed?(c.escalation.to??'removed'):'unchanged'}</div>)}
   {p.candidates.length>0&&<ul className="grid gap-1 text-sm" aria-label={`${p.name} episodes to migrate`}>{p.candidates.map((x:any)=><li key={x.enrolmentId}>{who(x.personId)} · v{x.fromVersion} → v{p.targetVersion} · {x.openFollowUps} open follow-ups carried over · {x.keptVisits} recorded visits keep v{x.fromVersion}</li>)}</ul>}
   {p.blocked.length>0&&<ul className="grid gap-1 text-sm" aria-label={`${p.name} episodes for manual action`}>{p.blocked.map((x:any)=><li key={x.enrolmentId} className="notice amber-notice">{who(x.personId)} · stays on v{x.fromVersion}: {x.reason}</li>)}</ul>}
   {(p.candidates.length>0||p.adopts)&&<form className="flex flex-wrap gap-3 items-end" onSubmit={e=>{e.preventDefault();void apply(p)}}><label className="field grow"><span>Reason for applying ({p.name})</span><Input value={reason} onChange={e=>setReason(e.target.value)} minLength={10} maxLength={500} required/></label><Button type="submit" disabled={busy||reason.trim().length<10}>Apply this dry run</Button></form>}
  </div>)}
  {done&&<p role="status" className="notice">Batch {String(done.batchId).slice(0,8)}: {done.migrated} migrated, {done.blocked} left for manual action{done.adopted?'; new episodes now open on the new version':''}.</p>}
  {view?.batches?.length>0&&<ul className="grid gap-2" aria-label="Programme migration batches">{view.batches.map((b:any)=><li key={b.id} className="notice"><div><strong>Batch {b.id.slice(0,8)}</strong> · {new Date(b.at).toLocaleString()} · {b.packId} v{b.fromVersions.join('/')||'–'} → v{b.toVersion} · {b.migrated} migrated, {b.blocked} for manual action, {b.outOfScope} outside scope{b.adopted?` · adopted v${b.toVersion} for new episodes`:''}</div></li>)}</ul>}
  {error&&<p className="notice amber-notice" role="alert">{error}</p>}</div>
 </section>;
}
