'use client';
import { ArrowRight, CalendarDays, Users, UserRound, RefreshCw } from 'lucide-react';
import type { Person, Snapshot } from '@/lib/saha/types';
import { workerDayRecords } from '@/lib/saha/worker-day';
import type { AppTab } from './frontline-navigation';
import type { View } from '@/lib/saha/navigation';
import { useI18n } from './i18n';
import './worker-day.css';

type TodayProps = {
  data: Snapshot;
  busy: boolean;
  open: (person: Person) => void;
  work: () => void;
  sync: () => void;
};

/** A new entry to the current editor, not a new task engine or a clinical priority model. */
export function WorkerToday({ data, busy, open, work, sync }: TodayProps) {
  const { lang } = useI18n();
  const hi = lang === 'hi';
  const people = workerDayRecords(data);
  const pending = people?.filter(person => person.status !== 'completed') ?? [];
  const next = pending[0];
  return <section className="worker-day" lang={hi ? 'hi' : 'en'} aria-labelledby="worker-today-title">
    <div className="worker-day-intro">
      <span className="worker-day-kicker">{hi ? 'आपका दिन' : 'YOUR DAY'}</span>
      <h1 id="worker-today-title">{hi ? 'आज का काम' : 'Today'}</h1>
      <p>{hi ? 'मौजूदा काम से आगे बढ़ें।' : 'Pick up your existing work, one visit at a time.'}</p>
    </div>
    {people === null ? <div className="worker-day-card">
      <h2>{hi ? 'पूरी सूची खोलें' : 'Open your full work list'}</h2>
      <p>{hi ? 'यह दृश्य आपके पूरे कार्यक्षेत्र को नहीं दिखा सकता।' : 'This view cannot represent your complete workspace.'}</p>
      <button disabled={busy} onClick={work}>{hi ? 'मेरा काम देखें' : 'See my work'} <ArrowRight size={18}/></button>
    </div> : next ? <article className="worker-day-card worker-day-next">
      <span className="worker-day-kicker">{hi ? 'सूची में अगला' : 'NEXT IN YOUR LIST'}</span>
      <h2>{next.name}</h2>
      <p className="worker-day-context">{next.village} · {hi ? 'रिकॉर्ड' : 'Record'} {next.id.slice(-8)}</p>
      <p className="worker-day-task">{next.task}</p>
      <span className="worker-day-due">{next.due}</span>
      <button className="worker-day-primary" disabled={busy} onClick={() => open(next)}>
        {hi ? 'रिकॉर्ड खोलें' : 'Open record'} <ArrowRight size={19}/>
      </button>
    </article> : <div className="worker-day-card" role="status">
      <h2>{hi ? 'इस सूची में कोई लंबित काम नहीं है' : 'No pending work in this list'}</h2>
      <p>{hi ? 'इसका मतलब यह नहीं कि सभी कार्यक्रमों ने रिकॉर्ड स्वीकार कर लिए हैं।' : 'This does not mean every programme has accepted its records.'}</p>
      <button disabled={busy} onClick={sync}>{hi ? 'सहेजा हुआ काम देखें' : 'Check saved work'} <RefreshCw size={18}/></button>
    </div>}
    {pending.length > 1 && <section className="worker-day-rest" aria-label={hi ? 'बाकी सूची' : 'Rest of your list'}>
      <h2>{hi ? 'इसके बाद' : 'After that'}</h2>
      {pending.slice(1).map(person => <button key={person.id} disabled={busy} onClick={() => open(person)}>
        <span><strong>{person.name}</strong><small>{person.village} · {person.id.slice(-8)}</small><small>{person.task} · {person.due}</small></span>
        <ArrowRight size={18} aria-hidden="true"/>
      </button>)}
    </section>}
    <p className="worker-day-note">{hi ? 'मौजूदा सूची का क्रम है, AI की प्राथमिकता नहीं। इसमें बाकी तारीखों के काम भी हो सकते हैं।' : 'Existing list order, not an AI priority. Overdue and upcoming work may also appear.'}</p>
    <button className="worker-day-secondary" disabled={busy} onClick={work}>{hi ? 'पूरी सूची देखें' : 'View full work list'}</button>
  </section>;
}

export function WorkerNavigation({ busy, tab, view, patientOpen, go, choose }: {
  busy: boolean; tab: AppTab; view: View; patientOpen: boolean;
  go: (view: View) => void; choose: (tab: AppTab) => void;
}) {
  const { lang } = useI18n();
  const hi = lang === 'hi';
  const choices = [
    { id: 'today', label: hi ? 'आज' : 'Today', Icon: CalendarDays, active: tab === 'home', action: () => choose('home') },
    { id: 'people', label: hi ? 'लोग' : 'People', Icon: Users, active: tab === 'workspace' && view === 'people', action: () => go('people') },
    { id: 'space', label: hi ? 'मेरी जगह' : 'My Space', Icon: UserRound, active: tab === 'more', action: () => choose('more') },
  ];
  return <nav className="frontline-bottom worker-day-nav" aria-label="App navigation" lang={hi ? 'hi' : 'en'}>
    {choices.map(({ id, label, Icon, active, action }) => <button key={id} type="button" disabled={busy} onClick={action} aria-current={!patientOpen && active ? 'page' : undefined}>
      <Icon size={21} aria-hidden="true"/><span>{label}</span>
    </button>)}
  </nav>;
}

export function WorkerSpace({ data, busy, sync, go }: {
  data: Snapshot; busy: boolean; sync: () => void; go: (view: View) => void;
}) {
  const { lang } = useI18n();
  const hi = lang === 'hi';
  return <section className="worker-day" lang={hi ? 'hi' : 'en'} aria-labelledby="worker-space-title">
    <div className="worker-day-intro"><h1 id="worker-space-title">{hi ? 'मेरी जगह' : 'My Space'}</h1>
      <p>{data.membership.displayName} · {data.organisation.name}</p></div>
    <div className="worker-day-rest">
      <button disabled={busy} onClick={sync}><span><strong>{hi ? 'सहेजा हुआ काम' : 'Saved work'}</strong><small>{hi ? 'डिवाइस के ड्राफ़्ट और सर्वर की रसीदें' : 'Device drafts and server receipts'}</small></span><ArrowRight size={18}/></button>
      <button disabled={busy} onClick={() => go('continuity')}><span><strong>{hi ? 'गतिविधि और दावे' : 'Activity and claims'}</strong><small>{hi ? 'मौजूदा रिकॉर्ड; भुगतान की पुष्टि नहीं' : 'Existing evidence; not confirmation of payment'}</small></span><ArrowRight size={18}/></button>
      <button disabled={busy} onClick={() => go('organisation')}><span><strong>{hi ? 'प्रोफ़ाइल और टीम' : 'Profile and team'}</strong><small>{hi ? 'मौजूदा खाता सेटिंग' : 'Existing account settings'}</small></span><ArrowRight size={18}/></button>
    </div>
  </section>;
}
