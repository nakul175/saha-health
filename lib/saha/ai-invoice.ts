import { z } from 'zod';
import { fail, uuid } from './core';
import { reservedUsd } from './ai-budget';
import type { Actor } from './store';
import type { Member, OrgState } from './types';
import type { AgentRun } from './agent';
// Slice 5h: AI invoice reconciliation (BR-AI-12, BR-AG-07, BR-OPS-04).
//
// Spend shown elsewhere is an ESTIMATE from recorded cost rates and token use (slice 5a). An owner can record a
// provider's invoice summary for one provider and one UTC month as a small CSV (provider, model, month, input
// tokens, output tokens, amount in USD, invoice reference; no invoice file) and compare it with Saha's own records
// of agent requests sent to that provider in that month, per model. Each reconciliation keeps a snapshot of both
// sides, the differences and the owner's threshold; lines whose difference exceeds the threshold are flagged.
// Records are append-only: a later reconciliation for the same provider and month names the one it supersedes,
// and neither is ever changed. Nothing here changes budgets, rates or requests. Agent requests only: evaluations,
// shadow runs (local only), legacy AI, hosting and other charges are not counted.
export const INVOICE_CSV_MAX = 4000, INVOICE_MAX_LINES = 12, MAX_RECONCILIATIONS = 60, FIRST_MONTH = '2020-01';
export const INVOICE_COLUMNS = ['provider', 'model', 'month', 'input_tokens', 'output_tokens', 'amount_usd', 'invoice_reference'] as const;
export const INVOICE_NOTICE = 'Saha figures are estimates from recorded token use and the current cost assumptions (a sent request without recorded usage counts at the reserved allowance). The invoice figures are what an owner recorded from the provider. Agent requests only; evaluations, hosting and other charges are excluded. Reconciling never changes budgets or cost assumptions.';
export type InvoiceFlag = 'usd' | 'tokens' | 'no-rates';
export type InvoiceLine = { model: string; source: 'both' | 'invoice-only' | 'saha-only'; runs: number; missingUsage: number; estimated: { inputTokens: number; outputTokens: number; usd: number | null }; invoiced: { inputTokens: number; outputTokens: number; usd: number }; difference: { inputTokens: number; outputTokens: number; usd: number | null }; variance: { tokensPercent: number | null; usdPercent: number | null }; flags: InvoiceFlag[] };
export type InvoiceReconciliation = { id: string; provider: string; month: string; invoiceReference: string; thresholdPercent: number; rates: { input: number; output: number; at: string } | null; recordedAt: string; recordedBy: string; recordedByName: string; reason: string; supersedes: string | null; lines: InvoiceLine[]; totals: { estimatedUsd: number | null; invoicedUsd: number; differenceUsd: number | null; flaggedLines: number } };
const version = z.number().int().min(0);
export const invoiceSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('opsInvoiceReconcile'), version, csv: z.string().min(1).max(INVOICE_CSV_MAX), thresholdPercent: z.number().min(0.1).max(100), reason: z.string().trim().min(5).max(500) }).strict()
]);
const round = (n: number, d = 4) => Math.round(n * 10 ** d) / 10 ** d;
const monthOf = (iso: string) => iso.slice(0, 7);
export function previousMonth(now: string) { const d = new Date(now); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)).toISOString().slice(0, 7); }
// RFC 4180 subset: quoted fields, doubled quotes, CRLF or LF, a byte-order mark and blank lines.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], field = '', quoted = false, i = 0;
  const src = text.replace(/^﻿/, '');
  while (i < src.length) {
    const ch = src[i];
    if (quoted) { if (ch === '"') { if (src[i + 1] === '"') { field += '"'; i += 2; continue; } quoted = false; i++; continue; } field += ch; i++; continue; }
    if (ch === '"' && field === '') { quoted = true; i++; continue; }
    if (ch === ',') { row.push(field); field = ''; i++; continue; }
    if (ch === '\r' || ch === '\n') { row.push(field); field = ''; if (row.some(x => x.trim() !== '')) rows.push(row); row = []; i += ch === '\r' && src[i + 1] === '\n' ? 2 : 1; continue; }
    field += ch; i++;
  }
  if (quoted) fail(422, 'The file has an unclosed quotation mark.');
  row.push(field); if (row.some(x => x.trim() !== '')) rows.push(row);
  return rows;
}
const PROVIDER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/, MODEL = /^[A-Za-z0-9][A-Za-z0-9._:/@+ -]{0,119}$/, REFERENCE = /^[A-Za-z0-9][A-Za-z0-9 ._/#:-]{0,79}$/, MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;
const TOKENS = /^\d{1,13}$/, AMOUNT = /^\d{1,8}(\.\d{1,6})?$/;
export type InvoiceRow = { model: string; inputTokens: number; outputTokens: number; amountUsd: number };
// Validates the whole file and reports every problem with its row number; nothing is stored on failure.
export function parseInvoice(csv: string, now: string) {
  const rows = parseCsv(csv); if (!rows.length) fail(422, 'The file is empty.');
  const header = rows[0].map(h => h.trim().toLowerCase());
  const missing = INVOICE_COLUMNS.filter(c => !header.includes(c)), unknown = header.filter(h => !(INVOICE_COLUMNS as readonly string[]).includes(h)), repeated = header.filter((h, i) => header.indexOf(h) !== i);
  if (missing.length || unknown.length || repeated.length) fail(422, `The header must name exactly ${INVOICE_COLUMNS.join(', ')}, each once.${missing.length ? ` Missing: ${missing.join(', ')}.` : ''}${unknown.length ? ` Not recognised: ${unknown.length} column(s).` : ''}${repeated.length ? ' A column is repeated.' : ''}`);
  const data = rows.slice(1); if (!data.length) fail(422, 'The file has no invoice lines.'); if (data.length > INVOICE_MAX_LINES) fail(422, `At most ${INVOICE_MAX_LINES} invoice lines per reconciliation.`);
  const col = (r: string[], c: typeof INVOICE_COLUMNS[number]) => (r[header.indexOf(c)] ?? '').trim();
  const issues: string[] = [], lines: InvoiceRow[] = [], current = monthOf(now);
  let provider = '', month = '', reference = '';
  data.forEach((r, i) => {
    const n = i + 2, bad = (why: string) => issues.push(`Row ${n}: ${why}`);
    if (r.length !== header.length) return bad(`expected ${header.length} fields, found ${r.length}.`);
    const p = col(r, 'provider'), mo = col(r, 'model'), m = col(r, 'month'), it = col(r, 'input_tokens'), ot = col(r, 'output_tokens'), a = col(r, 'amount_usd'), ref = col(r, 'invoice_reference');
    if (!PROVIDER.test(p)) bad('provider must be a provider identifier (letters, digits, dot, colon, hyphen or underscore).');
    if (!MODEL.test(mo)) bad('model must be 1–120 characters of letters, digits and . _ : / @ + - or space, starting with a letter or digit.');
    if (!MONTH.test(m) || m < FIRST_MONTH) bad('month must be YYYY-MM from 2020-01.'); else if (m > current) bad('month cannot be in the future.');
    if (!TOKENS.test(it) || !TOKENS.test(ot)) bad('token counts must be whole numbers of 0 or more.');
    if (!AMOUNT.test(a) || Number(a) > 10000000) bad('amount_usd must be a number of 0 or more with at most 6 decimals.');
    if (!REFERENCE.test(ref)) bad('invoice_reference must be 1–80 characters of letters, digits, space and . _ / # : -, starting with a letter or digit.');
    if (i === 0) { provider = p; month = m; reference = ref; }
    else { if (p !== provider) bad('every line must name the same provider.'); if (m !== month) bad('every line must name the same month.'); if (ref !== reference) bad('every line must carry the same invoice reference.'); }
    if (lines.some(l => l.model === mo)) bad('each model appears once.');
    lines.push({ model: mo, inputTokens: Number(it), outputTokens: Number(ot), amountUsd: Number(a) });
  });
  if (issues.length) fail(422, `The invoice summary was not recorded. ${issues.slice(0, 20).join(' ')}${issues.length > 20 ? ` And ${issues.length - 20} more.` : ''}`);
  return { provider, month, invoiceReference: reference, rows: lines };
}
// Saha's own record of agent requests sent to `provider` in `month`, per model. Only requests that reached the
// provider count (callCount > 0); the local rules assistant is never billed.
export function sahaUsage(s: OrgState, provider: string, month: string) {
  const out = new Map<string, { runs: number; missingUsage: number; inputTokens: number; outputTokens: number }>();
  for (const r of s.workspace.visits.flatMap(v => (v.agentRuns ?? []) as AgentRun[])) {
    if (r.provider.mode === 'local' || r.callCount <= 0 || r.provider.id !== provider || monthOf(r.startedAt ?? r.createdAt) !== month) continue;
    const x = out.get(r.provider.model) ?? { runs: 0, missingUsage: 0, inputTokens: 0, outputTokens: 0 };
    x.runs++; if (r.usage) { x.inputTokens += r.usage.inputTokens; x.outputTokens += r.usage.outputTokens; } else x.missingUsage++;
    out.set(r.provider.model, x);
  }
  return out;
}
const pct = (diff: number, base: number) => base > 0 ? round(Math.abs(diff) / base * 100, 2) : null;
export function reconcileLines(s: OrgState, parsed: ReturnType<typeof parseInvoice>, thresholdPercent: number) {
  const rates = s.operations?.rates ?? null, usage = sahaUsage(s, parsed.provider, parsed.month);
  const models = [...new Set([...parsed.rows.map(r => r.model), ...usage.keys()])];
  return models.map((model): InvoiceLine => {
    const inv = parsed.rows.find(r => r.model === model), est = usage.get(model) ?? { runs: 0, missingUsage: 0, inputTokens: 0, outputTokens: 0 };
    const estUsd = rates ? round((est.inputTokens * rates.input + est.outputTokens * rates.output) / 1e6 + est.missingUsage * reservedUsd(rates)) : null;
    const invoiced = { inputTokens: inv?.inputTokens ?? 0, outputTokens: inv?.outputTokens ?? 0, usd: inv?.amountUsd ?? 0 };
    const difference = { inputTokens: invoiced.inputTokens - est.inputTokens, outputTokens: invoiced.outputTokens - est.outputTokens, usd: estUsd === null ? null : round(invoiced.usd - estUsd) };
    const tokenDiff = difference.inputTokens + difference.outputTokens, invoicedTokens = invoiced.inputTokens + invoiced.outputTokens;
    const variance = { tokensPercent: pct(tokenDiff, invoicedTokens), usdPercent: difference.usd === null ? null : pct(difference.usd, invoiced.usd) };
    const flags: InvoiceFlag[] = [];
    // Flag when the difference exceeds the threshold share of the invoiced figure, or the invoice shows none while Saha recorded some.
    if (difference.usd !== null && (variance.usdPercent === null ? difference.usd !== 0 : variance.usdPercent > thresholdPercent)) flags.push('usd');
    if (variance.tokensPercent === null ? tokenDiff !== 0 : variance.tokensPercent > thresholdPercent) flags.push('tokens');
    if (!rates) flags.push('no-rates');
    return { model, source: inv && usage.has(model) ? 'both' : inv ? 'invoice-only' : 'saha-only', runs: est.runs, missingUsage: est.missingUsage, estimated: { inputTokens: est.inputTokens, outputTokens: est.outputTokens, usd: estUsd }, invoiced, difference, variance, flags };
  });
}
export const reconciliations = (s: OrgState) => ((s.operations as { invoiceReconciliations?: InvoiceReconciliation[] } | undefined)?.invoiceReconciliations ?? []);
export function applyInvoiceReconciliation(s: OrgState, input: unknown, u: Actor, m: Member, now = new Date().toISOString()) {
  const parsed = invoiceSchema.safeParse(input); if (!parsed.success) return null; const c = parsed.data;
  if (m.status !== 'active' || !m.isOwner) fail(403, 'Only an organisation owner can record an invoice reconciliation.');
  const ops = s.operations ??= { version: 0, maintenance: false, reason: '', updatedAt: '', incidents: [], rates: null };
  if (c.version !== ops!.version) fail(409, 'Operations changed. Refresh and review the latest state.');
  const invoice = parseInvoice(c.csv, now), list = reconciliations(s);
  if (list.length >= MAX_RECONCILIATIONS) fail(422, `At most ${MAX_RECONCILIATIONS} invoice reconciliations are kept; archive policy requires operator review.`);
  const lines = reconcileLines(s, invoice, c.thresholdPercent);
  const previous = list.filter(r => r.provider === invoice.provider && r.month === invoice.month).sort((a, b) => a.recordedAt.localeCompare(b.recordedAt)).at(-1);
  const estimated = lines.every(l => l.estimated.usd !== null) ? round(lines.reduce((n, l) => n + l.estimated.usd!, 0)) : null, invoiced = round(lines.reduce((n, l) => n + l.invoiced.usd, 0));
  const record: InvoiceReconciliation = { id: uuid(), provider: invoice.provider, month: invoice.month, invoiceReference: invoice.invoiceReference, thresholdPercent: c.thresholdPercent, rates: ops!.rates ?? null, recordedAt: now, recordedBy: u.userId, recordedByName: u.displayName, reason: c.reason, supersedes: previous?.id ?? null, lines, totals: { estimatedUsd: estimated, invoicedUsd: invoiced, differenceUsd: estimated === null ? null : round(invoiced - estimated), flaggedLines: lines.filter(l => l.flags.length).length } };
  (ops as { invoiceReconciliations?: InvoiceReconciliation[] }).invoiceReconciliations = [...list, record];
  ops!.version++; ops!.updatedAt = now;
  s.workspace.audit.push({ id: uuid(), at: now, actorId: u.userId, actor: u.displayName, role: m.role, action: 'opsInvoiceReconcile', subject: s.organisation.id, detail: `Invoice ${record.invoiceReference} for provider ${record.provider}, ${record.month}, reconciled against Saha estimates: invoiced USD ${invoiced.toFixed(2)}, estimated ${estimated === null ? 'unknown (no cost rates)' : 'USD ' + estimated.toFixed(2)}, ${record.lines.length} line(s), ${record.totals.flaggedLines} above the ${c.thresholdPercent}% threshold.${previous ? ` Supersedes reconciliation ${previous.id}.` : ''} Budgets and cost assumptions unchanged: ${c.reason}` });
  return { reconciliationId: record.id, supersedes: record.supersedes, flaggedLines: record.totals.flaggedLines, lines: record.lines.length };
}
// Operations view: newest first, each with the record that superseded it (if any).
export function invoiceView(s: OrgState) {
  const list = reconciliations(s), by = new Map(list.filter(r => r.supersedes).map(r => [r.supersedes!, r.id]));
  return { notice: INVOICE_NOTICE, columns: INVOICE_COLUMNS, maxLines: INVOICE_MAX_LINES, records: [...list].reverse().map(r => ({ ...r, supersededBy: by.get(r.id) ?? null, current: !by.has(r.id) })) };
}
// Slice 5h alerts (owners): for the previous UTC month, providers with sent agent requests but no reconciliation,
// and current reconciliations with flagged lines.
export function invoiceAlertInputs(s: OrgState, now = new Date().toISOString()) {
  const month = previousMonth(now), list = reconciliations(s), superseded = new Set(list.map(r => r.supersedes).filter(Boolean));
  const used = new Set<string>();
  for (const r of s.workspace.visits.flatMap(v => (v.agentRuns ?? []) as AgentRun[])) if (r.provider.mode !== 'local' && r.callCount > 0 && monthOf(r.startedAt ?? r.createdAt) === month) used.add(r.provider.id);
  const current = list.filter(r => r.month === month && !superseded.has(r.id));
  return { month, unreconciled: [...used].filter(p => !current.some(r => r.provider === p)).sort(), flagged: current.filter(r => r.totals.flaggedLines > 0).map(r => ({ provider: r.provider, invoiceReference: r.invoiceReference, flaggedLines: r.totals.flaggedLines })) };
}
