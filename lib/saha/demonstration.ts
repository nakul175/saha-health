import { AppError, fail, uuid } from './core';
import { applyGovernance, governanceState, type GovernanceSpec } from './governance';
import type { EnvironmentName } from './environment';
import type { OrgState, Member } from './types';
import type { Actor } from './store';
import type { D1Database } from '@cloudflare/workers-types';
// Slice 9a: demonstration clinical package (synthetic environment only).
//
// A new synthetic organisation has no reviewed protocol, so a danger sign cannot be shown being flagged and
// routed to a referral service. This module installs a small package of sources, services and protocols by
// running the ordinary governance commands (applyGovernance) with two synthetic fixture clinicians: one
// authors every entry and is its clinical owner, a different one reviews it, and the organisation owner
// activates it, because only an owner may change deployment status. No governance check is skipped.
//
// The fixture clinicians are members with account rows (memberships and team_members reference accounts), but
// no identity provider can sign in as them: Sites principals whose id starts with FIXTURE_PREFIX are refused
// (identity.ts) and Cloudflare Access ids always start with `access:`. They are not managed by roster sync,
// cannot be edited as members, receive no caseload and cannot hold delegated authority.
//
// Nothing here is clinically approved. The two sources are real public documents, cited for a demonstration
// rule; the three services are synthetic and unverified.
export const FIXTURE_PREFIX = 'fixture:';
export const isFixtureMember = (userId: string) => userId.startsWith(FIXTURE_PREFIX);
export const DEMONSTRATION_COMMAND = 'installDemonstrationPackage';
export const DEMONSTRATION_KEYS = ['demo-source-mohfw-anc-anm-2005', 'demo-source-ntep-tb-diagnostic-algorithm', 'demo-service-rampur-phc', 'demo-service-kheda-chc-fru', 'demo-service-kheda-tb-centre', 'demo-protocol-maternal-bp', 'demo-protocol-tb-cough'] as const;
export const DEMONSTRATION_TEAM = 'default';
const REVIEW_REFERENCE = 'synthetic-fixture';
const REVIEW_FINDINGS = 'Demonstration fixture, not a clinical review. Recorded by a synthetic fixture clinician so the governance workflow can be shown; no clinician has reviewed this content.';
const SUMMARY = 'Synthetic demonstration fixture for a presenter-led product demonstration. Not clinically approved and not for real patients.';

export function fixtureMembers(orgId: string, now: string): Member[] {
  return [
    { userId: `${FIXTURE_PREFIX}${orgId}:clinician-author`, displayName: 'Demonstration clinician — author (synthetic)', accountCode: '', role: 'clinician', isOwner: false, status: 'active', version: 1, teamIds: [DEMONSTRATION_TEAM], createdAt: now },
    { userId: `${FIXTURE_PREFIX}${orgId}:clinician-reviewer`, displayName: 'Demonstration clinician — reviewer (synthetic)', accountCode: '', role: 'clinician', isOwner: false, status: 'active', version: 1, teamIds: [DEMONSTRATION_TEAM], createdAt: now },
  ];
}
// Account rows the fixture memberships need (foreign keys). The address uses the reserved .invalid domain.
export const fixtureEmail = (m: Member) => `${m.userId.split(':').at(-1)}@demonstration-fixture.invalid`;

export function demonstrationInstalled(s: OrgState) { return governanceState(s).entries.some(e => (DEMONSTRATION_KEYS as readonly string[]).includes(e.spec.key)); }
export function demonstrationAvailable(environment: EnvironmentName) { return environment === 'synthetic'; }
// SAHA_DEMONSTRATION_PACKAGE=manual turns off automatic installation in new home organisations (the owner command still
// works). The HTTP test suite uses it because its shared organisation was written for an empty clinical governance register.
export const automaticInstall = (env: Record<string, string | undefined>) => String(env.SAHA_DEMONSTRATION_PACKAGE ?? '').trim().toLowerCase() !== 'manual';

const addDays = (date: string, days: number) => new Date(Date.parse(date + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10);

// Installs the package into s (mutating it). accountCode is supplied by the caller (store.accountCode).
// Refuses outside the synthetic environment, when already installed, without the default team, or when a
// fixture member exists in a state the package cannot use.
export async function installDemonstration(s: OrgState, owner: { u: Actor; m: Member }, environment: EnvironmentName, codeOf: (userId: string) => Promise<string>, now = new Date().toISOString()) {
  if (!demonstrationAvailable(environment)) fail(409, `The demonstration clinical package is available only in the synthetic environment, not in ${environment}.`);
  if (!owner.m.isOwner || owner.m.status !== 'active') fail(403, 'An organisation owner must install the demonstration package.');
  if (demonstrationInstalled(s)) fail(409, 'The demonstration clinical package is already installed in this organisation. Its entries stay under Clinical governance; revise or retire them there.');
  if (!s.teams.some(t => t.id === DEMONSTRATION_TEAM)) fail(409, 'The demonstration package needs the organisation\'s default care team.');
  const [authorSeed, reviewerSeed] = fixtureMembers(s.organisation.id, now);
  const fixture = async (seed: Member) => {
    const existing = s.members.find(x => x.userId === seed.userId);
    if (existing) { if (existing.status !== 'active' || existing.role !== 'clinician' || !existing.teamIds.includes(DEMONSTRATION_TEAM)) fail(409, 'A demonstration fixture clinician is no longer active in the default team. The package cannot be installed again.'); return existing; }
    const m = { ...seed, accountCode: await codeOf(seed.userId) }; s.members.push(m); return m;
  };
  const author = await fixture(authorSeed), reviewer = await fixture(reviewerSeed);
  const actor = (m: Member): Actor => ({ userId: m.userId, displayName: m.displayName, email: fixtureEmail(m) });
  const today = now.slice(0, 10), reviewBy = addDays(today, 365);
  const common = { ownerId: author.userId, teamIds: [DEMONSTRATION_TEAM], effectiveFrom: today, reviewBy };
  // Author creates, a different clinician reviews, the organisation owner activates.
  const install = async (spec: GovernanceSpec) => {
    const created = await applyGovernance(s, { type: 'createGovernance', spec }, actor(author), author, now);
    const entry = () => governanceState(s).entries.find(e => e.id === created.entryId)!;
    await applyGovernance(s, { type: 'reviewGovernance', entryId: created.entryId, version: entry().version, reference: REVIEW_REFERENCE, findings: REVIEW_FINDINGS }, actor(reviewer), reviewer, now);
    await applyGovernance(s, { type: 'transitionGovernance', entryId: created.entryId, version: entry().version, state: 'active', reason: 'Demonstration package activated in the synthetic environment. Not a clinical approval.' }, owner.u, owner.m, now);
    return created.entryId as string;
  };
  const anc = await install({ ...common, kind: 'source', key: DEMONSTRATION_KEYS[0], title: 'MoHFW guidelines for antenatal care and skilled attendance at birth by ANMs and LHVs (2005)', changeSummary: SUMMARY, publisher: 'Maternal Health Division, Ministry of Health and Family Welfare, Government of India', edition: '2005', url: 'https://nhmmeghalaya.nic.in/guidelines/gfac.pdf', applicability: 'Antenatal blood pressure checks; used here only for a demonstration rule', summary: 'If the BP is more than 140/90 mmHg (or diastolic more than 90), check again after 1 hour; if still high, check urine for albumin and refer to the medical officer. Diastolic above 110 mmHg is a danger sign: refer to the CHC/FRU immediately.' });
  const ntep = await install({ ...common, kind: 'source', key: DEMONSTRATION_KEYS[1], title: 'NTEP diagnostic algorithm for TB disease', changeSummary: SUMMARY, publisher: 'National TB Elimination Programme, India', edition: 'online, read 2 October 2026', url: 'https://www.ntep.in/node/1743/CP-diagnostic-algorithm-tb-disease-ntep', applicability: 'Community screening for presumptive pulmonary TB; demonstration rule only', summary: 'Persons with cough of more than 2 weeks, with or without other symptoms suggestive of TB, are presumptive pulmonary TB and should be referred for evaluation.' });
  const service = (key: string, title: string, location: string, services: string) => install({ ...common, kind: 'service', key, title, changeSummary: SUMMARY, location, services, contactRoute: 'Synthetic contact route (no real facility is contacted)', constraints: 'Synthetic demonstration service. Not verified: it does not describe a real facility, its hours or its capacity.', verifiedOn: today, verificationReference: 'synthetic-fixture-not-verified' });
  const phc = await service(DEMONSTRATION_KEYS[2], 'Rampur PHC medical officer (synthetic)', 'Rampur (synthetic)', 'Medical officer review of antenatal blood pressure (synthetic demonstration service).');
  const chc = await service(DEMONSTRATION_KEYS[3], 'Kheda CHC / First Referral Unit (synthetic)', 'Kheda (synthetic)', 'Emergency obstetric referral for antenatal danger signs (synthetic demonstration service).');
  const tb = await service(DEMONSTRATION_KEYS[4], 'Kheda TB testing centre (synthetic)', 'Kheda (synthetic)', 'Evaluation and testing of presumptive TB (synthetic demonstration service).');
  const bpAction = 'BP at or above 140/90 mmHg in pregnancy: recheck after 1 hour; if still high, refer to the medical officer.';
  const maternal = await install({ ...common, kind: 'protocol', key: DEMONSTRATION_KEYS[5], title: 'Antenatal blood pressure (demonstration, not clinically approved)', changeSummary: SUMMARY, programme: 'Maternal care', ageMin: 15, ageMax: 49, roles: ['asha', 'clinician'], sourceIds: [anc], maxObservationAgeHours: 72, transition: 'new-reviews-only', rules: [
    { id: 'systolic-140', label: 'Systolic BP 140 mmHg or above', condition: { field: 'systolic', operator: 'gte', value: '140' }, urgency: 'review', action: bpAction, serviceId: phc },
    { id: 'diastolic-90', label: 'Diastolic BP 90 mmHg or above', condition: { field: 'diastolic', operator: 'gte', value: '90' }, urgency: 'review', action: bpAction, serviceId: phc },
    { id: 'diastolic-above-110', label: 'Danger sign: diastolic BP above 110 mmHg', condition: { field: 'diastolic', operator: 'gte', value: '111' }, urgency: 'urgent_review', action: 'Diastolic BP above 110 mmHg is a danger sign: refer to the CHC/FRU immediately.', serviceId: chc },
  ] });
  const cough = await install({ ...common, kind: 'protocol', key: DEMONSTRATION_KEYS[6], title: 'Presumptive TB: cough duration (demonstration, not clinically approved)', changeSummary: SUMMARY, programme: 'TB screening', ageMin: 15, ageMax: 120, roles: ['asha', 'clinician'], sourceIds: [ntep], maxObservationAgeHours: 72, transition: 'new-reviews-only', rules: [
    { id: 'cough-over-2-weeks', label: 'Cough for more than 2 weeks', condition: { field: 'coughDays', operator: 'gte', value: '15' }, urgency: 'review', action: 'Cough for more than 2 weeks: presumptive TB. Refer for testing.', serviceId: tb },
  ] });
  const entries = { sources: [anc, ntep], services: [phc, chc, tb], protocols: [maternal, cough] };
  s.workspace.audit.push({ id: uuid(), at: new Date().toISOString(), actorId: owner.u.userId, actor: owner.u.displayName, role: owner.m.role, action: DEMONSTRATION_COMMAND, subject: s.organisation.id, detail: 'Demonstration clinical package installed in the synthetic environment: 2 sources, 3 synthetic services and 2 protocols, authored and reviewed by two synthetic fixture clinicians and activated by the organisation owner. Not clinically approved; not for real patients.' });
  return { installed: true, fixtures: [author.userId, reviewer.userId], entries };
}

export const demonstrationCommand = (c: any) => c?.type === DEMONSTRATION_COMMAND;
// Replay and first-run authorisation: owner only, in the synthetic environment.
export function authorizeDemonstration(m: Member, c: any, environment: EnvironmentName) {
  if (!demonstrationCommand(c)) return;
  if (!m.isOwner) fail(403, 'Only an organisation owner can install the demonstration clinical package.');
  if (!demonstrationAvailable(environment)) fail(409, `The demonstration clinical package is available only in the synthetic environment, not in ${environment}.`);
}
// The owner command. Returns null for other commands. The caller writes the fixture account rows first.
export async function applyDemonstration(s: OrgState, c: any, u: Actor, m: Member, environment: EnvironmentName, codeOf: (userId: string) => Promise<string>) {
  if (!demonstrationCommand(c)) return null;
  authorizeDemonstration(m, c, environment);
  return installDemonstration(s, { u, m }, environment, codeOf);
}
// Account rows for fixture members, written before the membership rows that reference them. Idempotent; an account
// row left behind by a command that then fails has no membership and no way to sign in.
export async function writeFixtureAccounts(db: D1Database, members: Member[], now: string) {
  const fixtures = members.filter(m => isFixtureMember(m.userId));
  if (fixtures.length) await db.batch(fixtures.map(m => db.prepare('INSERT INTO accounts (user_id,account_code,display_name,email,created_at) VALUES (?,?,?,?,?) ON CONFLICT(user_id) DO NOTHING').bind(m.userId, m.accountCode, m.displayName, fixtureEmail(m), now)));
}
// A new home organisation in the synthetic environment receives the package. Installation runs on a copy, so a
// failure leaves the organisation as it would have been without it, plus an activity entry saying so; it is never a
// sign-in failure.
export async function prepareHome(db: D1Database, state: OrgState, u: Actor, environment: EnvironmentName, codeOf: (userId: string) => Promise<string>) {
  if (!demonstrationAvailable(environment)) return;
  const owner = state.members.find(x => x.userId === u.userId);
  if (!owner) return;
  try {
    const next = structuredClone(state);
    await installDemonstration(next, { u, m: next.members.find(x => x.userId === u.userId)! }, environment, codeOf, state.organisation.createdAt);
    await writeFixtureAccounts(db, next.members, state.organisation.createdAt);
    Object.assign(state, next);
  } catch (e) {
    // Recorded in the organisation's activity rather than the Worker log; the reason is Saha's own refusal text.
    state.workspace.audit.push({ id: uuid(), at: new Date().toISOString(), actorId: u.userId, actor: u.displayName, role: owner.role, action: DEMONSTRATION_COMMAND, subject: state.organisation.id, detail: `Demonstration clinical package not installed: ${e instanceof AppError ? e.message : 'unexpected error'} An owner can install it later with the ${DEMONSTRATION_COMMAND} command.` });
  }
}
