'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { reviewSchema, reviewResponse, sameRecipients, canApprove, type ActionReview } from '@/lib/saha/plan-review';
import './plan-review.css';

type Pending = {type:'preparePlan'|'approvePlan';visitId:string;planId?:string;payloadHash?:string};
export default function PlanReview() {
  const [review,setReview]=useState<ActionReview|null>(null),[actor,setActor]=useState(''),[selected,setSelected]=useState<string[]>([]),[affirmed,setAffirmed]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState('Loading action review…'),[uncertain,setUncertain]=useState<Pending|null>(null);
  const request=useRef<AbortController|null>(null),epoch=useRef(0),active=useRef(false),pending=useRef<Pending|null>(null),selectors=useRef<{personId:string;organisationId:string}|null>(null),visit=useRef<string|undefined>(undefined),heading=useRef<HTMLHeadingElement>(null);
  const clear=useCallback((message:string)=>{epoch.current++;request.current?.abort();setReview(null);setActor('');setSelected([]);setAffirmed(false);setBusy(false);setNotice(message);setUncertain(pending.current);},[]);
  const read=useCallback(async(selectedVisit?:string)=>{
    const ids=selectors.current;if(!ids)return;
    epoch.current++;const ticket=epoch.current;request.current?.abort();const controller=new AbortController();request.current=controller;const timeout=setTimeout(()=>controller.abort(),20000);
    setReview(null);setActor('');setSelected([]);setAffirmed(false);setBusy(true);setNotice('Loading action review…');visit.current=selectedVisit;
    if(!navigator.onLine){clearTimeout(timeout);clear('Review unavailable while offline. Refresh when connected.');return;}
    try{
      const r=await fetch('/api/plan-review?personId='+encodeURIComponent(ids.personId)+(selectedVisit?'&visitId='+encodeURIComponent(selectedVisit):''),{cache:'no-store',credentials:'same-origin',signal:controller.signal,headers:{'x-saha-organisation':ids.organisationId}});
      if(!r.ok)throw new Error([401,403,404].includes(r.status)?'Access refused. Check your assigned ASHA membership.':'Review unavailable. Refresh the current record.');
      const body=reviewSchema.parse(await r.json()),who=r.headers.get('x-saha-operation-actor');
      if(!who||r.headers.get('x-saha-organisation')!==ids.organisationId||body.organisationId!==ids.organisationId||body.person.id!==ids.personId||(selectedVisit&&body.selected?.id!==selectedVisit))throw new Error('Review identity or selection unavailable.');
      if(!active.current||ticket!==epoch.current||controller.signal.aborted)return;
      setReview(body);setActor(who);setSelected(body.selected?.plan?.recipients??[]);setBusy(false);
      const old=pending.current,p=body.selected?.plan;
      if(old?.type==='approvePlan'&&p&&p.id===old.planId&&p.payloadHash===old.payloadHash&&p.state==='approved'&&p.approvedById===who){pending.current=null;setUncertain(null);setNotice('Current server state confirms local approval. Nothing was sent.');}
      else if(old){setUncertain(old);setNotice('Previous operation outcome is uncertain. Current state is shown for review; no request was resent.');}
      else setNotice('Review current information before approving. Nothing is sent from this screen.');
      heading.current?.focus();
    }catch(cause){if(active.current&&ticket===epoch.current){setBusy(false);setReview(null);setNotice(cause instanceof Error&&cause.name!=='AbortError'?cause.message:'Review unavailable. Refresh when connected.');}}
    finally{clearTimeout(timeout);}
  },[clear]);
  useEffect(()=>{
    active.current=true;const q=new URLSearchParams(window.location.search),p=q.get('personId'),o=q.get('organisationId');
    const valid=p&&o&&q.getAll('personId').length===1&&q.getAll('organisationId').length===1&&[...q.keys()].every(k=>['personId','organisationId'].includes(k));
    if(valid)selectors.current={personId:p,organisationId:o};
    const frame=requestAnimationFrame(()=>{if(valid)void read();else clear('Choose an assigned record from Today.');});
    const invalidate=()=>clear('Review cleared. Refresh current information before approving.');
    const visibility=()=>{if(document.hidden)invalidate();};
    window.addEventListener('offline',invalidate);window.addEventListener('pagehide',invalidate);document.addEventListener('visibilitychange',visibility);
    return()=>{active.current=false;request.current?.abort();cancelAnimationFrame(frame);window.removeEventListener('offline',invalidate);window.removeEventListener('pagehide',invalidate);document.removeEventListener('visibilitychange',visibility);};
  },[read,clear]);
  const write=async(type:'preparePlan'|'approvePlan')=>{
    const s=review?.selected,ids=selectors.current;if(!s||!ids||busy||uncertain||!actor)return;
    if(type==='approvePlan'&&!canApprove(review,selected,affirmed,actor))return;
    if(type==='preparePlan'&&!selected.length)return;
    const command=type==='preparePlan'?{type,visitId:s.id,recipients:selected}:{type,visitId:s.id,planId:s.plan!.id,payloadHash:s.plan!.payloadHash};
    const intent:Pending={type,visitId:s.id,...(type==='approvePlan'?{planId:s.plan!.id,payloadHash:s.plan!.payloadHash}:{})};
    pending.current=intent;setUncertain(intent);setBusy(true);setAffirmed(false);const ticket=++epoch.current;request.current?.abort();const controller=new AbortController();request.current=controller;const timeout=setTimeout(()=>controller.abort(),20000);
    try{
      const r=await fetch('/api/plan-review',{method:'POST',credentials:'same-origin',cache:'no-store',signal:controller.signal,headers:{'content-type':'application/json','x-saha-organisation':ids.organisationId,'x-saha-operation-actor':actor,'idempotency-key':'review_'+crypto.randomUUID()},body:JSON.stringify({personId:ids.personId,command})});
      if(!active.current||ticket!==epoch.current||controller.signal.aborted)return;
      if(!r.ok){clear('Operation outcome uncertain. The server did not return a qualified result. Recover current state without resending.');return;}
      const body=reviewResponse.parse(await r.json()),current=body.context,plan=current.selected?.plan;
      if(r.headers.get('x-saha-operation-actor')!==actor||r.headers.get('x-saha-organisation')!==ids.organisationId||current.person.id!==ids.personId||current.organisationId!==ids.organisationId||current.selected?.id!==s.id)throw new Error('Operation identity unavailable.');
      if(!plan)throw new Error('Prepared review unavailable.');
      if(type==='preparePlan'&&(plan.id!==body.result?.planId||plan.state!=='proposed'||!sameRecipients(plan.recipients,selected)))throw new Error('Prepared review unavailable.');
      if(type==='approvePlan'&&(plan.id!==intent.planId||plan.payloadHash!==intent.payloadHash||plan.state!=='approved'||plan.approvedById!==actor))throw new Error('Approval checkpoint unavailable.');
      if(!active.current||ticket!==epoch.current||controller.signal.aborted)return;
      pending.current=null;setUncertain(null);setReview(current);setSelected(plan.recipients);setBusy(false);setNotice(type==='preparePlan'?'Fresh bundle prepared. Review the destinations and information, then explicitly approve.':'Locally approved for the displayed period. Nothing was sent.');heading.current?.focus();
    }catch{if(active.current&&ticket===epoch.current)clear('Operation outcome uncertain. Recover current state without resending.');}
    finally{clearTimeout(timeout);}
  };
  const s=review?.selected,p=s?.plan,dirty=p&&!sameRecipients(selected,p.recipients);
  return <main className="plan-review"><a href="/today">Back to Today</a><h1 ref={heading} tabIndex={-1}>Review proposed actions</h1><p role="status">{notice}</p>
    <p>This synthetic review records local approval only. It does not send information or create a visit.</p>
    <button type="button" disabled={busy} onClick={()=>void read(visit.current)}>{uncertain?'Recover current state':'Refresh review'}</button>
    {review&&<><h2>{review.person.name}</h2><label htmlFor="review-visit">Existing confirmed visit</label><select id="review-visit" value={s?.id??''} disabled={busy} onChange={e=>{pending.current=null;setUncertain(null);void read(e.target.value||undefined);}}><option value="">Choose a visit</option>{review.visits.map(v=><option key={v.id} value={v.id}>{v.date||'Date unavailable'} · {v.id}</option>)}</select>
      {!review.visits.length&&<p>No current original confirmed visits are available. Nothing has been created.</p>}
      {s&&<><h2>Receiving destinations</h2><p>These are the organisation’s configured destination labels. Eligibility is checked by the server when preparing a bundle.</p><fieldset disabled={busy||Boolean(uncertain)}><legend>Include or exclude each destination</legend>{s.destinations.map(d=><label key={d.id}><input type="checkbox" checked={selected.includes(d.id)} onChange={e=>{setSelected(e.target.checked?[...selected,d.id]:selected.filter(x=>x!==d.id));setAffirmed(false);}}/>{d.name} · {d.mode==='demo'?'Synthetic demonstration':'Configured exchange'} · version {d.version}</label>)}</fieldset>
      {!s.destinations.length&&<p>No configured destinations are available.</p>}{dirty&&<p role="alert">Destinations changed. Prepare and review a fresh bundle before approval.</p>}
      <button type="button" disabled={busy||Boolean(uncertain)||!selected.length} onClick={()=>void write('preparePlan')}>Prepare selected destinations</button>
      <h2>Information in this review</h2><dl><dt>Record version</dt><dd>{review.person.version}</dd><dt>Consent version</dt><dd>{review.person.consentVersion}</dd><dt>Visit version</dt><dd>{s.version}</dd><dt>Stored record revision</dt><dd>{s.recordVersion}</dd></dl><p>Confirmed facts and programme answers are read only. Correct facts through the existing record-correction workflow before preparing a new bundle.</p><dl aria-label="Confirmed facts">{Object.entries({Date:s.facts.date,'Blood pressure':s.facts.systolic&&s.facts.diastolic?s.facts.systolic+'/'+s.facts.diastolic+' mmHg':'','Weight (kg)':s.facts.weight,'Temperature (°C)':s.facts.temperature,'Pregnancy weeks':s.facts.weeks,'Cough days':s.facts.coughDays,Notes:s.facts.notes,Source:s.facts.source}).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value||'Not recorded'}</dd></div>)}</dl><details><summary>Full recorded facts and provenance</summary><pre>{JSON.stringify(s.facts,null,2)}</pre></details>{s.programmeCapture&&<details><summary>Recorded programme answers and revisions</summary><pre>{JSON.stringify(s.programmeCapture,null,2)}</pre></details>}
      {p&&<section aria-label="Exact prepared bundle"><h2>Exact prepared bundle</h2><p>{p.purpose}</p><p>Included destinations: {p.recipients.map(id=>s.destinations.find(d=>d.id===id)?.name).join(', ')}</p><p>State: {p.state}</p><p>Bundle reference: {p.id}</p><p>Information hash: <code>{p.payloadHash}</code></p>{s.stale&&<p role="alert">{s.stale}</p>}{p.payloads&&Object.entries(p.payloads).map(([id,payload])=><details key={id}><summary>Exact mapped information for {s.destinations.find(d=>d.id===id)?.name}</summary><pre>{JSON.stringify(payload,null,2)}</pre></details>)}{p.recipients.some(id=>s.destinations.find(d=>d.id===id)?.mode==='demo')&&<p>Demonstration destinations have no external wire payload. The displayed confirmed facts, answers, destinations and revisions are bound to this local review.</p>}
      {p.state==='proposed'&&<><label><input type="checkbox" checked={affirmed} disabled={busy||Boolean(uncertain)||Boolean(dirty)||Boolean(s.stale)} onChange={e=>setAffirmed(e.target.checked)}/>I reviewed the purpose, destinations and information in this exact bundle.</label><button type="button" disabled={busy||Boolean(uncertain)||!canApprove(review,selected,affirmed,actor)} onClick={()=>void write('approvePlan')}>Approve reviewed bundle</button></>}
      {p.state==='approved'&&<p>Local approval expires: {p.expiresAt}. Current actor and all original server checks are required for any later execution. This screen never executes a bundle.</p>}</section>}
      </>}
    </>}
  </main>;
}
