'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {packReviewResponse,installationLabel,type PackReviewResponse,type PackSelection} from '@/lib/saha/programme-pack-review';
import './programme-pack-review.css';

export default function ProgrammePackReview(){
 const [value,setValue]=useState<PackReviewResponse|null>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState('Loading current configuration access…');
 const selectedHeading=useRef<HTMLHeadingElement|null>(null);
 const actor=useRef(''),organisation=useRef(''),epoch=useRef(0),active=useRef(true),controller=useRef<AbortController|null>(null);
 const clear=useCallback((message:string)=>{epoch.current++;controller.current?.abort();setValue(null);setBusy(false);setNotice(message);},[]);
 const load=useCallback(async(org?:string,selection?:PackSelection)=>{
  const ticket=++epoch.current;controller.current?.abort();const c=new AbortController();controller.current=c;const timer=setTimeout(()=>c.abort(),20000);const originalActor=actor.current;
  setValue(null);setBusy(true);setNotice('Loading current stored configuration…');
  if(!navigator.onLine){clearTimeout(timer);clear('Configuration unavailable offline. Reconnect and refresh access.');return;}
  const query=selection?'?'+new URLSearchParams({installationId:selection.id,version:String(selection.version),manifestHash:selection.manifestHash}):'';
  try{
   const r=await fetch('/api/programme-pack-review'+query,{cache:'no-store',credentials:'same-origin',signal:c.signal,headers:org?{'x-saha-organisation':org,'x-saha-operation-actor':originalActor}:{}});
   if(!r.ok)throw Error('Configuration refused or unavailable. Refresh current access and versions.');
   const parsed=packReviewResponse.parse(await r.json()),who=r.headers.get('x-saha-operation-actor');
   if(!who||parsed.actorId!==who||(org&&who!==originalActor)||(org&&(parsed.kind!=='configuration'||parsed.organisation.id!==org||r.headers.get('x-saha-organisation')!==org))||(!org&&parsed.kind!=='setup')||(!selection&&parsed.kind==='configuration'&&parsed.selected!==null)||(selection&&(parsed.kind!=='configuration'||parsed.selected?.id!==selection.id||parsed.selected.version!==selection.version||parsed.selected.manifestHash!==selection.manifestHash)))throw Error('Configuration identity could not be matched.');
   if(!active.current||ticket!==epoch.current||c.signal.aborted)return;
   actor.current=who;organisation.current=org??'';setValue(parsed);setBusy(false);setNotice('Stored configuration only. Nothing was uploaded, reviewed, activated or changed.');
  }catch{if(active.current&&ticket===epoch.current)clear('Configuration refused or unavailable. Refresh current access and versions.');}finally{clearTimeout(timer);}
 },[clear]);
 useEffect(()=>{active.current=true;const frame=requestAnimationFrame(()=>void load());const invalidate=()=>clear('Protected configuration cleared. Reconnect and refresh access.');const hidden=()=>{if(document.hidden)invalidate();};window.addEventListener('offline',invalidate);window.addEventListener('pagehide',invalidate);document.addEventListener('visibilitychange',hidden);return()=>{active.current=false;controller.current?.abort();cancelAnimationFrame(frame);window.removeEventListener('offline',invalidate);window.removeEventListener('pagehide',invalidate);document.removeEventListener('visibilitychange',hidden);};},[load,clear]);
 const selected=value?.kind==='configuration'?value.selected:null;
 useEffect(()=>{if(selected)selectedHeading.current?.focus();},[selected]);
 return <main className="programme-pack-review" aria-busy={busy}>
  <h1>Review programme configurations</h1><p role="status">{notice}</p>
  <p>Synthetic / training only. This screen shows existing stored versions and structural review records. It grants no business or clinical approval and starts no activation, patient workflow or provider call.</p>
  {value?.kind==='setup'&&<section><h2>Choose a permitted organisation</h2>{value.organisations.map(o=><button key={o.id} onClick={()=>void load(o.id)} aria-label={'Review configuration '+o.id}>{o.name}</button>)}</section>}
  {value?.kind==='configuration'&&<section><h2>{value.organisation.name}</h2><p>{value.notice}</p><p>Read at {value.asOf}</p>
   <h3>Stored installations</h3>{!value.installations.length&&<p>No installation records in this configuration. Compiled examples, completed encounters and clinical approvals are not assessed by this empty list.</p>}
   {value.installations.map(x=><article key={x.id}><h4>{x.name} · version {x.version}</h4><p>{installationLabel(x)}</p><button disabled={busy} aria-label={'Review installation '+x.id} onClick={()=>void load(value.organisation.id,{id:x.id,version:x.version,manifestHash:x.manifestHash})}>Review this exact version</button></article>)}
   <button disabled={busy} onClick={()=>void load(value.organisation.id)}>Refresh installation list</button>
  </section>}
  {selected&&<section aria-label="Selected stored programme configuration"><h2 ref={selectedHeading} tabIndex={-1}>{selected.manifest.name} · version {selected.version}</h2><p>Installation {selected.id}</p><p>{installationLabel(selected)}</p><p>Exact manifest hash: {selected.manifestHash}</p><p>Declared programme: {selected.manifest.programme}</p><p>Declared purpose: {selected.manifest.purpose}</p>
   <h3>Recorded questions and evidence</h3>{selected.manifest.questions.map(q=><article key={q.id}><h4>{q.label}</h4><p>Question {q.id} · {q.required?'Required by this configuration':'Optional in this configuration'}</p><p>{q.fact?'Shared fact '+q.fact+' · '+q.unit:'Choices: '+q.options?.join(', ')}</p>{q.when&&<p>Shown when {q.when.id} equals {q.when.value}.</p>}</article>)}
   <h3>Other stored definitions</h3><p>Follow-up schedule: {selected.manifest.schedule?selected.manifest.schedule.followUpWithinDays+' days · '+(selected.manifest.schedule.note??'No note recorded'):'Not recorded'}</p><p>Escalation rules: {selected.manifest.escalation?.length??0} recorded structural rules; their clinical approval is not established here.</p><p>Completion rules: {selected.manifest.completionRules?.length??0} recorded.</p><p>Referral definitions: {selected.manifest.referralNeeds?.length??0} recorded; no destination is contacted.</p><p>Declared earlier migration versions: {selected.manifest.migratesFrom?.join(', ')||'Not recorded'}. Nothing is migrated by this read.</p>
   <p>Population eligibility, authorised care roles, complete workflow states, destination mappings, indicator definitions, effective-date policy and named business/clinical approvals are not supplied as qualified fields by this synthetic manifest format. Their absence is not approval or complete programme readiness.</p>
   <h3>Structural review record</h3><p>Staged by {selected.stagedBy} at {selected.stagedAt}.</p><p>{selected.review?'Recorded '+selected.review.decision+' by '+selected.review.by+' at '+selected.review.at+'. This is structural history, not clinical approval.':'No structural review recorded.'}</p><p>Recorded activation: {selected.activatedAt??'Not recorded'} · Retirement: {selected.retiredAt??'Not recorded'}</p><ul>{selected.history.map((h,i)=><li key={i}>{h.state} · {h.at} · {h.by} · {h.reason}</li>)}</ul>
   <details><summary>Exact stored manifest and declared rules</summary><pre>{selected.manifestJson}</pre></details><p>Accepted encounters and their captured versions are not inspected or repinned. Existing checks still apply before any later action.</p>
  </section>}
  <button disabled={busy} onClick={()=>void load()}>Refresh current configuration access</button>
 </main>;
}
