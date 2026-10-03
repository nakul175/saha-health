import { z } from 'zod';
import { fail, uuid } from './core';
import { entryFor, entryIssues, entryScope, governanceState, type GovernanceEntry } from './governance';
import { checkMonthlyBudget } from './ai-budget';
import { FIELDS, FIELD_LABEL, localAssess, localExtract, validateOutput, type AgentField, type AgentOutput } from './agent';
import { normallyAllowed } from './access';
import type { Actor } from './store';
import type { Member, OrgState, Person, Visit } from './types';
// Slice 5f (BR-AI-04, BR-AI-10): shadow operation of a reviewed capability revision.
//
// An owner or clinician governance manager puts a reviewed (not yet active) capability revision into shadow
// for a scope (named teams, or the whole organisation for an owner) until a date at most 30 days ahead.
// When a manager runs the shadow, the capability runs on visits confirmed during the period, in scope.
// Outputs are stored in the governance record only: never in the visit, never shown to field workers,
// never applied and never in the action plan. Managers see counts per field comparing the shadow output
// with the clinician-confirmed values: agreement, disagreement, missing (confirmed value, no shadow value),
// not recorded (shadow value, no confirmed value) and unable to assess.
// A visit is not run, and counted by reason, when AI permission is not current (slice 6o withdrawal),
// processing is restricted, the person is outside the capability's age range, there is no recorded note, the
// capability's monthly budget is reached (slice 5a), or the provider is external: this build calls only the
// local rules provider in shadow. A suspended or retired revision does not run at all (slice 5d).
export const SHADOW_MAX_DAYS = 30, SHADOW_BATCH = 50, MAX_SHADOWS = 50, MAX_RESULTS = 2000;
export type ShadowOutcome = 'agreement' | 'disagreement' | 'missing' | 'not-recorded' | 'unable';
export const OUTCOMES: ShadowOutcome[] = ['agreement', 'disagreement', 'missing', 'not-recorded', 'unable'];
export const NOT_RUN = ['consent', 'restricted', 'outside-scope', 'no-source', 'budget', 'external-provider'] as const;
export type NotRunReason = typeof NOT_RUN[number];
export const NOT_RUN_LABEL: Record<NotRunReason, string> = { consent: 'AI permission not current', restricted: 'Processing restricted', 'outside-scope': 'Outside the capability age range', 'no-source': 'No recorded visit note', budget: 'Monthly budget reached', 'external-provider': 'External provider not called in shadow' };
export type ShadowResult = { visitId: string; personId: string; visitVersion: number; at: string; status: 'compared' | 'unable' | 'not-run'; reason?: NotRunReason; output?: AgentOutput; fields?: { field: AgentField; shadow: string | null; confirmed: string | null; outcome: ShadowOutcome }[] };
export type Shadow = { id: string; entryId: string; revision: number; manifestHash: string; key: string; scope: 'organisation' | 'teams'; teamIds: string[]; startedAt: string; until: string; startedBy: string; reason: string; state: 'active' | 'stopped'; version: number; stoppedAt?: string; stoppedBy?: string; stopReason?: string; results: ShadowResult[] };
const id = z.string().trim().min(1).max(200), text = z.string().trim().min(10).max(1000), day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const shadowSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('startShadow'), entryId: id, version: z.number().int().positive(), scope: z.enum(['organisation', 'teams']), teamIds: z.array(id).max(20).default([]), until: day, reason: text }).strict(),
  z.object({ type: z.literal('runShadow'), shadowId: id, version: z.number().int().positive() }).strict(),
  z.object({ type: z.literal('stopShadow'), shadowId: id, version: z.number().int().positive(), reason: text }).strict(),
]);
export const shadowsOf = (s: OrgState) => governanceState(s).shadows ?? [];
export const shadowManager = (m: Member) => m.status === 'active' && (m.isOwner || m.role === 'clinician');
const endOf = (sh: Shadow) => sh.until + 'T23:59:59.999Z';
export function shadowState(s: OrgState, sh: Shadow, now = new Date().toISOString()): 'active' | 'stopped' | 'ended' | 'halted' {
  if (sh.state === 'stopped') return 'stopped'; if (now > endOf(sh)) return 'ended';
  const e = governanceState(s).entries.find(x => x.id === sh.entryId);
  return !e || !['reviewed', 'active'].includes(e.state) || e.manifestHash !== sh.manifestHash ? 'halted' : 'active';
}
function findShadow(s: OrgState, shadowId: string) { const sh = shadowsOf(s).find(x => x.id === shadowId); if (!sh) fail(404, 'Shadow operation not found.'); return sh!; }
export function authorizeShadow(s: OrgState, m: Member, c: { type: string; entryId?: string; shadowId?: string; scope?: string }) {
  if (!shadowSchema.options.some(o => o.shape.type.value === c.type)) return;
  if (!shadowManager(m)) fail(403, 'An owner or clinician governance manager runs shadow operation.');
  const e = c.entryId ? entryFor(s, c.entryId) : entryFor(s, findShadow(s, c.shadowId!).entryId);
  if (!entryScope(m, e)) fail(403, 'This capability is outside your team scope.');
  if (c.type === 'startShadow' && c.scope === 'organisation' && !m.isOwner) fail(403, 'Only an owner puts a capability into shadow for the whole organisation.');
  // Slice 6q (second review): running or stopping a shadow needs an owner or a member of every shadow team;
  // overlapping one of the capability's teams is not enough. The replay block in server.ts calls this check too.
  if (c.shadowId && !m.isOwner && !findShadow(s, c.shadowId).teamIds.every(t => m.teamIds.includes(t))) fail(403, 'Only an owner or a member of every team in this shadow operation can run or stop it.');
}
// Slice 6q: a shadow never covers teams outside the capability revision's own reviewed teams.
export const reviewedTeams = (s: OrgState, e: GovernanceEntry, teamIds: string[]) => teamIds.filter(t => e.spec.teamIds.includes(t) && s.teams.some(x => x.id === t));
function audit(s: OrgState, u: Actor, m: Member, action: string, subject: string, detail: string, now: string) { s.workspace.audit.push({ id: uuid(), at: now, actorId: u.userId, actor: u.displayName, role: m.role, action, subject, detail }); }
const same = (a: string, b: string) => Number(a) === Number(b);
// Per-field comparison with the clinician-confirmed values. Fields with neither value are not counted.
export function compare(v: Visit, out: AgentOutput): NonNullable<ShadowResult['fields']> {
  const rows: NonNullable<ShadowResult['fields']> = [];
  for (const f of FIELDS) {
    const confirmed = v.facts[f] || null, shadow = out.assessment ? null : out.proposals.find(p => p.field === f)?.value ?? null;
    if (out.assessment) { if (confirmed) rows.push({ field: f, shadow: null, confirmed, outcome: 'unable' }); continue; }
    if (!confirmed && !shadow) continue;
    rows.push({ field: f, shadow, confirmed, outcome: confirmed && shadow ? (same(confirmed, shadow) ? 'agreement' : 'disagreement') : confirmed ? 'missing' : 'not-recorded' });
  }
  return rows;
}
// Slice R26 (BR-DATA-06): recompute a shadow comparison for a corrected visit. The shadow result keeps its stored
// output; the comparison is re-derived against the current facts of the visit chain (following the amendment chain
// to the newest visit). A voided visit, or a visit with no current confirmed replacement, leaves the comparison
// invalidated. Pure: it never rewrites the governance record, so a patient-scoped correction commit can use it.
export function recompareShadow(s: OrgState, r: ShadowResult): { outcome: 'recomputed' | 'invalidated'; visitId: string | null; fields: NonNullable<ShadowResult['fields']> | null } {
  const root = s.workspace.visits.find(v => v.id === r.visitId);
  if (!root) return { outcome: 'invalidated', visitId: null, fields: null };
  let cur: Visit = root;
  const seen = new Set([cur.id]);
  while (cur.supersededBy) { const next = s.workspace.visits.find(v => v.id === cur.supersededBy); if (!next || seen.has(next.id)) break; seen.add(next.id); cur = next; }
  if (cur.voidedAt || cur.state !== 'confirmed' || !r.output) return { outcome: 'invalidated', visitId: cur.id, fields: null };
  return { outcome: 'recomputed', visitId: cur.id, fields: compare(cur, r.output) };
}
function notRunReason(s: OrgState, e: GovernanceEntry, p: Person, v: Visit, now: string): NotRunReason | null {
  const spec = e.spec as Extract<GovernanceEntry['spec'], { kind: 'capability' }>;
  if (!p.aiConsent) return 'consent';
  if ((p.restrictions ?? []).some(r => !r.liftedAt)) return 'restricted';
  if (p.age < spec.ageMin || p.age > spec.ageMax) return 'outside-scope';
  if (!v.facts.notes?.trim()) return 'no-source';
  try { checkMonthlyBudget(s, e, undefined, now); } catch { return 'budget'; }
  if (spec.providerId !== 'local') return 'external-provider';
  return null;
}
// Local rules provider only: the same input-quality checks and output validation as a visit request.
export function runLocal(input: string): AgentOutput {
  const assessment = localAssess(input); if (assessment) return { proposals: [], highlights: [], assessment };
  try { return validateOutput(localExtract(input), input, 'extract').output; }
  catch { return { proposals: [], highlights: [], assessment: { status: 'unable_to_assess', reason: 'unsupported_case', detail: 'The shadow output did not pass the evidence contract.', retry: 'No value is compared for this visit.' } }; }
}
export function eligibleVisits(s: OrgState, sh: Shadow) {
  // Slice 6q: shadows stored before the fix may name teams outside the capability's reviewed teams; those are ignored.
  const e = governanceState(s).entries.find(x => x.id === sh.entryId), done = new Set(sh.results.map(r => r.visitId)), teams = new Set(e ? reviewedTeams(s, e, sh.teamIds) : []), people = new Map(s.workspace.people.map(p => [p.id, p]));
  return s.workspace.visits.filter(v => v.state === 'confirmed' && !v.voidedAt && !v.supersededBy && !v.imported && !!v.confirmedAt && v.confirmedAt >= sh.startedAt && v.confirmedAt <= endOf(sh) && !done.has(v.id) && teams.has(people.get(v.personId)?.teamId ?? ''));
}
export function applyShadow(s: OrgState, input: unknown, u: Actor, m: Member, now = new Date().toISOString()) {
  const parsed = shadowSchema.safeParse(input); if (!parsed.success) return null; const c = parsed.data; authorizeShadow(s, m, c);
  s.governance ??= governanceState(s); const list = (s.governance.shadows ??= []);
  if (c.type === 'startShadow') {
    const e = entryFor(s, c.entryId); if (e.version !== c.version) fail(409, 'The capability package changed. Refresh.');
    if (e.spec.kind !== 'capability') fail(422, 'Only an AI capability runs in shadow.');
    if (e.state !== 'reviewed') fail(409, e.state === 'active' ? 'This revision is already active; shadow operation is for a reviewed revision before activation.' : 'Only an independently reviewed revision can run in shadow. Suspended, retired and draft revisions do not run.');
    const issues = entryIssues(s, e, now); if (issues.length) fail(409, issues.join('; '));
    const today = now.slice(0, 10), last = new Date(Date.parse(today + 'T00:00:00Z') + SHADOW_MAX_DAYS * 86400000).toISOString().slice(0, 10);
    if (!Number.isFinite(Date.parse(c.until + 'T00:00:00Z')) || c.until < today || c.until > last) fail(422, `Choose an end date from today to ${last} (at most ${SHADOW_MAX_DAYS} days).`);
    // Slice 6q: organisation scope is the overlap of the organisation's teams with the capability's reviewed teams.
    const teamIds = c.scope === 'organisation' ? reviewedTeams(s, e, s.teams.map(t => t.id)) : [...new Set(c.teamIds)];
    if (!teamIds.length) fail(422, c.scope === 'organisation' ? 'None of the capability\'s reviewed teams is a team of this organisation.' : 'Choose at least one team.');
    if (c.scope === 'teams' && !teamIds.every(t => s.teams.some(x => x.id === t) && (m.isOwner || m.teamIds.includes(t)))) fail(403, 'Choose teams within your management scope.');
    if (c.scope === 'teams' && !teamIds.every(t => e.spec.teamIds.includes(t))) fail(422, 'Choose teams the capability revision was reviewed for.');
    if (list.some(x => x.entryId === e.id && shadowState(s, x, now) === 'active')) fail(409, 'This revision is already in shadow.');
    if (list.length >= MAX_SHADOWS) fail(422, 'Shadow operation limit reached.');
    const sh: Shadow = { id: uuid(), entryId: e.id, revision: e.revision, manifestHash: e.manifestHash, key: e.spec.key, scope: c.scope, teamIds, startedAt: now, until: c.until, startedBy: u.userId, reason: c.reason, state: 'active', version: 1, results: [] };
    list.push(sh); audit(s, u, m, c.type, e.id, `Capability revision ${e.revision} (${e.spec.title}) put into shadow for ${c.scope === 'organisation' ? 'the whole organisation' : teamIds.length + ' team(s)'} until ${c.until}. Outputs are stored for governance comparison only: never shown to field workers, applied or added to action plans. Reason: ${c.reason}`, now);
    return { shadowId: sh.id };
  }
  const sh = findShadow(s, c.shadowId); if (sh.version !== c.version) fail(409, 'The shadow operation changed. Refresh.');
  if (c.type === 'stopShadow') {
    if (sh.state === 'stopped') fail(409, 'This shadow operation is already stopped.');
    sh.state = 'stopped'; sh.stoppedAt = now; sh.stoppedBy = u.userId; sh.stopReason = c.reason; sh.version++;
    audit(s, u, m, c.type, sh.entryId, `Shadow operation stopped after ${sh.results.length} visit(s). Reason: ${c.reason}`, now); return { shadowId: sh.id };
  }
  const state = shadowState(s, sh, now), e = entryFor(s, sh.entryId);
  if (state === 'stopped') fail(409, 'This shadow operation is stopped.'); if (state === 'ended') fail(409, 'The shadow period has ended.');
  if (state === 'halted') fail(409, `This revision is ${e.state}; suspended, retired and changed revisions do not run in shadow.`);
  const issues = entryIssues(s, e, now); if (issues.length) fail(409, 'The revision is no longer usable: ' + issues.join('; '));
  if (sh.results.length >= MAX_RESULTS) fail(422, 'Shadow result limit reached; stop this shadow and start another.');
  // Slice 6q: only visits of patients in the runner's normal care scope are processed; the others are skipped,
  // counted and left pending for a runner whose scope includes them. Owner authority does not widen this.
  const all = eligibleVisits(s, sh), people = new Map(s.workspace.people.map(p => [p.id, p])), pending = all.filter(v => { const p = people.get(v.personId); return !!p && normallyAllowed(m, p); }), outsideCareScope = all.length - pending.length;
  const batch = pending.slice(0, Math.min(SHADOW_BATCH, MAX_RESULTS - sh.results.length)), counts = { compared: 0, unable: 0, notRun: 0 };
  for (const v of batch) {
    const p = s.workspace.people.find(x => x.id === v.personId)!, reason = notRunReason(s, e, p, v, now);
    if (reason) { sh.results.push({ visitId: v.id, personId: p.id, visitVersion: v.version, at: now, status: 'not-run', reason }); counts.notRun++; continue; }
    const output = runLocal(v.facts.notes);
    sh.results.push({ visitId: v.id, personId: p.id, visitVersion: v.version, at: now, status: output.assessment ? 'unable' : 'compared', output, fields: compare(v, output) });
    if (output.assessment) counts.unable++; else counts.compared++;
  }
  sh.version++;
  audit(s, u, m, c.type, sh.entryId, `Shadow run of revision ${sh.revision}: ${batch.length} confirmed visit(s) processed (${counts.compared} compared, ${counts.unable} unable to assess, ${counts.notRun} not run); ${pending.length - batch.length} remaining. Nothing was shown to field workers or applied.${outsideCareScope ? ` ${outsideCareScope} visit(s) outside the runner's care scope were skipped and left for a runner whose scope includes them.` : ''}`, now);
  return { shadowId: sh.id, processed: batch.length, ...counts, remaining: pending.length - batch.length, ...(outsideCareScope ? { outsideCareScope } : {}) };
}
// Slice 13c: the comparison as it stands now. A compared result whose visit was later amended is re-derived on read against the
// current confirmed visit of its amendment chain (recompareShadow); one whose chain ends in a voided visit, or in a correction
// not yet confirmed, is left out (null). A result whose visit is not in this state (a scoped read) keeps its stored fields.
// Nothing stored is rewritten.
export function currentFields(s: OrgState, r: ShadowResult): ShadowResult['fields'] | null {
  if (r.status !== 'compared') return r.fields ?? null;
  const v = s.workspace.visits.find(x => x.id === r.visitId);
  if (!v || (!v.supersededBy && !v.voidedAt)) return r.fields ?? null;
  const rc = recompareShadow(s, r);
  return rc.outcome === 'recomputed' ? rc.fields : null;
}
// Governance managers' report: counts only, no visit, person or value.
export function shadowReport(s: OrgState, sh: Shadow, now = new Date().toISOString()) {
  const current = sh.results.map(r => ({ r, fields: currentFields(s, r), corrected: r.status === 'compared' && !!s.workspace.visits.find(x => x.id === r.visitId && (x.supersededBy || x.voidedAt)) }));
  const fields = FIELDS.map(f => { const row: Record<ShadowOutcome, number> = { agreement: 0, disagreement: 0, missing: 0, 'not-recorded': 0, unable: 0 }; for (const c of current) for (const x of c.fields ?? []) if (x.field === f) row[x.outcome]++; return { field: f, label: FIELD_LABEL[f], ...row }; }).filter(r => OUTCOMES.some(o => r[o] > 0));
  const notRun: Partial<Record<NotRunReason, number>> = {}; for (const r of sh.results) if (r.reason) notRun[r.reason] = (notRun[r.reason] ?? 0) + 1;
  const state = shadowState(s, sh, now);
  return { id: sh.id, entryId: sh.entryId, revision: sh.revision, key: sh.key, scope: sh.scope, teamIds: sh.teamIds, startedAt: sh.startedAt, until: sh.until, startedBy: s.members.find(x => x.userId === sh.startedBy)?.displayName ?? 'Former member', reason: sh.reason, state, version: sh.version, stopReason: sh.stopReason ?? null, visits: { total: sh.results.length, compared: sh.results.filter(r => r.status === 'compared').length, unable: sh.results.filter(r => r.status === 'unable').length, notRun, recomputed: current.filter(c => c.corrected && c.fields).length, excluded: current.filter(c => c.corrected && !c.fields).length }, pending: state === 'active' ? eligibleVisits(s, sh).length : 0, fields };
}
