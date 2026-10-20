import { z } from 'zod';
import { fail, uuid } from './core';
import type { Actor } from './store';
import type { Member, OrgState } from './types';
import { frontlineAgreement } from './service-identity';
import { effectiveAnaemiaProvider } from './provider-version';
import type { GovernanceEntry } from './governance';

export type ProcessingBasis = {
  kind: 'consent' | 'contract' | 'legal-obligation' | 'public-task' | 'legitimate-interest';
  reference: string;
  consentPurpose?: 'ai' | 'exchange';
};

export type DataFlowAuthority = {
  id: string;
  targetId: string;
  targetKind: 'provider' | 'connector';
  organisationId: string;
  purpose: string;
  accessPurpose: 'programme-delivery' | 'care-coordination' | 'ai-assistance' | 'reporting' | 'household-sharing';
  directions: ('read' | 'write' | 'send' | 'lookup' | 'probe')[];
  targetVersion: number;
  targetFingerprint: string;
  basis: ProcessingBasis;
  recipient: string;
  retentionRule: string;
  dataClasses: string[];
  state: 'draft' | 'approved' | 'withdrawn';
  version: number;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  reason: string;
  approval?: { by: string; at: string; reason: string };
  withdrawn?: { by: string; at: string; reason: string };
};

const id = z.string().trim().min(1).max(200);
const text = z.string().trim().min(5).max(500);
const basis = z.object({
  kind: z.enum(['consent', 'contract', 'legal-obligation', 'public-task', 'legitimate-interest']),
  reference: z.string().trim().min(3).max(200),
  consentPurpose: z.enum(['ai', 'exchange']).optional(),
}).strict().superRefine((value, context) => {
  if (value.kind === 'consent' && !value.consentPurpose) context.addIssue({ code: 'custom', message: 'Choose the consent purpose required for this flow.' });
  if (value.kind !== 'consent' && value.consentPurpose) context.addIssue({ code: 'custom', message: 'Consent purpose applies only to a consent-based flow.' });
});

export const dataFlowAuthoritySchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('dataFlowDraft'),
    version: z.number().int().min(0),
    targetId: id,
    targetKind: z.enum(['provider', 'connector']),
    purpose: text,
    accessPurpose: z.enum(['programme-delivery', 'care-coordination', 'ai-assistance', 'reporting', 'household-sharing']),
    directions: z.array(z.enum(['read', 'write', 'send', 'lookup', 'probe'])).min(1).max(5).refine(values => new Set(values).size === values.length, 'List each direction once.'),
    basis,
    recipient: text,
    retentionRule: text,
    dataClasses: z.array(z.string().trim().min(2).max(100)).min(1).max(20).refine(values => new Set(values).size === values.length, 'List each data class once.'),
    reason: text,
  }).strict(),
  z.object({ type: z.literal('dataFlowApprove'), recordId: id, version: z.number().int().positive(), reason: text }).strict(),
  z.object({ type: z.literal('dataFlowWithdraw'), recordId: id, version: z.number().int().positive(), reason: text }).strict(),
]);

export type DataFlowAuthorityCommand = z.infer<typeof dataFlowAuthoritySchema>;

function records(state: OrgState) {
  return (state.operations ??= { version: 0, maintenance: false, reason: '', updatedAt: '', incidents: [], rates: null }).dataFlows ??= [];
}

export function governanceProviderFingerprint(entry: GovernanceEntry) {
  if (entry.spec.kind !== 'capability') fail(422, 'Choose a provider capability.');
  return `governance:${entry.id}:r${entry.revision}:${entry.manifestHash}`;
}

function targetBinding(state: OrgState, targetId: string, targetKind: DataFlowAuthority['targetKind'], runtime: Record<string, string | undefined> = {}) {
  const integration = state.workspace.integrations.find(item => item.id === targetId);
  if (integration) return targetKind === (integration.kind === 'ai' ? 'provider' : 'connector') ? { version: integration.version, fingerprint: `integration:${integration.id}:v${integration.version}` } : null;
  if (targetKind === 'provider' && targetId === 'independent:anaemia') {
    const agreement = effectiveAnaemiaProvider(state, runtime);
    return { version: agreement.version, fingerprint: `anaemia:v${agreement.version}:${agreement.agreementRef}` };
  }
  if (targetKind === 'provider' && targetId.startsWith('frontline:')) {
    const appId = targetId.slice('frontline:'.length), agreement = frontlineAgreement(state, appId);
    return { version: agreement.version, fingerprint: `frontline:${appId}:v${agreement.version}` };
  }
  const entry = targetKind === 'provider' ? (state.governance?.entries ?? [])
    .filter(item => item.spec.kind === 'capability' && item.spec.providerId === targetId && item.state !== 'retired')
    .sort((a, b) => b.revision - a.revision || b.createdAt.localeCompare(a.createdAt))[0] : undefined;
  return entry ? { version: entry.revision, fingerprint: governanceProviderFingerprint(entry) } : null;
}

export function authorityFor(state: OrgState, targetId: string, purpose?: DataFlowAuthority['accessPurpose']) {
  const matches = (state.operations?.dataFlows ?? []).filter(record => record.targetId === targetId && (!purpose || record.accessPurpose === purpose));
  return matches.find(record => record.state === 'approved') ?? matches[0];
}

export function requireApprovedDataFlow(state: OrgState, targetId: string, expected?: { purpose?: DataFlowAuthority['accessPurpose']; direction?: DataFlowAuthority['directions'][number]; targetFingerprint?: string; runtime?: Record<string, string | undefined> }) {
  const approved = (state.operations?.dataFlows ?? []).filter(record => record.targetId === targetId && record.state === 'approved' && record.organisationId === state.organisation.id);
  if (!approved.length) fail(403, 'An approved purpose and processing-basis record is required before this provider or connector can be used.');
  const purposeMatches = expected?.purpose ? approved.filter(record => record.accessPurpose === expected.purpose) : approved;
  if (!purposeMatches.length) fail(403, 'The approved data-flow purpose does not cover this request.');
  const directionMatches = expected?.direction ? purposeMatches.filter(record => record.directions.includes(expected.direction!)) : purposeMatches;
  if (!directionMatches.length) fail(403, 'The approved data-flow direction does not cover this request.');
  const consentMatches = directionMatches.filter(record => record.basis.kind !== 'consent' || !expected?.purpose || record.basis.consentPurpose === (expected.purpose === 'ai-assistance' ? 'ai' : 'exchange'));
  if (!consentMatches.length) fail(403, 'The approved consent purpose does not cover this request.');
  for (const record of consentMatches) {
    const current = targetBinding(state, targetId, record.targetKind, expected?.runtime);
    const active = state.workspace.integrations.find(item => item.id === targetId)?.status === 'active' || (targetId === 'independent:anaemia' ? state.operations?.anaemiaProvider?.active : targetId.startsWith('frontline:') ? state.operations?.frontlineProviders?.[targetId.slice('frontline:'.length)]?.active : false);
    const expectedFingerprint = expected?.targetFingerprint ?? current?.fingerprint;
    const activatedFingerprint = current && active && current.version === record.targetVersion + 1 && current.fingerprint === record.targetFingerprint?.replace(`v${record.targetVersion}`, `v${current.version}`);
    if (current && record.targetFingerprint && expectedFingerprint && (record.targetFingerprint === expectedFingerprint || activatedFingerprint) && record.basis.reference && record.retentionRule && record.dataClasses.length) return record;
  }
  fail(403, 'The provider or connector changed after this data-flow authority was approved.');
}

export function authorizeDataFlowAuthority(state: OrgState, member: Member, command: unknown) {
  const parsed = dataFlowAuthoritySchema.safeParse(command);
  if (!parsed.success) return;
  if (!member.isOwner) fail(403, 'Only an organisation owner can manage processing authority.');
  const data = parsed.data;
  if (data.type !== 'dataFlowDraft') {
    const record = records(state).find(item => item.id === data.recordId);
    if (!record) fail(404, 'Data-flow authority record not found.');
  }
}

export function applyDataFlowAuthority(state: OrgState, command: unknown, actor: Actor, member: Member, now = new Date().toISOString(), runtime: Record<string, string | undefined> = {}) {
  const parsed = dataFlowAuthoritySchema.safeParse(command);
  if (!parsed.success) return null;
  authorizeDataFlowAuthority(state, member, parsed.data);
  const list = records(state);
  const c = parsed.data;
  let record: DataFlowAuthority;
  if (c.type === 'dataFlowDraft') {
    const currentTarget = targetBinding(state, c.targetId, c.targetKind, runtime);
    if (currentTarget === null) fail(422, 'Choose a current provider or connector in this organisation.');
    record = list.find(item => item.targetId === c.targetId && item.accessPurpose === c.accessPurpose)!;
    if (record) {
      if (record.version !== c.version) fail(409, 'The data-flow record changed. Refresh before editing it.');
      if (record.state === 'withdrawn') fail(409, 'A withdrawn record is immutable. Register a new provider or connector profile.');
      Object.assign(record, {
        targetKind: c.targetKind,
        purpose: c.purpose,
        accessPurpose: c.accessPurpose,
        directions: c.directions,
        targetVersion: currentTarget.version,
        targetFingerprint: currentTarget.fingerprint,
        basis: c.basis,
        recipient: c.recipient,
        retentionRule: c.retentionRule,
        dataClasses: c.dataClasses,
        state: 'draft' as const,
        version: record.version + 1,
        updatedAt: now,
        updatedBy: actor.userId,
        reason: c.reason,
      });
      delete record.approval;
    } else {
      if (c.version !== 0) fail(409, 'No current data-flow record exists. Refresh before saving.');
      record = {
        id: uuid(),
        targetId: c.targetId,
        targetKind: c.targetKind,
        organisationId: state.organisation.id,
        purpose: c.purpose,
        accessPurpose: c.accessPurpose,
        directions: c.directions,
        targetVersion: currentTarget.version,
        targetFingerprint: currentTarget.fingerprint,
        basis: c.basis,
        recipient: c.recipient,
        retentionRule: c.retentionRule,
        dataClasses: c.dataClasses,
        state: 'draft',
        version: 1,
        createdAt: now,
        createdBy: actor.userId,
        updatedAt: now,
        updatedBy: actor.userId,
        reason: c.reason,
      };
      list.push(record);
    }
  } else {
    record = list.find(item => item.id === c.recordId)!;
    if (record.version !== c.version) fail(409, 'The data-flow record changed. Refresh before continuing.');
    if (c.type === 'dataFlowApprove') {
      if (record.state !== 'draft') fail(409, 'Only a current draft can be approved.');
      record.state = 'approved';
      record.approval = { by: actor.userId, at: now, reason: c.reason };
      delete record.withdrawn;
    } else {
      if (record.state === 'withdrawn') fail(409, 'This data-flow authority is already withdrawn.');
      record.state = 'withdrawn';
      record.withdrawn = { by: actor.userId, at: now, reason: c.reason };
    }
    record.version++;
    record.updatedAt = now;
    record.updatedBy = actor.userId;
    record.reason = c.reason;
  }
  const ops = state.operations!;
  ops.version++;
  ops.updatedAt = now;
  state.workspace.audit.push({
    id: uuid(), at: now, actorId: actor.userId, actor: actor.displayName, role: member.role,
    action: c.type, subject: record.targetId,
    detail: `Data-flow authority ${record.state}: purpose ${record.purpose} (${record.accessPurpose}); directions ${record.directions.join(',')}; responsible organisation ${record.organisationId}; basis ${record.basis.kind}/${record.basis.reference}; recipient ${record.recipient} (${record.targetId}); target ${record.targetFingerprint}; retention ${record.retentionRule}. ${c.reason}`,
  });
  return { recordId: record.id, targetId: record.targetId, state: record.state, version: record.version };
}
