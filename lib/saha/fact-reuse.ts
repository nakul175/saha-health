import { z } from 'zod';
import { fail, uuid, visit } from './core';
import { MEASURES, MEASURE_LABEL, factProvenance, measureValue } from './fact-provenance';
import { openDisputes } from './send-gate';
import { isImported } from './types';
import type { Actor } from './store';
import type { Facts, Measure, Member, OrgState, ValueField } from './types';
// Slice R33 (BR-DATA-12): cross-visit reuse of recorded facts with provenance.
//
// A care worker building a new (draft) visit can reuse a measurement recorded on an earlier confirmed visit of the
// same person. The reused measurement carries its recorded source and observation time forward (its slice 2c
// provenance), so the new visit keeps the original fact's meaning and time rather than silently re-dating it to the
// new visit. Reuse is refused when the earlier measurement is disputed (an open dispute on its `fact:<measure>`
// target) or when the earlier visit is imported read-only history (slice 10i), so a disputed or imported value can
// never be silently carried into current care.
//
// This slice is additive: it adds one command type in the visit/fact path and does not change the existing
// single-visit fact handling (checkFacts, saveVisit, field sync and field registration are untouched).
const id = z.string().trim().min(1).max(200);
export const factReuseSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('reuseFact'), visitId: id, version: z.number().int().positive(), sourceVisitId: id, measure: z.enum(MEASURES) }).strict(),
]);
// The value fields each measurement occupies in a facts object (blood pressure is systolic and diastolic together).
export const FACT_FIELDS: Record<Measure, ValueField[]> = {
  bloodPressure: ['systolic', 'diastolic'],
  weight: ['weight'],
  temperature: ['temperature'],
  weeks: ['weeks'],
  coughDays: ['coughDays'],
};
// Drops any entered-unit or unusual-value reason a field carries so the reused value is re-validated cleanly by the
// ordinary save path on this visit (entered and unusual entries are not part of the carried provenance).
function clearField(f: Facts, field: string) {
  if (f.entered && Object.prototype.hasOwnProperty.call(f.entered, field)) { delete (f.entered as Record<string, unknown>)[field]; if (!Object.keys(f.entered).length) delete f.entered; }
  if (f.unusual && Object.prototype.hasOwnProperty.call(f.unusual, field)) { delete (f.unusual as Record<string, unknown>)[field]; if (!Object.keys(f.unusual).length) delete f.unusual; }
}
// Reuse one measurement: copy its value field(s) and its effective provenance (source and observation time, from the
// measurement's own entry or the source visit's level) onto the target facts. The target's date and notes are kept.
export function reusedMeasurement(source: Facts, target: Facts, measure: Measure): Facts {
  const next: Facts = structuredClone(target);
  const eff = factProvenance(source, measure);
  for (const field of FACT_FIELDS[measure]) { next[field] = source[field]; clearField(next, field); }
  next.provenance = { ...(next.provenance ?? {}), [measure]: { source: eff.source, at: eff.at } };
  return next;
}
export function applyFactReuse(state: OrgState, input: unknown, u: Actor, m: Member, now = new Date().toISOString()): any | null {
  const parsed = factReuseSchema.safeParse(input); if (!parsed.success) return null; const c = parsed.data, w = state.workspace;
  if (!['asha', 'clinician'].includes(m.role)) fail(403, 'A care role is required to reuse a recorded measurement.');
  const target = visit(w, c.visitId);
  if (target.version !== c.version) fail(409, 'This visit has changed. Refresh it before continuing.');
  if (target.state !== 'draft' || target.voidedAt || target.supersededBy) fail(409, 'Reuse a recorded measurement on a current draft visit.');
  if (c.sourceVisitId === c.visitId) fail(409, 'Reuse a measurement from an earlier, different visit.');
  const source = visit(w, c.sourceVisitId);
  if (source.personId !== target.personId) fail(409, 'Reuse a measurement from an earlier visit of the same person.');
  if (isImported(source)) fail(409, 'This measurement was imported from another system and is read-only. It cannot be reused; record it fresh on this visit.');
  if (source.state !== 'confirmed' || source.voidedAt || source.supersededBy) fail(409, 'Reuse a measurement from a current confirmed visit.');
  const label = MEASURE_LABEL[c.measure];
  if (!measureValue(source.facts, c.measure)) fail(422, `${label} was not recorded on the earlier visit.`);
  if (openDisputes(source).some(d => d.target === 'fact:' + c.measure)) fail(409, `${label} is disputed on the earlier visit. Resolve the dispute there before reusing it.`);
  target.facts = reusedMeasurement(source.facts, target.facts, c.measure);
  target.version++;
  w.audit.push({ id: uuid(), at: now, actor: u.displayName, actorId: u.userId, role: m.role, action: c.type, subject: target.id, personId: target.personId, detail: `${label} reused from an earlier confirmed visit (${source.id}); its recorded source and observation time are carried forward.` });
  return { measure: c.measure, sourceVisitId: source.id };
}
