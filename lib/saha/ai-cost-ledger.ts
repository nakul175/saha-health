import type { AgentRun } from './agent';
import type { OrgState } from './types';
import type { GovernanceEntry } from './governance';

// SAHA-063: a bounded, aggregate billable-event ledger. It deliberately exposes no
// patient, visit, prompt, response or actor data. Each provider event is attributable
// to the tenant (the containing OrgState), capability, immutable deployment manifest
// and task/system activity, or is counted explicitly as unattributed.
export const ATTRIBUTION_TARGET = 0.99;
type Metered = {
  providerId: string;
  model: string;
  capabilityKey: string | null;
  deployment: string | null;
  task: string;
  inputTokens: number | null;
  outputTokens: number | null;
  reserved: boolean;
  attributed: boolean;
};
const monthOf = (iso: string) => iso.slice(0, 7);
const entryIndex = (s: OrgState) => new Map((s.governance?.entries ?? []).filter(e => e.spec.kind === 'capability').map(e => [e.id, e]));
const dimensions = (e: GovernanceEntry | undefined) => e?.spec.kind === 'capability'
  ? { capabilityKey: e.spec.key, deployment: `${e.id}:r${e.revision}:${e.manifestHash}` }
  : { capabilityKey: null, deployment: null };

export function meteredEvents(s: OrgState, now = new Date().toISOString()): Metered[] {
  const month = monthOf(now), entries = entryIndex(s), out: Metered[] = [];
  for (const r of s.workspace.visits.flatMap(v => (v.agentRuns ?? []) as AgentRun[])) {
    if (r.provider.mode === 'local' || r.callCount <= 0 || monthOf(r.startedAt ?? r.createdAt) !== month) continue;
    const e = r.governance ? entries.get(r.governance.id) : undefined, d = dimensions(e);
    const bound = !!e && r.governance?.version === e.version && r.governance?.manifestHash === e.manifestHash;
    out.push({ providerId: r.provider.id, model: r.provider.model, ...d, task: r.task, inputTokens: r.usage?.inputTokens ?? null, outputTokens: r.usage?.outputTokens ?? null, reserved: !r.usage, attributed: bound });
  }
  for (const ev of s.governance?.evaluations ?? []) {
    if (ev.provider.mode === 'local') continue;
    const e = entries.get(ev.entryId), d = dimensions(e), bound = !!e && ev.manifestHash === e.manifestHash;
    for (const r of ev.results) {
      if (!['running', 'completed', 'failed'].includes(r.state) || monthOf(r.startedAt) !== month) continue;
      out.push({ providerId: ev.provider.id, model: ev.provider.model, ...d, task: 'system:evaluation', inputTokens: r.usage?.inputTokens ?? null, outputTokens: r.usage?.outputTokens ?? null, reserved: !r.usage, attributed: bound });
    }
  }
  return out;
}

export function costLedger(s: OrgState, now = new Date().toISOString()) {
  const events = meteredEvents(s, now), attributed = events.filter(e => e.attributed).length;
  const key = (e: Metered) => JSON.stringify([e.providerId, e.model, e.capabilityKey, e.deployment, e.task]);
  const grouped = new Map<string, Metered[]>();
  for (const e of events) grouped.set(key(e), [...(grouped.get(key(e)) ?? []), e]);
  const rows = [...grouped.values()].map(rows => {
    const first = rows[0], known = rows.filter(r => !r.reserved);
    return { providerId: first.providerId, model: first.model, capabilityKey: first.capabilityKey, deployment: first.deployment, task: first.task, events: rows.length, attributed: rows.filter(r => r.attributed).length, missingUsage: rows.filter(r => r.reserved).length, inputTokens: known.reduce((n, r) => n + r.inputTokens!, 0), outputTokens: known.reduce((n, r) => n + r.outputTokens!, 0) };
  }).sort((a, b) => [a.providerId, a.capabilityKey ?? '', a.deployment ?? '', a.task].join('\0').localeCompare([b.providerId, b.capabilityKey ?? '', b.deployment ?? '', b.task].join('\0')));
  const coverage = events.length ? attributed / events.length : 1;
  return { month: monthOf(now), target: ATTRIBUTION_TARGET, billableEvents: events.length, attributedEvents: attributed, unattributedEvents: events.length - attributed, coverage, targetMet: coverage >= ATTRIBUTION_TARGET, rows, notice: 'Aggregate provider usage only. Patient, visit, prompt, response and actor data are excluded. Missing provider usage is retained as a reserved event and never silently discarded.' };
}
