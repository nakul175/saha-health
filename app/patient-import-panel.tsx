'use client';
import { useState } from 'react';
import { FileUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { Snapshot } from '@/lib/saha/types';
// Slice 2f: controlled patient import. Dry run first; applying creates exactly the accepted rows of that dry run.
const MAX=16000;
export function PatientImportPanel({data,busy,command}:{data:Snapshot;busy:boolean;command:(c:any,msg?:string)=>Promise<any>}){
 const [csv,setCsv]=useState(''),[plan,setPlan]=useState<any>(null),[reason,setReason]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(false),[done,setDone]=useState<any>(null);
 const m=data.membership,eligible=m.status==='active'&&m.role!=='admin'&&(m.isOwner||m.role==='supervisor'||(data.delegatedAuthority??[]).some(d=>d.kind==='team-supervision'));
 if(!eligible)return null;
 const teamName=(id?:string)=>data.teams.find(t=>t.id===id)?.name??id??'';
 const change=(text:string)=>{setCsv(text);setPlan(null);setDone(null);};
 const choose=async(file?:File)=>{if(!file)return;if(file.size>MAX){setError(`The file is larger than ${MAX} characters. Split it into smaller batches.`);return;}change(await file.text());setError('');};
 const dryRun=async()=>{setLoading(true);try{const r=await fetch('/api/patient-import',{method:'POST',headers:{'content-type':'application/json','x-saha-organisation':data.organisation.id},body:JSON.stringify({csv}),cache:'no-store'});const j:any=await r.json();if(!r.ok)throw Error(j.error);setPlan(j);setDone(null);setError('');}catch(e){setPlan(null);setError(e instanceof Error?e.message:'Could not run the dry run.');}finally{setLoading(false);}};
 const apply=async()=>{const r=await command({type:'patientImportApply',csv,planHash:plan.planHash,reason},'People imported');if(r){setDone(r.result??r);setPlan(null);setReason('');}};
 const k=plan?.counts;
 return <section className="panel member-panel" aria-labelledby="patient-import-heading"><div className="section-heading"><h2 id="patient-import-heading"><FileUp size={19}/> Import people from a CSV file</h2><span className="muted text-sm">Owners and supervisors · dry run first</span></div>
  <div className="grid gap-3 px-6 pb-5"><p className="muted">Columns: name, age, sex, village, programme, team (a team you belong to and supervise). Up to 100 rows and {MAX.toLocaleString()} characters. The dry run checks each row and looks for possible duplicates among the records you can see and earlier rows; only accepted rows are created, each with a revision, and the batch is audited with its counts.</p>
  <label className="field"><span>CSV file</span><Input type="file" accept=".csv,text/csv" onChange={e=>void choose(e.target.files?.[0])}/></label>
  <label className="field"><span>Or paste the CSV</span><Textarea rows={5} value={csv} maxLength={MAX} onChange={e=>change(e.target.value)} placeholder={'name,age,sex,village,programme,team'}/></label>
  <div className="flex flex-wrap gap-3"><Button variant="outline" disabled={busy||loading||!csv.trim()} onClick={dryRun}>{loading?'Checking…':'Run dry run'}</Button></div>
  {error&&<p role="alert" className="notice amber-notice">{error}</p>}
  {plan&&<div role="status" className="notice"><div><strong>{k.accepted} to create</strong> · {k.rejected} rejected · {k.duplicates} possible duplicates · {k.rows} rows{plan.markedSynthetic?' · will be marked synthetic in this environment':''}<br/><span className="text-sm">Plan {String(plan.planHash).slice(0,16)}…</span></div></div>}
  {plan&&<table className="w-full text-sm" aria-label="Dry run rows"><thead><tr><th className="text-left">Row</th><th className="text-left">Result</th><th className="text-left">Team</th><th className="text-left">Details</th></tr></thead><tbody>{plan.rows.map((r:any)=><tr key={r.row}><td>{r.row}</td><td>{r.status==='accepted'?'Accepted':r.status==='rejected'?'Rejected':'Possible duplicate'}</td><td>{teamName(r.teamId)}</td><td>{r.reasons.join(' ')||'Will be created.'}{r.candidates?.length?` Existing: ${r.candidates.map((c:any)=>c.personId.slice(0,8)).join(', ')}.`:''}</td></tr>)}</tbody></table>}
  {plan&&k.accepted>0&&<form className="flex flex-wrap gap-3 items-end" onSubmit={e=>{e.preventDefault();void apply();}}><label className="field grow"><span>Reason for this import</span><Input value={reason} onChange={e=>setReason(e.target.value)} minLength={10} maxLength={500} required/></label><Button type="submit" disabled={busy||reason.trim().length<10}>Create {k.accepted} {k.accepted===1?'person':'people'}</Button></form>}
  {done&&<div role="status" className="notice"><div><strong>{done.counts?.created} created</strong> · batch {String(done.batchId).slice(0,8)} · {done.counts?.rejected} rejected and {done.counts?.duplicates} possible duplicates not created<br/><span className="text-sm">{done.created?.map((c:any)=>`Row ${c.row} → ${c.personId.slice(0,8)}`).join(' · ')}</span></div></div>}
  </div></section>;
}
