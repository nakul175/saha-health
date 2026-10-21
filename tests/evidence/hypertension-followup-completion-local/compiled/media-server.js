import { boundedJsonBody } from './request-body.js';
import { identity, loadFor, db, json, rawRuntime } from './server.js';
import { digest, fail, person, uuid, visit } from './core.js';
import { persist, scope } from './store.js';
import { ensureOperating } from './operations.js';
import { ensureNotMerged } from './merge.js';
import { ensureExceptionalScope } from './exceptional.js';
import { ensureNotRestricted } from './rights.js';
import { ensurePurpose } from './purpose-scope.js';
import { accessRoute, recordAccess } from './access-audit.js';
import { checkMedia, MAX_MEDIA_BYTES, MAX_MEDIA_PER_VISIT, readBounded, reviewMediaInput, toB64 } from './media.js';
import { MAX_OBJECT_MEDIA_BYTES, mediaBackend, mediaHash, stagePrivateObject, custodyMediaBytes, assertObjectCurrent } from './media-storage.js';
function sameOrigin(request) { const origin = request.headers.get('origin'); if (origin && origin !== new URL(request.url).origin)
    fail(403, 'Cross-origin changes are not allowed.'); if (request.headers.get('sec-fetch-site') === 'cross-site')
    fail(403, 'Cross-site changes are not allowed.'); }
function idempotency(request) { const key = request.headers.get('idempotency-key'); if (!key || !/^[a-zA-Z0-9_-]{8,100}$/.test(key))
    fail(400, 'A valid idempotency key is required.'); return key; }
function actorBinding(request, u, required = false) { const expected = request.headers.get('x-saha-expected-actor'); if ((required && !expected) || (expected && expected !== u.userId))
    fail(403, 'The signed-in account changed. Original media was not submitted.'); }
const visitPerson = async (orgId, visitId) => { const r = await db().prepare('SELECT person_id FROM visits WHERE org_id=? AND id=?').bind(orgId, visitId).first(); return r ? [r.person_id] : null; };
async function loadVisit(u, org, visitId) { return loadFor(u, org, id => visitPerson(id, visitId)); }
function care(s, u, visitId, mutation = false, writer = mutation) { const m = scope(s, u.userId), v = visit(s.workspace, visitId), p = person(s.workspace, v.personId); ensurePurpose(m, 'care-coordination'); if (writer && !['asha', 'clinician'].includes(m.role))
    fail(403, 'A care role is required for visit media.'); if (mutation) {
    const c = { type: 'attachMedia', visitId };
    ensureOperating(s, c);
    ensureNotMerged(s, c);
    ensureExceptionalScope(s, m, c);
    ensureNotRestricted(s, c);
    if (v.state !== 'draft' || v.voidedAt || v.supersededBy)
        fail(409, 'Attach or remove media while the visit is a draft. Confirmed visits are immutable.');
} return { m, v, p }; }
const basis = async (s, u, visitId) => { const { m, v, p } = care(s, u, visitId, true); return digest({ org: s.organisation.id, revision: s.organisation.revision, patientRevision: s.patientRevs?.[p.id], m, p, v, maintenance: s.operations?.maintenance ?? false, scope: s.operations?.accessScope ?? null, purposes: s.operations?.purposeGrants ?? null }); };
async function unchanged(u, org, visitId, expected) { const s = await loadVisit(u, org, visitId); if (await basis(s, u, visitId) !== expected)
    fail(409, 'Visit or current media authority changed. Keep the original input and refresh.'); return s; }
async function replay(u, request, key, hash, visitId) {
    const old = await db().prepare('SELECT hash,result,org_id,person_id,command_type FROM command_receipts WHERE actor_id=? AND key=?').bind(u.userId, key).first();
    if (!old)
        return null;
    if (old.hash !== hash)
        fail(409, 'This operation key was already used for different input.');
    const requested = request.headers.get('x-saha-organisation');
    if (requested && requested !== old.org_id)
        fail(403, 'Open the original organisation to recover this media receipt.');
    const result = JSON.parse(old.result), target = visitId ?? (await db().prepare('SELECT visit_id FROM media WHERE org_id=? AND id=?').bind(old.org_id, result.removed).first())?.visit_id;
    if (!target)
        fail(409, 'The original media receipt lineage is unavailable.');
    const s = await loadVisit(u, old.org_id, target), { v } = care(s, u, target);
    if (old.person_id !== v.personId)
        fail(409, 'The original media receipt lineage is unavailable.');
    return { ...result, replayed: true };
}
export async function mediaCapabilities(request) {
    const u = await identity(), visitId = new URL(request.url).searchParams.get('visitId') ?? '', s = await loadVisit(u, request.headers.get('x-saha-organisation'), visitId), { m, v } = care(s, u, visitId), backend = mediaBackend(rawRuntime());
    await recordAccess(db(), s, u, m, { action: 'viewMedia', subject: v.id, personId: v.personId, detail: 'Visit media storage capability read; fixed size/type limits only.' });
    care(await loadVisit(u, s.organisation.id, visitId), u, visitId);
    return json({ backend: backend.kind, maxBytes: backend.max, offlineMaxBytes: MAX_MEDIA_BYTES, expectedActorId: u.userId, organisationId: s.organisation.id });
}
export async function uploadMedia(request) {
    const u = await identity();
    sameOrigin(request);
    const configured = mediaBackend(rawRuntime());
    actorBinding(request, u);
    const backend = request.headers.has('x-saha-expected-actor') ? configured : { kind: 'd1', max: MAX_MEDIA_BYTES, bucket: null };
    const key = idempotency(request), url = new URL(request.url), visitId = url.searchParams.get('visitId') ?? '', purpose = url.searchParams.get('purpose') ?? '', mime = (request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (!visitId || visitId.length > 200)
        fail(422, 'Choose a visit.');
    // Current authority is checked before accepting the bounded body; receipt recovery is scoped again below.
    let s = await loadVisit(u, request.headers.get('x-saha-organisation'), visitId);
    const known = await db().prepare('SELECT org_id,person_id,command_type FROM command_receipts WHERE actor_id=? AND key=?').bind(u.userId, key).first(), knownReceipt = !!known && known.org_id === s.organisation.id && known.person_id === visit(s.workspace, visitId).personId && (known.command_type === 'attachMedia' || known.command_type === null);
    care(s, u, visitId, false, !knownReceipt);
    const readMax = request.headers.has('x-saha-expected-actor') ? MAX_OBJECT_MEDIA_BYTES : backend.max, bytes = await readBounded(request, readMax);
    checkMedia(bytes, mime, purpose, readMax);
    const sha = await mediaHash(bytes), hash = await digest({ type: 'attachMedia', visitId, purpose, mime, sha });
    const prior = await replay(u, request, key, hash, visitId);
    if (prior)
        return json(prior);
    checkMedia(bytes, mime, purpose, backend.max);
    let { m, v } = care(s, u, visitId, true);
    const current = (v.media ?? []).filter(x => !x.removedAt);
    if (current.length >= MAX_MEDIA_PER_VISIT)
        fail(422, `At most ${MAX_MEDIA_PER_VISIT} media items per visit.`);
    if (current.some(x => x.sha256 === sha))
        fail(409, 'This file is already attached to the visit.');
    const org = s.organisation.id, expected = await basis(s, u, visitId);
    let ref = { id: uuid(), purpose: purpose, mime: mime, size: bytes.byteLength, sha256: sha, at: new Date().toISOString(), by: u.userId, stage: 'uploaded' }, objectRef = null, custody = null;
    try {
        if (backend.bucket) {
            await recordAccess(db(), s, u, m, { action: 'externalRequest', subject: visitId, personId: v.personId, detail: 'Private media object custody operation reserved; fixed validated type, byte size and content digest, no public URL.' });
            s = await unchanged(u, org, visitId, expected);
            ({ m, v } = care(s, u, visitId, true));
            custody = await db().prepare('SELECT * FROM media_custody WHERE org_id=? AND actor_id=? AND request_key=?').bind(org, u.userId, key).first();
            if (custody && custody.input_hash !== hash)
                fail(409, 'This custody key belongs to different original media.');
            if (!custody) {
                const count = await db().prepare("SELECT count(*) n FROM media_custody WHERE org_id=? AND actor_id=? AND state IN ('staged','quarantined')").bind(org, u.userId).first();
                if ((count?.n ?? 0) >= 50)
                    fail(409, 'Unresolved media custody capacity reached. Ask an owner to reconcile existing uploads.');
                custody = { org_id: org, id: ref.id, actor_id: u.userId, request_key: key, input_hash: hash, person_id: v.personId, visit_id: visitId, object_key: 'media-v1/' + uuid(), state: 'staged', size: ref.size, sha256: sha, mime, object_version: null, etag: null, created_at: ref.at };
                const r = await db().prepare(`INSERT INTO media_custody (${Object.keys(custody).join(',')}) SELECT ${Object.keys(custody).map(() => '?').join(',')} WHERE EXISTS(SELECT 1 FROM organisations WHERE id=? AND revision=?) AND EXISTS(SELECT 1 FROM memberships WHERE org_id=? AND user_id=? AND status='active' AND version=?) AND (SELECT count(*) FROM media_custody WHERE org_id=? AND actor_id=? AND state IN ('staged','quarantined'))<50`).bind(...Object.values(custody), org, s.organisation.revision, org, u.userId, m.version, org, u.userId).run();
                if (r.meta.changes !== 1)
                    fail(409, 'Current media authority changed before custody reservation.');
            }
            if (!['staged', 'quarantined'].includes(custody.state))
                fail(409, 'This custody operation already completed. Recover the original receipt.');
            ref = { ...ref, id: custody.id, at: custody.created_at, storage: 'r2-private-v1' };
            s = await unchanged(u, org, visitId, expected);
            ({ m, v } = care(s, u, visitId, true));
            objectRef = await stagePrivateObject(backend.bucket, custody.object_key, custody.id, bytes, mime, purpose);
            s = await unchanged(u, org, visitId, expected);
            ({ m, v } = care(s, u, visitId, true));
        }
        const before = structuredClone(s);
        (v.media ??= []).push(ref);
        s.workspace.audit.push({ id: uuid(), at: new Date().toISOString(), actorId: u.userId, actor: u.displayName, role: m.role, action: 'attachMedia', subject: v.id, personId: v.personId, detail: `${ref.mime} (${Math.round(ref.size / 1024)} KB) attached to the draft visit for ${ref.purpose}. Type, signature, size and custody integrity checked.` });
        const row = { table: 'media', values: { org_id: org, id: ref.id, person_id: v.personId, visit_id: v.id, mime: ref.mime, size: ref.size, sha256: sha, purpose: ref.purpose, created_at: ref.at, deleted_at: null, data: objectRef ? '' : toB64(bytes), storage_ref: objectRef ? JSON.stringify(objectRef) : null }, keys: ['org_id', 'id'] };
        const extras = [row];
        if (custody && objectRef)
            extras.push({ table: 'media_custody', values: { ...custody, state: 'linked', object_version: objectRef.version, etag: objectRef.etag }, keys: ['org_id', 'id'] });
        const result = { mediaId: ref.id, size: ref.size };
        await persist(db(), before, s, u, { type: 'attachMedia', visitId }, key, hash, result, extras);
        return json(result);
    }
    catch (e) {
        if (custody)
            await db().prepare("UPDATE media_custody SET state='quarantined' WHERE org_id=? AND id=? AND state IN ('staged','quarantined')").bind(org, custody.id).run();
        throw e;
    }
}
async function mediaRecord(u, org, id) {
    let row = null;
    const s = await loadFor(u, org, async (resolved) => { row = await db().prepare('SELECT * FROM media WHERE org_id=? AND id=?').bind(resolved, id).first(); return row ? [row.person_id] : null; });
    if (!row)
        fail(404, 'Media not found.');
    const { m, v, p } = care(s, u, row.visit_id);
    // Documentary imports retain attachments on the original patient's source evidence,
    // without changing the confirmed historical visit. Only legacy D1 bytes use this lineage.
    const ref = v.media?.find(x => x.id === id) ?? (row.storage_ref === null && v.imported && v.personId === row.person_id ? p.importedVisitEvidence?.filter(e => e.visitId === v.id).flatMap(e => e.attachments).find(x => x.id === id) : undefined);
    if (!ref || ref.sha256 !== row.sha256 || ref.mime !== row.mime || ref.purpose !== row.purpose || ref.at !== row.created_at || (!row.deleted_at && ref.size !== row.size))
        fail(503, 'Media lineage is invalid. Nothing was returned.');
    return { s, row, m, v, p, ref };
}
export async function mediaFile(request, id) {
    const u = await identity(), url = new URL(request.url);
    if (!id || id.length > 200)
        fail(404, 'Media not found.');
    const initial = await mediaRecord(u, url.searchParams.get('organisationId') ?? request.headers.get('x-saha-organisation'), id);
    if (initial.row.deleted_at || initial.ref.removedAt)
        fail(410, 'This media was removed from a draft visit.');
    const bytes = await custodyMediaBytes(db(), initial.row, mediaBackend(rawRuntime()).bucket);
    const after = await mediaRecord(u, initial.s.organisation.id, id);
    if (JSON.stringify(after.row) !== JSON.stringify(initial.row) || after.ref.removedAt)
        fail(409, 'Media changed while opening it. Nothing was returned.');
    await recordAccess(db(), after.s, u, after.m, { action: 'viewMedia', subject: id, personId: after.row.person_id, detail: `Visit media opened: ${id} (${after.row.mime}) on visit ${after.row.visit_id}.${accessRoute(after.m, after.p)}` });
    await assertObjectCurrent(mediaBackend(rawRuntime()).bucket, initial.row);
    const fresh = await mediaRecord(u, initial.s.organisation.id, id);
    if (JSON.stringify(fresh.row) !== JSON.stringify(initial.row) || fresh.ref.removedAt)
        fail(409, 'Media changed while opening it. Nothing was returned.');
    return new Response(bytes, { headers: { 'Content-Type': initial.row.mime, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'inline', 'Content-Security-Policy': "default-src 'none'; sandbox" } });
}
export async function removeMedia(request, id) {
    const u = await identity();
    sameOrigin(request);
    actorBinding(request, u);
    const key = idempotency(request), body = request.headers.get('content-type')?.startsWith('application/json') ? await boundedJsonBody(request, 4000) : null, reason = (body && typeof body.reason === 'string' ? body.reason : new URL(request.url).searchParams.get('reason') ?? '').trim();
    if (reason.length < 5 || reason.length > 1000)
        fail(422, 'Give a reason of at least 5 characters.');
    const hash = await digest({ type: 'removeMedia', id, reason }), prior = await replay(u, request, key, hash);
    if (prior)
        return json(prior);
    const { s, row, v, ref, m } = await mediaRecord(u, request.headers.get('x-saha-organisation'), id);
    care(s, u, v.id, true);
    if (ref.removedAt)
        fail(409, 'This media is already removed.');
    const before = structuredClone(s), now = new Date().toISOString(), drafts = ref.extractionDrafts?.length ?? 0;
    Object.assign(ref, { removedAt: now, removedBy: u.userId, removeReason: reason, extractionDrafts: [] });
    s.workspace.audit.push({ id: uuid(), at: now, actorId: u.userId, actor: u.displayName, role: m.role, action: 'removeMedia', subject: v.id, personId: v.personId, detail: `Media removed from the draft visit; content access withdrawn and ${drafts} associated extraction draft reference(s) removed; a tombstone was kept. ${reason}` });
    const tomb = { table: 'media', values: { ...row, size: 0, deleted_at: now, data: '' }, keys: ['org_id', 'id'] }, extras = [tomb];
    if (row.storage_ref) {
        const custody = await db().prepare('SELECT * FROM media_custody WHERE org_id=? AND id=?').bind(s.organisation.id, id).first();
        if (!custody || custody.state !== 'linked')
            fail(503, 'Media custody lineage unavailable. No removal was saved.');
        extras.push({ table: 'media_custody', values: { ...custody, state: 'removed' }, keys: ['org_id', 'id'] });
    }
    const result = { removed: id };
    await persist(db(), before, s, u, { type: 'removeMedia', visitId: v.id }, key, hash, result, extras);
    return json(result);
}
export async function reviewMedia(request, id) {
    const u = await identity();
    sameOrigin(request);
    actorBinding(request, u, true);
    const key = idempotency(request), body = await boundedJsonBody(request, 16000);
    const initial = await mediaRecord(u, request.headers.get('x-saha-organisation'), id);
    care(initial.s, u, initial.v.id, true);
    if (initial.ref.removedAt)
        fail(409, 'This media was removed.');
    const input = reviewMediaInput(body, u.userId), hash = await digest({ type: 'reviewMedia', id, ...body }), prior = await replay(u, request, key, hash, initial.v.id);
    if (prior)
        return json(prior);
    const expected = await basis(initial.s, u, initial.v.id), refreshed = await unchanged(u, initial.s.organisation.id, initial.v.id, expected), current = await mediaRecord(u, refreshed.organisation.id, id), { s, v, ref, m } = current;
    if (ref.removedAt)
        fail(409, 'This media was removed.');
    if (ref.review)
        fail(409, 'This media already has a recorded quality review. Remove it or attach a new draft item.');
    const before = structuredClone(s);
    ref.stage = input.review.stage;
    ref.review = input.review;
    ref.extractionDrafts = input.extractionDrafts;
    s.workspace.audit.push({ id: uuid(), at: input.review.at, actorId: u.userId, actor: u.displayName, role: m.role, action: 'reviewMedia', subject: v.id, personId: v.personId, detail: `Media review recorded: scan ${input.review.scan}; quality ${input.review.quality}; person/encounter match ${input.review.personMatch ? 'confirmed' : 'refused'}; retention ${input.review.retention}; stage ${input.review.stage}. ${input.extractionDrafts.length} extracted value(s) remain unconfirmed drafts and did not change clinical facts.` });
    const result = { mediaId: id, stage: ref.stage, extractionDrafts: input.extractionDrafts.length };
    await persist(db(), before, s, u, { type: 'reviewMedia', visitId: v.id }, key, hash, result);
    return json(result);
}
