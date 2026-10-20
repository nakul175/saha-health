import type { Role } from './types';

export const ACADEMY_CATALOGUE_ENV = 'SAHA_ACADEMY_CONTEXT_CATALOGUE';
export const ACADEMY_CATALOGUE_VERSION = 'saha-contextual-academy/1';
export type AcademyTask = 'routine-visit';
export type AcademyItem = {
  id: string;
  title: string;
  summary: string;
  content: string;
  task: AcademyTask;
  actorRoles: ('asha')[];
  source: { kind: 'aplyd-academy'; reference: string; edition: string; contentHash: string };
};
export type ContextualAcademy =
  | { status: 'available'; optional: true; requiresAdditionalLogin: false; careGate: false;
      completionTracking: 'none'; items: AcademyItem[] }
  | { status: 'unavailable'; optional: true; requiresAdditionalLogin: false; careGate: false;
      completionTracking: 'none'; reason: 'not-configured' | 'invalid-configuration' | 'no-eligible-content' };

const ID = /^[a-z0-9][a-z0-9-]{2,79}$/;
const SOURCE_REFERENCE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{2,199}$/;
const EDITION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
const HASH = /^[0-9a-f]{64}$/;
const own = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);
const exactKeys = (value: object, keys: readonly string[]) =>
  Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const text = (value: unknown, min: number, max: number) =>
  typeof value === 'string' && value.trim() === value && value.length >= min && value.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);

export async function academyContentHash(value: Omit<AcademyItem, 'source'> & { source: Omit<AcademyItem['source'], 'contentHash'> }) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const result = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(result), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function itemOf(value: unknown): Promise<AcademyItem | null> {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      !exactKeys(value, ['id', 'title', 'summary', 'content', 'task', 'actorRoles', 'source'])) return null;
  const record = value as Record<string, unknown>, source = record.source;
  if (!text(record.id, 3, 80) || !ID.test(record.id as string) ||
      !text(record.title, 3, 120) || !text(record.summary, 3, 300) || !text(record.content, 3, 4000) ||
      record.task !== 'routine-visit' || !Array.isArray(record.actorRoles) || record.actorRoles.length !== 1 || record.actorRoles[0] !== 'asha' ||
      !source || typeof source !== 'object' || Array.isArray(source) ||
      !exactKeys(source, ['kind', 'reference', 'edition', 'contentHash'])) return null;
  const sourceRecord = source as Record<string, unknown>;
  if (sourceRecord.kind !== 'aplyd-academy' || !text(sourceRecord.reference, 3, 200) ||
      !SOURCE_REFERENCE.test(sourceRecord.reference as string) || !text(sourceRecord.edition, 1, 80) ||
      !EDITION.test(sourceRecord.edition as string) || typeof sourceRecord.contentHash !== 'string' ||
      !HASH.test(sourceRecord.contentHash)) return null;
  const item = structuredClone(value) as AcademyItem;
  const { contentHash: _contentHash, ...sourceWithoutHash } = item.source;
  const expected = await academyContentHash({ ...item, source: sourceWithoutHash });
  return expected === item.source.contentHash ? item : null;
}

const unavailable = (reason: Extract<ContextualAcademy, { status: 'unavailable' }>['reason']): ContextualAcademy => ({
  status: 'unavailable', optional: true, requiresAdditionalLogin: false, careGate: false,
  completionTracking: 'none', reason,
});

export async function contextualAcademy(env: Record<string, string | undefined>, input: { task: AcademyTask; role: Role }): Promise<ContextualAcademy> {
  const raw = env[ACADEMY_CATALOGUE_ENV];
  if (raw === undefined || raw.trim() === '') return unavailable('not-configured');
  if (raw.length > 32768) return unavailable('invalid-configuration');
  let decoded: unknown;
  try { decoded = JSON.parse(raw); } catch { return unavailable('invalid-configuration'); }
  if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded) ||
      !exactKeys(decoded, ['version', 'items']) || (decoded as Record<string, unknown>).version !== ACADEMY_CATALOGUE_VERSION ||
      !Array.isArray((decoded as Record<string, unknown>).items) ||
      ((decoded as Record<string, unknown>).items as unknown[]).length > 12) return unavailable('invalid-configuration');
  const items: AcademyItem[] = [], ids = new Set<string>();
  for (const rawItem of (decoded as { items: unknown[] }).items) {
    const item = await itemOf(rawItem);
    if (!item || ids.has(item.id)) return unavailable('invalid-configuration');
    ids.add(item.id);
    if (item.task === input.task && item.actorRoles.includes(input.role as 'asha')) items.push(item);
  }
  if (!items.length) return unavailable('no-eligible-content');
  // Detach returned values from configuration input. The application does not
  // persist a view, infer completion, or send patient/task data to Academy.
  return { status: 'available', optional: true, requiresAdditionalLogin: false, careGate: false,
    completionTracking: 'none', items: structuredClone(items) };
}

export function academyConfigurationShape(value: unknown): boolean {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    own(value, 'version') && own(value, 'items');
}
