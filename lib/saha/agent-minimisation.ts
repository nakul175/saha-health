import { fail } from './core';
import { currentIdentifiers } from './types';
import type { OrgState } from './types';
// Slice R42: comprehensive minimisation of AI provider payloads (BR-AG-02, BR-AI-08, BR-INT-09).
//
// The mapped allowlist for the AI provider payloads is fixed here; nothing outside it may reach a provider.
// `checkAgentSource` runs before a request is prepared (prepareAgent) and again inside the external-execution
// checkpoint (executeAgent), refusing rather than sending when the source carries patient data that stripping
// cannot remove. `minimiseAgentPayload` walks a built provider payload, strips any field outside the allowlist
// and refuses when a field's value still leaks a patient identifier. This is an additive guard: the existing
// allowlists (FIELDS, OUTPUT_SCHEMA, INSTRUCTIONS and the MIS/EHR field mappings) are unchanged.

// The keys that may appear in an AI provider request envelope. `schema` (OpenAI) and `outputSchema` (HTTP)
// hold the static OUTPUT_SCHEMA constant and `instructions` the static INSTRUCTIONS constant; those values are
// pre-approved and carried by reference, not walked, so they can never introduce an unknown key.
export const PAYLOAD_KEYS: Readonly<Record<'openai' | 'http', ReadonlySet<string>>> = {
  openai: new Set(['model', 'store', 'max_output_tokens', 'instructions', 'input', 'text', 'format', 'type', 'name', 'strict', 'schema']),
  http: new Set(['contract', 'agentVersion', 'model', 'task', 'source', 'outputSchema', 'limits', 'maxOutputTokens', 'maxCalls', 'instructions']),
};
const STATIC_KEYS = new Set(['schema', 'outputSchema', 'instructions']);
export type MinimisationStage = 'prepare' | 'before-send' | 'checkpoint';
export type MinimisationCheck = { at: string; stage: MinimisationStage; passed: boolean; fields: number; stripped: string[]; problems: string[] };

// Every patient name, village, ABHA number (grouped and plain), ABHA address and current external identifier in
// the organisation, lowercased and trimmed. Anything in this set must never reach an AI provider. Internal record
// and visit ids are UUIDs and are left out: they are not meaningful to a provider and would only risk false
// refusals on free text, whereas names, villages, ABHA and crosswalk identifiers are the fields a provider must
// not receive.
export function collectSensitive(s: OrgState): Set<string> {
  const set = new Set<string>();
  const add = (v: unknown) => { if (typeof v === 'string') { const t = v.trim().toLowerCase(); if (t) set.add(t); } };
  for (const p of s.workspace.people ?? []) {
    if (p.name.trim().length >= 3) add(p.name);
    if (p.village.trim().length >= 3) add(p.village);
    if (p.abha?.number) { add(p.abha.number); add(p.abha.number.replace(/-/g, '')); }
    if (p.abha?.address) add(p.abha.address);
    for (const id of currentIdentifiers(p)) add(id.value);
  }
  return set;
}

// BR-AG-02 / BR-AI-08: refuse (rather than send) when the external-AI source still carries patient data that
// stripping cannot remove. Runs before the request is prepared and inside the execution checkpoint.
export function checkAgentSource(source: string, s: OrgState): void {
  const lower = source.toLowerCase();
  const hits: string[] = [];
  for (const v of collectSensitive(s)) if (lower.includes(v)) hits.push(v);
  if (hits.length) fail(422, `The external AI source still carries patient data that cannot be removed (${[...new Set(hits)].slice(0, 3).map(x => JSON.stringify(x)).join(', ')}). Remove it from the note or record the measurement manually.`);
}

// Walk a provider payload, strip anything outside the mapped allowlist, and refuse when a string value still
// matches a sensitive value (a field that cannot be reduced). Returns the reduced payload and the check record.
export function minimiseAgentPayload(payload: unknown, mode: 'openai' | 'http', sensitive: Set<string>, stage: MinimisationStage, at: string): { payload: unknown; check: MinimisationCheck } {
  const allowed = PAYLOAD_KEYS[mode];
  const stripped: string[] = [];
  const problems: string[] = [];
  let fields = 0;
  const walk = (x: unknown, path: string): unknown => {
    if (Array.isArray(x)) return x.map((y, i) => walk(y, `${path}[${i}]`));
    if (x && typeof x === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(x)) {
        fields++;
        const keyPath = path ? `${path}.${k}` : k;
        if (!allowed.has(k)) { stripped.push(keyPath); continue; }
        out[k] = STATIC_KEYS.has(k) ? v : walk(v, keyPath);
      }
      return out;
    }
    if (typeof x === 'string') { const lower = x.toLowerCase(); for (const v of sensitive) if (lower.includes(v)) problems.push(`${path || 'top level'} carries patient data "${v}".`); }
    return x;
  };
  const reduced = walk(payload, '');
  const check: MinimisationCheck = { at, stage, passed: problems.length === 0, fields, stripped, problems: [...new Set(problems)].slice(0, 20) };
  if (!check.passed) fail(409, `The AI provider payload failed the payload minimisation check: ${check.problems[0]} Nothing was sent.`);
  return { payload: reduced, check };
}
