'use client';
import { useState } from 'react';
import { PackagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Snapshot } from '@/lib/saha/types';
// Slice 4f: an owner uploads a programme pack manifest (JSON data, synthetic only), a clinician other than the uploader
// reviews the exact manifest, and an owner activates or retires it. Validation, conflicts and authority are decided by
// the server; this panel only shows what it returns. Installed packs are not clinically approved content.
const EXAMPLE={format:'saha-pack-manifest-2',id:'child_growth',version:1,name:'Child growth check',programme:'Child health',purpose:'Record a synthetic child growth check and a reported feeding concern.',
 questions:[{id:'weight',label:'Weight',fact:'weight',unit:'kg',required:true},{id:'feeding_concern',label:'Does the carer report a feeding concern?',options:['Yes','No'],required:true}],
 schedule:{followUpWithinDays:30,note:'illustrative'},escalation:[{id:'feeding-concern',label:'Reported feeding concern',condition:{questionId:'feeding_concern',operator:'eq',value:'Yes'},urgency:'review'}],
 governance:{population:{description:'Synthetic children enrolled in the local child-health episode.',eligibility:['Active child-health episode confirmed in this organisation']},mandatoryEvidence:['Confirmed visit facts and every required programme answer'],authorisedRoles:['asha','clinician'],workflowStates:[{id:'draft',label:'Draft capture',terminal:false},{id:'confirmed',label:'Confirmed record',terminal:true}],destinationMappings:[{id:'review',label:'Clinician review queue',destinationType:'referral',requiresApproval:true}],indicators:[{id:'completion',label:'Completed child checks',numerator:'Confirmed eligible encounters',denominator:'Eligible enrolled episodes'}],approvals:{business:true,clinical:true},effectiveFrom:'2026-01-01T00:00:00.000Z'},
 changeNote:'Synthetic illustrative pack for the installation workflow; not clinically approved.'};
const list=(xs:string[])=>xs.length?xs.join(', '):'none';
const STATE:Record<string,string>={staged:'Staged · awaiting independent review',approved:'Approved · awaiting owner activation',rejected:'Rejected',active:'Active',retired:'Retired (kept)'};
export function PackInstallationPanel({data,busy,command}:{data:Snapshot;busy:boolean;command:(c:any,msg?:string)=>Promise<any>}){
 const [view,setView]=useState<any>(null),[manifest,setManifest]=useState(''),[reason,setReason]=useState(''),[notes,setNotes]=useState<Record<string,string>>({}),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 if(!(data.canManage||data.membership.role==='clinician'))return null;
 const load=async()=>{setLoading(true);try{const r=await fetch('/api/pack-installations',{headers:{'x-saha-organisation':data.organisation.id},cache:'no-store'});const j:any=await r.json();if(!r.ok)throw Error(j.error);setView(j);setError('');}catch(e){setError(e instanceof Error?e.message:'Could not load pack installations.');}finally{setLoading(false);}};
 const run=async(c:any,msg:string)=>{const r=await command(c,msg);if(r){setNotes({});await load();}return r;};
 const stage=async()=>{let parsed:unknown;try{parsed=JSON.parse(manifest);}catch{setError('The manifest is not valid JSON.');return;}setError('');if(await run({type:'packInstallStage',manifest:parsed,reason},'Pack staged for independent review')){setManifest('');setReason('');}};
 const note=(id:string)=>notes[id]??'',setNote=(id:string,v:string)=>setNotes(n=>({...n,[id]:v}));
 return <section className="panel member-panel" aria-labelledby="pack-installation-heading"><div className="section-heading"><h2 id="pack-installation-heading"><PackagePlus size={19}/> Programme pack installation</h2><span className="muted text-sm">Owner uploads · another clinician reviews · owner activates</span></div>
  <div className="grid gap-3 px-6 pb-5">
  <p className="notice amber-notice" role="note">Installed packs remain synthetic configuration. Only complete v2 packs can now activate, after named clinical and business approvals are bound to the exact manifest. Existing active v1 packs and pinned encounters remain readable; a v1 pack cannot be newly activated. These approvals are not production or formal acceptance.</p>
  <p className="muted">A pack manifest is data only: questions, shared measurements with their fixed units, answer options, show-when conditions, a follow-up interval and escalation rules in the protocol rule vocabulary. Optional completionRules declare required question evidence; referralNeeds declare conditions, urgency and an explicit compatibility key or separate referrals. These remain synthetic governed contracts, not clinical acceptance. Episodes open only on activated versions. Retiring a version keeps it and its pinned episodes; it stops new episodes and migrations to it. Once a new version of an existing pack is active, use Programme pack versions to migrate open episodes when the manifest declares a mapping.</p>
  <div className="flex flex-wrap gap-3"><Button variant="outline" disabled={busy||loading} onClick={load}>{loading?'Loading…':view?'Refresh installations':'Show installations'}</Button></div>
  {view?.canStage&&<form className="grid gap-2" onSubmit={e=>{e.preventDefault();void stage()}}>
   <label className="field"><span>Pack manifest (JSON, at most {view.limits.manifestCharacters.toLocaleString()} characters)</span><textarea className="min-h-40 rounded-md border p-2 font-mono text-sm" value={manifest} onChange={e=>setManifest(e.target.value)} maxLength={view.limits.manifestCharacters*2} spellCheck={false} required/></label>
   <div className="flex flex-wrap gap-3 items-end"><label className="field"><span>Or read a .json file</span><input type="file" accept="application/json,.json" onChange={async e=>{const f=e.target.files?.[0];if(f)setManifest(await f.text());}}/></label><Button type="button" variant="outline" onClick={()=>setManifest(JSON.stringify(EXAMPLE,null,1))}>Insert synthetic example</Button></div>
   <div className="flex flex-wrap gap-3 items-end"><label className="field grow"><span>Reason for staging</span><Input value={reason} onChange={e=>setReason(e.target.value)} minLength={10} maxLength={500} required/></label><Button type="submit" disabled={busy||reason.trim().length<10||!manifest.trim()}>Validate and stage</Button></div>
  </form>}
  {view&&!view.installations.length&&<p role="status" className="notice">No programme pack has been installed in this organisation.</p>}
  {view?.installations.length>0&&<ul className="grid gap-3" aria-label="Programme pack installations">{view.installations.map((x:any)=><li key={x.id} className="notice grid gap-1"><div>
   <strong>{x.name}</strong> · {x.packId} v{x.version} · {x.programme} · <span className={`tag ${x.state==='active'?'blue':x.state==='rejected'||x.state==='retired'?'neutral':'amber'}`}>{STATE[x.state]}</span> · {x.complete?'complete definition':'legacy structural definition'}
   <p className="text-sm">{x.purpose} Staged by {x.stagedBy} on {new Date(x.stagedAt).toLocaleString()}: {x.reason}{x.review?` · ${x.review.decision==='approve'?'Approved':'Rejected'} by ${x.review.by}: ${x.review.reason}`:''}{x.state==='active'||x.state==='retired'?` · ${x.openEpisodes} open episodes on this version`:''}</p>
   <p className="text-sm">Questions: {list(x.questions.map((q:any)=>`${q.label}${q.unit?` (${q.unit})`:''}${q.options?` [${q.options.join('/')}]`:''}${q.when?` when ${q.when.id} = ${q.when.value}`:''}${q.required?'':' · optional'}`))}</p>
   <p className="text-sm">Schedule: {x.schedule??'none declared'}<br/>Escalation: {x.escalation??'none declared'}</p>
   {x.changes.map((c:any)=><p key={c.fromVersion} className="text-sm">Mapping v{c.fromVersion} → v{c.toVersion}: added {list(c.added.map((q:any)=>q.id+(q.required?' (required)':'')))} · removed {list(c.removed)} · renamed {list(c.renamed.map((r:any)=>`${r.from} → ${r.to}`))} · redefined {list(c.redefined)}</p>)}
   {x.conflicts.length>0&&<p className="text-sm" role="alert">Conflicts: {x.conflicts.join(' ')}</p>}
   <p className="muted text-xs">Manifest {String(x.manifestHash).slice(0,16)}… · history: {x.history.map((h:any)=>`${h.state} ${new Date(h.at).toLocaleDateString()} by ${h.by}`).join(' → ')}</p></div>
   {(x.canReview||x.canActivate||x.canRetire)&&<form className="flex flex-wrap gap-2 items-end" onSubmit={e=>e.preventDefault()}><label className="field grow"><span>Reason ({x.packId} v{x.version})</span><Input value={note(x.id)} onChange={e=>setNote(x.id,e.target.value)} minLength={10} maxLength={500}/></label>
    {x.canReview&&<><Button type="button" disabled={busy||note(x.id).trim().length<10} onClick={()=>run({type:'packInstallReview',installationId:x.id,manifestHash:x.manifestHash,decision:'approve',...(x.complete?{approval:'clinical'}:{}),reason:note(x.id)},x.complete?'Clinical approval recorded':'Pack approved for activation')}>{x.complete?'Approve clinically':'Approve structure'}</Button><Button type="button" variant="outline" disabled={busy||note(x.id).trim().length<10} onClick={()=>run({type:'packInstallReview',installationId:x.id,manifestHash:x.manifestHash,decision:'reject',reason:note(x.id)},'Pack rejected')}>Reject</Button></>}
   {x.canActivate&&<Button type="button" disabled={busy||note(x.id).trim().length<10||x.conflicts.length>0} onClick={()=>run({type:'packInstallActivate',installationId:x.id,manifestHash:x.manifestHash,...(x.complete?{businessApproval:true}:{}),reason:note(x.id)},'Pack version activated')}>{x.complete?'Business approve and activate':'Activate legacy pack'}</Button>}
    {x.canRetire&&<Button type="button" variant="outline" disabled={busy||note(x.id).trim().length<10} onClick={()=>run({type:'packInstallRetire',installationId:x.id,reason:note(x.id)},'Pack version retired')}>{x.state==='active'?'Retire':'Withdraw'}</Button>}
   </form>}
   {['staged','approved'].includes(x.state)&&x.uploadedByYou&&!x.canReview&&<p className="muted text-sm">You uploaded this version, so a different clinician must review it.</p>}
   {x.activationBlocked&&<p className="notice amber-notice" role="status">{x.activationBlocked}</p>}
  </li>)}</ul>}
  {error&&<p className="notice amber-notice" role="alert">{error}</p>}</div>
 </section>;
}
