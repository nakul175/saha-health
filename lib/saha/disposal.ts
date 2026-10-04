import { z } from 'zod';
import { digest, fail, uuid } from './core';
import { normallyAllowed } from './access';
import { TERMINAL } from './referral-rules';
import { DISPOSABLE_CLASSES, PLACEHOLDER_NOTE, yearsAgo, type DisposableClass, type DisposalBatch, type DisposalItem, type Retention } from './retention';
import type { Actor } from './store';
import type { Member, OrgState, Person } from './types';

// Slice 14f: disposal execution (BR-SEC-09, BR-SEC-10, BR-DATA-08) — the plan and its two-owner approval.
//
// An owner prepares a plan: a dry run over the whole organisation that lists, by identifier only, every record the current
// schedule makes eligible for disposal, with counts and a plan hash, and changes nothing but the plan record. A second,
// different owner applies exactly that plan (lib/saha/disposal-server.ts): the plan is computed again at the time it was
// prepared, over the records as they are now, and must be identical. Two record classes can be disposed in this slice:
//  - patient-record: the patient, its visits, plans, AI results, submissions and referrals, its media, and the content of its
//    revisions, when the patient's last activity is past the schedule;
//  - visit-media: one photo or voice note past its own schedule (the record it belongs to stays).
// Never disposed: anything while an organisation hold is in place; a patient under a current hold; a record outside the care
// scope of the owner who prepared the plan or of the owner who applies it (owner authority does not override patient scope);
// a class whose rule does not allow disposal (records a rule says must be kept); and a patient whose records are linked to
// unresolved or open work, or referenced by any other record, so that no record is left pointing at a disposed one. Audit
// events and command receipts are never disposed. Execution is refused outside the synthetic and training environments,
// because the periods are placeholders, not an approved records schedule.
export const DISPOSAL_ENVIRONMENTS = ['synthetic', 'training'] as const;
// A plan holds at most 200 records, so its commit stays a bounded number of statements.
export const MAX_PLAN_ITEMS = 200, PLAN_HOURS = 72, MAX_BATCHES = 100;
export const STALE_PLAN = 'The records eligible under this plan have changed since it was prepared (a hold, new activity, a care-scope change or a linked record). Nothing was disposed. Cancel this plan and prepare a new one.';
const id = z.string().trim().min(1).max(200), text = z.string().trim().min(10, 'Write at least 10 characters.').max(1000);
export const disposalSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('disposalPrepare') }).strict(),
  z.object({ type: z.literal('disposalApply'), batchId: id, planHash: z.string().regex(/^[0-9a-f]{64}$/, 'Give the plan hash shown when the plan was prepared.') }).strict(),
  z.object({ type: z.literal('disposalCancel'), batchId: id, reason: text }).strict(),
]);
const TYPES = new Set(['disposalPrepare', 'disposalApply', 'disposalCancel']);
export function authorizeDisposal(_s: OrgState, m: Member, c: any) { if (TYPES.has(c?.type) && !m.isOwner) fail(403, 'Only an organisation owner can prepare, apply or cancel a disposal.'); }
export function ensureDisposalEnvironment(environment: string) {
  if (!(DISPOSAL_ENVIRONMENTS as readonly string[]).includes(environment)) fail(409, `Disposal is available only in the synthetic and training environments: retention periods here are placeholders, not an approved records schedule. This is the ${environment} environment.`);
}

export type Plan = { policyVersion: number; preparedAt: string; cutoffs: Partial<Record<DisposableClass, string>>; items: DisposalItem[]; counts: Record<string, number>; excluded: DisposalBatch['excluded']; planHash: string };
const UNRESOLVED_SEND = new Set(['queued', 'sending', 'uncertain', 'retryable']);

// Every string value and object key in the organisation's records, with the owners that hold it: a patient (its record,
// visits, submissions, referrals) or an organisation-level record. Audit events and the retention document are not indexed:
// audit events stay as they are, and holds are checked directly.
function referenceIndex(s: OrgState) {
  const refs = new Map<string, Set<string>>(), w = s.workspace;
  const add = (owner: string, x: unknown, depth = 0): void => {
    if (depth > 60) return;
    const note = (v: string) => { if (v.length > 200) return; let set = refs.get(v); if (!set) refs.set(v, set = new Set()); set.add(owner); };
    if (typeof x === 'string') { note(x); return; }
    if (Array.isArray(x)) { for (const e of x) add(owner, e, depth + 1); return; }
    if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) { note(k); add(owner, v, depth + 1); }
  };
  for (const p of w.people) add(`patient:${p.id}`, p);
  for (const v of w.visits) add(`patient:${v.personId}`, v);
  for (const x of w.submissions) add(`patient:${x.personId}`, x);
  for (const r of w.referrals) add(`patient:${r.personId}`, r);
  const docs: [string, unknown][] = [['outreach', s.outreach], ['governance', s.governance], ['operations', s.operations], ['pilot', s.pilot], ['expansions', s.expansions], ['households', s.households], ['caseload transfers', s.caseloads], ['identity cases', s.identityCases], ['rights requests', s.rightsRequests]];
  for (const [name, doc] of docs) if (doc) add(`org:${name}`, doc);
  return refs;
}

// Why a patient whose last activity is past the schedule is nevertheless kept, or null when nothing keeps it.
function blocker(s: OrgState, p: Person, ids: string[], refs: Map<string, Set<string>>, cutoffOf: (c: string) => string | null, at: string): string | null {
  const w = s.workspace;
  if (p.mergedInto || p.mergedFrom?.length) return 'linked identity record';
  if ((p.exceptionalAccess ?? []).some(g => !g.closedAt && g.until > at)) return 'current emergency access';
  if ((p.restrictions ?? []).some(r => !r.liftedAt)) return 'processing restriction in place';
  if (p.ehr && (p.ehr.links.length || p.ehr.permissions.length || p.ehr.documents.length || p.ehr.operations.length)) return 'EHR exchange history';
  if (p.abha || p.careContexts?.length || p.abdmTransfers?.length || p.abdmReceived?.length || p.abdmConsents?.length) return 'ABDM link or exchange history';
  if ((p.followUps ?? []).some(f => f.state === 'open')) return 'open follow-up';
  const subs = w.submissions.filter(x => x.personId === p.id);
  if (subs.some(x => UNRESOLVED_SEND.has(x.state))) return 'unresolved programme send';
  const receipts = cutoffOf('programme-receipt');
  if (subs.length && (!receipts || subs.some(x => !(x.updatedAt < receipts)))) return 'programme receipts kept by their own schedule';
  const leases = p.fieldLeases ?? [];
  if (leases.some(l => l.status === 'active' && l.expiresAt > at)) return 'field package on a device';
  const packages = cutoffOf('field-package');
  if (leases.length && (!packages || leases.some(l => !(l.createdAt < packages)))) return 'field packages kept by their own schedule';
  if (w.referrals.some(r => r.personId === p.id && !TERMINAL.has(r.state))) return 'open referral';
  for (const x of ids) for (const owner of refs.get(x) ?? []) if (owner !== `patient:${p.id}`) return owner.startsWith('patient:') ? 'referenced by another patient record' : `referenced by ${owner.slice(4)}`;
  return null;
}

// The plan, as of `at` (the preparation time), over the current state, in the care scope of `m`. Deterministic: patients,
// visits and media in identifier order; a patient is never split across plans; at most MAX_PLAN_ITEMS items.
export async function disposalPlan(s: OrgState, m: Member, at: string): Promise<Plan> {
  const r: Retention = s.retention ?? { policies: [], holds: [] }, policy = r.policies.at(-1);
  if (!policy) fail(422, 'Set a retention schedule before preparing a disposal.');
  const rules = policy!.rules.filter(x => x.dispose && (DISPOSABLE_CLASSES as readonly string[]).includes(x.recordClass));
  if (!rules.length) fail(422, 'No record class in the current schedule allows disposal. Records are reviewed only.');
  const cutoffOf = (c: string) => { const rule = policy!.rules.find(x => x.recordClass === c); return rule ? yearsAgo(at, rule.years) : null; };
  const cutoffs: Plan['cutoffs'] = Object.fromEntries(rules.map(x => [x.recordClass, cutoffOf(x.recordClass)!]));
  const holds = r.holds.filter(h => !h.released), organisationHold = holds.some(h => h.scope === 'organisation'), held = new Set(holds.filter(h => h.personId).map(h => h.personId!));
  // Patient-record exclusions count patients; `media` counts visit media items.
  const excluded: Plan['excluded'] = { organisationHold, held: 0, outsideAuthority: 0, deferred: 0, blocked: {}, media: { held: 0, outsideAuthority: 0, deferred: 0 } };
  const items: DisposalItem[] = [], w = s.workspace, people = [...w.people].sort((a, b) => a.id < b.id ? -1 : 1), disposedPeople = new Set<string>();
  const byPerson = new Map<string, typeof w.visits>(); for (const v of w.visits) byPerson.set(v.personId, [...(byPerson.get(v.personId) ?? []), v]);
  if (!organisationHold && cutoffs['patient-record']) {
    const cutoff = cutoffs['patient-record'], refs = referenceIndex(s);
    for (const p of people) {
      const visits = [...(byPerson.get(p.id) ?? [])].sort((a, b) => a.id < b.id ? -1 : 1);
      const last = [p.createdAt, ...visits.flatMap(v => [v.createdAt, v.confirmedAt])].filter((x): x is string => !!x).sort().at(-1)!;
      if (!(last < cutoff)) continue;
      if (held.has(p.id)) { excluded.held++; continue; }
      if (!normallyAllowed(m, p)) { excluded.outsideAuthority++; continue; }
      const own: DisposalItem[] = [], item = (table: string, id: string) => own.push({ recordClass: 'patient-record', table, id, personId: p.id, teamId: p.teamId });
      item('patients', p.id);
      for (const v of visits) { item('visits', v.id); if (v.plan) item('plans', v.plan.id); for (const a of [...(v.aiResults ?? [])].sort((x, y) => x.id < y.id ? -1 : 1)) item('ai_results', a.id); }
      for (const x of w.submissions.filter(x => x.personId === p.id).sort((a, b) => a.id < b.id ? -1 : 1)) item('submissions', x.id);
      for (const x of w.referrals.filter(x => x.personId === p.id).sort((a, b) => a.id < b.id ? -1 : 1)) item('referrals', x.id);
      for (const v of visits) for (const ref of [...(v.media ?? [])].sort((a, b) => a.id < b.id ? -1 : 1)) item('media', ref.id);
      item('record_revisions', p.id);
      const why = blocker(s, p, own.map(i => i.id), refs, cutoffOf, at);
      if (why) { excluded.blocked[why] = (excluded.blocked[why] ?? 0) + 1; continue; }
      if (items.length + own.length > MAX_PLAN_ITEMS) { excluded.deferred++; continue; }
      items.push(...own); disposedPeople.add(p.id);
    }
  }
  if (!organisationHold && cutoffs['visit-media']) {
    const cutoff = cutoffs['visit-media'], people = new Map(w.people.map(p => [p.id, p]));
    for (const v of [...w.visits].sort((a, b) => a.id < b.id ? -1 : 1)) {
      const p = people.get(v.personId);
      if (!p || disposedPeople.has(p.id)) continue;
      for (const ref of [...(v.media ?? [])].sort((a, b) => a.id < b.id ? -1 : 1)) {
        if (ref.removedAt || !(ref.at < cutoff)) continue;
        if (held.has(p.id)) { excluded.media.held++; continue; }
        if (!normallyAllowed(m, p)) { excluded.media.outsideAuthority++; continue; }
        if (items.length + 1 > MAX_PLAN_ITEMS) { excluded.media.deferred++; continue; }
        items.push({ recordClass: 'visit-media', table: 'media', id: ref.id, personId: p.id, teamId: p.teamId });
      }
    }
  }
  const counts: Record<string, number> = { patients: disposedPeople.size };
  for (const i of items) if (i.table !== 'patients' && i.table !== 'record_revisions') { const k = i.recordClass === 'visit-media' ? 'visitMedia' : i.table; counts[k] = (counts[k] ?? 0) + 1; }
  const planHash = await digest(['saha-disposal-plan-v1', s.organisation.id, policy!.version, at, items.map(i => [i.recordClass, i.table, i.id, i.personId, i.teamId])]);
  return { policyVersion: policy!.version, preparedAt: at, cutoffs, items, counts, excluded, planHash };
}

// The batch an apply or cancel names, with an expired plan reported as expired.
export function waitingBatch(s: OrgState, batchId: string, now: string) {
  const b = (s.retention?.disposals ?? []).find(x => x.id === batchId);
  if (!b) fail(404, 'Disposal plan not found.');
  if (b!.state !== 'prepared') fail(409, `This disposal plan is already ${b!.state}.`);
  if (b!.expiresAt <= now) fail(409, 'This disposal plan has expired. Prepare a new one.');
  return b!;
}

// Prepare and cancel change only the plan record and add an audit event; apply is executed by disposal-server.ts.
export async function applyDisposal(s: OrgState, input: unknown, u: Actor, m: Member, environment: string, now = new Date().toISOString()): Promise<any | null> {
  const parsed = disposalSchema.safeParse(input); if (!parsed.success) return null;
  const c = parsed.data; if (c.type === 'disposalApply') return null;
  authorizeDisposal(s, m, c);
  const r = s.retention ??= { policies: [], holds: [] }, batches = r.disposals ??= [];
  let detail = '', subject = s.organisation.id, result: any;
  if (c.type === 'disposalPrepare') {
    ensureDisposalEnvironment(environment);
    for (const b of batches) if (b.state === 'prepared' && b.expiresAt <= now) { b.state = 'expired'; delete b.items; }
    if (batches.some(b => b.state === 'prepared')) fail(409, 'A disposal plan is already waiting for a second owner. Apply or cancel it first.');
    if (batches.length >= MAX_BATCHES) fail(422, 'Disposal plan history limit reached; an archival policy is required.');
    const plan = await disposalPlan(s, m, now);
    if (!plan.items.length) fail(422, `Nothing can be disposed under schedule version ${plan.policyVersion} now${plan.excluded.organisationHold ? ': an organisation hold is in place' : ''}. ${kept(plan.excluded)}.`);
    const b: DisposalBatch = { id: uuid(), state: 'prepared', planHash: plan.planHash, policyVersion: plan.policyVersion, preparedBy: u.userId, preparedAt: now, expiresAt: new Date(Date.parse(now) + PLAN_HOURS * 3600000).toISOString(), counts: plan.counts, excluded: plan.excluded, items: plan.items };
    batches.push(b); subject = b.id;
    detail = `Disposal plan prepared under retention schedule version ${plan.policyVersion}: ${describe(plan.counts)}. Plan hash ${plan.planHash}. ${kept(plan.excluded)}. Nothing is disposed until a second owner applies it. ${PLACEHOLDER_NOTE}`;
    result = { batchId: b.id, planHash: plan.planHash, expiresAt: b.expiresAt, counts: plan.counts, excluded: plan.excluded, items: plan.items.map(({ recordClass, table, id, personId }) => ({ recordClass, table, id, personId })) };
  } else {
    const b = waitingBatch(s, c.batchId, now);
    b.state = 'cancelled'; b.cancelled = { by: u.userId, at: now, reason: c.reason }; delete b.items; subject = b.id;
    detail = `Disposal plan cancelled (plan hash ${b.planHash}); nothing was disposed. ${c.reason}`; result = { batchId: b.id, state: 'cancelled' };
  }
  s.workspace.audit.push({ id: uuid(), at: now, actorId: u.userId, actor: u.displayName, role: m.role, action: c.type, subject, detail });
  return result;
}
export const describe = (counts: Record<string, number>) => ([['patients', 'patient record', 'patient records'], ['visits', 'visit', 'visits'], ['plans', 'plan', 'plans'], ['ai_results', 'AI result', 'AI results'], ['submissions', 'programme submission', 'programme submissions'], ['referrals', 'referral', 'referrals'], ['media', 'media item of those patients', 'media items of those patients'], ['visitMedia', 'visit media item past its own schedule', 'visit media items past their own schedule'], ['revisions', 'revision', 'revisions']] as const).filter(([k]) => counts[k]).map(([k, one, many]) => `${counts[k]} ${counts[k] === 1 ? one : many}`).join(', ') || 'no records';
// The records a plan keeps, in words (patients, then visit media items).
export const kept = (x: DisposalBatch['excluded']) => `Patient records kept: ${x.held} held, ${x.outsideAuthority} outside the preparing owner's care scope, ${Object.entries(x.blocked).map(([k, n]) => `${n} ${k}`).join(', ') || 'none for linked or open work'}${x.deferred ? `, ${x.deferred} deferred to a later plan` : ''}; visit media kept: ${x.media.held} held, ${x.media.outsideAuthority} outside that scope${x.media.deferred ? `, ${x.media.deferred} deferred` : ''}`;
