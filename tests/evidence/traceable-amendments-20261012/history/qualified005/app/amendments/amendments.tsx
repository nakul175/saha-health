'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { TodayRow } from '@/lib/saha/today';
import { amendmentAttempt, amendmentMatches, type AmendmentContext, type AmendmentAttempt } from '@/lib/saha/amendments';
import './amendments.css';
type View = { kind:'loading'|'error'; message:string } | { kind:'list'; records:TodayRow[] } | { kind:'record'; value:AmendmentContext };
export default function Amendments() {
  const [view,setView] = useState<View>({kind:'loading',message:'Loading assigned records…'}), [selected,setSelected] = useState(''), [reason,setReason] = useState(''), [reviewed,setReviewed] = useState(false);
  const [attempt,setAttempt] = useState<AmendmentAttempt|null>(null), [busy,setBusy] = useState(false), [notice,setNotice] = useState('');
  const request = useRef<AbortController|null>(null), organisation = useRef<string|null>(null), actor = useRef<string|null>(null), writing = useRef(false);
  const load = useCallback(async (personId?:string) => {
    if(writing.current) return;
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    const org = personId ? organisation.current : null, priorActor = personId ? actor.current : null;
    if(!personId){organisation.current=null;actor.current=null;}
    setSelected('');setReason('');setReviewed(false);setView({kind:'loading',message:'Loading current authorised amendment sources…'});
    if(!navigator.onLine || (personId && !org)){setView({kind:'error',message:'Amendment sources unavailable. Reconnect and refresh assigned records.'});return;}
    try {
      const response = await fetch(personId ? '/api/amendments?personId='+encodeURIComponent(personId) : '/api/today',{cache:'no-store',credentials:'same-origin',signal:controller.signal,headers:org ? {'x-saha-organisation':org} : {}});
      if(controller.signal.aborted)return;
      if(!response.ok)throw Error([401,403,404].includes(response.status)?'Access refused. Check your current ASHA membership and assignment.':'Amendment sources unavailable. Refresh with a connection.');
      const responseOrg=response.headers.get('x-saha-organisation');if(!responseOrg||(org&&responseOrg!==org))throw Error('Selected organisation could not be matched.');
      if(personId){const value=await response.json() as AmendmentContext, actualActor=response.headers.get('x-saha-operation-actor');if(controller.signal.aborted)return;
        if(!actualActor||value.actorId!==actualActor||(priorActor&&priorActor!==actualActor)||value.person.id!==personId||value.organisationId!==org||!Array.isArray(value.visits))throw Error('Selected account or record could not be matched.');
        actor.current=actualActor;setView({kind:'record',value});
      }else{const body=await response.json() as {records:TodayRow[]};if(controller.signal.aborted)return;if(!Array.isArray(body.records))throw Error('Assigned records unavailable.');organisation.current=responseOrg;setView({kind:'list',records:body.records});}
    }catch(cause){if(!controller.signal.aborted)setView({kind:'error',message:cause instanceof Error ? cause.message : 'Amendment sources unavailable.'});}
  },[]);
  useEffect(()=>{const frame=requestAnimationFrame(()=>void load());const clear=()=>{request.current?.abort();organisation.current=null;actor.current=null;setSelected('');setReason('');setReviewed(false);setView({kind:'error',message:'Protected amendment sources cleared. Reconnect and refresh assigned records.'});};const visibility=()=>{if(document.hidden)clear();};
    window.addEventListener('offline',clear);window.addEventListener('pagehide',clear);document.addEventListener('visibilitychange',visibility);
    return()=>{cancelAnimationFrame(frame);request.current?.abort();window.removeEventListener('offline',clear);window.removeEventListener('pagehide',clear);document.removeEventListener('visibilitychange',visibility);};},[load]);
  const submit=async(original:AmendmentAttempt)=>{if(writing.current)return;writing.current=true;setBusy(true);setAttempt(original);setNotice('Outcome unconfirmed. Keep the original correction attempt reference.');setSelected('');setReason('');setReviewed(false);
    request.current?.abort();const controller=new AbortController();request.current=controller;setView({kind:'loading',message:'Creating the explicitly reviewed correction draft…'});
    try{const response=await fetch('/api/amendments',{method:'POST',credentials:'same-origin',signal:controller.signal,headers:{'Content-Type':'application/json','Idempotency-Key':original.key,'x-saha-organisation':original.organisationId,'x-saha-operation-actor':original.actorId},body:JSON.stringify({personId:original.personId,command:original.command})});
      if(controller.signal.aborted)return;if(!response.ok)throw Error('Outcome not confirmed here. Keep the original reference; refresh authorised records or recover this exact attempt.');
      const body=await response.json() as {outcome:string;key:string;correctionVisitId:string;context:AmendmentContext};if(controller.signal.aborted)return;
      if(response.headers.get('x-saha-operation-actor')!==original.actorId||response.headers.get('x-saha-organisation')!==original.organisationId||body.outcome!=='draft-created'||body.key!==original.key||!amendmentMatches(original,body.context,body.correctionVisitId))throw Error('Correction outcome could not be matched to the original account and source.');
      organisation.current=original.organisationId;actor.current=original.actorId;setView({kind:'record',value:body.context});setAttempt(null);setNotice('Linked correction draft created and read back. It remains unconfirmed; external correction work stays open.');
    }catch(cause){if(!controller.signal.aborted)setView({kind:'error',message:cause instanceof Error ? cause.message : 'Correction outcome unconfirmed.'});}finally{writing.current=false;setBusy(false);}
  };
  const start=()=>{if(view.kind!=='record'||!reviewed||attempt)return;try{void submit(amendmentAttempt(view.value,selected,reason,crypto.randomUUID()));}catch(cause){setNotice(cause instanceof Error?cause.message:'Review the source and correction reason.');}};
  const current=view.kind==='record'?view.value:null;
  return <main className="saha-amendments" aria-busy={busy||view.kind==='loading'}><p>Saha · Synthetic / training</p><h1>Review a traceable correction</h1><p>Creating a correction draft supersedes the selected confirmed visit and blocks unfinished sharing. Earlier facts and accepted receipts remain in history. This step does not approve care or send an external correction.</p>
    {notice&&<p role="status">{notice}</p>}{attempt&&<section aria-label="Original correction attempt"><p>Original attempt reference: {attempt.key}</p><p>Outcome unconfirmed here. Recover only this exact attempt with the original account. Page reload does not retain this in-memory reference.</p><button disabled={busy||view.kind==='loading'} onClick={()=>void submit(attempt)}>Recover original correction attempt</button></section>}
    {view.kind==='list'&&<section><h2>Choose an assigned record</h2>{!view.records.length&&<p>No assigned records.</p>}<ol>{view.records.map(p=><li key={p.id}><h3>{p.name}</h3><p>{p.village} · {p.id}</p><button aria-label={'Review amendment sources '+p.id} onClick={()=>void load(p.id)}>Review amendment sources</button></li>)}</ol></section>}
    {current&&<section aria-label="Selected amendment record"><h2>{current.person.name}</h2><p>{current.person.id} · {current.person.village}</p>{current.truncated&&<p>The recent source window is limited. A correction result also retains its selected source and linked draft. This is not complete archived history.</p>}{!current.visits.length&&<p>No local visit source was found. No visit is created by this read.</p>}
      {current.visits.map(v=><article key={v.id}><h3>Visit {v.id}</h3><p>{v.state} · Record version {v.recordVersion} · Created {v.createdAt}</p><p>{v.supersededBy?'Superseded by '+v.supersededBy:v.voidedAt?'Marked void':v.amendsVisitId?'Correction draft of '+v.amendsVisitId:'Original local visit'}{v.imported?' · Imported read-only record':''}</p><dl>{Object.entries(v.facts).map(([field,value])=><div key={field}><dt>{field}</dt><dd>{typeof value==='string'?value:'Recorded provenance retained'}</dd></div>)}</dl>
        {v.plan&&<p>Sharing plan {v.plan.id} · {v.plan.state}</p>}<p>Related stored AI results: {v.ai.length}; submissions: {v.submissions.length}</p><ul>{v.ai.map(a=><li key={a.id}>AI result {a.id} · {a.status} · {a.reviewed?'Reviewed':'Not reviewed'}</li>)}{v.submissions.map(s=><li key={s.id}>Submission {s.id} · {s.state} · Receipt: {s.receipt??'not recorded'}</li>)}</ul>
        <h4>Recorded downstream correction obligations · {v.tasks.length}</h4><ul>{v.tasks.map(t=><li key={t.id}>{t.output.label} · {t.action} · {t.state} · Owner: {t.ownerId===current.actorId?'You':t.ownerId??'Unassigned'}<p>{t.instruction}</p></li>)}</ul>
        {v.state==='confirmed'&&!v.voidedAt&&!v.supersededBy&&!v.imported&&!attempt&&<button disabled={busy} aria-pressed={selected===v.id} aria-label={'Choose confirmed source '+v.id} onClick={()=>{setSelected(v.id);setReason('');setReviewed(false);}}>Choose this confirmed source</button>}
      </article>)}
      {selected&&!attempt&&<fieldset disabled={busy}><legend>Explicit correction draft for {selected}</legend><label htmlFor="amendment-reason">Correction reason</label><textarea id="amendment-reason" maxLength={1000} value={reason} onChange={e=>{setReason(e.target.value);setReviewed(false);}}/><button aria-pressed={reviewed} onClick={()=>setReviewed(r=>!r)}>{reviewed?'Confirmed source reviewed':'I reviewed the confirmed source and its downstream outputs'}</button><button disabled={!reviewed||reason.trim().length<5} onClick={start}>Create linked correction draft</button><button onClick={()=>{setSelected('');setReason('');setReviewed(false);}}>Cancel correction input</button></fieldset>}
      <button disabled={busy} onClick={()=>void load(current.person.id)}>Refresh selected amendment record</button></section>}
    {(view.kind==='loading'||view.kind==='error')&&<p role="status">{view.message}</p>}<button disabled={busy||view.kind==='loading'} onClick={()=>void load()}>Refresh assigned records</button><a href="/today">Return to Today</a>
  </main>;
}
