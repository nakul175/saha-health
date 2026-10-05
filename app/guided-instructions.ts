// Public navigation instructions only. Never accepts patient, field or result text.
export const PUBLIC_GUIDED_INSTRUCTIONS = {
 en: 'Choose one observation at a time. Back and Next keep your entries. Use Save draft to save observations, and Save programme evidence to save programme answers. Check the current saved record if a save response is not confirmed.',
 hi: 'एक बार में एक जानकारी चुनें। पीछे और आगे जाने से आपकी जानकारी बनी रहती है। जानकारी सहेजने के लिए ड्राफ़्ट सहेजें दबाएँ। कार्यक्रम के उत्तर सहेजने के लिए कार्यक्रम की जानकारी सहेजें दबाएँ। सहेजने का जवाब न मिले तो वर्तमान सहेजा रिकॉर्ड जाँचें।',
} as const;
export type InstructionLanguage = keyof typeof PUBLIC_GUIDED_INSTRUCTIONS;
export function localInstructionVoice(voices: readonly SpeechSynthesisVoice[], language: InstructionLanguage): SpeechSynthesisVoice | null {
 return voices.find(v => v.localService === true && v.lang.toLowerCase().split('-')[0] === language) ?? null;
}
// A small browser-only controller keeps late canceled events from restoring playback state.
export function instructionPlayer(synthesis: SpeechSynthesis, make: (text:string)=>SpeechSynthesisUtterance, changed:(playing:boolean)=>void) {
 let active: SpeechSynthesisUtterance | null = null;
 const stop = () => { const previous=active; active=null; if(previous){previous.onend=null;previous.onerror=null;synthesis.cancel();} changed(false); };
 const voices = (language:InstructionLanguage) => {try{return localInstructionVoice(synthesis.getVoices(),language)}catch{return null}};
 const play = (language:InstructionLanguage) => {
  stop();const voice=voices(language);if(!voice)return false;
  const utterance=make(PUBLIC_GUIDED_INSTRUCTIONS[language]);utterance.voice=voice;utterance.lang=voice.lang;
  active=utterance;const finish=()=>{if(active===utterance){active=null;changed(false)}};utterance.onend=finish;utterance.onerror=finish;
  try{changed(true);synthesis.speak(utterance);return true}catch{stop();return false}
 };
 return {play,stop,voices};
}
