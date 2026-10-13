'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { followupSelector, frontlinePlan, frontlineRecord, frontlineReschedule, rescheduleAccepted, type FrontlinePlan, type FrontlineSlot } from '@/lib/saha/frontline-followup';
import { VISIT_WINDOWS } from '@/lib/saha/household-visit-constants';
import type { TodayRecord } from '@/lib/saha/today';
import './follow-ups.css';

type Ready = { kind: 'ready'; record: Pick<TodayRecord, 'id' | 'name'>; plan: FrontlinePlan };
type View = Ready | { kind: 'loading' | 'refused' | 'unavailable' | 'invalid' };
type Proposal = { slot: FrontlineSlot; date: string; window: typeof VISIT_WINDOWS[number] };
const label = (value: string) => value === 'any' ? 'Any time' : value[0].toUpperCase() + value.slice(1);

export default function Followups() {
  const [view, setView] = useState<View>({ kind: 'loading' }), [proposal, setProposal] = useState<Proposal | null>(null);
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState(''), [unconfirmed, setUnconfirmed] = useState(false);
  const request = useRef<AbortController | null>(null), heading = useRef<HTMLHeadingElement>(null), trigger = useRef<HTMLButtonElement | null>(null);
  const pending = useRef<{ visitId: string; date: string; window: string } | null>(null), mounted = useRef(false);
  const load = useCallback(async () => {
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setView({ kind: 'loading' }); setProposal(null);
    const selected = followupSelector(new URLSearchParams(window.location.search));
    if (!selected) { setView({ kind: 'invalid' }); return; }
    if (!navigator.onLine) { setView({ kind: 'unavailable' }); return; }
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const read = async (path: string) => {
        const result = await fetch(path, { cache: 'no-store', credentials: 'same-origin', signal: controller.signal,
          headers: { 'x-saha-organisation': selected.organisationId } });
        if ([401, 403, 404].includes(result.status)) throw Error('refused');
        if (!result.ok) throw Error('unavailable'); return result;
      };
      const identity = async () => {
        const result = await read('/api/today?personId=' + encodeURIComponent(selected.personId));
        if (result.headers.get('x-saha-organisation') !== selected.organisationId) throw Error('refused');
        return frontlineRecord(await result.json(), selected.personId);
      };
      await identity();
      const result = await read('/api/household?personId=' + encodeURIComponent(selected.personId));
      const plan = frontlinePlan(await result.json(), selected.personId);
      // A delayed household response cannot publish data after assignment was revoked.
      const record = await identity();
      if (controller.signal.aborted || !mounted.current || document.visibilityState === 'hidden') return;
      if (pending.current && plan.kind === 'plans') {
        const accepted = plan.slots.find(slot => slot.replacesVisitId === pending.current?.visitId &&
          slot.date === pending.current.date && slot.window === pending.current.window);
        if (accepted) { pending.current = null; setUnconfirmed(false); setNotice('New visit time saved and confirmed from the server plan.'); }
        else setNotice('Change not confirmed. This is the current server plan; refresh to check before another change.');
      }
      setView({ kind: 'ready', record, plan });
    } catch (cause) {
      if (request.current !== controller || !mounted.current) return;
      setView({ kind: cause instanceof Error && cause.message === 'refused' ? 'refused' : 'unavailable' });
    } finally { clearTimeout(timer); }
  }, []);
  useEffect(() => {
    mounted.current = true;
    queueMicrotask(() => { if (mounted.current) void load(); });
    const clear = () => { request.current?.abort(); request.current = null; setView({ kind: 'unavailable' }); setProposal(null); };
    const refresh = () => void load(), visibility = () => document.visibilityState === 'hidden' ? clear() : refresh();
    window.addEventListener('offline', clear); window.addEventListener('online', refresh); window.addEventListener('focus', refresh);
    window.addEventListener('pagehide', clear); document.addEventListener('visibilitychange', visibility);
    return () => { mounted.current = false; clear(); window.removeEventListener('offline', clear); window.removeEventListener('online', refresh);
      window.removeEventListener('focus', refresh); window.removeEventListener('pagehide', clear); document.removeEventListener('visibilitychange', visibility); };
  }, [load]);
  useEffect(() => { if (view.kind !== 'loading') heading.current?.focus(); }, [view.kind]);
  const proposalId = proposal?.slot.id;
  useEffect(() => { if (proposalId) document.getElementById('followup-date')?.focus(); }, [proposalId]);

  const confirm = async () => {
    if (view.kind !== 'ready' || !proposal || busy || pending.current || !navigator.onLine) return;
    const selected = followupSelector(new URLSearchParams(window.location.search)); if (!selected) return;
    let command;
    try { command = frontlineReschedule(view.plan, proposal.slot.id, proposal.date, proposal.window); }
    catch { setNotice('Choose a different date and window within the current permitted range.'); return; }
    pending.current = { visitId: command.visitId, date: command.date, window: command.window };
    setUnconfirmed(true); setBusy(true); setNotice('Sending the proposed visit time…');
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
    try {
      const result = await fetch('/api/commands', { method: 'POST', cache: 'no-store', credentials: 'same-origin', signal: controller.signal,
        headers: { 'content-type': 'application/json', 'x-saha-organisation': selected.organisationId, 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify(command) });
      if (!mounted.current) return;
      if ([401, 403, 404].includes(result.status)) { setView({ kind: 'refused' }); setProposal(null); setNotice('Access refused. Protected content cleared.'); return; }
      if (result.status === 409 || result.status === 422) {
        pending.current = null; setUnconfirmed(false); setProposal(null); setView({ kind: 'unavailable' });
        setNotice('The proposal was refused. Refresh the plan before choosing another time.'); return;
      }
      if (!result.ok) throw Error('Result not confirmed');
      rescheduleAccepted(await result.json(), command.visitId);
      await load();
    } catch {
      if (mounted.current) { setProposal(null); setView({ kind: 'unavailable' }); setNotice('Result not confirmed. Refresh to check the saved plan; the request will not be sent again automatically.'); }
    } finally { clearTimeout(timer); if (mounted.current) setBusy(false); }
  };
  const plan = view.kind === 'ready' && view.plan.kind === 'plans' ? view.plan : null;
  return <main className="saha-followups" aria-busy={view.kind === 'loading' || busy}>
    <p>Saha · Synthetic / training</p><h1 tabIndex={-1} ref={heading}>Planned follow-ups</h1>
    <a href="/today">Back to Today</a>
    <p role="status">{notice || (view.kind === 'loading' ? 'Loading the current plan…' : '')}</p>
    {view.kind === 'ready' ? <>
      <h2>{view.record.name}</h2><p>Record reference: {view.record.id}</p>
      <p>A planned visit time does not change clinical due dates or complete any work.</p>
      {view.plan.kind === 'no-household' ? <p>This record is not linked to a household. Household visit plans are not available.</p> :
        !view.plan.slots.length ? <p>No planned household visits for this record.</p> : <ol>{view.plan.slots.map(slot => <li key={slot.id}>
          <h3>{slot.date} · {label(slot.window)}</h3>
          {(slot.personVersions.length > 1 || slot.hasOutsideScope) && <p>This shared visit shows {slot.personVersions.length} {slot.personVersions.length === 1 ? 'person' : 'people'} within your access. Only this record’s work is shown.</p>}
          {slot.hasOutsideScope && <p>Other covered people are outside your access. Their details are not shown, and changing this shared visit time is unavailable.</p>}
          <ul>{slot.items.map(item => <li key={item.kind + ':' + item.id}><strong>{item.title}</strong>
            <p>Due: {item.due ?? 'Not set'} · {item.open ? 'Open' : 'Closed'}{item.daysOverdue > 0 ? ` · Currently ${item.daysOverdue} days overdue` : ''}
              {item.lateByDays > 0 ? ` · Due ${item.lateByDays} days before this visit` : ''}{item.owner ? ` · Owner: ${item.owner}` : ''}</p></li>)}</ul>
          {slot.canReschedule && <button disabled={busy || unconfirmed} onClick={event => {
            trigger.current = event.currentTarget;
            setProposal({ slot, date: slot.date, window: slot.window }); setNotice('');
          }}>Change visit time</button>}
        </li>)}</ol>}
      {proposal && plan && <form aria-label="Change planned visit time" onSubmit={event => { event.preventDefault(); void confirm(); }}>
        <h2>Choose a new visit time</h2>
        <p>This updates the existing planned visit for {proposal.slot.personVersions.length} people. Due dates, owners and completion conditions stay unchanged.</p>
        <label htmlFor="followup-date">New visit date</label><input id="followup-date" type="date" required min={plan.minDate} max={plan.maxDate}
          value={proposal.date} onChange={event => setProposal({ ...proposal, date: event.target.value })} />
        <label htmlFor="followup-window">Time of day</label><select id="followup-window" value={proposal.window}
          onChange={event => setProposal({ ...proposal, window: event.target.value as Proposal['window'] })}>
          {VISIT_WINDOWS.map(value => <option key={value} value={value}>{label(value)}</option>)}
        </select>
        <button type="submit" disabled={busy || (proposal.date === proposal.slot.date && proposal.window === proposal.slot.window)}>Confirm new visit time</button>
        <button type="button" disabled={busy} onClick={() => { setProposal(null); setNotice('Current visit time kept. No change sent.'); trigger.current?.focus(); }}>Keep current visit time</button>
      </form>}
    </> : view.kind !== 'loading' && <p>{view.kind === 'invalid' ? 'Open an assigned record from Today to view its plan.' :
      view.kind === 'refused' ? 'Access refused. Sign in with the assigned ASHA account.' : 'Plan unavailable. Check your connection and refresh.'}</p>}
    <button disabled={busy || view.kind === 'loading'} onClick={() => void load()}>Refresh current plan</button>
  </main>;
}
