'use client';
import { STAGE_LABEL, type LifecycleStage } from '@/lib/saha/capability-lifecycle';
// Slice 5g: provider and model history per capability key (governance managers). Counts only.
const CHANGE_LABEL: Record<string, string> = { provider: 'Provider changed', model: 'Model changed', 'agent-version': 'Agent version changed' };
const day = (x: string | null) => x ? x.slice(0, 10) : '—';
export function ProviderHistory({ history, providers }: { history: any[]; providers: any[] }) {
  if (!history.length) return null;
  const name = (id: string) => providers.find(p => p.id === id)?.name ?? id;
  return <section className="panel provider-history" aria-labelledby="provider-history-title"><h2 id="provider-history-title">Provider and model history</h2>
    <p className="muted text-sm">Each revision pins one provider, model and agent version. A change needs a new revision with its own evaluation, independent review and owner activation. Request counts include every status.</p>
    {history.map(h => <div key={h.key}><h3>{h.title} <small className="muted">({h.key} · {h.providers} provider{h.providers === 1 ? '' : 's'})</small></h3>
      <table className="shadow-table"><caption className="sr-only">Provider and model by revision for {h.title}</caption><thead><tr><th scope="col">Revision</th><th scope="col">Provider</th><th scope="col">Model</th><th scope="col">Agent</th><th scope="col">Stage</th><th scope="col">Active from</th><th scope="col">Until</th><th scope="col">Requests</th><th scope="col">Change from previous</th></tr></thead>
        <tbody>{h.revisions.map((r: any) => <tr key={r.entryId}><th scope="row">{r.revision}</th><td>{name(r.providerId)}</td><td>{r.model}</td><td>{r.agentVersion}</td><td>{STAGE_LABEL[r.stage as LifecycleStage] ?? r.stage}</td><td>{day(r.activatedAt)}</td><td>{r.activatedAt ? (r.endedAt ? day(r.endedAt) : r.state === 'active' ? 'Current' : '—') : '—'}</td><td>{r.requests}</td><td>{r.changes.length ? r.changes.map((c: string) => CHANGE_LABEL[c] ?? c).join(', ') : r.revision === 1 ? 'First revision' : 'None'}</td></tr>)}</tbody></table></div>)}
  </section>;
}
