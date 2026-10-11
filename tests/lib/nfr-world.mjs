// Slice 11d: one synthetic organisation with every role, shared by the non-functional suites (authorisation matrix, load, performance).
// Copies the command shapes of tests/api-smoke.mjs (create accounts by loading the workspace, invite by account code, join by token,
// assign patients with assignPatient); nothing here is invented. Synthetic identities and the local dispatcher-model headers only.
import { identity, client } from './worker.mjs';

export const ROLES = ['owner', 'admin', 'supervisor', 'asha1', 'asha2', 'clinician', 'stranger'];
/** Names of the six seed patients every new home organisation receives (lib/saha/seed.ts). */
export const SEED_NAMES = ['Meena Devi', 'Rajesh Kumar', 'Sunita Bai', 'Aarav Singh', 'Farida Begum', 'Kamla Devi'];

export const facts = () => ({ date: new Date(Date.now() - 60000).toISOString().slice(0, 16), systolic: '118', diastolic: '76', weight: '57.5', temperature: '', weeks: '24', coughDays: '', notes: 'Synthetic non-functional test visit.', source: 'measured' });

/** A small valid PNG-signature payload accepted by the media route (signature, size and type are checked, not decoded). */
export const pngBytes = (size = 2048, seed = 1) => { const b = new Uint8Array(size); b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); for (let i = 8; i < size; i++) b[i] = (i * seed) % 251; return b; };

export function must(r, want, what) {
  const ok = Array.isArray(want) ? want.includes(r.status) : r.status === want;
  if (!ok) throw new Error(`${what}: expected ${want}, got ${r.status} ${r.text.slice(0, 300)}`);
  return r;
}

/**
 * Build the organisation. Roles: owner (clinician with owner authority), admin (no patient scope), supervisor, two ASHAs each assigned
 * different patients, clinician, and a stranger with their own home organisation. Returns the helpers and the ids the suites need.
 */
export async function buildWorld(base, { run = crypto.randomUUID().slice(0, 8), connectionClose = false } = {}) {
  const api = client(base, { connectionClose });
  const who = Object.fromEntries(ROLES.map(l => [l, identity(l, run)]));
  const snap = {};
  // Setup only: a 503 on a load (seen once when the shared machine was out of memory) is retried a few times and reported; suites assert on responses, never through this helper.
  const load = async (l, org) => {
    let res = await api.get(who[l], '/api/workspace', org);
    for (let i = 0; i < 3 && res.status === 503; i++) { console.warn(`setup: load ${l} answered 503, retrying (${i + 1})`); await new Promise(r => setTimeout(r, 1500)); res = await api.get(who[l], '/api/workspace', org); }
    const r = must(res, 200, `load ${l}`); snap[l] = r.json; return r.json;
  };
  const cmd = async (l, body, { org = snap[l]?.organisation.id, want = 200 } = {}) => {
    const r = must(await api.command(who[l], body, org), want, `${l} ${body.type}`);
    if (r.json?.snapshot) snap[l] = r.json.snapshot;
    return r.json;
  };
  for (const l of ROLES) await load(l); // first load creates the account and its home organisation
  const org = snap.owner.organisation.id, orgName = `NFR organisation ${run}`;
  await cmd('owner', { type: 'renameOrganisation', name: orgName, version: snap.owner.organisation.revision });

  // A distinctive token that no seed or other organisation ever uses. Each patient gets its own locality so registration never
  // reports a possible duplicate (same locality, age within two years, near name) and demands a review.
  const quillon = n => `Quillon ${n} ${run}`, patientNames = [];
  let made = 0;
  const mk = async (name, programme = 'General care') => { patientNames.push(name); return (await cmd('owner', { type: 'createPerson', name, age: 41, sex: 'Female', village: `Nfr locality ${run}-${++made}`, programme, teamId: 'default' })).result.personId; };
  const people = { a1: await mk(quillon('Alpha')), a2: await mk(quillon('Beta')), a2b: await mk(quillon('Gamma')) };

  const inviteTokens = []; // the one-time invitation tokens; the server stores only their hashes
  const invite = async (l, role, teamIds) => {
    const r = await cmd('owner', { type: 'createInvite', accountCode: snap[l].user.accountCode, label: role, role, teamIds });
    inviteTokens.push(r.result.token);
    await cmd(l, { type: 'joinOrganisation', token: r.result.token });
  };
  await invite('asha1', 'asha', ['default']);
  await invite('asha2', 'asha', ['default']);
  await invite('clinician', 'clinician', ['default']);
  await invite('supervisor', 'supervisor', ['default']);
  await invite('admin', 'admin', []);

  const assign = async (personId, l) => {
    const p = (await load('owner', org)).people.find(x => x.id === personId);
    await cmd('owner', { type: 'assignPatient', personId, version: p.version, teamId: 'default', assignedTo: who[l].id, reason: 'Synthetic assignment for the authorisation matrix' }, { org });
  };
  await assign(people.a1, 'asha1'); await assign(people.a2, 'asha2'); await assign(people.a2b, 'asha2');

  // A confirmed visit for each ASHA's patient, and a draft visit with one media item for ASHA 2's second patient.
  const confirmed = async (l, personId) => {
    const started = await cmd(l, { type: 'startVisit', personId }, { org }), visitId = started.result.visitId;
    const saved = await cmd(l, { type: 'saveVisit', visitId, version: 1, facts: facts() }, { org });
    const v = saved.snapshot.visits.find(x => x.id === visitId), p = saved.snapshot.people.find(x => x.id === personId);
    await cmd(l, { type: 'confirmVisit', visitId, version: v.version, patientCheck: { personId, personVersion: p.version, confirmed: true } }, { org });
    return visitId;
  };
  const visits = { v1: await confirmed('asha1', people.a1), v2: await confirmed('asha2', people.a2) };
  visits.draft2 = (await cmd('asha2', { type: 'startVisit', personId: people.a2b }, { org })).result.visitId;
  const up = await fetch(`${base}/api/media?visitId=${encodeURIComponent(visits.draft2)}&purpose=wound-or-skin`, { method: 'POST', headers: { ...who.asha2.headers, 'Content-Type': 'image/png', 'Idempotency-Key': crypto.randomUUID(), 'x-saha-organisation': org }, body: pngBytes() });
  const upJson = await up.json(); if (up.status !== 200) throw new Error(`media upload: ${up.status} ${JSON.stringify(upJson).slice(0, 300)}`);
  const mediaId = upJson.mediaId;
  for (const l of ROLES) await load(l, l === 'stranger' ? undefined : org);

  const out = { api, who, run, org, orgName, people, visits, mediaId, snap, load, cmd, quillon, inviteTokens, mk: async (name, programme) => { const id = await mk(name, programme); out.patientNames.push(name); return id; },
    /** Names of this organisation's patients (distinctive, seed, and every patient a suite creates through mk). A live list. */
    patientNames: [...patientNames, ...SEED_NAMES], village: () => `Nfr locality ${run}-${++made}` };
  return out;
}
