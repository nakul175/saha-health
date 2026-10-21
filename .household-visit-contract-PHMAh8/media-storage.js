import { fail } from './core.js';
import { checkMedia, fromB64, MAX_MEDIA_BYTES, toB64 } from './media.js';
// Private binding only. Keys carry no organisation, patient, actor or request identifiers.
export const MAX_OBJECT_MEDIA_BYTES = 4 * 1024 * 1024;
export function mediaBackend(runtime) {
    const mode = runtime.SAHA_MEDIA_STORAGE;
    if (mode === undefined || mode === '' || mode === 'd1')
        return { kind: 'd1', max: MAX_MEDIA_BYTES, bucket: null };
    if (mode !== 'r2-private-v1' || !runtime.BUCKET)
        fail(503, 'Private media storage is not configured. No media was accepted.');
    return { kind: 'r2-private-v1', max: MAX_OBJECT_MEDIA_BYTES, bucket: runtime.BUCKET };
}
export const mediaHash = async (bytes) => toB64(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
export function parseObjectRef(value) {
    if (value == null || value === '')
        return null;
    let x;
    try {
        x = typeof value === 'string' ? JSON.parse(value) : value;
    }
    catch {
        fail(503, 'Media custody metadata is invalid. Nothing was returned.');
    }
    if (!x || Object.keys(x).sort().join() !== 'backend,etag,key,mime,sha256,size,version' || x.backend !== 'r2-private-v1' || !/^media-v1\/[0-9a-f-]{36}$/.test(x.key) || typeof x.version !== 'string' || !x.version || typeof x.etag !== 'string' || !x.etag || !Number.isInteger(x.size) || x.size < 512 || x.size > MAX_OBJECT_MEDIA_BYTES || typeof x.sha256 !== 'string' || typeof x.mime !== 'string')
        fail(503, 'Media custody metadata is invalid. Nothing was returned.');
    return x;
}
export async function objectBytes(bucket, ref, purpose) {
    const object = await bucket.get(ref.key, { onlyIf: { etagMatches: ref.etag } });
    if (!object || !('body' in object) || object.version !== ref.version || object.etag !== ref.etag || object.size !== ref.size)
        fail(503, 'Stored media is missing or changed. Nothing was returned.');
    const bytes = new Uint8Array(await object.arrayBuffer());
    if (bytes.length !== ref.size || await mediaHash(bytes) !== ref.sha256)
        fail(503, 'Stored media failed its integrity check. Nothing was returned.');
    checkMedia(bytes, ref.mime, purpose, MAX_OBJECT_MEDIA_BYTES);
    return bytes;
}
export async function storedMediaBytes(row, bucket) {
    const ref = parseObjectRef(row.storage_ref);
    if (ref) {
        if (!bucket)
            fail(503, 'Private media storage is unavailable. Nothing was returned.');
        if (ref.sha256 !== row.sha256 || ref.size !== row.size || ref.mime !== row.mime)
            fail(503, 'Media reference integrity failed. Nothing was returned.');
        return objectBytes(bucket, ref, String(row.purpose));
    }
    const bytes = fromB64(String(row.data ?? ''));
    if (bytes.length !== Number(row.size) || await mediaHash(bytes) !== row.sha256)
        fail(503, 'Stored media failed its integrity check. Nothing was returned.');
    checkMedia(bytes, String(row.mime), String(row.purpose));
    return bytes;
}
// A unique immutable key plus conditional put makes an interrupted attempt recoverable without overwrite.
export async function stagePrivateObject(bucket, key, custodyId, bytes, mime, purpose) {
    let object = await bucket.head(key);
    if (!object) {
        const saved = await bucket.put(key, bytes, { onlyIf: { etagDoesNotMatch: '*' }, httpMetadata: { contentType: mime }, customMetadata: { custodyId } });
        if (!saved)
            fail(409, 'Private media custody changed before upload.');
        object = await bucket.head(key);
    }
    if (!object || object.customMetadata?.custodyId !== custodyId)
        fail(503, 'Private media custody could not be verified.');
    const ref = { backend: 'r2-private-v1', key, version: object.version, etag: object.etag, size: bytes.length, sha256: await mediaHash(bytes), mime };
    await objectBytes(bucket, ref, purpose);
    return ref;
}
export async function assertObjectCurrent(bucket, row) { const ref = parseObjectRef(row.storage_ref); if (!ref)
    return; if (!bucket)
    fail(503, 'Private media storage is unavailable.'); const head = await bucket.head(ref.key); if (!head || head.version !== ref.version || head.etag !== ref.etag || head.size !== ref.size)
    fail(503, 'Stored media is missing or changed. Nothing was returned.'); }
export async function custodyMediaBytes(db, row, bucket) {
    const ref = parseObjectRef(row.storage_ref);
    if (ref) {
        const c = await db.prepare('SELECT * FROM media_custody WHERE org_id=? AND id=?').bind(row.org_id, row.id).first();
        if (!c || c.state !== 'linked' || c.person_id !== row.person_id || c.visit_id !== row.visit_id || c.object_key !== ref.key || c.object_version !== ref.version || c.etag !== ref.etag || c.size !== row.size || c.sha256 !== row.sha256 || c.mime !== row.mime)
            fail(503, 'Private media custody lineage is invalid. Nothing was returned.');
    }
    return storedMediaBytes(row, bucket);
}
