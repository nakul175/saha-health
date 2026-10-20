'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ownerOrganisations, workforceContext, prepareSuspension, recordedSuspensionMatches,
  type WorkforceContext, type SuspensionAttempt } from '@/lib/saha/workforce-status';
import { ROLE_LABEL } from '@/lib/saha/types';
import './workforce-status.css';

type View = { kind: 'loading' | 'error'; message: string } |
  { kind: 'organisations'; actorId: string; organisations: { id: string; name: string }[] } |
  { kind: 'roster'; value: WorkforceContext };
const workspaceHref = '/';
export default function WorkforceStatus() {
  const [view, setView] = useState<View>({ kind: 'loading', message: 'Loading existing owner organisations…' });
  const [target, setTarget] = useState(''), [reason, setReason] = useState(''), [affirmed, setAffirmed] = useState(false);
  const [attempt, setAttempt] = useState<SuspensionAttempt | null>(null), [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  const request = useRef<AbortController | null>(null), writing = useRef(false), actor = useRef<string | null>(null);
  const load = useCallback(async (organisationId?: string) => {
    if (writing.current) return;
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    const expectedActor = organisationId ? actor.current : null;
    setTarget(''); setReason(''); setAffirmed(false); setView({ kind: 'loading', message: 'Checking current owner access…' });
    if (!navigator.onLine) { setView({ kind: 'error', message: 'Reconnect and refresh. No membership status is inferred offline.' }); return; }
    try {
      const response = await fetch('/api/workforce-status', { cache: 'no-store', credentials: 'same-origin', signal: controller.signal,
        headers: organisationId ? { 'x-saha-organisation': organisationId } : {} });
      if (controller.signal.aborted) return;
      if (!response.ok) throw Error([401,403].includes(response.status) ? 'Current owner access refused. Protected membership data cleared.' : 'Membership data unavailable. Refresh with current access.');
      const actualActor = response.headers.get('x-saha-operation-actor');
      if (!actualActor || (expectedActor && actualActor !== expectedActor)) throw Error('Owner account changed. Refresh existing organisations.');
      if (organisationId) {
        const value = workforceContext.parse(await response.json());
        if (controller.signal.aborted) return;
        if (value.actorId !== actualActor || value.organisation.id !== organisationId || response.headers.get('x-saha-organisation') !== organisationId)
          throw Error('Selected owner organisation could not be matched.');
        actor.current = actualActor; setView({ kind: 'roster', value });
      } else {
        const value = ownerOrganisations.parse(await response.json());
        if (controller.signal.aborted) return;
        if (value.actorId !== actualActor) throw Error('Owner account could not be matched.');
        actor.current = actualActor; setView({ kind: 'organisations', ...value });
      }
    } catch (cause) { if (!controller.signal.aborted) setView({ kind: 'error', message: cause instanceof Error ? cause.message : 'Membership data unavailable.' }); }
  }, []);
  useEffect(() => {
    const frame = requestAnimationFrame(() => void load());
    const clear = () => { request.current?.abort(); actor.current = null; setTarget(''); setReason(''); setAffirmed(false);
      setView({ kind: 'error', message: 'Protected membership review cleared. Reconnect and refresh current owner access.' }); };
    const hidden = () => { if (document.hidden) clear(); };
    window.addEventListener('offline', clear); window.addEventListener('pagehide', clear); document.addEventListener('visibilitychange', hidden);
    return () => { cancelAnimationFrame(frame); request.current?.abort(); window.removeEventListener('offline', clear);
      window.removeEventListener('pagehide', clear); document.removeEventListener('visibilitychange', hidden); };
  }, [load]);
  const submit = async (original: SuspensionAttempt, recovery = false) => {
    if (writing.current) return; writing.current = true; setBusy(true); setAttempt(original); setTarget(''); setReason(''); setAffirmed(false);
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setNotice('Original suspension outcome is unconfirmed here. Keep this exact attempt reference.');
    setView({ kind: 'loading', message: recovery ? 'Checking the committed original operation only…' : 'Submitting the explicitly reviewed suspension…' });
    try {
      const response = await fetch('/api/workforce-status', { method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': original.key, 'x-saha-operation-actor': original.actorId,
          'x-saha-organisation': original.organisationId, ...(recovery ? { 'x-saha-recovery': 'receipt-only' } : {}) }, body: JSON.stringify(original.command) });
      if (controller.signal.aborted) return;
      if (!response.ok) throw Error('Operation outcome not confirmed. Recovery checks only a committed original receipt; it starts no replacement suspension.');
      const body = await response.json() as { outcome?: string; key?: string; context?: unknown };
      const value = workforceContext.parse(body.context);
      if (controller.signal.aborted) return;
      if (body.outcome !== 'original-suspension-recorded' || body.key !== original.key ||
        response.headers.get('x-saha-operation-actor') !== original.actorId || response.headers.get('x-saha-organisation') !== original.organisationId ||
        !recordedSuspensionMatches(original, value)) throw Error('Original operation could not be matched.');
      actor.current = original.actorId; setView({ kind: 'roster', value }); setAttempt(null);
      setNotice('Original suspension operation recorded and read back. Current membership status is shown below; later changes are not overwritten.');
    } catch (cause) { if (!controller.signal.aborted) setView({ kind: 'error', message: cause instanceof Error ? cause.message : 'Original operation remains unconfirmed.' }); }
    finally { writing.current = false; setBusy(false); }
  };
  const begin = () => {
    if (view.kind !== 'roster' || !affirmed || attempt || busy) return;
    try { void submit(prepareSuspension(view.value, target, reason, crypto.randomUUID())); }
    catch (cause) { setNotice(cause instanceof Error ? cause.message : 'Review one current membership.'); }
  };
  return <main className="workforce-status" aria-busy={busy || view.kind === 'loading'}>
    <p>Saha · Synthetic / training</p><h1>Review membership suspension</h1>
    <p>Organisation owners can suspend an existing member without changing their role, teams or owner status. This screen does not verify or activate accounts.</p>
    <p>New online requests use current membership checks and are refused immediately after suspension in this service, within the five-minute requirement.</p>
    <p>A disconnected encrypted visit copy may remain readable until its displayed signed-grant expiry (currently up to 24 hours). Suspension cannot remotely erase that copy; reconnect and upload recheck the current membership. Immediate offline revocation is not promised.</p>
    {notice && <p role="status">{notice}</p>}
    {attempt && <section aria-label="Original suspension attempt"><p>Original operation reference: {attempt.key}</p>
      <p>This reference is held only in this screen&apos;s memory. Recovery requires the original owner and a committed original receipt; no missing operation is resent.</p>
      <button disabled={busy || view.kind === 'loading'} onClick={() => void submit(attempt, true)}>Check original suspension receipt</button></section>}
    {view.kind === 'organisations' && <section><h2>Choose an existing owner organisation</h2>
      {!view.organisations.length && <p>No existing active owner organisations were found. This read creates no account or organisation.</p>}
      <ul>{view.organisations.map(organisation => <li key={organisation.id}><p>{organisation.name} · {organisation.id}</p>
        <button onClick={() => void load(organisation.id)}>Review {organisation.name}</button></li>)}</ul></section>}
    {view.kind === 'roster' && <section aria-label="Current membership roster"><h2>{view.value.organisation.name}</h2>
      <p>Current owner account {view.value.actorId}. This list contains membership metadata, not patient records or invitation codes.</p>
      <ul>{view.value.members.map(member => <li key={member.userId}><h3>{member.name}</h3>
        <p>{member.userId} · {ROLE_LABEL[member.role]} · {member.status} · Version {member.version}{member.isOwner ? ' · Organisation owner' : ''}</p>
        <p>Recorded teams: {member.teamIds.join(', ') || 'None'}</p>
        {member.status === 'active' && member.userId !== view.value.actorId && !member.userId.startsWith('fixture:') &&
          <button disabled={busy || !!attempt} aria-pressed={target === member.userId} aria-label={'Review suspension ' + member.userId}
            onClick={() => { setTarget(member.userId); setReason(''); setAffirmed(false); }}>Review suspension</button>}</li>)}</ul>
      {target && !attempt && <fieldset disabled={busy}><legend>Explicit suspension for {target}</legend>
        <label>Reason for suspension<textarea minLength={5} maxLength={1000} value={reason} onChange={event => { setReason(event.target.value); setAffirmed(false); }} /></label>
        <label><input type="checkbox" checked={affirmed} onChange={event => setAffirmed(event.target.checked)} />I reviewed this exact membership and the offline limits.</label>
        <button disabled={!affirmed || reason.trim().length < 5} onClick={begin}>Suspend reviewed membership</button>
        <button onClick={() => { setTarget(''); setReason(''); setAffirmed(false); }}>Cancel suspension review</button></fieldset>}
      <button disabled={busy} onClick={() => void load(view.value.organisation.id)}>Refresh current membership</button></section>}
    {(view.kind === 'loading' || view.kind === 'error') && <p role="status">{view.message}</p>}
    <button disabled={busy || view.kind === 'loading'} onClick={() => void load()}>Refresh existing owner organisations</button><a href={workspaceHref}>Back to workspace</a>
  </main>;
}
