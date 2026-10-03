// Slice 12a: voice input on every text and number field (BR-UX-03, BR-DATA-03, BR-UX-08).
//
// A worker can tap a microphone beside any text or number box, speak once, review what was heard, and insert it. Nothing
// is inserted without that review, nothing listens in the background, and speech never saves anything by itself: the
// field is still part of an unsaved draft that the worker saves and confirms as before.
//
// Where the text comes from is the organisation's decision, recorded here:
// - On the device: the browser's speech recognition with `processLocally`, used whenever the browser reports the language
//   available on the device (desktop Chrome 139 and later at the time of writing; not Chrome on Android). Always allowed.
// - The browser's speech service: the same API without `processLocally`. On Android Chrome this sends the audio to Google.
//   It is off until an organisation owner turns it on (audited, versioned, with a reason), and it can be turned on only in
//   the synthetic and training environments, where every record is practice data. Using it with real patients needs a
//   data-protection decision this slice does not make.
//
// Nothing here imports the runtime: the server passes the environment, `fail` and `uuid`, and the client imports the pure
// helpers (`speechMode`, `spokenNumber`, `speechLanguage`, `voiceEligible`), so every harness can transpile this file alone.
import { z } from 'zod';
import type { Member, OrgState } from './types';

export const SPEECH_RULES_VERSION = '1.0.0';
// Environments in which the browser speech service may be allowed: practice data only (as slice 10b's simulator).
export const SPEECH_CLOUD_ENVIRONMENTS = ['synthetic', 'training'] as const;
export const MAX_SPEECH_POLICY_CHANGES = 200;
export type SpeechPolicyChange = { at: string; by: string; byName: string; cloudAllowed: boolean; reason: string };
export type SpeechPolicy = { cloudAllowed: boolean; version: number; changes: SpeechPolicyChange[] };
export type SpeechPolicyView = { cloudAllowed: boolean; version: number };

export const speechPolicySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('setSpeechPolicy'), cloudAllowed: z.boolean(), version: z.number().int().min(0), reason: z.string().trim().min(10, 'Write at least 10 characters.').max(500) }).strict(),
]);

export const speechPolicy = (s: Pick<OrgState, 'operations'>): SpeechPolicy => {
  const p = (s.operations as { speechPolicy?: SpeechPolicy } | undefined)?.speechPolicy;
  return p ? { cloudAllowed: !!p.cloudAllowed, version: p.version ?? 0, changes: p.changes ?? [] } : { cloudAllowed: false, version: 0, changes: [] };
};
/** What every member's workspace carries: whether the browser speech service may be used, and the version to change it. */
export const speechPolicyView = (s: Pick<OrgState, 'operations'>, environment: string): SpeechPolicyView => {
  const p = speechPolicy(s);
  return { cloudAllowed: p.cloudAllowed && cloudEnvironment(environment), version: p.version };
};
export const cloudEnvironment = (environment: string | undefined) => (SPEECH_CLOUD_ENVIRONMENTS as readonly string[]).includes(environment ?? '');

type Fail = (status: number, message: string) => never;
export function authorizeSpeechPolicy(m: Member, c: { type?: string }, fail: Fail) {
  if (c?.type !== 'setSpeechPolicy') return;
  if (!m.isOwner || m.status !== 'active') fail(403, 'Only an organisation owner can change how voice input turns speech into text.');
}
/** Owner command: allow or stop the browser speech service for this organisation. Returns null for any other command. */
export function applySpeechPolicy(s: OrgState, input: unknown, u: { userId: string; displayName: string }, m: Member, environment: string, fail: Fail, uuid: () => string, now = new Date().toISOString()): { cloudAllowed: boolean; version: number } | null {
  const parsed = speechPolicySchema.safeParse(input); if (!parsed.success) return null;
  const c = parsed.data; authorizeSpeechPolicy(m, c, fail);
  const old = speechPolicy(s);
  if (old.version !== c.version) fail(409, 'The voice input setting changed. Refresh before changing it.');
  if (old.cloudAllowed === c.cloudAllowed) fail(409, `The browser speech service is already ${c.cloudAllowed ? 'allowed' : 'off'}.`);
  if (c.cloudAllowed && !cloudEnvironment(environment)) fail(422, 'The browser speech service sends audio to the browser maker. It can be allowed only in the synthetic or training environment, where every record is practice data.');
  if (old.changes.length >= MAX_SPEECH_POLICY_CHANGES) fail(422, 'Voice input setting change limit reached.');
  const next: SpeechPolicy = { cloudAllowed: c.cloudAllowed, version: old.version + 1, changes: [...old.changes, { at: now, by: u.userId, byName: u.displayName, cloudAllowed: c.cloudAllowed, reason: c.reason }] };
  const ops = (s.operations ?? { version: 0, maintenance: false, reason: '', updatedAt: '', incidents: [], rates: null }) as NonNullable<OrgState['operations']> & { speechPolicy?: SpeechPolicy };
  ops.speechPolicy = next; s.operations = ops;
  s.workspace.audit.push({ id: uuid(), at: now, actorId: u.userId, actor: u.displayName, role: m.role, action: c.type, subject: s.organisation.id,
    detail: `Voice input: the browser speech service is ${c.cloudAllowed ? 'allowed (speech may be sent to the browser maker; practice data only)' : 'off (on-device speech only)'} (setting version ${next.version}). ${c.reason}` } as any);
  return { cloudAllowed: next.cloudAllowed, version: next.version };
}

// ---------- pure helpers shared by the workspace and its tests ----------
export type SpeechMode = { mode: 'local' | 'cloud' | 'none'; reason?: 'no-api' | 'offline' | 'cloud-off' };
/** Which recognizer to use. `local` is the on-device availability the browser reported for the language ('available',
 *  'downloadable', 'downloading', 'unavailable', or null when the browser has no on-device API). On-device wins whenever it
 *  is available; the browser service needs the setting, a practice environment and a network connection. */
export function speechMode(o: { hasApi: boolean; local: string | null; cloudAllowed: boolean; environment?: string; online: boolean }): SpeechMode {
  if (!o.hasApi) return { mode: 'none', reason: 'no-api' };
  if (o.local === 'available') return { mode: 'local' };
  if (!o.cloudAllowed || !cloudEnvironment(o.environment)) return { mode: 'none', reason: 'cloud-off' };
  if (!o.online) return { mode: 'none', reason: 'offline' };
  return { mode: 'cloud' };
}
export const speechLanguage = (lang: string | undefined) => lang === 'hi' ? 'hi-IN' : 'en-IN';
const DEVANAGARI = '०१२३४५६७८९';
/** The number a person said, for a number box: digits only (recognizers write numbers as digits), with Devanagari digits
 *  and spoken decimal points understood. Returns `others` when more than one number was heard, so the review can say so. */
export function spokenNumber(text: string): { value: string | null; others: string[] } {
  const t = String(text ?? '').replace(/[०-९]/g, d => String(DEVANAGARI.indexOf(d))).replace(/(\d)\s*(?:point|dot|दशमलव)\s*(\d)/gi, '$1.$2').replace(/(\d),(\d{3})\b/g, '$1$2');
  const all = t.match(/\d+(?:\.\d+)?/g) ?? [];
  return { value: all[0] ?? null, others: all.slice(1) };
}
/** Whether a field gets a microphone: text-like inputs and text areas that can be edited, never passwords, codes or files. */
export function voiceEligible(f: { tag: string; type?: string | null; readOnly?: boolean; disabled?: boolean; autocomplete?: string | null; voice?: string | null }): boolean {
  if (f.voice === 'off' || f.readOnly || f.disabled) return false;
  if (f.tag === 'textarea') return true;
  if (f.tag !== 'input') return false;
  if ((f.autocomplete ?? '').includes('one-time-code')) return false;
  return ['text', 'search', 'number', 'tel', ''].includes((f.type ?? 'text').toLowerCase());
}
/** Digits for an identifier or phone box: every digit heard, in order, with spaces and hyphens dropped. */
export function spokenDigits(text: string): string | null {
  const d = String(text ?? '').replace(/[०-९]/g, x => String(DEVANAGARI.indexOf(x))).replace(/\D/g, '');
  return d || null;
}
export type FieldKind = 'decimal' | 'digits' | 'text';
/** What a field takes: a measurement (`decimal`: the first number heard), an identifier or phone number (`digits`), or words. */
export function fieldKind(f: { type?: string | null; inputMode?: string | null }): FieldKind {
  const type = (f.type ?? '').toLowerCase(), mode = (f.inputMode ?? '').toLowerCase();
  if (type === 'tel' || mode === 'numeric' || mode === 'tel') return 'digits';
  if (type === 'number' || mode === 'decimal') return 'decimal';
  return 'text';
}
/** Text to put in the field: a number or digits replace the box's value; words are added after any text already there. */
export function insertion(current: string, heard: string, kind: FieldKind): string | null {
  const h = String(heard ?? '').trim(); if (!h) return null;
  if (kind === 'decimal') return spokenNumber(h).value;
  if (kind === 'digits') return spokenDigits(h);
  const c = String(current ?? ''); return c.trim() ? `${c.replace(/\s+$/, '')} ${h}` : h;
}
