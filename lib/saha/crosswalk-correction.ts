import { z } from 'zod';
import { digest, fail, person, uuid } from './core';
import { normallyAllowed } from './access';
import { stewardRole } from './merge';
import { checkIdentifier, MAX_ENTRIES, ORIGINS, VERIFICATIONS } from './crosswalk';
import { KNOWN_ISSUERS } from './record-import';
import { operationRefusal } from './adapter-operations';
import { currentIdentifiers, identifierRef } from './types';
import type { Actor } from './store';
import type { ExternalIdentifier, Integration, Member, OrgState, Person } from './types';

// Slice r17: correction of imported identifiers and destination-specific identifier correction through the
// approval path (BR-ID-08, BR-DATA-11). This builds on the slice 10e append-only crosswalk ledger and the slice 7g
// aggregate-report approval pattern. `identifierLink` and `identifierWithdraw` are unchanged; this module adds a
// separate, destination-scoped correction that a care worker prepares, a different authorised person approves and
// one of them then sends, so nothing is ever corrected at a destination automatically.
//
// - The crosswalk ledger is extended so an imported identifier (source 'import', slice 2h) can be corrected with
//   provenance. `prepareIdentifierCorrection` appends a 'correct' or 'withdraw' entry that names the entry it
//   replaces (its id, or `import:<batch>:<row>` for an imported entry) and records who, when, origin, verification
//   state and evidence. The earlier entry is never edited or removed; `currentIdentifiers` then holds only the new
//   value, so slice 2h matching and search follow the corrected value exactly as after an `identifierLink`.
// - A correction that must also reach a destination is routed through the existing approval/execution pattern
//   (prepare -> approve -> send -> lookup), mirroring aggregate delivery: prepare records the local ledger entry and
//   a `prepared` correction bound to one demonstration programme destination; approve needs a different authorised
//   person and a matching payload hash; send (by the preparer or approver, inside the approval window) and lookup go
//   through a deterministic in-process simulator and never retry automatically. A destination without correction
//   support or without the `update` operation is refused before anything is prepared or sent.
export const CROSSWALK_CORRECTION_CONTRACT = 'saha-crosswalk-correction-v1';
export const IDENTIFIER_APPROVAL_HOURS = 24;
export const CORRECTION_LIMIT = 20;
export const CORRECTION_OPEN_STATES = ['prepared', 'approved', 'sending', 'uncertain'] as const;
export const CORRECTION_TYPES = new Set(['prepareIdentifierCorrection', 'approveIdentifierCorrection', 'sendIdentifierCorrection', 'lookupIdentifierCorrection']);

export type CrosswalkCorrectionPayload = {
  contract: typeof CROSSWALK_CORRECTION_CONTRACT;
  environment: 'synthetic';
  operation: 'correct' | 'withdraw';
  personId: string;
  issuer: string;
  identifier: string; // the value to write at the destination (corrected value, or the value being withdrawn)
  corrects: string; // the entry reference being replaced
};

export type CrosswalkCorrectionEvent = { at: string; state: string; detail: string };

export type CrosswalkCorrection = {
  id: string;
  personId: string;
  destinationId: string;
  destinationName: string;
  issuer: string;
  corrects: string; // the entry reference corrected (id, or import:<batch>:<row>)
  entryId: string; // the new local ledger entry appended by the correction
  withdrawn: boolean;
  state: 'prepared' | 'approved' | 'sending' | 'accepted' | 'rejected' | 'uncertain' | 'cancelled';
  preparedBy: string;
  preparedByName: string;
  preparedAt: string;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  expiresAt?: string;
  payload?: CrosswalkCorrectionPayload;
  payloadSha256: string;
  attempts: number;
  receipt?: string;
  events: CrosswalkCorrectionEvent[];
  message: string;
  updatedAt: string;
};

const id = z.string().trim().min(1).max(200);
const reason = z.string().trim().min(10, 'Explain the reason in at least 10 characters.').max(500);
export const crosswalkCorrectionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('prepareIdentifierCorrection'), personId: id, version: z.number().int().positive(),
    issuer: z.string().trim().toLowerCase().min(1).max(32), corrects: id,
    identifier: z.string().trim().min(1).max(64).optional(), withdraw: z.literal(true).optional(),
    origin: z.enum(ORIGINS), verification: z.enum(VERIFICATIONS),
    evidence: z.string().trim().min(3, 'Describe the evidence in at least 3 characters.').max(200).optional(),
    destinationId: id, reason,
  }).strict(),
  z.object({ type: z.literal('approveIdentifierCorrection'), correctionId: id, payloadSha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
  z.object({ type: z.literal('sendIdentifierCorrection'), correctionId: id }).strict(),
  z.object({ type: z.literal('lookupIdentifierCorrection'), correctionId: id }).strict(),
]);
export type CrosswalkCorrectionCommand = z.infer<typeof crosswalkCorrectionSchema>;

// Corrections live in the operations document beside the aggregate reports (slice 7g) and indicator ledger, so no
// migration is added. They are organisation-wide records, not patient-partitioned, because a correction is prepared
// against a destination's integration.
export const correctionsOf = (s: OrgState): CrosswalkCorrection[] => ((s.operations as any)?.crosswalkCorrections ?? []) as CrosswalkCorrection[];
const storeCorrections = (s: OrgState): CrosswalkCorrection[] => { const ops = (s.operations ??= { version: 0, maintenance: false, reason: '', updatedAt: '', incidents: [], rates: null }) as any; return (ops.crosswalkCorrections ??= []); };
export function findCorrection(s: OrgState, correctionId: string): CrosswalkCorrection {
  const c = correctionsOf(s).find(x => x.id === correctionId); if (!c) fail(404, 'Identifier correction not found.'); return c!;
}

// Open corrections of one person: the downstream repair list a corrected link generates (FR-ID-08). It names the
// destination, issuer and state, never the identifier value, and feeds the action plan and exception queue.
export function identifierRepairs(s: OrgState, personId: string): CrosswalkCorrection[] {
  return correctionsOf(s).filter(c => c.personId === personId && (CORRECTION_OPEN_STATES as readonly string[]).includes(c.state));
}

const maskValue = (v: string) => (v.length > 4 ? 'X'.repeat(v.length - 4) + v.slice(-4) : 'X'.repeat(v.length));
const care = (m: Member) => m.status === 'active' && ['asha', 'clinician', 'supervisor'].includes(m.role);

export function authorizeCrosswalkCorrection(_s: OrgState, m: Member, c: any) {
  if (!CORRECTION_TYPES.has(c?.type)) return;
  if (!care(m)) fail(403, 'A care role with access to the patient is required to correct an identifier at a destination.');
  if (c.type === 'prepareIdentifierCorrection') {
    if (c.withdraw && !stewardRole(m)) fail(403, 'A clinician or supervisor withdraws an identifier at a destination.');
    if (c.verification === 'issuer-checked' && !stewardRole(m)) fail(403, 'A clinician or supervisor records an identifier as checked with its issuer.');
  }
}

// The destination a correction may reach: an active demonstration programme connection with correction support and the
// `update` operation. HTTP crosswalk correction needs a partner contract and stays refused (as in slice 7g).
export function correctionDestination(s: OrgState, destinationId: string): Integration {
  const i = s.workspace.integrations.find(x => x.id === destinationId);
  if (!i || i.kind !== 'mis') fail(422, 'Choose a programme destination.');
  if (i.mode !== 'demo') fail(409, 'Identifier corrections go to demonstration programme destinations in this release. Sending a corrected identifier to an HTTP destination needs a crosswalk contract agreed with the partner.');
  if (i.status !== 'active') fail(409, `${i.name} is not active.`);
  if (!i.mis?.corrections) fail(409, `${i.name} has not enabled correction support.`);
  const refusal = operationRefusal(i, 'update', 'patient');
  if (refusal) fail(409, refusal);
  return i;
}

// Canonical JSON (sorted keys) so the payload SHA-256 is stable whatever order the fields were built in.
const canonical = (v: unknown): string => Array.isArray(v) ? `[${v.map(canonical).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v as object).sort().map(k => `${JSON.stringify(k)}:${canonical((v as any)[k])}`).join(',')}}` : JSON.stringify(v);

export async function applyCrosswalkCorrection(s: OrgState, input: unknown, u: Actor, m: Member, now = new Date().toISOString()): Promise<any | null> {
  const parsed = crosswalkCorrectionSchema.safeParse(input); if (!parsed.success) return null;
  const c = parsed.data;
  authorizeCrosswalkCorrection(s, m, c);
  // Close expired open corrections before acting, so the limit counts live work only and stale payloads are dropped.
  compactCorrections(s, now);
  if (c.type === 'prepareIdentifierCorrection') return prepare(s, c, u, m, now);
  const corr = findCorrection(s, c.correctionId);
  if (c.type === 'approveIdentifierCorrection') return approve(s, corr, c, u, m, now);
  if (c.type === 'sendIdentifierCorrection') return send(s, corr, u, m, now);
  return lookup(s, corr, u, m, now);
}

type Prepare = Extract<CrosswalkCorrectionCommand, { type: 'prepareIdentifierCorrection' }>;

function appendLedgerEntry(s: OrgState, p: Person, c: Prepare, u: Actor, now: string): ExternalIdentifier & { id: string } {
  const ledger = p.identifiers ?? [], own = currentIdentifiers(p).filter(e => e.issuer === c.issuer);
  const target = own.find(e => identifierRef(e) === c.corrects);
  if (!target) fail(404, `No current ${KNOWN_ISSUERS[c.issuer]?.label ?? c.issuer} on this record has that reference.`);
  if (ledger.length >= MAX_ENTRIES) fail(422, `This record already has ${MAX_ENTRIES} identifier entries; ask an owner to review the record.`);
  let entry: ExternalIdentifier & { id: string };
  if (c.withdraw) {
    entry = { id: uuid(), kind: 'withdraw', corrects: c.corrects, issuer: target.issuer, value: target.value, verified: false, recordedAt: now, recordedBy: u.userId, source: 'crosswalk', reason: c.reason };
  } else {
    const value = c.identifier!; checkIdentifier(c.issuer, value);
    if (c.verification !== 'unverified' && !c.evidence) fail(422, 'Describe the evidence (for example "RCH card sighted at the home visit") when an identifier is recorded as seen or checked.');
    entry = { id: uuid(), kind: 'correct', corrects: c.corrects, issuer: c.issuer, value, verified: c.verification === 'issuer-checked', recordedAt: now, recordedBy: u.userId, source: 'crosswalk', origin: c.origin, verification: c.verification, ...(c.evidence ? { evidence: c.evidence } : {}), reason: c.reason };
  }
  p.identifiers = [...ledger, entry];
  return entry;
}

async function prepare(s: OrgState, c: Prepare, u: Actor, m: Member, now: string) {
  const w = s.workspace, p = person(w, c.personId);
  if (p.version !== c.version) fail(409, 'This record changed. Refresh before continuing.');
  if (!normallyAllowed(m, p)) fail(403, 'A care role with normal access to the patient is required to correct an identifier at a destination.');
  if (p.mergedInto && !c.withdraw) fail(409, 'This record was merged into another record. Record identifiers on the surviving record.');
  if (correctionsOf(s).filter(x => x.personId === p.id && (CORRECTION_OPEN_STATES as readonly string[]).includes(x.state)).length >= CORRECTION_LIMIT) fail(422, `This person has ${CORRECTION_LIMIT} open identifier corrections. Approve, send or cancel them first.`);
  const entry = appendLedgerEntry(s, p, c, u, now);
  const i = correctionDestination(s, c.destinationId);
  const label = KNOWN_ISSUERS[c.issuer]?.label ?? c.issuer;
  const value = entry.value;
  const payload: CrosswalkCorrectionPayload = { contract: CROSSWALK_CORRECTION_CONTRACT, environment: 'synthetic', operation: c.withdraw ? 'withdraw' : 'correct', personId: p.id, issuer: c.issuer, identifier: value, corrects: c.corrects };
  const corr: CrosswalkCorrection = { id: uuid(), personId: p.id, destinationId: i.id, destinationName: i.name, issuer: c.issuer, corrects: c.corrects, entryId: entry.id, withdrawn: !!c.withdraw, state: 'prepared', preparedBy: u.userId, preparedByName: u.displayName, preparedAt: now, payload, payloadSha256: await digest(canonical(payload)), attempts: 0, events: [{ at: now, state: 'prepared', detail: `Prepared by ${u.displayName}. A different authorised person must approve it within ${IDENTIFIER_APPROVAL_HOURS} hours, then the preparer or approver sends it. Nothing is sent automatically.` }], message: '', updatedAt: now };
  storeCorrections(s).push(corr);
  w.audit.push({ id: uuid(), at: now, actorId: u.userId, actor: u.displayName, role: m.role, action: c.type, subject: p.id, personId: p.id, detail: `${label} ${maskValue(value)} ${c.withdraw ? 'withdrawn' : 'recorded as a correction'} at ${i.name}; the earlier entry is kept in its history and a destination correction ${corr.id} was prepared for approval. Not verified by Saha. Reason: ${c.reason}` });
  return { correctionId: corr.id, state: corr.state, payloadSha256: corr.payloadSha256, entryId: entry.id, current: currentIdentifiers(p).length, destination: i.name };
}

function recheckDestination(s: OrgState, corr: CrosswalkCorrection) {
  return correctionDestination(s, corr.destinationId);
}

function approve(s: OrgState, corr: CrosswalkCorrection, c: Extract<CrosswalkCorrectionCommand, { type: 'approveIdentifierCorrection' }>, u: Actor, m: Member, now: string) {
  if (corr.state !== 'prepared') fail(409, 'Only a prepared correction can be approved.');
  if (Date.parse(corr.preparedAt) + IDENTIFIER_APPROVAL_HOURS * 3600000 < Date.parse(now)) fail(409, `This correction was prepared more than ${IDENTIFIER_APPROVAL_HOURS} hours ago and has expired. Prepare a new one.`);
  if (corr.preparedBy === u.userId) fail(403, 'A different authorised person must approve this correction.');
  if (corr.payloadSha256 !== c.payloadSha256) fail(409, 'The correction is not the one you reviewed. Refresh and review it again.');
  recheckDestination(s, corr);
  corr.state = 'approved'; corr.approvedBy = u.userId; corr.approvedByName = u.displayName; corr.approvedAt = now; corr.expiresAt = new Date(Date.parse(now) + IDENTIFIER_APPROVAL_HOURS * 3600000).toISOString();
  corr.events.push({ at: now, state: 'approved', detail: `Approved by ${u.displayName}. Send within ${IDENTIFIER_APPROVAL_HOURS} hours; the preparer or the approver may send it.` });
  s.workspace.audit.push({ id: uuid(), at: now, actorId: u.userId, actor: u.displayName, role: m.role, action: c.type, subject: corr.id, personId: corr.personId, detail: `Identifier correction ${corr.id} for ${corr.destinationName} approved (SHA-256 ${corr.payloadSha256}).` });
  return { correctionId: corr.id, state: corr.state, expiresAt: corr.expiresAt };
}

function send(s: OrgState, corr: CrosswalkCorrection, u: Actor, m: Member, now: string): any {
  if (corr.state === 'accepted') return { correctionId: corr.id, state: corr.state };
  if (corr.state !== 'approved') fail(409, 'A current approval is required before sending.');
  if ((corr.preparedBy !== u.userId && corr.approvedBy !== u.userId)) fail(403, 'The preparer or the approver sends this correction.');
  if (!corr.expiresAt || corr.expiresAt < now) fail(409, 'This approval has expired. Prepare a new correction.');
  const i = recheckDestination(s, corr);
  corr.state = 'sending'; corr.attempts++; corr.events.push({ at: now, state: 'sending', detail: 'Sending to the demonstration destination.' });
  let raw: unknown;
  try { raw = demoCorrectionTransport(i, corr, false); } catch { corr.state = 'uncertain'; corr.events.push({ at: now, state: 'uncertain', detail: 'The destination response was lost. Look up the receipt; do not resend.' }); s.workspace.audit.push({ id: uuid(), at: now, actorId: u.userId, actor: u.displayName, role: m.role, action: 'sendIdentifierCorrection', subject: corr.id, personId: corr.personId, detail: `Identifier correction ${corr.id} for ${corr.destinationName}: response lost; outcome unknown.` }); return { correctionId: corr.id, state: corr.state }; }
  applyReceipt(corr, raw, false, now);
  s.workspace.audit.push({ id: uuid(), at: now, actorId: u.userId, actor: u.displayName, role: m.role, action: 'sendIdentifierCorrection', subject: corr.id, personId: corr.personId, detail: `Identifier correction ${corr.id} sent to ${corr.destinationName}${corr.receipt ? `: receipt ${corr.receipt}` : ''}.` });
  return { correctionId: corr.id, state: corr.state, receipt: corr.receipt };
}

function lookup(s: OrgState, corr: CrosswalkCorrection, u: Actor, m: Member, now: string): any {
  if (corr.state === 'accepted') return { correctionId: corr.id, state: corr.state };
  const i = recheckDestination(s, corr);
  applyReceipt(corr, demoCorrectionTransport(i, corr, true), true, now);
  s.workspace.audit.push({ id: uuid(), at: now, actorId: u.userId, actor: u.displayName, role: m.role, action: 'lookupIdentifierCorrection', subject: corr.id, personId: corr.personId, detail: `Identifier correction ${corr.id} outcome looked up at ${corr.destinationName}: ${corr.state}${corr.receipt ? ` (receipt ${corr.receipt})` : ''}. Nothing was resent.` });
  return { correctionId: corr.id, state: corr.state, receipt: corr.receipt };
}

const correctionReceiptSchema = z.object({ contract: z.literal(CROSSWALK_CORRECTION_CONTRACT), key: id, payloadHash: z.string().regex(/^[a-f0-9]{64}$/), status: z.enum(['accepted', 'rejected', 'pending', 'not_found']), receipt: z.string().min(1).max(200).optional() }).strict();

export function applyReceipt(corr: CrosswalkCorrection, raw: unknown, lookupOnly: boolean, now: string) {
  const p = correctionReceiptSchema.safeParse(raw); if (!p.success) fail(502, 'The destination response did not match the crosswalk correction receipt contract.');
  const r = p.data;
  if (r.key !== corr.id || r.payloadHash !== corr.payloadSha256) fail(502, 'The destination receipt names a different correction.');
  if (r.status === 'not_found' && !lookupOnly) fail(502, 'Only a receipt lookup can confirm that a correction was not found.');
  corr.state = r.status === 'accepted' ? 'accepted' : r.status === 'rejected' ? 'rejected' : 'uncertain'; if (r.receipt) corr.receipt = r.receipt;
  corr.events.push({ at: now, state: corr.state, detail: r.status === 'accepted' ? `Destination confirmed receipt ${r.receipt ?? ''}${lookupOnly ? ' by lookup; the correction was not sent again' : ''}.` : r.status === 'rejected' ? 'Destination rejected this correction. Prepare a new one if it is still needed.' : r.status === 'not_found' ? 'Destination has no correction under this key. The outcome stays unresolved; contact the destination.' : 'Destination is still processing. Look up the receipt; do not resend.' });
  if (!(CORRECTION_OPEN_STATES as readonly string[]).includes(corr.state)) delete (corr as any).payload;
}

// The client-facing view: never the raw identifier value. `corrects` (an entry id or `import:<batch>:<row>`) is a
// reference, not a value, so it stays visible so the correction can be audited and the earlier entry opened.
export function correctionView(c: CrosswalkCorrection) {
  const { payload, ...rest } = c as CrosswalkCorrection & { payload?: CrosswalkCorrectionPayload };
  return { ...rest, value: payload ? maskValue(payload.identifier) : null };
}

// Closes expired open corrections and removes the payload from closed ones (as slice 6ad does for reports).
export function compactCorrections(s: OrgState, now: string) {
  const t = Date.parse(now), window = IDENTIFIER_APPROVAL_HOURS * 3600000, closed: CrosswalkCorrection[] = [];
  for (const c of correctionsOf(s)) {
    if (c.state === 'prepared' && Date.parse(c.preparedAt) + window < t) { c.state = 'cancelled'; c.events.push({ at: now, state: 'cancelled', detail: `Expired: not approved within ${IDENTIFIER_APPROVAL_HOURS} hours. Nothing was sent.` }); closed.push(c); }
    else if (c.state === 'approved' && (!c.expiresAt || c.expiresAt < now)) { c.state = 'cancelled'; c.events.push({ at: now, state: 'cancelled', detail: `Expired: not sent within ${IDENTIFIER_APPROVAL_HOURS} hours of approval. Nothing was sent.` }); closed.push(c); }
    if (!(CORRECTION_OPEN_STATES as readonly string[]).includes(c.state)) delete (c as any).payload;
  }
  return closed;
}

// A deterministic in-process simulator for the demonstration destination, as for aggregate delivery (slice 7g). A
// destination with behaviour "uncertain" loses the first send (its response is dropped); a lookup then finds the
// receipt without the correction being sent again.
export function demoCorrectionTransport(i: Integration, corr: CrosswalkCorrection, lookupOnly: boolean): unknown {
  const receipt = `IDC-${corr.id.replace(/[^0-9a-f]/g, '').slice(-8).toUpperCase() || '00000000'}`;
  if (lookupOnly) return { contract: CROSSWALK_CORRECTION_CONTRACT, key: corr.id, payloadHash: corr.payloadSha256, status: 'accepted', receipt };
  if (i.behavior === 'uncertain') throw new Error('Simulated lost response.');
  return { contract: CROSSWALK_CORRECTION_CONTRACT, key: corr.id, payloadHash: corr.payloadSha256, status: 'accepted', receipt };
}
