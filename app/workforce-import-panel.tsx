'use client';
import { useState } from 'react';
import { Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { downloadRejections } from './record-import-panel';
import type { Snapshot } from '@/lib/saha/types';
// Slice 10d: owners import the workforce roster an institution keeps as a spreadsheet. Dry run first (nothing is stored),
// download the rejection report, then apply exactly the previewed plan. Names and account codes are read from the file in
// this browser; the server's dry run returns row numbers, actions and reasons only.
const MAX=16000,COLUMNS='name,account_code,role,team,status,external_staff_id';
const ACTION:Record<string,string>={invite:'Invite',update:'Update',suspend:'Suspend',none:'No change',conflict:'Conflict',rejected:'Rejected'};
// Display-only reading of the file the owner holds; the server parses and decides.
function table(text:string):string[][]{
 const rows:string[][]=[];let row:string[]=[],field='',quoted=false,i=0;const s=text.replace(/^﻿/,'');
 const end=()=>{row.push(field);field='';};
 while(i<s.length){const ch=s[i];
  if(quoted){if(ch==='"'){if(s[i+1]==='"'){field+='"';i+=2;continue;}quoted=false;i++;continue;}field+=ch;i++;continue;}
  if(ch==='"'&&field===''){quoted=true;i++;continue;}
  if(ch===','){end();i++;continue;}
  if(ch==='\r'||ch==='\n'){end();if(row.some(x=>x.trim()!==''))rows.push(row);row=[];i+=ch==='\r'&&s[i+1]==='\n'?2:1;continue;}
  field+=ch;i++;}
 end();if(row.some(x=>x.trim()!==''))rows.push(row);return rows;
}
export function WorkforceImportPanel({data,busy,command}:{data:Snapshot;busy:boolean;command:(c:any,msg?:string)=>Promise<any>}){
 const [csv,setCsv]=useState(''),[plan,setPlan]=useState<any>(null),[reason,setReason]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(false),[done,setDone]=useState<any>(null),[report,setReport]=useState<{exportId:string;sha256:string}|null>(null);
 if(!data.canManage)return null;
 const t=table(csv),head=(t[0]??[]).map(x=>x.trim().toLowerCase());
 const cell=(row:number,c:string)=>(t[row]?.[head.indexOf(c)]??'').trim();
 const reset=()=>{setPlan(null);setDone(null);setReport(null);};
 const change=(text:string)=>{setCsv(text);reset();};
 const choose=async(file?:File)=>{if(!file)return;if(file.size>MAX){setError(`The file is larger than ${MAX.toLocaleString('en-IN')} bytes. Split it into smaller batches.`);return;}change(await file.text());setError('');};
 const dryRun=async()=>{setLoading(true);try{const r=await fetch('/api/workforce-import',{method:'POST',headers:{'content-type':'application/json','x-saha-organisation':data.organisation.id},body:JSON.stringify({csv}),cache:'no-store'});const j:any=await r.json();if(!r.ok)throw Error(j.error);setPlan(j);setDone(null);setReport(null);setError('');}catch(e){setPlan(null);setError(e instanceof Error?e.message:'Could not run the dry run.');}finally{setLoading(false);}};
 const rejections=async()=>{setLoading(true);try{setReport(await downloadRejections(data.organisation.id,'workforce',csv));setError('');}catch(e){setError(e instanceof Error?e.message:'Could not download the rejection report.');}finally{setLoading(false);}};
 const apply=async()=>{const r=await command({type:'workforceImportApply',csv,planHash:plan.planHash,reason},'Workforce roster imported');if(r){setDone(r.result??r);setPlan(null);setReport(null);setReason('');}};
 const k=plan?.counts,toApply=k?k.invite+k.update+k.suspend:0;
 return <section className="panel member-panel" aria-labelledby="workforce-import-heading"><div className="section-heading"><h2 id="workforce-import-heading"><Users size={19}/> Import a workforce roster from a CSV file</h2><span className="muted text-sm">Owners · dry run first</span></div>
  <div className="grid gap-3 px-6 pb-5"><p className="muted">Upload the roster your institution keeps as a spreadsheet. The dry run lists the invitations that would be created, the memberships that would change, rows that are rejected and conflicts left for review; nothing is stored until you apply. Applying changes exactly the previewed plan and is refused if anything changed since. People missing from the file are never suspended; only a row marked left suspends someone, and never an owner or yourself.</p>
  <p className="muted text-sm">Columns: {COLUMNS} (external_staff_id is optional). Role is asha, clinician, supervisor or admin; team is a team name, several separated by semicolons; status is active or left. Up to 100 rows and {MAX.toLocaleString('en-IN')} bytes. Invitations are ordinary account-bound invitations that expire after 72 hours.</p>
  <label className="field"><span>CSV file</span><Input type="file" accept=".csv,text/csv" onChange={e=>void choose(e.target.files?.[0])}/></label>
  <label className="field"><span>Or paste the CSV</span><Textarea rows={5} value={csv} maxLength={MAX} onChange={e=>change(e.target.value)} placeholder={COLUMNS}/></label>
  <div className="flex flex-wrap gap-3"><Button variant="outline" disabled={busy||loading||!csv.trim()} onClick={dryRun}>{loading?'Checking…':'Run dry run'}</Button>{plan&&(k.rejected>0||k.conflict>0)&&<Button variant="outline" disabled={busy||loading} onClick={rejections}>Download rejection report</Button>}</div>
  {error&&<p role="alert" className="notice amber-notice">{error}</p>}
  {report&&<p role="status" className="notice">Rejection report {report.exportId.slice(0,8)} downloaded · SHA-256 {report.sha256.slice(0,12)}… · row numbers and reasons only</p>}
  {plan&&<div role="status" className="notice"><div><strong>{toApply} to apply</strong> · {k.invite} invitations · {k.update} updates · {k.suspend} suspensions · {k.unchanged} unchanged · {k.conflict} conflicts · {k.rejected} rejected · {k.rows} rows{k.staffIds>0?` · ${k.staffIds} staff ids to record`:''}<br/><span className="text-sm">Plan {String(plan.planHash).slice(0,16)}…</span></div></div>}
  {plan&&<table className="w-full text-sm" aria-label="Dry run rows"><thead><tr><th scope="col" className="text-left">Row</th><th scope="col" className="text-left">Person</th><th scope="col" className="text-left">Result</th><th scope="col" className="text-left">Role and teams</th><th scope="col" className="text-left">Details</th></tr></thead><tbody>{plan.rows.map((r:any)=><tr key={r.row}><td>{r.row}</td><td>{cell(r.row,'name')||'—'}<br/><span className="muted text-sm">{cell(r.row,'account_code').slice(0,8)}</span></td><td>{ACTION[r.action]}</td><td>{r.role?`${r.role}${r.teams?.length?` · ${r.teams.join(', ')}`:''}`:''}</td><td>{r.reasons.length?r.reasons.join(' '):r.detail}</td></tr>)}</tbody></table>}
  {plan&&toApply>0&&<form className="flex flex-wrap gap-3 items-end" onSubmit={e=>{e.preventDefault();void apply();}}><label className="field grow"><span>Reason for this import</span><Input value={reason} onChange={e=>setReason(e.target.value)} minLength={10} maxLength={500} required placeholder="Source and date of the roster"/></label><Button type="submit" disabled={busy||reason.trim().length<10}>Apply exactly this plan</Button></form>}
  {done&&<div role="status" className="notice"><div><strong>{done.counts?.invite} invited · {done.counts?.update} updated · {done.counts?.suspend} suspended</strong> · {done.counts?.conflict} conflicts and {done.counts?.rejected} rejected rows not applied · batch {String(done.batchId).slice(0,8)}<br/><span className="text-sm">Rows {done.rows?.join(', ')}</span>
   {done.invitations?.length>0&&<><p>Share each invitation code only with its account. Codes expire in 72 hours. Copy them now; this screen does not show them again.</p><Textarea aria-label="Invitation codes" readOnly rows={Math.min(8,done.invitations.length+1)} value={done.invitations.map((i:any)=>`${(t[i.row]?.[head.indexOf('name')]??'').trim()},${i.accountCode},${i.token}`).join('\n')}/></>}</div></div>}
  </div></section>;
}
