'use client';
import { useState } from 'react';
import { Search, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { currentIdentifiers, identifierRef } from '@/lib/saha/types';
import type { ExternalIdentifier, Person, Snapshot } from '@/lib/saha/types';
type Command=(c:any,s?:string)=>Promise<any>;

// Slice 10e: the issuers, origins and verification states below mirror lib/saha/record-import.ts KNOWN_ISSUERS and
// lib/saha/crosswalk.ts ORIGINS and VERIFICATIONS (the contract test compares them); they are written out here so the browser
// bundle does not carry server modules. The server validates every value again.
const ISSUERS:Record<string,string>={abha:'ABHA number',rch:'RCH ID',nikshay:'Ni-kshay ID'};
const LINK_ISSUERS=['rch','nikshay'];
const ORIGINS:Record<string,string>={'programme-card':'Programme card or booklet shown','programme-system':'Looked up in the programme\'s own system','person-reported':'Told by the person','referral-document':'Referral or discharge document'};
const VERIFICATIONS:Record<string,string>={unverified:'Not checked','document-seen':'Document seen','issuer-checked':'Checked with the issuer by a clinician or supervisor'};
type Match={personId:string;version:number;name:string;age:number;sex:string;village:string;issuer:string;identifier:string;source:string;verification:string;verified:boolean;recordedAt:string;merged:{survivorId:string|null}|null};
type Result={issuer:string;label:string;matches:Match[];searched:string;message?:string;limits:{perHour:number;noMatchPerHour:number;noMatchPerDay:number}};

// Find a person by one complete issuer identifier, inside the searcher's own care scope. Every search is recorded in the
// audit trail on the server; nothing is shown for a record outside the scope and a partial number is never searched.
export function IdentifierSearch({organisationId,open}:{organisationId:string;open:(personId:string)=>void}){
 const [issuer,setIssuer]=useState('abha'),[value,setValue]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<Result|null>(null);
 const search=async()=>{setBusy(true);setError('');try{const r=await fetch('/api/identifier-search',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json','x-saha-organisation':organisationId},body:JSON.stringify({issuer,identifier:value.trim()})}),j:Result&{error?:string}=await r.json();if(!r.ok)throw Error(j.error??'The search could not be completed.');setResult(j);}catch(e){setResult(null);setError(e instanceof Error?e.message:'The search could not be completed.');}finally{setBusy(false);}};
 return <section className="panel" aria-labelledby="identifier-search-title">
  <div className="section-heading"><div><h2 id="identifier-search-title">Find by identifier</h2><p className="muted text-sm">Enter a complete ABHA number, RCH ID or Ni-kshay ID. Only people in your own care scope are searched, and each search is recorded in the audit trail.</p></div></div>
  <form className="form-grid" onSubmit={e=>{e.preventDefault();if(!busy&&value.trim())void search();}}>
   <Select value={issuer} onValueChange={v=>{setIssuer(v);setResult(null);setError('');}}><SelectTrigger aria-label="Identifier type"><SelectValue/></SelectTrigger><SelectContent>{Object.entries(ISSUERS).map(([k,v])=><SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
   <Input aria-label="Identifier" placeholder={issuer==='abha'?'14 digits, or 91-1234-5678-9012':'The complete identifier'} value={value} onChange={e=>setValue(e.target.value)} maxLength={64} autoComplete="off" inputMode={issuer==='abha'?'numeric':'text'}/>
   <Button type="submit" disabled={busy||!value.trim()}><Search size={16}/>Search</Button>
  </form>
  {error&&<div className="notice amber-notice" role="alert">{error}</div>}
  {result&&<div role="status" aria-live="polite">
   {result.matches.length===0?<p className="muted">{result.message}</p>:<ul className="revision-list">{result.matches.map(m=><li key={m.personId}><strong>{m.name}</strong> · {m.age} years · {m.village} · {result.label} <code>{m.identifier}</code> · {m.source==='abha-link'?'linked ABHA':m.source==='import'?'imported':'linked'}{m.merged?' · merged record':''}<br/><span className="muted text-sm">{m.verification}{m.verified?'':' · not verified by Saha'} · recorded {new Date(m.recordedAt).toLocaleDateString()}</span><span className="button-row">{m.merged?(m.merged.survivorId?<Button size="sm" variant="outline" onClick={()=>open(m.merged!.survivorId!)}>Open the surviving record</Button>:<span className="muted text-sm">The surviving record is outside your scope.</span>):<Button size="sm" variant="outline" onClick={()=>open(m.personId)}>Open record</Button>}</span></li>)}</ul>}
   <p className="muted text-sm"><ShieldCheck size={14}/> {result.searched}</p>
  </div>}
 </section>;
}

// One person's programme identity crosswalk: the identifiers held now, where each came from and who recorded it, the full
// history, and forms to link, correct or withdraw. Values are shown masked; a correction needs the full new value.
export function IdentifiersPatient({data,p,busy,command}:{data:Snapshot;p:Person;busy:boolean;command:Command}){
 const [open,setOpen]=useState(false),[issuer,setIssuer]=useState('rch'),[value,setValue]=useState(''),[origin,setOrigin]=useState('programme-card'),[verification,setVerification]=useState('unverified'),[evidence,setEvidence]=useState(''),[reason,setReason]=useState(''),[corrects,setCorrects]=useState(''),[outcome,setOutcome]=useState('');
 const care=['asha','clinician','supervisor'].includes(data.role),steward=['clinician','supervisor'].includes(data.role);
 const current=currentIdentifiers(p),ledger:ExternalIdentifier[]=p.identifiers??[],who=(id:string)=>data.members.find(m=>m.userId===id)?.displayName??'a team member';
 const target=current.find(e=>identifierRef(e)===corrects);
 const done=(r:any,ok:string)=>{if(!r)return r;if(r.conflict){setOutcome('Not recorded: another record you can see already holds this identifier. An identity case was opened for two stewards to decide; nothing was merged and neither record was changed.');setReason('');return r;}setOutcome(ok);setValue('');setEvidence('');setReason('');setCorrects('');return r;};
 const link=()=>command({type:'identifierLink',personId:p.id,version:p.version,issuer:target?.issuer??issuer,identifier:value.trim(),origin,verification,...(evidence.trim()?{evidence:evidence.trim()}:{}),...(corrects?{corrects}:{}),reason}).then(r=>done(r,corrects?'Identifier corrected.':'Identifier linked.'));
 const label=(e:ExternalIdentifier)=>`${ISSUERS[e.issuer]??e.issuer} ${e.value}`;
 const how=(e:ExternalIdentifier)=>e.source==='import'?`Imported (batch ${e.imported?.batchId.slice(0,8)}, row ${e.imported?.row})`:`${e.kind==='withdraw'?'Withdrawn':e.kind==='correct'?'Corrected':'Linked'}${e.origin?` · ${ORIGINS[e.origin]??e.origin}`:''}`;
 return <><Button variant="outline" onClick={()=>setOpen(true)}>Programme identifiers</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="wide-dialog"><DialogHeader><DialogTitle>Programme identifiers · {p.name}</DialogTitle><DialogDescription>Identifiers from other programmes, with who recorded each and how it was checked. Saha never contacts an issuer: a check is the word of the person who recorded it. Nothing is merged automatically.</DialogDescription></DialogHeader>
  {care&&<div className="form-grid"><Input aria-label="Reason for an identifier change" placeholder="Reason for any change below, at least ten characters" value={reason} onChange={e=>setReason(e.target.value)} maxLength={500}/></div>}
  {outcome&&<p className="notice" role="status">{outcome}</p>}
  <section className="stack-form"><h3>Held now</h3>
   {p.abha?.state==='linked'&&<p>ABHA number <code>{p.abha.number}</code> · linked through ABHA verification (mock one-time code only)</p>}
   {current.length?<ul className="revision-list">{current.map(e=><li key={identifierRef(e)}><strong>{label(e)}</strong> · {how(e)}<br/><span className="muted text-sm">{e.source==='import'?'Not checked by Saha':VERIFICATIONS[e.verification??'unverified']}{e.evidence?` · evidence: ${e.evidence}`:''} · recorded by {who(e.recordedBy)} on {new Date(e.recordedAt).toLocaleDateString()}</span>
    {care&&<span className="button-row"><Button size="sm" variant="outline" disabled={busy} onClick={()=>{setCorrects(identifierRef(e));setIssuer(e.issuer);setValue('');}}>Correct</Button>{steward&&<Button size="sm" variant="ghost" disabled={busy||reason.trim().length<10} onClick={()=>command({type:'identifierWithdraw',personId:p.id,version:p.version,entryId:identifierRef(e),reason}).then(r=>done(r,'Identifier withdrawn. The earlier entry stays in the history.'))}>Withdraw</Button>}</span>}</li>)}</ul>:<p className="muted">No programme identifiers are linked.</p>}
  </section>
  {care&&!p.mergedInto&&<section className="stack-form"><h3>{corrects?`Correct ${target?label(target):'an identifier'}`:'Link an identifier'}</h3>
   {corrects&&<p className="muted">The earlier entry stays in the history; this adds a corrected one. <Button size="sm" variant="ghost" onClick={()=>{setCorrects('');setValue('');}}>Cancel correction</Button></p>}
   <div className="form-grid">
    {!corrects&&<Select value={issuer} onValueChange={setIssuer}><SelectTrigger aria-label="Programme"><SelectValue/></SelectTrigger><SelectContent>{LINK_ISSUERS.map(k=><SelectItem key={k} value={k}>{ISSUERS[k]}</SelectItem>)}</SelectContent></Select>}
    <Input aria-label="Identifier to record" placeholder="The complete identifier" value={value} onChange={e=>setValue(e.target.value)} maxLength={64} autoComplete="off"/>
    <Select value={origin} onValueChange={setOrigin}><SelectTrigger aria-label="Where it came from"><SelectValue/></SelectTrigger><SelectContent>{Object.entries(ORIGINS).map(([k,v])=><SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
    <Select value={verification} onValueChange={setVerification}><SelectTrigger aria-label="How it was checked"><SelectValue/></SelectTrigger><SelectContent>{Object.entries(VERIFICATIONS).filter(([k])=>steward||k!=='issuer-checked').map(([k,v])=><SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
    <Input aria-label="Evidence" placeholder="Evidence seen (needed when checked)" value={evidence} onChange={e=>setEvidence(e.target.value)} maxLength={200}/>
   </div>
   <Button disabled={busy||!value.trim()||reason.trim().length<10||(verification!=='unverified'&&evidence.trim().length<3)} onClick={link}>{corrects?'Record correction':'Link identifier'}</Button>
   <p className="muted text-sm">If another record already holds this identifier, nothing is changed here: a clinician or supervisor who can see both records has an identity case opened for two stewards to decide; anyone else is told to ask a steward.</p>
  </section>}
  {ledger.length>0&&<details className="stack-form"><summary>History of identifier entries ({ledger.length})</summary><ul className="revision-list">{ledger.map(e=><li key={identifierRef(e)||`${e.issuer}-${e.recordedAt}`}>{label(e)} · {how(e)}{e.reason?` · ${e.reason}`:''} · {who(e.recordedBy)}, {new Date(e.recordedAt).toLocaleString()}</li>)}</ul></details>}
 </DialogContent></Dialog></>;
}
