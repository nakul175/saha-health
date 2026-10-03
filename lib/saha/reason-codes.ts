// Slice r23: one versioned reason-code vocabulary that unifies the missing, refused, uncertain and
// absence reasons recorded for visit measurements (fact provenance sources) and programme answers
// (absence reasons). The existing free-text and boolean fields are unchanged; this module maps them
// onto a single stable coded vocabulary (BR-RULE-01, BR-DATA-02) so every downstream resource can
// carry the same code. Pure constants and mapping functions; no runtime imports, so any harness that
// transpiles `core` (or `fact-provenance`, `mis`, `fhir`, `fhir-document`) can list it without others.

export const REASON_CODE_SYSTEM = 'https://saha.example/reason-codes';
export const REASON_CODE_VERSION = '1.0.0';
export const REASON_CODE_RULESET = `saha-reason-codes-${REASON_CODE_VERSION}`;
export const REASON_CODE_STATUS = 'engineering placeholder — not clinically approved';

// The four semantic classes BR-RULE-01 requires to stay distinguishable across local records, model
// calls and outgoing submissions: missing, refused, uncertain and not-applicable.
export const REASON_CLASSES = ['missing', 'refused', 'uncertain', 'not-applicable'] as const;
export type ReasonClass = (typeof REASON_CLASSES)[number];

// The unified codes. Each code has a canonical display and one semantic class. `not-asked`, `declined`,
// `unknown` and `not-applicable` match the measurement provenance sources; `unable-to-obtain` is the
// programme absence reason "Unable to obtain". The programme absence reason "Not measured" maps to
// `not-asked` (class missing) and "Declined"/"Unknown" map to `declined`/`unknown` (see the maps below).
export const REASON_CODES = {
  'not-asked':        { code: 'not-asked',        display: 'Not asked',        class: 'missing' },
  declined:           { code: 'declined',         display: 'Declined',         class: 'refused' },
  unknown:            { code: 'unknown',          display: 'Unknown',          class: 'uncertain' },
  'not-applicable':   { code: 'not-applicable',   display: 'Not applicable',   class: 'not-applicable' },
  'unable-to-obtain': { code: 'unable-to-obtain', display: 'Unable to obtain', class: 'uncertain' },
} as const;
export type ReasonCode = keyof typeof REASON_CODES;

export type CodedReason = {
  system: string;
  version: string;
  code: ReasonCode;
  display: string;
  class: ReasonClass;
};

export function reasonFor(code: ReasonCode): CodedReason {
  const entry = REASON_CODES[code];
  return { system: REASON_CODE_SYSTEM, version: REASON_CODE_VERSION, code, display: entry.display, class: entry.class };
}

// Mapping from the existing free-text reason fields onto the coded vocabulary.
// Measurement provenance sources (fact-provenance.ts FACT_SOURCES): recorded values (measured/reported)
// are not reasons, so they map to null.
const SOURCE_TO_CODE: Record<string, ReasonCode | null> = {
  measured: null,
  reported: null,
  'not-asked': 'not-asked',
  declined: 'declined',
  unknown: 'unknown',
  'not-applicable': 'not-applicable',
};
// Programme answer absence reasons (programmes.ts ABSENCE).
const ABSENCE_TO_CODE: Record<string, ReasonCode | null> = {
  'Unknown': 'unknown',
  'Not measured': 'not-asked',
  'Declined': 'declined',
  'Unable to obtain': 'unable-to-obtain',
};

// Map one measurement provenance source to a coded reason; recorded sources (measured/reported) have none.
export function sourceReason(source: string | undefined | null): CodedReason | null {
  if (typeof source !== 'string') return null;
  const code = SOURCE_TO_CODE[source];
  return code ? reasonFor(code) : null;
}

// Map one programme answer absence reason to a coded reason; unknown/absent values have none.
export function absenceReason(absence: string | undefined | null): CodedReason | null {
  if (typeof absence !== 'string') return null;
  const code = ABSENCE_TO_CODE[absence];
  return code ? reasonFor(code) : null;
}

// Map any existing free-text reason field (a measurement source or a programme absence reason).
export function reasonForField(value: string | undefined | null): CodedReason | null {
  return sourceReason(value) ?? absenceReason(value);
}

// Classify a free-text reason field into one of BR-RULE-01's semantic classes.
export function reasonClass(value: string | undefined | null): ReasonClass | null {
  return reasonForField(value)?.class ?? null;
}

// A FHIR CodeableConcept coding entry for a reason (Observation.method / dataAbsentReason / note text).
export function reasonCoding(value: string | undefined | null): { system: string; code: string; display: string } | null {
  const r = reasonForField(value);
  return r ? { system: r.system, code: r.code, display: r.display } : null;
}

// A coded FHIR Observation.method for a recorded source; only a reported value carries a method, and the
// free-text method the exports already emit is kept alongside this coding (additive, never replaces it).
export function methodCoding(source: string | undefined | null): { coding: { system: string; code: string; display: string }[] } | undefined {
  if (source !== 'reported') return undefined;
  return { coding: [{ system: REASON_CODE_SYSTEM, code: 'reported', display: 'Reported by the person or carer; not measured during the visit' }] };
}

export type ReasonEntry = { field: string; code: ReasonCode; display: string; class: ReasonClass };

// Coded reasons for a facts provenance map: one entry per measurement whose source is a missing/refused/
// uncertain/not-applicable reason (recorded sources are never reasons).
export function provenanceReasonCodes(provenance: Record<string, { source?: string; at?: string } | undefined> | undefined): Record<string, CodedReason> {
  const out: Record<string, CodedReason> = {};
  for (const [key, entry] of Object.entries(provenance ?? {})) {
    if (!entry) continue;
    const r = sourceReason(entry.source);
    if (r) out[key] = r;
  }
  return out;
}

// Coded reasons for a programme answer absence map, keyed by question id.
export function absenceReasonCodes(absence: Record<string, string> | undefined): Record<string, CodedReason> {
  const out: Record<string, CodedReason> = {};
  for (const [key, value] of Object.entries(absence ?? {})) {
    const r = absenceReason(value);
    if (r) out[key] = r;
  }
  return out;
}

// The `reasons` section to merge into a MIS payload (contract saha-mis-v1): every blank measurement with
// a recorded reason is distinguishable downstream as missing, refused, uncertain or not-applicable. It is
// omitted when no measurement has a recorded reason, so existing payloads without provenance are unchanged.
export function misReasons(facts: { provenance?: Record<string, { source?: string; at?: string } | undefined> } | undefined): { system: string; version: string; status: string; entries: ReasonEntry[] } | undefined {
  const codes = provenanceReasonCodes(facts?.provenance);
  const entries = Object.entries(codes).map(([field, r]) => ({ field, code: r.code, display: r.display, class: r.class }));
  return entries.length ? { system: REASON_CODE_SYSTEM, version: REASON_CODE_VERSION, status: REASON_CODE_STATUS, entries } : undefined;
}

// One coded reason line to append to the demo summary (the existing free-text summary is unchanged).
export function summaryReasonCodes(facts: { provenance?: Record<string, { source?: string; at?: string } | undefined> } | undefined): string {
  const codes = provenanceReasonCodes(facts?.provenance);
  const parts = Object.entries(codes).map(([field, r]) => `${field}=${r.code} (${r.class})`);
  return parts.length ? `Reason codes (${REASON_CODE_RULESET}): ${parts.join(', ')}.` : '';
}
