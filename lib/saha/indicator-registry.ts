import { z } from 'zod';
import { fail, uuid } from './core';
import type { Actor } from './store';
import { PROGRAMMES, type Member, type OrgState } from './types';
import { AGE_BANDS, BUILT_IN_IDS, CADENCES, EXCLUSIONS, MEASURE_IDS, MIN_CELL, SEXES, registryRecords, type DefinitionRecord, type Spec } from './indicators';
// Slice 6s: an owner-maintained indicator registry (BR-REP-02). Definitions are added, revised and
// retired as append-only, versioned records with a reason; earlier versions are never changed, so a
// past result can be recomputed from the version it names. A definition is built only from the fixed
// vocabulary in indicators.ts: measures, cohort filters, exclusions and cadences.
const reason = z.string().trim().min(10, 'Write at least 10 characters.').max(300);
const id = z.string().regex(/^[a-z][a-z0-9-]{2,39}$/, 'Use 3 to 40 lowercase letters, digits and hyphens.');
const spec = z.object({
  title: z.string().trim().min(3).max(80), unit: z.enum(['count', 'proportion']),
  numerator: z.enum(MEASURE_IDS), denominator: z.enum(MEASURE_IDS).nullable(),
  filters: z.object({ programme: z.enum(PROGRAMMES as [string, ...string[]]).optional(), ageBand: z.enum(AGE_BANDS).optional(), sex: z.enum(SEXES).optional() }).strict(),
  exclude: z.array(z.enum(EXCLUSIONS)).max(EXCLUSIONS.length).refine(x => new Set(x).size === x.length, 'Choose each exclusion once.'),
  exclusionsNote: z.string().trim().max(200), owner: z.string().trim().min(2).max(60), cadence: z.enum(CADENCES),
  minimumCohort: z.number().int().min(MIN_CELL).max(1000),
}).strict();
export const indicatorRegistrySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('addIndicatorDefinition'), id, spec, reason }).strict(),
  z.object({ type: z.literal('reviseIndicatorDefinition'), id, expectedVersion: z.number().int().min(1), spec, reason }).strict(),
  z.object({ type: z.literal('retireIndicatorDefinition'), id, expectedVersion: z.number().int().min(1), reason }).strict(),
]);
const TYPES = new Set(['addIndicatorDefinition', 'reviseIndicatorDefinition', 'retireIndicatorDefinition']);
// Owners only, checked on first run and again when a saved command is replayed.
export function authorizeIndicatorRegistry(_s: OrgState, m: Member, c: { type: string }) {
  if (TYPES.has(c.type) && (m.status !== 'active' || !m.isOwner)) fail(403, 'Only an owner can maintain indicator definitions.');
}
function consistent(sp: Spec) {
  if (sp.unit === 'proportion' && !sp.denominator) fail(422, 'A proportion needs a denominator measure.');
  if (sp.unit === 'count' && sp.denominator) fail(422, 'A count has no denominator. Choose proportion or remove the denominator.');
  if (sp.denominator === sp.numerator) fail(422, 'Choose a denominator different from the numerator.');
}
export function applyIndicatorRegistry(s: OrgState, input: unknown, u: Actor, m: Member, now = new Date().toISOString()) {
  const parsed = indicatorRegistrySchema.safeParse(input);
  if (!parsed.success) { if (input && typeof input === 'object' && TYPES.has((input as any).type)) fail(422, parsed.error.issues[0]?.message ?? 'Check the definition.'); return null; }
  const c = parsed.data; authorizeIndicatorRegistry(s, m, c);
  const ops = s.operations ??= { version: 0, maintenance: false, reason: '', updatedAt: '', incidents: [], rates: null };
  const list: DefinitionRecord[] = ((ops as any).indicatorDefinitions ??= []);
  const versions = registryRecords(s).filter(r => r.id === c.id), latest = versions.reduce<DefinitionRecord | undefined>((a, r) => !a || r.version > a.version ? r : a, undefined);
  let record: DefinitionRecord;
  if (c.type === 'addIndicatorDefinition') {
    if (latest || BUILT_IN_IDS.includes(c.id)) fail(409, 'An indicator with this identifier already exists. Revise it instead.');
    consistent(c.spec as Spec);
    record = { id: c.id, version: 1, status: 'active', spec: c.spec as Spec, reason: c.reason, by: u.userId, byName: u.displayName, at: now };
  } else {
    if (!latest) fail(404, 'Indicator not found.');
    if (latest!.version !== c.expectedVersion) fail(409, 'This indicator changed. Refresh and review the latest version.');
    if (latest!.status === 'retired') fail(409, 'This indicator is retired. Add a new identifier instead.');
    const next = c.type === 'reviseIndicatorDefinition' ? c.spec as Spec : latest!.spec;
    if (c.type === 'reviseIndicatorDefinition') consistent(next);
    record = { id: c.id, version: latest!.version + 1, status: c.type === 'retireIndicatorDefinition' ? 'retired' : 'active', spec: next, reason: c.reason, by: u.userId, byName: u.displayName, at: now };
  }
  list.push(record);
  const verb = c.type === 'addIndicatorDefinition' ? 'added' : c.type === 'reviseIndicatorDefinition' ? 'revised' : 'retired';
  s.workspace.audit.push({ id: uuid(), at: now, actor: u.displayName, actorId: u.userId, role: m.role, action: 'indicatorDefinition', subject: c.id, detail: `Indicator definition ${c.id} ${verb} as version ${record.version}. Reason: ${c.reason}` });
  return { id: record.id, version: record.version, status: record.status };
}
