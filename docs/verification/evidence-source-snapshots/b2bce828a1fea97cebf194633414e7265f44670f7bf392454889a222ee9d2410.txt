import { instructionPlayer, type InstructionLanguage } from '../guided-instructions';

// Public navigation text only. No person, record, field or result can enter audio.
export const TODAY_INSTRUCTIONS = {
  en: 'Today shows your assigned records, not a dated daily schedule. Choose Open record to check an existing person. Opening a record saves nothing. Return to Today to choose another person. If records are unavailable, check your connection and membership, then refresh.',
  hi: 'टुडे में आपको सौंपे गए रिकॉर्ड दिखते हैं, तारीख के अनुसार दैनिक कार्यक्रम नहीं। मौजूदा व्यक्ति की जानकारी जाँचने के लिए रिकॉर्ड खोलें। रिकॉर्ड खोलने से कुछ सहेजा नहीं जाता। दूसरे व्यक्ति को चुनने के लिए टुडे पर लौटें। रिकॉर्ड उपलब्ध न हों तो कनेक्शन और सदस्यता जाँचें, फिर रीफ़्रेश करें।',
} as const;

/** Reuse the original strict local voice and late-cancellation controller. */
export function todayInstructionPlayer(synthesis: SpeechSynthesis, make: (text: string) => SpeechSynthesisUtterance,
  changed: (playing: boolean) => void) {
  let language: InstructionLanguage = 'en';
  const original = instructionPlayer(synthesis, () => make(TODAY_INSTRUCTIONS[language]), changed);
  return { voices: original.voices, stop: original.stop,
    play: (next: InstructionLanguage) => { language = next; return original.play(next); } };
}
