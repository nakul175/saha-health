'use client';
import { useState } from 'react';
import { FileUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/native-select';
import type { Snapshot } from '@/lib/saha/types';
// Slice 2h: controlled import of programme enrolments and external identifiers for existing people, and the
// downloadable rejection report for any import dry run. Dry run first; applying changes exactly the accepted rows.
const MAX=16000;
const KINDS={enrolments:{label:'Programme enrolments',columns:'person,pack,version,episode_label,start_date',help:'person is a Saha record id or an identifier written issuer:value; version may be left empty for the adopted version; start_date is YYYY-MM-DD or empty.'},identifiers:{label:'External identifiers',columns:'person,issuer,identifier',help:'issuer is a short code such as rch (12 digits) or nikshay (6 to 10 digits); ABHA numbers are linked through ABHA verification, not imported.'}} as const;
type Kind=keyof typeof KINDS;
// Download the rejection report for a dry run. The file travels in the request body; the response is a CSV export.
export async function downloadRejections(orgId:string,kind:'people'|'workforce'|Kind,csv:string){
 const r=await fetch('/api/import-rejections',{method:'POST',headers:{'content-type':'application/json','x-saha-organisation':orgId},body:JSON.stringify({kind,csv}),cache:'no-store'});
 if(!r.ok)throw Error(((await r.json()) as any).error);
 const url=URL.createObjectURL(await r.blob()),a=document.createElement('a');a.href=url;a.download='saha-import-rejections.csv';a.click();URL.revokeObjectURL(url);
 return {exportId:r.headers.get('x-saha-export-id')??'',sha256:r.headers.get('x-saha-content-sha256')??''};
}
export function RecordImportPanel({data,busy,command}:{data:Snapshot;busy:boolean;command:(c:any,msg?:string)=>Promise<any>}){
 const [kind,setKind]=useState<Kind>('enrolments'),[csv,setCsv]=useState(''),[plan,setPlan]=useState<any>(null),[reason,setReason]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(false),[done,setDone]=useState<any>(null),[report,setReport]=useState<{exportId:string;sha256:string}|null>(null);
 const m=data.membership,eligible=m.status==='active'&&['clinician','supervisor'].includes(m.role)&&(m.isOwner||m.role==='supervisor'||(data.delegatedAuthority??[]).some(d=>d.kind==='team-supervision'));
 if(!eligible)return null;
 // Names are resolved in the browser from the people this member already holds; the API returns ids only.
 const who=(id?:string)=>{if(!id)return '';const p=data.people.find(x=>x.id===id);return p?`${p.name} (${id.slice(0,8)})`:id.slice(0,8);};
 const reset=()=>{setPlan(null);setDone(null);setReport(null);};
 const change=(text:string)=>{setCsv(text);reset();};
 const choose=async(file?:File)=>{if(!file)return;if(file.size>MAX){setError(`The file is larger than ${MAX.toLocaleString('en-IN')} bytes. Split it into smaller batches.`);return;}change(await file.text());setError('');};
 const dryRun=async()=>{setLoading(true);try{const r=await fetch('/api/record-import',{method:'POST',headers:{'content-type':'application/json','x-saha-organisation':data.organisation.id},body:JSON.stringify({kind,csv}),cache:'no-store'});const j:any=await r.json();if(!r.ok)throw Error(j.error);setPlan(j);setDone(null);setReport(null);setError('');}catch(e){setPlan(null);setError(e instanceof Error?e.message:'Could not run the dry run.');}finally{setLoading(false);}};
 const rejections=async()=>{setLoading(true);try{setReport(await downloadRejections(data.organisation.id,kind,csv));setError('');}catch(e){setError(e instanceof Error?e.message:'Could not download the rejection report.');}finally{setLoading(false);}};
 const apply=async()=>{const r=await command({type:'recordImportApply',kind,csv,planHash:plan.planHash,reason},kind==='enrolments'?'Enrolments imported':'Identifiers imported');if(r){setDone(r.result??r);setPlan(null);setReason('');}};
 const k=plan?.counts,info=KINDS[kind];
 return <section className="panel member-panel" aria-labelledby="record-import-heading"><div className="section-heading"><h2 id="record-import-heading"><FileUp size={19}/> Import enrolments or identifiers for existing people</h2><span className="muted text-sm">Owners and supervisors · dry run first</span></div>
  <div className="grid gap-3 px-6 pb-5"><p className="muted">For people already in Saha, in teams you belong to and supervise. Up to 100 rows and {MAX.toLocaleString('en-IN')} bytes. The dry run checks each row; only accepted rows are applied, each record gets a revision, and the batch is audited with its counts. Visits are not imported.</p>
  <label className="field"><span>What to import</span><NativeSelect value={kind} onChange={e=>{setKind(e.target.value as Kind);reset();}}>{(Object.keys(KINDS) as Kind[]).map(x=><option key={x} value={x}>{KINDS[x].label}</option>)}</NativeSelect></label>
  <p className="muted text-sm">Columns: {info.columns}. {info.help}</p>
  <label className="field"><span>CSV file</span><Input type="file" accept=".csv,text/csv" onChange={e=>void choose(e.target.files?.[0])}/></label>
  <label className="field"><span>Or paste the CSV</span><Textarea rows={5} value={csv} maxLength={MAX} onChange={e=>change(e.target.value)} placeholder={info.columns}/></label>
  <div className="flex flex-wrap gap-3"><Button variant="outline" disabled={busy||loading||!csv.trim()} onClick={dryRun}>{loading?'Checking…':'Run dry run'}</Button>{plan&&k.rejected>0&&<Button variant="outline" disabled={busy||loading} onClick={rejections}>Download rejection report</Button>}</div>
  {error&&<p role="alert" className="notice amber-notice">{error}</p>}
  {report&&<p role="status" className="notice">Rejection report {report.exportId.slice(0,8)} downloaded · SHA-256 {report.sha256.slice(0,12)}… · row numbers and reasons only</p>}
  {plan&&<div role="status" className="notice"><div><strong>{k.accepted} to apply</strong> · {k.rejected} rejected · {k.rows} rows<br/><span className="text-sm">Plan {String(plan.planHash).slice(0,16)}…</span></div></div>}
  {plan&&<table className="w-full text-sm" aria-label="Dry run rows"><thead><tr><th className="text-left">Row</th><th className="text-left">Result</th><th className="text-left">Record</th><th className="text-left">Details</th></tr></thead><tbody>{plan.rows.map((r:any)=><tr key={r.row}><td>{r.row}</td><td>{r.status==='accepted'?'Accepted':'Rejected'}</td><td>{who(r.personId)}</td><td>{r.reasons.join(' ')||(kind==='enrolments'?'Episode will be opened.':'Identifier will be recorded.')}{r.conflict?` Other record: ${who(r.conflict.personId)}.`:''}</td></tr>)}</tbody></table>}
  {plan&&k.accepted>0&&<form className="flex flex-wrap gap-3 items-end" onSubmit={e=>{e.preventDefault();void apply();}}><label className="field grow"><span>Reason for this import</span><Input value={reason} onChange={e=>setReason(e.target.value)} minLength={10} maxLength={500} required/></label><Button type="submit" disabled={busy||reason.trim().length<10}>Apply {k.accepted} {k.accepted===1?'row':'rows'}</Button></form>}
  {done&&<div role="status" className="notice"><div><strong>{done.counts?.applied} applied</strong> to {done.counts?.records} {done.counts?.records===1?'record':'records'} · batch {String(done.batchId).slice(0,8)} · {done.counts?.rejected} rejected and not applied<br/><span className="text-sm">Rows {done.rows?.join(', ')}</span></div></div>}
  </div></section>;
}
