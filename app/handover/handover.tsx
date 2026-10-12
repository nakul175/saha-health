'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { TodayRow } from '@/lib/saha/today';
import { acknowledgementAttempt, acknowledgementMatches, type HandoverAttempt, type HandoverContext } from '@/lib/saha/handover';
import './handover.css';
type View = { kind: 'loading' | 'error'; message: string } | { kind: 'list'; records: TodayRow[] } | { kind: 'record'; value: HandoverContext };
export default function Handover() {
  const [view, setView] = useState<View>({ kind: 'loading', message: 'Loading assigned records…' }), [reference, setReference] = useState(''), [reviewed, setReviewed] = useState(false), [attempt, setAttempt] = useState<HandoverAttempt | null>(null), [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  const request = useRef<AbortController | null>(null), organisation = useRef<string | null>(null), actor = useRef<string | null>(null), writing = useRef(false);
  const load = useCallback(async (personId?: string) => {
    if (writing.current) return;
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    const org = personId ? organisation.current : null, priorActor = personId ? actor.current : null;
    if (!personId) { organisation.current = null; actor.current = null; }
    setView({ kind: 'loading', message: 'Loading current authorised handover…' }); setReference(''); setReviewed(false);
    if (!navigator.onLine || (personId && !org)) { setView({ kind: 'error', message: 'Handover unavailable. Reconnect and refresh assigned records.' }); return; }
    try {
      const response = await fetch(personId ? '/api/handover?personId=' + encodeURIComponent(personId) : '/api/today', { cache: 'no-store', credentials: 'same-origin', signal: controller.signal, headers: org ? { 'x-saha-organisation': org } : {} });
      if (controller.signal.aborted) return;
      if (!response.ok) throw Error([401,403,404].includes(response.status) ? 'Access refused. Check your current ASHA membership and assignment.' : 'Handover unavailable. Refresh after checking your connection.');
      const responseOrg = response.headers.get('x-saha-organisation');
      if (!responseOrg || (org && responseOrg !== org)) throw Error('Selected organisation could not be matched.');
      if (personId) {
        const value = await response.json() as HandoverContext, responseActor = response.headers.get('x-saha-operation-actor');
        if (controller.signal.aborted) return;
        if (!responseActor || value.actorId !== responseActor || (priorActor && responseActor !== priorActor) || value.organisationId !== org || value.person.id !== personId || !Array.isArray(value.work)) throw Error('Selected account or record could not be matched.');
        actor.current = responseActor; setView({ kind: 'record', value });
      } else { const body = await response.json() as { records: TodayRow[] }; if (controller.signal.aborted) return; if (!Array.isArray(body.records)) throw Error('Assigned records unavailable.'); organisation.current = responseOrg; setView({ kind: 'list', records: body.records }); }
    } catch (cause) { if (!controller.signal.aborted) setView({ kind: 'error', message: cause instanceof Error ? cause.message : 'Handover unavailable.' }); }
  }, []);
  useEffect(() => {
    const frame = requestAnimationFrame(() => void load());
    const clear = () => { request.current?.abort(); organisation.current = null; actor.current = null; setReference(''); setReviewed(false); setView({ kind: 'error', message: 'Protected handover cleared. Reconnect and refresh assigned records.' }); };
    const visibility = () => { if (document.hidden) clear(); };
    window.addEventListener('offline', clear); window.addEventListener('pagehide', clear); document.addEventListener('visibilitychange', visibility);
    return () => { cancelAnimationFrame(frame); request.current?.abort(); window.removeEventListener('offline', clear); window.removeEventListener('pagehide', clear); document.removeEventListener('visibilitychange', visibility); };
  }, [load]);
  const submit = async (original: HandoverAttempt) => {
    if (writing.current) return;
    writing.current = true; setBusy(true); setAttempt(original); setNotice('Outcome not yet confirmed. Keep this original attempt reference.');
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setReference(''); setReviewed(false); setView({ kind: 'loading', message: 'Recording reviewed acknowledgement…' });
    try {
      const response = await fetch('/api/handover', { method: 'POST', credentials: 'same-origin', signal: controller.signal, headers: { 'Content-Type': 'application/json', 'Idempotency-Key': original.key, 'x-saha-organisation': original.organisationId, 'x-saha-operation-actor': original.actorId }, body: JSON.stringify({ personId: original.personId, command: original.command }) });
      if (controller.signal.aborted) return;
      if (!response.ok) throw Error('Outcome not confirmed here. Keep the original reference; refresh authorised records or recover this exact attempt.');
      const body = await response.json() as { outcome: string; key: string; context: HandoverContext };
      if (controller.signal.aborted) return;
      if (response.headers.get('x-saha-operation-actor') !== original.actorId || response.headers.get('x-saha-organisation') !== original.organisationId || body.outcome !== 'recorded' || body.key !== original.key || !acknowledgementMatches(original, body.context)) throw Error('Recorded outcome could not be matched to the original account and handover.');
      organisation.current = original.organisationId; actor.current = original.actorId; setView({ kind: 'record', value: body.context }); setAttempt(null); setNotice('Acknowledgement recorded by the server. Current handover read back.');
    } catch (cause) { if (!controller.signal.aborted) setView({ kind: 'error', message: cause instanceof Error ? cause.message : 'Outcome not confirmed. Keep the original reference.' }); }
    finally { writing.current = false; setBusy(false); }
  };
  const start = () => { if (view.kind !== 'record' || !reviewed || attempt) return; try { void submit(acknowledgementAttempt(view.value, reference, crypto.randomUUID())); } catch (cause) { setNotice(cause instanceof Error ? cause.message : 'Review the current handover.'); } };
  const current = view.kind === 'record' ? view.value : null, event = current?.handover;
  const eligible = current && event && event.ownerId === current.actorId && event.teamId === current.person.teamId && !event.acknowledgement;
  return <main className="saha-handover" aria-busy={view.kind === 'loading' || busy}>
    <p>Saha · Synthetic / training</p><h1>Review care handover</h1><p>Review the recorded transfer and current open work. Acknowledgement records your review; it does not complete any care task.</p>
    {notice && <p role="status">{notice}</p>}
    {attempt && <section aria-label="Original acknowledgement attempt"><p>Original attempt reference: {attempt.key}</p><p>Outcome remains unconfirmed here. Recover only with the original account and reference. Page reload does not retain this in-memory recovery reference.</p><button disabled={busy || view.kind === 'loading'} onClick={() => void submit(attempt)}>Recover original attempt</button></section>}
    {view.kind === 'list' && <section><h2>Choose an assigned record</h2>{!view.records.length && <p>No assigned records.</p>}<ol>{view.records.map(p => <li key={p.id}><h3>{p.name}</h3><p>{p.village} · {p.id}</p><button disabled={busy} aria-label={'Review handover ' + p.id} onClick={() => void load(p.id)}>Review handover</button></li>)}</ol></section>}
    {current && <section aria-label="Selected care handover"><h2>{current.person.name}</h2><p>{current.person.id} · {current.person.village}</p>
      {event ? <article><h3>Recorded assignment</h3><p>Effective: {event.at}</p><p>Receiving team: {event.teamId}</p><p>{event.reason}</p><p>{event.acknowledgement ? 'Acknowledgement recorded: ' + event.acknowledgement.reference : 'Acknowledgement pending.'}</p></article> : <p>No recorded handover to acknowledge.</p>}
      <h3>Current open work · {current.work.length}</h3><ul>{current.work.map(t => <li key={t.kind + t.id}>{t.kind} · {t.id} · Owner: {t.ownerId === current.actorId ? 'You' : t.ownerId ?? 'Unassigned'} · Due: {t.due ?? 'not recorded'}</li>)}</ul>
      {eligible && !attempt && <fieldset disabled={busy}><legend>Record your reviewed acknowledgement</legend><label htmlFor="handover-reference">Handover review reference</label><input id="handover-reference" maxLength={200} value={reference} onChange={e => { setReference(e.target.value); setReviewed(false); }} /><button aria-pressed={reviewed} onClick={() => setReviewed(r => !r)}>{reviewed ? 'Open work reviewed' : 'I reviewed the handover and open work'}</button><button disabled={!reviewed || !reference.trim() || reference.trim().length > 200} onClick={start}>Record acknowledgement</button><button onClick={() => { setReference(''); setReviewed(false); }}>Cancel acknowledgement input</button></fieldset>}
      <button disabled={busy} onClick={() => void load(current.person.id)}>Refresh selected handover</button>
    </section>}
    {(view.kind === 'loading' || view.kind === 'error') && <p role="status">{view.message}</p>}
    <button disabled={busy || view.kind === 'loading'} onClick={() => void load()}>Refresh assigned records</button><a href="/today">Return to Today</a>
  </main>;
}
