import { z } from 'zod';
import { fail, uuid } from './core';

// SAHA-079 / BR-INT-08 + BR-INT-22: a bounded local contract for owner-authorised
// file and document hand-offs when an approved structured connector is unavailable.
// This module deliberately has no network transport. A prepared artefact is evidence
// of preparation only; destination acceptance requires a separately recorded receipt.

export const LEGACY_FORMATS = ['csv', 'hl7-v2', 'cda', 'json', 'pdf'] as const;
export type LegacyFormat = typeof LEGACY_FORMATS[number];
export type ExchangeState = 'prepared' | 'dispatched' | 'uncertain' | 'accepted' | 'rejected' | 'blocked';

export type LegacyAuthorisation = {
  id: string;
  version: number;
  active: boolean;
  ownerId: string;
  integrationUserId: string;
  purpose: string;
  destination: string;
  formats: LegacyFormat[];
  expiresAt: string;
};

export type SourceArtefact = {
  fileName: string;
  mediaType: string;
  content: string;
  sha256: string;
  bytes: number;
};

export type LegacyExport = {
  id: string;
  reconciliationId: string;
  authorisationId: string;
  authorisationVersion: number;
  actorId: string;
  purpose: string;
  destination: string;
  format: LegacyFormat;
  batchDelayMinutes: number;
  source: SourceArtefact;
  state: ExchangeState;
  preparedAt: string;
  dispatchedAt: string | null;
  receipt: string | null;
  message: string;
  events: { at: string; state: ExchangeState; detail: string }[];
};

export type ExtractedField = { path: string; value: string; confidence: number | null };
export type LegacyImport = {
  id: string;
  reconciliationId: string;
  authorisationId: string;
  authorisationVersion: number;
  actorId: string;
  purpose: string;
  sourceSystem: string;
  format: LegacyFormat;
  batchDelayMinutes: number;
  source: SourceArtefact;
  extractedFields: ExtractedField[];
  reviewerId: string;
  review: null | { decision: 'reviewed' | 'rejected'; by: string; at: string; reason: string };
  authoritative: false;
  writeback: 'unsupported';
  destinationReceipt: string | null;
  stagedAt: string;
};

const id = z.string().trim().min(1).max(200);
const purpose = z.string().trim().min(10).max(500);
const artefactSchema = z.object({
  fileName: z.string().trim().min(1).max(200).refine(x => !/[\\/\0]/.test(x), 'Use a file name without a path.'),
  mediaType: z.string().trim().min(3).max(100),
  content: z.string().max(1_000_000),
}).strict();
const fieldSchema = z.object({
  path: z.string().trim().min(1).max(200),
  value: z.string().max(10_000),
  confidence: z.number().min(0).max(1).nullable(),
}).strict();

export const prepareLegacyExportSchema = z.object({
  format: z.enum(LEGACY_FORMATS), destination: id, purpose,
  batchDelayMinutes: z.number().int().min(1).max(43_200), source: artefactSchema,
}).strict();
export const stageLegacyImportSchema = z.object({
  format: z.enum(LEGACY_FORMATS), sourceSystem: id, purpose,
  batchDelayMinutes: z.number().int().min(1).max(43_200), source: artefactSchema,
  extractedFields: z.array(fieldSchema).max(500), reviewerId: id,
}).strict();

function currentAuthorisation(a: LegacyAuthorisation, actorId: string, requestedPurpose: string, format: LegacyFormat, now: string, destination?: string) {
  if (!a.active || a.expiresAt <= now) fail(403, 'The owner authorisation is inactive or expired; no protected payload may leave.');
  if (a.integrationUserId !== actorId) fail(403, 'This integration user is not covered by the owner authorisation.');
  if (a.purpose !== requestedPurpose) fail(403, 'The requested purpose is not covered by the owner authorisation.');
  if (!a.formats.includes(format)) fail(403, 'This exchange format is not covered by the owner authorisation.');
  if (destination !== undefined && a.destination !== destination) fail(403, 'This destination is not covered by the owner authorisation.');
}

async function sourceArtefact(raw: z.infer<typeof artefactSchema>): Promise<SourceArtefact> {
  const encoded = new TextEncoder().encode(raw.content), bytes = encoded.length;
  if (!bytes) fail(422, 'The original artefact is empty.');
  if (bytes > 1_000_000) fail(413, 'The original artefact exceeds the 1 MB local exchange limit.');
  const hash = await crypto.subtle.digest('SHA-256', encoded);
  const sha256 = [...new Uint8Array(hash)].map(x => x.toString(16).padStart(2, '0')).join('');
  return { ...raw, bytes, sha256 };
}

export async function prepareLegacyExport(a: LegacyAuthorisation, actorId: string, raw: unknown, now = new Date().toISOString()): Promise<LegacyExport> {
  const parsed = prepareLegacyExportSchema.safeParse(raw);
  if (!parsed.success) fail(422, parsed.error.issues[0]?.message ?? 'Invalid file hand-off.');
  const x = parsed.data;
  currentAuthorisation(a, actorId, x.purpose, x.format, now, x.destination);
  const record: LegacyExport = {
    id: uuid(), reconciliationId: `LX-${uuid()}`, authorisationId: a.id, authorisationVersion: a.version,
    actorId, purpose: x.purpose, destination: x.destination, format: x.format,
    batchDelayMinutes: x.batchDelayMinutes, source: await sourceArtefact(x.source), state: 'prepared',
    preparedAt: now, dispatchedAt: null, receipt: null,
    message: `Prepared for batch hand-off; expected delay ${x.batchDelayMinutes} minute(s). Destination acceptance is not recorded.`, events: [],
  };
  record.events.push({ at: now, state: record.state, detail: record.message });
  return record;
}

// Called at the execution checkpoint. The caller must supply the current owner
// authorisation; a stale saved copy cannot authorise disclosure.
export function markLegacyDispatched(record: LegacyExport, current: LegacyAuthorisation, actorId: string, now = new Date().toISOString()): LegacyExport {
  if (record.state !== 'prepared') fail(409, 'Only a prepared hand-off can be dispatched; inspect its current receipt state.');
  try {
    if (current.id !== record.authorisationId || current.version !== record.authorisationVersion) fail(403, 'Owner authorisation changed after preparation.');
    currentAuthorisation(current, actorId, record.purpose, record.format, now, record.destination);
  } catch (error) {
    record.state = 'blocked';
    record.message = `${error instanceof Error ? error.message : 'Authorisation failed.'} Nothing was sent.`;
    record.events.push({ at: now, state: record.state, detail: record.message });
    return record;
  }
  record.state = 'dispatched'; record.dispatchedAt = now;
  record.message = 'Batch hand-off dispatched. Acceptance remains uncertain until a matching destination receipt is recorded.';
  record.events.push({ at: now, state: record.state, detail: record.message });
  return record;
}

export function recordLegacyReceipt(record: LegacyExport, raw: unknown, now = new Date().toISOString()): LegacyExport {
  const receipt = z.object({ reconciliationId: id, artefactSha256: z.string().regex(/^[a-f0-9]{64}$/), status: z.enum(['accepted', 'rejected', 'pending']), receipt: z.string().trim().min(1).max(500).optional() }).strict().safeParse(raw);
  if (!receipt.success) fail(422, 'The destination receipt is invalid.');
  if (!['dispatched', 'uncertain'].includes(record.state)) fail(409, 'A receipt can only resolve a dispatched or uncertain hand-off.');
  if (receipt.data.reconciliationId !== record.reconciliationId || receipt.data.artefactSha256 !== record.source.sha256) fail(409, 'The receipt does not match this reconciliation identifier and original artefact.');
  if (receipt.data.status === 'accepted' && !receipt.data.receipt) fail(422, 'Destination acceptance requires its receipt identifier.');
  record.state = receipt.data.status === 'accepted' ? 'accepted' : receipt.data.status === 'rejected' ? 'rejected' : 'uncertain';
  record.receipt = receipt.data.receipt ?? null;
  record.message = record.state === 'accepted' ? 'Destination acceptance recorded from a matching receipt.' : record.state === 'rejected' ? 'Destination rejected the hand-off.' : 'Destination outcome remains uncertain; reconcile by receipt and do not dispatch again.';
  record.events.push({ at: now, state: record.state, detail: record.message });
  return record;
}

export async function stageLegacyImport(a: LegacyAuthorisation, actorId: string, raw: unknown, now = new Date().toISOString()): Promise<LegacyImport> {
  const parsed = stageLegacyImportSchema.safeParse(raw);
  if (!parsed.success) fail(422, parsed.error.issues[0]?.message ?? 'Invalid document import.');
  const x = parsed.data;
  currentAuthorisation(a, actorId, x.purpose, x.format, now);
  return {
    id: uuid(), reconciliationId: `LI-${uuid()}`, authorisationId: a.id, authorisationVersion: a.version,
    actorId, purpose: x.purpose, sourceSystem: x.sourceSystem, format: x.format,
    batchDelayMinutes: x.batchDelayMinutes, source: await sourceArtefact(x.source), extractedFields: structuredClone(x.extractedFields),
    reviewerId: x.reviewerId, review: null, authoritative: false, writeback: 'unsupported', destinationReceipt: null, stagedAt: now,
  };
}

export function reviewLegacyImport(record: LegacyImport, reviewerId: string, decision: 'reviewed' | 'rejected', reason: string, now = new Date().toISOString()): LegacyImport {
  if (reviewerId !== record.reviewerId) fail(403, 'Only the named reviewer can review this extraction.');
  if (record.review) fail(409, 'This extraction already has a review decision; preserve it and stage a new revision.');
  if (reason.trim().length < 10 || reason.length > 1000) fail(422, 'Record a review reason of 10 to 1000 characters.');
  record.review = { decision, by: reviewerId, at: now, reason: reason.trim() };
  return record;
}

export function legacyWritebackUnavailable(record: LegacyImport): never {
  fail(409, `Writeback is unsupported for ${record.format} document exchange. Use a separately approved structured correction workflow.`);
}
