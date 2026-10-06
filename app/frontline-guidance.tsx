'use client';
import { CalendarDays, Search, RefreshCw, ChevronRight } from 'lucide-react';
import { useI18n } from './i18n';

/** Explicit navigation choices; this screen never starts or saves care work. */
export function FrontlineGuidance({busy,work,people,sync,tools}:{busy:boolean;work:()=>void;people:()=>void;sync:()=>void;tools:()=>void}){
 const {lang}=useI18n(),hi=lang==='hi';
 const choices=[
  {id:'work',icon:CalendarDays,label:hi?'मेरा काम देखें':'See my work',detail:hi?'मौजूदा सूची में आज, पिछले और आने वाले काम देखें।':'Open your current task list, including overdue and upcoming work.',choose:work},
  {id:'people',icon:Search,label:hi?'व्यक्ति खोजें':'Find a person',detail:hi?'रिकॉर्ड चुनें, फिर ज़रूरत हो तो नई विज़िट शुरू करें।':'Choose a record, then start a visit if needed.',choose:people},
  {id:'sync',icon:RefreshCw,label:hi?'ड्राफ़्ट और सिंक देखें':'Check drafts and sync',detail:hi?'इस डिवाइस की नोटबुक खोलें या सर्वर की रसीदें देखें।':'Open this device’s notebook or check server receipts.',choose:sync},
 ];
 return <section className="frontline-guidance" aria-labelledby="guided-home-title" lang={hi?'hi':'en'}>
  <div className="guided-prompt"><span className="guided-speaker">saha.</span><h1 id="guided-home-title">{hi?'अभी क्या करना है?':'What would you like to do?'}</h1><p>{hi?'एक विकल्प चुनें। अगला कदम आपकी स्क्रीन पर खुलेगा।':'Choose an option. We’ll open the next step for you.'}</p></div>
  <div className="guided-choices">{choices.map(({id,icon:Icon,label,detail,choose})=><button type="button" key={id} disabled={busy} onClick={choose}><span className="guided-choice-icon"><Icon size={23}/></span><span><strong>{label}</strong><small>{detail}</small></span><ChevronRight size={20}/></button>)}</div>
  <button type="button" className="guided-tools" disabled={busy} onClick={tools}>{hi?'सभी विकल्प और सेटिंग देखें':'View all tools and settings'} <ChevronRight size={16}/></button>
 </section>;
}

export function FrontlineStepPrompt({view}:{view:'work'|'people'}){
 const {lang}=useI18n(),hi=lang==='hi';
 return <div className="guided-next-prompt" lang={hi?'hi':'en'}><strong>{hi?'किसका रिकॉर्ड खोलना है?':'Whose record would you like to open?'}</strong><p>{view==='work'?(hi?'नीचे मौजूदा काम देखें। रिकॉर्ड खोलकर अगला कदम चुनें।':'Check your current work below. Open a record to choose the next step.'):(hi?'नाम या गाँव से खोजें। पहले रिकॉर्ड देखें, फिर विज़िट शुरू करें।':'Search by name or village. Check the record before starting a visit.')}</p></div>;
}
