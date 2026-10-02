import { fail } from './core';
import { allowed } from './access';
import { supervises } from './delegation';
import { sha256 } from './audit-chain';
import { HASHING, KINDS, MAX_DAYS, NOTICE, UNIT, currentSchedule, eligibleActivity, incentiveState, indexOf, reversedKeys, staleReason, verifyClaimChain, type Claim } from './incentives';
import type { Member, OrgState } from './types';

// Slice 10c: what a viewer sees of the incentive claims, and the CSV of approved claims. Patient names appear only for patients
// inside the viewer's own care scope (an owner's authority does not widen it); the export carries no name, village or patient
// identifier at all, only a one-way subject reference per line.
const day = (s?: string) => (s ?? '').slice(0, 10);
const cell = (v: unknown) => { if (typeof v === 'number') return String(v); let t = String(v ?? ''); if (/^[\s]*[=+@-]/.test(t)) t = "'" + t; return '"' + t.replaceAll('"', '""') + '"'; };
const csvRows = (rows: unknown[][]) => rows.map(r => r.map(cell).join(',') + '\r\n').join('');
// The claims a viewer may see: an owner all of them, a supervisor those of the teams they supervise, an ASHA her own.
export function supervisedTeams(s: OrgState, m: Member, now: string) { return m.status === 'active' && m.role !== 'admin' && m.role !== 'provider' ? s.teams.map(t => t.id).filter(t => supervises(s, m, t, now, false)) : []; }
function visible(s: OrgState, m: Member, now: string) {
  if (m.status !== 'active' || m.role === 'provider') fail(403, 'Your role does not see incentive claims.');
  const teams = supervisedTeams(s, m, now), claims = incentiveState(s).claims.filter(c => m.isOwner || teams.includes(c.teamId) || c.claimantId === m.userId || c.preparedBy === m.userId);
  if (!m.isOwner && !teams.length && m.role !== 'asha') fail(403, 'An ASHA worker, a team supervisor or an owner sees incentive claims.');
  return { teams, claims };
}
export async function incentiveView(s: OrgState, m: Member, now: string, q: { from?: string | null; to?: string | null; team?: string | null } = {}) {
  const { teams, claims } = visible(s, m, now), st = incentiveState(s), sched = currentSchedule(st), ix = indexOf(s), people = new Map(s.workspace.people.map(p => [p.id, p]));
  const teamName = (t: string) => s.teams.find(x => x.id === t)?.name ?? t, name = (id: string) => s.members.find(x => x.userId === id)?.displayName ?? 'Former member';
  const reversed = reversedKeys(st), numberOf = new Map(st.claims.map(c => [c.id, c.number]));
  const corrections = new Map<string, number[]>(); for (const c of st.claims) if (c.type === 'correction' && c.corrects && ['submitted', 'verified', 'approved'].includes(c.state)) corrections.set(c.corrects, [...(corrections.get(c.corrects) ?? []), c.number]);
  const view = (c: Claim) => {
    const pending = ['submitted', 'verified', 'approved'].includes(c.state), lines = c.lines.map(l => {
      const p = people.get(l.personId), inScope = !!p && allowed(m, p, now), why = pending ? staleReason(ix, c, l) : null;
      return { id: l.id, kind: l.kind, kindLabel: l.kind === 'reversal' ? 'Reversal of an earlier line' : KINDS[l.kind], ref: l.ref, evidenceVisitId: l.evidenceVisitId, at: l.at, amount: l.amount, ...(l.receipt ? { receipt: l.receipt } : {}), ...(l.reverses ? { reverses: { claimNumber: numberOf.get(l.reverses.claimId) ?? null, lineId: l.reverses.lineId, reason: l.reverses.reason } } : {}), patient: inScope ? p!.name : null, ...(inScope ? { personId: l.personId } : {}), ...(why ? { stale: why } : {}), ...(l.kind !== 'reversal' && reversed.has(c.id + '/' + l.id) ? { reversed: true } : {}) };
    });
    const mine = m.role === 'asha' && c.claimantId === m.userId, sup = m.role !== 'admin' && supervises(s, m, c.teamId, now, false);
    return {
      id: c.id, number: c.number, type: c.type, corrects: c.corrects ?? null, correctsNumber: c.corrects ? numberOf.get(c.corrects) ?? null : null, correctedBy: corrections.get(c.id) ?? [], teamId: c.teamId, team: teamName(c.teamId), claimant: c.claimantName, preparedBy: c.preparedByName, period: c.period, scheduleVersion: c.scheduleVersion, total: c.total, state: c.state, version: c.version, createdAt: c.createdAt,
      history: c.history.map(h => ({ at: h.at, by: h.byName, action: h.action, note: h.note })), ...(c.verified ? { verified: { by: c.verified.byName, at: c.verified.at, note: c.verified.note } } : {}),
      ...(c.chain ? { chain: { seq: c.chain.seq, prev: c.chain.prev, content: c.chain.content, digest: c.chain.digest, at: c.chain.at, by: c.chain.byName } } : {}),
      lines, staleCount: lines.filter(l => l.stale).length,
      actions: {
        withdraw: (c.state === 'submitted' || c.state === 'verified') && c.preparedBy === m.userId,
        verify: c.state === 'submitted' && sup && m.userId !== c.claimantId && m.userId !== c.preparedBy,
        decide: c.state === 'verified' && m.isOwner && m.userId !== c.claimantId && m.userId !== c.preparedBy && m.userId !== c.verified?.by,
        correct: c.state === 'approved' && (mine || sup) && c.lines.some(l => l.kind !== 'reversal' && !reversed.has(c.id + '/' + l.id)),
      },
    };
  };
  let eligible: unknown = null;
  if (m.role === 'asha' && q.from && q.to) {
    const team = q.team ?? m.teamIds[0];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(q.from) || !/^\d{4}-\d{2}-\d{2}$/.test(q.to) || q.from > q.to || q.to > now.slice(0, 10) || (Date.parse(q.to) - Date.parse(q.from)) / 86400000 + 1 > MAX_DAYS) fail(422, `Choose a period of at most ${MAX_DAYS} days that has started and ends today or earlier.`);
    if (!team || !m.teamIds.includes(team)) fail(403, 'Choose a team you belong to.');
    if (!sched) eligible = { teamId: team, from: q.from, to: q.to, lines: [], total: 0, skipped: { alreadyClaimed: 0, notInSchedule: 0 }, note: 'The owner has not set a synthetic incentive schedule yet.' };
    else { const f = eligibleActivity(s, m, team, q.from, q.to, sched, now); eligible = { teamId: team, from: q.from, to: q.to, lines: f.rows.map(r => ({ kind: r.kind, kindLabel: KINDS[r.kind as keyof typeof KINDS], ref: r.ref, evidenceVisitId: r.evidenceVisitId, at: r.at, amount: r.amount, patient: people.get(r.personId)?.name ?? null, ...(r.receipt ? { receipt: r.receipt } : {}) })), total: f.rows.reduce((n, r) => n + r.amount, 0), skipped: f.skipped }; }
  }
  const order = [...claims].sort((a, b) => b.number - a.number);
  return {
    notice: NOTICE, unit: UNIT, hashing: HASHING, kinds: Object.entries(KINDS).map(([id, label]) => ({ id, label })),
    schedule: { current: sched ?? null, ...(m.isOwner ? { history: [...st.schedules].reverse() } : {}), canSet: m.isOwner },
    canPrepare: m.role === 'asha' && !!sched, teams: m.role === 'asha' ? m.teamIds.map(t => ({ id: t, name: teamName(t) })) : [], supervises: teams.map(t => ({ id: t, name: teamName(t) })),
    chain: await verifyClaimChain(s), claims: order.map(view), eligible,
    scope: 'ASHA workers see their own claims, supervisors the claims of the teams they supervise, owners all claims. Patient names appear only for patients in your own care scope.',
    canExport: m.isOwner || teams.length > 0,
  };
}
// Approved claims the viewer may see, as CSV: owners every one, supervisors those of their teams. One row per line.
export async function incentiveCsv(s: OrgState, m: Member, now: string, exportId: string, by: string) {
  if (m.status !== 'active' || m.role === 'provider' || (!m.isOwner && !supervisedTeams(s, m, now).length)) fail(403, 'An owner or a team supervisor exports approved claims.');
  const { claims } = visible(s, m, now), approved = claims.filter(c => c.state === 'approved' && c.chain).sort((a, b) => a.chain!.seq - b.chain!.seq);
  if (!approved.length) fail(404, 'No approved claim is available to export.');
  const teamName = (t: string) => s.teams.find(x => x.id === t)?.name ?? t, head = ['claim_number', 'claim_id', 'claim_type', 'corrects_claim_id', 'team_id', 'team_name', 'claimant_code', 'prepared_by_code', 'period_from', 'period_to', 'schedule_version', 'prepared_at', 'line_id', 'line_kind', 'source_ref', 'evidence_visit_id', 'subject_reference', 'activity_at', 'receipt', 'amount_syn', 'reverses_claim_id', 'reverses_line_id', 'reversal_reason', 'claim_total_syn', 'verified_by_code', 'verified_at', 'verification_note', 'approved_by_code', 'approved_at', 'chain_seq', 'previous_digest', 'content_digest', 'claim_digest'];
  const data: unknown[][] = [];
  for (const c of approved) for (const l of c.lines) data.push([c.number, c.id, c.type, c.corrects ?? '', c.teamId, teamName(c.teamId), c.claimantCode, c.preparedByCode, c.period.from, c.period.to, c.scheduleVersion, c.createdAt, l.id, l.kind, l.ref, l.evidenceVisitId, l.subject, l.at, l.receipt ?? '', l.amount, l.reverses?.claimId ?? '', l.reverses?.lineId ?? '', l.reverses?.reason ?? '', c.total, c.verified?.byCode ?? '', c.verified?.at ?? '', c.verified?.note ?? '', c.chain!.byCode, c.chain!.at, c.chain!.seq, c.chain!.prev, c.chain!.content, c.chain!.digest]);
  const chain = await verifyClaimChain(s);
  const body = csvRows([['Saha synthetic incentive claims (approved)'], ['Notice', NOTICE], ['Export identifier', exportId], ['Generated by', by, m.role], ['Generated at', now], ['Chain status', chain.status, 'approved claims', chain.approved], ['Hashing', HASHING], ['Scope', m.isOwner ? 'All approved claims' : 'Approved claims of the teams you supervise; a gap in chain_seq is a claim of another team, whose digest still links the next claim to the previous one.'], head, ...data]);
  const hash = await sha256(body);
  return { csv: body + csvRows([['Manifest', 'Data rows', data.length], ['Manifest', 'Content SHA-256', hash]]), sha256: hash, rows: data.length, claims: approved.length, day: day(now) };
}
