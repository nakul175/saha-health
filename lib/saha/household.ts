import { z } from 'zod';
import { fail, person, uuid } from './core';
import { allowed } from './access';
import type { Member, OrgState, Person } from './types';
import type { Actor } from './store';
import type { HouseholdVisit } from './household-visit';

// Slice 1: households and proxy authority (BR-ID-07, BR-SEC-04, part of BR-PROG-05).
//
// Household membership records who lives together. It never grants staff access (staff scope
// stays team + assignment) and never authorises disclosure between members. Disclosure to
// another person needs a proxy grant recorded on the subject: who may receive, relationship,
// purposes, the sensitive classes explicitly allowed, evidence and an expiry. Without a current
// grant a member is omitted entirely from anything prepared for another member, so the recipient
// cannot infer that the member has pending care.
//
// Slice 14b (R12, BR-ID-07, BR-SEC-04, BR-SEC-02): a grant also records the authority it rests on (parent of a minor,
// legal guardian, nominated by the person, representative of an adult who lacks capacity), separately from the typed
// relationship between the two people, and a start as well as an expiry. Two acting purposes let a representative record
// or withdraw a consent decision and make a rights request for the person. Every action that relies on a grant checks it
// on the server at the time of the action (`grantState`, `requireProxy`): revoked, not started, expired, out of purpose,
// relationship or authority missing, the person now 18 under a parent's authority, or a capacity representative whose
// person is not (or no longer) recorded as lacking capacity are all refused. Each reliance is its own audit event
// (`proxyUse`), and the record of the act names the representative's record, relationship, authority and grant period.
// Capacity is recorded by a clinician (`capacityRecord`), append-only.

import { ACTING_PURPOSES, ADULT_AGE, AUTHORITIES, AUTHORITY_LABEL, CAPACITY_STATES, MAX_GRANT_DAYS, MAX_START_DAYS, PERSON_RELATIONSHIPS, RELATIONSHIPS, PURPOSES, SENSITIVE, SHARING_PURPOSES } from './household-constants';
import { TERMINAL } from './referral-rules';
export { ACTING_PURPOSES, ADULT_AGE, AUTHORITIES, AUTHORITY_LABEL, CAPACITY_STATES, PERSON_RELATIONSHIPS, RELATIONSHIPS, PURPOSES, SENSITIVE, SHARING_PURPOSES };
export type Relationship = typeof RELATIONSHIPS[number];
export type Purpose = typeof PURPOSES[number];
export type SharingPurpose = typeof SHARING_PURPOSES[number];
export type Sensitive = typeof SENSITIVE[number];
export type Authority = typeof AUTHORITIES[number];
export type CapacityState = typeof CAPACITY_STATES[number];
export type HouseholdMember = { personId: string; relationship: Relationship; from: string; to?: string; addedBy: string; addedAt: string; endedBy?: string; endReason?: string };
export type Household = { id: string; version: number; label: string; teamId: string; members: HouseholdMember[]; createdAt: string; createdBy: string; visits?: HouseholdVisit[] };
// `authority` is absent on grants recorded before slice 14b; such a grant is never in force.
export type ProxyGrant = { id: string; proxyPersonId: string; relationship: Relationship; authority?: Authority; purposes: Purpose[]; classes: Sensitive[]; evidence: string; from: string; expiresAt: string; grantedBy: string; grantedAt: string; revokedAt?: string; revokedBy?: string; revokeReason?: string };
// Slice 14b: one capacity assessment, recorded by a clinician and never changed; the latest one is the person's current state.
export type CapacityRecord = { id: string; state: CapacityState; at: string; by: string; role: string; evidence: string; note: string };
// Slice 14b: what the record of an act names when a representative acted (consent event, rights request, receipt).
export type RepresentativeRef = { grantId: string; proxyPersonId: string; relationship: Relationship; authority: Authority; from: string; expiresAt: string };

const id = z.string().trim().min(1).max(100), ver = z.number().int().positive(), note = z.string().trim().min(5).max(500);
const relationship = z.enum(RELATIONSHIPS);
export const householdSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('householdCreate'), personId: id, version: ver, label: z.string().trim().min(3).max(120), relationship }).strict(),
  z.object({ type: z.literal('householdAddMember'), householdId: id, version: ver, personId: id, personVersion: ver, relationship }).strict(),
  z.object({ type: z.literal('householdEndMember'), householdId: id, version: ver, personId: id, personVersion: ver, reason: note }).strict(),
  // Slice 14b: the relationship is between the two people (no household role), the authority is required, and the grant
  // may start later than now.
  z.object({ type: z.literal('proxyGrant'), personId: id, version: ver, proxyPersonId: id, relationship: z.enum(PERSON_RELATIONSHIPS), authority: z.enum(AUTHORITIES), purposes: z.array(z.enum(PURPOSES)).min(1).max(PURPOSES.length), classes: z.array(z.enum(SENSITIVE)).max(SENSITIVE.length), evidence: z.string().trim().min(3).max(200), startsAt: z.string().datetime().optional(), expiresAt: z.string().datetime() }).strict(),
  z.object({ type: z.literal('proxyRevoke'), personId: id, version: ver, grantId: id, reason: note }).strict(),
  // Slice 14b: a clinician's record of whether an adult has capacity to make a decision (append-only).
  z.object({ type: z.literal('capacityRecord'), personId: id, version: ver, state: z.enum(CAPACITY_STATES), evidence: z.string().trim().min(3, 'Give an evidence reference of at least 3 characters.').max(200), note: z.string().trim().min(10, 'Write at least 10 characters.').max(500) }).strict(),
]);
export type HouseholdCommand = z.infer<typeof householdSchema>;
const TYPES = new Set(['householdCreate', 'householdAddMember', 'householdEndMember', 'proxyGrant', 'proxyRevoke', 'capacityRecord']);

const MAX_MEMBERS = 30, MAX_HOUSEHOLDS = 50000, MAX_GRANTS = 20, MAX_CAPACITY = 50, DAY = 86400000;
const care = (m: Member) => { if (!['asha', 'clinician'].includes(m.role)) fail(403, 'A care role is required to manage households and proxies.'); };
const day = (s: string) => s.slice(0, 10);
export const PURPOSE_LABEL: Record<Purpose, string> = { appointments: 'appointments', 'care-coordination': 'care coordination', medicines: 'medicines', 'referral-follow-up': 'referral follow-up', 'consent-decisions': 'consent decisions', 'rights-requests': 'rights requests' };

// Slice 14b: the person's current capacity record (the latest one), or 'not-recorded'.
export const capacityOf = (p: Person): CapacityState | 'not-recorded' => p.capacity?.at(-1)?.state ?? 'not-recorded';
export type GrantState = 'in-force' | 'revoked' | 'not-started' | 'expired' | 'no-relationship' | 'no-authority' | 'not-a-parent' | 'parent-authority-ended' | 'nomination-by-minor' | 'capacity-not-recorded' | 'capacity-regained';
// Whether a grant can be relied on at `now`, for any purpose. Checked at every use, so a change of age, capacity, dates or
// revocation takes effect at once without anyone editing the grant.
export function grantState(subject: Person, g: ProxyGrant, now: string): GrantState {
  if (g.revokedAt) return 'revoked';
  if (g.from > now) return 'not-started';
  if (g.expiresAt <= now) return 'expired';
  if (!(PERSON_RELATIONSHIPS as readonly string[]).includes(g.relationship)) return 'no-relationship';
  if (!g.authority || !(AUTHORITIES as readonly string[]).includes(g.authority)) return 'no-authority';
  if (g.authority === 'parent-of-minor') {
    if (g.relationship !== 'parent') return 'not-a-parent';
    if (subject.age >= ADULT_AGE) return 'parent-authority-ended';
  }
  if (g.authority === 'nominated' && subject.age < ADULT_AGE) return 'nomination-by-minor';
  if (g.authority === 'capacity-representative') {
    // Regaining capacity ends the grant for good: a later finding of incapacity needs a new grant.
    if ((subject.capacity ?? []).some(r => r.state === 'has-capacity' && r.at >= g.grantedAt)) return 'capacity-regained';
    if (capacityOf(subject) !== 'lacks-capacity') return 'capacity-not-recorded';
  }
  return 'in-force';
}
export function grantRefusal(state: GrantState, g: ProxyGrant, subject: Person): string {
  switch (state) {
    case 'revoked': return `This proxy grant was revoked on ${day(g.revokedAt ?? '')}. A representative needs a grant in force.`;
    case 'not-started': return `This proxy grant starts on ${day(g.from)}. It cannot be relied on before then.`;
    case 'expired': return `This proxy grant expired on ${day(g.expiresAt)}. Record a new grant if the authority still applies.`;
    case 'no-relationship': return 'This proxy grant records no relationship between the representative and the person. Record a new grant that names it.';
    case 'no-authority': return 'This proxy grant records no authority (it was recorded before authority was required). Record a new grant that names the relationship and the authority.';
    case 'not-a-parent': return 'A parent\'s authority needs the representative to be the person\'s parent. Record the grant under another authority.';
    case 'parent-authority-ended': return `A parent's authority ends when the person turns ${ADULT_AGE}; this person's recorded age is ${subject.age}. Ask the person, or record another authority.`;
    case 'nomination-by-minor': return `A nomination needs the person to be ${ADULT_AGE} or older; this person's recorded age is ${subject.age}.`;
    case 'capacity-not-recorded': return 'This authority applies only while a clinician\'s record says the person lacks capacity to decide, and the latest record does not say so. Ask the person, or have a clinician record a capacity assessment.';
    case 'capacity-regained': return 'This authority ended when a clinician recorded that the person has capacity to decide. Ask the person; a later finding of incapacity needs a new grant.';
    default: return 'This proxy grant is in force.';
  }
}
// Slice 14b: every action that relies on proxy authority calls this on the server at the time of the action. It refuses
// (422) unless the grant is recorded on the person, names the representative given, is in force and covers the purpose.
export function requireProxy(subject: Person, grantId: string | undefined, purpose: Purpose, now: string, proxyPersonId?: string): ProxyGrant {
  const g = grantId ? (subject.proxies ?? []).find(x => x.id === grantId) : undefined;
  if (!g) fail(422, 'A representative needs a proxy grant recorded on this person. Record one first.');
  if (proxyPersonId !== undefined && g.proxyPersonId !== proxyPersonId) fail(422, 'This proxy grant names a different representative.');
  const state = grantState(subject, g, now);
  if (state !== 'in-force') fail(422, grantRefusal(state, g, subject));
  if (!g.purposes.includes(purpose)) fail(422, `This proxy grant does not cover ${PURPOSE_LABEL[purpose]}. It covers ${g.purposes.map(x => PURPOSE_LABEL[x] ?? x).join(', ')}.`);
  return g;
}
export const representativeRef = (g: ProxyGrant): RepresentativeRef => ({ grantId: g.id, proxyPersonId: g.proxyPersonId, relationship: g.relationship, authority: g.authority!, from: g.from, expiresAt: g.expiresAt });
// Identifiers, relationship and authority only: the representative's name is shown on screen only to someone who may see
// the representative's own record (slice 6r), so it is not written into audit text.
export const representativeText = (r: RepresentativeRef) => `a representative (record ${r.proxyPersonId}; the person's ${r.relationship.replace(/-/g, ' ')}; ${AUTHORITY_LABEL[r.authority].toLowerCase()}; grant ${r.grantId} in force ${day(r.from)} to ${day(r.expiresAt)})`;
// Slice 14b: each reliance on a grant is its own audit event on the person's record.
export function recordProxyUse(s: OrgState, subject: Person, g: ProxyGrant, purpose: Purpose, action: string, ref: string, u: Actor, m: Member, now: string) {
  s.workspace.audit.push({ id: uuid(), at: now, actor: u.displayName, actorId: u.userId, role: m.role, action: 'proxyUse', subject: g.id, personId: subject.id, detail: `Proxy authority relied on for ${PURPOSE_LABEL[purpose]} (${action} ${ref}): ${representativeText(representativeRef(g))}. Checked in force at ${now}.` });
}
// Not revoked and not yet expired (including a grant that starts later).
const open = (g: ProxyGrant, now: string) => !g.revokedAt && g.expiresAt > now;
const current = (h: Household) => h.members.filter(x => !x.to);
export const householdOf = (s: OrgState, p: Person) => p.householdId ? (s.households ?? []).find(h => h.id === p.householdId) : undefined;

export function sensitiveClasses(p: Person): Sensitive[] {
  const packs = new Set((p.enrolments ?? []).filter(e => e.state === 'active').map(e => e.packId));
  return [
    ...(p.programmes.includes('Maternal care') || packs.has('maternal') ? ['maternal' as const] : []),
    ...(p.programmes.includes('TB screening') || packs.has('tb') ? ['tb' as const] : []),
    ...(p.age >= 10 && p.age < 18 ? ['adolescent' as const] : []),
    ...(p.age < 10 ? ['child' as const] : []),
  ];
}

type Item = { kind: 'follow-up' | 'visit' | 'referral'; title: string; due: string | null; classes: Sensitive[] };
// Open work for one person, each item tagged with the sensitive classes it would reveal.
export function openItems(s: OrgState, p: Person): Item[] {
  const personal = sensitiveClasses(p), age = personal.filter(c => c === 'adolescent' || c === 'child');
  const packClass = (packId: string): Sensitive[] => packId === 'maternal' ? ['maternal'] : packId === 'tb' ? ['tb'] : [];
  return [
    ...(p.followUps ?? []).filter(t => t.state === 'open').map(t => ({ kind: 'follow-up' as const, title: t.title, due: t.due, classes: [...packClass(t.packId), ...age] })),
    ...(p.status !== 'completed' ? [{ kind: 'visit' as const, title: 'Home visit', due: p.due ?? null, classes: age }] : []),
    // A referral reason can reveal any condition, so it carries every class the person has.
    ...s.workspace.referrals.filter(r => r.personId === p.id && !TERMINAL.has(r.state)).map(r => ({ kind: 'referral' as const, title: 'Referral follow-up', due: r.due ?? null, classes: personal })),
  ];
}

// What may be shared with `recipient` about each current member of the household, for one purpose.
// Members without a current grant for that purpose are omitted; items revealing a sensitive class
// the grant does not name are omitted. The recipient's own items are always included.
// Slice 6r: when `mayShow` is given (the worker-facing view), members the viewer may not see are never
// named or itemised, even with a grant; they are only counted in `omittedOutsideScope`.
// Slice 14b: a grant counts only while it is in force under its authority (`grantState`), not merely within its dates.
export function shareable(s: OrgState, h: Household, recipient: Person, purpose: SharingPurpose, now = new Date().toISOString(), mayShow?: (p: Person) => boolean) {
  let omittedOutsideScope = 0;
  const members = current(h).flatMap(x => {
    const p = s.workspace.people.find(q => q.id === x.personId);
    if (!p) return [];
    if (mayShow && !mayShow(p)) { omittedOutsideScope++; return []; }
    if (p.id === recipient.id) return [{ personId: p.id, name: p.name, relationship: x.relationship, self: true, items: openItems(s, p).map(({ classes, ...i }) => i) }];
    const grant = (p.proxies ?? []).find(g => g.proxyPersonId === recipient.id && g.purposes.includes(purpose) && grantState(p, g, now) === 'in-force');
    if (!grant) return [];
    return [{ personId: p.id, name: p.name, relationship: x.relationship, self: false, grantId: grant.id, items: openItems(s, p).filter(i => i.classes.every(c => grant.classes.includes(c))).map(({ classes, ...i }) => i) }];
  });
  return { recipientId: recipient.id, purpose, members, omittedOutsideScope, rule: 'Members outside your care scope are not shown. Members without a current proxy grant for this purpose are omitted, as are items revealing a sensitive class the grant does not name.' };
}

// Also applied when an idempotent request is replayed.
export function authorizeHousehold(s: OrgState, m: Member, c: any) {
  if (!TYPES.has(c?.type)) return;
  // Slice 14b: a capacity finding is a clinical judgement.
  if (c.type === 'capacityRecord') { if (m.role !== 'clinician') fail(403, 'A clinician records decision-making capacity.'); }
  else care(m);
  person(s.workspace, c.personId);
}

export function applyHousehold(s: OrgState, input: unknown, u: Actor, m: Member, now = new Date().toISOString()): any | null {
  const parsed = householdSchema.safeParse(input);
  if (!parsed.success) return null;
  const c = parsed.data, w = s.workspace;
  authorizeHousehold(s, m, c);
  const p = person(w, c.personId), today = now.slice(0, 10);
  const households = s.households ??= [];
  let detail = '', result: any = { ok: true };
  if (c.type === 'householdCreate') {
    if (p.version !== c.version) fail(409, 'Patient details changed. Refresh before creating a household.');
    if (p.householdId && householdOf(s, p)?.members.some(x => x.personId === p.id && !x.to)) fail(409, 'This person already belongs to a household. End that membership first.');
    if (households.length >= MAX_HOUSEHOLDS) fail(422, 'This release supports up to 50,000 households per organisation.');
    const h: Household = { id: uuid(), version: 1, label: c.label, teamId: p.teamId, members: [{ personId: p.id, relationship: c.relationship, from: today, addedBy: u.userId, addedAt: now }], createdAt: now, createdBy: u.userId };
    households.push(h); p.householdId = h.id; result = { householdId: h.id };
    detail = 'Household recorded. Membership grants no access or disclosure.';
  } else if (c.type === 'householdAddMember' || c.type === 'householdEndMember') {
    const h = households.find(x => x.id === c.householdId);
    if (!h) fail(404, 'Household not found.');
    if (h.version !== c.version) fail(409, 'This household changed. Refresh before updating it.');
    if (p.version !== c.personVersion) fail(409, 'Patient details changed. Refresh before updating the household.');
    if (!m.teamIds.includes(h.teamId)) fail(403, 'This household belongs to a care team you are not in.');
    if (c.type === 'householdAddMember') {
      if (p.householdId && households.find(x => x.id === p.householdId)?.members.some(x => x.personId === p.id && !x.to)) fail(409, 'This person already belongs to a household. End that membership first.');
      if (current(h).length >= MAX_MEMBERS) fail(422, 'A household can have up to 30 current members.');
      h.members.push({ personId: p.id, relationship: c.relationship, from: today, addedBy: u.userId, addedAt: now });
      p.householdId = h.id; detail = 'Member added. Membership grants no access or disclosure.';
    } else {
      const x = h.members.find(x => x.personId === p.id && !x.to);
      if (!x) fail(409, 'This person is not a current member of the household.');
      Object.assign(x, { to: today, endedBy: u.userId, endReason: c.reason });
      delete p.householdId;
      // Leaving a household ends grants made to or by household relatives only through explicit revocation;
      // grants are about people, not addresses, so they are kept and remain visible for review.
      detail = `Membership ended. Reason: ${c.reason}`;
    }
    h.version++;
  } else if (c.type === 'proxyGrant') {
    if (p.version !== c.version) fail(409, 'Patient details changed. Refresh before recording a proxy.');
    if (c.proxyPersonId === p.id) fail(422, 'A person cannot be their own proxy.');
    const proxy = w.people.find(q => q.id === c.proxyPersonId);
    if (!proxy) fail(404, 'The proxy must be a registered person in this organisation.');
    // Slice 14b: a start (today or up to 90 days ahead; a start today means now) and an expiry within 365 days of it.
    if (c.startsAt && day(c.startsAt) < today) fail(422, 'Choose a start from today.');
    const from = c.startsAt && c.startsAt > now ? c.startsAt : now;
    if (Date.parse(from) - Date.parse(now) > MAX_START_DAYS * DAY) fail(422, `Choose a start within ${MAX_START_DAYS} days.`);
    const days = (Date.parse(c.expiresAt) - Date.parse(from)) / DAY;
    if (days <= 0 || days > MAX_GRANT_DAYS) fail(422, `Set an expiry after the start and within ${MAX_GRANT_DAYS} days of it.`);
    // Slice 14b: someone who decides or makes requests for another person must be an adult.
    if (c.purposes.some(x => (ACTING_PURPOSES as readonly string[]).includes(x)) && proxy.age < ADULT_AGE) fail(422, `A representative who decides or makes requests for the person must be ${ADULT_AGE} or older.`);
    // A nomination is made by the person themselves, so it needs a person not recorded as lacking capacity.
    if (c.authority === 'nominated' && capacityOf(p) === 'lacks-capacity') fail(422, 'This person is recorded as lacking capacity to decide, so they cannot nominate a representative now. Record a legal guardian or a capacity representative.');
    const g: ProxyGrant = { id: uuid(), proxyPersonId: c.proxyPersonId, relationship: c.relationship, authority: c.authority, purposes: [...new Set(c.purposes)], classes: [...new Set(c.classes)], evidence: c.evidence, from, expiresAt: c.expiresAt, grantedBy: u.userId, grantedAt: now };
    // The authority must hold from the grant's start (age, relationship, capacity), checked with the same rule as every use.
    const state = grantState(p, g, from);
    if (state !== 'in-force') fail(422, grantRefusal(state, g, p));
    const grants = p.proxies ?? [];
    if (grants.filter(x => open(x, now)).length >= MAX_GRANTS) fail(422, `A person can have up to ${MAX_GRANTS} current or future proxy grants.`);
    // One grant per proxy at a time; a renewal may start when the current grant ends.
    if (grants.some(x => open(x, now) && x.proxyPersonId === c.proxyPersonId && x.from < c.expiresAt && from < x.expiresAt)) fail(409, 'A grant for this proxy already covers part of this period. Revoke it, or start the new grant when it ends.');
    (p.proxies ??= []).push(g); result = { grantId: g.id, from: g.from, expiresAt: g.expiresAt };
    detail = `Proxy recorded: ${representativeText(representativeRef(g))}; purposes ${g.purposes.join(', ')}; sensitive classes allowed: ${g.classes.join(', ') || 'none'}; evidence ${g.evidence}.`;
  } else if (c.type === 'capacityRecord') {
    if (p.version !== c.version) fail(409, 'Patient details changed. Refresh before recording capacity.');
    if (p.age < ADULT_AGE) fail(422, `Capacity is recorded for adults in this release. For a person under ${ADULT_AGE}, record a parent or legal guardian.`);
    const records = p.capacity ??= [];
    if (records.length >= MAX_CAPACITY) fail(422, `This release keeps up to ${MAX_CAPACITY} capacity records per person.`);
    const before = (p.proxies ?? []).filter(g => grantState(p, g, now) === 'in-force');
    const rec: CapacityRecord = { id: uuid(), state: c.state, at: now, by: u.userId, role: m.role, evidence: c.evidence, note: c.note };
    records.push(rec);
    const ended = before.filter(g => grantState(p, g, now) !== 'in-force');
    result = { capacityId: rec.id, state: rec.state, grantsEnded: ended.map(g => g.id) };
    detail = `Decision-making capacity recorded: ${c.state === 'lacks-capacity' ? 'lacks capacity to decide' : 'has capacity to decide'} (evidence ${c.evidence}).${ended.length ? ` ${ended.length} capacity representative grant${ended.length === 1 ? '' : 's'} ended: ${ended.map(g => g.id).join(', ')}.` : ''}`;
  } else {
    const g = (p.proxies ?? []).find(g => g.id === c.grantId);
    if (!g) fail(404, 'Proxy grant not found.');
    if (g.revokedAt) fail(409, 'This proxy grant is already revoked.');
    Object.assign(g, { revokedAt: now, revokedBy: u.userId, revokeReason: c.reason });
    detail = `Proxy revoked. Reason: ${c.reason}`;
  }
  w.audit.push({ id: uuid(), at: now, actor: u.displayName, actorId: u.userId, role: m.role, action: c.type, subject: p.id, detail, personId: p.id });
  return result;
}

// Worker-facing household view: only members inside the worker's scope are named; others are counted.
export function householdView(s: OrgState, m: Member, p: Person, recipientId: string | null, purpose: SharingPurpose, now = new Date().toISOString()) {
  const h = householdOf(s, p);
  if (!h) return { household: null };
  const members = current(h).map(x => ({ x, q: s.workspace.people.find(q => q.id === x.personId) }));
  const visible = members.filter(({ q }) => q && allowed(m, q));
  const recipient = recipientId ? visible.find(({ q }) => q!.id === recipientId)?.q : undefined;
  if (recipientId && !recipient) fail(404, 'Choose a current household member in your care scope.');
  return {
    household: { id: h.id, version: h.version, label: h.label, teamId: h.teamId },
    members: visible.map(({ x, q }) => ({ personId: q!.id, name: q!.name, age: q!.age, version: q!.version, relationship: x.relationship, from: x.from, sensitive: sensitiveClasses(q!), openItems: openItems(s, q!).length, capacity: capacityOf(q!),
      // Slice 14b: each grant's state under its authority, and whether it can still be revoked (current or future).
      proxies: (q!.proxies ?? []).map(g => { const state = grantState(q!, g, now); return { ...g, state, active: state === 'in-force', revocable: open(g, now), proxyName: s.workspace.people.find(r => r.id === g.proxyPersonId && allowed(m, r))?.name ?? 'Person not shown in this household view' }; }) })),
    outsideScope: members.length - visible.length,
    shareable: recipient ? shareable(s, h, recipient, purpose, now, q => allowed(m, q)) : null,
    boundary: 'Household membership grants no staff access and no disclosure. Sharing with a member needs a current proxy grant on each subject.',
  };
}
