'use client';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import type { Snapshot } from '@/lib/saha/types';

type CommandBody = { type: string; [key: string]: unknown };
type Command = (body: CommandBody, success?: string) => Promise<unknown>;
type AssignedWork = { personId: string; personVersion: number; name: string; task: string; due: string; localityLabel: string | null; status: string };
type SuggestedTask = { position: number; availability: 'available' | 'unavailable'; personId?: string; name?: string; task?: string; due?: string; localityLabel?: string | null; reason?: string };
type Suggestion = { id: string; version: number; state: 'active' | 'declined'; available: boolean; tasks: SuggestedTask[]; fallback: string | null };
type RouteSuggestionView = { work: AssignedWork[]; suggestions: Suggestion[]; fallback: string | null; consequence: string; error?: string };

export function RouteSuggestionsPanel({ data, busy, command }: { data: Snapshot; busy: boolean; command: Command }) {
  const [value, setValue] = useState<RouteSuggestionView | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [reason, setReason] = useState('Worker chose a different order.');
  const organisationId = data.organisation.id;
  const membershipVersion = data.membership.version;

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/route-suggestions', { cache: 'no-store', headers: { 'x-saha-organisation': organisationId } });
      const next = await response.json() as RouteSuggestionView;
      if (!response.ok) throw Error(next.error ?? 'Route suggestions are unavailable.');
      setValue(next);
      setError('');
      setSelected(current => current.filter(personId => next.work.some(work => work.personId === personId)));
    } catch (caught) {
      setValue(null);
      setError(caught instanceof Error ? caught.message : 'Route suggestions are unavailable.');
    }
  }, [organisationId]);

  useEffect(() => {
    const pending = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(pending);
  }, [load, membershipVersion]);

  const run = async (body: CommandBody, message: string) => {
    const result = await command(body, message);
    if (result) await load();
  };
  const active = value?.suggestions.find(suggestion => suggestion.state === 'active');
  const taskIds = (suggestion: Suggestion) => suggestion.tasks.flatMap(task => task.personId ? [task.personId] : []);
  const move = (suggestion: Suggestion, at: number, by: number) => {
    const next = taskIds(suggestion);
    const to = at + by;
    if (to < 0 || to >= next.length) return;
    [next[at], next[to]] = [next[to], next[at]];
    void run({ type: 'routeSuggestionReorder', suggestionId: suggestion.id, expectedVersion: suggestion.version, personIds: next }, 'Route suggestion reordered.');
  };

  return <section className="panel" aria-labelledby="route-suggestion-title">
    <div className="section-heading"><div><div className="eyebrow">OPTIONAL PLANNING</div><h2 id="route-suggestion-title">Route suggestions</h2></div><span className="tag neutral">Worker controlled</span></div>
    <p>Choose current assigned work for a local suggestion using due dates and existing locality labels. It is separate from assignment and never changes completion, care access, pay or sanctions.</p>
    <p className="muted text-sm">No map, navigation provider, coordinates or background tracking are used.</p>
    {error && <p role="alert" className="notice amber-notice">{error}</p>}
    {value?.fallback && <p role="status" className="notice amber-notice">{value.fallback}</p>}
    {value && <div className="patient-list">{value.work.slice(0, 25).map(work => <label className="patient-row" key={work.personId}><Checkbox checked={selected.includes(work.personId)} onCheckedChange={yes => setSelected(current => yes ? [...current, work.personId].slice(0, 25) : current.filter(personId => personId !== work.personId))}/><span className="patient-row-name"><strong>{work.name}</strong><span>{work.task} · {work.due}</span></span><span>{work.localityLabel ?? 'Locality unavailable'}</span></label>)}</div>}
    <div className="button-row"><Button disabled={busy || !selected.length} onClick={() => void run({ type: 'routeSuggestionCreate', personIds: selected }, 'Optional route suggestion created.')}>Suggest order for selected work</Button>{active && <Button variant="outline" disabled={busy || !selected.length || reason.trim().length < 5} onClick={() => void run({ type: 'routeSuggestionOverride', suggestionId: active.id, expectedVersion: active.version, personIds: selected, reason }, 'Route suggestion overridden.')}>Replace active suggestion</Button>}<Button variant="ghost" disabled={busy} onClick={() => void load()}>Refresh</Button></div>
    {active && <Input aria-label="Reason for override or decline" value={reason} onChange={event => setReason(event.target.value)} maxLength={500}/>}
    {value?.suggestions.map(suggestion => <article key={suggestion.id} className="panel"><div className="section-heading"><h3>Suggestion · version {suggestion.version}</h3><span className={`tag ${suggestion.available ? 'success' : 'amber'}`}>{suggestion.state === 'declined' ? 'Declined' : suggestion.available ? 'Available' : 'Unavailable'}</span></div>{suggestion.fallback && <p role="status" className="notice amber-notice">{suggestion.fallback}</p>}<ol>{suggestion.tasks.map((task, index) => <li key={`${suggestion.id}-${task.position}`}><strong>{task.availability === 'available' ? task.name : 'Unavailable assigned task'}</strong>{task.availability === 'available' ? ` · ${task.task} · ${task.due} · ${task.localityLabel}` : ` · ${task.reason}`}{suggestion.state === 'active' && suggestion.available && task.personId && <span className="button-row"><Button size="sm" variant="outline" disabled={busy || index === 0} onClick={() => move(suggestion, index, -1)}>Move up</Button><Button size="sm" variant="outline" disabled={busy || index === taskIds(suggestion).length - 1} onClick={() => move(suggestion, index, 1)}>Move down</Button></span>}</li>)}</ol>{suggestion.state === 'active' && <div className="button-row"><Button variant="outline" disabled={busy || reason.trim().length < 5} onClick={() => void run({ type: 'routeSuggestionDecline', suggestionId: suggestion.id, expectedVersion: suggestion.version, reason }, 'Route suggestion declined. Assigned work is unchanged.')}>Decline suggestion</Button></div>}</article>)}
    {value && <p className="muted text-sm">{value.consequence}</p>}
  </section>;
}
