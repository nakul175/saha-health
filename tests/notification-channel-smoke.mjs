// Slice 10b HTTP/D1 smoke: the owner-managed out-of-app notification channel (demonstration simulator): owner-only settings and log,
// first-tier message when an alert opens, escalation to the next tier after the owner-set delay, no escalation once acknowledged,
// one message per occurrence, tier and recipient, receipts and audit events in the hash chain, and no patient data or contact detail anywhere.
import assert from 'node:assert/strict';
export async function notificationChannelSmoke({ get, post, check, accounts, sql }) {
  // An organisation of its own, with new synthetic accounts: acknowledgements, alerts and audit fixtures left by earlier smoke modules in the shared
  // organisation (an acknowledged critical-incident alert at count 1, an unchained old audit event) cannot change what this check sees, and the
  // organisation's audit chain can be verified end to end.
  const { stranger: x } = accounts, run = crypto.randomUUID().slice(0, 8);
  const fresh = label => ({ id: `nc10b-${run}-${label}`, headers: { 'oai-authenticated-user-id': `nc10b-${run}-${label}`, 'oai-authenticated-user-email': `nc10b-${label}@example.invalid`, 'oai-authenticated-user-full-name': encodeURIComponent(`Synthetic ${label}`), 'oai-authenticated-user-full-name-encoding': 'percent-encoded-utf-8' }, state: null });
  const o = fresh('owner'), a = fresh('admin'), s = fresh('supervisor'), w = fresh('asha');
  for (const who of [o, a, s, w]) await get(who);
  const org = o.state.organisation.id;
  for (const [who, role, teams] of [[w, 'asha', ['default']], [s, 'supervisor', ['default']], [a, 'admin', []]]) { const inv = await post(o, { type: 'createInvite', accountCode: who.state.user.accountCode, label: role, role, teamIds: teams }, 200, undefined, org); await post(who, { type: 'joinOrganisation', token: inv.result.token }); }
  const CRIT = 'incident-critical-open', url = '/api/notification-channel', SUP_KINDS = ['referrals-overdue', 'followups-overdue', 'referrals-undated'];
  const outputFrom = globalThis.sahaWorkerOutput?.().length ?? 0;
  const forOcc = id => sql.prepare('SELECT * FROM notification_messages WHERE org_id=? AND occurrence_id=? ORDER BY tier,user_id').all(org, id);
  const total = () => sql.prepare('SELECT count(*) AS n FROM notification_messages WHERE org_id=?').get(org).n;
  const openOcc = () => sql.prepare('SELECT * FROM alert_occurrences WHERE org_id=? AND alert_id=? AND closed_at IS NULL').all(org, CRIT);
  const backdate = (id, minutes) => { const at = new Date(Date.now() - minutes * 60000).toISOString(); sql.prepare('UPDATE alert_occurrences SET opened_at=? WHERE org_id=? AND id=?').run(at, org, id); return at; };
  const created = [];
  // Any organisation-wide command evaluates alert delivery (and so the channel) on the state it loaded.
  const tick = async () => { const ops = await get(o, '/api/operations', 200, org); const r = await post(o, { type: 'opsIncident', version: ops.operations.version, title: 'Synthetic 10b evaluation tick', severity: 'normal', ownerId: o.id }); created.push(r.result.incidentId); };
  const resolve = async id => { const ops = await get(o, '/api/operations', 200, org); await post(a, { type: 'opsUpdateIncident', version: ops.operations.version, id, state: 'resolved', ownerId: o.id, resolution: 'Synthetic 10b check finished', evidence: 'synthetic-10b' }); };
  const cmd = (c = {}) => ({ type: 'setNotificationChannel', version: 0, enabled: true, escalateAfterMinutes: 5, reason: 'Synthetic 10b setting', recipients: [{ userId: a.id, tier: 1, channel: 'sms', kinds: [CRIT] }], ...c });
  const rec = (who, tier, channel, kinds) => ({ userId: who.id, tier, channel, kinds });

  // Reads are for owners only.
  await get(null, url, 401, org); await get(x, url, 403, org);
  for (const who of [w, s, a]) await get(who, url, 403, org);
  const first = await get(o, url, 200, org);
  check(() => {
    assert.equal(first.available, true); assert.equal(first.environment, 'synthetic'); assert.equal(first.refusal, null); assert.match(first.rules.notice, /Nothing is sent to any email address or phone number/);
    assert.equal(first.channel.version, 0); assert.equal(first.channel.enabled, false); assert.deepEqual(first.channel.recipients, []); assert.deepEqual([first.rules.escalateMinutes.min, first.rules.escalateMinutes.max], [5, 1440]); assert.equal(first.rules.kinds.length, 23);
    for (const kind of ['queue-stalled', 'connector-failures', 'model-unavailable', 'permission-refusals', 'telemetry-gap']) assert.ok(first.rules.kinds.some(x => x.id === kind), `SAHA-117 operational alert ${kind} remains available to the notification channel`);
    const m = id => first.members.find(x => x.userId === id);
    assert.ok(m(o.id) && m(a.id) && m(s.id), 'owner, administrator and supervisor may be listed'); assert.equal(m(w.id), undefined, 'an ASHA holds no alert kind and cannot be listed');
    assert.ok(m(a.id).kinds.includes(CRIT) && !m(a.id).kinds.includes('referrals-overdue'), 'an administrator may hold operations alerts, not clinical backlog alerts'); assert.ok(m(s.id).kinds.includes('referrals-overdue') && !m(s.id).kinds.includes(CRIT));
  });

  // Commands: owner only; recipients, kinds, bounds and contact details are validated on the server.
  await post(a, cmd(), 403); await post(s, cmd(), 403); await post(w, cmd(), 403);
  await post(o, cmd({ recipients: [] }), 422);
  await post(o, cmd({ recipients: [rec(w, 1, 'sms', [CRIT])] }), 422);
  await post(o, cmd({ recipients: [rec(s, 1, 'sms', [CRIT])] }), 422);
  await post(o, cmd({ recipients: [rec(a, 1, 'sms', ['referrals-overdue'])] }), 422);
  await post(o, cmd({ recipients: [{ userId: 'r1-nobody', tier: 1, channel: 'sms', kinds: [CRIT] }] }), 422);
  await post(o, cmd({ recipients: [rec(a, 1, 'sms', [CRIT]), rec(a, 2, 'email', [CRIT])] }), 422);
  await post(o, cmd({ recipients: [rec(a, 4, 'sms', [CRIT])] }), 422);
  await post(o, cmd({ recipients: [rec(a, 1, 'push', [CRIT])] }), 422);
  await post(o, cmd({ recipients: [{ ...rec(a, 1, 'sms', [CRIT]), address: '+910000000000' }] }), 422);
  await post(o, cmd({ recipients: [{ ...rec(a, 1, 'email', [CRIT]), email: 'someone@example.com' }] }), 422);
  await post(o, cmd({ escalateAfterMinutes: 4 }), 422); await post(o, cmd({ escalateAfterMinutes: 1441 }), 422);
  await post(o, { ...cmd(), extra: true }, 422); await post(o, cmd({ version: 7 }), 409);
  check(() => assert.equal(total(), 0, 'refused changes create no message'));
  const afterRefusals = await get(o, url, 200, org);
  check(() => { assert.equal(afterRefusals.channel.version, 0); assert.equal(afterRefusals.messages.length, 0); });

  // A fresh start: no critical incident open, so this check owns the occurrence.
  let ops = await get(o, '/api/operations', 200, org);
  for (const i of ops.operations.incidents.filter(i => i.state !== 'resolved' && i.severity === 'critical')) { await resolve(i.id); ops = await get(o, '/api/operations', 200, org); }
  check(() => assert.equal(openOcc().length, 0));

  // Set up: administrator first (SMS), owner second (email), supervisor for supervisor alerts only; five-minute delay.
  const config = cmd({ recipients: [rec(a, 1, 'sms', [CRIT]), rec(s, 1, 'email', SUP_KINDS), rec(o, 2, 'email', [CRIT, ...SUP_KINDS])] });
  const key = crypto.randomUUID(), saved = await post(o, config, 200, key), replay = await post(o, config, 200, key);
  check(() => { assert.deepEqual([saved.result.version, saved.result.recipients, saved.result.escalateAfterMinutes], [1, 3, 5]); assert.equal(replay.replayed, true); assert.deepEqual(replay.result, saved.result); });
  await post(o, config, 409, crypto.randomUUID()); // version 0 is stale now
  await post(o, cmd({ version: 1, recipients: config.recipients }), 409); // nothing changed
  const setAudit = sql.prepare("SELECT * FROM audit_events WHERE org_id=? AND action='setNotificationChannel'").all(org);
  check(() => { assert.equal(setAudit.length, 1); assert.match(setAudit[0].detail, /3 recipients/); assert.match(setAudit[0].detail, /5 minutes/); const marker='\nCommand authority: ',at=setAudit[0].detail.lastIndexOf(marker); assert.ok(at>0, 'required immutable authority suffix'); const narrative=setAudit[0].detail.slice(0,at); assert.equal(/@|\+\d|\d{6,}/.test(narrative), false, 'no contact detail in the audit narrative'); assert.deepEqual(JSON.parse(setAudit[0].detail.slice(at+marker.length)), {format:'saha-command-authority-v1',initiatorId:o.id,principal:'member',membershipSource:'pre-mutation',membership:{role:'clinician',status:'active',version:1,isOwner:true},delegationEvidence:'recorded-uses',delegations:[]}, 'authority suffix contains only the exact expected membership evidence, including its opaque identifier'); assert.equal(setAudit[0].person_id, null); });
  const adminOps = await get(a, '/api/operations', 200, org), ownerOps = await get(o, '/api/operations', 200, org);
  check(() => { assert.equal(adminOps.operations.notificationChannel, undefined, 'the operations read does not carry the channel'); assert.equal(ownerOps.operations.notificationChannel, undefined); });

  // An alert opens: the first tier is messaged at once, once.
  ops = ownerOps;
  const inc1 = await post(a, { type: 'opsIncident', version: ops.operations.version, title: 'Synthetic 10b delivery check', severity: 'critical', ownerId: o.id });
  const occ1 = openOcc(); check(() => assert.equal(occ1.length, 1));
  const occId = occ1[0].id, rows1 = forOcc(occId);
  check(() => {
    assert.equal(rows1.length, 1, 'only tier 1 is messaged at once'); const m = rows1[0];
    assert.deepEqual([m.user_id, m.tier, m.rung, m.channel, m.reason, m.count, m.status, m.severity], [a.id, 1, 0, 'sms', 'first', 1, 'simulated-delivered', 'critical']);
    assert.ok(m.body.length <= 160); assert.match(m.body, /^Saha critical: Critical incidents not resolved \(1\) \/\?view=operations Ref NC-[0-9A-F]{6}$/); assert.equal(m.link, '/?view=operations'); assert.match(m.address, /^demo-sms-[0-9a-f]{8} \(not a phone number\)$/); assert.equal(m.subject, null);
    const receipt = JSON.parse(m.receipt); assert.deepEqual([receipt.simulated, receipt.contacted, receipt.provider, receipt.status], [true, false, 'saha-demonstration-simulator', 'simulated-delivered']); assert.match(receipt.receiptId, /^SIM-[0-9A-F]{8}$/);
    assert.ok(Date.parse(m.sent_at) >= Date.parse(m.due_at)); assert.equal(m.config_version, 1);
    const audit = sql.prepare('SELECT * FROM audit_events WHERE org_id=? AND id=?').get(org, m.audit_id); assert.equal(audit.action, 'notificationSent'); assert.equal(audit.actor_id, 'system:notification-simulator'); assert.equal(audit.subject, m.id); assert.equal(audit.person_id, null); assert.ok(audit.seq !== null && audit.hash, 'chained'); assert.match(audit.detail, /Simulated SMS to .* \(tier 1\) for alert incident-critical-open, count 1\. Receipt SIM-/); assert.match(audit.detail, /no address or number was contacted/);
  });
  const chain = await get(o, '/api/audit/chain', 200, org), lastSeq = sql.prepare("SELECT max(seq) AS n FROM audit_events WHERE org_id=? AND action='notificationSent'").get(org).n;
  check(() => { assert.equal(chain.status, 'intact', 'message audit events are in the verified hash chain'); assert.equal(chain.priorEvents, 0); assert.ok(chain.head.seq >= lastSeq, 'the verified chain reaches the message events'); });
  // Repeat reads and evaluations add nothing.
  const before = total();
  await get(o, '/api/alerts', 200, org); await get(a, '/api/alerts', 200, org); await get(o, '/api/operations', 200, org); await get(o, url, 200, org); await tick(); await tick();
  check(() => { assert.equal(forOcc(occId).length, 1, 'one message per occurrence, tier and recipient'); assert.equal(total(), before); });
  const view1 = await get(o, url, 200, org), open1 = view1.open.find(x => x.occurrenceId === occId);
  check(() => {
    assert.ok(open1); assert.equal(open1.acknowledged, false); assert.deepEqual(open1.rungs.map(r => [r.tier, r.state, r.recipients]), [[1, 'sent', 1], [2, 'scheduled', 1]]);
    const m = view1.messages.find(x => x.occurrenceId === occId); assert.equal(m.recipientName.length > 0, true); assert.equal(m.redacted, false); assert.equal(m.receipt.contacted, false); assert.equal(m.count, 1); assert.equal(m.lateMinutes, 0);
    assert.ok(view1.total >= 1);
  });

  // Not acknowledged within the owner-set delay: the next tier is messaged, once.
  const movedTo = backdate(occId, 10); await tick();
  const rows2 = forOcc(occId), tier2 = rows2.filter(r => r.tier === 2);
  check(() => {
    assert.equal(rows2.length, 2); assert.equal(tier2.length, 1); const m = tier2[0];
    assert.deepEqual([m.user_id, m.channel, m.reason, m.rung, m.count], [o.id, 'email', 'escalation', 1, 1]);
    assert.match(m.subject, /^Saha critical alert: Critical incidents not resolved$/); assert.match(m.body, /Escalation: Not acknowledged after 5 min; escalated to tier 2\./); assert.match(m.address, /^demo-[0-9a-f]{8}@simulator\.invalid$/);
    assert.equal(Date.parse(m.due_at) - Date.parse(movedTo), 5 * 60000, 'tier 2 is due one interval after the alert opened'); assert.ok(Date.parse(m.sent_at) - Date.parse(m.due_at) >= 4 * 60000, 'sent late (no timer), and the log says how late');
  });
  await tick(); await get(o, '/api/alerts', 200, org);
  check(() => assert.equal(forOcc(occId).length, 2, 'the escalation is sent once'));
  const view2 = await get(o, url, 200, org);
  check(() => { const m = view2.messages.find(x => x.occurrenceId === occId && x.tier === 2); assert.ok(m.lateMinutes >= 4); assert.deepEqual(view2.open.find(x => x.occurrenceId === occId).rungs.map(r => r.state), ['sent', 'sent']); });

  // The same alert closing and opening again is a new occurrence and a new first message; an acknowledgement stops escalation.
  await resolve(inc1.result.incidentId);
  check(() => { assert.equal(openOcc().length, 0); assert.equal(forOcc(occId).length, 2, 'the log keeps what was sent'); });
  ops = await get(o, '/api/operations', 200, org);
  const inc2 = await post(a, { type: 'opsIncident', version: ops.operations.version, title: 'Synthetic 10b acknowledged check', severity: 'critical', ownerId: o.id });
  const occ2 = openOcc()[0];
  check(() => { assert.notEqual(occ2.id, occId); assert.deepEqual(forOcc(occ2.id).map(r => [r.tier, r.user_id]), [[1, a.id]]); });
  ops = await get(a, '/api/operations', 200, org);
  await post(a, { type: 'opsAcknowledgeAlert', alertId: CRIT, count: ops.alerts.find(y => y.id === CRIT).count, note: 'Synthetic 10b: incident owner investigating' });
  backdate(occ2.id, 10); await tick();
  check(() => assert.equal(forOcc(occ2.id).length, 1, 'an acknowledged alert is not escalated'));
  const ackView = await get(o, url, 200, org);
  check(() => { const r = ackView.open.find(x => x.occurrenceId === occ2.id); assert.equal(r.acknowledged, true); });
  // The acknowledgement stops applying (a second critical incident changes the count): the ladder carries on from where it stood.
  ops = await get(o, '/api/operations', 200, org);
  const inc3 = await post(a, { type: 'opsIncident', version: ops.operations.version, title: 'Synthetic 10b second critical', severity: 'critical', ownerId: o.id });
  check(() => { const rows = forOcc(occ2.id); assert.deepEqual(rows.map(r => [r.tier, r.user_id]), [[1, a.id], [2, o.id]], 'a re-opened alert escalates when its tier is due'); assert.equal(rows[1].count, 2, 'the count is the owner\'s own, at the time'); });

  // Settings change: turn it off; new alerts then create no messages, and the history shows the earlier setting.
  const off = await post(o, cmd({ version: 1, enabled: false, recipients: config.recipients, reason: 'Synthetic 10b: demonstration finished' }), 200);
  const stop = total();
  await resolve(inc2.result.incidentId); await resolve(inc3.result.incidentId);
  ops = await get(o, '/api/operations', 200, org);
  const inc4 = await post(a, { type: 'opsIncident', version: ops.operations.version, title: 'Synthetic 10b while off', severity: 'critical', ownerId: o.id });
  await tick();
  const offView = await get(o, url, 200, org);
  check(() => { assert.equal(off.result.version, 2); assert.equal(openOcc().length, 1); assert.equal(total(), stop, 'a channel that is off sends nothing'); assert.equal(offView.channel.enabled, false); assert.equal(offView.channel.history.length, 1); assert.equal(offView.channel.history[0].version, 1); assert.equal(offView.channel.setByName !== null, true); });
  await resolve(inc4.result.incidentId); for (const id of created) await resolve(id);

  // Storage: unique per occurrence, tier and recipient; contacts, patient data and logs.
  const sample = forOcc(occId)[0];
  check(() => assert.throws(() => sql.prepare('INSERT INTO notification_messages (org_id,id,occurrence_id,alert_id,scope_key,tier,rung,user_id,channel,reason,severity,title,count,subject,body,link,address,status,receipt,due_at,sent_at,audit_id,config_version) SELECT org_id,?,occurrence_id,alert_id,scope_key,tier,rung,user_id,channel,reason,severity,title,count,subject,body,link,address,status,receipt,due_at,sent_at,audit_id,config_version FROM notification_messages WHERE org_id=? AND id=?').run('dup-' + crypto.randomUUID(), org, sample.id), /UNIQUE/));
  const everything = JSON.stringify([sql.prepare('SELECT * FROM notification_messages WHERE org_id=?').all(org), view1, view2, ackView, offView, sql.prepare("SELECT detail FROM audit_events WHERE org_id=? AND action IN ('notificationSent','setNotificationChannel')").all(org)]);
  const names = [...new Set((o.state.people ?? []).flatMap(p => [p.name, p.village, p.id]).filter(v => v && v.length > 3))];
  const output = globalThis.sahaWorkerOutput?.().slice(outputFrom) ?? '';
  check(() => {
    assert.ok(names.length >= 6, 'the synthetic patients are known to the check');
    for (const n of names) assert.equal(everything.includes(n), false, `no patient name, place or identifier in messages, the log or the audit: ${n}`);
    assert.equal(/@(?!simulator\.invalid)[a-z0-9.-]+\.[a-z]{2,}|\+\d{6,}|\b\d{10}\b/i.test(everything.replace(/example\.invalid/g, '')), false, 'no real-looking address or number');
    assert.ok(output.length > 0, 'the console was captured'); for (const t of ['Saha critical', 'simulator.invalid', 'demo-sms', 'Critical incidents not resolved', 'NC-', 'SIM-']) assert.equal(output.includes(t), false, 'the Worker console carries no message content: ' + t);
    for (const m of view2.messages) if (['referrals-overdue', 'followups-overdue', 'referrals-undated', 'destination-uncertain', 'ehr-uncertain', 'provider-usage-missing'].includes(m.alertId) && m.userId !== o.id) { assert.equal(m.redacted, true); assert.equal(m.count, null); }
  });
  await get(o, url, 200, org);
  // Everything this check wrote (settings, messages, escalations, acknowledgements) is in an unbroken chain.
  const chainEnd = await get(o, '/api/audit/chain', 200, org), sent = sql.prepare("SELECT count(*) AS n, max(seq) AS last FROM audit_events WHERE org_id=? AND action='notificationSent'").get(org);
  check(() => { assert.equal(chainEnd.status, 'intact'); assert.equal(chainEnd.firstBreak, null); assert.ok(sent.n >= 4); assert.ok(chainEnd.head.seq >= sent.last); assert.equal(sql.prepare('SELECT count(*) AS n FROM notification_messages WHERE org_id=?').get(org).n, sent.n, 'one audit event per message'); });
}
