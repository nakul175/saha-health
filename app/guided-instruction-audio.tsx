'use client';
import {useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {instructionPlayer,type InstructionLanguage} from './guided-instructions';
export function GuidedInstructionAudio({language,step,visible=true}:{language:InstructionLanguage;step:string;visible?:boolean}){
 const [available,setAvailable]=useState(false),[playing,setPlaying]=useState(false);
 const player=useRef<ReturnType<typeof instructionPlayer>|null>(null),hi=language==='hi';
 useEffect(()=>{
  if(!window.speechSynthesis||!window.SpeechSynthesisUtterance)return;
  const synthesis=window.speechSynthesis,p=instructionPlayer(synthesis,text=>new SpeechSynthesisUtterance(text),setPlaying);player.current=p;
  const refresh=()=>{p.stop();setAvailable(!!p.voices(language))};
  const hidden=()=>{if(document.hidden)p.stop()},leave=()=>p.stop();
  refresh();synthesis.addEventListener('voiceschanged',refresh);document.addEventListener('visibilitychange',hidden);window.addEventListener('pagehide',leave);window.addEventListener('popstate',leave);
  return()=>{p.stop();player.current=null;synthesis.removeEventListener('voiceschanged',refresh);document.removeEventListener('visibilitychange',hidden);window.removeEventListener('pagehide',leave);window.removeEventListener('popstate',leave)};
 },[language]);
 useEffect(()=>{player.current?.stop()},[step,visible]);
 return <div className="guided-instruction-audio" lang={hi?'hi':'en'}><div className="button-row"><Button type="button" variant="outline" disabled={!available||!visible||playing} onClick={()=>{if(!document.hidden&&visible){const ok=player.current?.play(language);if(!ok)setAvailable(false)}}}>{hi?'निर्देश सुनें':'Listen to instructions'}</Button><Button type="button" variant="outline" disabled={!playing} onClick={()=>player.current?.stop()}>{hi?'आवाज़ रोकें':'Stop audio'}</Button></div><p className="muted text-sm" role="status">{playing?(hi?'सिर्फ़ सामान्य निर्देश सुनाए जा रहे हैं।':'Playing general instructions only.'):available?(hi?'सिर्फ़ सामान्य निर्देश। रिकॉर्ड की जानकारी नहीं सुनाई जाती।':'General instructions only. Record content is never read aloud.'):(hi?'इस भाषा की स्थानीय आवाज़ उपलब्ध नहीं है। लिखे निर्देश इस्तेमाल करें।':'A local voice for this language is unavailable. Use the written instructions.')}</p></div>;
}
