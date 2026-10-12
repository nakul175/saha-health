'use client';
import { useEffect, useState } from 'react';
import { parseTaskEntry, TASK_ENTRY_MAX_LENGTH, type TaskEntryResult } from '@/lib/saha/task-entry';
import './task-entry.css';

export default function TaskEntry() {
  const [phrase, setPhrase] = useState('');
  const [proposal, setProposal] = useState<TaskEntryResult | null>(null);
  const [ready, setReady] = useState(false);
  // A server-rendered button must not silently discard a pre-hydration click.
  useEffect(() => { const frame = requestAnimationFrame(() => setReady(true)); return () => cancelAnimationFrame(frame); }, []);
  const cancel = () => { setPhrase(''); setProposal(null); };
  return <main className="saha-task-entry" aria-busy={!ready}>
    <p>Saha · Synthetic / training</p>
    <h1>Task shortcuts</h1>
    <p>Deterministic navigation. These shortcuts use a fixed list, not a live AI provider.</p>
    <p>No person or organisation is selected here. Access is checked by the existing server when you open Today.</p>
    <section aria-label="Available navigation shortcuts">
      <h2>Choose a task</h2>
      <button disabled={!ready} onClick={() => { setPhrase(''); setProposal(parseTaskEntry('today')); }}>Open assigned records</button>
      <button disabled={!ready} onClick={() => { setPhrase(''); setProposal(parseTaskEntry('review a routine visit')); }}>Review a routine visit</button>
    </section>
    <form onSubmit={event => { event.preventDefault(); setProposal(parseTaskEntry(phrase)); }}>
      <label htmlFor="shortcut-phrase">Optional shortcut phrase</label>
      <p id="shortcut-help">Use “open today” or “review a routine visit”. Do not enter patient details. Other requests are not interpreted.</p>
      <input id="shortcut-phrase" aria-describedby="shortcut-help" disabled={!ready} maxLength={TASK_ENTRY_MAX_LENGTH} value={phrase}
        autoComplete="off" onChange={event => { setPhrase(event.target.value); setProposal(null); }}/>
      <button type="submit" disabled={!ready}>Check shortcut</button>
    </form>
    <div aria-live="polite" aria-atomic="true">
      {!ready && <p role="status">Loading shortcuts…</p>}
      {proposal?.kind === 'refused' && <p role="status">{proposal.message}</p>}
      {proposal?.kind === 'navigation' && <section aria-label="Navigation proposal">
        <h2>{proposal.title}</h2><p>Nothing has been saved or started. You still choose the person and task.</p>
        <ol>{proposal.steps.map(step => <li key={step}>{step}</li>)}</ol>
        <a href={proposal.href}>Continue to Today</a>
      </section>}
    </div>
    <button disabled={!ready} onClick={cancel}>Cancel shortcut</button>
    <a href="/today">Open Today directly</a>
  </main>;
}
