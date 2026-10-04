'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CONSENT_PERIOD_DAYS, NOTICE_PURPOSES, consentStanding, noticeInForce, type ConsentStanding, type NoticeLanguage, type NoticePurpose } from '@/lib/saha/core';
import { MAX_EFFECTIVE_DAYS, MAX_NOTICE_CHARS, MAX_NOTICE_VERSIONS, MIN_NOTICE_CHARS } from '@/lib/saha/consent-notices';
import type { ConsentPurpose } from '@/lib/saha/consent';
import type { Person, Snapshot } from '@/lib/saha/types';
import { EnglishOnly, useI18n } from './i18n';
type Command = (c: any, s?: string) => Promise<any>;
// Slice 14d (R90, BR-SEC-02): notice versions and permission expiry on screen. The server decides every standing again
// when a permission is used (lib/saha/core.ts consentStanding); this view uses the same rules on the workspace snapshot.
const LABEL: Record<ConsentPurpose, string> = { ai: 'Optional AI assistance', exchange: 'External record sharing', contact: 'Automated contact' };
const LANGUAGE: Record<NoticeLanguage, string> = { en: 'English', hi: 'Hindi' };
const day = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
const when = (iso: string) => `${iso.slice(0, 16).replace('T', ' ')} UTC`;
const notices = (data: Snapshot) => data.consentNotices ?? [];
const lapsed = (st: ConsentStanding) => st.state === 'expired' || st.state === 'renewal-needed';
/** One line describing where a permission stands now. */
export function standingText(st: ConsentStanding) {
  if (st.state === 'not-granted') return 'Not given.';
  if (st.state === 'expired') return `Expired on ${day(st.since)}. It no longer allows this use; renew it with the person.`;
  if (st.state === 'renewal-needed') return `Needs renewal: a material notice change took effect on ${day(st.since)}${st.current ? ` (the current notice is version ${st.current.version})` : ''}. It no longer allows this use until the person is shown the current notice and agrees again.`;
  if (!st.expiresAt) return 'In force. Recorded before notice versions and expiry were kept, so it has no recorded notice or end date.';
  const under = st.notice ? `, given under notice version ${st.notice.version} (${LANGUAGE[st.notice.language]})` : st.purpose === 'contact' ? '' : '; no notice was published when it was given';
  return `In force until ${day(st.expiresAt)}${under}.`;
}
/** Shown on the patient screen while a permission that is still switched on no longer allows its use. */
export function ConsentStandingNotice({ data, p }: { data: Snapshot; p: Person }) {
  const now = new Date().toISOString(), list = notices(data);
  const rows = (['ai', 'exchange', 'contact'] as ConsentPurpose[]).map(x => consentStanding(p, x, now, list)).filter(lapsed);
  if (!rows.length) return null;
  return <EnglishOnly><div className="notice amber-notice" role="status" data-testid="consent-standing-notice"><div>{rows.map(st => <p key={st.purpose}><strong>{LABEL[st.purpose]}:</strong> {standingText(st)} {st.purpose === 'contact' ? 'Renew it by saving the contact preferences with permission.' : 'Renew it under Permissions.'}</p>)}</div></div></EnglishOnly>;
}
// The two switches of the patient Permissions dialog. Turning a permission on, or renewing one, first shows the notice in
// force for its purpose (when the organisation has published one) in the language chosen; the command names that notice.
export function PermissionSwitches({ data, p, care, busy, command }: { data: Snapshot; p: Person; care: boolean; busy: boolean; command: Command }) {
  const { t } = useI18n(), now = new Date().toISOString(), list = notices(data);
  const [give, setGive] = useState<NoticePurpose | null>(null), [lang, setLang] = useState<NoticeLanguage | ''>(''), [shown, setShown] = useState(false);
  const rows: { x: NoticePurpose; title: string; body: string; on: boolean; done: string }[] = [
    { x: 'ai', title: t('patient.aiTitle'), body: t('patient.aiBody'), on: p.aiConsent, done: t('patient.aiGranted') },
    { x: 'exchange', title: t('patient.shareTitle'), body: t('patient.shareBody'), on: p.exchangeConsent, done: t('patient.shareUpdated') },
  ];
  const open = (x: NoticePurpose) => { const n = noticeInForce(list, x, now), pref = p.contactPreferences?.language; setGive(x); setShown(false); setLang(n ? (pref && n.texts[pref] ? pref : n.texts.en ? 'en' : 'hi') : ''); };
  const record = async (x: NoticePurpose) => { const n = noticeInForce(list, x, now); const r = await command({ type: 'setConsent', personId: p.id, purpose: x, active: true, version: p.version, ...(n && lang ? { notice: { id: n.id, language: lang } } : {}) }, rows.find(r => r.x === x)!.done); if (r) setGive(null); };
  const contact = consentStanding(p, 'contact', now, list);
  return <>{rows.map(({ x, title, body, on, done }) => {
    const st = consentStanding(p, x, now, list), n = noticeInForce(list, x, now), soon = st.expiresAt && Date.parse(st.expiresAt) - Date.parse(now) < 30 * 86400000;
    return <div key={x}><div className="consent-row"><div><strong>{title}</strong><p>{body}</p></div><Switch aria-label={title} checked={on} disabled={busy || !care} onCheckedChange={active => active ? open(x) : command({ type: 'setConsent', personId: p.id, purpose: x, active: false, version: p.version }, x === 'ai' ? t('patient.aiWithdrawn') : done)} /></div>
      <EnglishOnly><p className={`text-sm ${lapsed(st) ? 'notice amber-notice' : 'muted'}`} data-testid={`consent-standing-${x}`}>{standingText(st)}{on && care && (lapsed(st) || soon) && give !== x && <> <Button size="sm" variant="outline" disabled={busy} onClick={() => open(x)}>Renew permission</Button></>}</p>
        {give === x && <section className="stack-form" aria-label={`Give ${LABEL[x].toLowerCase()} permission`}>
          {n ? <><p className="text-sm"><strong>Notice version {n.version}</strong> · in force since {when(n.effectiveFrom)} · reviewed: {n.review}</p>
            <Select value={lang} onValueChange={v => { setLang(v as NoticeLanguage); setShown(false); }}><SelectTrigger aria-label="Language the notice was shown in"><SelectValue placeholder="Language" /></SelectTrigger><SelectContent>{(Object.keys(n.texts) as NoticeLanguage[]).map(l => <SelectItem key={l} value={l}>{LANGUAGE[l]}</SelectItem>)}</SelectContent></Select>
            {lang && <div className="notes-box" lang={lang} data-testid="consent-notice-text"><p>{n.texts[lang]}</p></div>}
            <label className="check-label"><Checkbox checked={shown} onCheckedChange={v => setShown(!!v)} />I showed or read this notice to the person in {lang ? LANGUAGE[lang] : 'the chosen language'}, and they agreed.</label></>
            : <p className="muted text-sm">No notice is published for this permission yet, so it is recorded without a notice version. An organisation owner publishes notices under Organisation.</p>}
          <p className="muted text-sm">The permission lasts {CONSENT_PERIOD_DAYS[x]} days from today; Saha sets the end date.</p>
          <div className="button-row"><Button size="sm" disabled={busy || (!!n && (!lang || !shown))} onClick={() => void record(x)}>Record permission</Button><Button size="sm" variant="outline" onClick={() => setGive(null)}>Cancel</Button></div>
        </section>}</EnglishOnly></div>;
  })}
    {contact.state !== 'not-granted' && <EnglishOnly><p className={`text-sm ${lapsed(contact) ? 'notice amber-notice' : 'muted'}`} data-testid="consent-standing-contact"><strong>{LABEL.contact}:</strong> {standingText(contact)} It is given and renewed with the contact preferences.</p></EnglishOnly>}
  </>;
}
/** The notice and expiry recorded on one consent history event. */
export function EventTerms({ e }: { e: { action: string; purpose: ConsentPurpose; notice?: { version: number; language: NoticeLanguage } | null; expiresAt?: string; renews?: { state: string } } }) {
  if (e.action !== 'granted' || !e.expiresAt) return null;
  const under = e.notice ? `Given under notice version ${e.notice.version} (${LANGUAGE[e.notice.language]})` : e.purpose === 'contact' ? 'No versioned notice for this purpose' : 'No notice was published';
  const renews = e.renews ? `; renews an earlier permission${e.renews.state === 'expired' ? ' that had expired' : e.renews.state === 'renewal-needed' ? ' that needed renewal after a notice change' : ''}` : '';
  return <p className="muted">{under} · expires {day(e.expiresAt)}{renews}.</p>;
}
// Organisation view: the registry, and for an owner the form to publish the next version of a purpose's notice.
export function ConsentNoticesPanel({ data, busy, command }: { data: Snapshot; busy: boolean; command: Command }) {
  const list = notices(data), now = new Date().toISOString(), owner = data.canManage;
  const [purpose, setPurpose] = useState<NoticePurpose>('ai'), [from, setFrom] = useState(''), [material, setMaterial] = useState(false), [summary, setSummary] = useState(''), [review, setReview] = useState(''), [en, setEn] = useState(''), [hi, setHi] = useState('');
  const next = list.filter(n => n.purpose === purpose).reduce((v, n) => Math.max(v, n.version), 0) + 1;
  const ok = (s: string) => !s.trim() || (s.trim().length >= MIN_NOTICE_CHARS && s.trim().length <= MAX_NOTICE_CHARS);
  const ready = summary.trim().length >= 10 && review.trim().length >= 3 && (en.trim() || hi.trim()) && ok(en) && ok(hi) && list.length < MAX_NOTICE_VERSIONS;
  const publish = async () => { const r = await command({ type: 'publishConsentNotice', purpose, version: next, effectiveFrom: from ? new Date(from).toISOString() : now, material, summary: summary.trim(), review: review.trim(), texts: { ...(en.trim() ? { en: en.trim() } : {}), ...(hi.trim() ? { hi: hi.trim() } : {}) } }, `Notice version ${next} published`); if (r) { setSummary(''); setReview(''); setEn(''); setHi(''); setFrom(''); setMaterial(false); } };
  return <section className="panel" aria-labelledby="consent-notices-title" data-testid="consent-notices"><div className="section-heading"><div><h2 id="consent-notices-title">Consent notices</h2>
    <p className="muted text-sm">The notice a person is shown before giving each optional permission. Each publication is a new version; earlier versions are kept unchanged. A material version asks for renewal: once it takes effect, permissions given under earlier versions stop allowing their use until the person is shown the new notice and agrees again. AI permission lasts {CONSENT_PERIOD_DAYS.ai} days and sharing permission {CONSENT_PERIOD_DAYS.exchange} days. Automated contact has no notice here yet.</p></div></div>
    <div className="stack-form">{NOTICE_PURPOSES.map(x => { const versions = list.filter(n => n.purpose === x), inForce = noticeInForce(list, x, now); return <div key={x}><h3>{LABEL[x]}</h3>{versions.length ? <ul className="revision-list">{[...versions].reverse().map(n => <li key={n.id} className="merge-case"><strong>Version {n.version}</strong> <span className={`tag ${n.id === inForce?.id ? 'success' : n.effectiveFrom > now ? 'blue' : ''}`}>{n.id === inForce?.id ? 'in force' : n.effectiveFrom > now ? 'scheduled' : 'superseded'}</span>{n.material && <> <span className="tag amber">material</span></>} <span className="muted">· takes effect {when(n.effectiveFrom)} · {(Object.keys(n.texts) as NoticeLanguage[]).map(l => LANGUAGE[l]).join(', ')} · published by {n.publishedByName} · reviewed: {n.review}</span><p className="muted">{n.summary}</p><details><summary>Notice text</summary>{(Object.keys(n.texts) as NoticeLanguage[]).map(l => <div key={l} className="notes-box" lang={l}><span>{LANGUAGE[l]}</span><p>{n.texts[l]}</p></div>)}</details></li>)}</ul> : <p className="muted text-sm">No notice published. Permissions are recorded without a notice version.</p>}</div>; })}</div>
    {owner && <form className="stack-form" onSubmit={e => { e.preventDefault(); void publish(); }}><h3>Publish a new version</h3>
      <div className="form-grid"><label className="field"><span>Permission</span><Select value={purpose} onValueChange={v => setPurpose(v as NoticePurpose)}><SelectTrigger aria-label="Notice permission"><SelectValue /></SelectTrigger><SelectContent>{NOTICE_PURPOSES.map(x => <SelectItem key={x} value={x}>{LABEL[x]}</SelectItem>)}</SelectContent></Select></label>
        <label className="field"><span>Takes effect (your local time; empty for now, at most {MAX_EFFECTIVE_DAYS} days ahead)</span><Input type="datetime-local" value={from} onChange={e => setFrom(e.target.value)} /></label></div>
      <p className="text-sm">This publishes version {next}.</p>
      <label className="check-label"><Checkbox checked={material} onCheckedChange={v => setMaterial(!!v)} />Material change: permissions given under earlier versions need renewal once this version takes effect.</label>
      <label className="field"><span>What changed</span><Input value={summary} onChange={e => setSummary(e.target.value)} maxLength={500} /></label>
      <label className="field"><span>Who reviewed the text, with a reference</span><Input value={review} onChange={e => setReview(e.target.value)} maxLength={200} /></label>
      <label className="field"><span>Notice in English ({MIN_NOTICE_CHARS}–{MAX_NOTICE_CHARS} characters)</span><Textarea value={en} onChange={e => setEn(e.target.value)} maxLength={MAX_NOTICE_CHARS} /></label>
      <label className="field"><span>Notice in Hindi ({MIN_NOTICE_CHARS}–{MAX_NOTICE_CHARS} characters)</span><Textarea lang="hi" value={hi} onChange={e => setHi(e.target.value)} maxLength={MAX_NOTICE_CHARS} /></label>
      {list.length >= MAX_NOTICE_VERSIONS && <p className="notice amber-notice">The registry holds at most {MAX_NOTICE_VERSIONS} versions in this build.</p>}
      <div><Button type="submit" disabled={busy || !ready}>Publish version {next}</Button></div></form>}
  </section>;
}
