import { z } from 'zod';
import { viewerScope } from './store.js';
import { digest, fail } from './core.js';
import { allowed } from './access.js';
import { fieldIdentity } from './field.js';
import { appendDeviceMetadata } from './device-work.js';
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,200}$/), hash = z.string().regex(/^[0-9a-f]{64}$/);
const receipt = z.object({ key: id, bodyHash: hash }).strict();
const registrationRef = z.object({ registrationId: z.string().uuid(), receipts: z.array(receipt).max(10).refine(x => new Set(x.map(r => r.key)).size === x.length) }).strict();
export const registrationDeviceSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('registration-owner') }).strict(),
    z.object({ type: z.literal('registration-reconcile'), refs: z.array(registrationRef).max(20).refine(x => new Set(x.map(r => r.registrationId)).size === x.length), matches: z.array(id).max(10).optional() }).strict(),
    z.object({ type: z.literal('registration-ack'), operationId: z.string().uuid(), instructionId: hash, registrationId: z.string().uuid().nullable(), removedCopies: z.number().int().min(0).max(30), localRevision: z.number().int().positive() }).strict()
]);
const refused = () => fail(403, 'Device work reference is unavailable.');
const grantRow = (values) => ({ table: 'device_registration_grants', values, keys: ['org_id', 'actor_id', 'registration_id'], append: true });
const wireRow = (org, actor, registrationId, personId, key, bodyHash, wireHash) => ({ table: 'device_registration_wire_receipts', values: { org_id: org, actor_id: actor, registration_id: registrationId, person_id: personId, receipt_key: key, body_hash: bodyHash, wire_hash: wireHash }, keys: ['org_id', 'actor_id', 'receipt_key', 'wire_hash'], append: true });
// Only called after normal exact-key replay authority checks, never from a metadata request.
export async function recordRegistrationWireReplay(d, s, u, c, key, bodyHash, wireHash, result) {
    if (c.type !== 'registerFieldPerson')
        return;
    const p = s.workspace.people.find(p => p.id === result?.personId), m = s.members.find(m => m.userId === u.userId && m.status === 'active');
    if (!p || !m || p.fieldRegistration?.id !== c.registrationId || p.fieldRegistration.by !== u.userId)
        refused();
    const row = await d.prepare('SELECT data FROM patients WHERE org_id=? AND id=? AND version=?').bind(s.organisation.id, p.id, p.version).first();
    if (!row)
        refused();
    const existing = await d.prepare('SELECT registration_id,person_id,body_hash FROM device_registration_wire_receipts WHERE org_id=? AND actor_id=? AND receipt_key=? AND wire_hash=?').bind(s.organisation.id, u.userId, key, wireHash).first();
    if (existing) {
        if (existing.registration_id !== c.registrationId || existing.person_id !== p.id || existing.body_hash !== bodyHash)
            refused();
        return;
    }
    const id = await digest(['saha-registration-wire-replay-v1', s.organisation.id, u.userId, key, wireHash]);
    await appendDeviceMetadata(d, s.organisation.id, u, id, 'instruction', id, { registrationWireReceiptRegistered: true }, [wireRow(s.organisation.id, u.userId, c.registrationId, p.id, key, bodyHash, wireHash)], undefined, { orgRevision: s.organisation.revision, memberSnapshot: { version: m.version, status: m.status, role: m.role }, personId: p.id, data: row.data, version: p.version });
}
export async function registrationGrantRows(c, result, s, u, key, bodyHash, wireHash) {
    if (c.type !== 'registerFieldPerson')
        return [];
    const p = s.workspace.people.find(x => x.id === result?.personId), m = s.members.find(x => x.userId === u.userId && x.status === 'active');
    if (!p || !m || p.fieldRegistration?.id !== c.registrationId || p.fieldRegistration?.by !== u.userId)
        refused();
    const rows = [wireRow(s.organisation.id, u.userId, c.registrationId, p.id, key, bodyHash, wireHash), { table: 'device_registration_receipts', values: { org_id: s.organisation.id, actor_id: u.userId, registration_id: c.registrationId, receipt_key: key, body_hash: bodyHash, person_id: p.id }, keys: ['org_id', 'actor_id', 'receipt_key'], append: true }];
    if (!result.alreadyRegistered)
        rows.push(grantRow({ org_id: s.organisation.id, actor_id: u.userId, registration_id: c.registrationId, person_id: p.id, receipt_key: key, body_hash: bodyHash, member_version: m.version, consent_version: p.consentVersion ?? 1, identity_hash: await fieldIdentity({ ...p, teamId: p.teamId ?? '', assignedTo: p.assignedTo ?? null }), original_role: m.role, person_version: p.version, issued_at: p.fieldRegistration.syncedAt, legacy: 0 }));
    return rows;
}
export async function registerMatchCopy(d, s, u, input, result) {
    const m = s.members.find(x => x.userId === u.userId && x.status === 'active');
    if (!m)
        refused();
    const queryHash = await digest(input), versions = result.candidates.map((x) => ({ id: x.id, version: x.version }));
    if (versions.some((x) => !Number.isInteger(x.version) || !s.workspace.people.some(p => p.id === x.id && p.version === x.version && allowed(m, p))))
        refused();
    const copyId = await digest(['saha-match-copy-v1', s.organisation.id, u.userId, m.version, queryHash, result.hash, versions]);
    const row = { table: 'device_match_copies', values: { org_id: s.organisation.id, actor_id: u.userId, id: copyId, member_version: m.version, query_hash: queryHash, original_role: m.role, candidate_versions: JSON.stringify(versions), issued_at: new Date().toISOString() }, keys: ['org_id', 'actor_id', 'id'], append: true };
    await appendDeviceMetadata(d, s.organisation.id, u, copyId, 'instruction', copyId, { matchCopyRegistered: true }, [row], undefined, { orgRevision: s.organisation.revision, memberSnapshot: { version: m.version, status: m.status, role: m.role } });
    return copyId;
}
export async function registrationDeviceWork(d, u, org, input) {
    const parsed = registrationDeviceSchema.safeParse(input);
    if (!parsed.success)
        fail(422, 'Invalid redacted device metadata.');
    const c = parsed.data;
    if (c.type === 'registration-owner')
        return { userId: u.userId };
    if (!org || org.length > 200)
        refused();
    if (c.type === 'registration-ack') {
        const instruction = await d.prepare("SELECT data FROM device_work_events WHERE org_id=? AND actor_id=? AND id=? AND kind='instruction'").bind(org, u.userId, c.instructionId).first();
        if (!instruction)
            refused();
        const data = JSON.parse(instruction.data);
        if (data.registrationId !== c.registrationId || data.instructionId !== c.instructionId)
            refused();
        return appendDeviceMetadata(d, org, u, c.operationId, 'ack', await digest(c), { instructionId: c.instructionId, registrationId: c.registrationId, removedCopies: c.removedCopies, localRevision: c.localRevision, attestation: 'browser-transaction-completed' });
    }
    const member = await d.prepare('SELECT status,role,version FROM memberships WHERE org_id=? AND user_id=?').bind(org, u.userId).first();
    // Validate every exact reference before emitting instructions; never use a client patient pointer.
    const owned = [];
    for (const r of c.refs) {
        let grant = await d.prepare('SELECT * FROM device_registration_grants WHERE org_id=? AND actor_id=? AND registration_id=?').bind(org, u.userId, r.registrationId).first();
        const outcomes = [], rows = [];
        if (!grant && !r.receipts.length) {
            const legacy = await d.prepare("SELECT p.id,p.data,r.key,r.hash,r.created_at FROM patients p JOIN command_receipts r ON r.org_id=p.org_id AND r.person_id=p.id AND r.actor_id=? WHERE p.org_id=? AND json_extract(p.data,'$.fieldRegistration.id')=? AND json_extract(p.data,'$.fieldRegistration.by')=? AND json_type(r.result,'$.alreadyRegistered') IN ('true','false') AND json_extract(r.result,'$.personId')=p.id LIMIT 1").bind(u.userId, org, r.registrationId, u.userId).first();
            if (legacy) {
                const person = JSON.parse(legacy.data);
                grant = { org_id: org, actor_id: u.userId, registration_id: r.registrationId, person_id: legacy.id, receipt_key: legacy.key, body_hash: legacy.hash, member_version: null, consent_version: null, identity_hash: null, original_role: null, person_version: null, issued_at: person.fieldRegistration.syncedAt, legacy: 1 };
                rows.push(grantRow(grant));
            }
        }
        for (const ref of r.receipts) {
            const saved = await d.prepare('SELECT * FROM command_receipts WHERE actor_id=? AND key=?').bind(u.userId, ref.key).first();
            if (!saved) {
                outcomes.push({ ...ref, outcome: 'unknown' });
                continue;
            }
            const wire = await d.prepare('SELECT * FROM device_registration_wire_receipts WHERE org_id=? AND actor_id=? AND receipt_key=? AND wire_hash=?').bind(org, u.userId, ref.key, ref.bodyHash).first();
            if (saved.org_id !== org || (saved.hash !== ref.bodyHash && (!wire || wire.body_hash !== saved.hash || wire.registration_id !== r.registrationId || wire.person_id !== saved.person_id)) || (saved.command_type != null && saved.command_type !== 'registerFieldPerson'))
                refused();
            const mapping = await d.prepare('SELECT * FROM device_registration_receipts WHERE org_id=? AND actor_id=? AND receipt_key=?').bind(org, u.userId, ref.key).first();
            const p = await d.prepare('SELECT data FROM patients WHERE org_id=? AND id=?').bind(org, saved.person_id).first();
            const person = p ? JSON.parse(p.data) : null, result = JSON.parse(saved.result);
            if (person?.fieldRegistration?.id !== r.registrationId || person.fieldRegistration.by !== u.userId || typeof result.alreadyRegistered !== 'boolean' || result.personId !== saved.person_id || mapping && (mapping.registration_id !== r.registrationId || mapping.body_hash !== saved.hash || mapping.person_id !== saved.person_id))
                refused();
            if (!grant) {
                grant = { org_id: org, actor_id: u.userId, registration_id: r.registrationId, person_id: saved.person_id, receipt_key: ref.key, body_hash: saved.hash, member_version: null, consent_version: null, identity_hash: null, original_role: null, person_version: null, issued_at: person.fieldRegistration.syncedAt, legacy: 1 };
                rows.push(grantRow(grant));
            }
            if (grant.person_id !== saved.person_id)
                refused();
            outcomes.push({ ...ref, outcome: 'accepted' });
        }
        if (!grant && !member)
            refused();
        owned.push({ r, grant, outcomes, rows });
    }
    if (!member && !owned.some(x => x.grant))
        refused();
    const access = !!member && member.status === 'active' && ['asha', 'clinician'].includes(member.role), scope = access ? await viewerScope(d, org, u.userId) : null;
    const matches = [];
    for (const copyId of c.matches ?? []) {
        const copy = await d.prepare('SELECT * FROM device_match_copies WHERE org_id=? AND actor_id=? AND id=?').bind(org, u.userId, copyId).first();
        if (!copy)
            refused();
        let current = access && member.version === copy.member_version;
        for (const candidate of JSON.parse(copy.candidate_versions)) {
            if (!current)
                break;
            current = !!await d.prepare('SELECT id FROM patients p WHERE p.org_id=? AND p.id=? AND p.version=?' + (scope ? ' AND (' + scope.sql + ')' : '')).bind(org, candidate.id, candidate.version, ...(scope?.binds ?? [])).first();
        }
        matches.push({ id: copyId, current });
    }
    const refs = [];
    for (const { r, grant: g, outcomes, rows } of owned) {
        const orgRow = await d.prepare('SELECT revision FROM organisations WHERE id=?').bind(org).first();
        if (!orgRow)
            refused();
        let reason = !access ? 'membership-withdrawn' : null, p = null;
        if (g) {
            p = await d.prepare('SELECT data,version FROM patients WHERE org_id=? AND id=?').bind(org, g.person_id).first();
            if (!p)
                refused();
            const person = JSON.parse(p.data), allowed = access && await d.prepare('SELECT id FROM patients p WHERE p.org_id=? AND p.id=?' + (scope ? ' AND (' + scope.sql + ')' : '')).bind(org, g.person_id, ...(scope?.binds ?? [])).first();
            if (!reason) {
                if (g.legacy)
                    reason = 'legacy-review-required';
                else if (person.consentVersion !== g.consent_version)
                    reason = 'consent-changed';
                else if (!allowed || member.version !== g.member_version || person.restrictions?.some((x) => !x.liftedAt) || person.mergedInto)
                    reason = 'access-withdrawn';
                else if (await fieldIdentity({ ...person, teamId: person.teamId ?? '', assignedTo: person.assignedTo ?? null }) !== g.identity_hash)
                    reason = 'context-changed';
            }
        }
        if (reason) {
            const instructionId = await digest(['saha-registration-purge-v1', org, u.userId, r.registrationId, reason, outcomes]), data = { registrationId: r.registrationId, instructionId, reason, outcomes };
            await appendDeviceMetadata(d, org, u, instructionId, 'instruction', await digest(data), data, rows, undefined, { orgRevision: orgRow.revision, ...(member ? { memberSnapshot: member } : {}), ...(p ? { personId: g.person_id, data: p.data, version: p.version } : {}) });
            refs.push({ ...data, purge: true });
        }
        else
            refs.push({ registrationId: r.registrationId, purge: false, outcomes });
    }
    let contextInstruction = null;
    if (!access && member) {
        const instructionId = await digest(['saha-registration-org-purge-v1', org, u.userId, member.version, member.status, member.role]);
        contextInstruction = { registrationId: null, instructionId, reason: 'membership-withdrawn' };
        const orgRow = await d.prepare('SELECT revision FROM organisations WHERE id=?').bind(org).first();
        await appendDeviceMetadata(d, org, u, instructionId, 'instruction', instructionId, contextInstruction, [], undefined, { orgRevision: orgRow.revision, memberSnapshot: member });
    }
    return { userId: u.userId, refs, matches, contextInstruction };
}
