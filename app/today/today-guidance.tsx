'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { InstructionLanguage } from '../guided-instructions';
import { TODAY_INSTRUCTIONS, todayInstructionPlayer } from './today-instructions';

export function TodayGuidance({ contextKey }: { contextKey: string }) {
  const [language, setLanguage] = useState<InstructionLanguage>('en');
  const [available, setAvailable] = useState(false), [playing, setPlaying] = useState(false);
  const player = useRef<ReturnType<typeof todayInstructionPlayer> | null>(null);
  const hindi = language === 'hi';
  useLayoutEffect(() => () => { player.current?.stop(); }, [contextKey, language]);
  useEffect(() => {
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
    const synthesis = window.speechSynthesis;
    const current = todayInstructionPlayer(synthesis, text => new SpeechSynthesisUtterance(text), setPlaying);
    player.current = current;
    const refresh = () => { current.stop(); setAvailable(!!current.voices(language)); };
    const hidden = () => { if (document.hidden) current.stop(); };
    const stop = () => current.stop();
    const frame = requestAnimationFrame(refresh);
    synthesis.addEventListener('voiceschanged', refresh);
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('pagehide', stop); window.addEventListener('offline', stop);
    return () => {
      cancelAnimationFrame(frame); current.stop(); player.current = null;
      synthesis.removeEventListener('voiceschanged', refresh);
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('pagehide', stop); window.removeEventListener('offline', stop);
    };
  }, [contextKey, language]);
  return <section aria-label="General Today instructions" lang={hindi ? 'hi' : 'en'}>
    <details onToggle={event => { if (!event.currentTarget.open) player.current?.stop(); }}>
    <summary style={{ minHeight: '44px', padding: '0.75rem 0', cursor: 'pointer' }}>{hindi ? 'टुडे के निर्देश' : 'Today instructions'}</summary>
    <div role="group" aria-label="Instruction language" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
      <button type="button" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>English</button>
      <button type="button" aria-pressed={language === 'hi'} onClick={() => setLanguage('hi')}>हिन्दी</button>
    </div>
    <p>{TODAY_INSTRUCTIONS[language]}</p>
    <button type="button" disabled={!available || playing} onClick={() => {
      if (!document.hidden && navigator.onLine && !player.current?.play(language)) setAvailable(false);
    }}>{hindi ? 'निर्देश सुनें' : 'Listen to instructions'}</button>
    <button type="button" disabled={!playing} style={{ marginTop: '0.5rem' }} onClick={() => player.current?.stop()}>{hindi ? 'आवाज़ रोकें' : 'Stop audio'}</button>
    <p role="status">{playing
      ? (hindi ? 'सिर्फ़ सामान्य निर्देश सुनाए जा रहे हैं।' : 'Playing general instructions only.')
      : available
        ? (hindi ? 'रिकॉर्ड की जानकारी नहीं सुनाई जाती।' : 'Record content is never read aloud.')
        : (hindi ? 'इस भाषा की स्थानीय आवाज़ उपलब्ध नहीं है। लिखे निर्देश इस्तेमाल करें।' : 'A local voice for this language is unavailable. Use the written instructions.')}</p>
    </details>
  </section>;
}
