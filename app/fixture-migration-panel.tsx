'use client';
import { useState } from 'react';
import { DatabaseZap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Snapshot } from '@/lib/saha/types';
// Slice 2d: owners run the fixture-marking migration as dry run, then apply that exact plan, and can reverse a batch.
export function FixtureMigrationPanel({data,busy,command}:{data:Snapshot;busy:boolean;command:(c:any,msg?:string)=>Promise<any>}){
 const [plan,setPlan]=useState<any>(null),[reason,setReason]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 if(!data.canManage)return null;
 const dryRun=async()=>{setLoading(true);try{const r=await fetch('/api/fixture-migration',{headers:{'x-saha-organisation':data.organisation.id},cache:'no-store'});const j:any=await r.json();if(!r.ok)throw Error(j.error);setPlan(j);setError('');}catch(e){setError(e instanceof Error?e.message:'Could not run the dry run.');}finally{setLoading(false);}};
 const run=async(body:any,msg:string)=>{const r=await command(body,msg);if(r){setReason('');await dryRun();}};
 const d=plan?.dryRun;
 return <section className="panel member-panel" aria-labelledby="fixture-migration-heading"><div className="section-heading"><h2 id="fixture-migration-heading"><DatabaseZap size={19}/> Data migration: mark seeded fixtures</h2><span className="muted text-sm">Owners only · dry run first</span></div>
  <div className="grid gap-3 px-6 pb-5"><p className="muted">Records seeded before environment separation are not marked as synthetic fixtures, so the barrier that keeps fixtures away from destinations does not cover them. The dry run counts what would change; applying marks exactly the records it listed and can be reversed as a batch. Each marked record gets a revision with your reason.</p>
  <div className="flex flex-wrap gap-3"><Button variant="outline" disabled={busy||loading} onClick={dryRun}>{loading?'Checking…':'Run dry run'}</Button></div>
  {d&&<div role="status" className="notice"><div><strong>{d.candidates.length} to mark</strong> · {d.rejected.length} rejected for review · {d.alreadyMarked} already marked · {d.outOfScope} outside your care teams · {d.examined} records examined<br/><span className="text-sm">Plan {String(d.planHash).slice(0,16)}… {d.rejected.map((r:any)=>`${r.personId}: ${r.reason}`).join(' ')}</span></div></div>}
  {d&&d.candidates.length>0&&<form className="flex flex-wrap gap-3 items-end" onSubmit={e=>{e.preventDefault();void run({type:'fixtureMarkApply',planHash:d.planHash,reason},'Fixture records marked')}}><label className="field grow"><span>Reason for applying</span><Input value={reason} onChange={e=>setReason(e.target.value)} minLength={10} maxLength={500} required/></label><Button type="submit" disabled={busy||reason.trim().length<10}>Apply this dry run</Button></form>}
  {plan?.batches?.length>0&&<ul className="grid gap-2">{plan.batches.map((b:any)=><li key={b.id} className="notice"><div><strong>Batch {b.id.slice(0,8)}</strong> · {new Date(b.at).toLocaleString()} · {b.marked} marked, {b.rejected} rejected{b.revertedAt?` · reversed ${new Date(b.revertedAt).toLocaleString()} (${b.reverted} marks removed)`:''}{!b.revertedAt&&<Button className="ml-3" variant="outline" disabled={busy||reason.trim().length<10} onClick={()=>void run({type:'fixtureMarkRevert',batchId:b.id,reason},'Batch reversed')}>Reverse batch</Button>}</div></li>)}</ul>}
  {plan?.batches?.some((b:any)=>!b.revertedAt)&&!(d?.candidates.length>0)&&<label className="field"><span>Reason for reversing</span><Input value={reason} onChange={e=>setReason(e.target.value)} maxLength={500}/></label>}
  {error&&<p className="notice amber-notice" role="alert">{error}</p>}</div>
 </section>;
}
