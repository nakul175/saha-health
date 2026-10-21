'use client';
// Slice 12a: a microphone beside every text and number box (BR-UX-03, BR-DATA-03).
//
// The button appears next to whichever eligible field has focus. Tapping it listens once (never in the background), shows
// what was heard in an editable box and, for a number box, the number that will be used; nothing reaches the field until
// the worker taps Insert. The field is still part of an unsaved form, so the usual Save, review and confirmation steps apply.
// Speech becomes text on the device when the browser can do that for the language; otherwise only when the organisation has
// allowed the browser speech service (lib/saha/speech.ts), which sends the audio to the browser maker.
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Mic, Square, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { message, type Language, type MessageKey, type Params } from '@/lib/saha/messages';
import { fieldKind, insertion, speechLanguage, speechMode, spokenDigits, spokenNumber, voiceEligible, type FieldKind, type SpeechMode } from '@/lib/saha/speech';

type Field = HTMLInputElement | HTMLTextAreaElement;
type Problem = 'noApi' | 'cloudOff' | 'offline' | 'denied' | 'noSpeech' | 'failed';
type Phase = { kind: 'idle' } | { kind: 'notice' } | { kind: 'listening' } | { kind: 'review'; text: string } | { kind: 'error'; problem: Problem };
type Spot = { host: HTMLElement; fixed: boolean; mic: { left: number; top: number }; panel: { left: number; top?: number; bottom?: number; width: number } };

const describe = (el: Element | null): Field | null => {
  if (!el || !(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return null;
  if (el.closest('[data-voice-ui]')) return null;
  const ok = voiceEligible({ tag: el.tagName.toLowerCase(), type: el instanceof HTMLInputElement ? el.getAttribute('type') : null, readOnly: el.readOnly, disabled: el.disabled, autocomplete: el.getAttribute('autocomplete'), voice: el.getAttribute('data-voice') });
  return ok ? el : null;
};
const kindOf = (el: Field): FieldKind => el instanceof HTMLInputElement ? fieldKind({ type: el.getAttribute('type'), inputMode: el.inputMode || el.getAttribute('inputmode') }) : 'text';
const label = (el: Field) => (el.labels?.[0]?.textContent ?? el.getAttribute('aria-label') ?? el.getAttribute('placeholder') ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
/** Puts text into a field the way typing would, so React and other listeners see the change. */
function setFieldValue(el: Field, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}
/** Room for the microphone inside the focused box; the box's own padding comes back when focus moves on. */
const padded = new WeakMap<Field, string>();
function pad(el: Field) { if (!padded.has(el)) { padded.set(el, el.style.paddingRight); el.style.paddingRight = '44px'; } }
function unpad(el: Field | null) { if (el && padded.has(el)) { el.style.paddingRight = padded.get(el) ?? ''; padded.delete(el); } }
function place(el: Field): Spot {
  const r = el.getBoundingClientRect(), dialog = el.closest('[role="dialog"],[role="alertdialog"]') as HTMLElement | null;
  const vw = window.innerWidth, width = Math.min(380, vw - 24);
  // The microphone sits inside the box at its right edge (vertically centred on a one-line box, top-right on a text area).
  const micTop = el instanceof HTMLTextAreaElement ? r.top + 5 : r.top + Math.max(0, (Math.min(r.height, 48) - 34) / 2), micLeft = Math.max(8, Math.min(r.right - 40, vw - 44));
  const panelTop = r.bottom + 8, panelLeft = Math.max(12, Math.min(r.left, vw - width - 12));
  // The panel opens below the field, or above it when the field is low on the screen, so its buttons stay on screen.
  const vh = window.innerHeight, above = r.bottom + 300 > vh && r.top > vh - r.bottom;
  if (!dialog) return { host: document.body, fixed: true, mic: { left: micLeft, top: micTop }, panel: above ? { left: panelLeft, bottom: Math.max(12, vh - r.top + 8), width } : { left: panelLeft, top: Math.min(panelTop, Math.max(12, vh - 300)), width } };
  // Inside a dialog the controls must live in the dialog (its focus trap and pointer rules), positioned against it.
  const d = dialog.getBoundingClientRect();
  return { host: dialog, fixed: false, mic: { left: micLeft - d.left, top: micTop - d.top + dialog.scrollTop }, panel: { left: Math.max(8, panelLeft - d.left), top: panelTop - d.top + dialog.scrollTop, width: Math.min(width, d.width - 16) } };
}

export function VoiceInput({ lang, cloudAllowed, environment }: { lang: Language; cloudAllowed: boolean; environment?: string }) {
  const [field, setField] = useState<Field | null>(null), [spot, setSpot] = useState<Spot | null>(null), [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [speakLang, setSpeakLang] = useState<Language>(lang), [mode, setMode] = useState<SpeechMode | null>(null), [audioUrl, setAudioUrl] = useState<string | null>(null);
  const recognition = useRef<any>(null), heard = useRef(''), noticed = useRef(false), fieldRef = useRef<Field | null>(null), phaseRef = useRef<Phase>(phase);
  const media = useRef<{ recorder: MediaRecorder; stream: MediaStream; chunks: Blob[] } | null>(null), audioRef = useRef<string | null>(null);
  const t = (key: MessageKey, params?: Params) => message(lang, key, params);
  const say = (p: Problem) => p === 'noApi' ? t('common.voice.noApi') : p === 'cloudOff' ? t('common.voice.cloudOff') : p === 'offline' ? t('common.voice.offline') : p === 'denied' ? t('common.voice.denied') : p === 'noSpeech' ? t('common.voice.noSpeech') : t('common.voice.failed');
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { setSpeakLang(lang); }, [lang]);
  const clearAudio = useCallback(() => { if (audioRef.current) URL.revokeObjectURL(audioRef.current); audioRef.current = null; setAudioUrl(null); }, []);
  const finishCapture = useCallback((keep: boolean) => { const active = media.current; if (!active) return; media.current = null;
    if (keep) active.recorder.onstop = () => { const blob = new Blob(active.chunks, { type: active.recorder.mimeType || 'audio/webm' }); if (blob.size) { clearAudio(); const url = URL.createObjectURL(blob); audioRef.current = url; setAudioUrl(url); } active.stream.getTracks().forEach(track => track.stop()); };
    else active.recorder.onstop = () => active.stream.getTracks().forEach(track => track.stop());
    try { if (active.recorder.state !== 'inactive') active.recorder.stop(); else active.recorder.onstop?.(new Event('stop')); } catch { active.stream.getTracks().forEach(track => track.stop()); }
  }, [clearAudio]);
  const stop = useCallback(() => { try { recognition.current?.abort?.(); } catch { /* already stopped */ } recognition.current = null; finishCapture(false); }, [finishCapture]);
  const close = useCallback(() => { stop(); clearAudio(); setPhase({ kind: 'idle' }); }, [clearAudio, stop]);

  // Follow the focused field. The panel keeps its field while it is open, even when focus moves into the panel.
  useEffect(() => {
    const onFocus = (e: FocusEvent) => { const el = describe(e.target as Element); if (!el) { if (!(e.target as Element)?.closest?.('[data-voice-ui]') && phaseRef.current.kind === 'idle') { unpad(fieldRef.current); fieldRef.current = null; setField(null); } return; } if (phaseRef.current.kind !== 'idle' && fieldRef.current !== el) { stop(); setPhase({ kind: 'idle' }); } if (fieldRef.current !== el) unpad(fieldRef.current); pad(el); fieldRef.current = el; setField(el); setSpot(place(el)); };
    const onMove = () => { if (fieldRef.current?.isConnected) setSpot(place(fieldRef.current)); else if (fieldRef.current) { unpad(fieldRef.current); fieldRef.current = null; setField(null); stop(); setPhase({ kind: 'idle' }); } };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && phaseRef.current.kind !== 'idle') { close(); fieldRef.current?.focus(); } };
    document.addEventListener('focusin', onFocus); window.addEventListener('scroll', onMove, true); window.addEventListener('resize', onMove); document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('focusin', onFocus); window.removeEventListener('scroll', onMove, true); window.removeEventListener('resize', onMove); document.removeEventListener('keydown', onKey); };
  }, [close, stop]);
  useEffect(() => () => { stop(); clearAudio(); unpad(fieldRef.current); }, [clearAudio, stop]);

  const R = typeof window === 'undefined' ? null : ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition ?? null);
  const decide = async (language: string): Promise<SpeechMode> => {
    let local: string | null = null;
    if (R && typeof R.available === 'function') { try { local = String(await R.available({ langs: [language], processLocally: true })); } catch { local = 'unavailable'; } }
    return speechMode({ hasApi: !!R, local, cloudAllowed, environment, online: navigator.onLine });
  };
  const listen = async (m: SpeechMode, language: string) => {
    heard.current = ''; clearAudio();
    // Keep an ephemeral, device-local copy so the worker can play back or discard exactly what they recorded.
    // SpeechRecognition itself does not expose audio. Failure to create this preview does not remove the typed/guided
    // fallback or make the recognizer run in the background; the browser still owns its permission/refusal UI.
    if (navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined') { try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); const recorder = new MediaRecorder(stream); const chunks: Blob[] = []; recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); }; recorder.start(); media.current = { recorder, stream, chunks }; } catch { /* recognition reports its own permission outcome; typed and guided entry remain available */ } }
    const rec = new R(); recognition.current = rec;
    if (m.mode === 'local') rec.processLocally = true;
    rec.lang = language; rec.continuous = false; rec.interimResults = false; rec.maxAlternatives = 1;
    let error = '';
    rec.onresult = (e: any) => { heard.current = Array.from(e.results as ArrayLike<any>).map((r: any) => r[0]?.transcript ?? '').join(' ').trim().slice(0, 3000); };
    rec.onerror = (e: any) => { error = e?.error ?? 'failed'; };
    rec.onend = () => { if (recognition.current !== rec) return; recognition.current = null; finishCapture(!!heard.current);
      if (heard.current) setPhase({ kind: 'review', text: heard.current });
      else setPhase({ kind: 'error', problem: error === 'not-allowed' || error === 'service-not-allowed' ? 'denied' : error === 'network' ? 'offline' : error && error !== 'no-speech' && error !== 'aborted' ? 'failed' : 'noSpeech' }); };
    try { rec.start(); setPhase({ kind: 'listening' }); } catch { recognition.current = null; finishCapture(false); setPhase({ kind: 'error', problem: 'failed' }); }
  };
  const begin = async (next?: Language) => {
    const language = speechLanguage(next ?? speakLang), m = await decide(language); setMode(m);
    if (m.mode === 'none') { setPhase({ kind: 'error', problem: m.reason === 'no-api' ? 'noApi' : m.reason === 'offline' ? 'offline' : 'cloudOff' }); return; }
    if (m.mode === 'cloud' && !noticed.current) { setPhase({ kind: 'notice' }); return; }
    await listen(m, language);
  };
  const insert = (text: string) => {
    const el = fieldRef.current; if (!el) { close(); return; }
    const value = insertion(el.value, text, kindOf(el)); if (value === null) return;
    setFieldValue(el, value); close(); el.focus();
  };

  if (!field || !spot) return null;
  const pos = (p: { left: number; top?: number; bottom?: number }, extra: React.CSSProperties = {}): React.CSSProperties => ({ position: spot.fixed ? 'fixed' : 'absolute', left: p.left, ...(p.bottom !== undefined ? { bottom: p.bottom } : { top: p.top }), ...extra });
  const keep = (e: React.PointerEvent | React.MouseEvent) => e.preventDefault(); // keep the field focused when a control is pressed
  const kind = kindOf(field), isNumber = kind !== 'text', name = label(field);
  const review = phase.kind === 'review' ? phase : null, parsed = review && kind === 'decimal' ? spokenNumber(review.text) : review && kind === 'digits' ? { value: spokenDigits(review.text), others: [] as string[] } : null;
  const ui = <div data-voice-ui="" lang={lang === 'hi' ? 'hi' : undefined}>
    <button type="button" className="voice-mic" data-listening={phase.kind === 'listening' ? 'true' : undefined} style={pos(spot.mic)} onPointerDown={keep} onMouseDown={keep}
      aria-label={phase.kind === 'listening' ? t('common.voice.stop') : t('common.voice.mic')} title={t('common.voice.mic')}
      onClick={() => { if (phase.kind === 'listening') { try { recognition.current?.stop(); finishCapture(true); } catch { close(); } } else void begin(); }}>
      {phase.kind === 'listening' ? <Square size={14} aria-hidden="true" /> : <Mic size={16} aria-hidden="true" />}
    </button>
    {phase.kind !== 'idle' && <div className="voice-panel" role="dialog" aria-label={t('common.voice.mic')} style={pos(spot.panel, { width: spot.panel.width })} onPointerDown={e => { if (!(e.target as HTMLElement).closest('input,textarea')) keep(e); }}>
      <div className="voice-head"><strong>{name || t('common.voice.mic')}</strong><button type="button" className="voice-close" aria-label={t('common.voice.cancel')} onClick={() => { close(); field.focus(); }}><X size={16} aria-hidden="true" /></button></div>
      <div className="voice-langs" role="group" aria-label={t('common.voice.language')}>{(['en', 'hi'] as Language[]).map(l => <button key={l} type="button" aria-pressed={speakLang === l} disabled={phase.kind === 'listening'} onClick={() => { setSpeakLang(l); if (phase.kind !== 'notice') void begin(l); }}>{l === 'en' ? 'English' : 'हिन्दी'}</button>)}</div>
      {phase.kind === 'notice' && <><p className="voice-note">{t('common.voice.cloudNotice')}</p><div className="voice-actions"><Button size="sm" onClick={() => { noticed.current = true; if (mode) void listen(mode, speechLanguage(speakLang)); }}>{t('common.voice.continue')}</Button><Button size="sm" variant="outline" onClick={() => { close(); field.focus(); }}>{t('common.voice.cancel')}</Button></div></>}
      {phase.kind === 'listening' && <p className="voice-status" role="status"><span className="voice-dot" aria-hidden="true" />{t('common.voice.listening')}</p>}
      {phase.kind === 'error' && <><p className="voice-note" role="alert">{say(phase.problem)}</p><div className="voice-actions">{phase.problem !== 'noApi' && phase.problem !== 'cloudOff' && <Button size="sm" variant="outline" onClick={() => void begin()}>{t('common.voice.again')}</Button>}<Button size="sm" variant="outline" onClick={() => { close(); field.focus(); }}>{t('common.voice.cancel')}</Button></div></>}
      {review && <>
        <label className="voice-field"><span>{t('common.voice.heard')}</span><Input data-voice="off" value={review.text} onChange={e => setPhase({ kind: 'review', text: e.target.value })} maxLength={3000} /></label>
        {isNumber && <p className="voice-note" role="status">{parsed?.value ? <>{t('common.voice.number')}: <strong className="voice-number">{parsed.value}</strong>{parsed.others.length ? ` · ${t('common.voice.otherNumbers', { numbers: parsed.others.join(', ') })}` : ''}</> : t('common.voice.noNumber')}</p>}
        <p className="voice-hint">{t('common.voice.check')}{mode?.mode === 'local' ? ` ${t('common.voice.local')}` : ''}</p>
        {audioUrl && <audio src={audioUrl} controls preload="metadata" aria-label={t('common.voice.playback')} />}
        <div className="voice-actions"><Button size="sm" disabled={isNumber ? !parsed?.value : !review.text.trim()} onClick={() => insert(review.text)}>{t('common.voice.insert')}</Button><Button size="sm" variant="outline" onClick={() => void begin()}>{t('common.voice.again')}</Button><Button size="sm" variant="ghost" onClick={() => { close(); field.focus(); }}>{t('common.voice.discard')}</Button></div>
      </>}
    </div>}
  </div>;
  return createPortal(ui, spot.host);
}

// Organisation & team: whether the browser speech service may be used. Every member sees the setting; an owner changes it.
type Command = (c: any, s?: string) => Promise<any>;
export function SpeechPolicyPanel({ data, busy, command }: { data: { membership: { isOwner: boolean }; speechPolicy?: { cloudAllowed: boolean; version: number }; environment?: string }; busy: boolean; command: Command }) {
  const [reason, setReason] = useState(''); const policy = data.speechPolicy ?? { cloudAllowed: false, version: 0 };
  const practice = data.environment === 'synthetic' || data.environment === 'training';
  return <section className="panel" aria-labelledby="voice-input-title" data-testid="speech-policy"><div className="section-heading"><div><h2 id="voice-input-title">Voice input</h2>
    <p className="muted text-sm">Every text and number box has a microphone. People check what was heard before it goes into the box, and nothing is saved until they save the form. Speech is turned into text on the device when the browser can do that for the language (desktop Chrome 139 or later). Phones need the browser speech service, which sends the audio to the browser maker (Google on Android).</p>
    <p className="text-sm"><strong>Browser speech service: {policy.cloudAllowed ? 'allowed' : 'off'}</strong>{policy.cloudAllowed ? ' · practice records only' : ' · on-device speech only'}</p></div></div>
    {data.membership.isOwner && (practice || policy.cloudAllowed ? <form className="flex flex-wrap gap-2 items-end" onSubmit={e => { e.preventDefault(); void command({ type: 'setSpeechPolicy', cloudAllowed: !policy.cloudAllowed, version: policy.version, reason: reason.trim() }, policy.cloudAllowed ? 'Browser speech service turned off' : 'Browser speech service allowed').then(ok => { if (ok) setReason(''); }); }}>
      <label className="field grow"><span>Reason for the change</span><Input value={reason} onChange={e => setReason(e.target.value)} minLength={10} maxLength={500} required /></label>
      <Button type="submit" size="sm" disabled={busy || reason.trim().length < 10}>{policy.cloudAllowed ? 'Turn off the browser speech service' : 'Allow the browser speech service'}</Button></form>
      : <p className="muted text-sm">The browser speech service can be allowed only in the synthetic or training environment, where every record is practice data.</p>)}
  </section>;
}
