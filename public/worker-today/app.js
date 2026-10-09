import { readWork, personPath, findPeople } from './model.js';

const body = document.querySelector('#body');
const notice = document.querySelector('#notice');
const heading = document.querySelector('#heading');
const intro = document.querySelector('#intro');
const identity = document.querySelector('#identity');
let current = null;
let tab = 'today';
let controller = null;
let serial = 0;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function link(text, href, secondary = false) {
  const a = element('a', text, 'action' + (secondary ? ' secondary' : ''));
  a.href = href;
  return a;
}
function card(p, next = false) {
  const a = element('article', undefined, next ? 'next' : '');
  a.append(element('div', next ? 'NEXT IN YOUR WORK LIST' : 'ASSIGNED RECORD', 'kicker'));
  a.append(element('h2', p.name));
  a.append(element('p', `${p.village || 'Location not recorded'} · Record ${p.id.slice(-8)}`, 'details'));
  a.append(element('p', p.task || 'Open existing visit', 'details'));
  a.append(element('p', p.status === 'completed' ? 'Recorded as completed in Saha' :
    p.status === 'in_progress' ? 'Work in progress' : p.due || 'Due date not recorded', 'hint'));
  a.append(link(p.status === 'in_progress' ? 'Continue visit' : 'Open visit', personPath(p.id)));
  return a;
}
function render() {
  body.replaceChildren();
  document.querySelectorAll('[data-tab]').forEach((b) => {
    if (b.dataset.tab === tab) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  heading.textContent = { today: 'Today', people: 'People', space: 'My Space' }[tab];
  if (!current) return;
  identity.textContent = current.worker;
  if (tab === 'today') {
    intro.textContent = 'Existing assigned work, including overdue and upcoming visits.';
    if (!current.work.length) body.append(element('p', 'No open work is listed. Your assigned records are in People.'));
    else {
      body.append(card(current.work[0], true));
      if (current.work.length > 1) body.append(element('h2', 'Also on your list'));
      current.work.slice(1).forEach((p) => body.append(card(p)));
    }
    body.append(element('p', 'Open visit continues in the existing protected Saha workflow. This preview does not change records.', 'hint'));
  } else if (tab === 'people') {
    intro.textContent = 'Search the records already assigned to you.';
    const label = element('label', 'Name, place or record', 'search'); label.htmlFor = 'search';
    const input = element('input'); input.id = 'search'; input.type = 'search'; input.autocomplete = 'off';
    const results = element('div');
    const update = () => {
      results.replaceChildren();
      const people = findPeople(current.people, input.value);
      if (!people.length) results.append(element('p', 'No matching assigned records.'));
      people.forEach((p) => results.append(card(p)));
    };
    input.addEventListener('input', update); body.append(label, input, results); update();
  } else {
    intro.textContent = current.organisation;
    body.append(element('p', 'This is an early entry-screen preview. Learning, earnings and conversational help have not been added here.'));
    body.append(link('Open existing workspace', '/app'));
    body.append(link('Open existing offline work', '/app/offline/', true));
    body.append(element('p', 'Offline work uses the existing encrypted notebook and its current permissions. This screen itself requires a connection.', 'hint'));
  }
}
function unavailable(message) {
  current = null; body.replaceChildren(); identity.textContent = 'YOUR WORKSPACE';
  intro.textContent = 'The existing workspace remains available.';
  notice.className = 'error'; notice.setAttribute('role', 'alert'); notice.textContent = message;
  const retry = element('button', 'Try again', 'retry'); retry.addEventListener('click', load);
  body.append(retry, link('Open existing workspace', '/app', true));
  body.append(link('Open existing offline work', '/app/offline/', true));
}
async function load() {
  const request = ++serial;
  controller?.abort(); controller = new AbortController();
  const activeController = controller;
  current = null; render(); identity.textContent = 'YOUR WORKSPACE';
  notice.className = ''; notice.setAttribute('role', 'status'); notice.textContent = 'Loading your work…';
  const timeout = setTimeout(() => activeController.abort(), 12000);
  try {
    const response = await fetch('/api/workspace', {
      credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: activeController.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error([401, 403].includes(response.status) ?
      'Your access could not be confirmed. Open the existing workspace to sign in.' : 'Saha could not load your work. Nothing was changed.');
    const value = readWork(await response.json());
    if (request !== serial) return;
    current = value; notice.textContent = 'Work list loaded. Existing server permissions apply.'; render();
  } catch (error) {
    if (request === serial) unavailable(error instanceof Error && error.name !== 'AbortError' ?
      error.message : 'The connection did not complete. Open existing offline work or try again.');
  } finally { clearTimeout(timeout); }
}
document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
  tab = b.dataset.tab; render(); if (!current) unavailable('Reload your workspace to continue.');
  document.querySelector('#content').focus();
}));
window.addEventListener('pagehide', () => { serial++; controller?.abort(); current = null; body.replaceChildren(); identity.textContent = ''; notice.textContent = ''; });
window.addEventListener('pageshow', (event) => { if (event.persisted) load(); });
window.addEventListener('offline', () => { serial++; controller?.abort(); unavailable('You are offline. This preview does not store visit data; open existing offline work.'); });
load();
