'use client';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { message, plural, labelFor, signOffLine, type Language, type MessageKey, type Params } from '@/lib/saha/messages';

// Slice 10j: the workspace language for the signed-in member (lib/saha/messages.ts holds the catalogue and the saved choice).
// A component reads it with useI18n(); outside a provider everything is English, the default and the fallback.
export type I18n = {
  lang: Language;
  t: (key: MessageKey, params?: Params) => string;
  n: (key: 'patient.consentWithdrawn' | 'patient.mergedFrom' | 'clinical.urgentCount' | 'clinical.needReview', count: number, params?: Params) => string;
  label: (group: string, value: string) => string;
  signOff: (signOff: { byName: string; at: string } | undefined) => string;
};
const build = (lang: Language): I18n => ({ lang, t: (key, params) => message(lang, key, params), n: (key, count, params) => plural(lang, key, count, params), label: (group, value) => labelFor(lang, group, value), signOff: signOff => signOffLine(lang, signOff) });
const ENGLISH = build('en'), HINDI = build('hi');
const Context = createContext<I18n>(ENGLISH);
export const useI18n = () => useContext(Context);
export function I18nProvider({ lang, children }: { lang: Language; children: ReactNode }) {
  const value = useMemo(() => (lang === 'hi' ? HINDI : ENGLISH), [lang]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
// A region that is not translated yet. In English nothing is added. In Hindi it is marked lang="en" (so screen readers use the
// right voice) and anything below it reads the English catalogue.
export function EnglishOnly({ children }: { children: ReactNode }) {
  const { lang } = useI18n();
  if (lang !== 'hi') return <>{children}</>;
  return <div lang="en" className="lang-island"><Context.Provider value={ENGLISH}>{children}</Context.Provider></div>;
}
// The visible notice on every Hindi screen. The Hindi text is the first thing read; a short English line follows for reviewers.
export function TranslationNotice({ partial, untranslated }: { partial: boolean; untranslated: boolean }) {
  const { lang } = useI18n();
  if (lang !== 'hi') return null;
  return <div className="translation-strip" role="note" aria-label={`${message('hi', 'common.noticeLabel')} · ${message('en', 'common.noticeLabel')}`}>
    <p lang="hi"><strong>{message('hi', 'common.draftNotice')}</strong> {message('hi', 'common.recordedNotice')}{untranslated ? ' ' + message('hi', 'common.untranslatedNotice') : partial ? ' ' + message('hi', 'common.partialNotice') : ''}</p>
    <p lang="en" className="translation-en">{message('en', 'common.draftNotice')}{untranslated ? ' ' + message('en', 'common.untranslatedNotice') : partial ? ' ' + message('en', 'common.partialNotice') : ''}</p>
  </div>;
}
