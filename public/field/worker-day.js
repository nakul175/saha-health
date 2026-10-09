// Worker-day presentation metadata only. Facts, authority and receipts stay in the existing field vault.
import { appGrantCurrent } from './app-grants.js';

const tabs = ['today', 'people', 'patient', 'sync'];
const bounded = value => typeof value === 'string' && value.length > 0 && value.length <= 200;
export function workerDayRequest(search = '') {
  const query = new URLSearchParams(search);
  return {
    enabled: query.get('experience') === 'worker-day',
    personId: bounded(query.get('personId')) ? query.get('personId') : null,
    organisationId: bounded(query.get('organisationId')) ? query.get('organisationId') : null,
  };
}

export function workerDayCheckpoint(book, { tab, selected, step, lang }, now = Date.now()) {
  const draft = book?.drafts?.find(d => d.packet?.payload?.leaseId === selected);
  const current = draft && appGrantCurrent(draft.packet.payload, book.userId, now);
  return {
    version: 1,
    tab: tabs.includes(tab) && (tab !== 'patient' || current) ? tab : 'today',
    leaseId: current ? selected : null,
    step: current && bounded(step) ? step : null,
    language: lang === 'hi' ? 'hi' : 'en',
  };
}

export function restoreWorkerDay(book, now = Date.now()) {
  const saved = book?.workerDay;
  return workerDayCheckpoint(book, saved?.version === 1 ? {
    tab: saved.tab, selected: saved.leaseId, step: saved.step, lang: saved.language,
  } : { tab: 'today', selected: null, step: null, lang: 'en' }, now);
}

const words = {
  en: {
    today: 'Today', people: 'People', sync: 'My Space', patient: 'Current visit',
    unlock: 'Continue your work', title: 'Saha', prepared: 'Visits on this phone',
    load: 'Load my assigned work', prepare: 'Prepare this visit',
    hint: 'Prepare a visit while connected. Existing signed access limits still apply; this does not approve a new policy.',
    empty: 'No visit is prepared on this phone yet. Connect, load your assigned work and prepare a visit.',
    subset: 'Only visits prepared on this phone appear here—not your complete caseload.',
    saved: 'Saved work', syncAction: 'Sync reviewed work',
    syncHint: 'The existing sync process checks access again. Server drafts are not confirmed visits or programme acceptance.',
    online: 'Online workspace', offline: 'Offline — prepared visits remain available',
    connected: 'Connected — saved work can be synced',
  },
  hi: {
    today: 'आज', people: 'लोग', sync: 'मेरी जगह', patient: 'मौजूदा विज़िट',
    unlock: 'अपना काम जारी रखें', title: 'सहा', prepared: 'इस फ़ोन पर विज़िट',
    load: 'सौंपा गया काम लोड करें', prepare: 'यह विज़िट तैयार करें',
    hint: 'इंटरनेट रहते विज़िट तैयार करें। मौजूदा अनुमति की समय-सीमा लागू है; कोई नई नीति स्वीकृत नहीं हुई है।',
    empty: 'इस फ़ोन पर कोई विज़िट तैयार नहीं है। इंटरनेट से जुड़कर सौंपा गया काम लोड करें और विज़िट तैयार करें।',
    subset: 'यहाँ केवल इस फ़ोन पर तैयार विज़िट हैं—आपकी पूरी सूची नहीं।',
    saved: 'सहेजा हुआ काम', syncAction: 'जाँचा हुआ काम सिंक करें',
    syncHint: 'सिंक में मौजूदा अनुमति दोबारा जाँची जाती है। सर्वर ड्राफ़्ट विज़िट की पुष्टि या कार्यक्रम की स्वीकृति नहीं है।',
    online: 'ऑनलाइन कार्यक्षेत्र', offline: 'ऑफ़लाइन — तैयार विज़िट उपलब्ध हैं',
    connected: 'इंटरनेट जुड़ा है — सहेजा काम सिंक किया जा सकता है',
  },
};

/** Only fixed controls are changed; cached names never enter URLs, HTML strings or public caches. */
export function paintWorkerDay({ book, tab, lang, busy, connected, choose, prepareOpen = false }) {
  const byId = id => document.getElementById(id);
  const w = words[lang === 'hi' ? 'hi' : 'en'];
  document.body.classList.add('worker-day-offline');
  const heading = document.querySelector('#unlock h1');
  if (heading) heading.textContent = w.unlock;
  const headerLabel = document.querySelector('body > header > span');
  if (headerLabel) headerLabel.textContent = w.title;
  const topLink = document.querySelector('body > header > a');
  if (topLink) topLink.href = '/app?experience=worker-day';
  if (!book) return;
  byId('title').textContent = w[tab] ?? w.today;
  byId('draft-title').textContent = w.prepared;
  byId('prepare-title').textContent = w.prepare;
  byId('prepare-hint').textContent = w.hint;
  byId('load').textContent = w.load;
  byId('prepare').textContent = w.prepare;
  byId('sync-title').textContent = w.saved;
  byId('sync-all').textContent = w.syncAction;
  byId('sync-hint').textContent = w.syncHint;
  byId('device-guidance').hidden = true;
  const nav = byId('device-tabs');
  nav.setAttribute('aria-label', 'App navigation');
  nav.replaceChildren();
  for (const next of ['today', 'people', 'sync']) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = w[next];
    button.disabled = busy;
    button.setAttribute('aria-current', tab === next ? 'page' : 'false');
    button.onclick = () => choose(next);
    nav.append(button);
  }
  const current = book.drafts.filter(d => appGrantCurrent(d.packet.payload, book.userId));
  byId('device-summary').textContent = `${connected ? w.connected : w.offline}. ${w.subset}`;
  let empty = byId('worker-day-empty');
  if (!empty) {
    empty = document.createElement('p');
    empty.id = 'worker-day-empty';
    byId('device-today').append(empty);
  }
  empty.textContent = w.empty;
  empty.hidden = book.drafts.length > 0;
  const list = tab === 'today' || tab === 'people';
  byId('device-today').hidden = !list;
  byId('device-prepare').hidden = !list || !connected || (!prepareOpen && current.length > 0);
  byId('device-register').hidden = true;
  byId('device-sync').hidden = tab !== 'sync';
  byId('editor').hidden = tab !== 'patient';
  let prepareButton = byId('worker-day-prepare-toggle');
  if (!prepareButton) {
    prepareButton = document.createElement('button');
    prepareButton.id = 'worker-day-prepare-toggle';
    prepareButton.type = 'button';
    byId('device-today').append(prepareButton);
  }
  prepareButton.textContent = w.prepare;
  prepareButton.hidden = !connected || !current.length || prepareOpen;
  prepareButton.disabled = busy;
  prepareButton.onclick = () => choose('prepare');
  byId('save').hidden = tab !== 'patient';
}
