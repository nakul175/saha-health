// Opt-in, read-only entry. The protected existing /app owns visits and writes.
const content = document.querySelector('#content');
const notice = document.querySelector('#notice');
const refresh = document.querySelector('#refresh');
let workspace = null;
let tab = 'today';
let request = null;
let generation = 0;

function node(tag, text = '', className = '') {
  const el = document.createElement(tag);
  el.textContent = text;
  if (className) el.className = className;
  return el;
}
function link(text, href, className = '') {
  const el = node('a', text, className);
  el.href = href;
  return el;
}
function status(title, text) {
  workspace = null;
  content.replaceChildren();
  const box = node('section', '', 'card status');
  box.append(node('h2', title), node('p', text), link('Open existing workspace', '/app'));
  content.append(box);
  notice.textContent = '';
}
function validSnapshot(x) {
  return x && typeof x === 'object' && x.user && typeof x.user.userId === 'string'
    && x.organisation && typeof x.organisation.id === 'string'
    && x.membership && x.membership.status === 'active'
    && x.membership.userId === x.user.userId && Array.isArray(x.people)
    && x.people.every(p => p && typeof p.id === 'string' && typeof p.name === 'string'
      && typeof p.assigned === 'boolean' && typeof p.task === 'string'
      && typeof p.village === 'string' && typeof p.due === 'string'
      && ['due', 'in_progress', 'completed'].includes(p.status));
}
function visitLink(person) {
  // No patient text in URLs and no inferred draft mutation. /app resolves current scope/visit.
  return '/app?patient=' + encodeURIComponent(person.id);
}
function assigned() {
  return workspace.people.filter(p => p.assigned && p.assignedTo === workspace.user.userId && !p.mergedInto);
}
function personRow(person) {
  const row = link('', visitLink(person), 'person');
  const description = node('span');
  description.append(node('strong', person.name), node('small', person.village), node('small', person.task + ' · ' + person.due));
  const arrow = node('span', '›');
  arrow.setAttribute('aria-hidden', 'true');
  row.append(description, arrow);
  row.setAttribute('aria-label', 'Open ' + person.name + ', ' + person.village);
  return row;
}
function render() {
  if (!workspace) return;
  content.replaceChildren();
  notice.textContent = workspace.environment === 'training' ? 'Training records only.' : 'Synthetic records only.';
  const who = typeof workspace.membership.displayName === 'string' ? workspace.membership.displayName : 'Your workspace';
  if (tab === 'today') {
    content.append(node('p', who, 'muted'), node('h1', 'Your work, together.'));
    const all = assigned();
    const work = all.filter(p => p.status !== 'completed');
    content.append(node('p', 'Current assigned records, including overdue and upcoming work. Not a new schedule or clinical priority list.', 'muted brief'));
    if (work.length) {
      const p = work[0];
      const next = node('section', '', 'card next');
      next.append(node('div', 'Next in your current list', 'eyebrow'), node('h2', p.name), node('p', p.village, 'muted'), node('p', p.task + ' · ' + p.due));
      next.append(link('Open visit', visitLink(p), 'action primary'));
      content.append(next);
      if (work.length > 1) {
        content.append(node('h2', 'Also on your list', 'section-label'));
        const list = node('div', '', 'list');
        work.slice(1).forEach(p => list.append(personRow(p)));
        content.append(list);
      }
    } else {
      content.append(node('section', 'No open assigned records are available in this response. People contains your other assigned records.', 'card'));
    }
    content.append(node('p', 'Opens the existing guided visit. This preview does not create a record, submit a programme update or run AI.', 'footnote'));
  } else if (tab === 'people') {
    content.append(node('h1', 'People'));
    const label = node('label', 'Find an assigned person');
    const search = node('input', '', 'search');
    search.type = 'search'; search.id = 'search'; label.htmlFor = 'search';
    search.autocomplete = 'off';
    const list = node('div', '', 'list');
    const filtered = () => {
      list.replaceChildren();
      const q = search.value.trim().toLocaleLowerCase();
      const matches = assigned().filter(p => (p.name + ' ' + p.village).toLocaleLowerCase().includes(q));
      if (!matches.length) list.append(node('p', 'No matching assigned record.', 'muted'));
      matches.forEach(p => list.append(personRow(p)));
    };
    search.addEventListener('input', filtered);
    content.append(label, search, list); filtered();
  } else {
    content.append(node('h1', 'My Space'));
    const card = node('section', '', 'card');
    card.append(node('h2', who), node('p', workspace.organisation.name || 'Current organisation', 'muted'));
    card.append(link('Open workspace and settings', '/app', 'action primary'));
    const more = node('details');
    more.append(node('summary', 'Drafts, sync and what is available'));
    more.append(link('Open prepared device work', '/app/offline/'));
    more.append(node('p', 'Device work uses the existing encrypted notebook. This new entry does not load or save offline records.', 'muted'));
    more.append(node('p', 'Academy, earnings and conversational assistance are not connected in this entry slice.', 'muted'));
    card.append(more); content.append(card);
  }
}
async function load() {
  const ticket = ++generation;
  request?.abort(); const controller = new AbortController(); request = controller;
  workspace = null; content.replaceChildren(); notice.textContent = 'Loading your current work…'; refresh.disabled = true;
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const r = await fetch('/api/workspace', { credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: controller.signal });
    if (ticket !== generation) return;
    if (r.status === 401 || r.status === 403) { status('Sign in to continue', 'Your access needs to be checked in the existing workspace. Previously displayed records have been cleared.'); return; }
    if (!r.ok) throw new Error('Unavailable');
    const x = await r.json();
    if (ticket !== generation) return;
    if (!validSnapshot(x)) throw new Error('Invalid workspace');
    if (x.role !== 'asha' || !['synthetic', 'training'].includes(x.environment) || x.patientPaging) {
      status('Use your existing workspace', 'This bounded preview supports an unpaged ASHA synthetic or training workspace only. It does not change your access.'); return;
    }
    if (x.maintenance?.active) { status('Workspace is paused', 'Open the existing workspace for the current service information.'); return; }
    workspace = x; render();
  } catch {
    if (ticket === generation) status('Your work could not be loaded', 'This is not an empty work list. Reconnect and refresh, or use previously prepared device work in the existing workspace.');
  } finally {
    clearTimeout(timer);
    if (ticket === generation) refresh.disabled = false;
  }
}
refresh.addEventListener('click', load);
document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => {
  tab = button.dataset.tab;
  document.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-current', b === button ? 'page' : 'false'));
  render(); document.querySelector('#main').focus({ preventScroll: true });
}));
window.addEventListener('pagehide', () => { ++generation; request?.abort(); workspace = null; content.replaceChildren(); });
window.addEventListener('pageshow', e => { if (e.persisted) void load(); });
void load();
