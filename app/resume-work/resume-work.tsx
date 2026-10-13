'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { TodayRow } from '@/lib/saha/today';
import type { RoutineContext } from '@/lib/saha/routine-visit';
import { currentServerDraft } from '@/lib/saha/resume-work';
import './resume-work.css';
type Draft = NonNullable<ReturnType<typeof currentServerDraft>>;
type View = { kind: 'loading' | 'error'; message: string } | { kind: 'list'; records: TodayRow[] } | { kind: 'record'; person: RoutineContext['person']; draft: Draft | null };
export default function ResumeWork() {
  const [view, setView] = useState<View>({ kind: 'loading', message: 'Loading assigned records…' });
  const request = useRef<AbortController | null>(null), organisation = useRef<string | null>(null), actor = useRef<string | null>(null);
  const load = useCallback(async (personId?: string) => {
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    const org = personId ? organisation.current : null, originalActor = personId ? actor.current : null;
    if (!personId) { organisation.current = null; actor.current = null; }
    setView({ kind: 'loading', message: 'Checking current saved server work…' });
    if (!navigator.onLine || (personId && !org)) { setView({ kind: 'error', message: 'Saved server work unavailable. Reconnect and refresh assigned records.' }); return; }
    try {
      const response = await fetch(personId ? '/api/routine-visit?personId=' + encodeURIComponent(personId) : '/api/today', { cache: 'no-store', credentials: 'same-origin', signal: controller.signal, headers: org ? { 'x-saha-organisation': org } : {} });
      if (controller.signal.aborted) return;
      if (!response.ok) throw Error([401,403,404].includes(response.status) ? 'Access refused. Check your current ASHA membership and assignment.' : 'Saved server work unavailable. Refresh with a connection.');
      if (personId) {
        const value = await response.json() as RoutineContext, actualActor = response.headers.get('x-saha-operation-actor');
        if (controller.signal.aborted) return;
        if (!actualActor || (originalActor && actualActor !== originalActor)) throw Error('The signed-in account changed. Refresh assigned records.');
        const draft = currentServerDraft(value, personId, org!, actualActor); actor.current = actualActor; setView({ kind: 'record', person: value.person, draft });
      } else { const body = await response.json() as { records: TodayRow[] }, responseOrg = response.headers.get('x-saha-organisation'); if (controller.signal.aborted) return; if (!responseOrg || !Array.isArray(body.records)) throw Error('Assigned records unavailable.'); organisation.current = responseOrg; setView({ kind: 'list', records: body.records }); }
    } catch (cause) { if (!controller.signal.aborted) setView({ kind: 'error', message: cause instanceof Error ? cause.message : 'Saved server work unavailable.' }); }
  }, []);
  useEffect(() => {
    const frame = requestAnimationFrame(() => void load());
    const clear = () => { request.current?.abort(); organisation.current = null; actor.current = null; setView({ kind: 'error', message: 'Saved-work view cleared. Reconnect and refresh assigned records.' }); };
    const visibility = () => { if (document.hidden) clear(); };
    window.addEventListener('offline', clear); window.addEventListener('pagehide', clear); document.addEventListener('visibilitychange', visibility);
    return () => { cancelAnimationFrame(frame); request.current?.abort(); window.removeEventListener('offline', clear); window.removeEventListener('pagehide', clear); document.removeEventListener('visibilitychange', visibility); };
  }, [load]);
  return <main className="saha-resume" aria-busy={view.kind === 'loading'}><p>Saha · Synthetic / training</p><h1>Resume work saved on the server</h1>
    <p>This screen finds an existing server draft. It does not restore unconfirmed or unsynced entries, the last device screen, or uncertain save attempts. Keep the original save reference if an outcome is unknown; do not resubmit blindly.</p>
    {view.kind === 'list' && <section><h2>Choose an assigned record</h2>{!view.records.length && <p>No assigned records.</p>}<ol>{view.records.map(p => <li key={p.id}><h3>{p.name}</h3><p>{p.village} · {p.id}</p><button aria-label={'Find saved work ' + p.id} onClick={() => void load(p.id)}>Find saved server work</button></li>)}</ol></section>}
    {view.kind === 'record' && <section aria-label="Selected saved work"><h2>{view.person.name}</h2><p>{view.person.id} · {view.person.village}</p>{view.draft ? <article><h3>Existing server draft</h3><p>Visit reference: {view.draft.id}</p><p>Saved server version: {view.draft.version} · Created: {view.draft.createdAt}</p><p>Draft is not a confirmed encounter. Reopening reads this exact existing visit; it creates or saves nothing. Review saved observations and outstanding questions in the editor.</p><a className="resume-link" href={view.draft.href}>Reopen this exact server draft</a></article> : <p>No current server draft was found. Local or uncertain work may still exist; this is not proof that everything was saved.</p>}<button onClick={() => void load(view.person.id)}>Refresh selected saved work</button></section>}
    {(view.kind === 'loading' || view.kind === 'error') && <p role="status">{view.message}</p>}<button disabled={view.kind === 'loading'} onClick={() => void load()}>Refresh assigned records</button><a href="/today">Return to Today</a>
  </main>;
}
