// Slice 14d (R90, BR-SEC-02): the organisation's consent notice registry.
//
// An organisation owner publishes the notice a person is shown before giving each optional permission recorded in the
// patient Permissions dialog: AI assistance and external record sharing. Each publication is a new version for its purpose,
// never an edit: its text in English and/or Hindi, the time it takes effect (now or within 90 days, never before the
// previous version), a summary of what changed, who reviewed the text, and whether the change is material. The registry is
// a list in the organisation's operations document; nothing in it is ever changed or removed.
//
// The version in force for a purpose is the highest version that has taken effect (core.ts noticeInForce). A permission is
// given under that version, named by the command with the language it was shown in (consent.ts grantTerms). When a material
// version takes effect, permissions given under earlier versions, and those recorded before any notice, stop authorising
// their purpose until they are renewed under the new one (core.ts consentStanding); a version that is not material leaves
// them in force. Every member's workspace carries the registry so the notice can be shown and the standing explained.
import { z } from 'zod';
import { NOTICE_PURPOSES, noticesOf, type ConsentNotice, type NoticePurpose } from './core';
import { PURPOSE_LABEL, authorizeConsent } from './consent';
import type { Member, OrgState } from './types';

export const MAX_NOTICE_VERSIONS = 20;
export const MIN_NOTICE_CHARS = 40;
export const MAX_NOTICE_CHARS = 1200;
export const MAX_EFFECTIVE_DAYS = 90;
// A requested start up to five minutes in the past (clock difference) takes effect at once.
const SKEW_MS = 5 * 60000;
// Line breaks are kept; other control and bidirectional-override characters are refused.
const text = z.string().trim().min(MIN_NOTICE_CHARS, `Write the notice in at least ${MIN_NOTICE_CHARS} characters.`).max(MAX_NOTICE_CHARS, `Keep the notice within ${MAX_NOTICE_CHARS} characters.`).regex(/^[^\u0000-\u0009\u000b-\u001f\u007f-\u009f‪-‮⁦-⁩]+$/, 'Remove control characters from the notice.');
export const consentNoticeSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('publishConsentNotice'), purpose: z.enum(NOTICE_PURPOSES as [NoticePurpose, ...NoticePurpose[]]), version: z.number().int().positive(),
    effectiveFrom: z.string().trim().min(10).max(40), material: z.boolean(),
    summary: z.string().trim().min(10, 'Say what changed in at least 10 characters.').max(500),
    review: z.string().trim().min(3, 'Name who reviewed the text, with a reference.').max(200),
    texts: z.object({ en: text.optional(), hi: text.optional() }).strict().refine(t => !!(t.en || t.hi), 'Give the notice text in English or Hindi.'),
  }).strict(),
]);
type Fail = (status: number, message: string) => never;
const LANGUAGES = { en: 'English', hi: 'Hindi' } as const;
const minute = (iso: string) => `${iso.slice(0, 16).replace('T', ' ')} UTC`;
/** The registry, oldest first, as every member's workspace carries it. */
export const noticesView = (s: Pick<OrgState, 'operations'>): ConsentNotice[] => [...noticesOf(s)].sort((a, b) => a.purpose.localeCompare(b.purpose) || a.version - b.version);
/** Owner command: publish the next notice version for a purpose. Returns null for any other command. */
export function applyConsentNotice(s: OrgState, input: unknown, u: { userId: string; displayName: string }, m: Member, fail: Fail, uuid: () => string, now = new Date().toISOString()) {
  if ((input as { type?: string } | null)?.type !== 'publishConsentNotice') return null;
  authorizeConsent(s, m, input);
  const parsed = consentNoticeSchema.safeParse(input); if (!parsed.success) fail(422, parsed.error.issues[0]?.message ?? 'Invalid consent notice.');
  const c = parsed.data, label = PURPOSE_LABEL[c.purpose], list = noticesOf(s), mine = list.filter(n => n.purpose === c.purpose);
  const latest = mine.reduce((v, n) => Math.max(v, n.version), 0), previous = mine.find(n => n.version === latest);
  if (c.version !== latest + 1) fail(409, `The ${label.toLowerCase()} notice is now at version ${latest}. Refresh and review it before publishing version ${latest + 1}.`);
  if (list.length >= MAX_NOTICE_VERSIONS) fail(422, `The notice registry holds at most ${MAX_NOTICE_VERSIONS} versions in this build.`);
  const t = Date.parse(c.effectiveFrom), at0 = Date.parse(now);
  if (!Number.isFinite(t)) fail(422, 'Give the date and time the notice takes effect.');
  if (t < at0 - SKEW_MS) fail(422, 'A notice cannot take effect in the past.');
  if (t > at0 + MAX_EFFECTIVE_DAYS * 86400000) fail(422, `Choose a time within the next ${MAX_EFFECTIVE_DAYS} days.`);
  const effectiveFrom = new Date(Math.max(t, at0)).toISOString();
  if (previous && effectiveFrom < previous.effectiveFrom) fail(422, `Version ${c.version} cannot take effect before version ${latest} (${minute(previous.effectiveFrom)}).`);
  const texts = { ...(c.texts.en ? { en: c.texts.en } : {}), ...(c.texts.hi ? { hi: c.texts.hi } : {}) };
  const notice: ConsentNotice = { id: uuid(), purpose: c.purpose, version: c.version, effectiveFrom, material: c.material, texts, summary: c.summary, review: c.review, publishedAt: now, publishedBy: u.userId, publishedByName: u.displayName };
  const ops = (s.operations ?? { version: 0, maintenance: false, reason: '', updatedAt: '', incidents: [], rates: null }) as NonNullable<OrgState['operations']> & { consentNotices?: ConsentNotice[] };
  ops.consentNotices = [...list, notice]; s.operations = ops;
  const langs = (Object.keys(texts) as (keyof typeof LANGUAGES)[]).map(k => LANGUAGES[k]).join(' and ');
  s.workspace.audit.push({ id: uuid(), at: now, actorId: u.userId, actor: u.displayName, role: m.role, action: c.type, subject: s.organisation.id,
    detail: `${label} notice version ${c.version} published (${langs}); takes effect ${minute(effectiveFrom)}. ${c.material ? 'Material change: permissions given under earlier versions stop authorising this purpose when it takes effect, until they are renewed.' : 'Not a material change: permissions given under earlier versions stay in force.'} What changed: ${c.summary} Reviewed: ${c.review}.` });
  return { noticeId: notice.id, purpose: notice.purpose, version: notice.version, effectiveFrom, material: notice.material };
}
