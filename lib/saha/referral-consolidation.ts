import { z } from 'zod';
import { allowedFor } from './access';
import { fail, person, uuid, visit } from './core';
import { declaredNeed, followUpOpen } from './programmes';
import { TERMINAL } from './referral-rules';
import { MAX_PACK_REQUESTS, MAX_REQUESTS_PER_COMMAND, NEED_IDS, NEED_LABEL, needKey, normText, type PackRequest, type ReferralEquivalence } from './referral-needs';
import type { Actor } from './store';
import type { Member, OrgState, PlanDependency, Referral } from './types';

// SAHA-103 / BR-CARE-05: one approved action is shared only across genuinely equivalent programme requests.
// Person, purpose, destination and time window are a persisted boundary; every programme keeps its own reason,
// episode state, immutable pack declaration and derived blockers. Legacy referrals can enter this boundary only by
// an explicit version-bound adoption, never by a fuzzy automatic match. This command prepares local work only and
// never contacts a facility or completes a programme episode.
const id = z.string().trim().min(1).max(200);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use an ISO date.').refine(value => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}, 'Use a real calendar date.');
const request = z.object({
  enrolmentId: id,
  declarationId: id.optional(),
  need: z.enum(NEED_IDS),
  needLabel: z.string().trim().min(3).max(100).optional(),
  facility: z.string().trim().min(3).max(200),
  reason: z.string().trim().min(5, 'Give the reason in at least 5 characters.').max(1000),
  windowStart: day.optional(),
  windowEnd: day.optional(),
}).strict()
  .refine(r => (r.need === 'other') === !!r.needLabel, { message: 'Name the need when it is "other", and only then.' })
  .refine(r => (!!r.windowStart === !!r.windowEnd) && (!r.windowStart || r.windowStart <= r.windowEnd!), { message: 'Give a complete referral time window with the start on or before the end.' });
export const programmeReferralSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('createProgrammeReferrals'), visitId: id,
    // Current UI sends both versions. Optionality only preserves replay of retained pre-SAHA-103 command receipts.
    personVersion: z.number().int().positive().optional(), visitVersion: z.number().int().positive().optional(),
    adoptLegacy: z.object({ referralId: id, version: z.number().int().positive() }).strict().optional(),
    requests: z.array(request).min(1).max(MAX_REQUESTS_PER_COMMAND),
  }).strict(),
]);

export function authorizeProgrammeReferrals(s: OrgState, m: Member, c: any) {
  if (c?.type !== 'createProgrammeReferrals') return;
  if (!['asha', 'clinician'].includes(m.role)) fail(403, 'A care role is required to record programme referral needs.');
  const v = s.workspace.visits.find(x => x.id === c.visitId);
  if (!v) fail(404, 'Visit not found.');
  const p = s.workspace.people.find(x => x.id === v.personId);
  if (!p || !allowedFor(m, p, s.operations?.purposeGrants, 'care-coordination')) fail(403, 'Current patient scope and care-coordination purpose are required.');
}

const urgencyRank = (x: string) => ['routine', 'urgent', 'emergency'].indexOf(x);
const eqKey = (x: ReferralEquivalence) => [x.personId, x.purposeKey, x.destinationKey, x.windowStart, x.windowEnd].join('|');
const sameEq = (a?: ReferralEquivalence, b?: ReferralEquivalence) => !!a && !!b && eqKey(a) === eqKey(b);
const refKey = (r: { kind: string; id: string }) => `${r.kind}:${r.id}`;

export function applyProgrammeReferrals(s: OrgState, input: unknown, u: Actor, m: Member, now = new Date().toISOString()): any | null {
  const parsed = programmeReferralSchema.safeParse(input);
  if (!parsed.success) return null;
  const c = parsed.data, w = s.workspace;
  // Exact-window commands are the current SAHA-103 boundary. They must carry both source versions so a
  // browser prepared before reassignment, correction or a concurrent save cannot commit stale work.
  // The versionless shape is retained only for replaying historical pre-boundary receipts.
  if ((c.adoptLegacy || c.requests.some(x => x.windowStart)) && (c.personVersion === undefined || c.visitVersion === undefined)) {
    fail(422, 'Current action-plan requests must include patient and visit versions. Refresh and try again.');
  }
  authorizeProgrammeReferrals(s, m, c);
  const v = visit(w, c.visitId), p = person(w, v.personId);
  if (c.personVersion !== undefined && p.version !== c.personVersion) fail(409, 'Patient changed. Refresh the action plan before consolidating referrals.');
  if (c.visitVersion !== undefined && v.version !== c.visitVersion) fail(409, 'Visit changed. Refresh the confirmed visit before consolidating referrals.');
  if (v.voidedAt || v.supersededBy) fail(409, 'This visit was corrected or marked as wrong-patient. Open the current visit.');
  if (v.state !== 'confirmed') fail(409, 'Confirm the visit before recording a referral need.');
  if (p.mergedInto) fail(409, 'This record was merged into another record. Record new care on the surviving record.');
  if (p.identityReview?.state === 'provisional') fail(409, 'Patient identity is unresolved. Keep this as a draft and request clinician identity review.');
  const packs = v.programmeCapture?.packs ?? [];
  if (!packs.length) fail(422, 'This visit has no programme packs. Use a single referral instead.');

  type Ask = {
    req: z.infer<typeof request>; enrolmentId: string; cap: (typeof packs)[number];
    episode: NonNullable<typeof p.enrolments>[number]; declaration: NonNullable<ReturnType<typeof declaredNeed>> | null;
    blockers: { kind: 'follow-up'; id: string }[];
  };
  type Group = {
    key: string; code: (typeof NEED_IDS)[number]; label: string; facility: string; reasonFirst: string;
    declarationGroup: string; compatibilityKey?: string | null; urgency: 'routine' | 'urgent' | 'emergency';
    equivalence?: ReferralEquivalence; asks: Ask[];
  };

  // Preflight every request before mutating state. A bad later request cannot leave an earlier referral behind.
  const groups = new Map<string, Group>(), seen = new Set<string>();
  for (const req of c.requests) {
    const cap = packs.find(x => x.enrolmentId === req.enrolmentId);
    const episode = p.enrolments?.find(e => e.id === req.enrolmentId);
    if (!cap || !episode) fail(422, 'Each programme episode must be one that was part of this visit.');
    const declaration = declaredNeed(cap.pack, req.declarationId, v);
    if (cap.pack.referralNeeds && !declaration) fail(422, 'Choose an eligible referral need explicitly declared by this pinned programme pack.');
    if (!declaration && req.declarationId) fail(422, 'This legacy pack has no declared referral contract.');
    if (declaration && (declaration.need !== req.need || (declaration.need === 'other' && declaration.needLabel !== req.needLabel))) fail(422, 'The referral request must retain the declared need.');
    const declarationGroup = declaration ? (declaration.compatibilityKey ? `compatible:${declaration.compatibilityKey}` : `individual:${req.enrolmentId}:${declaration.id}`) : 'legacy';
    const label = req.need === 'other' ? req.needLabel!.replace(/\s+/g, ' ').trim() : NEED_LABEL[req.need];
    const facility = req.facility.replace(/\s+/g, ' ').trim();
    const windowStart = req.windowStart ?? (declaration ? (v.confirmedAt ?? v.createdAt).slice(0, 10) : undefined);
    const windowEnd = req.windowEnd ?? windowStart;
    const purposeKey = declaration ? (declaration.compatibilityKey ?? `${cap.pack.id}:${declaration.id}`) : `legacy:${req.need}:${req.need === 'other' ? normText(label) : ''}`;
    const equivalence = windowStart && windowEnd ? { personId: p.id, purposeKey, destinationKey: normText(facility), windowStart, windowEnd } : undefined;
    const key = `${needKey(req.need, label, facility)}|${declarationGroup}|${equivalence ? `equivalent:${eqKey(equivalence)}` : 'pre-boundary'}`;
    if (seen.has(`${key}#${req.enrolmentId}`)) fail(422, 'Name each programme episode once for each equivalent referral action.');
    seen.add(`${key}#${req.enrolmentId}`);
    const blockers: Ask['blockers'] = [];
    for (const ruleId of declaration?.dependsOnCompletionRules ?? []) {
      const found = (p.followUps ?? []).filter(f => f.enrolmentId === episode.id && f.completionContract?.rule.id === ruleId && followUpOpen(s, f));
      if (!found.length) fail(409, `The declared referral dependency ${ruleId} is unavailable or already resolved. Refresh the action plan.`);
      blockers.push(...found.map(f => ({ kind: 'follow-up' as const, id: f.id })));
    }
    const g = groups.get(key) ?? { key, code: req.need, label, facility, reasonFirst: req.reason, declarationGroup, ...(declaration ? { compatibilityKey: declaration.compatibilityKey } : {}), urgency: declaration?.urgency ?? 'routine', ...(equivalence ? { equivalence } : {}), asks: [] };
    if (declaration && urgencyRank(declaration.urgency) > urgencyRank(g.urgency)) g.urgency = declaration.urgency;
    g.asks.push({ req, enrolmentId: req.enrolmentId, cap, episode, declaration, blockers }); groups.set(key, g);
  }

  if (c.adoptLegacy && groups.size !== 1) fail(422, 'Adopt one legacy referral into one equivalent action at a time.');
  const legacy = c.adoptLegacy ? w.referrals.find(r => r.id === c.adoptLegacy!.referralId) : undefined;
  if (c.adoptLegacy) {
    if (!legacy || legacy.personId !== p.id || legacy.visitId !== v.id) fail(422, 'Choose a legacy referral from this person and confirmed visit.');
    if ((legacy.version ?? 1) !== c.adoptLegacy.version) fail(409, 'Legacy referral changed. Refresh before adopting it.');
    if (TERMINAL.has(legacy.state) || legacy.need || legacy.packRequests?.length) fail(409, 'Only an open referral without a recorded need can be adopted.');
    const only = [...groups.values()][0];
    if (normText(legacy.facility) !== normText(only.facility)) fail(422, 'The legacy referral destination differs from the approved action. Keep it separate.');
  }

  type Plan = { group: Group; referral?: Referral; created: boolean; adopted: boolean; newAsks: Ask[] };
  const plans: Plan[] = [];
  for (const g of groups.values()) {
    let referral: Referral | undefined;
    if (legacy) referral = legacy;
    else referral = w.referrals.find(r => r.personId === p.id && r.visitId === v.id && !TERMINAL.has(r.state) && r.need && needKey(r.need.code, r.need.label, r.facility) === needKey(g.code, g.label, g.facility) && r.need.declarationGroup === (g.declarationGroup === 'legacy' ? undefined : g.declarationGroup) && (g.equivalence ? sameEq(r.need.equivalence, g.equivalence) : !r.need.equivalence));
    const newAsks = g.asks.filter(a => !(referral?.packRequests ?? []).some(x => x.enrolmentId === a.enrolmentId));
    if ((referral?.packRequests?.length ?? 0) + newAsks.length > MAX_PACK_REQUESTS) fail(422, 'A referral can record at most 20 programme requests.');
    const newSources = newAsks.filter(a => !(referral?.sources ?? []).some(x => x.kind === 'programme-episode' && x.refId === a.episode.id)).length;
    if ((referral?.sources?.length ?? 0) + newSources > 20) fail(422, 'A referral can have at most 20 linked sources.');
    plans.push({ group: g, referral, created: !referral, adopted: !!legacy && referral === legacy, newAsks });
  }
  if (plans.every(x => !x.created && !x.adopted && !x.newAsks.length)) fail(409, 'Every request was already recorded on an open referral.');

  const activeDeps = (p.planDependencies ?? []).filter(x => !x.removed);
  const pendingEdges: { dependent: { kind: 'referral'; id: string }; blocker: { kind: 'follow-up'; id: string } }[] = [];
  for (const plan of plans) {
    const referralId = plan.referral?.id ?? `pending:${plan.group.key}`;
    for (const ask of plan.newAsks) for (const blocker of ask.blockers) if (![...activeDeps, ...pendingEdges].some(x => refKey(x.dependent) === `referral:${referralId}` && refKey(x.blocker) === refKey(blocker))) pendingEdges.push({ dependent: { kind: 'referral', id: referralId }, blocker });
  }
  if (activeDeps.length + pendingEdges.length > 50 || (p.planDependencies?.length ?? 0) + pendingEdges.length > 200) fail(422, 'Too many dependencies recorded for this patient; remove ones no longer needed.');
  const edges = new Map<string, string[]>();
  for (const x of activeDeps) edges.set(refKey(x.dependent), [...(edges.get(refKey(x.dependent)) ?? []), refKey(x.blocker)]);
  for (const x of pendingEdges) {
    const dependent = refKey(x.dependent), blocker = refKey(x.blocker), reached = new Set<string>(), stack = [blocker];
    while (stack.length) { const k = stack.pop()!; if (k === dependent) fail(422, 'The declared programme dependency would make plan items wait on each other.'); if (reached.has(k)) continue; reached.add(k); stack.push(...(edges.get(k) ?? [])); }
    edges.set(dependent, [...(edges.get(dependent) ?? []), blocker]);
  }

  const date = (v.confirmedAt ?? v.createdAt).slice(0, 10);
  const out: { referralId: string; outcome: 'created' | 'consolidated' | 'adopted' | 'unchanged'; need: string; facility: string; packs: string[]; programmes: { enrolmentId: string; state: 'active' | 'closed' }[] }[] = [];
  let personChanged = false;
  for (const plan of plans) {
    const g = plan.group; let r = plan.referral;
    if (!r) {
      r = { id: uuid(), personId: p.id, visitId: v.id, facility: g.facility, reason: g.reasonFirst, state: 'draft', version: 1, createdAt: now, ...(g.declarationGroup !== 'legacy' ? { urgency: g.urgency } : {}), need: { code: g.code, label: g.label, ...(g.declarationGroup !== 'legacy' ? { declarationGroup: g.declarationGroup, compatibilityKey: g.compatibilityKey } : {}), ...(g.equivalence ? { equivalence: g.equivalence } : {}) } };
      w.referrals.push(r); personChanged = true;
    } else if (plan.adopted) {
      r.need = { code: g.code, label: g.label, ...(g.declarationGroup !== 'legacy' ? { declarationGroup: g.declarationGroup, compatibilityKey: g.compatibilityKey } : {}), ...(g.equivalence ? { equivalence: g.equivalence } : {}) };
      if (g.declarationGroup !== 'legacy') r.urgency = g.urgency; personChanged = true;
    }
    const asked: string[] = [];
    if (urgencyRank(g.urgency) > urgencyRank(r.urgency ?? 'routine')) r.urgency = g.urgency;
    for (const ask of plan.newAsks) {
      let src = (r.sources ??= []).find(x => x.kind === 'programme-episode' && x.refId === ask.episode.id);
      if (!src) { src = { id: uuid(), kind: 'programme-episode', refId: ask.episode.id, sourceAt: ask.episode.createdAt, linkedAt: now, by: u.userId, note: `Asked for by ${ask.cap.pack.name} v${ask.cap.pack.version}: ${g.label}.` }; r.sources.push(src); }
      const dependencyIds: string[] = [];
      for (const blocker of ask.blockers) {
        let dep = (p.planDependencies ??= []).find(x => !x.removed && refKey(x.dependent) === `referral:${r!.id}` && refKey(x.blocker) === refKey(blocker));
        if (!dep) { dep = { id: uuid(), dependent: { kind: 'referral', id: r.id }, blocker, at: now, by: u.userId, reason: `Derived from ${ask.cap.pack.name} v${ask.cap.pack.version} declared referral need ${ask.declaration!.id}.` } satisfies PlanDependency; p.planDependencies.push(dep); }
        dependencyIds.push(dep.id);
      }
      (r.packRequests ??= []).push({ id: uuid(), enrolmentId: ask.episode.id, packId: ask.cap.pack.id, packVersion: ask.cap.pack.version, packName: ask.cap.pack.name, episodeLabel: ask.episode.episodeLabel, reason: ask.req.reason, sourceId: src.id, requestedBy: u.userId, requestedAt: now, episodeStateAtRequest: ask.episode.state, ...(dependencyIds.length ? { dependencyIds } : {}), ...(ask.declaration ? { declaration: { id: ask.req.declarationId!, compatibilityKey: g.compatibilityKey ?? null, urgency: ask.declaration.urgency, manifestHash: ask.cap.pack.installed!.manifestHash, purposeKey: g.equivalence!.purposeKey } } : {}) } satisfies PackRequest);
      asked.push(`${ask.cap.pack.name} v${ask.cap.pack.version}`); personChanged = true;
    }
    if (plan.adopted || (!plan.created && plan.newAsks.length)) r.version = (r.version ?? 1) + 1;
    const outcome = plan.created ? 'created' : plan.adopted ? 'adopted' : asked.length ? 'consolidated' : 'unchanged';
    out.push({ referralId: r.id, outcome, need: g.label, facility: r.facility, packs: (r.packRequests ?? []).map(x => `${x.packName} v${x.packVersion}`), programmes: (r.packRequests ?? []).map(x => ({ enrolmentId: x.enrolmentId, state: p.enrolments?.find(e => e.id === x.enrolmentId)?.state ?? x.episodeStateAtRequest ?? 'closed' })) });
    if (outcome !== 'unchanged') w.audit.push({ id: uuid(), at: now, actorId: u.userId, actor: u.displayName, role: m.role, action: c.type, subject: p.id, personId: p.id,
      detail: `${outcome === 'created' ? 'One referral to' : outcome === 'adopted' ? 'Legacy referral to' : 'Referral to'} ${r.facility} ${outcome === 'created' ? 'prepared' : outcome === 'adopted' ? 'adopted into the equivalence boundary' : 'extended'} for "${g.label}" from the confirmed visit of ${date}: asked for by ${asked.join(' and ')}. ${g.equivalence ? `Equivalent person, purpose, destination and ${g.equivalence.windowStart} to ${g.equivalence.windowEnd} window retained. ` : ''}${askDependencyCount(plan.newAsks)}Each programme episode remains independently ${plan.newAsks.map(x => x.episode.state).join(' and ') || 'recorded'}. No facility was contacted.` });
  }
  if (personChanged) p.version++;
  return { visitId: v.id, personVersion: p.version, referrals: out, created: out.filter(x => x.outcome === 'created').length, consolidated: out.filter(x => x.outcome === 'consolidated').length, adopted: out.filter(x => x.outcome === 'adopted').length, unchanged: out.filter(x => x.outcome === 'unchanged').length };
}

function askDependencyCount(asks: { blockers: unknown[] }[]) { const n = asks.reduce((sum, x) => sum + x.blockers.length, 0); return n ? `${n} declared blocker${n === 1 ? '' : 's'} retained. ` : ''; }
