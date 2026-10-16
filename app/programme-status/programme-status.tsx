'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { TodayRow } from '@/lib/saha/today';
import { programmeStatusText, type ProgrammeStatusResponse } from '@/lib/saha/programme-status';
import './programme-status.css';
type View = { kind: 'loading' | 'error'; message: string } | { kind: 'list'; records: TodayRow[] } | { kind: 'record'; value: ProgrammeStatusResponse };
export default function ProgrammeStatus() {
  const [view, setView] = useState<View>({ kind: 'loading', message: 'Loading assigned records…' });
  const request = useRef<AbortController | null>(null), organisation = useRef<string | null>(null), actor = useRef<string | null>(null);
  const load = useCallback(async (personId?: string) => {
    request.current?.abort();
    const org = personId ? organisation.current : null, priorActor = personId ? actor.current : null;
    if (!personId) { organisation.current = null; actor.current = null; }
    const controller = new AbortController(); request.current = controller;
    setView({ kind: 'loading', message: 'Loading current authorised status…' });
    if (!navigator.onLine || (personId && !org)) { setView({ kind: 'error', message: 'Status unavailable. Reconnect and choose an assigned record again.' }); return; }
    try {
      const response = await fetch(personId ? '/api/programme-status?personId=' + encodeURIComponent(personId) : '/api/today', { cache: 'no-store', credentials: 'same-origin', signal: controller.signal, headers: org ? { 'x-saha-organisation': org } : {} });
      if (controller.signal.aborted) return;
      if (!response.ok) throw Error([401,403,404].includes(response.status) ? 'Access refused. Check your ASHA membership and current assignment.' : 'Status unavailable. Refresh after checking your connection.');
      const responseOrg = response.headers.get('x-saha-organisation');
      if (!responseOrg || (org && responseOrg !== org)) throw Error('Selected organisation could not be matched. Return to assigned records.');
      if (personId) {
        const value = await response.json() as ProgrammeStatusResponse, responseActor = response.headers.get('x-saha-operation-actor');
        if (controller.signal.aborted) return;
        if (!responseActor || value.actorId !== responseActor || (priorActor && responseActor !== priorActor) || value.organisationId !== org || value.person.id !== personId || !Array.isArray(value.episodes)) throw Error('Selected account or record could not be matched. Return to assigned records.');
        actor.current = responseActor; setView({ kind: 'record', value });
      } else {
        const body = await response.json() as { records: TodayRow[] };
        if (controller.signal.aborted) return;
        if (!Array.isArray(body.records)) throw Error('Assigned records could not be matched.');
        organisation.current = responseOrg; setView({ kind: 'list', records: body.records });
      }
    } catch (cause) { if (!controller.signal.aborted) setView({ kind: 'error', message: cause instanceof Error ? cause.message : 'Status unavailable.' }); }
  }, []);
  useEffect(() => {
    const frame = requestAnimationFrame(() => void load());
    const clear = () => { request.current?.abort(); organisation.current = null; actor.current = null; setView({ kind: 'error', message: 'Status cleared. Reconnect and refresh assigned records.' }); };
    const visibility = () => { if (document.hidden) clear(); };
    window.addEventListener('offline', clear); window.addEventListener('pagehide', clear); document.addEventListener('visibilitychange', visibility);
    return () => { cancelAnimationFrame(frame); request.current?.abort(); window.removeEventListener('offline', clear); window.removeEventListener('pagehide', clear); document.removeEventListener('visibilitychange', visibility); };
  }, [load]);
  return <main className="saha-programme-status" aria-busy={view.kind === 'loading'}>
    <p>Saha · Synthetic / training</p><h1>Programme status</h1>
    <p>Read-only local episodes and simulator outcomes. Real eligibility and official registration are not established by this screen.</p>
    {view.kind === 'list' && <section aria-label="Assigned records"><h2>Choose an assigned record</h2>{!view.records.length && <p>No assigned records.</p>}<ol>{view.records.map(p => <li key={p.id}><h3>{p.name}</h3><p>{p.village} · {p.id}</p><button onClick={() => void load(p.id)} aria-label={'Open programme status ' + p.id}>Open programme status</button></li>)}</ol></section>}
    {view.kind === 'record' && <section aria-label="Selected programme record"><h2>{view.value.person.name}</h2><p>{view.value.person.id} · {view.value.person.village} · Person version {view.value.person.version}</p>
      {!view.value.episodes.length && <p>No local programme episodes. Programme tags alone do not establish enrolment.</p>}
      {view.value.episodes.map(e => { const status = programmeStatusText(e); return <article key={e.id}><h3>{e.packName} · v{e.packVersion}</h3><p>{e.episodeLabel} · Episode {e.id}</p><p>Local episode: {e.state} · Start {e.startDate ?? 'not recorded'}</p>{e.eligibilityAssessment?<><p>Recorded eligibility assessment: {e.eligibilityAssessment.state.replace('_',' ')}.</p><p>Assessment reason: {e.eligibilityAssessment.reason}</p></>:<p>No eligibility assessment recorded. This does not imply eligibility or ineligibility.</p>}<p>Official registration: {e.registration==='submitted'?'submitted after destination acceptance and programme authorisation':'not submitted'}.</p><p>{status.status}</p><p>{status.next}</p>{e.destination && <><p>Recorded simulator destination: {e.destination.name}</p>{e.destination.receipt && <p>Recorded simulator reference: {e.destination.receipt}</p>}</>}</article>; })}
      <button onClick={() => void load(view.value.person.id)}>Refresh selected status</button>
    </section>}
    {(view.kind === 'loading' || view.kind === 'error') && <p role="status">{view.message}</p>}
    <button disabled={view.kind === 'loading'} onClick={() => void load()}>Refresh assigned records</button>
    <a href="/today">Return to Today</a>
  </main>;
}
