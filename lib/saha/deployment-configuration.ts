type DynamicValue = ReturnType<typeof JSON.parse>;

import { z } from 'zod';
import { digest, fail, uuid } from './core';
import type { Actor } from './store';
import { PROGRAMMES, type Member, type OrgState, type Programme, type Role } from './types';

export const DEPLOYMENT_LANGUAGES = ['en', 'hi'] as const;
export const DEPLOYMENT_ROLES = ['asha', 'clinician', 'supervisor', 'admin', 'provider'] as const;
const ref = z.string().trim().min(1).max(200);
const reason = z.string().trim().min(10, 'Explain the reason in at least 10 characters.').max(1000);
const unique = <T extends z.ZodTypeAny>(item: T, max: number) => z.array(item).max(max).refine(v => new Set(v).size === v.length, 'List each value once.');
const uniqueNonempty = <T extends z.ZodTypeAny>(item: T, max: number) => z.array(item).min(1).max(max).refine(v => new Set(v).size === v.length, 'List each value once.');

export type DeploymentLimits = { activeMembers: number; patientRecords: number; externalConnections: number };
export type DeploymentSettings = {
  organisationId: string;
  localityIds: string[];
  facilityIds: string[];
  roles: Role[];
  programmes: Programme[];
  languages: (typeof DEPLOYMENT_LANGUAGES)[number][];
  providerEligibility: { integrationId: string; eligible: boolean }[];
  limits: DeploymentLimits;
};
export type DeploymentReview = { id: string; by: string; memberVersion: number; at: string; decision: 'approve' | 'reject'; reason: string; sourceHash: string };
export type DeploymentRevision = {
  id: string;
  version: number;
  state: 'staged' | 'approved' | 'rejected' | 'active' | 'superseded';
  settings: DeploymentSettings;
  sourceHash: string;
  proposedBy: string;
  proposerVersion: number;
  proposedAt: string;
  reason: string;
  review?: DeploymentReview;
  activatedAt?: string;
  activatedBy?: string;
  supersededAt?: string;
};
export type DeploymentConfigurationState = { version: number; revisions: DeploymentRevision[]; activeRevisionId: string | null };
type DeploymentOperations = NonNullable<OrgState['operations']> & { deploymentConfiguration?: DeploymentConfigurationState };

const settingsSchema = z.object({
  organisationId: ref,
  localityIds: unique(ref, 100),
  facilityIds: unique(ref, 200),
  roles: uniqueNonempty(z.enum(DEPLOYMENT_ROLES), DEPLOYMENT_ROLES.length),
  programmes: uniqueNonempty(z.enum(PROGRAMMES as [Programme, ...Programme[]]), PROGRAMMES.length),
  languages: uniqueNonempty(z.enum(DEPLOYMENT_LANGUAGES), DEPLOYMENT_LANGUAGES.length),
  providerEligibility: unique(z.object({ integrationId: ref, eligible: z.boolean() }).strict(), 100)
    .refine(v => new Set(v.map(x => x.integrationId)).size === v.length, 'List each provider once.'),
  limits: z.object({
    activeMembers: z.number().int().min(1).max(2000),
    patientRecords: z.number().int().min(1).max(100000),
    externalConnections: z.number().int().min(0).max(100),
  }).strict(),
}).strict();

export const deploymentConfigurationSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('deploymentConfigurationStage'), version: z.number().int().min(0), settings: settingsSchema, reason }).strict(),
  z.object({ type: z.literal('deploymentConfigurationReview'), version: z.number().int().min(0), revisionId: ref, decision: z.enum(['approve', 'reject']), reason }).strict(),
  z.object({ type: z.literal('deploymentConfigurationActivate'), version: z.number().int().min(0), revisionId: ref, reviewId: ref, reason }).strict(),
  z.object({ type: z.literal('deploymentConfigurationRollback'), version: z.number().int().min(0), revisionId: ref, reason }).strict(),
]);
export type DeploymentConfigurationCommand = z.infer<typeof deploymentConfigurationSchema>;
const TYPES = new Set<string>(deploymentConfigurationSchema.options.map(x => x.shape.type.value));
const blank = (): DeploymentConfigurationState => ({ version: 0, revisions: [], activeRevisionId: null });
export const deploymentConfigurations = (s: OrgState) => (s.operations as DeploymentOperations | undefined)?.deploymentConfiguration ?? blank();
export const activeDeploymentConfiguration = (s: OrgState) => {
  const state = deploymentConfigurations(s);
  return state.revisions.find(r => r.id === state.activeRevisionId && r.state === 'active') ?? null;
};

function currentSource(s: OrgState) {
  const access = s.operations?.accessScope;
  const language = (userId: string) => s.operations?.memberLanguages?.[userId]?.language ?? 'en';
  return {
    // The organisation revision advances when the staged command is persisted.
    // Pin the exact mutable inputs below so that transaction CAS movement alone
    // cannot fabricate a source drift at independent review.
    organisation: { id: s.organisation.id, name: s.organisation.name },
    teams: s.teams.map(t => ({ id: t.id, name: t.name })).sort((a, b) => a.id.localeCompare(b.id)),
    members: s.members.filter(m => m.status === 'active').map(m => ({ id: m.userId, role: m.role, owner: m.isOwner, version: m.version, language: language(m.userId) })).sort((a, b) => a.id.localeCompare(b.id)),
    locations: { version: access?.version ?? 0, localities: access?.localities ?? [], facilities: access?.facilities ?? [] },
    packs: (s.operations?.installedPacks ?? []).map(p => ({ id: p.pack.id, version: p.pack.version, state: p.state })).sort((a, b) => a.id.localeCompare(b.id)),
    integrations: s.workspace.integrations.map(i => ({ id: i.id, version: i.version, kind: i.kind, mode: i.mode, status: i.status })).sort((a, b) => a.id.localeCompare(b.id)),
  };
}

async function sourceHash(s: OrgState) { return digest(currentSource(s)); }

function validateSettings(s: OrgState, settings: DeploymentSettings): void {
  if (settings.organisationId !== s.organisation.id) fail(422, 'Configuration must name the selected organisation.');
  const access = s.operations?.accessScope;
  const localities = new Set((access?.localities ?? []).map(x => x.id));
  const facilities = new Map((access?.facilities ?? []).map(x => [x.id, x]));
  if (settings.localityIds.some(id => !localities.has(id))) fail(422, 'Choose only current localities in this organisation.');
  if (settings.facilityIds.some(id => !facilities.has(id))) fail(422, 'Choose only current facilities in this organisation.');
  if (settings.facilityIds.some(id => { const locality = facilities.get(id)?.localityId; return !!locality && !settings.localityIds.includes(locality); })) fail(422, 'Include the locality of every selected facility.');
  const activeRoles = new Set(s.members.filter(x => x.status === 'active').map(x => x.role));
  if ([...activeRoles].some(role => !settings.roles.includes(role))) fail(422, 'Include every role held by a current active member.');
  const usedProgrammes = new Set<Programme>(s.workspace.people.flatMap(p => p.programmes));
  if ([...usedProgrammes].some(p => !settings.programmes.includes(p))) fail(422, 'Include every programme used by a current patient record.');
  const usedLanguages = new Set(s.members.filter(x => x.status === 'active').map(x => s.operations?.memberLanguages?.[x.userId]?.language ?? 'en'));
  if ([...usedLanguages].some(language => !settings.languages.includes(language))) fail(422, 'Include every language selected by a current active member.');
  const integrationIds = s.workspace.integrations.map(i => i.id).sort();
  const eligibilityIds = settings.providerEligibility.map(i => i.integrationId).sort();
  if (JSON.stringify(integrationIds) !== JSON.stringify(eligibilityIds)) fail(422, 'Record eligibility for every current provider or connection exactly once.');
  const activeMembers = s.members.filter(x => x.status === 'active').length;
  if (settings.limits.activeMembers < activeMembers) fail(422, 'The active-member limit is below current use.');
  if (settings.limits.patientRecords < s.workspace.people.length) fail(422, 'The patient-record limit is below current use.');
  if (settings.limits.externalConnections < s.workspace.integrations.length) fail(422, 'The external-connection limit is below current use.');
}

function audit(s: OrgState, u: Actor, m: Member, action: string, subject: string, detail: string, at: string) {
  s.workspace.audit.push({ id: uuid(), at, actor: u.displayName, actorId: u.userId, role: m.role, action, subject, detail });
}

export function authorizeDeploymentConfiguration(_s: OrgState, m: Member, input: unknown): void {
  if (!TYPES.has((input as { type?: string } | undefined)?.type ?? '')) return;
  if (!m.isOwner && m.role !== 'admin') fail(403, 'Current deployment operations authority is required.');
  if ((input as { type?: string }).type !== 'deploymentConfigurationReview' && !m.isOwner) fail(403, 'Only an organisation owner can stage or activate deployment configuration.');
}

export async function applyDeploymentConfiguration(s: OrgState, input: unknown, u: Actor, m: Member, now = new Date().toISOString()): Promise<{ version: number; revisionId: string } | null> {
  if (!TYPES.has((input as { type?: string } | undefined)?.type ?? '')) return null;
  const parsed = deploymentConfigurationSchema.safeParse(input);
  if (!parsed.success) fail(422, parsed.error.issues[0]?.message ?? 'Invalid deployment configuration action.');
  const c = parsed.data;
  authorizeDeploymentConfiguration(s, m, c);
  const ops = s.operations ??= { version: 0, maintenance: false, reason: '', updatedAt: '', incidents: [], rates: null };
  const state = (ops as DeploymentOperations).deploymentConfiguration ??= blank();
  if (c.version !== state.version) fail(409, 'Deployment configuration changed. Refresh and review the current version.');
  if (state.revisions.length >= 50 && c.type === 'deploymentConfigurationStage') fail(422, 'Deployment configuration history limit reached; retain and archive it before staging another revision.');
  let revision: DeploymentRevision;
  if (c.type === 'deploymentConfigurationStage') {
    validateSettings(s, c.settings);
    const hash = await sourceHash(s);
    revision = { id: uuid(), version: 1, state: 'staged', settings: c.settings, sourceHash: hash, proposedBy: u.userId, proposerVersion: m.version, proposedAt: now, reason: c.reason };
    state.revisions.push(revision);
    audit(s, u, m, c.type, revision.id, `Deployment configuration staged for independent review. Source ${hash}. ${c.reason}`, now);
  } else {
    revision = state.revisions.find(r => r.id === c.revisionId) ?? fail(404, 'Deployment configuration revision not found.');
    if (c.type === 'deploymentConfigurationReview') {
      if (revision.state !== 'staged') fail(409, 'Only a staged configuration can be reviewed.');
      if (revision.proposedBy === u.userId) fail(403, 'A different deployment operator must review this configuration.');
      if (revision.proposerVersion !== (s.members.find(x => x.userId === revision.proposedBy)?.version ?? -1)) fail(409, 'The proposer authority changed. Stage a fresh configuration.');
      validateSettings(s, revision.settings);
      const hash = await sourceHash(s);
      if (hash !== revision.sourceHash) fail(409, 'Referenced organisation settings changed. Stage a fresh configuration.');
      const review: DeploymentReview = { id: uuid(), by: u.userId, memberVersion: m.version, at: now, decision: c.decision, reason: c.reason, sourceHash: hash };
      revision.review = review; revision.version++; revision.state = c.decision === 'approve' ? 'approved' : 'rejected';
      audit(s, u, m, c.type, revision.id, `Deployment configuration ${c.decision}d independently. ${c.reason}`, now);
    } else if (c.type === 'deploymentConfigurationActivate') {
      if (revision.state !== 'approved' || !revision.review || revision.review.id !== c.reviewId || revision.review.decision !== 'approve') fail(409, 'Activate the exact independently approved revision.');
      if (revision.review.by === u.userId) fail(403, 'The independent reviewer cannot activate their own decision.');
      const reviewer = s.members.find(x => x.userId === revision.review!.by && x.status === 'active');
      if (!reviewer || reviewer.version !== revision.review.memberVersion || (!reviewer.isOwner && reviewer.role !== 'admin')) fail(409, 'Reviewer authority changed. Stage and review a fresh configuration.');
      validateSettings(s, revision.settings);
      const hash = await sourceHash(s);
      if (hash !== revision.sourceHash || hash !== revision.review.sourceHash) fail(409, 'Referenced organisation settings changed after review. Nothing was activated.');
      const prior = state.revisions.find(r => r.id === state.activeRevisionId && r.state === 'active');
      if (prior) { prior.state = 'superseded'; prior.supersededAt = now; prior.version++; }
      revision.state = 'active'; revision.activatedAt = now; revision.activatedBy = u.userId; revision.version++; state.activeRevisionId = revision.id;
      audit(s, u, m, c.type, revision.id, `Independently reviewed deployment configuration activated. ${c.reason}`, now);
    } else {
      if (revision.id === state.activeRevisionId || !revision.activatedAt || !['superseded', 'active'].includes(revision.state)) fail(409, 'Choose a previously active configuration revision.');
      validateSettings(s, revision.settings);
      const hash = await sourceHash(s);
      if (hash !== revision.sourceHash) fail(409, 'The earlier revision no longer matches current referenced settings. Rollback was not activated.');
      const prior = state.revisions.find(r => r.id === state.activeRevisionId && r.state === 'active');
      if (prior) { prior.state = 'superseded'; prior.supersededAt = now; prior.version++; }
      revision.state = 'active'; revision.activatedAt = now; revision.activatedBy = u.userId; revision.supersededAt = undefined; revision.version++; state.activeRevisionId = revision.id;
      audit(s, u, m, c.type, revision.id, `Previously active deployment configuration restored after current validation. ${c.reason}`, now);
    }
  }
  state.version++;
  return { version: state.version, revisionId: revision.id };
}

function activeSettings(s: OrgState) { return activeDeploymentConfiguration(s)?.settings ?? null; }
export function enforceDeploymentConfiguration(s: OrgState, input: DynamicValue, replay = false): void {
  const cfg = activeSettings(s);
  if (!cfg || TYPES.has(input?.type)) return;
  if (['createInvite', 'updateMember'].includes(input?.type) && !cfg.roles.includes(input.role)) fail(409, 'That role is not enabled in the active deployment configuration.');
  if (!replay && input?.type === 'joinOrganisation' && s.members.filter(x => x.status === 'active').length >= cfg.limits.activeMembers) fail(409, 'The active deployment member limit has been reached.');
  if (input?.type === 'createPerson') {
    if (!cfg.programmes.includes(input.programme)) fail(409, 'That programme is not enabled in the active deployment configuration.');
    if (!replay && s.workspace.people.length >= cfg.limits.patientRecords) fail(409, 'The active deployment patient-record limit has been reached.');
  }
  if (input?.type === 'registerFieldPerson') {
    if (!cfg.programmes.includes(input.programme)) fail(409, 'That programme is not enabled in the active deployment configuration.');
    if (!replay && s.workspace.people.length >= cfg.limits.patientRecords) fail(409, 'The active deployment patient-record limit has been reached.');
  }
  if (input?.type === 'setMyLanguage' && !cfg.languages.includes(input.language)) fail(409, 'That language is not enabled in the active deployment configuration.');
  if (!replay && input?.type === 'registerIntegration' && s.workspace.integrations.length >= cfg.limits.externalConnections) fail(409, 'The active deployment external-connection limit has been reached.');
  if (['toggleIntegration', 'activateMis', 'activateEhr'].includes(input?.type)) {
    const eligibility = cfg.providerEligibility.find(x => x.integrationId === input.integrationId);
    if (!eligibility?.eligible) fail(409, 'This provider is not eligible in the active deployment configuration.');
  }
  if (['setTeamLocation', 'setMemberLocation'].includes(input?.type)) {
    if (input.facilityId && !cfg.facilityIds.includes(input.facilityId)) fail(409, 'That facility is not enabled in the active deployment configuration.');
    if (input.localityId && !cfg.localityIds.includes(input.localityId)) fail(409, 'That locality is not enabled in the active deployment configuration.');
  }
}

export function deploymentConfigurationView(s: OrgState, m: Member, patientRecords = s.workspace.people.length) {
  if (!m.isOwner && m.role !== 'admin') fail(403, 'Current deployment operations authority is required.');
  const state = deploymentConfigurations(s), access = s.operations?.accessScope;
  return {
    organisation: { id: s.organisation.id, name: s.organisation.name, revision: s.organisation.revision },
    actor: { id: m.userId, role: m.role, owner: m.isOwner, version: m.version },
    version: state.version,
    activeRevisionId: state.activeRevisionId,
    revisions: state.revisions.slice().reverse(),
    choices: {
      localities: access?.localities ?? [], facilities: access?.facilities ?? [],
      roles: DEPLOYMENT_ROLES, programmes: PROGRAMMES, languages: DEPLOYMENT_LANGUAGES,
      providers: s.workspace.integrations.map(i => ({ id: i.id, name: i.name, kind: i.kind, status: i.status, version: i.version })),
    },
    currentUse: { activeMembers: s.members.filter(x => x.status === 'active').length, patientRecords, externalConnections: s.workspace.integrations.length },
  };
}
