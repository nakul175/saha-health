'use client';
import { useState } from 'react';
import { Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Snapshot, Visit } from '@/lib/saha/types';
import { reducePhoto } from '@/lib/saha/photo';
const PURPOSES:[string,string][]=[['wound-or-skin','Wound or skin'],['document-or-card','Document or card'],['medicine-packaging','Medicine packaging'],['voice-note','Voice note'],['other-clinical','Other clinical']];

// Slice 2b: photos and voice notes on a draft visit; read-only once the visit is confirmed.
export function MediaPanel({data,v,care,busy,onSnapshot}:{data:Snapshot;v:Visit;care:boolean;busy:boolean;onSnapshot:(s:any)=>void}){
 const [file,setFile]=useState<File|null>(null),[purpose,setPurpose]=useState('wound-or-skin'),[reason,setReason]=useState(''),[error,setError]=useState(''),[working,setWorking]=useState(false);
 const org=data.organisation.id,items=(v.media??[]).filter(m=>!m.removedAt),draft=v.state==='draft'&&!v.voidedAt&&!v.supersededBy;
 const reload=async()=>{const r=await fetch('/api/workspace',{cache:'no-store',headers:{'x-saha-organisation':org}});if(r.ok)onSnapshot(await r.json());};
 const send=async(url:string,init:RequestInit)=>{setWorking(true);setError('');try{const r=await fetch(url,{...init,headers:{...(init.headers??{}),'Idempotency-Key':crypto.randomUUID(),'x-saha-organisation':org}});const j:any=await r.json();if(!r.ok)throw Error(j.error??'Media request failed.');await reload();return j;}catch(e){setError(e instanceof Error?e.message:'Media request failed.');}finally{setWorking(false);}};
 const src=(id:string)=>`/api/media/${id}?organisationId=${encodeURIComponent(org)}`;
 if(!items.length&&!(care&&draft))return null;
 return <section className="panel"><div className="section-heading"><h3><Paperclip size={17}/> Photos and voice notes</h3><span className="muted text-sm">Photos reduced on this device · 256 KB each · {draft?'draft':'locked with the confirmed visit'}</span></div>
  {error&&<p role="alert" className="notice amber-notice">{error}</p>}
  {items.map(m=><div key={m.id} className="ehr-item"><strong>{PURPOSES.find(p=>p[0]===m.purpose)?.[1]??m.purpose}</strong><small className="muted">{m.mime} · {Math.round(m.size/1024)} KB · {new Date(m.at).toLocaleString()}</small>{m.mime.startsWith('image/')?<img src={src(m.id)} alt={`Attached ${m.purpose.replace(/-/g,' ')}`} style={{maxWidth:'240px',borderRadius:'8px'}}/>:<audio controls src={src(m.id)}/>}{care&&draft&&<div className="button-row"><Input aria-label="Reason to remove this media" placeholder="Reason to remove" value={reason} onChange={e=>setReason(e.target.value)}/><Button size="sm" variant="ghost" disabled={busy||working||reason.trim().length<5} onClick={()=>send(`/api/media/${m.id}`,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({reason:reason.trim()})}).then(()=>setReason(''))}>Remove</Button></div>}</div>)}
  {care&&draft&&<div className="form-grid"><Input aria-label="Choose a photo or voice note" type="file" accept="image/*,audio/webm,audio/ogg,audio/mpeg,audio/mp4" onChange={e=>setFile(e.target.files?.[0]??null)}/><Select value={purpose} onValueChange={setPurpose}><SelectTrigger aria-label="Media purpose"><SelectValue/></SelectTrigger><SelectContent>{PURPOSES.map(([id,label])=><SelectItem key={id} value={id}>{label}</SelectItem>)}</SelectContent></Select><Button variant="outline" disabled={busy||working||!file} onClick={async()=>{if(!file)return;let body:Blob=file,type=file.type;if(type.startsWith('image/')&&purpose!=='voice-note'){try{setWorking(true);body=await reducePhoto(file);type='image/jpeg';}catch(e){setError(e instanceof Error?e.message:'Photo could not be reduced.');setWorking(false);return;}setWorking(false);}const r=await send(`/api/media?visitId=${encodeURIComponent(v.id)}&purpose=${purpose}`,{method:'POST',headers:{'Content-Type':type},body});if(r)setFile(null);}}>Attach</Button></div>}
 </section>;
}
