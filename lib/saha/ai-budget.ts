import { fail } from './core';
import type { OrgState } from './types';
import type { AgentRun } from './agent';
// Slice 5a: monthly monetary budgets per AI capability (BR-AI-12, BR-AG-07).
//
// Budgets are owner settings in the operations document, keyed by the capability's stable key so
// they survive capability revisions. Spend is an ESTIMATE from the owner-recorded cost rates
// (USD per million tokens), never an invoice:
// - a run with recorded usage costs input * inputRate + output * outputRate;
// - a run that reached a provider without recorded usage, or a pending request that has not
//   expired, is counted at the reserved allowance (6,000 tokens at the higher of the two rates);
// - the local rules-only assistant costs nothing.
// A request is refused before it is prepared or sent when spent + reserved + its own reserved
// allowance would exceed the budget, or when a budget exists but no rates are recorded.
// Nothing is substituted: the worker continues with structured capture.
export const RESERVED_TOKENS = 6000;
export const NEAR_LIMIT = 0.8;
export type Rates = { input: number; output: number; at: string } | null | undefined;
export type Budget = { capabilityKey: string; monthlyUsd: number; setBy: string; setAt: string; reason: string };
type Entry = { id: string; state: string; createdAt: string; revision: number; spec: { kind: string; key: string; title: string; providerId: string } };
const entries = (s: OrgState) => ((s.governance?.entries ?? []) as unknown as Entry[]).filter(e => e.spec.kind === 'capability');
const month = (iso: string) => iso.slice(0, 7);
const round = (n: number) => Math.round(n * 10000) / 10000;
export const reservedUsd = (rates: NonNullable<Rates>) => RESERVED_TOKENS * Math.max(rates.input, rates.output) / 1e6;
export function runCost(r: AgentRun, rates: NonNullable<Rates>, now: string): { usd: number; basis: 'usage' | 'reserved' | 'none' } {
  if (r.provider.mode === 'local') return { usd: 0, basis: 'none' };
  if (r.usage && r.callCount > 0) return month(r.startedAt ?? r.createdAt) === month(now) ? { usd: (r.usage.inputTokens * rates.input + r.usage.outputTokens * rates.output) / 1e6, basis: 'usage' } : { usd: 0, basis: 'none' };
  if (r.callCount > 0) return month(r.startedAt ?? r.createdAt) === month(now) ? { usd: reservedUsd(rates), basis: 'reserved' } : { usd: 0, basis: 'none' };
  if (r.status === 'pending' && r.expiresAt >= now) return { usd: reservedUsd(rates), basis: 'reserved' };
  return { usd: 0, basis: 'none' };
}
// Runs of every revision of the capability `key` in the current UTC month.
export function capabilitySpend(s: OrgState, key: string, rates: NonNullable<Rates>, now: string, excludeRunId?: string) {
  const ids = new Set(entries(s).filter(e => e.spec.key === key).map(e => e.id));
  let spent = 0, reserved = 0, runs = 0, missingUsage = 0;
  for (const r of s.workspace.visits.flatMap(v => v.agentRuns ?? [])) {
    if (r.id === excludeRunId || !r.governance || !ids.has(r.governance.id)) continue;
    const c = runCost(r, rates, now); if (c.basis === 'none') continue;
    runs++; if (c.basis === 'usage') spent += c.usd; else { reserved += c.usd; if (r.callCount > 0) missingUsage++; }
  }
  // Evaluations use the same reviewed provider deployment and the same monthly cap.
  // A checkpointed running or failed case reserves the maximum allowance; recorded
  // usage settles it. This makes concurrent admission safe because the reservation is
  // persisted before provider invocation.
  for (const ev of s.governance?.evaluations ?? []) {
    if (!ids.has(ev.entryId) || ev.provider.mode === 'local') continue;
    for (const result of ev.results) {
      if (!['running', 'completed', 'failed'].includes(result.state) || month(result.startedAt) !== month(now)) continue;
      runs++;
      if (result.usage) spent += (result.usage.inputTokens * rates.input + result.usage.outputTokens * rates.output) / 1e6;
      else { reserved += reservedUsd(rates); missingUsage++; }
    }
  }
  return { month: month(now), spentUsd: round(spent), reservedUsd: round(reserved), runs, missingUsage };
}
export function budgetFor(s: OrgState, key: string): Budget | undefined { return ((s.operations as { budgets?: Budget[] } | undefined)?.budgets ?? []).find(b => b.capabilityKey === key); }
// Called with the daily checks before a request is prepared and again before it is sent.
export function checkMonthlyBudget(s: OrgState, e: { spec: { kind: string; key?: string; providerId?: string } }, excludeRunId?: string, now = new Date().toISOString()) {
  if (e.spec.kind !== 'capability' || !e.spec.key || e.spec.providerId === 'local') return;
  const budget = budgetFor(s, e.spec.key); if (!budget) return;
  const rates = s.operations?.rates;
  if (!rates) fail(409, 'A monthly cost budget is set for this capability but no cost rates are recorded, so the cost cannot be estimated. An owner must record cost assumptions on the Operations page. Continue structured capture; no provider substitution was made.');
  const use = capabilitySpend(s, e.spec.key, rates, now, excludeRunId), next = reservedUsd(rates);
  if (use.spentUsd + use.reservedUsd + next > budget.monthlyUsd) fail(429, `This capability reached its monthly cost budget (estimated USD ${(use.spentUsd + use.reservedUsd).toFixed(2)} of ${budget.monthlyUsd.toFixed(2)} used or reserved; a request reserves ${next.toFixed(4)}). Continue structured capture; no provider substitution was made. Estimates use recorded cost assumptions and are not an invoice.`);
}
// Operations view: one row per capability key, the newest revision's title and provider.
export function budgetView(s: OrgState, now = new Date().toISOString()) {
  const rates = s.operations?.rates, latest = new Map<string, Entry>();
  for (const e of entries(s).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.revision - b.revision)) latest.set(e.spec.key, e);
  return [...latest.values()].map(e => {
    const budget = budgetFor(s, e.spec.key), local = e.spec.providerId === 'local';
    const use = rates ? capabilitySpend(s, e.spec.key, rates, now) : null, used = use ? use.spentUsd + use.reservedUsd : null;
    const state = local ? 'no-charge' : !budget ? 'no-budget' : !rates ? 'no-rates' : used! + reservedUsd(rates) > budget.monthlyUsd ? 'reached' : used! >= NEAR_LIMIT * budget.monthlyUsd ? 'near' : 'within';
    return { capabilityKey: e.spec.key, title: e.spec.title, providerId: e.spec.providerId, capabilityState: e.state, monthlyUsd: budget?.monthlyUsd ?? null, setBy: budget?.setBy ?? null, setAt: budget?.setAt ?? null, month: now.slice(0, 7), spentUsd: use?.spentUsd ?? null, reservedUsd: use?.reservedUsd ?? null, remainingUsd: budget && used !== null ? round(Math.max(0, budget.monthlyUsd - used)) : null, runs: use?.runs ?? null, missingUsage: use?.missingUsage ?? null, state };
  });
}
export const BUDGET_NOTICE = 'Estimated from recorded cost assumptions and recorded or reserved token use for agent requests and synthetic evaluations; not an invoice or provider bill. Hosting and other charges are excluded.';
