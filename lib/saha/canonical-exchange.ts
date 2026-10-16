import { z } from 'zod';
import { fail, uuid } from './core';

// SAHA-082 / BR-INT-11: local, transport-free canonical exchange representation.
// Mapping produces reviewable payloads only. Dispatch remains a separate, authorised
// workflow, so a successful transformation cannot itself disclose protected data.

export const CANONICAL_KINDS = ['person', 'encounter', 'observation', 'condition', 'service-request', 'care-plan', 'medication', 'diagnostic-result', 'document', 'provenance'] as const;
export type CanonicalKind = typeof CANONICAL_KINDS[number];

export type ConfirmedSource = {
  system: string;
  recordId: string;
  revision: number;
  confirmedAt: string;
  confirmedBy: string;
  payload: unknown;
};

export type CanonicalRecord = {
  id: string;
  kind: CanonicalKind;
  revision: number;
  value: unknown;
  unit: string | null;
  source: ConfirmedSource;
  createdAt: string;
};

export type DestinationAuthority = {
  destinationId: string;
  actorId: string;
  purpose: string;
  active: boolean;
  version: number;
  expiresAt: string;
  allowedKinds: CanonicalKind[];
};

export type MappingDefinition = {
  destinationId: string;
  version: string;
  active: boolean;
  canonicalKind: CanonicalKind;
  sourceRevision: number;
  map: (record: Readonly<CanonicalRecord>) => unknown;
};

export type DestinationRepresentation = {
  id: string;
  canonicalRecordId: string;
  canonicalRevision: number;
  sourceSystem: string;
  sourceRecordId: string;
  sourceRevision: number;
  destinationId: string;
  authorityVersion: number;
  purpose: string;
  mappingVersion: string;
  payload: unknown;
  payloadSha256: string;
  state: 'mapped';
  createdAt: string;
};

const text = z.string().trim().min(1).max(200);
const sourceSchema = z.object({
  system: text,
  recordId: text,
  revision: z.number().int().positive(),
  confirmedAt: z.string().datetime(),
  confirmedBy: text,
  payload: z.unknown(),
}).strict();
const canonicalSchema = z.object({
  kind: z.enum(CANONICAL_KINDS),
  revision: z.number().int().positive(),
  value: z.unknown(),
  unit: z.string().trim().min(1).max(100).nullable(),
  source: sourceSchema,
}).strict();

const clone = <T>(value: T): T => structuredClone(value);
const canonicalJson = (value: unknown): string => Array.isArray(value)
  ? `[${value.map(canonicalJson).join(',')}]`
  : value !== null && typeof value === 'object'
    ? `{${Object.keys(value as object).sort().map(key => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`).join(',')}}`
    : JSON.stringify(value);
const sha256 = async (value: unknown): Promise<string> => {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalJson(value)));
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
};

export function createCanonicalRecord(raw: unknown, now = new Date().toISOString()): CanonicalRecord {
  const parsed = canonicalSchema.safeParse(raw);
  if (!parsed.success) fail(422, parsed.error.issues[0]?.message ?? 'Invalid canonical record.');
  if (!Object.prototype.hasOwnProperty.call(raw, 'value') || !Object.prototype.hasOwnProperty.call((raw as { source?: unknown }).source, 'payload')) fail(422, 'Canonical value and original source payload are required.');
  if (parsed.data.source.confirmedAt > now) fail(422, 'The source confirmation cannot be in the future.');
  return {
    id: uuid(), kind: parsed.data.kind, revision: parsed.data.revision,
    value: clone(parsed.data.value), unit: parsed.data.unit,
    source: { ...clone(parsed.data.source), payload: clone(parsed.data.source.payload) },
    createdAt: now,
  };
}

function authorize(record: CanonicalRecord, authority: DestinationAuthority, mapping: MappingDefinition, actorId: string, purpose: string, now: string) {
  if (!authority.active || authority.expiresAt <= now) fail(403, 'Destination authority is inactive or expired; no payload was produced.');
  if (authority.actorId !== actorId) fail(403, 'This actor lacks destination-specific mapping authority.');
  if (authority.purpose !== purpose) fail(403, 'The requested purpose is not authorised for this destination.');
  if (authority.destinationId !== mapping.destinationId) fail(403, 'The mapping destination is not authorised.');
  if (!authority.allowedKinds.includes(record.kind)) fail(403, 'This canonical record kind is not authorised for the destination.');
  if (!mapping.active) fail(409, 'The destination mapping is inactive; no payload was produced.');
  if (mapping.canonicalKind !== record.kind) fail(422, 'The mapping does not accept this canonical record kind.');
  if (mapping.sourceRevision !== record.revision) fail(409, 'The mapping targets a stale canonical revision; review a current mapping.');
}

export async function mapCanonicalRecord(record: CanonicalRecord, authority: DestinationAuthority, mapping: MappingDefinition, actorId: string, purpose: string, now = new Date().toISOString()): Promise<DestinationRepresentation> {
  authorize(record, authority, mapping, actorId, purpose, now);
  let payload: unknown;
  try { payload = mapping.map(clone(record)); }
  catch { fail(422, 'The destination transformation failed; the canonical record remains unchanged.'); }
  if (payload === undefined) fail(422, 'The destination transformation produced no payload.');
  const savedPayload = clone(payload);
  return {
    id: uuid(), canonicalRecordId: record.id, canonicalRevision: record.revision,
    sourceSystem: record.source.system, sourceRecordId: record.source.recordId, sourceRevision: record.source.revision,
    destinationId: mapping.destinationId, authorityVersion: authority.version, purpose,
    mappingVersion: mapping.version, payload: savedPayload, payloadSha256: await sha256(savedPayload),
    state: 'mapped', createdAt: now,
  };
}

export type MappingOutcome = { destinationId: string; representation?: DestinationRepresentation; error?: string };

// Destinations are isolated: one failed mapping is retained as a failure and cannot
// erase a successful sibling mapping or mutate the confirmed canonical source.
export async function mapCanonicalRecordToDestinations(record: CanonicalRecord, requests: { authority: DestinationAuthority; mapping: MappingDefinition }[], actorId: string, purpose: string, now = new Date().toISOString()): Promise<MappingOutcome[]> {
  const before = canonicalJson(record);
  const outcomes: MappingOutcome[] = [];
  for (const request of requests) {
    try { outcomes.push({ destinationId: request.mapping.destinationId, representation: await mapCanonicalRecord(record, request.authority, request.mapping, actorId, purpose, now) }); }
    catch (error) { outcomes.push({ destinationId: request.mapping.destinationId, error: error instanceof Error ? error.message : 'Mapping failed.' }); }
  }
  if (canonicalJson(record) !== before) fail(500, 'A destination mapping attempted to alter the confirmed canonical record.');
  return outcomes;
}

export function assertRepresentationCurrent(representation: DestinationRepresentation, record: CanonicalRecord, authority: DestinationAuthority, mapping: MappingDefinition, now = new Date().toISOString()): void {
  if (representation.canonicalRecordId !== record.id || representation.canonicalRevision !== record.revision) fail(409, 'The canonical record changed after mapping; prepare a new representation.');
  if (representation.sourceRevision !== record.source.revision) fail(409, 'The confirmed source revision changed after mapping.');
  if (!authority.active || authority.expiresAt <= now || representation.authorityVersion !== authority.version) fail(403, 'Destination authority changed after mapping; no payload may leave.');
  if (!mapping.active || representation.mappingVersion !== mapping.version || mapping.sourceRevision !== record.revision) fail(409, 'The destination mapping changed after preparation; prepare a new representation.');
}
