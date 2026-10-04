import assert from 'node:assert/strict';
// Slice 14g (BR-REP-04, BR-REP-05) through the built Worker and local D1, in its own organisation so the shared one is never narrowed:
// small-number suppression on the operational CSV, team and programme filters, the reporting and patient-export purposes, and the
// held download (expiry, single delivery, replay, scope change, wrong member and role).
export async function exportSuppressionSmoke({ get, post, check, base, sql }) {
  const run = crypto.randomUUID().slice(0, 8);
  const account = label => ({ id: `xs-${run}-${label}`, headers: { 'oai-authenticated-user-id': `xs-${run}-${label}`, 'oai-authenticated-user-email': `${label}@example.invalid`, 'oai-authenticated-user-full-name': `Export%20${label}`, 'oai-authenticated-user-email-verified': 'true' }, state: null });
  const o = account('owner'), s = account('supervisor'), w = account('asha'), a = account('admin'), c = account('clinician'), x = account('stranger');
  for (const who of [o, s, w, a, c, x]) await get(who);
  const org = o.state.organisation.id;
  for (const [who, role, teams] of [[s, 'supervisor', ['default']], [w, 'asha', ['default']], [a, 'admin', []], [c, 'clinician', ['default']]]) {
    const inv = (await post(o, { type: 'createInvite', accountCode: who.state.user.accountCode, label: `Export ${role}`, role, teamIds: teams }, 200, undefined, org)).result;
    await post(who, { type: 'joinOrganisation', token: inv.token });
    await get(who, '/api/workspace', 200, org);
  }
  const raw = async (who, path, init = {}) => { const r = await fetch(base + path, { ...init, headers: { ...(who?.headers ?? {}), 'x-saha-organisation': org, ...(init.headers ?? {}) } }); const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* a file */ } return { status: r.status, text, json, headers: r.headers }; };
  const postExport = (who, body) => raw(who, '/api/exports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const grant = async (member, purposes) => { await get(o, '/api/workspace', 200, org); await post(o, { type: 'setAccessPurpose', memberId: member.id, version: 0, programme: null, purposes, reason: 'Synthetic purpose limit for the export check' }, 200, undefined, org); const g = (await raw(o, '/api/purpose-scope')).json.grants.find(x => x.memberId === member.id && !x.revokedAt); return g; };
  const revoke = async g => post(o, { type: 'revokeAccessPurpose', grantId: g.id, version: g.version, reason: 'Synthetic purpose limit removed.' }, 200, undefined, org);

  // A small number of confirmed visits: two in the window, so "visits confirmed" is a count of 1 to 4.
  const facts = { date: new Date(Date.now() - 60000).toISOString().slice(0, 16), systolic: '118', diastolic: '76', weight: '57.5', temperature: '', weeks: '24', coughDays: '', notes: 'Synthetic export-suppression visit.', source: 'measured' };
  let confirmedVisit = null;
  for (const pid of ['p_meena', 'p_rajesh']) {
    const st = await post(o, { type: 'startVisit', personId: pid }, 200, undefined, org), vid = st.result.visitId;
    await post(o, { type: 'saveVisit', visitId: vid, version: 1, facts }, 200, undefined, org);
    await post(o, { type: 'confirmVisit', visitId: vid, version: 2 }, 200, undefined, org);
    confirmedVisit ??= vid;
  }
  await get(s, '/api/workspace', 200, org);

  // 1. The CSV carries only suppressed figures; the on-screen JSON view of the viewer's own scope is unchanged.
  const shown = await raw(s, '/api/operations?days=30');
  check(() => { assert.equal(shown.status, 200); assert.equal(shown.json.report.visitsConfirmed, 2, 'the in-app view of the viewer\'s own authorised scope is not suppressed'); });
  const csv = await raw(s, '/api/operations?days=30&format=csv');
  const lines = csv.text.split('\r\n').slice(0, -1), cells = l => l.slice(1, -1).split('","');
  const countLabels = new Set(['Current authorised patients', 'Visits started in window', 'Visits confirmed in window', 'Active workers in window', 'drafts', 'openFollowUps', 'overdueFollowUps', 'openReferrals', 'overdueReferrals', 'undatedReferrals', 'unresolvedSubmissions', 'unresolvedEhr', 'Missing agent usage records']);
  const okCell = v => /^(0|[5-9]|[1-9]\d+|<5|withheld)$/.test(v);
  check(() => {
    assert.equal(csv.status, 200);
    assert.deepEqual(cells(lines.find(l => l.startsWith('"Report definition"'))), ['Report definition', 'saha-operational-report', '1.2.0']);
    assert.ok(lines.some(l => l.startsWith('"Small-number suppression"')) && lines.some(l => l.startsWith('"Cells suppressed or withheld"')) && lines.some(l => l.startsWith('"Filters"')));
    assert.deepEqual(cells(lines.find(l => l.startsWith('"Visits confirmed in window"'))), ['Visits confirmed in window', '<5'], 'two confirmed visits are shown as <5, never as 2');
    for (const l of lines) { const c = cells(l); if (countLabels.has(c[0])) assert.ok(okCell(c[1]), l); if (/^\d{4}-\d\d-\d\d$/.test(c[0])) assert.ok(okCell(c[1]), l); }
    const at = lines.indexOf('"Programme","Active episodes","Open tasks","Overdue tasks"'), dst = lines.findIndex(l => l.startsWith('"Destination","Mode"'));
    for (const l of lines.slice(at + 1, dst)) for (const v of cells(l).slice(1)) assert.ok(okCell(v), l);
    assert.equal(csv.headers.get('x-saha-content-sha256'), lines.at(-1).slice(lines.at(-1).lastIndexOf('","') + 3, -1));
  });
  check(() => { const tot = lines.slice(lines.indexOf('"Control total","Displayed measure","Sum of detail rows","Detail rows","Reconciled"') + 1, -2); assert.equal(tot.length, 4); assert.ok(tot.every(l => /,"(yes|withheld)"$/.test(l)), tot.join('|')); assert.ok(tot[0].endsWith('"withheld"'), 'a total whose breakdown holds a suppressed cell is withheld'); });
  check(() => { const row = sql.prepare("SELECT detail FROM audit_events WHERE org_id=? AND action='opsExport' AND detail LIKE ?").get(org, `%${csv.headers.get('x-saha-export-id')}%`); assert.ok(row && /cells suppressed or withheld/.test(row.detail) && /filters team all, programme all/.test(row.detail)); });
  // Negative roles: administrator and ASHA cannot export; a stranger is not a member.
  assert.equal((await raw(a, '/api/operations?days=30&format=csv')).status, 403); assert.equal((await raw(w, '/api/operations?days=30&format=csv')).status, 403); assert.equal((await raw(x, '/api/operations?days=30&format=csv')).status, 403);

  // 2. Filters: team and programme narrow inside the reach and never widen it.
  const f1 = await raw(s, '/api/operations?days=30&format=csv&team=default&programme=General%20care');
  check(() => { assert.equal(f1.status, 200); assert.ok(f1.text.includes('"Filters","team: ') && f1.text.includes('"programme: General care"')); });
  assert.equal((await raw(s, '/api/operations?days=30&format=csv&team=not-my-team')).status, 403);
  assert.equal((await raw(s, '/api/operations?days=30&format=csv&programme=Nonsense')).status, 422);
  assert.equal((await raw(s, '/api/operations?days=30&programme=Nonsense')).status, 422);
  // A programme with fewer than 5 people (the seeded TB screening cohort is one person): every count is withheld.
  const small = await raw(s, '/api/operations?days=30&format=csv&programme=TB%20screening'), smallJson = await raw(s, '/api/operations?days=30&programme=TB%20screening');
  check(() => {
    assert.equal(small.status, 200); const n = smallJson.json.report.patients; assert.ok(n >= 1 && n < 5, `TB screening cohort of ${n}`);
    const l = small.text.split('\r\n'), cell = label => cells(l.find(x => x.startsWith(`"${label}"`)))[1];
    assert.equal(cell('Current authorised patients'), '<5'); assert.equal(cell('Visits confirmed in window'), 'withheld'); assert.equal(cell('openFollowUps'), 'withheld'); assert.equal(cell('overdueReferrals'), 'withheld', 'a zero is withheld too');
    assert.ok(!small.text.includes(`"Current authorised patients","${n}"`));
  });
  // 3. The reporting purpose: a member limited to another purpose cannot export a report; the patient-export purpose does not grant it.
  const gOnly = await grant(s, ['patient-export']);
  check(() => assert.ok(gOnly));
  const noRep = await raw(s, '/api/operations?days=30&format=csv');
  check(() => { assert.equal(noRep.status, 403); assert.match(noRep.json.error, /reporting/i); });
  assert.equal((await postExport(s, { kind: 'operations-csv', days: 30 })).status, 403);
  const jsonStill = await raw(s, '/api/operations?days=30'); check(() => assert.equal(jsonStill.status, 200, 'the in-app view is not an export'));
  await revoke(gOnly);
  const gRep = await grant(s, ['reporting']);
  assert.equal((await raw(s, '/api/operations?days=30&format=csv')).status, 200);
  await revoke(gRep);

  // 4. The patient-export purpose: a FHIR download needs it, and reporting does not substitute.
  assert.equal((await raw(c, `/api/fhir/${confirmedVisit}?organisationId=${org}`)).status, 200, 'without a limiting grant nothing changes');
  const gc = await grant(c, ['reporting']);
  const fh = await raw(c, `/api/fhir/${confirmedVisit}?organisationId=${org}`);
  check(() => { assert.equal(fh.status, 403); assert.match(fh.json.error, /patient-level exports/i); });
  await revoke(gc);
  const gc2 = await grant(c, ['patient-export']);
  assert.equal((await raw(c, `/api/fhir/${confirmedVisit}?organisationId=${org}`)).status, 200);
  assert.equal((await raw(a, `/api/fhir/${confirmedVisit}?organisationId=${org}`)).status, 403, 'an administrator cannot download patient records');
  assert.equal((await raw(x, `/api/fhir/${confirmedVisit}?organisationId=${org}`)).status, 403, 'a non-member cannot');
  await revoke(gc2);
  // Data exit: owners keep full access and cannot be purpose-limited (the purpose check is there for the day that changes), so only the
  // role boundary is exercised over HTTP; the check itself is asserted in the contract.
  assert.equal((await raw(o, '/api/data-exit')).status, 200, 'an owner can export');
  assert.equal((await raw(s, '/api/data-exit')).status, 403, 'a supervisor who is not an owner cannot export the organisation');
  assert.equal((await raw(a, '/api/data-exit')).status, 403);

  // 5. Held exports.
  const bad = await postExport(s, { kind: 'surprise' }); check(() => assert.equal(bad.status, 422));
  assert.equal((await postExport(s, { kind: 'operations-csv', days: 30, extra: 1 })).status, 422);
  assert.equal((await postExport(a, { kind: 'operations-csv', days: 30 })).status, 403); assert.equal((await postExport(w, { kind: 'operations-csv', days: 30 })).status, 403); assert.equal((await postExport(x, { kind: 'operations-csv', days: 30 })).status, 403);
  assert.equal((await postExport(s, { kind: 'operations-csv', days: 30, team: 'not-my-team' })).status, 403, 'filters cannot widen the reach');
  const made = await postExport(s, { kind: 'operations-csv', days: 30, programme: 'General care' });
  check(() => { assert.equal(made.status, 201); assert.equal(made.json.deliveredOnce, true); assert.match(made.json.id, /^[0-9a-f-]{36}$/); assert.equal(Date.parse(made.json.expiresAt) - Date.parse(made.json.createdAt), 15 * 60000); assert.equal(made.json.downloadPath, `/api/exports?id=${made.json.id}`); });
  const listed = await raw(s, '/api/exports');
  check(() => { assert.equal(listed.status, 200); assert.ok(listed.json.exports.some(e => e.id === made.json.id && e.state === 'ready')); assert.ok(!listed.text.includes('Saha scoped operational report'), 'the list never carries file content'); });
  const theirs = await raw(o, `/api/exports?id=${made.json.id}`); check(() => assert.equal(theirs.status, 404, 'another member, even the owner, is told nothing exists'));
  assert.equal((await raw(a, `/api/exports?id=${made.json.id}`)).status, 404); assert.equal((await raw(x, `/api/exports?id=${made.json.id}`)).status, 403);
  assert.equal((await raw(s, '/api/exports?id=not-an-id')).status, 404);
  const got = await raw(s, `/api/exports?id=${made.json.id}`);
  check(() => { assert.equal(got.status, 200); assert.ok(got.text.startsWith('"Saha scoped operational report"')); assert.equal(got.headers.get('x-saha-content-sha256'), made.json.sha256); assert.match(got.headers.get('content-disposition'), /attachment/); assert.equal(got.headers.get('cache-control'), 'no-store'); assert.ok(got.text.includes('"programme: General care"')); });
  const again = await raw(s, `/api/exports?id=${made.json.id}`);
  check(() => { assert.equal(again.status, 410, 'a second download is refused (replay)'); assert.match(again.json.error, /already been downloaded/); });
  check(() => { const r = sql.prepare('SELECT content,downloaded_at FROM held_exports WHERE org_id=? AND id=?').get(org, made.json.id); assert.equal(r.content, ''); assert.ok(r.downloaded_at); });
  check(() => { const e = sql.prepare("SELECT detail,actor_id FROM audit_events WHERE org_id=? AND action='exportDownload' AND subject=?").get(org, made.json.id); assert.ok(e && e.detail.includes(made.json.sha256) && e.actor_id === s.id); });
  // Expiry: past its time the file is refused and blanked.
  const m2 = await postExport(s, { kind: 'operations-csv', days: 7 });
  sql.prepare('UPDATE held_exports SET expires_at=? WHERE org_id=? AND id=?').run(new Date(Date.now() - 1000).toISOString(), org, m2.json.id);
  const late = await raw(s, `/api/exports?id=${m2.json.id}`);
  check(() => { assert.equal(late.status, 410); assert.match(late.json.error, /expired/); assert.equal(sql.prepare('SELECT content FROM held_exports WHERE org_id=? AND id=?').get(org, m2.json.id).content, ''); });
  // Scope change after preparation: refused and blanked.
  const m3 = await postExport(s, { kind: 'operations-csv', days: 7 });
  sql.prepare("UPDATE held_exports SET fingerprint='changed' WHERE org_id=? AND id=?").run(org, m3.json.id);
  const moved = await raw(s, `/api/exports?id=${m3.json.id}`);
  check(() => { assert.equal(moved.status, 409); assert.equal(sql.prepare('SELECT content FROM held_exports WHERE org_id=? AND id=?').get(org, m3.json.id).content, ''); });
  // Purpose withdrawn after preparation: refused, not consumed.
  const m4 = await postExport(s, { kind: 'operations-csv', days: 7 });
  const g4 = await grant(s, ['patient-export']);
  const blocked = await raw(s, `/api/exports?id=${m4.json.id}`);
  check(() => { assert.equal(blocked.status, 403); assert.ok(sql.prepare('SELECT downloaded_at,content FROM held_exports WHERE org_id=? AND id=?').get(org, m4.json.id).content.length > 0, 'a refused download does not consume the file'); });
  await revoke(g4);
  assert.equal((await raw(s, `/api/exports?id=${m4.json.id}`)).status, 200, 'the file is delivered once the purpose is back');
  // Concurrent downloads: exactly one wins.
  const m5 = await postExport(s, { kind: 'operations-csv', days: 7 });
  const race = await Promise.all([raw(s, `/api/exports?id=${m5.json.id}`), raw(s, `/api/exports?id=${m5.json.id}`)]);
  check(() => assert.deepEqual(race.map(r => r.status).sort(), [200, 410], 'of two simultaneous downloads one is delivered'));
  // Held-per-member limit.
  const held = [];
  for (let i = 0; i < 3; i++) held.push(await postExport(s, { kind: 'operations-csv', days: 7 }));
  const over = await postExport(s, { kind: 'operations-csv', days: 7 });
  check(() => { assert.deepEqual(held.map(h => h.status), [201, 201, 201]); assert.equal(over.status, 429); });
  for (const h of held) await raw(s, `/api/exports?id=${h.json.id}`);
  // A held export is not part of the organisation data exit.
  check(() => assert.equal(sql.prepare("SELECT count(*) AS n FROM held_exports WHERE org_id=? AND content<>''").get(org).n, 0, 'every delivered or expired file is blanked'));
}
