import { z } from 'zod';
import { fail, uuid } from './core.js';
import { allowed } from './access.js';
import { supervises } from './delegation.js';
import { sha256 } from './audit-chain.js';
// Slice 10c: worker incentive claims (BR-CARE-08). SYNTHETIC and placeholder only.
//
// The owner keeps a versioned schedule of placeholder amounts per kind of confirmed activity. An ASHA prepares a claim for a
// period from her own eligible confirmed activities (each line names its source record and the visit that evidences it; the
// same source is never on two live claims). The team supervisor verifies the claim or returns it with a reason; the owner
// approves it or returns it. An approved claim is immutable: it is stored with a content digest chained to the previous
// approved claim (the slice 6j audit-chain style), and a correction is a new claim of reversal lines linked to the original,
// never an edit. No payment is made, scheduled or implied, and no figure here is a government or programme incentive rate.
// The state lives in the organisation operations document (like delegations) and is bounded by STATE_BYTES.
export const UNIT = 'SYN';
export const NOTICE = 'SYNTHETIC. Amounts are placeholders in synthetic units (SYN) that the organisation owner sets to test the claim workflow. They are not an incentive rate of any government or programme. Approving a claim records it only: no payment is made, scheduled or implied.';
export const KINDS = {
    'visit-confirmed': 'Confirmed visit',
    'visit-submitted': 'Confirmed visit accepted by a programme destination',
    'outreach-completed': 'Outreach item completed with a confirmed visit',
};
export const KIND_IDS = Object.keys(KINDS);
export const MAX_AMOUNT = 1000, MAX_LINES = 60, MAX_DAYS = 31, MAX_SCHEDULES = 50, STATE_BYTES = 500_000;
export const CHAIN_VERSION = 'saha-incentive-claim-v1';
export const GENESIS_PREV = '0'.repeat(64);
export const HASHING = "subject = SHA-256 of JSON.stringify(['saha-incentive-subject',organisation id,person id]); content = SHA-256 of JSON.stringify(['saha-incentive-claim-content-v1',claim id,number,type,corrects,team,claimant code,preparer code,period from,period to,schedule version,prepared at,[line id,kind,source ref,evidence visit,subject,activity at,amount,receipt,reversed claim,reversed line,reversal reason] per line,total,verifier code,verified at,verification note,approver code,approved at]); digest = SHA-256 of JSON.stringify(['saha-incentive-claim-v1',seq,previous digest,content]); seq 1 has previous digest of 64 zeros.";
const day = (s) => (s ?? '').slice(0, 10);
export const incentiveState = (s) => s.operations?.incentives ?? { schedules: [], claims: [] };
function writable(s) { const ops = s.operations ??= { version: 0, maintenance: false, reason: '', updatedAt: '', incidents: [], rates: null }; return ops.incentives ??= { schedules: [], claims: [] }; }
export const currentSchedule = (st) => st.schedules.at(-1);
const live = (c) => c.state === 'submitted' || c.state === 'verified' || c.state === 'approved';
// Sources already on a live claim: a visit can evidence one line only, and an outreach item can be on one line only.
export function claimedKeys(st) {
    const k = new Set();
    for (const c of st.claims)
        if (live(c))
            for (const l of c.lines)
                if (l.kind !== 'reversal') {
                    k.add('visit:' + l.evidenceVisitId);
                    if (l.kind === 'outreach-completed')
                        k.add('item:' + l.ref);
                }
    return k;
}
export function reversedKeys(st) {
    const k = new Set();
    for (const c of st.claims)
        if (live(c) && c.type === 'correction')
            for (const l of c.lines)
                if (l.reverses)
                    k.add(l.reverses.claimId + '/' + l.reverses.lineId);
    return k;
}
const id = z.string().trim().min(1).max(200), version = z.number().int().positive();
const text = (min, max, what) => z.string().trim().min(min, `Write at least ${min} characters for the ${what}.`).max(max).regex(/^[^=+\-@\u0000-\u001f]/, `Start the ${what} with a letter or a digit.`);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date.').refine(s => !isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s, 'Use a valid date.');
export const incentiveSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('setIncentiveSchedule'), expectedVersion: z.number().int().min(0), label: text(3, 80, 'schedule label'), lines: z.array(z.object({ kind: z.enum(KIND_IDS), amount: z.number().int().min(1, 'Each amount is at least 1 SYN.').max(MAX_AMOUNT, `Each amount is at most ${MAX_AMOUNT} SYN.`) }).strict()).min(1, 'Price at least one kind of activity.').max(KIND_IDS.length).refine(x => new Set(x.map(l => l.kind)).size === x.length, 'Price each kind once.'), reason: text(10, 300, 'reason') }).strict(),
    z.object({ type: z.literal('prepareIncentiveClaim'), teamId: id, from: date, to: date }).strict(),
    z.object({ type: z.literal('prepareIncentiveCorrection'), claimId: id, reversals: z.array(z.object({ lineId: id, reason: text(10, 300, 'reason') }).strict()).min(1).max(MAX_LINES).refine(x => new Set(x.map(r => r.lineId)).size === x.length, 'Name each line once.') }).strict(),
    z.object({ type: z.literal('withdrawIncentiveClaim'), claimId: id, version, reason: text(10, 300, 'reason') }).strict(),
    z.object({ type: z.literal('verifyIncentiveClaim'), claimId: id, version, decision: z.enum(['verified', 'returned']), note: z.string().trim().max(300).regex(/^([^=+\-@\u0000-\u001f].*)?$/, 'Start the note with a letter or a digit.') }).strict(),
    z.object({ type: z.literal('decideIncentiveClaim'), claimId: id, version, decision: z.enum(['approved', 'returned']), note: z.string().trim().max(300).regex(/^([^=+\-@\u0000-\u001f].*)?$/, 'Start the note with a letter or a digit.') }).strict(),
]);
const TYPES = new Set(['setIncentiveSchedule', 'prepareIncentiveClaim', 'prepareIncentiveCorrection', 'withdrawIncentiveClaim', 'verifyIncentiveClaim', 'decideIncentiveClaim']);
const active = (m) => !!m && m.status === 'active';
const claimOf = (s, claimId) => { const c = incentiveState(s).claims.find(x => x.id === claimId); if (!c)
    fail(404, 'Claim not found.'); return c; };
// Who may do what, checked on first run and again when a saved command is replayed. Supervision goes through slice 1e.
export function authorizeIncentives(s, m, c, now = new Date().toISOString()) {
    if (!TYPES.has(c?.type))
        return;
    if (!active(m))
        fail(403, 'Your membership is inactive.');
    if (c.type === 'setIncentiveSchedule') {
        if (!m.isOwner)
            fail(403, 'Only an owner can set the incentive schedule.');
        return;
    }
    if (c.type === 'prepareIncentiveClaim') {
        if (m.role !== 'asha')
            fail(403, 'Only an ASHA worker prepares a claim, from her own activity.');
        if (!m.teamIds.includes(c.teamId))
            fail(403, 'Choose a team you belong to.');
        return;
    }
    const claim = claimOf(s, c.claimId);
    if (c.type === 'prepareIncentiveCorrection') {
        if (!(m.role === 'asha' && claim.claimantId === m.userId) && !(m.role !== 'admin' && supervises(s, m, claim.teamId, now, false)))
            fail(403, 'The claimant or a supervisor of the team prepares a correction.');
        return;
    }
    if (c.type === 'withdrawIncentiveClaim') {
        if (claim.preparedBy !== m.userId)
            fail(403, 'Only the person who prepared a claim can withdraw it.');
        return;
    }
    if (c.type === 'verifyIncentiveClaim') {
        if (m.role === 'admin' || !supervises(s, m, claim.teamId, now, false))
            fail(403, 'A supervisor of the claimant\'s team verifies the claim.');
        if (m.userId === claim.claimantId || m.userId === claim.preparedBy)
            fail(403, 'You cannot verify a claim you prepared or that is yours; another supervisor of the team verifies it.');
        return;
    }
    if (!m.isOwner)
        fail(403, 'Only an owner approves a claim.');
    if (m.userId === claim.claimantId || m.userId === claim.preparedBy || m.userId === claim.verified?.by)
        fail(403, 'The owner who approves a claim is a different person from the claimant, the preparer and the verifier.');
}
export const indexOf = (s) => ({ visits: new Map(s.workspace.visits.map(v => [v.id, v])), items: new Map((s.outreach?.plans ?? []).flatMap(p => p.items.map(i => [i.id, i]))) });
const currentVisit = (v, personId) => !!v && v.personId === personId && v.state === 'confirmed' && !v.voidedAt && !v.supersededBy;
// Why a line's evidence no longer stands (or null). Reversal lines have no evidence of their own.
export function staleReason(ix, claim, l) {
    if (l.kind === 'reversal')
        return null;
    const v = ix.visits.get(l.evidenceVisitId);
    if (!v || v.personId !== l.personId)
        return 'The evidence visit is no longer available.';
    if (v.voidedAt)
        return `The visit was marked as recorded against the wrong patient on ${day(v.voidedAt)}.`;
    if (v.supersededBy)
        return 'The visit was corrected by a later visit.';
    if (v.state !== 'confirmed')
        return 'The visit is no longer a confirmed visit.';
    if (l.kind === 'outreach-completed') {
        const i = ix.items.get(l.ref), e = i?.events.filter(x => x.state === 'completed').at(-1);
        if (!i || i.state !== 'completed' || !e || e.by !== claim.claimantId || e.visitId !== l.evidenceVisitId)
            return 'The outreach record changed after the claim was prepared.';
    }
    return null;
}
export const staleLines = (s, claim) => { const ix = indexOf(s); return claim.lines.map(l => ({ l, why: staleReason(ix, claim, l) })).filter(x => x.why); };
function checkPeriod(from, to, now) {
    if (from > to)
        fail(422, 'The period must end on or after its start.');
    if (to > now.slice(0, 10))
        fail(422, 'The period cannot end in the future.');
    if ((Date.parse(to) - Date.parse(from)) / 86400000 + 1 > MAX_DAYS)
        fail(422, `A claim covers at most ${MAX_DAYS} days.`);
}
// The claimant's eligible, unclaimed confirmed activity in a period, priced by the schedule. One piece of work, one line:
// a visit that evidences an outreach completion is claimed under the outreach line only.
export function eligibleActivity(s, m, teamId, from, to, sched, now = new Date().toISOString()) {
    const price = new Map(sched.lines.map(l => [l.kind, l.amount])), taken = claimedKeys(incentiveState(s)), ix = indexOf(s);
    const people = new Map(s.workspace.people.filter(p => p.teamId === teamId && allowed(m, p, now)).map(p => [p.id, p]));
    const inPeriod = (at) => !!at && day(at) >= from && day(at) <= to;
    const rows = [], skipped = { alreadyClaimed: 0, notInSchedule: 0 }, used = new Set();
    for (const plan of s.outreach?.plans ?? [])
        for (const item of plan.items) {
            const p = people.get(item.personId), e = item.events.filter(x => x.state === 'completed').at(-1);
            if (!p || item.state !== 'completed' || !e || e.by !== m.userId || !inPeriod(e.at) || !e.visitId)
                continue;
            const v = ix.visits.get(e.visitId);
            if (!currentVisit(v, item.personId))
                continue;
            if (!price.has('outreach-completed')) {
                skipped.notInSchedule++;
                continue;
            }
            if (taken.has('item:' + item.id) || taken.has('visit:' + v.id)) {
                skipped.alreadyClaimed++;
                used.add(v.id);
                continue;
            }
            used.add(v.id);
            rows.push({ kind: 'outreach-completed', ref: item.id, evidenceVisitId: v.id, personId: p.id, at: e.at, amount: price.get('outreach-completed') });
        }
    for (const v of s.workspace.visits) {
        const p = people.get(v.personId);
        if (!p || v.patientCheck?.by !== m.userId || !currentVisit(v, v.personId) || !inPeriod(v.confirmedAt) || used.has(v.id))
            continue;
        const accepted = s.workspace.submissions.find(x => x.visitId === v.id && x.state === 'accepted'), kind = accepted && price.has('visit-submitted') ? 'visit-submitted' : 'visit-confirmed';
        if (!price.has(kind)) {
            skipped.notInSchedule++;
            continue;
        }
        if (taken.has('visit:' + v.id)) {
            skipped.alreadyClaimed++;
            continue;
        }
        rows.push({ kind, ref: v.id, evidenceVisitId: v.id, personId: p.id, at: v.confirmedAt, amount: price.get(kind), ...(kind === 'visit-submitted' && accepted?.receipt ? { receipt: accepted.receipt } : {}) });
    }
    rows.sort((a, b) => a.at.localeCompare(b.at) || a.ref.localeCompare(b.ref));
    return { rows, skipped };
}
export const subjectDigest = (orgId, personId) => sha256(JSON.stringify(['saha-incentive-subject', orgId, personId]));
export function contentDigest(c, chain) {
    return sha256(JSON.stringify(['saha-incentive-claim-content-v1', c.id, c.number, c.type, c.corrects ?? null, c.teamId, c.claimantCode, c.preparedByCode, c.period.from, c.period.to, c.scheduleVersion, c.createdAt,
        c.lines.map(l => [l.id, l.kind, l.ref, l.evidenceVisitId, l.subject, l.at, l.amount, l.receipt ?? null, l.reverses?.claimId ?? null, l.reverses?.lineId ?? null, l.reverses?.reason ?? null]),
        c.total, c.verified?.byCode ?? null, c.verified?.at ?? null, c.verified?.note ?? null, chain.byCode, chain.at]));
}
export const linkDigest = (seq, prev, content) => sha256(JSON.stringify([CHAIN_VERSION, seq, prev, content]));
// Recomputes the chain over the approved claims in sequence order and reports the first break.
export async function verifyClaimChain(s) {
    const approved = incentiveState(s).claims.filter(c => c.state === 'approved' || c.chain).sort((a, b) => (a.chain?.seq ?? 0) - (b.chain?.seq ?? 0));
    const out = { status: approved.length ? 'intact' : 'empty', approved: approved.length, head: null, firstBreak: null };
    const broke = (seq, claim, reason) => { out.status = 'broken'; out.firstBreak = { seq, claim, reason }; return out; };
    let prev = GENESIS_PREV, expected = 1;
    for (const c of approved) {
        const ch = c.chain;
        if (!ch || c.state !== 'approved')
            return broke(expected, c.id, 'A claim is in the chain without being an approved claim.');
        if (ch.seq !== expected)
            return broke(expected, c.id, `Sequence ${expected} is missing from the chain.`);
        if (ch.prev !== prev)
            return broke(ch.seq, c.id, 'The link to the previous claim does not match.');
        if (c.total !== c.lines.reduce((n, l) => n + l.amount, 0))
            return broke(ch.seq, c.id, 'The claim total does not match its lines.');
        for (const l of c.lines)
            if (l.subject !== await subjectDigest(s.organisation.id, l.personId))
                return broke(ch.seq, c.id, 'A line\'s patient reference was altered.');
        const content = await contentDigest(c, ch);
        if (content !== ch.content)
            return broke(ch.seq, c.id, 'The claim content was altered after approval.');
        if (await linkDigest(ch.seq, prev, content) !== ch.digest)
            return broke(ch.seq, c.id, 'The claim digest does not match its content and link.');
        prev = ch.digest;
        expected++;
        out.head = { seq: ch.seq, digest: ch.digest };
    }
    return out;
}
const ordinal = (n) => `claim ${n}`;
// Applies one incentive command. Returns null for any other command. Every transition is audited without patient content.
export async function applyIncentives(s, input, u, m, now = new Date().toISOString()) {
    const parsed = incentiveSchema.safeParse(input);
    if (!parsed.success) {
        if (input && typeof input === 'object' && TYPES.has(input.type))
            fail(422, parsed.error.issues[0]?.message ?? 'Check the claim.');
        return null;
    }
    const c = parsed.data;
    authorizeIncentives(s, m, c, now);
    const st = writable(s), push = (subject, detail) => s.workspace.audit.push({ id: uuid(), at: now, actor: u.displayName, actorId: u.userId, role: m.role, action: c.type, subject, detail });
    const bytes = () => JSON.stringify(st).length;
    if (c.type === 'setIncentiveSchedule') {
        const cur = currentSchedule(st);
        if (c.expectedVersion !== (cur?.version ?? 0))
            fail(409, 'The schedule changed. Refresh and review the latest version.');
        if (st.schedules.length >= MAX_SCHEDULES)
            fail(422, `Schedule version limit reached (${MAX_SCHEDULES}); an archive policy is not built.`);
        const sched = { version: (cur?.version ?? 0) + 1, label: c.label, lines: [...c.lines].sort((a, b) => a.kind.localeCompare(b.kind)), reason: c.reason, by: u.userId, byName: u.displayName, at: now };
        st.schedules.push(sched);
        push(`schedule-${sched.version}`, `Synthetic incentive schedule version ${sched.version} set: ${sched.lines.map(l => `${KINDS[l.kind]} ${l.amount} ${UNIT}`).join('; ')}. Placeholder amounts; no payment is made or implied. Reason: ${c.reason}`);
        return { version: sched.version };
    }
    if (c.type === 'prepareIncentiveClaim') {
        const sched = currentSchedule(st);
        if (!sched)
            fail(409, 'The owner has not set a synthetic incentive schedule yet.');
        checkPeriod(c.from, c.to, now);
        if (!s.teams.some(t => t.id === c.teamId))
            fail(422, 'Choose a team in this organisation.');
        const found = eligibleActivity(s, m, c.teamId, c.from, c.to, sched, now);
        if (!found.rows.length)
            fail(422, 'No eligible, unclaimed activity of yours in this period.');
        if (found.rows.length > MAX_LINES)
            fail(422, `This period has ${found.rows.length} eligible lines; a claim holds at most ${MAX_LINES}. Choose a shorter period.`);
        if (bytes() > STATE_BYTES)
            fail(422, 'The stored claim limit for this organisation is reached (kept as evidence). No new claim can be prepared until an archive policy is in place.');
        const lines = [];
        for (const r of found.rows)
            lines.push({ ...r, id: uuid(), subject: await subjectDigest(s.organisation.id, r.personId) });
        const claim = { id: uuid(), number: st.claims.length + 1, type: 'claim', teamId: c.teamId, claimantId: u.userId, claimantName: u.displayName, claimantCode: m.accountCode, preparedBy: u.userId, preparedByName: u.displayName, preparedByCode: m.accountCode, period: { from: c.from, to: c.to }, scheduleVersion: sched.version, lines, total: lines.reduce((n, l) => n + l.amount, 0), state: 'submitted', version: 1, createdAt: now, history: [{ at: now, by: u.userId, byName: u.displayName, action: 'submitted', note: '' }] };
        st.claims.push(claim);
        push(claim.id, `Synthetic incentive ${ordinal(claim.number)} submitted for ${c.from} to ${c.to}: ${lines.length} line${lines.length === 1 ? '' : 's'}, ${claim.total} ${UNIT} on schedule version ${sched.version}. No payment is made or implied.`);
        return { claimId: claim.id, number: claim.number, lines: lines.length, total: claim.total, version: claim.version };
    }
    const claim = claimOf(s, c.claimId);
    if (c.type === 'prepareIncentiveCorrection') {
        if (claim.state !== 'approved')
            fail(409, 'Only an approved claim is corrected, by a new linked claim.');
        const reversed = reversedKeys(st), lines = [];
        for (const r of c.reversals) {
            const l = claim.lines.find(x => x.id === r.lineId);
            if (!l)
                fail(404, 'A named line is not on this claim.');
            if (l.kind === 'reversal')
                fail(422, 'A reversal line cannot itself be reversed.');
            if (reversed.has(claim.id + '/' + l.id))
                fail(409, 'A line you named is already reversed by a live correction.');
            lines.push({ id: uuid(), kind: 'reversal', ref: l.id, evidenceVisitId: l.evidenceVisitId, personId: l.personId, subject: l.subject, at: l.at, amount: -l.amount, reverses: { claimId: claim.id, lineId: l.id, reason: r.reason } });
        }
        if (bytes() > STATE_BYTES)
            fail(422, 'The stored claim limit for this organisation is reached (kept as evidence). No new claim can be prepared until an archive policy is in place.');
        const prep = s.members.find(x => x.userId === u.userId);
        const corr = { id: uuid(), number: st.claims.length + 1, type: 'correction', corrects: claim.id, teamId: claim.teamId, claimantId: claim.claimantId, claimantName: claim.claimantName, claimantCode: claim.claimantCode, preparedBy: u.userId, preparedByName: u.displayName, preparedByCode: prep.accountCode, period: claim.period, scheduleVersion: claim.scheduleVersion, lines, total: lines.reduce((n, l) => n + l.amount, 0), state: 'submitted', version: 1, createdAt: now, history: [{ at: now, by: u.userId, byName: u.displayName, action: 'submitted', note: '' }] };
        st.claims.push(corr);
        push(corr.id, `Correction ${ordinal(corr.number)} submitted against ${ordinal(claim.number)}: ${lines.length} line${lines.length === 1 ? '' : 's'} reversed, ${corr.total} ${UNIT}. The original claim is unchanged.`);
        return { claimId: corr.id, number: corr.number, lines: lines.length, total: corr.total, version: corr.version };
    }
    if (claim.state === 'approved')
        fail(409, 'An approved claim is immutable. Prepare a correction instead.');
    if (claim.version !== c.version)
        fail(409, 'This claim changed. Refresh and review it before retrying.');
    const note = 'note' in c ? c.note : '', stamp = (action, n) => claim.history.push({ at: now, by: u.userId, byName: u.displayName, action, note: n });
    if (c.type === 'withdrawIncentiveClaim') {
        if (claim.state !== 'submitted' && claim.state !== 'verified')
            fail(409, 'Only a claim still in review can be withdrawn.');
        claim.state = 'withdrawn';
        claim.version++;
        stamp('withdrawn', c.reason);
        push(claim.id, `Synthetic incentive ${ordinal(claim.number)} withdrawn by its preparer; its lines are released. Reason: ${c.reason}`);
        return { claimId: claim.id, state: claim.state, version: claim.version };
    }
    if (c.type === 'verifyIncentiveClaim') {
        if (claim.state !== 'submitted')
            fail(409, 'Only a submitted claim is verified.');
        if (c.decision === 'returned') {
            if (note.length < 10)
                fail(422, 'Give the reason for returning this claim (at least 10 characters).');
            claim.state = 'returned';
            claim.version++;
            stamp('returned by the supervisor', note);
            push(claim.id, `Synthetic incentive ${ordinal(claim.number)} returned by the supervisor; its lines are released. Reason: ${note}`);
        }
        else {
            const stale = staleLines(s, claim);
            if (stale.length)
                fail(409, `${stale.length} line${stale.length === 1 ? ' no longer has' : 's no longer have'} current evidence (${stale[0].why}) Return the claim with a reason.`);
            claim.verified = { by: u.userId, byName: u.displayName, byCode: m.accountCode, at: now, note };
            claim.state = 'verified';
            claim.version++;
            stamp('verified', note);
            push(claim.id, `Synthetic incentive ${ordinal(claim.number)} verified by the team supervisor against the source records. Awaiting the owner. Verification is not payment.`);
        }
        return { claimId: claim.id, state: claim.state, version: claim.version };
    }
    // decideIncentiveClaim
    if (claim.state !== 'verified')
        fail(409, 'Only a verified claim is decided by the owner.');
    if (c.decision === 'returned') {
        if (note.length < 10)
            fail(422, 'Give the reason for returning this claim (at least 10 characters).');
        claim.state = 'returned';
        claim.version++;
        stamp('returned by the owner', note);
        push(claim.id, `Synthetic incentive ${ordinal(claim.number)} returned by the owner; its lines are released. Reason: ${note}`);
        return { claimId: claim.id, state: claim.state, version: claim.version };
    }
    const stale = staleLines(s, claim);
    if (stale.length)
        fail(409, `${stale.length} line${stale.length === 1 ? ' no longer has' : 's no longer have'} current evidence (${stale[0].why}) Return the claim with a reason.`);
    if (claim.type === 'correction')
        for (const l of claim.lines) {
            const orig = st.claims.find(x => x.id === l.reverses?.claimId);
            if (!orig || orig.state !== 'approved')
                fail(409, 'The claim this correction reverses is no longer approved.');
        }
    const head = st.claims.filter(x => x.chain).sort((a, b) => b.chain.seq - a.chain.seq)[0]?.chain, seq = (head?.seq ?? 0) + 1, prev = head?.digest ?? GENESIS_PREV;
    const chain = { at: now, by: u.userId, byName: u.displayName, byCode: m.accountCode }, content = await contentDigest(claim, chain);
    claim.chain = { seq, prev, content, digest: await linkDigest(seq, prev, content), ...chain };
    claim.state = 'approved';
    claim.version++;
    stamp('approved', note);
    push(claim.id, `Synthetic incentive ${ordinal(claim.number)} approved and stored immutably as chain entry ${seq}; digest ${claim.chain.digest}. ${claim.total} ${UNIT}. No payment is made or implied.`);
    return { claimId: claim.id, state: claim.state, version: claim.version, seq, digest: claim.chain.digest };
}
