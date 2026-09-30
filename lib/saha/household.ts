import { z } from 'zod';
import { fail, person, uuid } from './core';
import { allowed } from './access';
import type { Member, OrgState, Person } from './types';
import type { Actor } from './store';

// Slice 1: households and proxy authority (BR-ID-07, BR-SEC-04, part of BR-PROG-05).
//
// Household membership records who lives together. It never grants staff access (staff scope
// stays team + assignment) and never authorises disclosure between members. Disclosure to
// another person needs a proxy grant recorded on the subject: who may receive, relationship,
// purposes, the sensitive classes explicitly allowed, evidence and an expiry. Without a current
// grant a member is omitted entirely from anything prepared for another member, so the recipient
// cannot infer that the member has pending care.

import { RELATIONSHIPS, PURPOSES, SENSITIVE } from './household-constants';
import { TERMINAL } from './referral-rules';
export { RELATIONSHIPS, PURPOSES, SENSITIVE };
export type Relationship = typeof RELATIONSHIPS[number];
export type Purpose = typeof PURPOSES[number];
export type Sensitive = typeof SENSITIVE[number];
export type HouseholdMember = { personId: string; relationship: Relationship; from: string; to?: string; addedBy: string; addedAt: string; endedBy?: string; endReason?: string };
export type Household = { id: string; version: number; label: string; teamId: string; members: HouseholdMember[]; createdAt: string; createdBy: string };
export type ProxyGrant = { id: string; proxyPersonId: string; relationship: Relationship; purposes: Purpose[]; classes: Sensitive[]; evidence: string; from: string; expiresAt: string; grantedBy: string; grantedAt: string; revokedAt?: string; revokedBy?: string; revokeReason?: string };

const id = z.string().trim().min(1).max(100), ver = z.number().int().positive(), note = z.string().trim().min(5).max(500);
const relationship = z.enum(RELATIONSHIPS);
export const householdSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('householdCreate'), personId: id, version: ver, label: z.string().trim().min(3).max(120), relationship }).strict(),
  z.object({ type: z.literal('householdAddMember'), householdId: id, version: ver, personId: id, personVersion: ver, relationship }).strict(),
  z.object({ type: z.literal('householdEndMember'), householdId: id, version: ver, personId: id, personVersion: ver, reason: note }).strict(),
  z.object({ type: z.literal('proxyGrant'), personId: id, version: ver, proxyPersonId: id, relationship, purposes: z.array(z.enum(PURPOSES)).min(1).max(PURPOSES.length), classes: z.array(z.enum(SENSITIVE)).max(SENSITIVE.length), evidence: z.string().trim().min(3).max(200), expiresAt: z.string().datetime() }).strict(),
  z.object({ type: z.literal('proxyRevoke'), personId: id, version: ver, grantId: id, reason: note }).strict(),
]);
export type HouseholdCommand = z.infer<typeof householdSchema>;

const MAX_MEMBERS = 30, MAX_HOUSEHOLDS = 50000, MAX_GRANTS = 20, MAX_DAYS = 365;
const care = (m: Member) => { if (!['asha', 'clinician'].includes(m.role)) fail(403, 'A care role is required to manage households and proxies.'); };
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

export const activeGrant = (g: ProxyGrant, now: string) => !g.revokedAt && g.from <= now && g.expiresAt > now;

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
export function shareable(s: OrgState, h: Household, recipient: Person, purpose: Purpose, now = new Date().toISOString()) {
  const members = current(h).flatMap(x => {
    const p = s.workspace.people.find(q => q.id === x.personId);
    if (!p) return [];
    if (p.id === recipient.id) return [{ personId: p.id, name: p.name, relationship: x.relationship, self: true, items: openItems(s, p).map(({ classes, ...i }) => i) }];
    const grant = (p.proxies ?? []).find(g => g.proxyPersonId === recipient.id && g.purposes.includes(purpose) && activeGrant(g, now));
    if (!grant) return [];
    return [{ personId: p.id, name: p.name, relationship: x.relationship, self: false, grantId: grant.id, items: openItems(s, p).filter(i => i.classes.every(c => grant.classes.includes(c))).map(({ classes, ...i }) => i) }];
  });
  return { recipientId: recipient.id, purpose, members, rule: 'Members without a current proxy grant for this purpose are omitted, as are items revealing a sensitive class the grant does not name.' };
}

export function authorizeHousehold(s: OrgState, m: Member, c: any) {
  if (!['householdCreate', 'householdAddMember', 'householdEndMember', 'proxyGrant', 'proxyRevoke'].includes(c.type)) return;
  care(m);
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
    if (!w.people.some(q => q.id === c.proxyPersonId)) fail(404, 'The proxy must be a registered person in this organisation.');
    const days = (Date.parse(c.expiresAt) - Date.parse(now)) / 86400000;
    if (days <= 0 || days > MAX_DAYS) fail(422, 'Set an expiry in the future and within 365 days.');
    const grants = p.proxies ??= [];
    if (grants.filter(g => activeGrant(g, now)).length >= MAX_GRANTS) fail(422, 'A person can have up to 20 current proxy grants.');
    if (grants.some(g => activeGrant(g, now) && g.proxyPersonId === c.proxyPersonId)) fail(409, 'A current grant for this proxy exists. Revoke it before recording a different scope.');
    const g: ProxyGrant = { id: uuid(), proxyPersonId: c.proxyPersonId, relationship: c.relationship, purposes: [...new Set(c.purposes)], classes: [...new Set(c.classes)], evidence: c.evidence, from: now, expiresAt: c.expiresAt, grantedBy: u.userId, grantedAt: now };
    grants.push(g); result = { grantId: g.id };
    detail = `Proxy recorded for ${g.purposes.join(', ')}; sensitive classes allowed: ${g.classes.join(', ') || 'none'}; expires ${g.expiresAt.slice(0, 10)}.`;
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
export function householdView(s: OrgState, m: Member, p: Person, recipientId: string | null, purpose: Purpose) {
  const h = householdOf(s, p);
  if (!h) return { household: null };
  const members = current(h).map(x => ({ x, q: s.workspace.people.find(q => q.id === x.personId) }));
  const visible = members.filter(({ q }) => q && allowed(m, q));
  const now = new Date().toISOString();
  const recipient = recipientId ? visible.find(({ q }) => q!.id === recipientId)?.q : undefined;
  if (recipientId && !recipient) fail(404, 'Choose a current household member in your care scope.');
  return {
    household: { id: h.id, version: h.version, label: h.label, teamId: h.teamId },
    members: visible.map(({ x, q }) => ({ personId: q!.id, name: q!.name, age: q!.age, version: q!.version, relationship: x.relationship, from: x.from, sensitive: sensitiveClasses(q!), openItems: openItems(s, q!).length, proxies: (q!.proxies ?? []).map(g => ({ ...g, active: activeGrant(g, now), proxyName: s.workspace.people.find(r => r.id === g.proxyPersonId && allowed(m, r))?.name ?? 'Person not shown in this household view' })) })),
    outsideScope: members.length - visible.length,
    shareable: recipient ? shareable(s, h, recipient, purpose, now) : null,
    boundary: 'Household membership grants no staff access and no disclosure. Sharing with a member needs a current proxy grant on each subject.',
  };
}
